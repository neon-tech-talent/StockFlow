const TurnosModule = {
  _activeTab: 'agenda', // 'agenda' | 'cargar'
  _selectedDate: new Date().toISOString().slice(0, 10),
  _selectedProfId: '',
  _searchQuery: '',
  _statusFilter: 'activos', // 'activos' | 'todos' | 'cancelado'

  async render(el, activeTab = null) {
    if (activeTab) this._activeTab = activeTab;

    const enabled = await DB.isModuleEnabled('turnos');
    if (!enabled) {
      el.innerHTML = Utils.emptyState('🚫', 'Módulo Deshabilitado', 'El módulo de Gestión de Turnos no está activo para esta cuenta.');
      return;
    }

    const profs = await DB.getTurnosProfessionals();
    const services = await DB.getTurnosServices();

    // Default time: Siguiente hora en punto
    const now = new Date();
    const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
    const defaultTime = `${String(nextHour.getHours()).padStart(2, '0')}:00`;

    el.innerHTML = `
      <!-- Cabecera del Módulo -->
      <div class="module-header" style="margin-bottom:1.25rem;">
        <div>
          <h2 class="card-title" style="margin:0; font-size:1.15rem;">📅 Gestión de Turnos</h2>
          <small class="text-muted">Agenda de turnos, calendario, responsables y servicios</small>
        </div>
        <div class="btn-row">
          <button class="btn btn-outline btn-sm" onclick="TurnosModule.openNewProfModal()">➕ Nuevo Responsable</button>
          <button class="btn btn-outline btn-sm" onclick="TurnosModule.openNewServiceModal()">💼 Nuevo Servicio</button>
          <button class="btn btn-outline btn-sm" onclick="TurnosModule.render(document.getElementById('content'))">🔄 Actualizar</button>
        </div>
      </div>

      <!-- Pestañas Principales (2 Pestañas) -->
      <div class="tabs-header" style="margin-bottom:1.5rem;">
        <button class="tab-btn ${this._activeTab === 'agenda' ? 'active' : ''}" onclick="TurnosModule.switchTab('agenda')">
          📅 Calendario y Turnos
        </button>
        <button class="tab-btn ${this._activeTab === 'cargar' ? 'active' : ''}" onclick="TurnosModule.switchTab('cargar')">
          ➕ Cargar Turno y Gestión
        </button>
      </div>

      <!-- Contenedor Dinámico de la Pestaña Activa -->
      <div id="turnos-tab-content"></div>`;

    await this._renderActiveTab(profs, services, defaultTime);
  },

  async switchTab(tab) {
    this._activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('onclick')?.includes(`'${tab}'`));
    });
    
    const profs = await DB.getTurnosProfessionals();
    const services = await DB.getTurnosServices();
    const now = new Date();
    const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
    const defaultTime = `${String(nextHour.getHours()).padStart(2, '0')}:00`;

    await this._renderActiveTab(profs, services, defaultTime);
  },

  async _renderActiveTab(profs, services, defaultTime) {
    const box = document.getElementById('turnos-tab-content');
    if (!box) return;

    if (this._activeTab === 'agenda') {
      await this._renderAgendaTab(box, profs);
    } else {
      this._renderCargarTab(box, profs, services, defaultTime);
    }

    if (typeof Utils !== 'undefined' && typeof Utils.animatePage === 'function') {
      Utils.animatePage(box);
    }
  },

  /* ─────────────────────────────────────────────────────────────
     PESTAÑA 1: CALENDARIO, FILTROS Y LISTA DE TURNOS
  ───────────────────────────────────────────────────────────── */
  async _renderAgendaTab(box, profs) {
    box.innerHTML = `
      <!-- Tarjeta de Filtros y Buscador de Turnos -->
      <div class="card" style="padding:1.25rem; margin-bottom:1.25rem;">
        <div style="display:flex; gap:0.85rem; flex-wrap:wrap; align-items:center; justify-content:space-between;">
          
          <!-- Filtro por Fecha -->
          <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <label style="font-size:0.8rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Fecha:</label>
            <input type="date" id="filter-date" class="form-input" style="width:auto; padding:0.45rem 0.75rem;" value="${this._selectedDate}">
            <div class="btn-row" style="gap:0.3rem;">
              <button class="btn btn-sm ${this._selectedDate === new Date().toISOString().slice(0, 10) ? 'btn-primary' : 'btn-outline'}" onclick="TurnosModule.setDateQuick('today')">⚡ Hoy</button>
              <button class="btn btn-sm ${this._selectedDate === new Date(Date.now() + 86400000).toISOString().slice(0, 10) ? 'btn-primary' : 'btn-outline'}" onclick="TurnosModule.setDateQuick('tomorrow')">Mañana</button>
              <button class="btn btn-sm ${this._selectedDate === '' ? 'btn-primary' : 'btn-outline'}" onclick="TurnosModule.setDateQuick('all')">Ver Todos</button>
            </div>
          </div>

          <!-- Filtro por Responsable -->
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <label style="font-size:0.8rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Responsable:</label>
            <select id="filter-prof" class="form-input" style="width:auto; padding:0.45rem 0.75rem;" onchange="TurnosModule.onProfFilterChange(this.value)">
              <option value="">Todos los Responsables</option>
              ${profs.map(p => `<option value="${p.id}" ${this._selectedProfId === p.id ? 'selected' : ''}>${Utils.escHtml(p.first_name + ' ' + (p.last_name || ''))}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Buscador y Estado -->
        <div style="margin-top:0.85rem; padding-top:0.85rem; border-top:1px solid var(--border-subtle); display:flex; gap:0.6rem; align-items:center; flex-wrap:wrap;">
          <div style="flex:1; min-width:240px;">
            <input id="filter-search" type="text" placeholder="Buscar por nombre de cliente, teléfono o servicio..." class="form-input" style="padding:0.5rem 0.85rem;" value="${Utils.escHtml(this._searchQuery)}">
          </div>
          <select id="filter-status" class="form-input" style="width:auto; min-width:170px; padding:0.5rem 0.85rem;" onchange="TurnosModule.onStatusFilterChange(this.value)">
            <option value="activos" ${this._statusFilter === 'activos' ? 'selected' : ''}>Turnos Activos</option>
            <option value="todos" ${this._statusFilter === 'todos' ? 'selected' : ''}>Todos los Estados</option>
            <option value="cancelado" ${this._statusFilter === 'cancelado' ? 'selected' : ''}>Cancelados</option>
          </select>
          <button class="btn btn-primary btn-sm" onclick="TurnosModule.switchTab('cargar')" style="white-space:nowrap;">
            ➕ Agendar Nuevo Turno
          </button>
        </div>
      </div>

      <!-- Contenedor de Lista de Turnos -->
      <div id="turnos-list-container" style="display:flex; flex-direction:column; gap:0.85rem;">
        <div class="empty-state">Cargando agenda...</div>
      </div>`;

    this._setupAgendaEvents();
    await this._renderAppointmentsList();
  },

  _setupAgendaEvents() {
    const dateInput = document.getElementById('filter-date');
    if (dateInput) {
      dateInput.onchange = (e) => {
        this._selectedDate = e.target.value;
        this._renderAppointmentsList();
      };
    }

    const searchInput = document.getElementById('filter-search');
    if (searchInput) {
      searchInput.oninput = (e) => {
        this._searchQuery = e.target.value.toLowerCase();
        this._renderAppointmentsList();
      };
    }
  },

  setDateQuick(mode) {
    if (mode === 'today') {
      this._selectedDate = new Date().toISOString().slice(0, 10);
    } else if (mode === 'tomorrow') {
      this._selectedDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    } else if (mode === 'all') {
      this._selectedDate = '';
    }
    const dateInput = document.getElementById('filter-date');
    if (dateInput) dateInput.value = this._selectedDate;
    this.switchTab('agenda');
  },

  onProfFilterChange(profId) {
    this._selectedProfId = profId;
    this._renderAppointmentsList();
  },

  onStatusFilterChange(status) {
    this._statusFilter = status;
    this._renderAppointmentsList();
  },

  async _renderAppointmentsList() {
    const container = document.getElementById('turnos-list-container');
    if (!container) return;

    let appts = await DB.getAppointments();

    // Filtro por Fecha
    if (this._selectedDate) {
      appts = appts.filter(a => (a.start_datetime || '').slice(0, 10) === this._selectedDate);
    }

    // Filtro por Responsable
    if (this._selectedProfId) {
      appts = appts.filter(a => a.professional_id === this._selectedProfId);
    }

    // Filtro por Estado
    if (this._statusFilter === 'activos') {
      appts = appts.filter(a => a.status !== 'cancelado');
    } else if (this._statusFilter === 'cancelado') {
      appts = appts.filter(a => a.status === 'cancelado');
    }

    // Filtro por Buscador
    if (this._searchQuery) {
      appts = appts.filter(a => 
        (a.client_name || '').toLowerCase().includes(this._searchQuery) ||
        (a.client_phone || '').toLowerCase().includes(this._searchQuery) ||
        (a.service_name || '').toLowerCase().includes(this._searchQuery) ||
        (a.professional_name || '').toLowerCase().includes(this._searchQuery)
      );
    }

    if (!appts.length) {
      container.innerHTML = Utils.emptyState(
        '📅', 
        'No hay turnos para los filtros seleccionados', 
        'Puedes agendar un nuevo turno desde la pestaña "➕ Cargar Turno y Gestión"'
      );
      return;
    }

    // Detectar turnos en paralelo (mismo horario exacto)
    const timeCountMap = {};
    appts.forEach(a => {
      const timeKey = (a.start_datetime || '').slice(0, 16);
      timeCountMap[timeKey] = (timeCountMap[timeKey] || 0) + 1;
    });

    container.innerHTML = appts.map(a => {
      const isCancelled = a.status === 'cancelado';
      const isCompleted = a.status === 'completado';
      const timeKey = (a.start_datetime || '').slice(0, 16);
      const isParallel = timeCountMap[timeKey] > 1 && !isCancelled;

      const dateObj = new Date(a.start_datetime);
      const timeStr = dateObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      const dateStr = dateObj.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' });

      let statusBadge = `<span class="badge badge-success">Confirmado</span>`;
      if (isCancelled) statusBadge = `<span class="badge badge-danger">Cancelado</span>`;
      else if (isCompleted) statusBadge = `<span class="badge badge-info">Completado</span>`;
      else if (a.status === 'reprogramado') statusBadge = `<span class="badge badge-warning">Reprogramado</span>`;

      const phoneClean = (a.client_phone || '').replace(/\D/g, '');
      const waLink = phoneClean ? `https://wa.me/${phoneClean.startsWith('54') ? phoneClean : '54' + phoneClean}?text=${encodeURIComponent(`¡Hola ${a.client_name}! Te recordamos tu turno de ${a.service_name} el día ${dateStr} a las ${timeStr} hs.`)}` : null;

      return `
        <div class="card" style="padding:1.15rem 1.35rem; border-left: 5px solid ${isCancelled ? '#475569' : isCompleted ? 'var(--blue)' : 'var(--accent)'}; transition:all 0.2s ease;">
          
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.75rem; flex-wrap:wrap;">
            <div>
              <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.35rem; flex-wrap:wrap;">
                <strong style="font-size:1.25rem; color:var(--accent-light); letter-spacing:-0.01em;">${timeStr} hs</strong>
                ${!this._selectedDate ? `<small class="text-muted" style="font-weight:600;">(${dateStr})</small>` : ''}
                ${statusBadge}
                ${isParallel ? `<span class="badge" style="background:rgba(212,175,55,0.15); color:var(--accent); border:1px solid var(--border);">⚡ Paralelo</span>` : ''}
              </div>
              <h3 style="margin:0; font-size:1.1rem; color:var(--text-main); font-weight:700;">
                ${Utils.escHtml(a.client_name)}
              </h3>
              ${a.client_phone ? `
                <div style="font-size:0.85rem; color:var(--text-secondary); margin-top:0.2rem; display:flex; align-items:center; gap:0.4rem;">
                  <span>📞 ${Utils.escHtml(a.client_phone)}</span>
                  ${waLink ? `<a href="${waLink}" target="_blank" class="btn-sm btn-outline" style="padding:1px 6px; font-size:0.75rem; text-decoration:none; color:#25d366; border-color:rgba(37,211,102,0.35);">💬 WhatsApp</a>` : ''}
                </div>` : ''}
            </div>

            <div style="text-align:right;">
              <div style="font-size:1rem; font-weight:700; color:var(--text-main);">
                💼 ${Utils.escHtml(a.service_name || 'Servicio')}
              </div>
              <div style="font-size:0.875rem; color:var(--accent); font-weight:600; margin-top:0.2rem;">
                👤 Responsable: <strong>${Utils.escHtml(a.professional_name || 'No asignado')}</strong>
              </div>
              ${a.price > 0 ? `<div style="font-size:0.85rem; color:var(--text-muted); margin-top:0.15rem;">${Utils.currency(a.price)}</div>` : ''}
            </div>
          </div>

          ${a.notes ? `
            <div style="margin-top:0.65rem; padding:0.45rem 0.75rem; background:rgba(0,0,0,0.25); border-radius:var(--radius-xs); font-size:0.85rem; color:var(--text-muted); border:1px solid var(--border-subtle);">
              💬 <strong>Nota:</strong> ${Utils.escHtml(a.notes)}
            </div>` : ''}

          <!-- Acciones del Turno -->
          <div style="margin-top:0.85rem; padding-top:0.65rem; border-top:1px solid var(--border-subtle); display:flex; justify-content:flex-end; gap:0.5rem; align-items:center; flex-wrap:wrap;">
            ${!isCancelled && !isCompleted ? `
              <button class="btn btn-sm btn-outline" style="color:var(--green); border-color:rgba(16,185,129,0.35);" onclick="TurnosModule.completeAppointment('${a.id}')" title="Marcar como atendido/completado">
                ✅ Completar
              </button>
              <button class="btn btn-sm btn-outline" style="color:var(--red); border-color:rgba(244,63,94,0.35);" onclick="TurnosModule.cancelAppointmentPrompt('${a.id}')" title="Cancelar turno">
                ❌ Cancelar Turno
              </button>
            ` : ''}
            ${isCancelled ? `<span style="font-size:0.85rem; color:var(--text-dim); font-style:italic;">Turno cancelado</span>` : ''}
          </div>

        </div>`;
    }).join('');

    if (typeof Utils !== 'undefined' && typeof Utils.animateStagger === 'function') {
      Utils.animateStagger('.card', 25);
    }
  },

  /* ─────────────────────────────────────────────────────────────
     PESTAÑA 2: FORMULARIO DE CARGA, SERVICIOS Y RESPONSABLES
  ───────────────────────────────────────────────────────────── */
  _renderCargarTab(box, profs, services, defaultTime) {
    box.innerHTML = `
      <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap:1.25rem; align-items:start;" class="turnos-cargar-grid">
        
        <!-- Formulario de Agendar Turno -->
        <div class="card" style="padding:1.75rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; border-bottom:1px solid var(--border-subtle); padding-bottom:0.75rem;">
            <h3 class="card-title" style="margin:0; font-size:1.05rem;">➕ Agendar Nuevo Turno</h3>
            <span class="badge badge-success" style="font-size:0.72rem;">⚡ Permite Turnos Paralelos</span>
          </div>

          <form id="form-quick-appt" onsubmit="TurnosModule.saveQuickAppointment(event)">
            
            <!-- Datos del Cliente -->
            <div class="form-group">
              <label>Nombre Completo del Cliente *</label>
              <input id="qa-client-name" name="client_name" class="form-input" required placeholder="Ej: Juan Pérez" autofocus>
            </div>

            <div class="form-group">
              <label>Teléfono / WhatsApp (Opcional)</label>
              <input id="qa-client-phone" name="client_phone" class="form-input" placeholder="Ej: 11 2345-6789">
            </div>

            <!-- Fecha y Hora -->
            <div class="form-row">
              <div class="form-group">
                <label>Fecha del Turno *</label>
                <input id="qa-date" name="appt_date" type="date" class="form-input" required value="${this._selectedDate || new Date().toISOString().slice(0, 10)}">
              </div>
              <div class="form-group">
                <label>Hora del Turno *</label>
                <input id="qa-time" name="appt_time" type="time" class="form-input" required value="${defaultTime}">
              </div>
            </div>

            <!-- Servicio -->
            <div class="form-group">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
                <label style="margin:0;">Servicio Solicitado *</label>
                <a href="javascript:void(0)" onclick="TurnosModule.openNewServiceModal()" style="font-size:0.78rem; color:var(--accent); font-weight:600; text-decoration:none;">➕ Crear nuevo servicio</a>
              </div>
              <select id="qa-service" name="service_id" class="form-input" required>
                <option value="">-- Seleccionar Servicio --</option>
                ${services.map(s => `<option value="${s.id}" data-name="${Utils.escHtml(s.name)}" data-price="${s.price || 0}" data-duration="${s.duration_minutes || 30}">${Utils.escHtml(s.name)} (${Utils.currency(s.price || 0)} - ${s.duration_minutes || 30} min)</option>`).join('')}
              </select>
            </div>

            <!-- Responsable -->
            <div class="form-group">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
                <label style="margin:0;">Responsable de Atender *</label>
                <a href="javascript:void(0)" onclick="TurnosModule.openNewProfModal()" style="font-size:0.78rem; color:var(--accent); font-weight:600; text-decoration:none;">➕ Crear nuevo responsable</a>
              </div>
              <select id="qa-prof" name="prof_id" class="form-input" required>
                <option value="">-- Seleccionar Responsable --</option>
                ${profs.map(p => `<option value="${p.id}" data-name="${Utils.escHtml(p.first_name + ' ' + (p.last_name || ''))}">${Utils.escHtml(p.first_name + ' ' + (p.last_name || ''))}</option>`).join('')}
              </select>
            </div>

            <!-- Notas / Aclaraciones -->
            <div class="form-group">
              <label>Notas / Aclaraciones (Opcional)</label>
              <textarea id="qa-notes" name="notes" class="form-input" rows="2" placeholder="Ej: Trae diseño previo, primera vez, etc."></textarea>
            </div>

            <button type="submit" class="btn btn-primary btn-lg" style="width:100%; margin-top:0.75rem; justify-content:center; font-size:1rem;">
              💾 AGENDAR TURNO
            </button>
          </form>
        </div>

        <!-- Panel Lateral: Gestión de Responsables y Servicios -->
        <div style="display:flex; flex-direction:column; gap:1.25rem;">
          
          <!-- Bloque de Responsables -->
          <div class="card" style="padding:1.35rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.85rem;">
              <h4 class="card-title" style="margin:0; font-size:0.9rem;">👥 Responsables (${profs.length})</h4>
              <button class="btn btn-xs btn-outline" onclick="TurnosModule.openNewProfModal()">➕ Agregar</button>
            </div>
            <div style="display:flex; flex-direction:column; gap:0.45rem; max-height:170px; overflow-y:auto;">
              ${profs.length ? profs.map(p => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-main); padding:0.5rem 0.75rem; border-radius:var(--radius-xs); border:1px solid var(--border-subtle);">
                  <span>👤 <strong>${Utils.escHtml(p.first_name + ' ' + (p.last_name || ''))}</strong></span>
                  ${p.phone ? `<small class="text-muted">${Utils.escHtml(p.phone)}</small>` : ''}
                </div>
              `).join('') : '<span class="text-muted" style="font-size:0.85rem;">No hay responsables registrados.</span>'}
            </div>
          </div>

          <!-- Bloque de Servicios -->
          <div class="card" style="padding:1.35rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.85rem;">
              <h4 class="card-title" style="margin:0; font-size:0.9rem;">💼 Servicios (${services.length})</h4>
              <button class="btn btn-xs btn-outline" onclick="TurnosModule.openNewServiceModal()">➕ Agregar</button>
            </div>
            <div style="display:flex; flex-direction:column; gap:0.45rem; max-height:170px; overflow-y:auto;">
              ${services.length ? services.map(s => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-main); padding:0.5rem 0.75rem; border-radius:var(--radius-xs); border:1px solid var(--border-subtle);">
                  <div>
                    <strong>${Utils.escHtml(s.name)}</strong>
                    <small class="text-muted">(${s.duration_minutes || 30} min)</small>
                  </div>
                  <strong style="color:var(--accent); font-size:0.9rem;">${Utils.currency(s.price || 0)}</strong>
                </div>
              `).join('') : '<span class="text-muted" style="font-size:0.85rem;">No hay servicios registrados.</span>'}
            </div>
          </div>

        </div>

      </div>`;
  },

  /* ── GUARDAR NUEVO TURNO RÁPIDO (PERMITE PARALELOS) ── */
  async saveQuickAppointment(e) {
    e.preventDefault();
    const f = e.target;

    const clientName = f.client_name.value.trim();
    const clientPhone = f.client_phone.value.trim();
    const apptDate = f.appt_date.value;
    const apptTime = f.appt_time.value;
    const serviceSelect = f.service_id;
    const profSelect = f.prof_id;
    const notes = f.notes.value.trim();

    if (!clientName || !apptDate || !apptTime || !serviceSelect.value || !profSelect.value) {
      if (typeof Toast !== 'undefined') Toast.show('Por favor completa todos los campos obligatorios', 'warning');
      return;
    }

    const startIso = new Date(`${apptDate}T${apptTime}:00`).toISOString();
    const serviceOpt = serviceSelect.selectedOptions[0];
    const profOpt = profSelect.selectedOptions[0];

    const serviceName = serviceOpt.dataset.name;
    const price = parseFloat(serviceOpt.dataset.price) || 0;
    const duration = parseInt(serviceOpt.dataset.duration) || 30;
    const profName = profOpt.dataset.name;

    const endIso = new Date(new Date(startIso).getTime() + duration * 60000).toISOString();

    try {
      await DB.saveAppointment({
        client_name: clientName,
        client_phone: clientPhone,
        service_id: serviceSelect.value,
        service_name: serviceName,
        professional_id: profSelect.value,
        professional_name: profName,
        start_datetime: startIso,
        end_datetime: endIso,
        duration_minutes: duration,
        price: price,
        status: 'confirmado',
        notes: notes
      });

      if (typeof Toast !== 'undefined') Toast.show(`¡Turno agendado para ${clientName} a las ${apptTime} hs!`, 'success');
      
      // Actualizar fecha seleccionada para ver el turno en la agenda
      this._selectedDate = apptDate;
      
      // Redirigir a la pestaña de Agenda
      await this.switchTab('agenda');
    } catch (err) {
      console.error("Error al guardar turno:", err);
      if (typeof Toast !== 'undefined') Toast.show(err.message || 'Error al guardar el turno', 'danger');
    }
  },

  /* ── MODAL: NUEVO RESPONSABLE / PROFESIONAL EN EL ACTO ── */
  openNewProfModal() {
    Modal.open(`
      <h2 class="modal-title">➕ Nuevo Responsable / Profesional</h2>
      <p class="text-muted" style="margin-top:-0.8rem; margin-bottom:1.25rem; font-size:0.85rem;">
        Agrega un integrante del equipo para asignarle turnos.
      </p>
      <form onsubmit="TurnosModule.saveNewProf(event)">
        <div class="form-row">
          <div class="form-group">
            <label>Nombre *</label>
            <input id="np-first" name="first_name" class="form-input" required placeholder="Ej: Carlos">
          </div>
          <div class="form-group">
            <label>Apellido</label>
            <input id="np-last" name="last_name" class="form-input" placeholder="Ej: Gómez">
          </div>
        </div>
        <div class="form-group">
          <label>Teléfono (Opcional)</label>
          <input id="np-phone" name="phone" class="form-input" placeholder="Ej: 11 2345-6789">
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar Responsable</button>
        </div>
      </form>`);
  },

  async saveNewProf(e) {
    e.preventDefault();
    const f = e.target;
    const firstName = f.first_name.value.trim();
    const lastName = f.last_name.value.trim();
    const phone = f.phone.value.trim();

    try {
      await DB.saveTurnosProfessional({
        first_name: firstName,
        last_name: lastName,
        phone: phone,
        active: true
      });

      Modal.close();
      if (typeof Toast !== 'undefined') Toast.show(`Responsable ${firstName} creado con éxito`, 'success');
      await this.render(document.getElementById('content'), this._activeTab);
    } catch (err) {
      console.error("Error al guardar responsable:", err);
      if (typeof Toast !== 'undefined') Toast.show('Error al guardar responsable', 'danger');
    }
  },

  /* ── MODAL: NUEVO SERVICIO EN EL ACTO ── */
  openNewServiceModal() {
    Modal.open(`
      <h2 class="modal-title">💼 Nuevo Servicio</h2>
      <form onsubmit="TurnosModule.saveNewService(event)">
        <div class="form-group">
          <label>Nombre del Servicio *</label>
          <input id="ns-name" name="name" class="form-input" required placeholder="Ej: Corte y Barba, Masaje...">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Precio ($) *</label>
            <input id="ns-price" name="price" type="number" step="0.01" min="0" class="form-input" required placeholder="0.00">
          </div>
          <div class="form-group">
            <label>Duración (Minutos) *</label>
            <input id="ns-duration" name="duration_minutes" type="number" step="5" min="5" value="30" class="form-input" required placeholder="30">
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar Servicio</button>
        </div>
      </form>`);
  },

  async saveNewService(e) {
    e.preventDefault();
    const f = e.target;
    const name = f.name.value.trim();
    const price = parseFloat(f.price.value) || 0;
    const duration = parseInt(f.duration_minutes.value) || 30;

    try {
      await DB.saveTurnosService({
        name: name,
        price: price,
        duration_minutes: duration,
        active: true
      });

      Modal.close();
      if (typeof Toast !== 'undefined') Toast.show(`Servicio "${name}" creado con éxito`, 'success');
      await this.render(document.getElementById('content'), this._activeTab);
    } catch (err) {
      console.error("Error al guardar servicio:", err);
      if (typeof Toast !== 'undefined') Toast.show('Error al guardar servicio', 'danger');
    }
  },

  /* ── CANCELAR TURNO ── */
  async cancelAppointmentPrompt(apptId) {
    if (!confirm('¿Estás seguro de cancelar este turno?')) return;
    try {
      await DB.cancelAppointment(apptId, 'Cancelado por el administrador');
      if (typeof Toast !== 'undefined') Toast.show('Turno cancelado', 'info');
      await this._renderAppointmentsList();
    } catch (err) {
      console.error("Error al cancelar turno:", err);
      if (typeof Toast !== 'undefined') Toast.show('Error al cancelar', 'danger');
    }
  },

  /* ── COMPLETAR TURNO ── */
  async completeAppointment(apptId) {
    try {
      await DB.updateAppointmentStatus(apptId, 'completado');
      if (typeof Toast !== 'undefined') Toast.show('Turno marcado como completado', 'success');
      await this._renderAppointmentsList();
    } catch (err) {
      console.error("Error al completar turno:", err);
      if (typeof Toast !== 'undefined') Toast.show('Error al actualizar estado', 'danger');
    }
  }
};
