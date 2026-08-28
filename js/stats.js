const StatsModule = {
    _charts: [],

    _destroyCharts() {
        if (Array.isArray(this._charts)) {
            this._charts.forEach(c => {
                try {
                    if (c && typeof c.destroy === 'function') {
                        c.destroy();
                    }
                } catch (e) {
                    console.warn("Chart destroy warning:", e);
                }
            });
        }
        this._charts = [];
    },

    async render(el, month, year) {
        if (!el) el = document.getElementById('content');
        if (!el) return;

        // 1. Destruir gráficos anteriores ANTES de modificar el DOM para evitar fugas y errores de Chart.js
        this._destroyCharts();

        const now = new Date();
        const m = (month !== undefined && month !== null && !isNaN(month)) ? parseInt(month) : now.getMonth();
        const y = (year !== undefined && year !== null && !isNaN(year)) ? parseInt(year) : now.getFullYear();

        try {
            const s = await DB.getStats(m, y);

            // Generar lista de años dinámicos
            const curYear = now.getFullYear();
            const yearList = [curYear - 2, curYear - 1, curYear, curYear + 1];
            if (!yearList.includes(y)) {
                yearList.push(y);
                yearList.sort((a, b) => a - b);
            }

            const monthNames = Array.from({ length: 12 }, (_, i) => {
                const raw = new Date(y, i, 1).toLocaleString('es', { month: 'long' });
                return raw.charAt(0).toUpperCase() + raw.slice(1);
            });

            const selectedMonthName = monthNames[m] || 'Mes';

            el.innerHTML = `
      <div class="module-header">
        <h2 class="card-title">Análisis de Resultados</h2>
        <div class="search-group" style="justify-content: flex-end; gap: .5rem; flex-wrap: wrap;">
          <select id="stat-month" class="select-input">
            ${monthNames.map((name, i) => `<option value="${i}" ${i === m ? 'selected' : ''}>${name}</option>`).join('')}
          </select>
          <select id="stat-year" class="select-input">
            ${yearList.map(yr => `<option value="${yr}" ${yr === y ? 'selected' : ''}>${yr}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="kpi-row" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-bottom: 1.25rem;">
        <div class="kpi-card">
          <div class="kpi-icon">💰</div>
          <div class="kpi-body">
            <div class="kpi-value">${Utils.currency(s.monthlyTotal || 0)}</div>
            <div class="kpi-label">Ventas Brutas</div>
            <div class="kpi-sub">${s.monthlyCount || 0} ventas en el mes</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon">🧾</div>
          <div class="kpi-body">
            <div class="kpi-value" style="color:#8b5cf6">${Utils.currency(s.invoicedTotal || 0)}</div>
            <div class="kpi-label">Total Facturado</div>
            <div class="kpi-sub">Ventas con factura</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon">📈</div>
          <div class="kpi-body">
            <div class="kpi-value text-success">${Utils.currency(s.grossProfit || 0)}</div>
            <div class="kpi-label">Ganancia (S-C)</div>
            <div class="kpi-sub">Ventas menos Costos</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon">💸</div>
          <div class="kpi-body">
            <div class="kpi-value text-danger">${Utils.currency(s.totalExpenses || 0)}</div>
            <div class="kpi-label">Gastos Mensuales</div>
            <div class="kpi-sub">Gastos externos registrados</div>
          </div>
        </div>
        <div class="kpi-card" style="border-color: var(--accent); background: var(--accent-glow)">
          <div class="kpi-icon">🏆</div>
          <div class="kpi-body">
            <div class="kpi-value">${Utils.currency(s.netProfit || 0)}</div>
            <div class="kpi-label" style="color: var(--accent)">GANANCIA NETA</div>
            <div class="kpi-sub" style="color: var(--accent-dim)">Margen final del mes</div>
          </div>
        </div>
      </div>

      <div class="charts-grid">
        <div class="chart-card">
          <h3 class="card-title">📊 Evolución Ventas (Últimos 12 meses)</h3>
          <div style="position: relative; height: 250px; width: 100%;">
            <canvas id="chart-monthly"></canvas>
          </div>
        </div>
        <div class="chart-card">
          <h3 class="card-title">🏆 Top 5 Más Vendidos (unidades)</h3>
          <div id="container-top-prods" style="position: relative; height: 250px; width: 100%;">
            <canvas id="chart-top-prods"></canvas>
          </div>
        </div>
      </div>

      <div class="charts-grid" style="margin-top:1rem">
        <div class="chart-card">
          <h3 class="card-title">💎 Productos con Mejor Margen</h3>
          <div id="container-profitable" style="position: relative; height: 250px; width: 100%;">
            <canvas id="chart-profitable"></canvas>
          </div>
        </div>
        <div class="chart-card">
          <h3 class="card-title">👥 Mejores Clientes</h3>
          <div id="client-table-stats" style="position: relative; height: 250px; width: 100%; overflow-y: auto;"></div>
        </div>
      </div>

      <div class="charts-grid" style="margin-top:1rem">
        <div class="chart-card" style="grid-column: 1 / -1">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:.75rem; flex-wrap:wrap; gap:.5rem;">
            <h3 class="card-title" style="margin:0">⏰ Ventas por Horario (${selectedMonthName} ${y})</h3>
            <span class="text-muted" style="font-size:0.85rem">Distribución horaria (00:00 - 23:00)</span>
          </div>
          <div style="position: relative; height: 260px; width: 100%;">
            <canvas id="chart-hourly"></canvas>
          </div>
        </div>
      </div>`;

            this._buildCharts(s);

            const selM = document.getElementById('stat-month');
            const selY = document.getElementById('stat-year');
            if (selM) {
                selM.onchange = async (e) => {
                    const newM = parseInt(e.target.value);
                    const newY = parseInt(document.getElementById('stat-year')?.value || y);
                    await this.render(el, newM, newY);
                };
            }
            if (selY) {
                selY.onchange = async (e) => {
                    const newM = parseInt(document.getElementById('stat-month')?.value || m);
                    const newY = parseInt(e.target.value);
                    await this.render(el, newM, newY);
                };
            }

        } catch (err) {
            console.error("Error al renderizar módulo de estadísticas:", err);
            el.innerHTML = `
        <div class="card" style="text-align:center; padding:3rem 1.5rem;">
          <div style="font-size:2.5rem; margin-bottom:1rem;">⚠️</div>
          <h3 style="color:var(--accent); margin-bottom:.5rem;">Error al cargar estadísticas</h3>
          <p class="text-muted" style="max-width:500px; margin:0 auto 1.5rem;">No se pudieron cargar los datos del período seleccionado. Verificá tu conexión a la base de datos.</p>
          <button class="btn btn-primary" onclick="StatsModule.render(document.getElementById('content'))">🔄 Reintentar</button>
        </div>`;
        }
    },

    _buildCharts(s) {
        if (typeof Chart === 'undefined') {
            console.error("Chart.js no está cargado");
            return;
        }

        const accent = '#c8a96e'; 
        const accent2 = '#8db87a'; 
        const gridClr = 'rgba(232,220,196,0.08)'; 
        const textClr = '#b8a98a';

        const defaults = {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(23, 31, 24, 0.95)',
                    titleColor: accent,
                    bodyColor: '#e8dcc4',
                    borderColor: 'rgba(200, 169, 110, 0.3)',
                    borderWidth: 1,
                    padding: 10,
                    cornerRadius: 8
                }
            },
            scales: {
                x: {
                    ticks: { color: textClr, font: { size: 11 } },
                    grid: { color: gridClr }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: textClr,
                        font: { size: 11 },
                        callback: v => '$' + new Intl.NumberFormat('es-AR', { notation: 'compact' }).format(v)
                    },
                    grid: { color: gridClr }
                }
            }
        };

        // 1. Gráfico de Evolución Mensual
        const ctx1 = document.getElementById('chart-monthly');
        if (ctx1) {
            const mData = Array.isArray(s.monthlyData) ? s.monthlyData : [];
            this._charts.push(new Chart(ctx1, {
                type: 'line',
                data: {
                    labels: mData.map(d => d.label),
                    datasets: [{
                        label: 'Ventas totales',
                        data: mData.map(d => d.total || 0),
                        borderColor: accent,
                        backgroundColor: 'rgba(200,169,110,0.15)',
                        fill: true,
                        pointBackgroundColor: accent,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        tension: 0.25
                    }]
                },
                options: { ...defaults }
            }));
        }

        // 2. Gráfico Top Productos
        const contTop = document.getElementById('container-top-prods');
        const ctx2 = document.getElementById('chart-top-prods');
        if (Array.isArray(s.topProducts) && s.topProducts.length > 0 && ctx2) {
            this._charts.push(new Chart(ctx2, {
                type: 'bar',
                data: {
                    labels: s.topProducts.map(p => p.name),
                    datasets: [{
                        label: 'Unidades vendidas',
                        data: s.topProducts.map(p => p.units || 0),
                        backgroundColor: accent,
                        borderRadius: 6
                    }]
                },
                options: {
                    ...defaults,
                    scales: {
                        ...defaults.scales,
                        y: {
                            ...defaults.scales.y,
                            ticks: {
                                color: textClr,
                                font: { size: 11 },
                                precision: 0,
                                stepSize: 1,
                                callback: v => Number.isInteger(v) ? v + ' u.' : ''
                            }
                        }
                    }
                }
            }));
        } else if (contTop) {
            contTop.innerHTML = Utils.emptyState('📦', 'Sin ventas de productos en este período');
        }

        // 3. Gráfico Productos más Rentables
        const contProf = document.getElementById('container-profitable');
        const ctx3 = document.getElementById('chart-profitable');
        if (Array.isArray(s.topProfitable) && s.topProfitable.length > 0 && ctx3) {
            this._charts.push(new Chart(ctx3, {
                type: 'bar',
                data: {
                    labels: s.topProfitable.map(p => p.name),
                    datasets: [{
                        label: 'Margen acumulado',
                        data: s.topProfitable.map(p => p.profit || 0),
                        backgroundColor: accent2,
                        borderRadius: 6
                    }]
                },
                options: { ...defaults }
            }));
        } else if (contProf) {
            contProf.innerHTML = Utils.emptyState('💎', 'Sin datos de margen en este período');
        }

        // 4. Tabla de Mejores Clientes
        const ct = document.getElementById('client-table-stats');
        if (ct) {
            if (!Array.isArray(s.topClients) || !s.topClients.length) {
                ct.innerHTML = Utils.emptyState('👥', 'Sin clientes en este período');
            } else {
                ct.innerHTML = `
          <div class="table-scroll">
            <table class="data-table">
              <thead><tr><th>#</th><th>Cliente</th><th style="text-align:right">Total</th></tr></thead>
              <tbody>
                ${s.topClients.map((c, i) => `
                  <tr>
                    <td><span class="badge badge-info">${i + 1}</span></td>
                    <td><strong>${Utils.escHtml(c.name || 'Consumidor Final')}</strong></td>
                    <td style="text-align:right"><strong>${Utils.currency(c.total || 0)}</strong></td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>`;
            }
        }

        // 5. Gráfico de Ventas por Horario
        const ctx4 = document.getElementById('chart-hourly');
        if (ctx4) {
            const hData = Array.isArray(s.hourlyData) && s.hourlyData.length === 24 
                ? s.hourlyData 
                : Array(24).fill(0);

            this._charts.push(new Chart(ctx4, {
                type: 'bar',
                data: {
                    labels: Array.from({ length: 24 }, (_, i) => `${i}hs`),
                    datasets: [{
                        label: 'Cantidad de ventas',
                        data: hData,
                        backgroundColor: accent,
                        borderRadius: 4
                    }]
                },
                options: {
                    ...defaults,
                    scales: {
                        ...defaults.scales,
                        y: {
                            ...defaults.scales.y,
                            ticks: {
                                color: textClr,
                                font: { size: 11 },
                                precision: 0,
                                stepSize: 1,
                                callback: v => Number.isInteger(v) ? v + ' v.' : ''
                            }
                        }
                    }
                }
            }));
        }
    }
};
