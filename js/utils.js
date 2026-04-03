const Utils = {
    currency(n) { return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n || 0); },
    date(iso) { return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); },
    dateShort(iso) { return new Date(iso).toLocaleDateString('es-AR'); },
    paymentLabel(t) {
        return { efectivo: 'Efectivo', debito: 'Débito', credito: 'Crédito', transferencia: 'Transferencia', cuenta_corriente: 'Cuenta Corriente' }[t] || t;
    },
    paymentIcon(t) {
        return { efectivo: '💵', debito: '💳', credito: '💳', transferencia: '🏦', cuenta_corriente: '📋' }[t] || '💰';
    },
    escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
};

/* ── MODAL SYSTEM ── */
const Modal = {
    open(html) {
        let overlay = document.getElementById('modal-overlay');
        if (!overlay) { overlay = document.createElement('div'); overlay.id = 'modal-overlay'; document.body.appendChild(overlay); }
        overlay.innerHTML = `<div class="modal-box">${html}<button class="modal-close-corner" onclick="Modal.close()">✕</button></div>`;
        overlay.classList.add('active');
        overlay.addEventListener('click', e => { if (e.target === overlay) Modal.close(); }, { once: true });
    },
    close() {
        const o = document.getElementById('modal-overlay');
        if (o) { o.classList.remove('active'); setTimeout(() => o.innerHTML = '', 300); }
    }
};
