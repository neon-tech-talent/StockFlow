const SalesModule = {
    cart: [],
    paymentType: 'efectivo',
    selectedClientId: null,
    selectedClientName: null,

    historyMonth: new Date().getMonth(),
    historyYear: new Date().getFullYear(),

    async renderHistory(el) {
        const allSales = await DB.getSales();
        const filtered = allSales.filter(s => {
            const d = new Date(s.created_at);
            return d.getMonth() === this.historyMonth && d.getFullYear() === this.historyYear;
        });

        const totals = { efectivo: 0, transferencia: 0, cuenta_corriente: 0, qr: 0, debito: 0, credito: 0 };
        filtered.filter(s => !s.voided).forEach(s => {
            if (totals[s.payment_type] !== undefined) totals[s.payment_type] += parseFloat(s.total || 0);
        });

        const currentYr = new Date().getFullYear();
        const yearOptions = [currentYr - 2, currentYr - 1, currentYr, currentYr + 1];
        if (!yearOptions.includes(this.historyYear)) {
            yearOptions.push(this.historyYear);
            yearOptions.sort((a, b) => a - b);
        }

        el.innerHTML = `
      <div class="module-header">
        <h2 class="card-title">Histórico de Ventas</h2>
        <div style="display:flex; gap:.5rem; flex-wrap: wrap;">
           <select class="form-input" onchange="SalesModule.setHistoryFilter(this.value, null)">
             ${Array.from({ length: 12 }, (_, i) => {
               const raw = new Date(2000, i).toLocaleString('es', { month: 'long' });
               return `<option value="${i}" ${i === this.historyMonth ? 'selected' : ''}>${raw.charAt(0).toUpperCase() + raw.slice(1)}</option>`;
             }).join('')}
           </select>
           <select class="form-input" onchange="SalesModule.setHistoryFilter(null, this.value)">
             ${yearOptions.map(y => `<option value="${y}" ${y === this.historyYear ? 'selected' : ''}>${y}</option>`).join('')}
           </select>
           <button class="btn btn-primary" onclick="App.go('new-sale')">+ Nueva Venta</button>
        </div>
      </div>

      <div class="kpi-row" style="margin-bottom: 1.5rem">
        <div class="kpi-card" style="border-left: 4px solid var(--accent)">
            <div class="kpi-label">Efectivo</div>
            <div class="kpi-value" style="font-size:1.1rem">${Utils.currency(totals.efectivo)}</div>
        </div>
        <div class="kpi-card" style="border-left: 4px solid #3b82f6">
            <div class="kpi-label">Transf / QR</div>
            <div class="kpi-value" style="font-size:1.1rem">${Utils.currency(totals.transferencia + totals.qr)}</div>
        </div>
        <div class="kpi-card" style="border-left: 4px solid #ef4444">
            <div class="kpi-label">Tarjetas (D+C)</div>
            <div class="kpi-value" style="font-size:1.1rem">${Utils.currency(totals.debito + totals.credito)}</div>
        </div>
        <div class="kpi-card" style="border-left: 4px solid #10b981">
            <div class="kpi-label">Cta. Corriente</div>
            <div class="kpi-value" style="font-size:1.1rem">${Utils.currency(totals.cuenta_corriente)}</div>
        </div>
      </div>

      <div class="card">
        <table class="data-table">
          <thead><tr><th>ID</th><th>Fecha</th><th>Cliente</th><th>Total</th><th>Pago</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            ${filtered.map(s => `
              <tr class="${s.voided ? 'row-voided' : ''}">
                <td>#${s.id.slice(-4)}</td>
                <td>${new Date(s.created_at).toLocaleString('es')}</td>
                <td><strong>${Utils.escHtml(s.client_name || 'Consumidor Final')}</strong></td>
                <td><strong>${Utils.currency(s.total)}</strong></td>
                <td><span class="badge badge-info">${s.payment_type.toUpperCase()}</span></td>
                <td>
                   ${s.voided ? '<span class="badge badge-danger">ANULADA</span>' : '<span class="badge badge-success">COMPLETADA</span>'}
                   ${s.invoiced ? '<br><span class="badge" style="background:#8b5cf6; margin-top:0.3rem">FACTURADA</span>' : ''}
                </td>
                <td>
                  <button class="btn-icon" title="Ver" onclick="SalesModule.viewSale('${s.id}')">👁️</button>
                  ${!s.voided ? `<button class="btn-icon danger" title="Anular" onclick="SalesModule.voidSale('${s.id}')">🚫</button>` : ''}
                </td>
              </tr>
            `).join('') || '<tr><td colspan="7" class="empty-state">No hay ventas registradas en este período</td></tr>'}
          </tbody>
        </table>
      </div>`;
    },

    async setHistoryFilter(m, y) {
        if (m !== null) this.historyMonth = parseInt(m);
        if (y !== null) this.historyYear = parseInt(y);
        await this.renderHistory(document.getElementById('content'));
    },

    async viewSale(id) {
        const sales = await DB.getSales();
        const s = sales.find(x => x.id === id);
        const items = await DB.getSaleItems(id);
        Modal.open(`
      <h2 class="modal-title">Detalle de Venta #${id.slice(-4)}</h2>
      <div class="detail-grid">
        <div><label>Fecha</label><p>${new Date(s.created_at).toLocaleString('es')}</p></div>
        <div><label>Cliente</label><p>${Utils.escHtml(s.client_name || 'Consumidor Final')}</p></div>
        <div><label>Tipo de Pago</label><p>${s.payment_type.toUpperCase()}</p></div>
        <div><label>Estado</label><p>${s.voided ? 'ANULADA' : 'COMPLETADA'}</p></div>
      </div>
      <table class="data-table" style="margin-top:1.5rem">
        <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead>
        <tbody>
          ${items.map(it => {
            let subtotal = it.quantity * (parseFloat(it.unit_price) || 0);
            let discountInfo = '';
            if (it.discount_type === 'percentage') {
                const descVal = subtotal * ((parseFloat(it.discount_value) || 0) / 100);
                subtotal -= descVal;
                discountInfo = `<br><small class="text-success">-${it.discount_value}% (${Utils.currency(descVal)})</small>`;
            } else if (it.discount_type === 'amount') {
                subtotal -= parseFloat(it.discount_value) || 0;
                discountInfo = `<br><small class="text-success">-${Utils.currency(it.discount_value)} desc</small>`;
            }
            return `<tr>
              <td>${Utils.escHtml(it.product_name)}${discountInfo}</td>
              <td>${it.quantity}</td>
              <td>${Utils.currency(it.unit_price)}</td>
              <td>${Utils.currency(Math.max(0, subtotal))}</td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot><tr><td colspan="3" style="text-align:right"><strong>Total:</strong></td><td><strong>${Utils.currency(s.total)}</strong></td></tr></tfoot>
      </table>
      <div class="modal-actions">
        <!-- PDF button could go here -->
        <button class="btn btn-outline" onclick="Modal.close()">Cerrar</button>
      </div>`);
    },

    async voidSale(id) {
        if (confirm('¿Estás seguro de anular esta venta? El stock y saldos se restaurarán automáticamente.')) {
            await DB.voidSale(id);
            if (typeof Toast !== 'undefined') Toast.show('Venta anulada correctamente', 'info');
            await this.renderHistory(document.getElementById('content'));
        }
    },

    async renderNewSale(el) {
        this.cart = []; this.paymentType = 'efectivo'; this.selectedClientId = null; this.selectedClientName = null;
        const products = await DB.getProducts();
        el.innerHTML = `
      <div class="new-sale-layout">
        <div class="sale-left">
          <div class="card" style="margin-bottom:1rem">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.85rem; flex-wrap:wrap; gap:0.5rem;">
              <h3 class="card-title" style="margin:0;">📦 Seleccionar Productos</h3>
              <button type="button" class="btn btn-sm btn-primary" onclick="SalesModule.openExpressProductModal()" style="gap:0.35rem;">⚡ Carga Express</button>
            </div>
            <input id="ps-q" type="text" placeholder="Buscar por nombre..." class="form-input" style="margin-bottom:.8rem">
            <div id="ps-grid" class="prod-grid"></div>
          </div>
          <div class="card">
            <h3 class="card-title">🛒 Carrito de Venta</h3>
            <div id="cart-container"></div>
          </div>
        </div>
        <div class="sale-right">
          <div class="card" style="margin-bottom:1rem">
            <h3 class="card-title">👤 Cliente / Pago</h3>
            <div id="client-selector" style="margin-bottom:1rem">
              <input id="cl-s" type="text" placeholder="Buscar cliente..." class="form-input">
              <div id="cl-results" class="client-results"></div>
              <div id="selected-client-box"></div>
            </div>
            <label class="card-title" style="display:block;margin-bottom:.5rem">Medio de Pago</label>
            <div class="payment-grid">
              <button class="pay-btn active" id="pay-efec" type="button" onclick="SalesModule.setPayment('efectivo')">💵 <span>Efectivo</span></button>
              <button class="pay-btn" id="pay-tran" type="button" onclick="SalesModule.setPayment('transferencia')">📱 <span>Transf.</span></button>
              <button class="pay-btn" id="pay-cuen" type="button" onclick="SalesModule.setPayment('cuenta_corriente')">📒 <span>Cta. Cte.</span></button>
              <button class="pay-btn" id="pay-qr__" type="button" onclick="SalesModule.setPayment('qr')">🔳 <span>QR</span></button>
              <button class="pay-btn" id="pay-debi" type="button" onclick="SalesModule.setPayment('debito')">💳 <span>Tarjeta de Débito</span></button>
              <button class="pay-btn" id="pay-cred" type="button" onclick="SalesModule.setPayment('credito')">💳 <span>Tarjeta de Crédito</span></button>
            </div>
          </div>
          <div class="total-card">
            <div style="margin-bottom: 1rem; padding: 0.8rem; background: rgba(0,0,0,0.15); border-radius: 6px; display: flex; align-items: center; gap: 0.5rem; justify-content: center;">
              <input type="checkbox" id="sale-invoiced" style="width: 1.2rem; height: 1.2rem; cursor: pointer;">
              <label for="sale-invoiced" style="font-weight: 600; cursor: pointer; user-select: none;">Facturar esta venta</label>
            </div>
            <div class="total-row"><span>Total a Pagar:</span> <span id="sale-total">$0,00</span></div>
            <button class="btn btn-primary btn-lg" style="width:100%;margin-top:1.5rem" onclick="SalesModule.confirmSale()">🚀 FINALIZAR VENTA</button>
          </div>
        </div>
      </div>`;
        this._renderProdGrid(products);
        this._renderCart();
        document.getElementById('ps-q').oninput = (e) => {
            const val = e.target.value.toLowerCase();
            this._renderProdGrid(products.filter(p => p.name.toLowerCase().includes(val)));
        };
        document.getElementById('cl-s').oninput = (e) => this._searchClients(e.target.value);
    },

    async _renderProdGrid(list) {
        const el = document.getElementById('ps-grid'); if (!el) return;
        const q = (document.getElementById('ps-q')?.value || '').trim();

        if (!list.length) {
            el.innerHTML = `
              <div class="empty-state" style="padding: 1.5rem 1rem;">
                <span class="empty-state-icon">🔍</span>
                <strong>Sin resultados${q ? ` para "${Utils.escHtml(q)}"` : ''}</strong>
                ${q ? `<button type="button" class="btn btn-primary btn-sm" style="margin-top:0.75rem;" onclick="SalesModule.openExpressProductModal('${Utils.escHtml(q)}')">⚡ Crear "${Utils.escHtml(q)}" como producto express</button>` : ''}
              </div>`;
            return;
        }

        el.innerHTML = list.map(p => {
            const hasStock = p.stock > 0;
            const stockDisplay = hasStock 
                ? `<span class="prod-chip-stock">Stock: <strong>${p.stock}</strong> ${Utils.escHtml(p.unit || 'u.')}</span>`
                : `<span class="badge badge-danger" style="font-size:0.7rem;">Sin Stock</span>`;

            return `
              <div class="prod-chip ${!hasStock ? 'prod-no-stock' : ''}" tabindex="0" role="button" aria-label="Agregar ${Utils.escHtml(p.name)}" onclick="SalesModule.addToCart('${p.id}', '${Utils.escHtml(p.name)}', ${p.sell_price})">
                <div class="prod-chip-name">${Utils.escHtml(p.name)}</div>
                <div class="prod-chip-meta">
                  ${stockDisplay}
                  <button type="button" class="btn-add-stock" title="Cargar stock (+)" onclick="event.stopPropagation(); SalesModule.openQuickStockModal('${p.id}', '${Utils.escHtml(p.name)}', ${p.stock})">➕</button>
                </div>
                <div class="prod-chip-price">${Utils.currency(p.sell_price)}</div>
              </div>`;
        }).join('');
    },

    async addToCart(id, name, price) {
        const prod = (await DB.getProducts()).find(p => p.id === id);
        const stock = parseFloat(prod ? prod.stock : 0) || 0;
        const unit = prod?.unit || 'Unidades';
        const exist = this.cart.find(x => x.productId === id);

        // Determinación de cantidad de incremento según la unidad
        let delta = 1;
        if (unit === 'Litros') delta = stock < 1 ? Math.min(0.5, stock) : 1;
        else if (unit === 'Gramos') delta = stock < 100 ? (stock > 0 ? stock : 1) : 100;
        
        if (exist) {
            const nextQty = Math.round((exist.quantity + delta) * 1000) / 1000;
            if (nextQty > stock) {
                if (typeof Toast !== 'undefined') Toast.show(`No hay stock suficiente de ${name}. Quedan: ${stock} ${unit}`, 'warning');
                else alert(`No hay stock suficiente de ${name}. Stock disponible: ${stock} ${unit}`);
                return;
            }
            exist.quantity = nextQty;
        } else {
            if (stock <= 0) {
                if (typeof Toast !== 'undefined') Toast.show(`No hay stock disponible de ${name}`, 'warning');
                else alert(`No hay stock disponible de ${name}`);
                return;
            }
            const initialQty = Math.min(delta, stock);
            this.cart.push({ 
                productId: id, productName: name, unitPrice: price, quantity: initialQty, 
                maxStock: stock, unit: unit,
                discountType: 'none', discountValue: 0
            });
        }
        if (typeof Toast !== 'undefined') Toast.show(`${name} agregado al carrito`, 'info', 1400);
        this._renderCart();

        if (typeof anime !== 'undefined') {
            anime({
                targets: '#sale-total',
                scale: [1.2, 1],
                color: ['#e5c07b', '#d4af37'],
                duration: 350,
                easing: 'easeOutBack'
            });
        }
    },

    updateDiscountType(idx, type) {
        this.cart[idx].discountType = type;
        if (type === 'none') this.cart[idx].discountValue = 0;
        else if (!this.cart[idx].discountValue) this.cart[idx].discountValue = 0;
        this._renderCart();
    },

    updateDiscountValue(idx, val) {
        let v = parseFloat(val) || 0;
        const item = this.cart[idx];
        if (item.discountType === 'percentage' && v > 100) v = 100;
        if (item.discountType === 'amount' && v > (item.unitPrice * item.quantity)) v = item.unitPrice * item.quantity;
        if (v < 0) v = 0;
        item.discountValue = v;
        this._renderCart();
    },

    removeFromCart(idx) { this.cart.splice(idx, 1); this._renderCart(); },

    updateQty(idx, val) {
        const q = parseFloat(val);
        const item = this.cart[idx];
        if (isNaN(q) || q <= 0) {
            this.cart.splice(idx, 1);
            this._renderCart();
            return;
        }
        if (q > item.maxStock) {
            if (typeof Toast !== 'undefined') Toast.show(`Stock insuficiente de ${item.productName}. Quedan ${item.maxStock} ${item.unit}`, 'warning');
            else alert(`Stock insuficiente. Solo quedan ${item.maxStock} ${item.unit}.`);
            this._renderCart();
            return;
        }
        item.quantity = Math.round(q * 1000) / 1000;
        this._renderCart();
    },

    _renderCart() {
        const el = document.getElementById('cart-container'); if (!el) return;
        let total = 0;
        
        this.cart.forEach(it => {
            let subtotal = it.unitPrice * it.quantity;
            if (it.discountType === 'percentage') {
                subtotal -= subtotal * ((it.discountValue || 0) / 100);
            } else if (it.discountType === 'amount') {
                subtotal -= (it.discountValue || 0);
            }
            it._computedSubtotal = Math.max(0, Math.round(subtotal * 100) / 100);
            total += it._computedSubtotal;
        });

        const totalEl = document.getElementById('sale-total');
        if (totalEl) totalEl.textContent = Utils.currency(total);
        if (!this.cart.length) { el.innerHTML = Utils.emptyState('🛒', 'El carrito está vacío', 'Haz clic en un producto para agregarlo'); return; }
        el.innerHTML = `<div class="cart-list">${this.cart.map((it, i) => {
            const step = (it.unit === 'Litros') ? 0.5 : (it.unit === 'Gramos') ? 100 : 1;
            const unitAbbr = (it.unit === 'Litros') ? 'L' : (it.unit === 'Gramos') ? 'gr' : 'u.';
            return `
      <div class="cart-item-card">
        <div class="cart-item-header">
          <strong class="cart-item-name">${Utils.escHtml(it.productName)}</strong>
          <button class="btn-icon danger" aria-label="Quitar ${Utils.escHtml(it.productName)}" onclick="SalesModule.removeFromCart(${i})">✕</button>
        </div>
        <div class="cart-item-details">
          <small class="text-muted">${Utils.currency(it.unitPrice)} / ${Utils.escHtml(it.unit)}</small>
          <div>
            <strong class="cart-item-subtotal">${Utils.currency(it._computedSubtotal)}</strong>
            ${it.discountType !== 'none' ? `<br><small class="text-success" style="font-size: 0.75rem;">-${Utils.currency((it.unitPrice * it.quantity) - it._computedSubtotal)}</small>` : ''}
          </div>
        </div>
        <div class="cart-item-controls">
          <div class="discount-selector-group">
            <select class="form-input" style="padding: 0.25rem 0.35rem; font-size: 0.8rem; width: auto;" onchange="SalesModule.updateDiscountType(${i}, this.value)">
                <option value="none" ${it.discountType === 'none' ? 'selected' : ''}>Sin Desc.</option>
                <option value="percentage" ${it.discountType === 'percentage' ? 'selected' : ''}>Desc. (%)</option>
                <option value="amount" ${it.discountType === 'amount' ? 'selected' : ''}>Desc. ($)</option>
            </select>
            ${it.discountType !== 'none' ? `<input type="number" class="form-input" style="padding: 0.25rem; font-size: 0.8rem; width: 65px;" placeholder="${it.discountType === 'percentage' ? '%' : '$'}" value="${it.discountValue || ''}" onchange="SalesModule.updateDiscountValue(${i}, this.value)" min="0">` : ''}
          </div>
          <div class="qty-stepper" style="display:flex; align-items:center; gap:0.25rem;">
            <button type="button" class="btn-qty" aria-label="Disminuir cantidad" onclick="SalesModule.updateQty(${i}, ${Math.max(0, Math.round((it.quantity - step) * 1000) / 1000)})">-</button>
            <input type="number" class="qty-input" value="${it.quantity}" step="any" min="0.001" onchange="SalesModule.updateQty(${i}, this.value)" style="width:75px; text-align:center;">
            <button type="button" class="btn-qty" aria-label="Aumentar cantidad" onclick="SalesModule.updateQty(${i}, ${Math.round((it.quantity + step) * 1000) / 1000})">+</button>
            <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); min-width:18px;">${unitAbbr}</span>
          </div>
        </div>
      </div>`;
        }).join('')}</div>`;

        if (typeof anime !== 'undefined') {
            anime({ targets: '.cart-item-card', opacity: [0, 1], translateY: [10, 0], delay: anime.stagger(50), duration: 400, easing: 'easeOutQuad' });
        }
    },

        if (typeof anime !== 'undefined') {
            anime({ targets: '.cart-item-card', opacity: [0, 1], translateY: [10, 0], delay: anime.stagger(50), duration: 400, easing: 'easeOutQuad' });
        }
    },

    async _searchClients(q) {
        const res = document.getElementById('cl-results');
        if (q.length < 2) { res.innerHTML = ''; return; }
        const data = (await DB.getClients()).filter(c => 
            c.name.toLowerCase().includes(q.toLowerCase()) || 
            (c.dni && c.dni.toString().includes(q.toLowerCase()))
        );
        if (data.length > 0) {
            res.innerHTML = data.map(c => `<div class="client-chip" tabindex="0" role="button" onclick="SalesModule.selectClient('${c.id}', '${Utils.escHtml(c.name)}')">${Utils.escHtml(c.name)}</div>`).join('');
        } else {
            res.innerHTML = `
              <div class="client-chip text-muted" style="font-style:italic; cursor:default;">Sin resultados para "${Utils.escHtml(q)}"</div>
              <div class="client-chip" style="border-color:var(--accent); color:var(--accent); font-weight:600;" onclick="SalesModule.openNewClientModal('${Utils.escHtml(q)}')">
                ➕ Agregar "${Utils.escHtml(q)}" como nuevo cliente
              </div>`;
        }
    },

    openNewClientModal(prefillName = '') {
        Modal.open(`
      <h2 class="modal-title">➕ Nuevo Cliente</h2>
      <form onsubmit="SalesModule.saveNewClientInline(event)">
        <div class="form-group">
          <label>Nombre Completo *</label>
          <input id="nc-name" name="name" class="form-input" required value="${Utils.escHtml(prefillName)}" placeholder="Nombre completo">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>DNI</label>
            <input id="nc-dni" name="dni" class="form-input" placeholder="Opcional">
          </div>
          <div class="form-group">
            <label>Teléfono</label>
            <input id="nc-phone" name="phone" class="form-input" placeholder="Opcional">
          </div>
        </div>
        <div class="form-group">
          <label>Dirección</label>
          <input id="nc-address" name="address" class="form-input" placeholder="Opcional">
        </div>
        <div class="form-group">
          <label>Email</label>
          <input id="nc-email" name="email" class="form-input" type="email" placeholder="Opcional">
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar Cliente</button>
        </div>
      </form>`);
    },

    async saveNewClientInline(e) {
        e.preventDefault();
        const f = e.target;
        const name = f.name.value.trim();
        const dni = f.dni.value.trim();
        const phone = f.phone.value.trim();
        const address = f.address.value.trim();
        const email = f.email.value.trim();

        const newClient = await DB.saveClient({ name, dni, phone, address, email });
        Modal.close();
        if (typeof Toast !== 'undefined') Toast.show(`Cliente ${name} creado con éxito`, 'success');
        if (newClient) {
            this.selectClient(newClient.id, newClient.name);
        }
    },

    selectClient(id, name) {
        this.selectedClientId = id; this.selectedClientName = name;
        document.getElementById('cl-results').innerHTML = '';
        document.getElementById('cl-s').value = '';
        const box = document.getElementById('selected-client-box');
        if (box) {
            box.innerHTML = name ? `
          <div class="selected-client-tag">
            👤 <strong>${Utils.escHtml(name)}</strong>
            <button class="btn-icon" aria-label="Quitar cliente seleccionado" onclick="SalesModule.selectClient(null, null)">✕</button>
          </div>` : '';
        }
    },

    setPayment(type) {
        this.paymentType = type;
        const map = { efectivo: 'pay-efec', transferencia: 'pay-tran', cuenta_corriente: 'pay-cuen', qr: 'pay-qr__', debito: 'pay-debi', credito: 'pay-cred' };
        document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active'));
        const btn = document.getElementById(map[type]);
        if (btn) {
            btn.classList.add('active');
            if (typeof anime !== 'undefined') {
                anime({
                    targets: btn,
                    scale: [0.95, 1],
                    duration: 250,
                    easing: 'easeOutBack'
                });
            }
        }
    },

    async confirmSale() {
        if (!this.cart.length) {
            if (typeof Toast !== 'undefined') Toast.show('El carrito está vacío', 'warning');
            else alert('Carrito vacío');
            return;
        }
        if (this.paymentType === 'cuenta_corriente' && !this.selectedClientId) {
            if (typeof Toast !== 'undefined') Toast.show('Selecciona un cliente para la cuenta corriente', 'warning');
            else alert('Selecciona un cliente para cuenta corriente');
            return;
        }
        
        try {
            const invoiced = document.getElementById('sale-invoiced') ? document.getElementById('sale-invoiced').checked : false;
            const total = this.cart.reduce((s, i) => s + (i._computedSubtotal || 0), 0);
            await DB.saveSale({
                total, paymentType: this.paymentType,
                clientId: this.selectedClientId, clientName: this.selectedClientName,
                invoiced: invoiced
            }, this.cart);
            if (typeof Toast !== 'undefined') Toast.show('¡Venta registrada con éxito!', 'success');
            App.go('sales');
        } catch (e) {
            console.error(e);
            if (typeof Toast !== 'undefined') Toast.show('Error al registrar la venta', 'danger');
            else alert('Error al guardar la venta');
        }
    },

    /* ── CARGA EXPRESS DE PRODUCTOS EN POS ── */
    async openExpressProductModal(prefillName = '') {
        const categories = await DB.getCategories();
        Modal.open(`
      <h2 class="modal-title">⚡ Carga Express de Producto</h2>
      <p class="text-muted" style="font-size:0.85rem; margin-top:-0.8rem; margin-bottom:1.25rem;">
        Crea el producto en el momento y súmalo directamente a tu venta actual.
      </p>
      <form onsubmit="SalesModule.saveExpressProduct(event)">
        <div class="form-group">
          <label>Nombre del Producto *</label>
          <input id="exp-name" name="name" class="form-input" required value="${Utils.escHtml(prefillName)}" placeholder="Ej: Alfajor Chocolate">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Precio de Venta *</label>
            <input id="exp-sell-price" name="sell_price" type="number" step="0.01" min="0" class="form-input" required placeholder="0.00">
          </div>
          <div class="form-group">
            <label>Stock Inicial *</label>
            <input id="exp-stock" name="stock" type="number" step="1" min="1" value="1" class="form-input" required placeholder="1">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Categoría (Opcional)</label>
            <select id="exp-category" name="category_id" class="form-input">
              <option value="">-- Sin Categoría --</option>
              ${categories.map(c => `<option value="${c.id}">${Utils.escHtml(c.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Unidad de Medida</label>
            <select id="exp-unit" name="unit" class="form-input">
              <option value="Unidades" selected>Unidades</option>
              <option value="Kg">Kg</option>
              <option value="Gramos">Gramos</option>
              <option value="Litros">Litros</option>
              <option value="Metros">Metros</option>
              <option value="Porción">Porción</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Precio de Costo (Opcional)</label>
          <input id="exp-cost-price" name="cost_price" type="number" step="0.01" min="0" class="form-input" placeholder="0.00">
        </div>
        <div style="background:var(--accent-subtle); border:1px solid var(--border); border-radius:var(--radius-sm); padding:0.65rem 0.85rem; margin-bottom:1.25rem; display:flex; align-items:center; gap:0.5rem;">
          <span>🛒</span>
          <small style="color:var(--accent-light); font-weight:600;">Se agregará 1 unidad automáticamente al carrito de venta actual.</small>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">⚡ Guardar y Sumar a Venta</button>
        </div>
      </form>`);
    },

    async saveExpressProduct(e) {
        e.preventDefault();
        const f = e.target;
        const name = f.name.value.trim();
        const sellPrice = parseFloat(f.sell_price.value) || 0;
        const stock = parseFloat(f.stock.value) || 1;
        const categoryId = f.category_id.value || null;
        const unit = f.unit.value || 'Unidades';
        const costPrice = parseFloat(f.cost_price.value) || 0;

        if (!name || sellPrice <= 0) {
            if (typeof Toast !== 'undefined') Toast.show('Ingresa un nombre y precio de venta válido', 'warning');
            return;
        }

        try {
            const newProd = await DB.saveProduct({
                name,
                sellPrice,
                stock,
                categoryId,
                unit,
                costPrice
            });

            Modal.close();
            if (typeof Toast !== 'undefined') Toast.show(`¡Producto "${name}" creado con éxito!`, 'success');

            // Refrescar listado local de productos
            const products = await DB.getProducts();
            const q = (document.getElementById('ps-q')?.value || '').toLowerCase();
            this._renderProdGrid(q ? products.filter(p => p.name.toLowerCase().includes(q)) : products);

            // Agregar automáticamente al carrito de venta
            const prodId = newProd?.id || products.find(p => p.name.toLowerCase() === name.toLowerCase())?.id;
            if (prodId) {
                await this.addToCart(prodId, name, sellPrice);
            }
        } catch (err) {
            console.error("Error al guardar producto express:", err);
            if (typeof Toast !== 'undefined') Toast.show('Error al guardar el producto express', 'danger');
        }
    },

    /* ── CARGA RÁPIDA DE STOCK (+) ── */
    openQuickStockModal(productId, productName, currentStock) {
        Modal.open(`
      <h2 class="modal-title">➕ Cargar Stock Rápido</h2>
      <div style="margin-bottom:1.25rem;">
        <h4 style="color:var(--text-main); font-size:1.1rem; margin-bottom:0.25rem;">${Utils.escHtml(productName)}</h4>
        <p class="text-muted" style="font-size:0.85rem;">Stock actual disponible: <strong style="color:var(--accent); font-size:1rem;">${currentStock}</strong></p>
      </div>
      <form onsubmit="SalesModule.saveQuickStock(event, '${productId}', '${Utils.escHtml(productName)}')">
        <div class="form-group">
          <label>Cantidad de Unidades a Ingresar *</label>
          <input id="qs-qty" name="qty" type="number" step="1" min="1" value="10" class="form-input" required autofocus placeholder="Ej: 10">
        </div>
        <div style="margin: 1.1rem 0; display:flex; align-items:center; gap:0.5rem; background:rgba(0,0,0,0.2); padding:0.6rem 0.8rem; border-radius:var(--radius-sm); border:1px solid var(--border-subtle);">
          <input type="checkbox" id="qs-add-cart" name="add_to_cart" checked style="width:1.15rem; height:1.15rem; cursor:pointer;">
          <label for="qs-add-cart" style="font-weight:600; font-size:0.85rem; cursor:pointer; user-select:none; margin:0; color:var(--text-main);">
            Sumar 1 unidad inmediatamente al carrito de venta actual
          </label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">➕ Cargar Stock</button>
        </div>
      </form>`);
    },

    async saveQuickStock(e, productId, productName) {
        e.preventDefault();
        const f = e.target;
        const addedQty = parseFloat(f.qty.value) || 0;
        const addToCartChecked = f.add_to_cart?.checked;

        if (addedQty <= 0) {
            if (typeof Toast !== 'undefined') Toast.show('Ingresa una cantidad válida', 'warning');
            return;
        }

        try {
            await DB.adjustStock(productId, addedQty);
            Modal.close();
            if (typeof Toast !== 'undefined') Toast.show(`Stock de "${productName}" incrementado (+${addedQty})`, 'success');

            // Refrescar lista de productos en Nueva Venta
            const products = await DB.getProducts();
            const q = (document.getElementById('ps-q')?.value || '').toLowerCase();
            this._renderProdGrid(q ? products.filter(p => p.name.toLowerCase().includes(q)) : products);

            // Si estaba marcado, sumar al carrito
            if (addToCartChecked) {
                const prod = products.find(p => p.id === productId);
                if (prod) {
                    await this.addToCart(productId, productName, prod.sell_price);
                }
            }
        } catch (err) {
            console.error("Error al ajustar stock:", err);
            if (typeof Toast !== 'undefined') Toast.show('Error al actualizar el stock', 'danger');
        }
    }
};
