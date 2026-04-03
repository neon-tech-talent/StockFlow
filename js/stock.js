const StockModule = {
    activeTab: 'products',

    async render(el) {
        el.innerHTML = `
      <div class="tabs-header">
        <div class="tab-btn ${this.activeTab === 'products' ? 'active' : ''}" onclick="StockModule.setTab('products')">📦 Productos</div>
        <div class="tab-btn ${this.activeTab === 'supplies' ? 'active' : ''}" onclick="StockModule.setTab('supplies')">🌾 Insumos</div>
        <div class="tab-btn ${this.activeTab === 'expenses' ? 'active' : ''}" onclick="StockModule.setTab('expenses')">💸 Gastos Externos</div>
      </div>
      <div id="stock-tab-content"><div class="empty-state">Cargando...</div></div>`;
        await this._renderActiveTab();
    },

    async setTab(tab) {
        this.activeTab = tab;
        await this.render(document.getElementById('content'));
    },

    async _renderActiveTab() {
        const el = document.getElementById('stock-tab-content');
        if (this.activeTab === 'products') await this._renderProducts(el);
        else if (this.activeTab === 'supplies') await this._renderSupplies(el);
        else if (this.activeTab === 'expenses') await this._renderExpenses(el);
    },

    async _renderProducts(el) {
        el.innerHTML = `
      <div class="module-header">
        <div class="search-group">
          <input id="sp-name" type="text" placeholder="Buscar producto..." class="search-input">
          <select id="sp-cat" class="select-input"><option value="">Todas las categorías</option></select>
        </div>
        <div class="btn-row">
          <button class="btn btn-outline" onclick="StockModule.openCatModal()">⚙ Categorías</button>
          <button class="btn btn-primary" onclick="StockModule.openProductModal()">+ Nuevo Producto</button>
        </div>
      </div>
      <div id="products-container"></div>`;
        await this._fillCatSelect('sp-cat');
        await this._renderTable();
        document.getElementById('sp-name').oninput = () => this._renderTable();
        document.getElementById('sp-cat').onchange = () => this._renderTable();
    },

    async _renderSupplies(el) {
        const supplies = (await DB.getSupplies()).sort((a,b) => a.name.localeCompare(b.name));
        const history = await DB.getDeductions();
        el.innerHTML = `
      <div class="module-header">
        <div>
          <h2 class="card-title">Listado de Insumos</h2>
          <p class="text-muted" style="font-size:0.85rem">Gestión de stock de materias primas y consumibles.</p>
        </div>
        <div class="btn-row">
          <button class="btn btn-outline" onclick="StockModule.openDeductionModal()">Descontar Insumo</button>
          <button class="btn btn-primary" onclick="StockModule.openSupplyModal()">+ Nuevo Insumo</button>
        </div>
      </div>
      <div class="card" style="margin-bottom:1.5rem">
        <table class="data-table">
          <thead><tr><th>Insumo</th><th>Stock Actual</th><th>Acciones</th></tr></thead>
          <tbody>
            ${supplies.map(s => `<tr>
              <td><strong>${Utils.escHtml(s.name)}</strong></td>
              <td><span class="badge ${s.stock <= 0 ? 'badge-danger' : 'badge-success'}">${s.stock} ${Utils.escHtml(s.unit || 'uds')}</span></td>
              <td>
                <button class="btn-icon" onclick="StockModule.openSupplyModal('${s.id}')">✏️</button>
                <button class="btn-icon danger" onclick="StockModule.delSupply('${s.id}')">🗑️</button>
              </td>
            </tr>`).join('') || '<tr><td colspan="3" class="empty-state">No hay insumos registrados</td></tr>'}
          </tbody>
        </table>
      </div>
      <div class="card">
        <h3 class="card-title">Historial de Bajas / Consumos</h3>
        <table class="data-table">
          <thead><tr><th>Fecha</th><th>Insumo</th><th>Cant.</th><th>Motivo</th></tr></thead>
          <tbody>
            ${history.map(d => `<tr>
              <td>${new Date(d.created_at).toLocaleString('es')}</td>
              <td><strong>${Utils.escHtml(d.supply_name)}</strong></td>
              <td class="text-danger">-${d.quantity}</td>
              <td class="text-muted" style="font-size:0.85rem">${Utils.escHtml(d.reason)}</td>
            </tr>`).join('') || '<tr><td colspan="4" class="empty-state">No hay movimientos</td></tr>'}
          </tbody>
        </table>
      </div>`;
    },

    async _renderExpenses(el) {
        const list = await DB.getExpenses();
        const total = list.reduce((sum, e) => sum + parseFloat(e.amount), 0);
        el.innerHTML = `
      <div class="module-header">
        <div><h2 class="card-title">Gastos del Negocio</h2></div>
        <button class="btn btn-primary" onclick="StockModule.openExpenseModal()">+ Cargar Gasto</button>
      </div>
      <div class="card" style="margin-bottom:1rem">
        <div class="total-row"><span>Total Histórico Gastos:</span> <span>${Utils.currency(total)}</span></div>
      </div>
      <div class="card">
        <table class="data-table">
          <thead><tr><th>Fecha</th><th>Concepto</th><th>Monto</th><th>Acciones</th></tr></thead>
          <tbody>
            ${list.map(e => `<tr>
              <td>${new Date(e.date).toLocaleDateString('es')}</td>
              <td><strong>${Utils.escHtml(e.concept)}</strong></td>
              <td class="text-danger">-${Utils.currency(e.amount)}</td>
              <td><button class="btn-icon danger" onclick="StockModule.delExpense('${e.id}')">🗑️</button></td>
            </tr>`).join('') || '<tr><td colspan="4" class="empty-state">No hay gastos registrados</td></tr>'}
          </tbody>
        </table>
      </div>`;
    },

    async openSupplyModal(id) {
        const s = id ? (await DB.getSupplies()).find(x => x.id === id) : null;
        Modal.open(`
      <h2 class="modal-title">${s ? 'Editar' : 'Nuevo'} Insumo</h2>
      <form onsubmit="StockModule.saveSupply(event, '${id || ''}')">
        <div class="form-group"><label>Nombre del Insumo *</label>
          <input name="name" class="form-input" required value="${Utils.escHtml(s?.name || '')}"></div>
        <div class="form-row">
          <div class="form-group"><label>Stock Inicial *</label>
            <input name="stock" type="number" min="0" class="form-input" required value="${s?.stock ?? ''}"></div>
          <div class="form-group"><label>Unidad de medida</label>
            <input name="unit" class="form-input" placeholder="unidades" value="${Utils.escHtml(s?.unit || '')}"></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </form>`);
    },

    async saveSupply(e, id) {
        e.preventDefault();
        const f = e.target;
        await DB.saveSupply({
            id: id || undefined, name: f.name.value.trim(),
            stock: parseInt(f.stock.value), unit: f.unit.value.trim()
        });
        Modal.close();
        await this._renderActiveTab();
    },

    async delSupply(id) {
        if (confirm('¿Eliminar este insumo?')) { await DB.deleteSupply(id); await this._renderActiveTab(); }
    },

    async openDeductionModal() {
        const sups = await DB.getSupplies();
        if (!sups.length) { alert('Primero debes cargar algún insumo.'); return; }
        Modal.open(`
      <h2 class="modal-title">Descontar Stock de Insumo</h2>
      <form onsubmit="StockModule.saveDeduction(event)">
        <div class="form-group"><label>Selecciona Insumo *</label>
          <select name="productId" class="form-input" required>
            <option value="">-- Elige un insumo --</option>
            ${sups.map(s => `<option value="${s.id}">${Utils.escHtml(s.name)} (Queda: ${s.stock} ${s.unit})</option>`).join('')}
          </select></div>
        <div class="form-row">
          <div class="form-group"><label>Cantidad a descontar *</label>
            <input name="quantity" type="number" min="1" class="form-input" required></div>
          <div class="form-group"><label>Motivo del uso *</label>
            <input name="reason" class="form-input" placeholder="Ej: Preparación de pedido..." required></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Confirmar Descuento</button>
        </div>
      </form>`);
    },

    async saveDeduction(e) {
        e.preventDefault();
        const f = e.target;
        const productId = f.productId.value;
        const productName = f.productId.options[f.productId.selectedIndex].text.split(' (Queda:')[0];
        await DB.saveDeduction({
            productId, productName,
            quantity: parseInt(f.quantity.value),
            reason: f.reason.value.trim()
        });
        Modal.close();
        await this._renderActiveTab();
    },

    async openExpenseModal() {
        Modal.open(`
      <h2 class="modal-title">Cargar Gasto Externo</h2>
      <form onsubmit="StockModule.saveExpense(event)">
        <div class="form-group"><label>Concepto del Gasto *</label>
          <input name="concept" class="form-input" placeholder="Ej: Alquiler, Luz" required></div>
        <div class="form-row">
          <div class="form-group"><label>Monto *</label>
            <input name="amount" type="number" step="0.01" min="0" class="form-input" required></div>
          <div class="form-group"><label>Fecha *</label>
            <input name="date" type="date" class="form-input" required value="${new Date().toISOString().split('T')[0]}"></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </form>`);
    },

    async saveExpense(e) {
        e.preventDefault();
        const f = e.target;
        await DB.saveExpense({ concept: f.concept.value.trim(), amount: parseFloat(f.amount.value), date: f.date.value });
        Modal.close();
        await this._renderActiveTab();
    },

    async delExpense(id) {
        if (confirm('¿Eliminar este registro de gasto?')) { await DB.deleteExpense(id); await this._renderActiveTab(); }
    },

    async _fillCatSelect(id) {
        const sel = document.getElementById(id); if (!sel) return;
        const cats = await DB.getCategories();
        sel.innerHTML = '<option value="">Todas las categorías</option>';
        cats.forEach(c => sel.insertAdjacentHTML('beforeend', `<option value="${c.id}">${Utils.escHtml(c.name)}</option>`));
    },

    async _renderTable() {
        const q = (document.getElementById('sp-name')?.value || '').toLowerCase();
        const cf = document.getElementById('sp-cat')?.value || '';
        const cats = await DB.getCategories();
        const prods = await DB.getProducts();
        const rows = prods.filter(p => (!q || p.name.toLowerCase().includes(q)) && (!cf || p.category_id === cf));
        const box = document.getElementById('products-container');
        if (!rows.length) { box.innerHTML = '<div class="empty-state">No hay productos</div>'; return; }
        box.innerHTML = `<table class="data-table"><thead><tr><th>Producto</th><th>Categoría</th><th>P. Venta</th><th>P. Costo</th><th>Stock</th><th>Acciones</th></tr></thead><tbody>
          ${rows.map(p => {
            const cat = cats.find(c => c.id === p.category_id);
            return `<tr><td><strong>${Utils.escHtml(p.name)}</strong></td><td>${cat?Utils.escHtml(cat.name):'-'}</td><td>${Utils.currency(p.sell_price)}</td><td>${Utils.currency(p.cost_price)}</td>
            <td><span class="badge ${p.stock<=0?'badge-danger':p.stock<5?'badge-warning':'badge-success'}">${p.stock}</span></td>
            <td><button class="btn-icon" onclick="StockModule.openProductModal('${p.id}')">✏️</button><button class="btn-icon danger" onclick="StockModule.delProduct('${p.id}')">🗑️</button></td></tr>`;
          }).join('')}</tbody></table>`;
    },

    async openProductModal(id) {
        const p = id ? (await DB.getProducts()).find(x => x.id === id) : null;
        const cats = await DB.getCategories();
        Modal.open(`
      <h2 class="modal-title">${p ? 'Editar' : 'Nuevo'} Producto</h2>
      <form onsubmit="StockModule.saveProduct(event,'${id || ''}')">
        <div class="form-group"><label>Nombre *</label>
          <input name="name" class="form-input" required value="${Utils.escHtml(p?.name || '')}"></div>
        <div class="form-group"><label>Categoría</label>
          <select name="categoryId" class="form-input">
            <option value="">Sin categoría</option>
            ${cats.map(c => `<option value="${c.id}" ${p?.category_id === c.id ? 'selected' : ''}>${Utils.escHtml(c.name)}</option>`).join('')}
          </select></div>
        <div class="form-row">
          <div class="form-group"><label>Precio Venta *</label>
            <input name="sellPrice" type="number" step="0.01" min="0" class="form-input" required value="${p?.sell_price || ''}"></div>
          <div class="form-group"><label>Precio Costo *</label>
            <input name="costPrice" type="number" step="0.01" min="0" class="form-input" required value="${p?.cost_price || ''}"></div>
        </div>
        <div class="form-group"><label>Stock *</label>
          <input name="stock" type="number" min="0" class="form-input" required value="${p?.stock ?? ''}"></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </form>`);
    },

    async saveProduct(e, id) {
        e.preventDefault(); const f = e.target;
        await DB.saveProduct({ id: id||undefined, name: f.name.value.trim(), categoryId: f.categoryId.value, sellPrice: parseFloat(f.sellPrice.value), costPrice: parseFloat(f.costPrice.value), stock: parseInt(f.stock.value) });
        Modal.close(); await this._renderProducts(document.getElementById('stock-tab-content'));
    },

    async delProduct(id) { if (confirm('¿Eliminar producto?')) { await DB.deleteProduct(id); await this._renderTable(); } },

    async openCatModal() {
        Modal.open(`<h2 class="modal-title">Categorías</h2><form onsubmit="StockModule.saveCat(event)" style="display:flex;gap:.5rem;margin-bottom:1rem">
        <input type="hidden" id="cat-id"><input id="cat-name" class="form-input" placeholder="Nombre" required style="flex:1"><button class="btn btn-primary" type="submit">Guardar</button></form><div id="cat-list"></div>`);
        await this._renderCatList();
    },

    async _renderCatList() {
        const cats = await DB.getCategories(); const el = document.getElementById('cat-list'); if (!el) return;
        el.innerHTML = `<table class="data-table"><tbody>${cats.map(c => `<tr><td>${Utils.escHtml(c.name)}</td><td><button class="btn-icon danger" onclick="StockModule.delCat('${c.id}')">🗑️</button></td></tr>`).join('')}</tbody></table>`;
    },

    async saveCat(e) {
        e.preventDefault(); const name = document.getElementById('cat-name').value.trim();
        await DB.saveCategory({ name }); await this._renderCatList(); document.getElementById('cat-name').value='';
    },

    async delCat(id) { if (await DB.deleteCategory(id)) await this._renderCatList(); else alert('Tiene productos asociados'); }
};
