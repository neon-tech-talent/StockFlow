const App = {
    go(page) { location.hash = page; },

    init() {
        window.addEventListener('hashchange', () => this._route());
        this._route();
    },

    async _route() {
        const page = location.hash.slice(1) || 'stock';
        const titles = { stock: 'Gestión de Stock', caja: 'Control de Caja', sales: 'Módulo de Ventas', 'new-sale': 'Nueva Venta', clients: 'Clientes', stats: 'Estadísticas' };
        document.getElementById('page-title').textContent = titles[page] || page;
        document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', (n.dataset.page === page || n.id === 'nav-'+page)));
        const content = document.getElementById('content');
        content.innerHTML = '<div class="empty-state">Cargando...</div>';
        StatsModule._destroyCharts?.();
        switch (page) {
            case 'stock': await StockModule.render(content); break;
            case 'caja': await CajaModule.render(content); break;
            case 'sales': await SalesModule.renderHistory(content); break;
            case 'new-sale': await SalesModule.renderNewSale(content); break;
            case 'clients': await ClientsModule.render(content); break;
            case 'stats': await StatsModule.render(content); break;
            default: await StockModule.render(content);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
