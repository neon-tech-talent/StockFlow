const SalesModule = {
    cart: [],
    paymentType: 'efectivo',
    selectedClientId: null,
    selectedClientName: null,

    historyMonth: new Date().getMonth(),
    historyYear: new Date().getFullYear(),

    async renderHistory(el) {
        const allSales = await DB.getSales();
        const filtered = allSales.filter(s => {
            const ym = Utils.getArgentinaYearMonth(new Date(s.created_at));
            return ym.month === this.historyMonth && ym.year === this.historyYear;
        });

        const totals = { efectivo: 0, transferencia: 0, cuenta_corriente: 0, qr: 0, debito: 0, credito: 0 };
        filtered.filter(s => !s.voided).forEach(s => {
            if (totals[s.payment_type] !== undefined) totals[s.payment_type] += parseFloat(s.total || 0);
        });

        const currentYr = new Date().getFullYear();
        const yearOptions = [currentYr - 2, currentYr - 1, currentYr, currentYr + 1];
        if (!yearOptions.includes(this.historyYear)) {
            yearOptions.push(this.historyYear);
            yearOptions.sort((a, b) => a - b);
        }

        el.innerHTML = `
      <div class="module-header">
        <h2 class="card-title">Histórico de Ventas</h2>
        <div style="display:flex; gap:.5rem; flex-wrap: wrap;">
           <select class="form-input" onchange="SalesModule.setHistoryFilter(this.value, null)">
             ${Array.from({ length: 12 }, (_, i) => {
               const raw = new Date(2000, i).toLocaleString('es', { month: 'long' });
               return `<option value="${i}" ${i === this.historyMonth ? 'selected' : ''}>${raw.charAt(0).toUpperCase() + raw.slice(1)}</option>`;
             }).join('')}
           </select>
           <select class="form-input" onchange="SalesModule.setHistoryFilter(null, this.value)">
             ${yearOptions.map(y => `<option value="${y}" ${y === this.historyYear ? 'selected' : ''}>${y}</option>`).join('')}
           </select>
           <button class="btn btn-outline" onclick="SalesModule.openExportModal()" title="Extraer ventas por día o período a Excel" style="display:inline-flex; align-items:center; gap:0.4rem;">📥 Extraer Ventas</button>
           <button class="btn btn-primary" onclick="App.go('new-sale')">+ Nueva Venta</button>
        </div>
      </div>

      <div class="kpi-row" style="margin-bottom: 1.5rem">
        <div class="kpi-card" style="border-left: 4px solid var(--accent)">
          <div class="kpi-header">
            <span class="kpi-label">Efectivo</span>
            <div class="kpi-icon" aria-hidden="true">💵</div>
          </div>
          <div class="kpi-body">
            <div class="kpi-value" style="color:var(--accent)" title="${Utils.currency(totals.efectivo)}">${Utils.currency(totals.efectivo)}</div>
          </div>
        </div>
        <div class="kpi-card" style="border-left: 4px solid #3b82f6">
          <div class="kpi-header">
            <span class="kpi-label">Transf / QR</span>
            <div class="kpi-icon" aria-hidden="true">📱</div>
          </div>
          <div class="kpi-body">
            <div class="kpi-value" style="color:#3b82f6" title="${Utils.currency(totals.transferencia + totals.qr)}">${Utils.currency(totals.transferencia + totals.qr)}</div>
          </div>
        </div>
        <div class="kpi-card" style="border-left: 4px solid #ef4444">
          <div class="kpi-header">
            <span class="kpi-label">Tarjetas (D+C)</span>
            <div class="kpi-icon" aria-hidden="true">💳</div>
          </div>
          <div class="kpi-body">
            <div class="kpi-value" style="color:#ef4444" title="${Utils.currency(totals.debito + totals.credito)}">${Utils.currency(totals.debito + totals.credito)}</div>
          </div>
        </div>
        <div class="kpi-card" style="border-left: 4px solid #10b981">
          <div class="kpi-header">
            <span class="kpi-label">Cta. Corriente</span>
            <div class="kpi-icon" aria-hidden="true">📒</div>
          </div>
          <div class="kpi-body">
            <div class="kpi-value" style="color:#10b981" title="${Utils.currency(totals.cuenta_corriente)}">${Utils.currency(totals.cuenta_corriente)}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <table class="data-table">
          <thead><tr><th>ID</th><th>Fecha</th><th>Cliente</th><th>Total</th><th>Pago</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            ${filtered.map(s => `
              <tr class="${s.voided ? 'row-voided' : ''}">
                <td>#${s.id.slice(-4)}</td>
                <td>${Utils.date(s.created_at)}</td>
                <td><strong>${Utils.escHtml(s.client_name || 'Consumidor Final')}</strong></td>
                <td><strong>${Utils.currency(s.total)}</strong></td>
                <td><span class="badge badge-info">${s.payment_type.toUpperCase()}</span></td>
                <td>
                   ${s.voided ? '<span class="badge badge-danger">ANULADA</span>' : '<span class="badge badge-success">COMPLETADA</span>'}
                   ${s.invoiced ? '<br><span class="badge" style="background:#8b5cf6; margin-top:0.3rem">FACTURADA</span>' : ''}
                </td>
                <td>
                  <button class="btn-icon" title="Ver" onclick="SalesModule.viewSale('${s.id}')">👁️</button>
                  ${!s.voided ? `<button class="btn-icon danger" title="Anular" onclick="SalesModule.voidSale('${s.id}')">🚫</button>` : ''}
                </td>
              </tr>
            `).join('') || '<tr><td colspan="7" class="empty-state">No hay ventas registradas en este período</td></tr>'}
          </tbody>
        </table>
      </div>`;
    },

    async setHistoryFilter(m, y) {
        if (m !== null) this.historyMonth = parseInt(m);
        if (y !== null) this.historyYear = parseInt(y);
        await this.renderHistory(document.getElementById('content'));
    },

    async viewSale(id) {
        const sales = await DB.getSales();
        const s = sales.find(x => x.id === id);
        const items = await DB.getSaleItems(id);
        Modal.open(`
      <h2 class="modal-title">Detalle de Venta #${id.slice(-4)}</h2>
      <div class="detail-grid">
        <div><label>Fecha</label><p>${new Date(s.created_at).toLocaleString('es')}</p></div>
        <div><label>Cliente</label><p>${Utils.escHtml(s.client_name || 'Consumidor Final')}</p></div>
        <div><label>Tipo de Pago</label><p>${s.payment_type.toUpperCase()}</p></div>
        <div><label>Estado</label><p>${s.voided ? 'ANULADA' : 'COMPLETADA'}</p></div>
      </div>
      <table class="data-table" style="margin-top:1.5rem">
        <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead>
        <tbody>
          ${items.length ? items.map(it => {
            let subtotal = it.quantity * (parseFloat(it.unit_price) || 0);
            let discountInfo = '';
            if (it.discount_type === 'percentage') {
                const descVal = subtotal * ((parseFloat(it.discount_value) || 0) / 100);
                subtotal -= descVal;
                discountInfo = `<br><small class="text-success">-${it.discount_value}% (${Utils.currency(descVal)})</small>`;
            } else if (it.discount_type === 'amount') {
                subtotal -= parseFloat(it.discount_value) || 0;
                discountInfo = `<br><small class="text-success">-${Utils.currency(it.discount_value)} desc</small>`;
            }
            return `<tr>
              <td>${Utils.escHtml(it.product_name)}${discountInfo}</td>
              <td>${it.quantity}</td>
              <td>${Utils.currency(it.unit_price)}</td>
              <td>${Utils.currency(Math.max(0, subtotal))}</td>
            </tr>`;
          }).join('') : '<tr><td colspan="4" class="empty-state" style="padding:1.25rem 0.5rem;">No se registraron ítems detallados para esta venta.</td></tr>'}
        </tbody>
        <tfoot><tr><td colspan="3" style="text-align:right"><strong>Total:</strong></td><td><strong>${Utils.currency(s.total)}</strong></td></tr></tfoot>
      </table>
      <div class="modal-actions">
        <!-- PDF button could go here -->
        <button class="btn btn-outline" onclick="Modal.close()">Cerrar</button>
      </div>`);
    },

    async voidSale(id) {
        if (confirm('¿Estás seguro de anular esta venta? El stock y saldos se restaurarán automáticamente.')) {
            await DB.voidSale(id);
            if (typeof Toast !== 'undefined') Toast.show('Venta anulada correctamente', 'info');
            await this.renderHistory(document.getElementById('content'));
        }
    },

    /* ── EXTRACCIÓN Y EXPORTACIÓN DE VENTAS (EXCEL / CSV) ── */
    async openExportModal() {
        this._exportPeriodType = 'day';
        const allSales = await DB.getSales();
        this._cachedSalesForExport = allSales;

        Modal.open(`
          <h2 class="modal-title">📥 Extraer Ventas (Exportar a Excel)</h2>
          <p class="text-muted" style="font-size:0.85rem; margin-top:-0.75rem; margin-bottom:1.2rem;">
            Descarga un archivo con las ventas registradas por día, rango de fechas o mes completo.
          </p>

          <div class="form-group" style="margin-bottom:1rem;">
            <label style="font-weight:600; font-size:0.85rem; display:block; margin-bottom:0.4rem;">Período a Extraer:</label>
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:0.5rem;">
              <button type="button" class="btn btn-sm btn-outline exp-period-btn active" id="btn-exp-day" onclick="SalesModule.setExportPeriodType('day')">
                📅 Por Día
              </button>
              <button type="button" class="btn btn-sm btn-outline exp-period-btn" id="btn-exp-range" onclick="SalesModule.setExportPeriodType('range')">
                📆 Rango
              </button>
              <button type="button" class="btn btn-sm btn-outline exp-period-btn" id="btn-exp-month" onclick="SalesModule.setExportPeriodType('month')">
                🗓️ Por Mes
              </button>
            </div>
          </div>

          <div id="exp-inputs-container" style="margin-bottom:0.75rem;"></div>

          <div class="form-row" style="margin-bottom:1rem;">
            <div class="form-group" style="flex:1;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <label style="font-size:0.82rem; font-weight:600;">⏰ Hora Desde:</label>
                <small class="text-muted" style="font-size:0.7rem; cursor:pointer;" onclick="document.getElementById('exp-time-start').value=''; SalesModule.updateExportPreview();" title="Borrar filtro de hora">✕ Limpiar</small>
              </div>
              <input type="time" id="exp-time-start" class="form-input" onchange="SalesModule.updateExportPreview()">
            </div>
            <div class="form-group" style="flex:1;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <label style="font-size:0.82rem; font-weight:600;">⏰ Hora Hasta:</label>
                <small class="text-muted" style="font-size:0.7rem; cursor:pointer;" onclick="document.getElementById('exp-time-end').value=''; SalesModule.updateExportPreview();" title="Borrar filtro de hora">✕ Limpiar</small>
              </div>
              <input type="time" id="exp-time-end" class="form-input" onchange="SalesModule.updateExportPreview()">
            </div>
          </div>

          <div class="form-row" style="margin-bottom:1rem;">
            <div class="form-group" style="flex:1;">
              <label style="font-size:0.82rem; font-weight:600;">Estado:</label>
              <select id="exp-filter-status" class="form-input" onchange="SalesModule.updateExportPreview()">
                <option value="completed" selected>Solo completadas</option>
                <option value="all">Todas (incluye anuladas)</option>
              </select>
            </div>
            <div class="form-group" style="flex:1;">
              <label style="font-size:0.82rem; font-weight:600;">Medio de Pago:</label>
              <select id="exp-filter-pay" class="form-input" onchange="SalesModule.updateExportPreview()">
                <option value="all" selected>Todos los medios</option>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="qr">MercadoPago / QR</option>
                <option value="cuenta_corriente">Cuenta Corriente</option>
                <option value="debito">Débito</option>
                <option value="credito">Crédito</option>
              </select>
            </div>
          </div>

          <div class="form-group" style="margin-bottom:1.25rem;">
            <label style="font-size:0.82rem; font-weight:600;">Nivel de Detalle del Archivo:</label>
            <select id="exp-detail-type" class="form-input">
              <option value="summary" selected>📄 Resumen por Venta (incluye productos vendidos, medios de pago y totales)</option>
              <option value="items">📦 Detallado por Producto (1 fila por cada ítem vendido con cantidades y precios)</option>
            </select>
          </div>

          <div id="exp-preview-box" class="card" style="padding:0.85rem 1rem; background:rgba(212,175,55,0.06); border:1px solid var(--border); border-radius:var(--radius-sm); margin-bottom:1.25rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
              <div>
                <span style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Ventas Encontradas</span>
                <div id="exp-preview-count" style="font-size:1.35rem; font-weight:800; color:var(--text-main);">0</div>
              </div>
              <div style="text-align:right;">
                <span style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Total Acumulado</span>
                <div id="exp-preview-total" style="font-size:1.35rem; font-weight:800; color:var(--accent);">$0,00</div>
              </div>
            </div>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
            <button type="button" id="btn-do-export" class="btn btn-primary" onclick="SalesModule.executeExport()" style="gap:0.4rem;">
              📥 Descargar Excel (CSV)
            </button>
          </div>
        `);

        this.setExportPeriodType('day');
    },

    setExportPeriodType(type) {
        this._exportPeriodType = type;
        document.querySelectorAll('.exp-period-btn').forEach(b => b.classList.remove('active'));
        const activeBtn = document.getElementById(`btn-exp-${type}`);
        if (activeBtn) activeBtn.classList.add('active');

        const container = document.getElementById('exp-inputs-container');
        if (!container) return;

        const today = Utils.todayStr();
        const curYear = new Date().getFullYear();
        const yearOptions = [curYear - 2, curYear - 1, curYear, curYear + 1];

        if (type === 'day') {
            container.innerHTML = `
                <div class="form-group" style="margin-bottom:0;">
                    <label style="font-size:0.82rem; font-weight:600;">Seleccionar Día:</label>
                    <input type="date" id="exp-input-day" class="form-input" value="${today}" onchange="SalesModule.updateExportPreview()">
                </div>`;
        } else if (type === 'range') {
            container.innerHTML = `
                <div class="form-row" style="margin-bottom:0;">
                    <div class="form-group" style="flex:1;">
                        <label style="font-size:0.82rem; font-weight:600;">Desde:</label>
                        <input type="date" id="exp-input-start" class="form-input" value="${today}" onchange="SalesModule.updateExportPreview()">
                    </div>
                    <div class="form-group" style="flex:1;">
                        <label style="font-size:0.82rem; font-weight:600;">Hasta:</label>
                        <input type="date" id="exp-input-end" class="form-input" value="${today}" onchange="SalesModule.updateExportPreview()">
                    </div>
                </div>`;
        } else if (type === 'month') {
            const curM = (this.historyMonth !== undefined) ? this.historyMonth : new Date().getMonth();
            const curY = (this.historyYear !== undefined) ? this.historyYear : curYear;
            const monthNames = Array.from({ length: 12 }, (_, i) => {
                const raw = new Date(2000, i).toLocaleString('es', { month: 'long' });
                return raw.charAt(0).toUpperCase() + raw.slice(1);
            });
            container.innerHTML = `
                <div class="form-row" style="margin-bottom:0;">
                    <div class="form-group" style="flex:2;">
                        <label style="font-size:0.82rem; font-weight:600;">Mes:</label>
                        <select id="exp-input-month" class="form-input" onchange="SalesModule.updateExportPreview()">
                            ${monthNames.map((name, i) => `<option value="${i}" ${i === curM ? 'selected' : ''}>${name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group" style="flex:1;">
                        <label style="font-size:0.82rem; font-weight:600;">Año:</label>
                        <select id="exp-input-year" class="form-input" onchange="SalesModule.updateExportPreview()">
                            ${yearOptions.map(y => `<option value="${y}" ${y === curY ? 'selected' : ''}>${y}</option>`).join('')}
                        </select>
                    </div>
                </div>`;
        }
        this.updateExportPreview();
    },

    getMatchingExportSales(allSales) {
        const periodType = this._exportPeriodType || 'day';
        const statusFilter = document.getElementById('exp-filter-status')?.value || 'completed';
        const payFilter = document.getElementById('exp-filter-pay')?.value || 'all';

        const timeStart = document.getElementById('exp-time-start')?.value || '';
        const timeEnd = document.getElementById('exp-time-end')?.value || '';

        return (allSales || []).filter(s => {
            if (!s) return false;
            // Filtro de estado
            if (statusFilter === 'completed' && s.voided) return false;

            // Filtro de medio de pago
            if (payFilter !== 'all' && s.payment_type !== payFilter) return false;

            // Filtro de fecha en hora local argentina
            const saleDateStr = Utils.toArgentinaDateStr(s.created_at);
            if (!saleDateStr) return false;

            if (periodType === 'day') {
                const dayVal = document.getElementById('exp-input-day')?.value || Utils.todayStr();
                if (saleDateStr !== dayVal) return false;
            } else if (periodType === 'range') {
                const startVal = document.getElementById('exp-input-start')?.value || '';
                const endVal = document.getElementById('exp-input-end')?.value || '';
                if (startVal && saleDateStr < startVal) return false;
                if (endVal && saleDateStr > endVal) return false;
            } else if (periodType === 'month') {
                const mVal = parseInt(document.getElementById('exp-input-month')?.value ?? new Date().getMonth(), 10);
                const yVal = parseInt(document.getElementById('exp-input-year')?.value ?? new Date().getFullYear(), 10);
                const ym = Utils.getArgentinaYearMonth(new Date(s.created_at));
                if (ym.month !== mVal || ym.year !== yVal) return false;
            }

            // Filtro por horario en hora local argentina (formato HH:mm)
            if (timeStart || timeEnd) {
                const saleTimeStr = Utils.time(s.created_at);
                if (timeStart && saleTimeStr < timeStart) return false;
                if (timeEnd && saleTimeStr > timeEnd) return false;
            }

            return true;
        });
    },

    updateExportPreview() {
        const allSales = this._cachedSalesForExport || [];
        const matching = this.getMatchingExportSales(allSales);

        const countEl = document.getElementById('exp-preview-count');
        const totalEl = document.getElementById('exp-preview-total');
        const btn = document.getElementById('btn-do-export');

        const totalSum = matching
            .filter(s => !s.voided)
            .reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);

        if (countEl) countEl.textContent = matching.length;
        if (totalEl) totalEl.textContent = Utils.currency(totalSum);

        if (btn) {
            btn.disabled = (matching.length === 0);
            if (matching.length === 0) {
                btn.title = "No se encontraron ventas con los filtros indicados";
            } else {
                btn.title = `Descargar ${matching.length} venta(s)`;
            }
        }
    },

    async executeExport() {
        const btn = document.getElementById('btn-do-export');
        const origText = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '⏳ Generando archivo...';
        }

        try {
            const allSales = this._cachedSalesForExport || (await DB.getSales());
            const matching = this.getMatchingExportSales(allSales);

            if (!matching.length) {
                if (typeof Toast !== 'undefined') Toast.show('No hay ventas para exportar con los filtros seleccionados', 'warning');
                else alert('No hay ventas para exportar con los filtros seleccionados');
                if (btn) { btn.disabled = false; btn.innerHTML = origText; }
                return;
            }

            const detailType = document.getElementById('exp-detail-type')?.value || 'summary';
            const periodType = this._exportPeriodType || 'day';

            // Determinar sufijo para nombre de archivo
            let fileSuffix = '';
            if (periodType === 'day') {
                const d = document.getElementById('exp-input-day')?.value || Utils.todayStr();
                fileSuffix = `dia_${d}`;
            } else if (periodType === 'range') {
                const s = document.getElementById('exp-input-start')?.value || 'inicio';
                const e = document.getElementById('exp-input-end')?.value || 'fin';
                fileSuffix = `periodo_${s}_al_${e}`;
            } else {
                const m = parseInt(document.getElementById('exp-input-month')?.value ?? new Date().getMonth(), 10) + 1;
                const y = document.getElementById('exp-input-year')?.value ?? new Date().getFullYear();
                fileSuffix = `mes_${String(m).padStart(2, '0')}_${y}`;
            }

            const timeStart = document.getElementById('exp-time-start')?.value || '';
            const timeEnd = document.getElementById('exp-time-end')?.value || '';
            let timeSuffix = '';
            if (timeStart && timeEnd) {
                timeSuffix = `_${timeStart.replace(':', 'hs')}_a_${timeEnd.replace(':', 'hs')}`;
            } else if (timeStart) {
                timeSuffix = `_desde_${timeStart.replace(':', 'hs')}`;
            } else if (timeEnd) {
                timeSuffix = `_hasta_${timeEnd.replace(':', 'hs')}`;
            }

            const filename = `ventas_${fileSuffix}${timeSuffix}_${detailType === 'items' ? 'detallado' : 'resumen'}.csv`;
            let rows = [];

            // Obtener items de las ventas seleccionadas para incluir productos y resumen
            const saleIds = matching.map(s => s.id);
            let allItems = [];
            try {
                if (saleIds.length <= 100) {
                    const { data } = await DB.client.from('sale_items').select('*').in('sale_id', saleIds).eq('admin_id', DB._adminId());
                    allItems = data || [];
                } else {
                    for (let i = 0; i < saleIds.length; i += 100) {
                        const chunk = saleIds.slice(i, i + 100);
                        const { data } = await DB.client.from('sale_items').select('*').in('sale_id', chunk).eq('admin_id', DB._adminId());
                        if (data) allItems.push(...data);
                    }
                }
            } catch (e) {
                console.warn("Fallo consulta selectiva de sale_items, recurriendo a getSaleItems():", e);
                allItems = await DB.getSaleItems();
            }

            if (detailType === 'items') {
                rows.push([
                    'Nro Venta', 'Fecha', 'Hora', 'Cliente', 'Producto', 
                    'Cantidad', 'Precio Unitario ($)', 'Descuento', 'Subtotal ($)', 
                    'Total Venta ($)', 'Medio de Pago', 'Facturada', 'Estado Venta'
                ]);

                matching.forEach(s => {
                    const sItems = allItems.filter(it => it.sale_id === s.id);
                    const fecha = Utils.dateShort(s.created_at);
                    const hora = Utils.time(s.created_at);
                    const cliente = s.client_name || 'Consumidor Final';
                    const pago = Utils.paymentLabel ? Utils.paymentLabel(s.payment_type) : s.payment_type;
                    const facturada = s.invoiced ? 'SI' : 'NO';
                    const estado = s.voided ? 'ANULADA' : 'COMPLETADA';
                    const totalVenta = parseFloat(s.total || 0).toFixed(2);

                    if (sItems.length > 0) {
                        sItems.forEach(it => {
                            const qty = parseFloat(it.quantity) || 0;
                            const unitPrice = parseFloat(it.unit_price) || 0;
                            let subtotal = qty * unitPrice;
                            let descText = 'Sin desc.';
                            if (it.discount_type === 'percentage') {
                                const dVal = parseFloat(it.discount_value) || 0;
                                subtotal -= subtotal * (dVal / 100);
                                descText = `${dVal}%`;
                            } else if (it.discount_type === 'amount') {
                                const dVal = parseFloat(it.discount_value) || 0;
                                subtotal -= dVal;
                                descText = `$${dVal}`;
                            }
                            rows.push([
                                `#${s.id.slice(-4)}`,
                                fecha,
                                hora,
                                cliente,
                                it.product_name,
                                qty,
                                unitPrice.toFixed(2),
                                descText,
                                Math.max(0, subtotal).toFixed(2),
                                totalVenta,
                                pago,
                                facturada,
                                estado
                            ]);
                        });
                    } else {
                        rows.push([
                            `#${s.id.slice(-4)}`,
                            fecha,
                            hora,
                            cliente,
                            'Venta sin detalle registrado',
                            1,
                            totalVenta,
                            'Sin desc.',
                            totalVenta,
                            totalVenta,
                            pago,
                            facturada,
                            estado
                        ]);
                    }
                });
            } else {
                rows.push([
                    'Nro Venta', 'Fecha', 'Hora', 'Cliente', 'Productos Vendidos',
                    'Total ($)', 'Medio de Pago', 'Facturada', 'Estado'
                ]);

                matching.forEach(s => {
                    const sItems = allItems.filter(it => it.sale_id === s.id);
                    const prodsList = sItems.length > 0 
                        ? sItems.map(it => `${it.quantity}x ${it.product_name}`).join(', ')
                        : 'Sin detalle registrado';

                    const fecha = Utils.dateShort(s.created_at);
                    const hora = Utils.time(s.created_at);
                    const cliente = s.client_name || 'Consumidor Final';
                    const total = parseFloat(s.total || 0).toFixed(2);
                    const pago = Utils.paymentLabel ? Utils.paymentLabel(s.payment_type) : s.payment_type;
                    const facturada = s.invoiced ? 'SI' : 'NO';
                    const estado = s.voided ? 'ANULADA' : 'COMPLETADA';

                    rows.push([
                        `#${s.id.slice(-4)}`,
                        fecha,
                        hora,
                        cliente,
                        prodsList,
                        total,
                        pago,
                        facturada,
                        estado
                    ]);
                });
            }

            // ── CÁLCULO DE TOTALES DEL PERÍODO Y CONSOLIDADO DE PRODUCTOS VENDIDOS ──
            let totalPeriodo = 0;
            let totalUnidadesPeriodo = 0;
            const prodSummary = {};

            matching.forEach(s => {
                if (!s.voided) {
                    totalPeriodo += (parseFloat(s.total) || 0);
                }
                const sItems = allItems.filter(it => it.sale_id === s.id);
                sItems.forEach(it => {
                    if (!s.voided) {
                        const pName = it.product_name || 'Producto sin nombre';
                        const qty = parseFloat(it.quantity) || 0;
                        let subtotal = qty * (parseFloat(it.unit_price) || 0);
                        if (it.discount_type === 'percentage') {
                            subtotal -= subtotal * ((parseFloat(it.discount_value) || 0) / 100);
                        } else if (it.discount_type === 'amount') {
                            subtotal -= parseFloat(it.discount_value) || 0;
                        }
                        subtotal = Math.max(0, subtotal);

                        if (!prodSummary[pName]) {
                            prodSummary[pName] = { qty: 0, total: 0 };
                        }
                        prodSummary[pName].qty += qty;
                        prodSummary[pName].total += subtotal;
                        totalUnidadesPeriodo += qty;
                    }
                });
            });

            // Bloque resumen final en el CSV
            rows.push([]);
            rows.push(['=== RESUMEN Y TOTALES DEL PERIODO ===']);
            rows.push(['Cantidad Total de Ventas', matching.length]);
            rows.push(['Ventas Completadas', matching.filter(s => !s.voided).length]);
            rows.push(['Ventas Anuladas', matching.filter(s => s.voided).length]);
            rows.push(['TOTAL VENDIDO EN EL PERIODO ($)', totalPeriodo.toFixed(2)]);
            rows.push(['Total de Unidades de Productos Vendidas', totalUnidadesPeriodo]);

            rows.push([]);
            rows.push(['=== CONSOLIDADO DE PRODUCTOS VENDIDOS EN EL PERIODO ===']);
            rows.push(['Producto', 'Cantidad Total Vendida', 'Total Recaudado ($)']);

            const prodsSorted = Object.entries(prodSummary).sort((a, b) => b[1].qty - a[1].qty);
            if (prodsSorted.length > 0) {
                prodsSorted.forEach(([pName, pData]) => {
                    rows.push([
                        pName,
                        pData.qty,
                        pData.total.toFixed(2)
                    ]);
                });
            } else {
                rows.push(['Sin productos detallados registrados en este período', 0, '0.00']);
            }
            rows.push(['TOTAL GENERAL', totalUnidadesPeriodo, totalPeriodo.toFixed(2)]);

            Utils.exportToCsv(filename, rows);
            Modal.close();
            if (typeof Toast !== 'undefined') Toast.show(`Archivo "${filename}" descargado con éxito (${matching.length} ventas)`, 'success');
        } catch (err) {
            console.error("Error al exportar ventas:", err);
            if (typeof Toast !== 'undefined') Toast.show('Error al generar la exportación de ventas', 'danger');
            else alert('Error al exportar ventas');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = origText; }
        }
    },

    async renderNewSale(el) {
        this.cart = []; this.paymentType = 'efectivo'; this.selectedClientId = null; this.selectedClientName = null;
        const products = await DB.getProducts();
        const allComboItems = await DB.getAllComboItems();

        // Calcular stock virtual en vivo de cada combo
        products.forEach(p => {
            if (p.unit === 'Combo') {
                const cItems = allComboItems.filter(ci => ci.combo_id === p.id);
                p.stock = DB.calculateComboStock(p, cItems, products);
            }
        });

        el.innerHTML = `
      <div class="new-sale-layout">
        <div class="sale-left">
          <div class="card" style="margin-bottom:1rem">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.85rem; flex-wrap:wrap; gap:0.5rem;">
              <h3 class="card-title" style="margin:0;">📦 Seleccionar Productos y Combos</h3>
              <button type="button" class="btn btn-sm btn-primary" onclick="SalesModule.openExpressProductModal()" style="gap:0.35rem;">⚡ Carga Express</button>
            </div>
            <input id="ps-q" type="text" placeholder="Buscar por nombre..." class="form-input" style="margin-bottom:.8rem">
            <div id="ps-grid" class="prod-grid"></div>
          </div>
          <div class="card">
            <h3 class="card-title">🛒 Carrito de Venta</h3>
            <div id="cart-container"></div>
          </div>
        </div>
        <div class="sale-right">
          <div class="card" style="margin-bottom:1rem">
            <h3 class="card-title">👤 Cliente / Pago</h3>
            <div id="client-selector" style="margin-bottom:1rem">
              <input id="cl-s" type="text" placeholder="Buscar cliente..." class="form-input">
              <div id="cl-results" class="client-results"></div>
              <div id="selected-client-box"></div>
            </div>
            <label class="card-title" style="display:block;margin-bottom:.5rem">Medio de Pago</label>
            <div class="payment-grid">
              <button class="pay-btn active" id="pay-efec" type="button" onclick="SalesModule.setPayment('efectivo')">💵 <span>Efectivo</span></button>
              <button class="pay-btn" id="pay-tran" type="button" onclick="SalesModule.setPayment('transferencia')">📱 <span>Transf.</span></button>
              <button class="pay-btn" id="pay-cuen" type="button" onclick="SalesModule.setPayment('cuenta_corriente')">📒 <span>Cta. Cte.</span></button>
              <button class="pay-btn" id="pay-qr__" type="button" onclick="SalesModule.setPayment('qr')">🔳 <span>QR</span></button>
              <button class="pay-btn" id="pay-debi" type="button" onclick="SalesModule.setPayment('debito')">💳 <span>Tarjeta de Débito</span></button>
              <button class="pay-btn" id="pay-cred" type="button" onclick="SalesModule.setPayment('credito')">💳 <span>Tarjeta de Crédito</span></button>
            </div>
          </div>
          <div class="total-card">
            <div style="margin-bottom: 1rem; padding: 0.8rem; background: rgba(0,0,0,0.15); border-radius: 6px; display: flex; align-items: center; gap: 0.5rem; justify-content: center;">
              <input type="checkbox" id="sale-invoiced" style="width: 1.2rem; height: 1.2rem; cursor: pointer;">
              <label for="sale-invoiced" style="font-weight: 600; cursor: pointer; user-select: none;">Facturar esta venta</label>
            </div>
            <div class="total-row"><span>Total a Pagar:</span> <span id="sale-total">$0,00</span></div>
            <button class="btn btn-primary btn-lg" style="width:100%;margin-top:1.5rem" onclick="SalesModule.confirmSale()">🚀 FINALIZAR VENTA</button>
          </div>
        </div>
      </div>`;
        this._renderProdGrid(products);
        this._renderCart();
        document.getElementById('ps-q').oninput = (e) => {
            const val = e.target.value.toLowerCase();
            this._renderProdGrid(products.filter(p => p.name.toLowerCase().includes(val)));
        };
        document.getElementById('cl-s').oninput = (e) => this._searchClients(e.target.value);
    },

    async _renderProdGrid(list) {
        const el = document.getElementById('ps-grid'); if (!el) return;
        const q = (document.getElementById('ps-q')?.value || '').trim();

        if (!list.length) {
            el.innerHTML = `
              <div class="empty-state" style="padding: 1.5rem 1rem;">
                <span class="empty-state-icon">🔍</span>
                <strong>Sin resultados${q ? ` para "${Utils.escHtml(q)}"` : ''}</strong>
                ${q ? `<button type="button" class="btn btn-primary btn-sm" style="margin-top:0.75rem;" onclick="SalesModule.openExpressProductModal('${Utils.escHtml(q)}')">⚡ Crear "${Utils.escHtml(q)}" como producto express</button>` : ''}
              </div>`;
            return;
        }

        el.innerHTML = list.map(p => {
            const isCombo = (p.unit === 'Combo');
            const hasStock = p.stock > 0;
            const unitAbbr = isCombo ? 'combos' : (Utils.unitAbbr ? Utils.unitAbbr(p.unit) : (p.unit || 'u.'));
            const stockDisplay = hasStock 
                ? `<span class="prod-chip-stock">Stock: <strong>${p.stock}</strong> ${unitAbbr}</span>`
                : `<span class="badge badge-danger" style="font-size:0.7rem;">Sin Stock</span>`;

            return `
              <div class="prod-chip ${!hasStock ? 'prod-no-stock' : ''} ${isCombo ? 'prod-chip-combo' : ''}" tabindex="0" role="button" aria-label="Agregar ${Utils.escHtml(p.name)}" onclick="SalesModule.addToCart('${p.id}', '${Utils.escHtml(p.name)}', ${p.sell_price})">
                <div class="prod-chip-name">
                  ${isCombo ? '<span class="badge" style="font-size:0.65rem; padding:0.1rem 0.35rem; margin-right:0.3rem; background:rgba(212,175,55,0.2); color:var(--accent); border:1px solid var(--border);">🎁 COMBO</span>' : ''}
                  ${Utils.escHtml(p.name)}
                </div>
                <div class="prod-chip-meta">
                  ${stockDisplay}
                  ${!isCombo ? `<button type="button" class="btn-add-stock" title="Cargar stock (+)" onclick="event.stopPropagation(); SalesModule.openQuickStockModal('${p.id}', '${Utils.escHtml(p.name)}', ${p.stock})">➕</button>` : ''}
                </div>
                <div class="prod-chip-price">${Utils.currency(p.sell_price)}</div>
              </div>`;
        }).join('');
    },

    async addToCart(id, name, price) {
        const prods = await DB.getProducts();
        const prod = prods.find(p => p.id === id);
        if (!prod) return;

        const allComboItems = await DB.getAllComboItems();
        const isCombo = (prod.unit === 'Combo');

        if (isCombo) {
            const comboComponents = allComboItems.filter(ci => ci.combo_id === id);
            if (!comboComponents.length) {
                if (typeof Toast !== 'undefined') Toast.show(`El combo "${name}" no tiene productos asignados.`, 'warning');
                else alert(`El combo "${name}" no tiene productos asignados.`);
                return;
            }

            const exist = this.cart.find(x => x.productId === id);
            const nextComboQty = (exist ? exist.quantity : 0) + 1;

            // Validar stock de cada componente contra el carrito
            for (const comp of comboComponents) {
                const compProd = prods.find(p => p.id === comp.product_id);
                const compStock = parseFloat(compProd ? compProd.stock : 0) || 0;
                const reqPerCombo = parseFloat(comp.quantity) || 1;

                let alreadyUsed = 0;
                this.cart.forEach(it => {
                    if (it.productId === comp.product_id) {
                        alreadyUsed += it.quantity;
                    } else if (it.isCombo && it.productId !== id) {
                        const otherComp = allComboItems.find(ci => ci.combo_id === it.productId && ci.product_id === comp.product_id);
                        if (otherComp) alreadyUsed += (it.quantity * (parseFloat(otherComp.quantity) || 1));
                    }
                });

                const totalNeeded = alreadyUsed + (nextComboQty * reqPerCombo);
                if (totalNeeded > compStock) {
                    const compUnit = Utils.unitAbbr ? Utils.unitAbbr(compProd?.unit || 'u.') : 'u.';
                    const availableNow = Math.max(0, compStock - alreadyUsed);
                    const msg = `No se puede vender el combo "${name}": stock insuficiente de "${compProd?.name || 'Insumo'}" (Disponible: ${availableNow} ${compUnit}, Requerido: ${reqPerCombo} ${compUnit})`;
                    if (typeof Toast !== 'undefined') Toast.show(msg, 'danger', 4500);
                    else alert(msg);
                    return;
                }
            }

            if (exist) {
                exist.quantity = nextComboQty;
            } else {
                const calculatedStock = DB.calculateComboStock(prod, comboComponents, prods);
                this.cart.push({
                    productId: id,
                    productName: name,
                    unitPrice: price,
                    costPrice: parseFloat(prod.cost_price) || 0,
                    quantity: 1,
                    maxStock: calculatedStock,
                    unit: 'Combo',
                    isCombo: true,
                    discountType: 'none',
                    discountValue: 0
                });
            }
            if (typeof Toast !== 'undefined') Toast.show(`Combo "${name}" agregado al carrito`, 'info', 1400);
            this._renderCart();
            return;
        }

        // Producto regular
        const stock = parseFloat(prod ? prod.stock : 0) || 0;
        const unit = prod?.unit || 'Unidades';
        const exist = this.cart.find(x => x.productId === id);

        // Chequear si algún combo ya reservó stock de este producto en el carrito
        let reservedByCombos = 0;
        this.cart.forEach(it => {
            if (it.isCombo) {
                const comp = allComboItems.find(ci => ci.combo_id === it.productId && ci.product_id === id);
                if (comp) reservedByCombos += (it.quantity * (parseFloat(comp.quantity) || 1));
            }
        });

        const effectiveStock = Math.max(0, stock - reservedByCombos);
        const step = Utils.unitStep ? Utils.unitStep(unit) : 1;
        let delta = 1;
        if (step < 1) {
            delta = exist ? step : (effectiveStock < 1 ? Math.min(step, effectiveStock) : 1);
        }

        if (exist) {
            const nextQty = Math.round((exist.quantity + delta) * 1000) / 1000;
            if (nextQty > effectiveStock) {
                if (typeof Toast !== 'undefined') Toast.show(`No hay stock suficiente de ${name}. Quedan disponibles: ${effectiveStock} ${unit}`, 'warning');
                else alert(`No hay stock suficiente de ${name}. Stock disponible: ${effectiveStock} ${unit}`);
                return;
            }
            exist.quantity = nextQty;
        } else {
            if (effectiveStock <= 0) {
                if (typeof Toast !== 'undefined') Toast.show(`No hay stock disponible de ${name}`, 'warning');
                else alert(`No hay stock disponible de ${name}`);
                return;
            }
            const initialQty = Math.min(delta, effectiveStock);
            this.cart.push({ 
                productId: id, productName: name, unitPrice: price, 
                costPrice: parseFloat(prod?.cost_price) || 0,
                quantity: initialQty, 
                maxStock: effectiveStock, unit: unit,
                isCombo: false,
                discountType: 'none', discountValue: 0
            });
        }
        if (typeof Toast !== 'undefined') Toast.show(`${name} agregado al carrito`, 'info', 1400);
        this._renderCart();

        if (typeof anime !== 'undefined') {
            anime({
                targets: '#sale-total',
                scale: [1.2, 1],
                color: ['#e5c07b', '#d4af37'],
                duration: 350,
                easing: 'easeOutBack'
            });
        }
    },

    updateDiscountType(idx, type) {
        this.cart[idx].discountType = type;
        if (type === 'none') this.cart[idx].discountValue = 0;
        else if (!this.cart[idx].discountValue) this.cart[idx].discountValue = 0;
        this._renderCart();
    },

    updateDiscountValue(idx, val) {
        let v = parseFloat(val) || 0;
        const item = this.cart[idx];
        if (item.discountType === 'percentage' && v > 100) v = 100;
        if (item.discountType === 'amount' && v > (item.unitPrice * item.quantity)) v = item.unitPrice * item.quantity;
        if (v < 0) v = 0;
        item.discountValue = v;
        this._renderCart();
    },

    removeFromCart(idx) { this.cart.splice(idx, 1); this._renderCart(); },

    async updateQty(idx, val) {
        const q = parseFloat(val);
        const item = this.cart[idx];
        if (isNaN(q) || q <= 0) {
            this.cart.splice(idx, 1);
            this._renderCart();
            return;
        }

        const prods = await DB.getProducts();
        const allComboItems = await DB.getAllComboItems();

        if (item.isCombo) {
            const comboComponents = allComboItems.filter(ci => ci.combo_id === item.productId);
            for (const comp of comboComponents) {
                const compProd = prods.find(p => p.id === comp.product_id);
                const compStock = parseFloat(compProd ? compProd.stock : 0) || 0;
                const reqPerCombo = parseFloat(comp.quantity) || 1;

                let alreadyUsed = 0;
                this.cart.forEach((it, i) => {
                    if (i === idx) return;
                    if (it.productId === comp.product_id) {
                        alreadyUsed += it.quantity;
                    } else if (it.isCombo) {
                        const otherComp = allComboItems.find(ci => ci.combo_id === it.productId && ci.product_id === comp.product_id);
                        if (otherComp) alreadyUsed += (it.quantity * (parseFloat(otherComp.quantity) || 1));
                    }
                });

                const totalNeeded = alreadyUsed + (q * reqPerCombo);
                if (totalNeeded > compStock) {
                    const compUnit = Utils.unitAbbr ? Utils.unitAbbr(compProd?.unit || 'u.') : 'u.';
                    const maxPossibleCombos = Math.max(0, Math.floor((compStock - alreadyUsed) / reqPerCombo));
                    const msg = `Stock insuficiente para "${item.productName}". Falta: ${compProd?.name || 'Insumo'} (Máximo posible con stock actual: ${maxPossibleCombos})`;
                    if (typeof Toast !== 'undefined') Toast.show(msg, 'warning', 3500);
                    else alert(msg);
                    this._renderCart();
                    return;
                }
            }
        } else {
            let reservedByCombos = 0;
            this.cart.forEach((it, i) => {
                if (i !== idx && it.isCombo) {
                    const comp = allComboItems.find(ci => ci.combo_id === it.productId && ci.product_id === item.productId);
                    if (comp) reservedByCombos += (it.quantity * (parseFloat(comp.quantity) || 1));
                }
            });
            const prod = prods.find(p => p.id === item.productId);
            const totalStock = parseFloat(prod?.stock) || 0;
            const effectiveMax = Math.max(0, totalStock - reservedByCombos);

            if (q > effectiveMax) {
                if (typeof Toast !== 'undefined') Toast.show(`Stock insuficiente de ${item.productName}. Disponibles: ${effectiveMax} ${item.unit}`, 'warning');
                else alert(`Stock insuficiente. Solo quedan ${effectiveMax} ${item.unit}.`);
                this._renderCart();
                return;
            }
        }

        item.quantity = Math.round(q * 1000) / 1000;
        this._renderCart();
    },

    _renderCart() {
        const el = document.getElementById('cart-container'); if (!el) return;
        let total = 0;
        
        this.cart.forEach(it => {
            let subtotal = it.unitPrice * it.quantity;
            if (it.discountType === 'percentage') {
                subtotal -= subtotal * ((it.discountValue || 0) / 100);
            } else if (it.discountType === 'amount') {
                subtotal -= (it.discountValue || 0);
            }
            it._computedSubtotal = Math.max(0, Math.round(subtotal * 100) / 100);
            total += it._computedSubtotal;
        });

        const totalEl = document.getElementById('sale-total');
        if (totalEl) totalEl.textContent = Utils.currency(total);
        if (!this.cart.length) { el.innerHTML = Utils.emptyState('🛒', 'El carrito está vacío', 'Haz clic en un producto para agregarlo'); return; }
        el.innerHTML = `<div class="cart-list">${this.cart.map((it, i) => {
            const step = Utils.unitStep ? Utils.unitStep(it.unit) : 1;
            const unitAbbr = Utils.unitAbbr ? Utils.unitAbbr(it.unit) : 'u.';
            return `
      <div class="cart-item-card">
        <div class="cart-item-header">
          <strong class="cart-item-name">${Utils.escHtml(it.productName)}</strong>
          <button class="btn-icon danger" aria-label="Quitar ${Utils.escHtml(it.productName)}" onclick="SalesModule.removeFromCart(${i})">✕</button>
        </div>
        <div class="cart-item-details">
          <small class="text-muted">${Utils.currency(it.unitPrice)} / ${Utils.escHtml(it.unit)}</small>
          <div>
            <strong class="cart-item-subtotal">${Utils.currency(it._computedSubtotal)}</strong>
            ${it.discountType !== 'none' ? `<br><small class="text-success" style="font-size: 0.75rem;">-${Utils.currency((it.unitPrice * it.quantity) - it._computedSubtotal)}</small>` : ''}
          </div>
        </div>
        <div class="cart-item-controls">
          <div class="discount-selector-group">
            <select class="form-input" style="padding: 0.25rem 0.35rem; font-size: 0.8rem; width: auto;" onchange="SalesModule.updateDiscountType(${i}, this.value)">
                <option value="none" ${it.discountType === 'none' ? 'selected' : ''}>Sin Desc.</option>
                <option value="percentage" ${it.discountType === 'percentage' ? 'selected' : ''}>Desc. (%)</option>
                <option value="amount" ${it.discountType === 'amount' ? 'selected' : ''}>Desc. ($)</option>
            </select>
            ${it.discountType !== 'none' ? `<input type="number" class="form-input" style="padding: 0.25rem; font-size: 0.8rem; width: 65px;" placeholder="${it.discountType === 'percentage' ? '%' : '$'}" value="${it.discountValue || ''}" onchange="SalesModule.updateDiscountValue(${i}, this.value)" min="0">` : ''}
          </div>
          <div class="qty-stepper" style="display:flex; align-items:center; gap:0.25rem;">
            <button type="button" class="btn-qty" aria-label="Disminuir cantidad" onclick="SalesModule.updateQty(${i}, ${Math.max(0, Math.round((it.quantity - step) * 1000) / 1000)})">-</button>
            <input type="number" class="qty-input" value="${it.quantity}" step="any" min="0.001" onchange="SalesModule.updateQty(${i}, this.value)" style="width:75px; text-align:center;">
            <button type="button" class="btn-qty" aria-label="Aumentar cantidad" onclick="SalesModule.updateQty(${i}, ${Math.round((it.quantity + step) * 1000) / 1000})">+</button>
            <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); min-width:18px;">${unitAbbr}</span>
          </div>
        </div>
      </div>`;
        }).join('')}</div>`;

        if (typeof anime !== 'undefined') {
            anime({ targets: '.cart-item-card', opacity: [0, 1], translateY: [10, 0], delay: anime.stagger(50), duration: 400, easing: 'easeOutQuad' });
        }
    },

    async _searchClients(q) {
        const res = document.getElementById('cl-results');
        if (q.length < 2) { res.innerHTML = ''; return; }
        const data = (await DB.getClients()).filter(c => 
            c.name.toLowerCase().includes(q.toLowerCase()) || 
            (c.dni && c.dni.toString().includes(q.toLowerCase()))
        );
        if (data.length > 0) {
            res.innerHTML = data.map(c => `<div class="client-chip" tabindex="0" role="button" onclick="SalesModule.selectClient('${c.id}', '${Utils.escHtml(c.name)}')">${Utils.escHtml(c.name)}</div>`).join('');
        } else {
            res.innerHTML = `
              <div class="client-chip text-muted" style="font-style:italic; cursor:default;">Sin resultados para "${Utils.escHtml(q)}"</div>
              <div class="client-chip" style="border-color:var(--accent); color:var(--accent); font-weight:600;" onclick="SalesModule.openNewClientModal('${Utils.escHtml(q)}')">
                ➕ Agregar "${Utils.escHtml(q)}" como nuevo cliente
              </div>`;
        }
    },

    openNewClientModal(prefillName = '') {
        Modal.open(`
      <h2 class="modal-title">➕ Nuevo Cliente</h2>
      <form onsubmit="SalesModule.saveNewClientInline(event)">
        <div class="form-group">
          <label>Nombre Completo *</label>
          <input id="nc-name" name="name" class="form-input" required value="${Utils.escHtml(prefillName)}" placeholder="Nombre completo" oninput="this.value = this.value.replace(/[0-9]/g, '')">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>DNI</label>
            <input id="nc-dni" name="dni" class="form-input" placeholder="Ej: 38123456" oninput="this.value = this.value.replace(/[^0-9.]/g, '')">
          </div>
          <div class="form-group">
            <label>Teléfono</label>
            <input id="nc-phone" name="phone" class="form-input" placeholder="Ej: 11 2345-6789" oninput="this.value = this.value.replace(/[^0-9+\-\s()]/g, '')">
          </div>
        </div>
        <div class="form-group">
          <label>Dirección</label>
          <input id="nc-address" name="address" class="form-input" placeholder="Opcional">
        </div>
        <div class="form-group">
          <label>Email</label>
          <input id="nc-email" name="email" class="form-input" type="email" placeholder="Opcional">
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar Cliente</button>
        </div>
      </form>`);
    },

    async saveNewClientInline(e) {
        e.preventDefault();
        const f = e.target;
        const name = f.name.value.trim();
        const dni = f.dni.value.trim();
        const phone = f.phone.value.trim();
        const address = f.address.value.trim();
        const email = f.email.value.trim();

        // Validaciones
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

        const newClient = await DB.saveClient({ name, dni, phone, address, email });
        Modal.close();
        if (typeof Toast !== 'undefined') Toast.show(`Cliente ${name} creado con éxito`, 'success');
        if (newClient) {
            this.selectClient(newClient.id, newClient.name);
        }
    },

    selectClient(id, name) {
        this.selectedClientId = id; this.selectedClientName = name;
        document.getElementById('cl-results').innerHTML = '';
        document.getElementById('cl-s').value = '';
        const box = document.getElementById('selected-client-box');
        if (box) {
            box.innerHTML = name ? `
          <div class="selected-client-tag">
            👤 <strong>${Utils.escHtml(name)}</strong>
            <button class="btn-icon" aria-label="Quitar cliente seleccionado" onclick="SalesModule.selectClient(null, null)">✕</button>
          </div>` : '';
        }
    },

    setPayment(type) {
        this.paymentType = type;
        const map = { efectivo: 'pay-efec', transferencia: 'pay-tran', cuenta_corriente: 'pay-cuen', qr: 'pay-qr__', debito: 'pay-debi', credito: 'pay-cred' };
        document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active'));
        const btn = document.getElementById(map[type]);
        if (btn) {
            btn.classList.add('active');
            if (typeof anime !== 'undefined') {
                anime({
                    targets: btn,
                    scale: [0.95, 1],
                    duration: 250,
                    easing: 'easeOutBack'
                });
            }
        }
    },

    async confirmSale() {
        if (this._isSubmittingSale) return;

        if (!this.cart.length) {
            if (typeof Toast !== 'undefined') Toast.show('El carrito está vacío', 'warning');
            else alert('Carrito vacío');
            return;
        }
        if (this.paymentType === 'cuenta_corriente' && !this.selectedClientId) {
            if (typeof Toast !== 'undefined') Toast.show('Selecciona un cliente para la cuenta corriente', 'warning');
            else alert('Selecciona un cliente para cuenta corriente');
            return;
        }

        // Validación integral de stock antes de confirmar
        const prods = await DB.getProducts();
        const allComboItems = await DB.getAllComboItems();
        const neededPerProduct = {};

        for (const it of this.cart) {
            if (it.isCombo) {
                const comps = allComboItems.filter(ci => ci.combo_id === it.productId);
                for (const c of comps) {
                    const req = (parseFloat(c.quantity) || 1) * (parseFloat(it.quantity) || 0);
                    neededPerProduct[c.product_id] = (neededPerProduct[c.product_id] || 0) + req;
                }
            } else {
                neededPerProduct[it.productId] = (neededPerProduct[it.productId] || 0) + (parseFloat(it.quantity) || 0);
            }
        }

        for (const [pId, needed] of Object.entries(neededPerProduct)) {
            const p = prods.find(x => x.id === pId);
            const avail = parseFloat(p ? p.stock : 0) || 0;
            if (needed > avail) {
                const u = p?.unit ? (Utils.unitAbbr ? Utils.unitAbbr(p.unit) : p.unit) : 'u.';
                const msg = `Stock insuficiente de "${p?.name || 'Producto'}": se requieren ${needed} ${u}, pero solo hay ${avail} ${u} disponibles.`;
                if (typeof Toast !== 'undefined') Toast.show(msg, 'danger', 5000);
                else alert(msg);
                return;
            }
        }

        const confirmBtn = document.querySelector('button[onclick="SalesModule.confirmSale()"]');
        const origText = confirmBtn ? confirmBtn.innerHTML : '';
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '⏳ Registrando venta...';
        }
        this._isSubmittingSale = true;
        
        try {
            const invoiced = document.getElementById('sale-invoiced') ? document.getElementById('sale-invoiced').checked : false;
            const total = this.cart.reduce((s, i) => s + (i._computedSubtotal || 0), 0);
            await DB.saveSale({
                total, paymentType: this.paymentType,
                clientId: this.selectedClientId, clientName: this.selectedClientName,
                invoiced: invoiced
            }, this.cart);
            if (typeof Toast !== 'undefined') Toast.show('¡Venta registrada con éxito!', 'success');
            App.go('sales');
        } catch (e) {
            console.error(e);
            if (typeof Toast !== 'undefined') Toast.show('Error al registrar la venta', 'danger');
            else alert('Error al guardar la venta');
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = origText;
            }
        } finally {
            this._isSubmittingSale = false;
        }
    },

    /* ── CARGA EXPRESS DE PRODUCTOS EN POS ── */
    async openExpressProductModal(prefillName = '') {
        const categories = await DB.getCategories();
        Modal.open(`
      <h2 class="modal-title">⚡ Carga Express de Producto</h2>
      <p class="text-muted" style="font-size:0.85rem; margin-top:-0.8rem; margin-bottom:1.25rem;">
        Crea el producto en el momento y súmalo directamente a tu venta actual.
      </p>
      <form onsubmit="SalesModule.saveExpressProduct(event)">
        <div class="form-group">
          <label>Nombre del Producto *</label>
          <input id="exp-name" name="name" class="form-input" required value="${Utils.escHtml(prefillName)}" placeholder="Ej: Alfajor Chocolate">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Precio de Venta *</label>
            <input id="exp-sell-price" name="sell_price" type="number" step="0.01" min="0" class="form-input" required placeholder="0.00">
          </div>
          <div class="form-group">
            <label>Stock Inicial *</label>
            <input id="exp-stock" name="stock" type="number" step="any" min="0.001" value="1" class="form-input" required placeholder="1 o 0.5">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Categoría (Opcional)</label>
            <select id="exp-category" name="category_id" class="form-input">
              <option value="">-- Sin Categoría --</option>
              ${categories.map(c => `<option value="${c.id}">${Utils.escHtml(c.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Unidad de Medida</label>
            <select id="exp-unit" name="unit" class="form-input">
              <option value="Unidades" selected>Unidades</option>
              <option value="Kg">Kg (Kilogramos)</option>
              <option value="Litros">Litros</option>
              <option value="Metros">Metros</option>
              <option value="Porción">Porción</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Precio de Costo (Opcional)</label>
          <input id="exp-cost-price" name="cost_price" type="number" step="0.01" min="0" class="form-input" placeholder="0.00">
        </div>
        <div style="background:var(--accent-subtle); border:1px solid var(--border); border-radius:var(--radius-sm); padding:0.65rem 0.85rem; margin-bottom:1.25rem; display:flex; align-items:center; gap:0.5rem;">
          <span>🛒</span>
          <small style="color:var(--accent-light); font-weight:600;">Se agregará automáticamente al carrito de venta actual.</small>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">⚡ Guardar y Sumar a Venta</button>
        </div>
      </form>`);
    },

    async saveExpressProduct(e) {
        e.preventDefault();
        const f = e.target;
        const name = f.name.value.trim();
        const sellPrice = parseFloat(f.sell_price.value) || 0;
        const stock = parseFloat(f.stock.value) || 1;
        const categoryId = f.category_id.value || null;
        const unit = f.unit.value || 'Unidades';
        const costPrice = parseFloat(f.cost_price.value) || 0;

        if (!name || sellPrice <= 0) {
            if (typeof Toast !== 'undefined') Toast.show('Ingresa un nombre y precio de venta válido', 'warning');
            return;
        }

        try {
            const newProd = await DB.saveProduct({
                name,
                sellPrice,
                stock,
                categoryId,
                unit,
                costPrice
            });

            Modal.close();
            if (typeof Toast !== 'undefined') Toast.show(`¡Producto "${name}" creado con éxito!`, 'success');

            // Refrescar listado local de productos
            const products = await DB.getProducts();
            const q = (document.getElementById('ps-q')?.value || '').toLowerCase();
            this._renderProdGrid(q ? products.filter(p => p.name.toLowerCase().includes(q)) : products);

            // Agregar automáticamente al carrito de venta
            const prodId = newProd?.id || products.find(p => p.name.toLowerCase() === name.toLowerCase())?.id;
            if (prodId) {
                await this.addToCart(prodId, name, sellPrice);
            }
        } catch (err) {
            console.error("Error al guardar producto express:", err);
            if (typeof Toast !== 'undefined') Toast.show('Error al guardar el producto express', 'danger');
        }
    },

    /* ── CARGA RÁPIDA DE STOCK (+) ── */
    openQuickStockModal(productId, productName, currentStock) {
        Modal.open(`
      <h2 class="modal-title">➕ Cargar Stock Rápido</h2>
      <div style="margin-bottom:1.25rem;">
        <h4 style="color:var(--text-main); font-size:1.1rem; margin-bottom:0.25rem;">${Utils.escHtml(productName)}</h4>
        <p class="text-muted" style="font-size:0.85rem;">Stock actual disponible: <strong style="color:var(--accent); font-size:1rem;">${currentStock}</strong></p>
      </div>
      <form onsubmit="SalesModule.saveQuickStock(event, '${productId}', '${Utils.escHtml(productName)}')">
        <div class="form-group">
          <label>Cantidad a Ingresar *</label>
          <input id="qs-qty" name="qty" type="number" step="any" min="0.001" value="10" class="form-input" required autofocus placeholder="Ej: 10 o 2.5">
        </div>
        <div style="margin: 1.1rem 0; display:flex; align-items:center; gap:0.5rem; background:rgba(0,0,0,0.2); padding:0.6rem 0.8rem; border-radius:var(--radius-sm); border:1px solid var(--border-subtle);">
          <input type="checkbox" id="qs-add-cart" name="add_to_cart" checked style="width:1.15rem; height:1.15rem; cursor:pointer;">
          <label for="qs-add-cart" style="font-weight:600; font-size:0.85rem; cursor:pointer; user-select:none; margin:0; color:var(--text-main);">
            Sumar 1 unidad inmediatamente al carrito de venta actual
          </label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">➕ Cargar Stock</button>
        </div>
      </form>`);
    },

    async saveQuickStock(e, productId, productName) {
        e.preventDefault();
        const f = e.target;
        const addedQty = parseFloat(f.qty.value) || 0;
        const addToCartChecked = f.add_to_cart?.checked;

        if (addedQty <= 0) {
            if (typeof Toast !== 'undefined') Toast.show('Ingresa una cantidad válida', 'warning');
            return;
        }

        try {
            await DB.adjustStock(productId, addedQty);
            Modal.close();
            if (typeof Toast !== 'undefined') Toast.show(`Stock de "${productName}" incrementado (+${addedQty})`, 'success');

            // Refrescar lista de productos en Nueva Venta
            const products = await DB.getProducts();
            const q = (document.getElementById('ps-q')?.value || '').toLowerCase();
            this._renderProdGrid(q ? products.filter(p => p.name.toLowerCase().includes(q)) : products);

            // Si estaba marcado, sumar al carrito
            if (addToCartChecked) {
                const prod = products.find(p => p.id === productId);
                if (prod) {
                    await this.addToCart(productId, productName, prod.sell_price);
                }
            }
        } catch (err) {
            console.error("Error al ajustar stock:", err);
            if (typeof Toast !== 'undefined') Toast.show('Error al actualizar el stock', 'danger');
        }
    }
};
