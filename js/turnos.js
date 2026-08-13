const TurnosModule = {
  _activeTab: 'agenda',
  _viewMode: 'day', // 'day', 'week', 'month'
  _selectedDate: new Date().toISOString().slice(0, 10),

  async render(el, activeTab = 'agenda') {
    this._activeTab = activeTab;
    const enabled = await DB.isModuleEnabled('turnos');

    if (!enabled) {
      el.innerHTML = Utils.emptyState('🚫', 'Módulo Deshabilitado', 'El módulo de Gestión de Turnos no está activo para esta cuenta.');
      return;
    }

    el.innerHTML = `
      <div class="module-header" style="margin-bottom:1rem;">
        <div>
          <h2 class="card-title" style="margin:0;">📅 Gestión de Turnos</h2>
          <small class="text-muted">Agenda, servicios, personal, bloqueos y control de atención</small>
        </div>
        <div class="btn-row" style="gap:0.5rem; flex-wrap:wrap;">
          <button class="btn btn-primary" onclick="TurnosModule.openNewAppointmentModal()">➕ Nuevo Turno</button>
          <button class="btn btn-outline" onclick="TurnosModule.openLockModal()">🚫 Agregar Bloqueo</button>
        </div>
      </div>

      <!-- Tab header nav -->
      <div class="tabs-header" style="margin-bottom:1.25rem;">
        <button class="tab-btn ${this._activeTab === 'agenda' ? 'active' : ''}" onclick="TurnosModule.switchTab('agenda')">📅 Agenda</button>
        <button class="tab-btn ${this._activeTab === 'my-agenda' ? 'active' : ''}" onclick="TurnosModule.switchTab('my-agenda')">👤 Mi Agenda</button>
        <button class="tab-btn ${this._activeTab === 'services' ? 'active' : ''}" onclick="TurnosModule.switchTab('services')">💼 Servicios</button>
        <button class="tab-btn ${this._activeTab === 'professionals' ? 'active' : ''}" onclick="TurnosModule.switchTab('professionals')">👨‍⚕️ Personal</button>
        <button class="tab-btn ${this._activeTab === 'locks' ? 'active' : ''}" onclick="TurnosModule.switchTab('locks')">🚫 Bloqueos</button>
        <button class="tab-btn ${this._activeTab === 'dashboard' ? 'active' : ''}" onclick="TurnosModule.switchTab('dashboard')">📊 Dashboard</button>
        <button class="tab-btn ${this._activeTab === 'history' ? 'active' : ''}" onclick="TurnosModule.switchTab('history')">📜 Historial</button>
        <button class="tab-btn ${this._activeTab === 'settings' ? 'active' : ''}" onclick="TurnosModule.switchTab('settings')">⚙️ Configuración</button>
      </div>

      <div id="turnos-tab-content"></div>`;

    await this._renderTab();
  },

  async switchTab(tab) {
    this._activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.textContent.toLowerCase().includes(tab));
    });
    await this._renderTab();
  },

  async _renderTab() {
    const box = document.getElementById('turnos-tab-content');
    if (!box) return;
    box.innerHTML = Utils.skeleton(4);

    switch (this._activeTab) {
      case 'agenda':        await this._renderAgendaTab(box); break;
      case 'my-agenda':     await this._renderMyAgendaTab(box); break;
      case 'services':      await this._renderServicesTab(box); break;
      case 'professionals': await this._renderProfessionalsTab(box); break;
      case 'locks':         await this._renderLocksTab(box); break;
      case 'dashboard':     await this._renderDashboardTab(box); break;
      case 'history':       await this._renderHistoryTab(box); break;
      case 'settings':      await this._renderSettingsTab(box); break;
      default:              await this._renderAgendaTab(box);
    }
  },

  /* ─────────────────────────────────────────────────────────────
     1. AGENDA TAB (DAILY, WEEKLY, MONTHLY VIEW)
  ───────────────────────────────────────────────────────────── */
  async _renderAgendaTab(box) {
    const profs = await DB.getTurnosProfessionals();
    const services = await DB.getTurnosServices();
    const appts = await DB.getAppointments();
    const locks = await DB.getTurnosLocks();

    box.innerHTML = `
      <div class="card" style="margin-bottom:1rem;">
        <div class="form-row" style="align-items:center; justify-content:space-between; gap:0.75rem;">
          <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <label><strong>Fecha:</strong></label>
            <input type="date" id="t-date" class="form-input" style="width:auto;" value="${this._selectedDate}">
            <div class="btn-group" style="display:flex; gap:0.25rem;">
              <button class="btn btn-sm ${this._viewMode === 'day' ? 'btn-primary' : 'btn-outline'}" onclick="TurnosModule.changeViewMode('day')">Día</button>
              <button class="btn btn-sm ${this._viewMode === 'week' ? 'btn-primary' : 'btn-outline'}" onclick="TurnosModule.changeViewMode('week')">Semana</button>
              <button class="btn btn-sm ${this._viewMode === 'month' ? 'btn-primary' : 'btn-outline'}" onclick="TurnosModule.changeViewMode('month')">Mes</button>
            </div>
          </div>

          <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <select id="t-filter-prof" class="select-input" style="width:auto;">
              <option value="">Todos los Profesionales</option>
              ${profs.map(p => `<option value="${p.id}">${Utils.escHtml(p.first_name + ' ' + p.last_name)}</option>`).join('')}
            </select>
            <select id="t-filter-status" class="select-input" style="width:auto;">
              <option value="">Todos los Estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="confirmado">Confirmado</option>
              <option value="atendido">Atendido</option>
              <option value="cancelado">Cancelado</option>
              <option value="ausente">Ausente</option>
            </select>
          </div>
        </div>
      </div>

      <div id="t-calendar-view"></div>`;

    const renderCal = () => {
      const dateVal = document.getElementById('t-date')?.value || this._selectedDate;
      this._selectedDate = dateVal;
      const profId = document.getElementById('t-filter-prof')?.value || '';
      const status = document.getElementById('t-filter-status')?.value || '';

      let filteredAppts = appts;
      if (profId) filteredAppts = filteredAppts.filter(a => a.professional_id === profId);
      if (status) filteredAppts = filteredAppts.filter(a => a.status === status);

      const calBox = document.getElementById('t-calendar-view');
      if (!calBox) return;

      if (this._viewMode === 'day') this._buildDayView(calBox, dateVal, filteredAppts, profs);
      else if (this._viewMode === 'week') this._buildWeekView(calBox, dateVal, filteredAppts, profs);
      else this._buildMonthView(calBox, dateVal, filteredAppts);
    };

    renderCal();

    document.getElementById('t-date').onchange = renderCal;
    document.getElementById('t-filter-prof').onchange = renderCal;
    document.getElementById('t-filter-status').onchange = renderCal;
  },

  changeViewMode(mode) {
    this._viewMode = mode;
    this._renderTab();
  },

  _buildDayView(container, dateStr, appts, profs) {
    const dayAppts = appts.filter(a => a.start_datetime.startsWith(dateStr));
    if (!dayAppts.length) {
      container.innerHTML = Utils.emptyState('📅', 'Sin turnos para esta fecha', 'Haz clic en "+ Nuevo Turno" para agendar a un cliente.');
      return;
    }

    container.innerHTML = `
      <div class="card">
        <h3 class="card-title">Agenda del día (${new Date(dateStr + 'T00:00:00').toLocaleDateString('es-AR', { weekday:'long', year:'numeric', month:'long', day:'numeric' })})</h3>
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>Hora</th>
                <th>Cliente</th>
                <th>Servicio</th>
                <th>Profesional</th>
                <th>Duración</th>
                <th>Precio</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${dayAppts.map(a => {
                const badgeClass = a.status === 'atendido' ? 'badge-success' : a.status === 'cancelado' ? 'badge-danger' : a.status === 'confirmado' ? 'badge-info' : 'badge-warning';
                const startTime = new Date(a.start_datetime).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' });
                const endTime = new Date(a.end_datetime).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' });
                return `
                <tr>
                  <td><strong>${startTime} - ${endTime} hs</strong></td>
                  <td><strong>${Utils.escHtml(a.client_name)}</strong><br><small class="text-muted">${Utils.escHtml(a.client_phone || '-')}</small></td>
                  <td>${Utils.escHtml(a.service_name)}</td>
                  <td>${Utils.escHtml(a.professional_name)}</td>
                  <td>${a.duration_minutes} min</td>
                  <td><strong>${Utils.currency(a.price)}</strong></td>
                  <td><span class="badge ${badgeClass}">${a.status.toUpperCase()}</span></td>
                  <td>
                    <button class="btn-icon" title="Ver / Editar" onclick="TurnosModule.openDetailModal('${a.id}')">👁️</button>
                    ${a.status !== 'cancelado' && a.status !== 'atendido' ? `
                      <button class="btn-icon" title="Reprogramar" onclick="TurnosModule.openRescheduleModal('${a.id}')">🗓️</button>
                      <button class="btn-icon danger" title="Cancelar" onclick="TurnosModule.openCancelModal('${a.id}')">✕</button>
                    ` : ''}
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  },

  _buildWeekView(container, dateStr, appts, profs) {
    const curr = new Date(dateStr + 'T00:00:00');
    const firstDay = new Date(curr.setDate(curr.getDate() - curr.getDay() + 1)); // Lunes

    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(firstDay);
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });

    container.innerHTML = `
      <div class="card">
        <h3 class="card-title">Agenda Semanal (${weekDays[0]} al ${weekDays[6]})</h3>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:0.75rem;">
          ${weekDays.map(dStr => {
            const dayList = appts.filter(a => a.start_datetime.startsWith(dStr));
            const dayName = new Date(dStr + 'T00:00:00').toLocaleDateString('es-AR', { weekday:'short', day:'numeric', month:'numeric' });
            return `
              <div style="background:var(--bg-main); border:1px solid var(--border); border-radius:var(--radius-sm); padding:0.75rem;">
                <div style="font-weight:700; color:var(--accent); font-size:0.85rem; border-bottom:1px solid var(--border); padding-bottom:0.4rem; margin-bottom:0.5rem; text-transform:uppercase;">
                  ${dayName} (${dayList.length})
                </div>
                ${dayList.length ? dayList.map(a => {
                  const tStr = new Date(a.start_datetime).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' });
                  return `
                    <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:6px; padding:0.5rem; margin-bottom:0.4rem; font-size:0.8rem; cursor:pointer;" onclick="TurnosModule.openDetailModal('${a.id}')">
                      <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong>${tStr} hs</strong>
                        <span class="badge ${a.status==='atendido'?'badge-success':a.status==='cancelado'?'badge-danger':'badge-warning'}" style="font-size:0.65rem;">${a.status}</span>
                      </div>
                      <div style="font-weight:600; margin-top:0.2rem;">${Utils.escHtml(a.client_name)}</div>
                      <div style="color:var(--text-muted); font-size:0.75rem;">${Utils.escHtml(a.service_name)} • ${Utils.escHtml(a.professional_name)}</div>
                    </div>`;
                }).join('') : '<div style="font-size:0.75rem; color:var(--text-dim); text-align:center; padding:0.5rem;">Sin turnos</div>'}
              </div>`;
          }).join('')}
        </div>
      </div>`;
  },

  _buildMonthView(container, dateStr, appts) {
    const d = new Date(dateStr + 'T00:00:00');
    const month = d.getMonth();
    const year = d.getFullYear();
    const monthAppts = appts.filter(a => {
      const ad = new Date(a.start_datetime);
      return ad.getMonth() === month && ad.getFullYear() === year;
    });

    container.innerHTML = `
      <div class="card">
        <h3 class="card-title">Vista Mensual (${d.toLocaleString('es-AR', { month:'long', year:'numeric' })}) — Total Turnos: ${monthAppts.length}</h3>
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr><th>Fecha</th><th>Cliente</th><th>Servicio</th><th>Profesional</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              ${monthAppts.map(a => `
                <tr>
                  <td>${new Date(a.start_datetime).toLocaleString('es-AR', { dateStyle:'short', timeStyle:'short' })} hs</td>
                  <td><strong>${Utils.escHtml(a.client_name)}</strong></td>
                  <td>${Utils.escHtml(a.service_name)}</td>
                  <td>${Utils.escHtml(a.professional_name)}</td>
                  <td><span class="badge ${a.status==='atendido'?'badge-success':a.status==='cancelado'?'badge-danger':'badge-warning'}">${a.status.toUpperCase()}</span></td>
                  <td><button class="btn-icon" onclick="TurnosModule.openDetailModal('${a.id}')">👁️</button></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  },

  /* ─────────────────────────────────────────────────────────────
     2. MI AGENDA TAB (FOR STAFF / INDIVIDUAL PROFESSIONAL)
  ───────────────────────────────────────────────────────────── */
  async _renderMyAgendaTab(box) {
    const profs = await DB.getTurnosProfessionals();
    const appts = await DB.getAppointments();

    box.innerHTML = `
      <div class="card" style="margin-bottom:1rem;">
        <div class="form-row" style="align-items:center;">
          <div class="form-group" style="margin:0; flex:1;">
            <label>Seleccionar Profesional:</label>
            <select id="my-prof-select" class="select-input">
              ${profs.map(p => `<option value="${p.id}">${Utils.escHtml(p.first_name + ' ' + p.last_name)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <div id="my-agenda-list"></div>`;

    const renderMyAgenda = () => {
      const profId = document.getElementById('my-prof-select')?.value;
      const listEl = document.getElementById('my-agenda-list');
      if (!listEl || !profId) return;

      const myAppts = appts.filter(a => a.professional_id === profId);
      if (!myAppts.length) {
        listEl.innerHTML = Utils.emptyState('👤', 'Sin turnos asignados', 'No se encontraron citas agendadas para este profesional.');
        return;
      }

      listEl.innerHTML = `
        <div class="card">
          <h3 class="card-title">Citas Asignadas (${myAppts.length})</h3>
          <div class="table-scroll">
            <table class="data-table">
              <thead><tr><th>Fecha y Hora</th><th>Cliente</th><th>Teléfono</th><th>Servicio</th><th>Duración</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
                ${myAppts.map(a => `
                  <tr>
                    <td><strong>${new Date(a.start_datetime).toLocaleString('es-AR', { dateStyle:'short', timeStyle:'short' })} hs</strong></td>
                    <td><strong>${Utils.escHtml(a.client_name)}</strong></td>
                    <td>${Utils.escHtml(a.client_phone || '-')}</td>
                    <td>${Utils.escHtml(a.service_name)}</td>
                    <td>${a.duration_minutes} min</td>
                    <td><span class="badge ${a.status==='atendido'?'badge-success':a.status==='cancelado'?'badge-danger':'badge-warning'}">${a.status.toUpperCase()}</span></td>
                    <td>
                      ${a.status !== 'atendido' && a.status !== 'cancelado' ? `
                        <button class="btn btn-sm btn-primary" onclick="TurnosModule.setStatus('${a.id}', 'atendido')">✅ Atendido</button>
                        <button class="btn btn-sm btn-outline" onclick="TurnosModule.setStatus('${a.id}', 'ausente')">❌ Ausente</button>
                      ` : ''}
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>`;
    };

    renderMyAgenda();
    document.getElementById('my-prof-select').onchange = renderMyAgenda;
  },

  /* ─────────────────────────────────────────────────────────────
     3. SERVICIOS TAB (CRUD SERVICES)
  ───────────────────────────────────────────────────────────── */
  async _renderServicesTab(box) {
    const services = await DB.getTurnosServices();

    box.innerHTML = `
      <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
        <h3 class="card-title" style="margin:0;">Catálogo de Servicios (${services.length})</h3>
        <button class="btn btn-primary" onclick="TurnosModule.openServiceModal()">➕ Nuevo Servicio</button>
      </div>

      <div class="card">
        ${services.length ? `
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th>Servicio</th><th>Descripción</th><th>Duración</th><th>Precio</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              ${services.map(s => `
                <tr>
                  <td><strong>${Utils.escHtml(s.name)}</strong></td>
                  <td>${Utils.escHtml(s.description || '-')}</td>
                  <td>⏱️ ${s.duration_minutes} min</td>
                  <td><strong>${Utils.currency(s.price)}</strong></td>
                  <td>${s.active ? '<span class="badge badge-success">Activo</span>' : '<span class="badge badge-danger">Inactivo</span>'}</td>
                  <td>
                    <button class="btn-icon" onclick="TurnosModule.openServiceModal('${s.id}')">✏️</button>
                    <button class="btn-icon danger" onclick="TurnosModule.deleteService('${s.id}')">🗑️</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : Utils.emptyState('💼', 'Sin servicios registrados', 'Crea servicios para permitir que tus clientes agenden turnos.')}
      </div>`;
  },

  async openServiceModal(id) {
    const s = id ? (await DB.getTurnosServices()).find(x => x.id === id) : null;
    Modal.open(`
      <h2 class="modal-title">${s ? 'Editar' : 'Nuevo'} Servicio</h2>
      <form onsubmit="TurnosModule.saveService(event, '${id || ''}')">
        <div class="form-group">
          <label>Nombre del Servicio *</label>
          <input name="name" class="form-input" required value="${Utils.escHtml(s?.name || '')}" placeholder="ej: Corte de Cabello">
        </div>
        <div class="form-group">
          <label>Descripción</label>
          <input name="description" class="form-input" value="${Utils.escHtml(s?.description || '')}" placeholder="Detalles del servicio">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Duración (minutos) *</label>
            <input name="duration_minutes" type="number" step="5" min="5" class="form-input" required value="${s?.duration_minutes || 30}">
          </div>
          <div class="form-group">
            <label>Precio *</label>
            <input name="price" type="number" step="0.01" min="0" class="form-input" required value="${s?.price || 0}">
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar Servicio</button>
        </div>
      </form>`);
  },

  async saveService(e, id) {
    e.preventDefault(); const f = e.target;
    await DB.saveTurnosService({
      id: id || undefined,
      name: f.name.value.trim(),
      description: f.description.value.trim(),
      duration_minutes: parseInt(f.duration_minutes.value),
      price: parseFloat(f.price.value)
    });
    Modal.close();
    if (typeof Toast !== 'undefined') Toast.show('Servicio guardado con éxito', 'success');
    await this._renderTab();
  },

  async deleteService(id) {
    if (!confirm('¿Eliminar este servicio?')) return;
    await DB.deleteTurnosService(id);
    if (typeof Toast !== 'undefined') Toast.show('Servicio eliminado', 'info');
    await this._renderTab();
  },

  /* ─────────────────────────────────────────────────────────────
     4. PERSONAL / PROFESIONALES TAB & AVAILABILITY
  ───────────────────────────────────────────────────────────── */
  async _renderProfessionalsTab(box) {
    const profs = await DB.getTurnosProfessionals();
    const services = await DB.getTurnosServices();

    box.innerHTML = `
      <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
        <h3 class="card-title" style="margin:0;">Personal & Profesionales (${profs.length})</h3>
        <button class="btn btn-primary" onclick="TurnosModule.openProfessionalModal()">➕ Nuevo Profesional</button>
      </div>

      <div class="card">
        ${profs.length ? `
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th>Nombre</th><th>Teléfono</th><th>Email</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              ${profs.map(p => `
                <tr>
                  <td><strong>${Utils.escHtml(p.first_name + ' ' + p.last_name)}</strong></td>
                  <td>${Utils.escHtml(p.phone || '-')}</td>
                  <td>${Utils.escHtml(p.email || '-')}</td>
                  <td>${p.active ? '<span class="badge badge-success">Activo</span>' : '<span class="badge badge-danger">Inactivo</span>'}</td>
                  <td>
                    <button class="btn btn-sm btn-outline" onclick="TurnosModule.openAvailabilityModal('${p.id}')">🗓️ Horarios</button>
                    <button class="btn-icon" onclick="TurnosModule.openProfessionalModal('${p.id}')">✏️</button>
                    <button class="btn-icon danger" onclick="TurnosModule.deleteProfessional('${p.id}')">🗑️</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : Utils.emptyState('👨‍⚕️', 'Sin profesionales registrados', 'Agrega miembros de tu equipo para asignarles turnos y horarios.')}
      </div>`;
  },

  async openProfessionalModal(id) {
    const p = id ? (await DB.getTurnosProfessionals()).find(x => x.id === id) : null;
    const allServices = await DB.getTurnosServices();
    const assignedServiceRows = id ? await DB.getTurnosProfessionalServices(id) : [];
    const assignedIds = new Set(assignedServiceRows.map(r => r.service_id));

    Modal.open(`
      <h2 class="modal-title">${p ? 'Editar' : 'Nuevo'} Profesional</h2>
      <form onsubmit="TurnosModule.saveProfessional(event, '${id || ''}')">
        <div class="form-row">
          <div class="form-group">
            <label>Nombre *</label>
            <input name="first_name" class="form-input" required value="${Utils.escHtml(p?.first_name || '')}">
          </div>
          <div class="form-group">
            <label>Apellido</label>
            <input name="last_name" class="form-input" value="${Utils.escHtml(p?.last_name || '')}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Teléfono</label>
            <input name="phone" class="form-input" value="${Utils.escHtml(p?.phone || '')}">
          </div>
          <div class="form-group">
            <label>Email</label>
            <input name="email" type="email" class="form-input" value="${Utils.escHtml(p?.email || '')}">
          </div>
        </div>
        <div class="form-group">
          <label>Servicios Habilitados:</label>
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:0.5rem; margin-top:0.4rem;">
            ${allServices.map(s => `
              <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.85rem; font-weight:normal; cursor:pointer;">
                <input type="checkbox" name="service_ids" value="${s.id}" ${assignedIds.has(s.id) ? 'checked' : ''}>
                ${Utils.escHtml(s.name)}
              </label>`).join('')}
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar Profesional</button>
        </div>
      </form>`);
  },

  async saveProfessional(e, id) {
    e.preventDefault(); const f = e.target;
    const selectedServices = Array.from(f.querySelectorAll('input[name="service_ids"]:checked')).map(cb => cb.value);
    await DB.saveTurnosProfessional({
      id: id || undefined,
      first_name: f.first_name.value.trim(),
      last_name: f.last_name.value.trim(),
      phone: f.phone.value.trim(),
      email: f.email.value.trim(),
      service_ids: selectedServices
    });
    Modal.close();
    if (typeof Toast !== 'undefined') Toast.show('Profesional guardado con éxito', 'success');
    await this._renderTab();
  },

  async deleteProfessional(id) {
    if (!confirm('¿Eliminar este profesional?')) return;
    await DB.deleteTurnosProfessional(id);
    if (typeof Toast !== 'undefined') Toast.show('Profesional eliminado', 'info');
    await this._renderTab();
  },

  async openAvailabilityModal(profId) {
    const prof = (await DB.getTurnosProfessionals()).find(p => p.id === profId);
    const list = await DB.getTurnosAvailability(profId);

    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    Modal.open(`
      <h2 class="modal-title">🗓️ Disponibilidad Horaria — ${Utils.escHtml(prof?.first_name + ' ' + prof?.last_name)}</h2>
      <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:1rem;">Configura los bloques de atención semanales para este profesional.</p>
      
      <form onsubmit="TurnosModule.saveAvailability(event, '${profId}')">
        <div id="avail-rows">
          ${days.map((dayName, dayIdx) => {
            const daySlots = list.filter(item => item.day_of_week === dayIdx);
            const slot1 = daySlots[0] || { start_time: '09:00', end_time: '18:00' };
            const active = daySlots.length > 0;
            return `
              <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem; flex-wrap:wrap; background:var(--bg-main); padding:0.5rem 0.75rem; border-radius:6px;">
                <label style="width:90px; font-weight:600;">
                  <input type="checkbox" name="day_${dayIdx}_active" ${active ? 'checked' : ''}> ${dayName}
                </label>
                <div style="display:flex; align-items:center; gap:0.4rem;">
                  <input type="time" name="day_${dayIdx}_start" class="form-input" style="width:auto; padding:0.25rem;" value="${slot1.start_time || '09:00'}">
                  <span>a</span>
                  <input type="time" name="day_${dayIdx}_end" class="form-input" style="width:auto; padding:0.25rem;" value="${slot1.end_time || '18:00'}">
                </div>
              </div>`;
          }).join('')}
        </div>

        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar Horarios</button>
        </div>
      </form>`);
  },

  async saveAvailability(e, profId) {
    e.preventDefault(); const f = e.target;
    const availList = [];
    for (let d = 0; d < 7; d++) {
      const activeCb = f[`day_${d}_active`]?.checked;
      if (activeCb) {
        availList.push({
          day_of_week: d,
          start_time: f[`day_${d}_start`].value,
          end_time: f[`day_${d}_end`].value
        });
      }
    }
    await DB.saveTurnosAvailability(profId, availList);
    Modal.close();
    if (typeof Toast !== 'undefined') Toast.show('Disponibilidad guardada', 'success');
  },

  /* ─────────────────────────────────────────────────────────────
     5. BLOQUEOS & AUSENCIAS TAB (LOCKS)
  ───────────────────────────────────────────────────────────── */
  async _renderLocksTab(box) {
    const locks = await DB.getTurnosLocks();
    const profs = await DB.getTurnosProfessionals();
    const profMap = {};
    profs.forEach(p => { profMap[p.id] = p.first_name + ' ' + p.last_name; });

    box.innerHTML = `
      <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
        <h3 class="card-title" style="margin:0;">Bloqueos y Ausencias Programadas (${locks.length})</h3>
        <button class="btn btn-primary" onclick="TurnosModule.openLockModal()">➕ Agregar Bloqueo</button>
      </div>

      <div class="card">
        ${locks.length ? `
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th>Profesional</th><th>Inicio</th><th>Fin</th><th>Motivo</th><th>Acciones</th></tr></thead>
            <tbody>
              ${locks.map(l => `
                <tr>
                  <td><strong>${l.professional_id ? Utils.escHtml(profMap[l.professional_id] || 'Profesional') : 'Todos (General)'}</strong></td>
                  <td>${new Date(l.start_datetime).toLocaleString('es-AR', { dateStyle:'short', timeStyle:'short' })} hs</td>
                  <td>${new Date(l.end_datetime).toLocaleString('es-AR', { dateStyle:'short', timeStyle:'short' })} hs</td>
                  <td>${Utils.escHtml(l.reason || '-')}</td>
                  <td>
                    <button class="btn-icon danger" onclick="TurnosModule.deleteLock('${l.id}')">🗑️</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : Utils.emptyState('🚫', 'Sin bloqueos programados', 'Agrega feriados o ausencias para impedir reservas en determinados horarios.')}
      </div>`;
  },

  async openLockModal() {
    const profs = await DB.getTurnosProfessionals();
    const nowIso = new Date().toISOString().slice(0, 16);

    Modal.open(`
      <h2 class="modal-title">🚫 Registrar Bloqueo u Ausencia</h2>
      <form onsubmit="TurnosModule.saveLock(event)">
        <div class="form-group">
          <label>Profesional (opcional)</label>
          <select name="professional_id" class="form-input">
            <option value="">Todos los profesionales (Bloqueo General)</option>
            ${profs.map(p => `<option value="${p.id}">${Utils.escHtml(p.first_name + ' ' + p.last_name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Fecha y Hora Inicio *</label>
            <input name="start_datetime" type="datetime-local" class="form-input" required value="${nowIso}">
          </div>
          <div class="form-group">
            <label>Fecha y Hora Fin *</label>
            <input name="end_datetime" type="datetime-local" class="form-input" required value="${nowIso}">
          </div>
        </div>
        <div class="form-group">
          <label>Motivo del Bloqueo *</label>
          <input name="reason" class="form-input" required placeholder="ej: Feriado Nacional, Vacaciones, Mantenimiento">
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar Bloqueo</button>
        </div>
      </form>`);
  },

  async saveLock(e) {
    e.preventDefault(); const f = e.target;
    await DB.saveTurnosLock({
      professional_id: f.professional_id.value || null,
      start_datetime: new Date(f.start_datetime.value).toISOString(),
      end_datetime: new Date(f.end_datetime.value).toISOString(),
      reason: f.reason.value.trim()
    });
    Modal.close();
    if (typeof Toast !== 'undefined') Toast.show('Bloqueo guardado con éxito', 'success');
    await this._renderTab();
  },

  async deleteLock(id) {
    if (!confirm('¿Eliminar este bloqueo?')) return;
    await DB.deleteTurnosLock(id);
    if (typeof Toast !== 'undefined') Toast.show('Bloqueo eliminado', 'info');
    await this._renderTab();
  },

  /* ─────────────────────────────────────────────────────────────
     6. DASHBOARD & STATS TAB
  ───────────────────────────────────────────────────────────── */
  async _renderDashboardTab(box) {
    const appts = await DB.getAppointments();
    const nowStr = new Date().toISOString().slice(0, 10);

    const todayAppts = appts.filter(a => a.start_datetime.startsWith(nowStr));
    const pending = appts.filter(a => a.status === 'pendiente').length;
    const confirmed = appts.filter(a => a.status === 'confirmado').length;
    const attended = appts.filter(a => a.status === 'atendido').length;
    const cancelled = appts.filter(a => a.status === 'cancelado').length;
    const absent = appts.filter(a => a.status === 'ausente').length;
    const totalCount = appts.length || 1;
    const cancelRate = ((cancelled / totalCount) * 100).toFixed(1);

    box.innerHTML = `
      <div class="kpi-row">
        <div class="kpi-card">
          <div class="kpi-icon">📅</div>
          <div class="kpi-body">
            <div class="kpi-value">${todayAppts.length}</div>
            <div class="kpi-label">Turnos de Hoy</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon">⏳</div>
          <div class="kpi-body">
            <div class="kpi-value" style="color:var(--accent);">${pending}</div>
            <div class="kpi-label">Pendientes</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon">✅</div>
          <div class="kpi-body">
            <div class="kpi-value text-success">${attended}</div>
            <div class="kpi-label">Atendidos</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon">❌</div>
          <div class="kpi-body">
            <div class="kpi-value text-danger">${cancelled}</div>
            <div class="kpi-label">Cancelaciones (${cancelRate}%)</div>
          </div>
        </div>
      </div>

      <div class="charts-grid">
        <div class="chart-card">
          <h3 class="card-title">📊 Resumen General de Estados</h3>
          <div class="table-scroll">
            <table class="data-table">
              <thead><tr><th>Estado</th><th>Cantidad</th><th>Porcentaje</th></tr></thead>
              <tbody>
                <tr><td><span class="badge badge-warning">PENDIENTE</span></td><td>${pending}</td><td>${((pending/totalCount)*100).toFixed(1)}%</td></tr>
                <tr><td><span class="badge badge-info">CONFIRMADO</span></td><td>${confirmed}</td><td>${((confirmed/totalCount)*100).toFixed(1)}%</td></tr>
                <tr><td><span class="badge badge-success">ATENDIDO</span></td><td>${attended}</td><td>${((attended/totalCount)*100).toFixed(1)}%</td></tr>
                <tr><td><span class="badge badge-danger">CANCELADO</span></td><td>${cancelled}</td><td>${cancelRate}%</td></tr>
                <tr><td><span class="badge badge-danger">AUSENTE</span></td><td>${absent}</td><td>${((absent/totalCount)*100).toFixed(1)}%</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
  },

  /* ─────────────────────────────────────────────────────────────
     7. HISTORIAL GENERAL & AUDITORÍA TAB
  ───────────────────────────────────────────────────────────── */
  async _renderHistoryTab(box) {
    const appts = await DB.getAppointments();
    const audits = await DB.getTurnosAudit();

    box.innerHTML = `
      <div class="card" style="margin-bottom:1rem;">
        <h3 class="card-title">📜 Historial General de Turnos (${appts.length})</h3>
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th>Fecha / Hora</th><th>Cliente</th><th>Servicio</th><th>Profesional</th><th>Precio</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              ${appts.map(a => `
                <tr>
                  <td>${new Date(a.start_datetime).toLocaleString('es-AR', { dateStyle:'short', timeStyle:'short' })} hs</td>
                  <td><strong>${Utils.escHtml(a.client_name)}</strong></td>
                  <td>${Utils.escHtml(a.service_name)}</td>
                  <td>${Utils.escHtml(a.professional_name)}</td>
                  <td><strong>${Utils.currency(a.price)}</strong></td>
                  <td><span class="badge ${a.status==='atendido'?'badge-success':a.status==='cancelado'?'badge-danger':'badge-warning'}">${a.status.toUpperCase()}</span></td>
                  <td><button class="btn-icon" onclick="TurnosModule.openDetailModal('${a.id}')">👁️</button></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h3 class="card-title">🔍 Registro de Auditoría (${audits.length})</h3>
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalles</th></tr></thead>
            <tbody>
              ${audits.slice(0, 30).map(au => `
                <tr>
                  <td>${new Date(au.created_at).toLocaleString('es-AR', { dateStyle:'short', timeStyle:'short' })}</td>
                  <td><strong>${Utils.escHtml(au.user_name || 'admin')}</strong></td>
                  <td><span class="badge badge-info">${au.action}</span></td>
                  <td>${Utils.escHtml(au.details)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  },

  /* ─────────────────────────────────────────────────────────────
     8. CONFIGURACIÓN DE AGENDA TAB (SETTINGS)
  ───────────────────────────────────────────────────────────── */
  async _renderSettingsTab(box) {
    const s = await DB.getTurnosSettings();

    box.innerHTML = `
      <div class="card" style="max-width:600px;">
        <h3 class="card-title">⚙️ Reglas Generales de la Agenda</h3>
        <form onsubmit="TurnosModule.saveSettings(event)">
          <div class="form-group">
            <label>Tiempo Adicional entre Turnos (Buffer en minutos):</label>
            <input name="buffer_minutes" type="number" class="form-input" min="0" value="${s.buffer_minutes || 10}">
          </div>
          <div class="form-group">
            <label>Anticipación Mínima para Reservar (Horas):</label>
            <input name="min_lead_hours" type="number" class="form-input" min="0" value="${s.min_lead_hours || 2}">
          </div>
          <div class="form-group">
            <label>Anticipación Máxima para Reservar (Días):</label>
            <input name="max_advance_days" type="number" class="form-input" min="1" value="${s.max_advance_days || 30}">
          </div>
          <div class="form-group">
            <label>Política de Cancelación:</label>
            <textarea name="cancellation_policy" class="form-input" rows="3">${Utils.escHtml(s.cancellation_policy || '')}</textarea>
          </div>
          <button type="submit" class="btn btn-primary">Guardar Configuración</button>
        </form>
      </div>`;
  },

  async saveSettings(e) {
    e.preventDefault(); const f = e.target;
    await DB.saveTurnosSettings({
      buffer_minutes: f.buffer_minutes.value,
      min_lead_hours: f.min_lead_hours.value,
      max_advance_days: f.max_advance_days.value,
      cancellation_policy: f.cancellation_policy.value.trim()
    });
    if (typeof Toast !== 'undefined') Toast.show('Configuración de agenda actualizada', 'success');
  },

  /* ─────────────────────────────────────────────────────────────
     MODALES INTERACTIVOS (NUEVO TURNO, REPROGRAMAR, CANCELAR, DETALLE)
  ───────────────────────────────────────────────────────────── */
  async openNewAppointmentModal() {
    const clients = await DB.getClients();
    const services = (await DB.getTurnosServices()).filter(s => s.active);
    const profs = (await DB.getTurnosProfessionals()).filter(p => p.active);
    const nowIso = new Date().toISOString().slice(0, 16);

    Modal.open(`
      <h2 class="modal-title">➕ Agendar Nuevo Turno</h2>
      <form onsubmit="TurnosModule.submitNewAppointment(event)">
        <div class="form-group">
          <label>Cliente *</label>
          <div style="display:flex; gap:0.4rem;">
            <select id="appt-client-id" name="client_id" class="form-input" style="flex:1;" required>
              <option value="">Seleccionar Cliente...</option>
              ${clients.map(c => `<option value="${c.id}" data-phone="${Utils.escHtml(c.phone || '')}">${Utils.escHtml(c.name)} (${Utils.escHtml(c.phone || 'Sin tel')})</option>`).join('')}
            </select>
            <button type="button" class="btn btn-outline" style="white-space:nowrap;" onclick="TurnosModule.quickCreateClient()">➕ Rápido</button>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Servicio *</label>
            <select id="appt-service-id" name="service_id" class="form-input" required onchange="TurnosModule.onServiceSelect(this)">
              <option value="">Seleccionar Servicio...</option>
              ${services.map(s => `<option value="${s.id}" data-duration="${s.duration_minutes}" data-price="${s.price}">${Utils.escHtml(s.name)} (${s.duration_minutes}m - ${Utils.currency(s.price)})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Profesional *</label>
            <select id="appt-prof-id" name="professional_id" class="form-input" required>
              <option value="">Seleccionar Profesional...</option>
              ${profs.map(p => `<option value="${p.id}">${Utils.escHtml(p.first_name + ' ' + p.last_name)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Fecha y Hora Inicio *</label>
            <input name="start_datetime" type="datetime-local" class="form-input" required value="${nowIso}">
          </div>
          <div class="form-group">
            <label>Duración (min) *</label>
            <input id="appt-duration" name="duration_minutes" type="number" class="form-input" required value="30">
          </div>
        </div>

        <div class="form-group">
          <label>Observaciones / Notas</label>
          <input name="notes" class="form-input" placeholder="Detalles de la cita">
        </div>

        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Confirmar Reserva</button>
        </div>
      </form>`);
  },

  onServiceSelect(sel) {
    const opt = sel.options[sel.selectedIndex];
    if (opt && opt.dataset.duration) {
      document.getElementById('appt-duration').value = opt.dataset.duration;
    }
  },

  async quickCreateClient() {
    const name = prompt('Nombre completo del nuevo cliente:');
    if (!name || !name.trim()) return;
    const phone = prompt('Teléfono del cliente:') || '';
    await DB.saveClient({ name: name.trim(), phone: phone.trim() });
    if (typeof Toast !== 'undefined') Toast.show('Cliente creado con éxito', 'success');
    Modal.close();
    await this.openNewAppointmentModal();
  },

  async submitNewAppointment(e) {
    e.preventDefault(); const f = e.target;
    const clientId = f.client_id.value;
    const serviceId = f.service_id.value;
    const profId = f.professional_id.value;
    const startIso = new Date(f.start_datetime.value).toISOString();
    const duration = parseInt(f.duration_minutes.value) || 30;
    const endIso = new Date(new Date(startIso).getTime() + duration * 60 * 1000).toISOString();

    const clientObj = (await DB.getClients()).find(c => c.id === clientId);
    const serviceObj = (await DB.getTurnosServices()).find(s => s.id === serviceId);
    const profObj = (await DB.getTurnosProfessionals()).find(p => p.id === profId);

    // Validar superposición
    const existing = await DB.getAppointments({ professional_id: profId });
    const hasOverlap = existing.some(a => {
      if (a.status === 'cancelado') return false;
      return (startIso < a.end_datetime && endIso > a.start_datetime);
    });

    if (hasOverlap) {
      alert("⚠️ Error: El profesional ya tiene un turno reservado en ese horario.");
      return;
    }

    await DB.saveAppointment({
      client_id: clientId,
      client_name: clientObj ? clientObj.name : 'Cliente',
      client_phone: clientObj ? clientObj.phone : '',
      service_id: serviceId,
      service_name: serviceObj ? serviceObj.name : 'Servicio',
      professional_id: profId,
      professional_name: profObj ? (profObj.first_name + ' ' + profObj.last_name) : 'Profesional',
      start_datetime: startIso,
      end_datetime: endIso,
      duration_minutes: duration,
      price: serviceObj ? serviceObj.price : 0,
      status: 'confirmado',
      notes: f.notes.value.trim()
    });

    Modal.close();
    if (typeof Toast !== 'undefined') Toast.show('Turno agendado con éxito', 'success');
    await this._renderTab();
  },

  async openDetailModal(id) {
    const appt = (await DB.getAppointments()).find(a => a.id === id);
    if (!appt) return;

    Modal.open(`
      <h2 class="modal-title">📅 Detalle de Cita</h2>
      <div class="card" style="margin-bottom:1rem;">
        <div class="detail-grid">
          <div><label>Cliente</label><p><strong>${Utils.escHtml(appt.client_name)}</strong> (${Utils.escHtml(appt.client_phone || '-')})</p></div>
          <div><label>Servicio</label><p>${Utils.escHtml(appt.service_name)} (${appt.duration_minutes} min)</p></div>
          <div><label>Profesional</label><p>${Utils.escHtml(appt.professional_name)}</p></div>
          <div><label>Precio</label><p><strong>${Utils.currency(appt.price)}</strong></p></div>
          <div><label>Fecha y Hora</label><p>${new Date(appt.start_datetime).toLocaleString('es-AR', { dateStyle:'medium', timeStyle:'short' })} hs</p></div>
          <div><label>Estado</label><p><span class="badge ${appt.status==='atendido'?'badge-success':appt.status==='cancelado'?'badge-danger':'badge-warning'}">${appt.status.toUpperCase()}</span></p></div>
        </div>
        ${appt.notes ? `<div style="margin-top:0.75rem;"><label>Notas:</label><p>${Utils.escHtml(appt.notes)}</p></div>` : ''}
        ${appt.cancellation_reason ? `<div style="margin-top:0.75rem; color:var(--red);"><label>Motivo Cancelación:</label><p>${Utils.escHtml(appt.cancellation_reason)}</p></div>` : ''}
      </div>

      <div class="modal-actions">
        ${appt.status !== 'cancelado' && appt.status !== 'atendido' ? `
          <button class="btn btn-primary" onclick="Modal.close(); TurnosModule.setStatus('${appt.id}', 'atendido')">✅ Marcar Atendido</button>
          <button class="btn btn-outline" onclick="Modal.close(); TurnosModule.openRescheduleModal('${appt.id}')">🗓️ Reprogramar</button>
          <button class="btn btn-outline danger" onclick="Modal.close(); TurnosModule.openCancelModal('${appt.id}')">✕ Cancelar</button>
        ` : ''}
        <button class="btn btn-outline" onclick="Modal.close()">Cerrar</button>
      </div>`);
  },

  async openRescheduleModal(id) {
    const appt = (await DB.getAppointments()).find(a => a.id === id);
    const profs = await DB.getTurnosProfessionals();
    const nowIso = new Date(appt.start_datetime).toISOString().slice(0, 16);

    Modal.open(`
      <h2 class="modal-title">🗓️ Reprogramar Turno</h2>
      <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:1rem;">Cliente: <strong>${Utils.escHtml(appt.client_name)}</strong></p>
      
      <form onsubmit="TurnosModule.submitReschedule(event, '${id}')">
        <div class="form-group">
          <label>Nuevo Profesional</label>
          <select name="professional_id" class="form-input">
            ${profs.map(p => `<option value="${p.id}" ${p.id === appt.professional_id ? 'selected' : ''}>${Utils.escHtml(p.first_name + ' ' + p.last_name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Nueva Fecha y Hora *</label>
          <input name="start_datetime" type="datetime-local" class="form-input" required value="${nowIso}">
        </div>
        <div class="form-group">
          <label>Motivo / Notas de Reprogramación</label>
          <input name="notes" class="form-input" placeholder="ej: Solicitado por el cliente">
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Reprogramar Cita</button>
        </div>
      </form>`);
  },

  async submitReschedule(e, id) {
    e.preventDefault(); const f = e.target;
    const appt = (await DB.getAppointments()).find(a => a.id === id);
    const profId = f.professional_id.value;
    const profObj = (await DB.getTurnosProfessionals()).find(p => p.id === profId);

    const startIso = new Date(f.start_datetime.value).toISOString();
    const endIso = new Date(new Date(startIso).getTime() + appt.duration_minutes * 60 * 1000).toISOString();

    await DB.rescheduleAppointment(id, startIso, endIso, profId, profObj ? (profObj.first_name + ' ' + profObj.last_name) : '', f.notes.value.trim());
    Modal.close();
    if (typeof Toast !== 'undefined') Toast.show('Turno reprogramado con éxito', 'success');
    await this._renderTab();
  },

  async openCancelModal(id) {
    Modal.open(`
      <h2 class="modal-title">✕ Cancelar Turno</h2>
      <form onsubmit="TurnosModule.submitCancel(event, '${id}')">
        <div class="form-group">
          <label>Motivo de Cancelación *</label>
          <select name="reason" class="form-input" required>
            <option value="Cliente canceló">Cliente canceló</option>
            <option value="Profesional no disponible">Profesional no disponible</option>
            <option value="Negocio cerrado">Negocio cerrado</option>
            <option value="Otro">Otro motivo</option>
          </select>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Volver</button>
          <button type="submit" class="btn btn-danger">Confirmar Cancelación</button>
        </div>
      </form>`);
  },

  async submitCancel(e, id) {
    e.preventDefault(); const f = e.target;
    await DB.cancelAppointment(id, f.reason.value, 'admin');
    Modal.close();
    if (typeof Toast !== 'undefined') Toast.show('Turno cancelado', 'warning');
    await this._renderTab();
  },

  async setStatus(id, status) {
    await DB.updateAppointmentStatus(id, status);
    if (typeof Toast !== 'undefined') Toast.show(`Turno actualizado a ${status}`, 'success');
    await this._renderTab();
  }
};
