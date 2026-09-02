const CajaModule = {
    async render(el) {
        const total = await DB.getCashTotal();
        const movements = await DB.getCashMovements();

        el.innerHTML = `
      <div class="module-header">
        <h2 class="card-title">Control de Caja (Efectivo)</h2>
        <button class="btn btn-primary" onclick="CajaModule.openExtractionModal()">💸 Realizar Extracción</button>
      </div>

      <div class="caja-hero-card">
        <div class="caja-hero-icon" aria-hidden="true">💵</div>
        <div class="caja-hero-body">
          <div class="caja-hero-value">${Utils.currency(total)}</div>
          <div class="caja-hero-label">TOTAL EFECTIVO EN CAJA</div>
        </div>
      </div>

      <div class="card">
        <h3 class="card-title">📱 Historial de Movimientos</h3>
        ${movements.length ? `
        <div class="table-scroll">
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
              `).join('')}
            </tbody>
          </table>
        </div>` : Utils.emptyState('💵', 'No hay movimientos de caja registrados', 'Los ingresos y egresos de efectivo aparecerán aquí')}
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

    async openExtractionModal() {
        const currentTotal = await DB.getCashTotal();
        Modal.open(`
      <h2 class="modal-title">Realizar Extracción de Efectivo</h2>
      <div style="background:var(--accent-subtle); border:1px solid var(--border); border-radius:var(--radius-sm); padding:0.65rem 0.85rem; margin-bottom:1.2rem; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:0.85rem; color:var(--text-muted);">Efectivo actual en caja:</span>
        <strong style="color:var(--accent); font-size:1.1rem;">${Utils.currency(currentTotal)}</strong>
      </div>
      <form onsubmit="CajaModule.saveExtraction(event, ${currentTotal})">
        <div class="form-group">
          <label>Monto a extraer *</label>
          <input name="amount" type="number" step="0.01" min="0.01" class="form-input" required placeholder="0.00">
        </div>
        <div class="form-group">
          <label>Motivo / Comentario *</label>
          <textarea name="reason" class="form-input" required placeholder="Ej: Pago a proveedor, retiro personal..." rows="3"></textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Confirmar Extracción</button>
        </div>
      </form>`);
    },

    async saveExtraction(e, currentTotal) {
        e.preventDefault();
        const f = e.target;
        const amount = parseFloat(f.amount.value) || 0;
        const reason = f.reason.value.trim();

        if (amount <= 0) {
            if (typeof Toast !== 'undefined') Toast.show('Ingresa un monto válido mayor a 0', 'warning');
            return;
        }

        if (currentTotal !== undefined && amount > currentTotal) {
            const ok = confirm(`⚠️ Atención: El monto a extraer (${Utils.currency(amount)}) supera el efectivo actual en caja (${Utils.currency(currentTotal)}).\n\n¿Deseas continuar y dejar la caja en saldo negativo?`);
            if (!ok) return;
        }

        const submitBtn = f.querySelector('button[type="submit"]');
        const origText = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '⏳ Registrando extracción...';
        }

        try {
            await DB.saveCashMovement({ amount: -amount, type: 'extraccion', reason: reason });
            Modal.close();
            if (typeof Toast !== 'undefined') Toast.show('Extracción registrada con éxito', 'success');
            await this.render(document.getElementById('content'));
        } catch (err) {
            console.error("Error al registrar extracción:", err);
            if (typeof Toast !== 'undefined') Toast.show('Error al registrar la extracción', 'danger');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = origText;
            }
        }
    }
};
