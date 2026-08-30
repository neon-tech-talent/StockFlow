const TurnosModule = {
  _activeTab: 'agenda', // 'agenda' | 'cargar'
  _selectedDate: new Date().toISOString().slice(0, 10),
  _selectedProfId: '',
  _searchQuery: '',
  _statusFilter: 'activos', // 'activos' | 'todos' | 'cancelado'
  _selectedClientId: null,

  async render(el, activeTab = null) {
    if (activeTab) this._activeTab = activeTab;

    const enabled = await DB.isModuleEnabled('turnos');
    if (!enabled) {
      el.innerHTML = Utils.emptyState('🚫', 'Módulo Deshabilitado', 'El módulo de Gestión de Turnos no está activo para esta cuenta.');
      return;
    }

    const profs = await DB.getTurnosProfessionals();
    const services = await DB.getTurnosServices();
    const clients = await DB.getClients();

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

    await this._renderActiveTab(profs, services, clients, defaultTime);
  },

  async switchTab(tab) {
    this._activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('onclick')?.includes(`'${tab}'`));
    });
    
    const profs = await DB.getTurnosProfessionals();
    const services = await DB.getTurnosServices();
    const clients = await DB.getClients();
    const now = new Date();
    const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
    const defaultTime = `${String(nextHour.getHours()).padStart(2, '0')}:00`;

    await this._renderActiveTab(profs, services, clients, defaultTime);
  },

  async _renderActiveTab(profs, services, clients, defaultTime) {
    const box = document.getElementById('turnos-tab-content');
    if (!box) return;

    if (this._activeTab === 'agenda') {
      await this._renderAgendaTab(box, profs);
    } else {
      this._renderCargarTab(box, profs, services, clients, defaultTime);
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
              <div style="display:flex; align-items:center; justify-content:flex-end; gap:0.4rem; margin-top:0.15rem;">
                ${a.duration_minutes ? `<small class="text-muted">⏱️ ${a.duration_minutes} min</small>` : ''}
                ${a.price > 0 ? `<strong style="font-size:0.95rem; color:var(--accent);">${Utils.currency(a.price)}</strong>` : ''}
              </div>
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
  _renderCargarTab(box, profs, services, clients, defaultTime) {
    this._selectedClientId = null;

    box.innerHTML = `
      <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap:1.25rem; align-items:start;" class="turnos-cargar-grid">
        
        <!-- Formulario de Agendar Turno -->
        <div class="card" style="padding:1.75rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; border-bottom:1px solid var(--border-subtle); padding-bottom:0.75rem;">
            <h3 class="card-title" style="margin:0; font-size:1.05rem;">➕ Agendar Nuevo Turno</h3>
            <span class="badge badge-success" style="font-size:0.72rem;">⚡ Detección de Turnos Paralelos</span>
          </div>

          <form id="form-quick-appt" onsubmit="TurnosModule.handleFormSubmit(event)">
            
            <!-- Datos del Cliente -->
            <div class="form-group">
              <label>Cliente *</label>
              ${clients.length ? `
                <div style="margin-bottom:0.45rem;">
                  <select id="qa-client-select" class="form-input" style="font-size:0.875rem;" onchange="TurnosModule.onClientSelect(this)">
                    <option value="">-- Seleccionar de la lista de Clientes o escribir abajo --</option>
                    ${clients.map(c => `<option value="${c.id}" data-name="${Utils.escHtml(c.name)}" data-phone="${Utils.escHtml(c.phone || '')}">${Utils.escHtml(c.name)} ${c.phone ? `(${Utils.escHtml(c.phone)})` : ''}</option>`).join('')}
                  </select>
                </div>
              ` : ''}
              <input id="qa-client-name" name="client_name" class="form-input" required placeholder="Nombre completo del cliente" autofocus oninput="TurnosModule.onClientTyped()">
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

            <!-- Servicio Solicitado -->
            <div class="form-group">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
                <label style="margin:0;">Servicio Solicitado *</label>
                <a href="javascript:void(0)" onclick="TurnosModule.openNewServiceModal()" style="font-size:0.78rem; color:var(--accent); font-weight:600; text-decoration:none;">➕ Crear nuevo servicio</a>
              </div>
              <select id="qa-service" name="service_id" class="form-input" required onchange="TurnosModule.onServiceSelect(this)">
                <option value="">-- Seleccionar Servicio --</option>
                ${services.map(s => `<option value="${s.id}" data-name="${Utils.escHtml(s.name)}" data-price="${s.price || 0}" data-duration="${s.duration_minutes || 30}">${Utils.escHtml(s.name)} (${Utils.currency(s.price || 0)} - ${s.duration_minutes || 30} min)</option>`).join('')}
              </select>
            </div>

            <!-- Modificación de Monto y Tiempo para este Turno -->
            <div class="form-row" style="background:var(--bg-main); padding:0.85rem 1rem; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); margin-bottom:1rem;">
              <div class="form-group" style="margin:0;">
                <label style="font-size:0.8rem;">Monto / Precio ($)</label>
                <input id="qa-service-price" name="service_price" type="number" step="0.01" min="0" class="form-input" placeholder="0.00" value="0.00">
              </div>
              <div class="form-group" style="margin:0;">
                <label style="font-size:0.8rem;">Tiempo / Duración (min)</label>
                <input id="qa-service-duration" name="service_duration" type="number" step="5" min="5" class="form-input" placeholder="30" value="30">
              </div>
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
            <div style="display:flex; flex-direction:column; gap:0.45rem; max-height:190px; overflow-y:auto;">
              ${profs.length ? profs.map(p => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-main); padding:0.5rem 0.75rem; border-radius:var(--radius-xs); border:1px solid var(--border-subtle);">
                  <div>
                    <span>👤 <strong>${Utils.escHtml(p.first_name + ' ' + (p.last_name || ''))}</strong></span>
                    ${p.phone ? `<small class="text-muted" style="display:block; font-size:0.75rem;">${Utils.escHtml(p.phone)}</small>` : ''}
                  </div>
                  <div style="display:flex; gap:0.35rem;">
                    <button type="button" class="btn-sm btn-outline" style="padding:2px 6px; font-size:0.75rem;" onclick="TurnosModule.openEditProfModal('${p.id}')" title="Editar responsable">✏️</button>
                    <button type="button" class="btn-sm btn-outline" style="padding:2px 6px; font-size:0.75rem; color:var(--red); border-color:rgba(244,63,94,0.3);" onclick="TurnosModule.deleteProfPrompt('${p.id}')" title="Eliminar responsable">🗑️</button>
                  </div>
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
            <div style="display:flex; flex-direction:column; gap:0.45rem; max-height:190px; overflow-y:auto;">
              ${services.length ? services.map(s => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-main); padding:0.5rem 0.75rem; border-radius:var(--radius-xs); border:1px solid var(--border-subtle);">
                  <div>
                    <strong>${Utils.escHtml(s.name)}</strong>
                    <div style="font-size:0.78rem; color:var(--accent);">
                      ${Utils.currency(s.price || 0)} <span class="text-muted">(${s.duration_minutes || 30} min)</span>
                    </div>
                  </div>
                  <div style="display:flex; gap:0.35rem;">
                    <button type="button" class="btn-sm btn-outline" style="padding:2px 6px; font-size:0.75rem;" onclick="TurnosModule.openEditServiceModal('${s.id}')" title="Editar servicio">✏️</button>
                    <button type="button" class="btn-sm btn-outline" style="padding:2px 6px; font-size:0.75rem; color:var(--red); border-color:rgba(244,63,94,0.3);" onclick="TurnosModule.deleteServicePrompt('${s.id}')" title="Eliminar servicio">🗑️</button>
                  </div>
                </div>
              `).join('') : '<span class="text-muted" style="font-size:0.85rem;">No hay servicios registrados.</span>'}
            </div>
          </div>

        </div>

      </div>`;
  },

  onServiceSelect(sel) {
    if (!sel || !sel.value) return;
    const opt = sel.selectedOptions[0];
    const priceInput = document.getElementById('qa-service-price');
    const durationInput = document.getElementById('qa-service-duration');
    if (priceInput) priceInput.value = parseFloat(opt.dataset.price) || 0;
    if (durationInput) durationInput.value = parseInt(opt.dataset.duration) || 30;
  },

  onClientSelect(sel) {
    if (!sel || !sel.value) return;
    const opt = sel.selectedOptions[0];
    const nameInput = document.getElementById('qa-client-name');
    const phoneInput = document.getElementById('qa-client-phone');
    if (nameInput) nameInput.value = opt.dataset.name || '';
    if (phoneInput) phoneInput.value = opt.dataset.phone || '';
    this._selectedClientId = sel.value;
  },

  onClientTyped() {
    const sel = document.getElementById('qa-client-select');
    if (sel && sel.value) {
      sel.value = '';
      this._selectedClientId = null;
    }
  },

  /* ── ENVÍO DE FORMULARIO CON DETECCIÓN DE TURNO PARALELO ── */
  async handleFormSubmit(e) {
    e.preventDefault();
    const f = e.target;

    const clientName = f.client_name.value.trim();
    const clientPhone = f.client_phone.value.trim();
    const apptDate = f.appt_date.value;
    const apptTime = f.appt_time.value;
    const serviceSelect = f.service_id;
    const profSelect = f.prof_id;
    const notes = f.notes.value.trim();

    // Valores editables de Monto y Tiempo para este turno específico
    const price = parseFloat(f.service_price?.value) || 0;
    const duration = parseInt(f.service_duration?.value) || 30;

    if (!clientName || !apptDate || !apptTime || !serviceSelect.value || !profSelect.value) {
      if (typeof Toast !== 'undefined') Toast.show('Por favor completa todos los campos obligatorios', 'warning');
      return;
    }

    const startIso = new Date(`${apptDate}T${apptTime}:00`).toISOString();
    const serviceOpt = serviceSelect.selectedOptions[0];
    const profOpt = profSelect.selectedOptions[0];

    const serviceName = serviceOpt.dataset.name;
    const profName = profOpt.dataset.name;

    const endIso = new Date(new Date(startIso).getTime() + duration * 60000).toISOString();

    const apptPayload = {
      client_id: this._selectedClientId || null,
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
    };

    // Verificar si ya existe un turno en este mismo horario
    const allAppts = await DB.getAppointments();
    const existingMatches = allAppts.filter(a => 
      a.status !== 'cancelado' && 
      (a.start_datetime || '').slice(0, 16) === `${apptDate}T${apptTime}`
    );

    if (existingMatches.length > 0) {
      // Prompt modal para confirmar si desea agendar turno paralelo
      this._promptParallelAppointment(apptPayload, existingMatches, apptDate, apptTime);
    } else {
      // No hay turno previo, guardar directo
      await this.executeSaveAppointment(apptPayload, apptDate, apptTime);
    }
  },

  _promptParallelAppointment(payload, existingMatches, apptDate, apptTime) {
    const formattedDate = new Date(`${apptDate}T00:00:00`).toLocaleDateString('es-AR', {
      weekday: 'long', day: '2-digit', month: '2-digit'
    });

    Modal.open(`
      <div style="text-align:left;">
        <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:0.75rem;">
          <span style="font-size:1.6rem;">⚠️</span>
          <h2 class="modal-title" style="margin:0; color:var(--accent);">Horario Ocupado — ¿Turno en Paralelo?</h2>
        </div>

        <p style="font-size:0.95rem; color:var(--text-main); margin-bottom:1rem;">
          Ya existe un turno agendado para el <strong>${formattedDate} a las ${apptTime} hs</strong>:
        </p>

        <div style="background:var(--bg-main); border:1px solid var(--border); border-radius:var(--radius-sm); padding:0.85rem 1rem; margin-bottom:1.25rem; display:flex; flex-direction:column; gap:0.5rem;">
          ${existingMatches.map(em => `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed var(--border-subtle); padding-bottom:0.35rem;">
              <div>
                <strong style="color:var(--text-main);">${Utils.escHtml(em.client_name)}</strong>
                <small class="text-muted" style="display:block;">💼 ${Utils.escHtml(em.service_name || 'Servicio')} (${em.duration_minutes || 30} min - ${Utils.currency(em.price || 0)})</small>
              </div>
              <div style="text-align:right;">
                <span class="badge" style="background:rgba(212,175,55,0.15); color:var(--accent); font-size:0.75rem;">
                  👤 ${Utils.escHtml(em.professional_name || 'Sin responsable')}
                </span>
              </div>
            </div>
          `).join('')}
        </div>

        <p style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:1.5rem;">
          ¿Deseas agendar a <strong>${Utils.escHtml(payload.client_name)}</strong> como <strong>Turno en Paralelo</strong> en este mismo horario?
        </p>

        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">❌ No, cambiar horario</button>
          <button type="button" class="btn btn-primary" onclick="TurnosModule.executeSaveAppointmentFromModal('${encodeURIComponent(JSON.stringify(payload))}', '${apptDate}', '${apptTime}')">
            ⚡ Sí, agendar en paralelo
          </button>
        </div>
      </div>`);
  },

  async executeSaveAppointmentFromModal(encodedPayload, apptDate, apptTime) {
    try {
      const payload = JSON.parse(decodeURIComponent(encodedPayload));
      Modal.close();
      await this.executeSaveAppointment(payload, apptDate, apptTime);
    } catch (err) {
      console.error("Error al procesar payload:", err);
    }
  },

  async executeSaveAppointment(payload, apptDate, apptTime) {
    try {
      await DB.saveAppointment(payload);

      if (typeof Toast !== 'undefined') {
        Toast.show(`¡Turno agendado con éxito para ${payload.client_name} a las ${apptTime} hs!`, 'success');
      }

      // Actualizar fecha seleccionada para ver el turno en la agenda
      this._selectedDate = apptDate;

      // Redirigir a la pestaña de Agenda
      await this.switchTab('agenda');
    } catch (err) {
      console.error("Error al guardar turno:", err);
      if (typeof Toast !== 'undefined') Toast.show(err.message || 'Error al guardar el turno', 'danger');
    }
  },

  /* ── MODAL: NUEVO / EDITAR RESPONSABLE ── */
  openNewProfModal() {
    this._renderProfFormModal(null);
  },

  async openEditProfModal(profId) {
    const profs = await DB.getTurnosProfessionals();
    const p = profs.find(x => x.id === profId);
    if (!p) return;
    this._renderProfFormModal(p);
  },

  _renderProfFormModal(prof = null) {
    Modal.open(`
      <h2 class="modal-title">${prof ? '✏️ Editar Responsable' : '➕ Nuevo Responsable / Profesional'}</h2>
      <p class="text-muted" style="margin-top:-0.8rem; margin-bottom:1.25rem; font-size:0.85rem;">
        ${prof ? 'Modifica los datos del integrante del equipo.' : 'Agrega un integrante del equipo para asignarle turnos.'}
      </p>
      <form onsubmit="TurnosModule.saveProf(event, '${prof?.id || ''}')">
        <div class="form-row">
          <div class="form-group">
            <label>Nombre *</label>
            <input id="np-first" name="first_name" class="form-input" required placeholder="Ej: Carlos" value="${Utils.escHtml(prof?.first_name || '')}">
          </div>
          <div class="form-group">
            <label>Apellido</label>
            <input id="np-last" name="last_name" class="form-input" placeholder="Ej: Gómez" value="${Utils.escHtml(prof?.last_name || '')}">
          </div>
        </div>
        <div class="form-group">
          <label>Teléfono (Opcional)</label>
          <input id="np-phone" name="phone" class="form-input" placeholder="Ej: 11 2345-6789" value="${Utils.escHtml(prof?.phone || '')}">
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">${prof ? 'Guardar Cambios' : 'Guardar Responsable'}</button>
        </div>
      </form>`);
  },

  async saveProf(e, profId = null) {
    e.preventDefault();
    const f = e.target;
    const firstName = f.first_name.value.trim();
    const lastName = f.last_name.value.trim();
    const phone = f.phone.value.trim();

    try {
      await DB.saveTurnosProfessional({
        id: profId || null,
        first_name: firstName,
        last_name: lastName,
        phone: phone,
        active: true
      });

      Modal.close();
      if (typeof Toast !== 'undefined') Toast.show(`Responsable ${firstName} ${profId ? 'actualizado' : 'creado'} con éxito`, 'success');
      await this.render(document.getElementById('content'), this._activeTab);
    } catch (err) {
      console.error("Error al guardar responsable:", err);
      if (typeof Toast !== 'undefined') Toast.show('Error al guardar responsable', 'danger');
    }
  },

  async deleteProfPrompt(profId) {
    if (!confirm('¿Estás seguro de eliminar este responsable?')) return;
    try {
      await DB.deleteTurnosProfessional(profId);
      if (typeof Toast !== 'undefined') Toast.show('Responsable eliminado', 'info');
      await this.render(document.getElementById('content'), this._activeTab);
    } catch (err) {
      console.error("Error al eliminar responsable:", err);
      if (typeof Toast !== 'undefined') Toast.show('Error al eliminar', 'danger');
    }
  },

  /* ── MODAL: NUEVO / EDITAR SERVICIO ── */
  openNewServiceModal() {
    this._renderServiceFormModal(null);
  },

  async openEditServiceModal(serviceId) {
    const services = await DB.getTurnosServices();
    const s = services.find(x => x.id === serviceId);
    if (!s) return;
    this._renderServiceFormModal(s);
  },

  _renderServiceFormModal(service = null) {
    Modal.open(`
      <h2 class="modal-title">${service ? '✏️ Editar Servicio' : '💼 Nuevo Servicio'}</h2>
      <p class="text-muted" style="margin-top:-0.8rem; margin-bottom:1.25rem; font-size:0.85rem;">
        ${service ? 'Modifica el nombre, precio o duración predeterminada del servicio.' : 'Define el nombre, precio y duración predeterminada.'}
      </p>
      <form onsubmit="TurnosModule.saveService(event, '${service?.id || ''}')">
        <div class="form-group">
          <label>Nombre del Servicio *</label>
          <input id="ns-name" name="name" class="form-input" required placeholder="Ej: Corte y Barba, Masaje..." value="${Utils.escHtml(service?.name || '')}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Precio Predeterminado ($) *</label>
            <input id="ns-price" name="price" type="number" step="0.01" min="0" class="form-input" required placeholder="0.00" value="${service?.price || 0}">
          </div>
          <div class="form-group">
            <label>Duración Predeterminada (Minutos) *</label>
            <input id="ns-duration" name="duration_minutes" type="number" step="5" min="5" value="${service?.duration_minutes || 30}" class="form-input" required placeholder="30">
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">${service ? 'Guardar Cambios' : 'Guardar Servicio'}</button>
        </div>
      </form>`);
  },

  async saveService(e, serviceId = null) {
    e.preventDefault();
    const f = e.target;
    const name = f.name.value.trim();
    const price = parseFloat(f.price.value) || 0;
    const duration = parseInt(f.duration_minutes.value) || 30;

    try {
      await DB.saveTurnosService({
        id: serviceId || null,
        name: name,
        price: price,
        duration_minutes: duration,
        active: true
      });

      Modal.close();
      if (typeof Toast !== 'undefined') Toast.show(`Servicio "${name}" ${serviceId ? 'actualizado' : 'creado'} con éxito`, 'success');
      await this.render(document.getElementById('content'), this._activeTab);
    } catch (err) {
      console.error("Error al guardar servicio:", err);
      if (typeof Toast !== 'undefined') Toast.show('Error al guardar servicio', 'danger');
    }
  },

  async deleteServicePrompt(serviceId) {
    if (!confirm('¿Estás seguro de eliminar este servicio?')) return;
    try {
      await DB.deleteTurnosService(serviceId);
      if (typeof Toast !== 'undefined') Toast.show('Servicio eliminado', 'info');
      await this.render(document.getElementById('content'), this._activeTab);
    } catch (err) {
      console.error("Error al eliminar servicio:", err);
      if (typeof Toast !== 'undefined') Toast.show('Error al eliminar', 'danger');
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
