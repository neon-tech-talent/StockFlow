const SalesModule = {
    cart: [],
    paymentType: 'efectivo',
    selectedClientId: null,
    selectedClientName: null,

    async renderHistory(el) {
        const sales = await DB.getSales();
        el.innerHTML = `
      <div class="module-header">
        <h2 class="card-title">Histórico de Ventas</h2>
        <button class="btn btn-primary" onclick="App.go('new-sale')">+ Nueva Venta</button>
      </div>
      <div class="card">
        <table class="data-table">
          <thead><tr><th>ID</th><th>Fecha</th><th>Cliente</th><th>Total</th><th>Pago</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            ${sales.map(s => `
              <tr class="${s.voided ? 'row-voided' : ''}">
                <td>#${s.id.slice(-4)}</td>
                <td>${new Date(s.created_at).toLocaleString('es')}</td>
                <td><strong>${Utils.escHtml(s.client_name || 'Consumidor Final')}</strong></td>
                <td><strong>${Utils.currency(s.total)}</strong></td>
                <td><span class="badge badge-info">${s.payment_type.toUpperCase()}</span></td>
                <td>${s.voided ? '<span class="badge badge-danger">ANULADA</span>' : '<span class="badge badge-success">COMPLETADA</span>'}</td>
                <td>
                  <button class="btn-icon" title="Ver" onclick="SalesModule.viewSale('${s.id}')">👁️</button>
                  ${!s.voided ? `<button class="btn-icon danger" title="Anular" onclick="SalesModule.voidSale('${s.id}')">🚫</button>` : ''}
                </td>
              </tr>
            `).join('') || '<tr><td colspan="7" class="empty-state">No hay ventas registradas</td></tr>'}
          </tbody>
        </table>
      </div>`;
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
          ${items.map(it => `<tr>
            <td>${Utils.escHtml(it.product_name)}</td>
            <td>${it.quantity}</td>
            <td>${Utils.currency(it.unit_price)}</td>
            <td>${Utils.currency(it.quantity * it.unit_price)}</td>
          </tr>`).join('')}
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
              <button class="pay-btn active" id="pay-efec" onclick="SalesModule.setPayment('efectivo')">💵 <span>Efectivo</span></button>
              <button class="pay-btn" id="pay-tran" onclick="SalesModule.setPayment('transferencia')">📱 <span>Transf.</span></button>
              <button class="pay-btn" id="pay-cuen" onclick="SalesModule.setPayment('cuenta_corriente')">📒 <span>Cta. Cte.</span></button>
              <button class="pay-btn" id="pay-qr__" onclick="SalesModule.setPayment('qr')">🔳 <span>QR</span></button>
              <button class="pay-btn" id="pay-debi" onclick="SalesModule.setPayment('debito')">💳 <span>Débito</span></button>
              <button class="pay-btn" id="pay-cred" onclick="SalesModule.setPayment('credito')">💳 <span>Crédito</span></button>
            </div>
          </div>
          <div class="total-card">
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
      <div class="prod-chip" onclick="SalesModule.addToCart('${p.id}', '${Utils.escHtml(p.name)}', ${p.sell_price})">
        <div class="prod-chip-name">${Utils.escHtml(p.name)}</div>
        <div class="prod-chip-stock">Stock: ${p.stock}</div>
        <div class="prod-chip-price">${Utils.currency(p.sell_price)}</div>
      </div>`).join('') || '<div class="empty-state">Sin resultados</div>';
    },

    addToCart(id, name, price) {
        const exist = this.cart.find(x => x.productId === id);
        if (exist) exist.quantity++;
        else this.cart.push({ productId: id, productName: name, unitPrice: price, quantity: 1 });
        this._renderCart();
    },

    removeFromCart(idx) { this.cart.splice(idx, 1); this._renderCart(); },

    updateQty(idx, val) {
        const q = parseInt(val);
        if (q > 0) this.cart[idx].quantity = q;
        else this.cart.splice(idx, 1);
        this._renderCart();
    },

    _renderCart() {
        const el = document.getElementById('cart-container'); if (!el) return;
        const total = this.cart.reduce((s, i) => s + (i.unitPrice * i.quantity), 0);
        document.getElementById('sale-total').textContent = Utils.currency(total);
        if (!this.cart.length) { el.innerHTML = '<div class="empty-state">El carrito está vacío</div>'; return; }
        el.innerHTML = `<table class="data-table"><tbody>${this.cart.map((it, i) => `
      <tr>
        <td><strong>${Utils.escHtml(it.productName)}</strong><br><small class="text-muted">${Utils.currency(it.unitPrice)}</small></td>
        <td><input type="number" class="qty-input" value="${it.quantity}" onchange="SalesModule.updateQty(${i}, this.value)"></td>
        <td><strong>${Utils.currency(it.quantity * it.unitPrice)}</strong></td>
        <td><button class="btn-icon danger" onclick="SalesModule.removeFromCart(${i})">✕</button></td>
      </tr>`).join('')}</tbody></table>`;
    },

    async _searchClients(q) {
        const res = document.getElementById('cl-results');
        if (q.length < 2) { res.innerHTML = ''; return; }
        const data = (await DB.getClients()).filter(c => c.name.toLowerCase().includes(q.toLowerCase()));
        if (data.length > 0) {
            res.innerHTML = data.map(c => `<div class="client-chip" onclick="SalesModule.selectClient('${c.id}', '${Utils.escHtml(c.name)}')">${Utils.escHtml(c.name)}</div>`).join('');
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
          <label>Nombre *</label>
          <input id="nc-name" name="name" class="form-input" required value="${Utils.escHtml(prefillName)}" placeholder="Nombre completo">
        </div>
        <div class="form-group">
          <label>Teléfono</label>
          <input id="nc-phone" name="phone" class="form-input" placeholder="Opcional">
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
        const name  = document.getElementById('nc-name').value.trim();
        const phone = document.getElementById('nc-phone').value.trim();
        const email = document.getElementById('nc-email').value.trim();

        await DB.saveClient({ name, phone, email, balance: 0 });

        // Find the newly created client to get its ID
        const all = await DB.getClients();
        const newClient = all.find(c => c.name === name);

        Modal.close();
        if (newClient) {
            this.selectClient(newClient.id, newClient.name);
        }
    },

    selectClient(id, name) {
        this.selectedClientId = id; this.selectedClientName = name;
        document.getElementById('cl-results').innerHTML = '';
        document.getElementById('cl-s').value = '';
        document.getElementById('selected-client-box').innerHTML = `
      <div class="selected-client-tag">
        👤 <strong>${name}</strong>
        <button class="btn-icon" onclick="SalesModule.selectClient(null, null)">✕</button>
      </div>`;
    },

    setPayment(type) {
        this.paymentType = type;
        const map = { efectivo: 'pay-efec', transferencia: 'pay-tran', cuenta_corriente: 'pay-cuen', qr: 'pay-qr__', debito: 'pay-debi', credito: 'pay-cred' };
        document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active'));
        const btn = document.getElementById(map[type]);
        if (btn) btn.classList.add('active');
    },

    async confirmSale() {
        if (!this.cart.length) { alert('Carrito vacío'); return; }
        if (this.paymentType === 'cuenta_corriente' && !this.selectedClientId) { alert('Selecciona un cliente para cuenta corriente'); return; }
        
        try {
            const total = this.cart.reduce((s, i) => s + (i.unitPrice * i.quantity), 0);
            await DB.saveSale({
                total, paymentType: this.paymentType,
                clientId: this.selectedClientId, clientName: this.selectedClientName
            }, this.cart);
            alert('Venta finalizada con éxito');
            App.go('sales');
        } catch (e) {
            console.error(e);
            alert('Error al guardar la venta');
        }
    }
};
