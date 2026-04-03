const CajaModule = {
    async render(el) {
        const total = await DB.getCashTotal();
        const movements = await DB.getCashMovements();

        el.innerHTML = `
      <div class="module-header">
        <h2 class="card-title">Control de Caja (Efectivo)</h2>
        <button class="btn btn-primary" onclick="CajaModule.openExtractionModal()">💸 Realizar Extracción</button>
      </div>

      <div class="kpi-row" style="grid-template-columns: 1fr">
        <div class="kpi-card" style="border-color: var(--accent); background: var(--accent-glow); justify-content: center; padding: 2rem">
          <div class="kpi-icon" style="font-size: 3rem">💵</div>
          <div class="kpi-body" style="text-align: center">
            <div class="kpi-value" style="font-size: 3rem">${Utils.currency(total)}</div>
            <div class="kpi-label" style="font-size: 1.1rem; color: var(--accent)">TOTAL EFECTIVO EN CAJA</div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3 class="card-title">📱 Historial de Movimientos</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Motivo / Comentario</th>
              <th style="text-align: right">Monto</th>
            </tr>
          </thead>
          <tbody>
            ${movements.map(m => `
              <tr>
                <td>${new Date(m.created_at).toLocaleString('es')}</td>
                <td><span class="badge ${this._getTypeClass(m.type)}">${m.type.toUpperCase()}</span></td>
                <td><span class="text-muted">${Utils.escHtml(m.reason || '')}</span></td>
                <td style="text-align: right; font-weight: 600" class="${m.amount < 0 ? 'text-danger' : 'text-success'}">
                  ${m.amount < 0 ? '-' : '+'}${Utils.currency(Math.abs(m.amount))}
                </td>
              </tr>
            `).join('') || '<tr><td colspan="4" class="empty-state">No hay movimientos</td></tr>'}
          </tbody>
        </table>
      </div>`;
    },

    _getTypeClass(type) {
        switch (type) {
            case 'venta': case 'cobranza': return 'badge-success';
            case 'extraccion': return 'badge-danger';
            case 'anulacion': return 'badge-warning';
            default: return 'badge-info';
        }
    },

    openExtractionModal() {
        Modal.open(`
      <h2 class="modal-title">Realizar Extracción de Efectivo</h2>
      <form onsubmit="CajaModule.saveExtraction(event)">
        <div class="form-group">
          <label>Monto a extraer *</label>
          <input name="amount" type="number" step="0.01" min="0.01" class="form-input" required placeholder="0.00">
        </div>
        <div class="form-group">
          <label>Motivo / Comentario *</label>
          <textarea name="reason" class="form-input" required placeholder="Ej: Pago a proveedor..." rows="3"></textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Confirmar Extracción</button>
        </div>
      </form>`);
    },

    async saveExtraction(e) {
        e.preventDefault();
        const f = e.target;
        const amount = parseFloat(f.amount.value);
        const reason = f.reason.value.trim();

        await DB.saveCashMovement({ amount: -amount, type: 'extraccion', reason: reason });

        Modal.close();
        await this.render(document.getElementById('content'));
    }
};
