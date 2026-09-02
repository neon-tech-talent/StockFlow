const SuperAdminModule = {

  async render(container) {
    const session = Auth.getSession();

    const supabaseUrl = window.SUPABASE_URL || '';
    const supabaseKey = window.SUPABASE_KEY || '';
    let _sb = null;
    try {
      if (supabaseUrl && supabaseKey) _sb = supabase.createClient(supabaseUrl, supabaseKey);
    } catch(e) {}

    container.innerHTML = `
      <div style="max-width:700px;margin:0 auto;">
        <div style="margin-bottom:1.5rem;">
          <h2 style="font-family:'Playfair Display',serif;font-size:1.4rem;color:var(--accent);margin-bottom:.3rem;">Panel de Administración</h2>
          <p style="font-size:.85rem;color:var(--text-muted);">Gestioná los administradores del sistema FlowStock.</p>
        </div>

        <div class="card" style="margin-bottom:1.25rem;">
          <div class="card-title">➕ Crear nuevo administrador</div>
          <div class="form-row" style="margin-bottom:.75rem;">
            <div class="form-group" style="margin:0;">
              <label>Usuario</label>
              <input id="new-username" class="form-input" type="text" placeholder="ej: admin01">
            </div>
            <div class="form-group" style="margin:0;">
              <label>Contraseña</label>
              <input id="new-password" class="form-input" type="text" placeholder="ej: 1234">
            </div>
          </div>
          <div id="create-error" style="color:#e07070;font-size:.82rem;margin-bottom:.5rem;display:none;"></div>
          <button class="btn btn-primary" id="btn-create-admin">Crear Administrador</button>
        </div>

        <div class="card">
          <div class="card-title">👥 Administradores activos</div>
          <div id="admin-list"><div class="empty-state">Cargando...</div></div>
        </div>
      </div>`;

    // Cargar lista de admins
    const loadAdmins = async () => {
      const listEl = document.getElementById('admin-list');
      if (!_sb) { listEl.innerHTML = '<div class="empty-state">Base de datos no configurada.</div>'; return; }

      const { data, error } = await _sb
        .from('admin_users')
        .select('id, username, role, active, created_at')
        .order('created_at', { ascending: false });

      if (error || !data || data.length === 0) {
        listEl.innerHTML = '<div class="empty-state">No hay administradores.</div>';
        return;
      }

      // Cargar perfiles y estado de módulos
      const { data: profiles } = await _sb.from('admin_profiles').select('admin_id, system_name, is_configured');
      const { data: modules } = await _sb.from('admin_modules').select('admin_id, module_key, enabled');
      
      const profileMap = {};
      (profiles || []).forEach(p => { profileMap[p.admin_id] = p; });

      const moduleMap = {};
      (modules || []).forEach(m => {
        if (!moduleMap[m.admin_id]) moduleMap[m.admin_id] = {};
        moduleMap[m.admin_id][m.module_key] = m.enabled;
      });

      const rows = data.map(u => {
        const prof = profileMap[u.id];
        const sysName = prof?.is_configured ? Utils.escHtml(prof.system_name) : '<em style="color:var(--text-dim)">Sin configurar</em>';
        const isSelf  = u.username === 'tutuca';
        const turnosEnabled = moduleMap[u.id]?.turnos !== false;

        return `
          <tr>
            <td><strong>${Utils.escHtml(u.username)}</strong></td>
            <td>${u.role === 'superadmin' ? '<span class="badge badge-warning">Superadmin</span>' : '<span class="badge badge-info">Admin</span>'}</td>
            <td>${sysName}</td>
            <td>
              <button class="btn btn-sm ${turnosEnabled ? 'btn-primary' : 'btn-outline'}" style="font-size:0.78rem;padding:0.3rem 0.6rem;" onclick="SuperAdminModule.toggleModule('${u.id}', 'turnos', ${turnosEnabled})">
                ${turnosEnabled ? '📅 Turnos: Activo' : '🚫 Turnos: Inactivo'}
              </button>
            </td>
            <td>${u.active ? '<span class="badge badge-success">Activo</span>' : '<span class="badge badge-danger">Inactivo</span>'}</td>
            <td>${isSelf ? '' : `<button class="btn-icon danger" title="${u.active ? 'Desactivar' : 'Activar'}" onclick="SuperAdminModule.toggleAdmin('${u.id}', ${u.active})">${u.active ? '🚫' : '✅'}</button>`}</td>
          </tr>`;
      }).join('');

      listEl.innerHTML = `
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th>Usuario</th><th>Rol</th><th>Sistema</th><th>Módulos</th><th>Estado</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    };

    await loadAdmins();

    // Crear admin
    document.getElementById('btn-create-admin').addEventListener('click', async () => {
      const username  = document.getElementById('new-username').value.trim().toLowerCase();
      const password  = document.getElementById('new-password').value.trim();
      const errEl = document.getElementById('create-error');

      errEl.style.display = 'none';

      if (!username || !password) {
        errEl.textContent = 'Completá usuario y contraseña.';
        errEl.style.display = 'block';
        return;
      }

      if (!_sb) { errEl.textContent = 'BD no configurada.'; errEl.style.display = 'block'; return; }

      const btn = document.getElementById('btn-create-admin');
      btn.disabled = true;
      btn.textContent = 'Creando...';

      const { error } = await _sb.from('admin_users').insert({ username, password, role: 'admin' });

      if (error) {
        errEl.textContent = error.code === '23505' ? 'Ese usuario ya existe.' : 'Error al crear administrador.';
        errEl.style.display = 'block';
      } else {
        document.getElementById('new-username').value = '';
        document.getElementById('new-password').value = '';
        if (typeof Toast !== 'undefined') Toast.show('Administrador creado con éxito', 'success');
        await loadAdmins();
      }

      btn.disabled = false;
      btn.textContent = 'Crear Administrador';
    });
  },

  async toggleAdmin(id, currentActive) {
    const supabaseUrl = window.SUPABASE_URL || '';
    const supabaseKey = window.SUPABASE_KEY || '';
    let _sb = null;
    try {
      if (supabaseUrl && supabaseKey) _sb = supabase.createClient(supabaseUrl, supabaseKey);
    } catch(e) {}
    if (!_sb) return;
    await _sb.from('admin_users').update({ active: !currentActive }).eq('id', id);
    if (typeof Toast !== 'undefined') Toast.show('Estado de administrador actualizado', 'info');
    await SuperAdminModule.render(document.getElementById('content'));
  },

  async toggleModule(adminId, moduleKey, currentEnabled) {
    const newStatus = !currentEnabled;
    await DB.setModuleEnabled(adminId, moduleKey, newStatus);
    if (typeof Toast !== 'undefined') {
      Toast.show(`Módulo ${moduleKey} ${newStatus ? 'HABILITADO' : 'DESHABILITADO'} para la cuenta`, newStatus ? 'success' : 'warning');
    }
    await SuperAdminModule.render(document.getElementById('content'));
  }
};
