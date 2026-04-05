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
    let logoEmoji  = '🏪';

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
        logoEmoji  = LOGO_EMOJIS[profile.logo_type] || '🏪';
      }
    }

    // Actualizar título de la pestaña
    document.title = `${systemName} — FlowStock`;

    // Actualizar sidebar
    document.getElementById('sidebar-logo-icon').textContent = logoEmoji;
    document.getElementById('sidebar-system-name').innerHTML =
      `${systemName.toUpperCase()}<br><small style="font-size:.7rem;color:var(--accent-dim);text-transform:none;letter-spacing:.05em;">Gestión de negocio</small>`;

    // Navegación normal de admin
    document.getElementById('sidebar-nav').innerHTML = `
      <div class="nav-item" id="nav-stock" onclick="location.hash='#stock'"><span class="nav-icon">📦</span><span>Stock</span></div>
      <div class="nav-item" id="nav-caja" onclick="location.hash='#caja'"><span class="nav-icon">💸</span><span>Caja</span></div>
      <div class="nav-item" id="nav-sales" onclick="location.hash='#sales'"><span class="nav-icon">📜</span><span>Ventas</span></div>
      <div class="nav-item" data-page="new-sale" onclick="App.go('new-sale')"><span class="nav-icon">➕</span><span>Nueva Venta</span></div>
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
      clients: 'Clientes',
      stats: 'Estadísticas',
      superadmin: 'Panel de Administración'
    };

    document.getElementById('page-title').textContent = titles[page] || page;
    document.querySelectorAll('.nav-item').forEach(n =>
      n.classList.toggle('active', (n.dataset.page === page || n.id === 'nav-' + page))
    );

    const content = document.getElementById('content');
    content.innerHTML = '<div class="empty-state">Cargando...</div>';

    if (typeof StatsModule !== 'undefined') StatsModule._destroyCharts?.();

    if (session.role === 'superadmin') {
      await SuperAdminModule.render(content);
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
