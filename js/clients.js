const ClientsModule = {
    async render(el) {
        el.innerHTML = `
      <div class="module-header">
        <input id="cl-q" type="text" placeholder="Buscar cliente..." class="search-input">
        <button class="btn btn-primary" onclick="ClientsModule.openModal()">+ Nuevo Cliente</button>
      </div>
      <div id="clients-container"><div class="empty-state">Cargando...</div></div>`;
        await this._render();
        document.getElementById('cl-q').oninput = () => this._render();
    },

    async _render() {
        const q = (document.getElementById('cl-q')?.value || '').toLowerCase();
        const data = (await DB.getClients()).filter(c => !q || c.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
        const box = document.getElementById('clients-container');
        if (!data.length) { box.innerHTML = '<div class="empty-state">No hay clientes</div>'; return; }
        box.innerHTML = `<table class="data-table"><thead><tr>
      <th>Nombre</th><th>Teléfono</th><th>Cuenta Corriente</th><th>Acciones</th>
    </tr></thead><tbody>${data.map(c => {
            const bal = parseFloat(c.balance || 0);
            const bc = bal > 0 ? 'text-danger' : bal < 0 ? 'text-success' : '';
            return `<tr>
        <td><strong>${Utils.escHtml(c.name)}</strong></td>
        <td>${Utils.escHtml(c.phone || '-')}</td>
        <td class="${bc}"><strong>${Utils.currency(bal)}</strong></td>
        <td>
          <button class="btn-icon" onclick="ClientsModule.viewDetail('${c.id}')">👁️</button>
          <button class="btn-icon" onclick="ClientsModule.openModal('${c.id}')">✏️</button>
          ${bal > 0 ? `<button class="btn btn-sm btn-outline" onclick="ClientsModule.payModal('${c.id}')">💰 Pago</button>` : ''}
        </td>
      </tr>`;
        }).join('')}</tbody></table>`;
    },

    async viewDetail(id) {
        const c = (await DB.getClients()).find(x => x.id === id);
        const movs = await DB.getMovements(id);
        const bal = parseFloat(c.balance || 0);
        const bc = bal > 0 ? 'text-danger' : bal < 0 ? 'text-success' : '';
        Modal.open(`
      <h2 class="modal-title">👤 ${Utils.escHtml(c.name)}</h2>
      <div class="card" style="margin-bottom:1.5rem">
        <div class="detail-grid">
           <div><label>Teléfono</label><p>${Utils.escHtml(c.phone || '-')}</p></div>
           <div><label>Saldo CC</label><p class="${bc}"><strong>${Utils.currency(bal)}</strong></p></div>
        </div>
      </div>
      <h3 class="card-title">Movimientos Cuenta Corriente</h3>
      ${movs.length ? `<table class="data-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Monto</th><th>Notas</th></tr></thead>
        <tbody>${movs.map(m => `<tr>
          <td>${new Date(m.created_at).toLocaleDateString('es')}</td>
          <td><span class="badge ${m.type === 'pago' || m.type === 'anulacion' ? 'badge-success' : 'badge-warning'}">${m.type.toUpperCase()}</span></td>
          <td class="${m.amount > 0 ? 'text-danger' : 'text-success'}">${m.amount > 0 ? '+' : ''}${Utils.currency(m.amount)}</td>
          <td>${Utils.escHtml(m.notes || '-')}</td>
        </tr>`).join('')}</tbody></table>` : '<div class="empty-state">Sin movimientos</div>'}
      <div class="modal-actions">
        ${bal > 0 ? `<button class="btn btn-primary" onclick="Modal.close();ClientsModule.payModal('${c.id}')">💰 Registrar Pago</button>` : ''}
        <button class="btn btn-outline" onclick="Modal.close()">Cerrar</button>
      </div>`);
    },

    async openModal(id) {
        const c = id ? (await DB.getClients()).find(x => x.id === id) : null;
        Modal.open(`
      <h2 class="modal-title">${c ? 'Editar' : 'Nuevo'} Cliente</h2>
      <form onsubmit="ClientsModule.save(event,'${id || ''}')">
        <div class="form-group"><label>Nombre *</label><input name="name" class="form-input" required value="${Utils.escHtml(c?.name || '')}"></div>
        <div class="form-group"><label>Teléfono</label><input name="phone" class="form-input" value="${Utils.escHtml(c?.phone || '')}"></div>
        <div class="form-group"><label>Email</label><input name="email" type="email" class="form-input" value="${Utils.escHtml(c?.email || '')}"></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </form>`);
    },

    async save(e, id) {
        e.preventDefault(); const f = e.target;
        await DB.saveClient({ id: id || undefined, name: f.name.value.trim(), phone: f.phone.value.trim(), email: f.email.value.trim() });
        Modal.close(); await this._render();
    },

    async payModal(id) {
        const c = (await DB.getClients()).find(x => x.id === id);
        Modal.open(`
      <h2 class="modal-title">Registrar Pago — ${Utils.escHtml(c.name)}</h2>
      <p style="color:var(--text-muted);margin-bottom:1rem">Saldo actual: <strong class="text-danger">${Utils.currency(c.balance)}</strong></p>
      <form onsubmit="ClientsModule.savePay(event,'${id}')">
        <div class="form-group"><label>Monto *</label><input name="amount" type="number" step="0.01" min="0.01" class="form-input" required autofocus></div>
        <div class="form-group"><label>Método de Pago *</label>
          <select name="method" class="form-input">
            <option value="efectivo">Efectivo (Suma a Caja)</option>
            <option value="transferencia">Transferencia / Otro</option>
          </select></div>
        <div class="form-group"><label>Notas / Referencia</label><input name="notes" class="form-input" placeholder="Referencia del pago"></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Registrar Pago</button>
        </div>
      </form>`);
    },

    async savePay(e, id) {
        e.preventDefault(); const f = e.target;
        await DB.registerPayment(id, parseFloat(f.amount.value), f.notes.value.trim(), f.method.value);
        Modal.close(); await this._render();
    }
};
