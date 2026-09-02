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
        const data = (await DB.getClients()).filter(c => 
            !q || 
            c.name.toLowerCase().includes(q) || 
            (c.dni && c.dni.toString().includes(q))
        ).sort((a, b) => a.name.localeCompare(b.name));
        const box = document.getElementById('clients-container');
        if (!data.length) { box.innerHTML = Utils.emptyState('👥', 'No hay clientes encontrados', 'Registra un nuevo cliente para gestionar sus compras'); return; }
        box.innerHTML = `<div class="table-scroll"><table class="data-table"><thead><tr>
      <th>Nombre</th><th>Teléfono</th><th>Cuenta Corriente</th><th>Acciones</th>
    </tr></thead><tbody>${data.map(c => {
            const bal = parseFloat(c.balance || 0);
            const bc = bal > 0 ? 'text-danger' : bal < 0 ? 'text-success' : '';
            return `<tr>
        <td><strong>${Utils.escHtml(c.name)}</strong><br><small class="text-muted">DNI: ${Utils.escHtml(c.dni || '-')}</small></td>
        <td>${Utils.escHtml(c.phone || '-')}<br><small class="text-muted">${Utils.escHtml(c.address || '-')}</small></td>
        <td class="${bc}"><strong>${Utils.currency(bal)}</strong></td>
        <td>
          <button class="btn-icon" aria-label="Ver detalle de ${Utils.escHtml(c.name)}" onclick="ClientsModule.viewDetail('${c.id}')">👁️</button>
          <button class="btn-icon" aria-label="Editar ${Utils.escHtml(c.name)}" onclick="ClientsModule.openModal('${c.id}')">✏️</button>
          ${bal > 0 ? `<button class="btn btn-sm btn-outline" onclick="ClientsModule.payModal('${c.id}')">💰 Pago</button>` : ''}
        </td>
      </tr>`;
        }).join('')}</tbody></table></div>`;
    },

    async viewDetail(id) {
        const c = (await DB.getClients()).find(x => x.id === id);
        const movs = await DB.getMovements(id);
        const appts = typeof DB.getAppointments === 'function' ? await DB.getAppointments({ client_id: id }) : [];
        const bal = parseFloat(c.balance || 0);
        const bc = bal > 0 ? 'text-danger' : bal < 0 ? 'text-success' : '';

        // Encontrar próximo turno
        const nowIso = new Date().toISOString();
        const nextAppt = appts
          .filter(a => a.start_datetime >= nowIso && (a.status === 'pendiente' || a.status === 'confirmado' || a.status === 'reprogramado'))
          .sort((a, b) => a.start_datetime.localeCompare(b.start_datetime))[0];

        Modal.open(`
      <h2 class="modal-title">👤 ${Utils.escHtml(c.name)}</h2>
      <div class="card" style="margin-bottom:1rem">
        <div class="detail-grid">
           <div><label>DNI</label><p>${Utils.escHtml(c.dni || '-')}</p></div>
           <div><label>Teléfono</label><p>${Utils.escHtml(c.phone || '-')}</p></div>
           <div><label>Dirección</label><p>${Utils.escHtml(c.address || '-')}</p></div>
           <div><label>Saldo CC</label><p class="${bc}"><strong>${Utils.currency(bal)}</strong></p></div>
        </div>
      </div>

      ${nextAppt ? `
      <div class="card" style="margin-bottom:1rem; border-color:var(--accent); background:var(--accent-glow);">
        <div class="card-title" style="color:var(--accent);">📅 Próximo Turno</div>
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
          <div>
            <strong>${Utils.escHtml(nextAppt.service_name)}</strong> con <em>${Utils.escHtml(nextAppt.professional_name)}</em><br>
            <small class="text-muted">🗓️ ${new Date(nextAppt.start_datetime).toLocaleString('es-AR', { dateStyle:'short', timeStyle:'short' })} hs (${nextAppt.duration_minutes} min)</small>
          </div>
          <div>
            <span class="badge badge-warning">${nextAppt.status.toUpperCase()}</span>
          </div>
        </div>
      </div>` : ''}

      <h3 class="card-title" style="margin-top:1rem;">📅 Historial de Turnos (${appts.length})</h3>
      ${appts.length ? `<div class="table-scroll" style="max-height:160px; overflow-y:auto;"><table class="data-table"><thead><tr><th>Fecha</th><th>Servicio</th><th>Profesional</th><th>Estado</th><th>Precio</th></tr></thead>
        <tbody>${appts.map(a => `<tr>
          <td>${new Date(a.start_datetime).toLocaleString('es-AR', { dateStyle:'short', timeStyle:'short' })}</td>
          <td><strong>${Utils.escHtml(a.service_name)}</strong></td>
          <td>${Utils.escHtml(a.professional_name)}</td>
          <td><span class="badge ${a.status === 'atendido' ? 'badge-success' : a.status === 'cancelado' ? 'badge-danger' : 'badge-warning'}">${a.status.toUpperCase()}</span></td>
          <td><strong>${Utils.currency(a.price)}</strong></td>
        </tr>`).join('')}</tbody></table></div>` : '<div class="empty-state" style="padding:1rem;">Sin turnos registrados</div>'}

      <h3 class="card-title" style="margin-top:1rem;">💳 Movimientos Cuenta Corriente</h3>
      ${movs.length ? `<div class="table-scroll" style="max-height:160px; overflow-y:auto;"><table class="data-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Monto</th><th>Notas</th></tr></thead>
        <tbody>${movs.map(m => `<tr>
          <td>${new Date(m.created_at).toLocaleDateString('es')}</td>
          <td><span class="badge ${m.type === 'pago' || m.type === 'anulacion' ? 'badge-success' : 'badge-warning'}">${m.type.toUpperCase()}</span></td>
          <td class="${m.amount > 0 ? 'text-danger' : 'text-success'}">${m.amount > 0 ? '+' : ''}${Utils.currency(m.amount)}</td>
          <td>${Utils.escHtml(m.notes || '-')}</td>
        </tr>`).join('')}</tbody></table></div>` : '<div class="empty-state" style="padding:1rem;">Sin movimientos</div>'}

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
        <div class="form-group">
          <label>Nombre Completo *</label>
          <input name="name" class="form-input" required value="${Utils.escHtml(c?.name || '')}" placeholder="Ej: Juan Pérez" oninput="this.value = this.value.replace(/[0-9]/g, '')">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>DNI</label>
            <input name="dni" class="form-input" value="${Utils.escHtml(c?.dni || '')}" placeholder="Ej: 38123456" oninput="this.value = this.value.replace(/[^0-9.]/g, '')">
          </div>
          <div class="form-group">
            <label>Teléfono</label>
            <input name="phone" class="form-input" value="${Utils.escHtml(c?.phone || '')}" placeholder="Ej: 11 2345-6789" oninput="this.value = this.value.replace(/[^0-9+\-\s()]/g, '')">
          </div>
        </div>
        <div class="form-group"><label>Dirección</label><input name="address" class="form-input" value="${Utils.escHtml(c?.address || '')}"></div>
        <div class="form-group"><label>Email</label><input name="email" type="email" class="form-input" value="${Utils.escHtml(c?.email || '')}"></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar Cliente</button>
        </div>
      </form>`);
    },

    async save(e, id) {
        e.preventDefault(); 
        const f = e.target;
        const name = f.name.value.trim();
        const dni = f.dni.value.trim();
        const phone = f.phone.value.trim();

        // Validaciones de negocio
        const nameVal = Utils.validatePersonName(name, 'nombre del cliente');
        if (!nameVal.valid) {
            if (typeof Toast !== 'undefined') Toast.show(nameVal.message, 'warning');
            else alert(nameVal.message);
            return;
        }

        const dniVal = Utils.validateDni(dni);
        if (!dniVal.valid) {
            if (typeof Toast !== 'undefined') Toast.show(dniVal.message, 'warning');
            else alert(dniVal.message);
            return;
        }

        const phoneVal = Utils.validatePhone(phone);
        if (!phoneVal.valid) {
            if (typeof Toast !== 'undefined') Toast.show(phoneVal.message, 'warning');
            else alert(phoneVal.message);
            return;
        }

        await DB.saveClient({ 
            id: id || undefined, 
            name: name, 
            dni: dni,
            phone: phone, 
            address: f.address.value.trim(),
            email: f.email.value.trim() 
        });
        Modal.close();
        if (typeof Toast !== 'undefined') Toast.show(id ? 'Cliente actualizado' : 'Cliente registrado', 'success');
        await this._render();
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
        Modal.close();
        if (typeof Toast !== 'undefined') Toast.show('Pago registrado con éxito', 'success');
        await this._render();
    }
};
