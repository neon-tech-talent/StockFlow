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

        el.innerHTML = `
      <div class="module-header">
        <h2 class="card-title">Histórico de Ventas</h2>
        <div style="display:flex; gap:.5rem">
           <select class="form-input" onchange="SalesModule.setHistoryFilter(this.value, null)">
             ${Array.from({ length: 12 }, (_, i) => `<option value="${i}" ${i === this.historyMonth ? 'selected' : ''}>${new Date(2000, i).toLocaleString('es', { month: 'long' })}</option>`).join('')}
           </select>
           <select class="form-input" onchange="SalesModule.setHistoryFilter(null, this.value)">
             ${[2024, 2025, 2026].map(y => `<option value="${y}" ${y === this.historyYear ? 'selected' : ''}>${y}</option>`).join('')}
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
            <h3 class="card-title">📦 Seleccionar Productos</h3>
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
        document.getElementById('ps-q').oninput = (e) => this._renderProdGrid(products.filter(p => p.name.toLowerCase().includes(e.target.value.toLowerCase())));
        document.getElementById('cl-s').oninput = (e) => this._searchClients(e.target.value);
    },

    async _renderProdGrid(list) {
        const el = document.getElementById('ps-grid'); if (!el) return;
        el.innerHTML = list.map(p => `
      <div class="prod-chip" tabindex="0" role="button" aria-label="Agregar ${Utils.escHtml(p.name)}" onclick="SalesModule.addToCart('${p.id}', '${Utils.escHtml(p.name)}', ${p.sell_price})">
        <div class="prod-chip-name">${Utils.escHtml(p.name)}</div>
        <div class="prod-chip-stock">Stock: ${p.stock} ${Utils.escHtml(p.unit || 'Unidades')}</div>
        <div class="prod-chip-price">${Utils.currency(p.sell_price)}</div>
      </div>`).join('') || '<div class="empty-state">Sin resultados</div>';
    },

    async addToCart(id, name, price) {
        const prod = (await DB.getProducts()).find(p => p.id === id);
        const stock = prod ? prod.stock : 0;
        const exist = this.cart.find(x => x.productId === id);
        
        if (exist) {
            if (exist.quantity + 1 > stock) {
                if (typeof Toast !== 'undefined') Toast.show(`No hay stock suficiente de ${name}. Quedan: ${stock}`, 'warning');
                else alert(`No hay stock suficiente de ${name}. Stock disponible: ${stock}`);
                return;
            }
            exist.quantity++;
        } else {
            if (stock < 1) {
                if (typeof Toast !== 'undefined') Toast.show(`No hay stock disponible de ${name}`, 'warning');
                else alert(`No hay stock disponible de ${name}`);
                return;
            }
            this.cart.push({ 
                productId: id, productName: name, unitPrice: price, quantity: 1, 
                maxStock: stock, unit: prod?.unit || 'Unidades',
                discountType: 'none', discountValue: 0
            });
        }
        if (typeof Toast !== 'undefined') Toast.show(`${name} agregado al carrito`, 'info', 1500);
        this._renderCart();
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
        const q = parseInt(val);
        const item = this.cart[idx];
        if (q > item.maxStock) {
            if (typeof Toast !== 'undefined') Toast.show(`Stock insuficiente. Quedan ${item.maxStock}`, 'warning');
            else alert(`Stock insuficiente. Solo quedan ${item.maxStock} unidades.`);
            this._renderCart();
            return;
        }
        if (q > 0) item.quantity = q;
        else this.cart.splice(idx, 1);
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
            it._computedSubtotal = Math.max(0, subtotal);
            total += it._computedSubtotal;
        });

        const totalEl = document.getElementById('sale-total');
        if (totalEl) totalEl.textContent = Utils.currency(total);
        if (!this.cart.length) { el.innerHTML = Utils.emptyState('🛒', 'El carrito está vacío', 'Haz clic en un producto para agregarlo'); return; }
        el.innerHTML = `<div class="table-scroll"><table class="data-table"><tbody>${this.cart.map((it, i) => `
      <tr>
        <td>
          <strong>${Utils.escHtml(it.productName)}</strong><br>
          <small class="text-muted">${Utils.currency(it.unitPrice)} / ${Utils.escHtml(it.unit)}</small>
          <div style="margin-top: 0.3rem; display: flex; gap: 0.3rem;">
            <select class="form-input" style="padding: 0.2rem; font-size: 0.8rem; height: auto;" onchange="SalesModule.updateDiscountType(${i}, this.value)">
                <option value="none" ${it.discountType === 'none' ? 'selected' : ''}>Sin Desc.</option>
                <option value="percentage" ${it.discountType === 'percentage' ? 'selected' : ''}>Desc. (%)</option>
                <option value="amount" ${it.discountType === 'amount' ? 'selected' : ''}>Desc. ($)</option>
            </select>
            ${it.discountType !== 'none' ? `<input type="number" class="form-input" style="padding: 0.2rem; font-size: 0.8rem; height: auto; width: 60px;" placeholder="${it.discountType === 'percentage' ? '%' : '$'}" value="${it.discountValue || ''}" onchange="SalesModule.updateDiscountValue(${i}, this.value)" min="0">` : ''}
          </div>
        </td>
        <td style="vertical-align: top;"><div style="display:flex;align-items:center;gap:.3rem"><input type="number" class="qty-input" value="${it.quantity}" min="1" onchange="SalesModule.updateQty(${i}, this.value)"> <small>${Utils.escHtml(it.unit)}</small></div></td>
        <td style="vertical-align: top;">
          <strong>${Utils.currency(it._computedSubtotal)}</strong>
          ${it.discountType !== 'none' ? `<br><small class="text-success" style="font-size: 0.75rem;">-${Utils.currency((it.unitPrice * it.quantity) - it._computedSubtotal)}</small>` : ''}
        </td>
        <td style="vertical-align: top;"><button class="btn-icon danger" aria-label="Quitar ${Utils.escHtml(it.productName)}" onclick="SalesModule.removeFromCart(${i})">✕</button></td>
      </tr>`).join('')}</tbody></table></div>`;
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
          <button type="submit" class="btn btn-primary">Guardar y Seleccionar</button>
        </div>
      </form>`);
    },

    async saveNewClientInline(e) {
        e.preventDefault();
        const name    = document.getElementById('nc-name').value.trim();
        const dni     = document.getElementById('nc-dni').value.trim();
        const phone   = document.getElementById('nc-phone').value.trim();
        const address = document.getElementById('nc-address').value.trim();
        const email   = document.getElementById('nc-email').value.trim();

        await DB.saveClient({ name, dni, phone, address, email, balance: 0 });
        const all = await DB.getClients();
        const newClient = all.find(c => c.name === name);

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
        if (btn) btn.classList.add('active');
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
    }
};
