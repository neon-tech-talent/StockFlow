// Mapa de emojis para cada tipo de empresa
const LOGO_EMOJIS = {
  panaderia:    '🍞',
  comida:       '🍽️',
  perfumes:     '🌸',
  deportes:     '⚽',
  herramientas: '🔧',
  informatica:  '💻',
  almacen:      '🛒',
  ropa:         '👗',
  farmacia:     '💊',
  joyeria:      '💍',
  flores:       '🌺',
  general:      '🏪',
};

const App = {
  go(page) { location.hash = page; },

  async init() {
    // 1. Verificar sesión
    const session = Auth.requireLogin();
    if (!session) return;

    // 2. Cargar perfil y configurar sidebar
    await this._loadSidebar(session);

    // 3. Iniciar routing
    window.addEventListener('hashchange', () => this._route());
    this._route();
  },

  async _loadSidebar(session) {
    // Mostrar usuario
    const usernameEl = document.getElementById('sidebar-username');
    if (usernameEl) usernameEl.textContent = `👤 ${session.username}`;

    if (session.role === 'superadmin') {
      // Superadmin: sidebar simple, solo panel de admins
      document.getElementById('sidebar-system-name').innerHTML =
        `FlowStock<br><small style="font-size:.7rem;color:var(--accent-dim);text-transform:none;letter-spacing:.05em;">Superadministrador</small>`;
      document.getElementById('sidebar-logo-icon').textContent = '⚙️';
      document.getElementById('sidebar-nav').innerHTML = `
        <div class="nav-item active" data-page="superadmin" onclick="App.go('superadmin')">
          <span class="nav-icon">👥</span><span>Administradores</span>
        </div>`;
      return;
    }

    // Admin: cargar perfil desde Supabase
    const supabaseUrl = window.SUPABASE_URL || '';
    const supabaseKey = window.SUPABASE_KEY || '';
    let _sb = null;
    try {
      if (supabaseUrl && supabaseKey) _sb = supabase.createClient(supabaseUrl, supabaseKey);
    } catch(e) {}

    let systemName = 'Mi Sistema';
    let logoType   = 'general';

    if (_sb) {
      const { data: profile } = await _sb
        .from('admin_profiles')
        .select('system_name, logo_type, is_configured')
        .eq('admin_id', session.id)
        .single();

      if (profile) {
        if (!profile.is_configured) {
          window.location.href = 'onboarding.html';
          return;
        }
        systemName = profile.system_name || 'Mi Sistema';
        logoType   = profile.logo_type || 'general';
      }
    }

    // Actualizar título de la pestaña
    document.title = `${systemName} — FlowStock`;

    // Actualizar sidebar: logo.png para 'imagen', emoji para el resto
    const logoEl = document.getElementById('sidebar-logo-icon');
    if (logoType === 'imagen') {
      logoEl.innerHTML = `<img src="logo.png" alt="${systemName}" style="width:80px;height:80px;object-fit:cover;border-radius:50%;border:1px solid var(--accent-dim);padding:4px;background:var(--bg-main);box-shadow:0 8px 32px rgba(0,0,0,0.4);" onerror="this.style.display='none'">`;
      logoEl.style.fontSize = 'unset';
    } else {
      logoEl.textContent = LOGO_EMOJIS[logoType] || '🏪';
    }
    document.getElementById('sidebar-system-name').innerHTML =
      `${systemName.toUpperCase()}<br><small style="font-size:.7rem;color:var(--accent-dim);text-transform:none;letter-spacing:.05em;">Gestión de negocio</small>`;

    // Verificar si el módulo de turnos está habilitado para el tenant
    const turnosEnabled = await DB.isModuleEnabled('turnos');

    // Navegación normal de admin
    document.getElementById('sidebar-nav').innerHTML = `
      <div class="nav-item" id="nav-stock" onclick="location.hash='#stock'"><span class="nav-icon">📦</span><span>Stock</span></div>
      <div class="nav-item" id="nav-caja" onclick="location.hash='#caja'"><span class="nav-icon">💸</span><span>Caja</span></div>
      <div class="nav-item" id="nav-sales" onclick="location.hash='#sales'"><span class="nav-icon">📜</span><span>Ventas</span></div>
      <div class="nav-item" data-page="new-sale" onclick="App.go('new-sale')"><span class="nav-icon">➕</span><span>Nueva Venta</span></div>
      ${turnosEnabled ? '<div class="nav-item" id="nav-turnos" onclick="location.hash=\'#turnos\'"><span class="nav-icon">📅</span><span>Turnos</span></div>' : ''}
      <div class="nav-item" data-page="clients" onclick="App.go('clients')"><span class="nav-icon">👥</span><span>Clientes</span></div>
      <div class="nav-item" data-page="stats" onclick="App.go('stats')"><span class="nav-icon">📊</span><span>Estadísticas</span></div>`;
  },

  async _route() {
    const session = Auth.getSession();
    if (!session) return;

    const page = location.hash.slice(1) || (session.role === 'superadmin' ? 'superadmin' : 'stock');

    const titles = {
      stock: 'Gestión de Stock',
      caja: 'Control de Caja',
      sales: 'Módulo de Ventas',
      'new-sale': 'Nueva Venta',
      turnos: 'Gestión de Turnos',
      clients: 'Clientes',
      stats: 'Estadísticas',
      superadmin: 'Panel de Administración'
    };

    document.getElementById('page-title').textContent = titles[page] || page;
    document.querySelectorAll('.nav-item').forEach(n =>
      n.classList.toggle('active', (n.dataset.page === page || n.id === 'nav-' + page))
    );

    const content = document.getElementById('content');
    content.innerHTML = typeof Utils !== 'undefined' ? Utils.skeleton(4) : '<div class="empty-state">Cargando...</div>';

    if (typeof StatsModule !== 'undefined') StatsModule._destroyCharts?.();

    if (session.role === 'superadmin') {
      await SuperAdminModule.render(content);
      return;
    }

    if (page === 'turnos' || page.startsWith('turnos')) {
      const enabled = await DB.isModuleEnabled('turnos');
      if (!enabled) {
        content.innerHTML = Utils.emptyState('🚫', 'Módulo Deshabilitado', 'El módulo de Gestión de Turnos no está activo para esta cuenta.');
        if (typeof Toast !== 'undefined') Toast.show('Módulo de Turnos deshabilitado', 'warning');
        setTimeout(() => { location.hash = '#stock'; }, 2500);
        return;
      }
      if (typeof TurnosModule !== 'undefined') {
        await TurnosModule.render(content);
      } else {
        content.innerHTML = '<div class="empty-state">Módulo de Turnos no cargado.</div>';
      }
      return;
    }

    switch (page) {
      case 'stock':    await StockModule.render(content);        break;
      case 'caja':     await CajaModule.render(content);         break;
      case 'sales':    await SalesModule.renderHistory(content); break;
      case 'new-sale': await SalesModule.renderNewSale(content); break;
      case 'clients':  await ClientsModule.render(content);      break;
      case 'stats':    await StatsModule.render(content);        break;
      default:         await StockModule.render(content);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
