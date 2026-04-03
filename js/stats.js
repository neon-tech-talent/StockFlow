const StatsModule = {
    _charts: [],

    async render(el, month, year) {
        const now = new Date();
        const m = month !== undefined ? month : now.getMonth();
        const y = year !== undefined ? year : now.getFullYear();
        const s = await DB.getStats(m, y);

        el.innerHTML = `
      <div class="module-header">
        <h2 class="card-title">Análisis de Resultados</h2>
        <div class="search-group" style="justify-content: flex-end">
          <select id="stat-month" class="select-input">
            ${Array.from({ length: 12 }, (_, i) => `<option value="${i}" ${i === m ? 'selected' : ''}>${new Date(y, i, 1).toLocaleString('es', { month: 'long' })}</option>`).join('')}
          </select>
          <select id="stat-year" class="select-input">
            ${[y - 1, y, y + 1].map(yr => `<option value="${yr}" ${yr === y ? 'selected' : ''}>${yr}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="kpi-row" style="grid-template-columns: repeat(auto-fit, minmax(230px, 1fr))">
        <div class="kpi-card">
          <div class="kpi-icon">💰</div>
          <div class="kpi-body">
            <div class="kpi-value">${Utils.currency(s.monthlyTotal)}</div>
            <div class="kpi-label">Ventas Brutas</div>
            <div class="kpi-sub">${s.monthlyCount} ventas en el mes</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon">📈</div>
          <div class="kpi-body">
            <div class="kpi-value text-success">${Utils.currency(s.grossProfit)}</div>
            <div class="kpi-label">Ganancia (S-C)</div>
            <div class="kpi-sub">Ventas menos Costos</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon">💸</div>
          <div class="kpi-body">
            <div class="kpi-value text-danger">${Utils.currency(s.totalExpenses)}</div>
            <div class="kpi-label">Gastos Mensuales</div>
            <div class="kpi-sub">Gastos externos registrados</div>
          </div>
        </div>
        <div class="kpi-card" style="border-color: var(--accent); background: var(--accent-glow)">
          <div class="kpi-icon">🏆</div>
          <div class="kpi-body">
            <div class="kpi-value">${Utils.currency(s.netProfit)}</div>
            <div class="kpi-label" style="color: var(--accent)">GANANCIA NETA</div>
            <div class="kpi-sub" style="color: var(--accent-dim)">Margen final del mes</div>
          </div>
        </div>
      </div>

      <div class="charts-grid">
        <div class="chart-card">
          <h3 class="card-title">📊 Evolución Ventas (12 meses)</h3>
          <canvas id="chart-monthly"></canvas>
        </div>
        <div class="chart-card">
          <h3 class="card-title">🏆 Top 5 Más Vendidos (unidades)</h3>
          <canvas id="chart-top-prods"></canvas>
        </div>
      </div>

      <div class="charts-grid" style="margin-top:1rem">
        <div class="chart-card">
          <h3 class="card-title">💎 Productos con Mejor Margen</h3>
          <canvas id="chart-profitable"></canvas>
        </div>
        <div class="chart-card">
          <h3 class="card-title">👥 Mejores Clientes</h3>
          <div id="client-table-stats"></div>
        </div>
      </div>`;

        this._destroyCharts();
        this._buildCharts(s);

        document.getElementById('stat-month').onchange = async (e) => await this.render(el, parseInt(e.target.value), parseInt(document.getElementById('stat-year').value));
        document.getElementById('stat-year').onchange = async (e) => await this.render(el, parseInt(document.getElementById('stat-month').value), parseInt(e.target.value));
    },

    _destroyCharts() {
        this._charts.forEach(c => { try { c.destroy(); } catch (e) { } });
        this._charts = [];
    },

    _buildCharts(s) {
        const accent = '#c8a96e'; const accent2 = '#8db87a'; const gridClr = 'rgba(232,220,196,0.08)'; const textClr = '#b8a98a';
        const defaults = {
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: textClr, font: { size: 11 } }, grid: { color: gridClr } },
                y: { beginAtZero: true, ticks: { color: textClr, font: { size: 11 }, callback: v => '$' + new Intl.NumberFormat('es-AR', { notation: 'compact' }).format(v) }, grid: { color: gridClr } }
            }
        };

        const ctx1 = document.getElementById('chart-monthly');
        if (ctx1) { this._charts.push(new Chart(ctx1, { type: 'line', data: { labels: s.monthlyData.map(d => d.label), datasets: [{ data: s.monthlyData.map(d => d.total), borderColor: accent, backgroundColor: 'rgba(200,169,110,0.15)', fill: true, pointBackgroundColor: accent }] }, options: { ...defaults } })); }

        const ctx2 = document.getElementById('chart-top-prods');
        if (ctx2 && s.topProducts.length) {
            this._charts.push(new Chart(ctx2, {
                type: 'bar', data: { labels: s.topProducts.map(p => p.name), datasets: [{ data: s.topProducts.map(p => p.units), backgroundColor: accent, borderRadius: 6 }] },
                options: { ...defaults, scales: { ...defaults.scales, y: { ...defaults.scales.y, ticks: { ...defaults.scales.y.ticks, precision: 0, stepSize: 1, callback: v => v + ' u.' } } } }
            }));
        }

        const ctx3 = document.getElementById('chart-profitable');
        if (ctx3 && s.topProfitable.length) { this._charts.push(new Chart(ctx3, { type: 'bar', data: { labels: s.topProfitable.map(p => p.name), datasets: [{ data: s.topProfitable.map(p => p.profit), backgroundColor: accent2, borderRadius: 6 }] }, options: { ...defaults } })); }

        const ct = document.getElementById('client-table-stats');
        if (ct) {
            if (!s.topClients.length) { ct.innerHTML = '<div class="empty-state">Sin datos</div>'; }
            else ct.innerHTML = `<table class="data-table"><thead><tr><th>#</th><th>Cliente</th><th>Total</th></tr></thead><tbody>${s.topClients.map((c, i) => `<tr><td><span class="badge badge-info">${i + 1}</span></td><td>${Utils.escHtml(c.name)}</td><td><strong>${Utils.currency(c.total)}</strong></td></tr>`).join('')}</tbody></table>`;
        }
    }
};
