const Utils = {
    currency(n) { 
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n || 0); 
    },
    date(iso) { 
        return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); 
    },
    dateShort(iso) { 
        return new Date(iso).toLocaleDateString('es-AR'); 
    },
    paymentLabel(t) {
        return { efectivo: 'Efectivo', debito: 'Débito', credito: 'Crédito', transferencia: 'Transferencia', cuenta_corriente: 'Cuenta Corriente', qr: 'MercadoPago / QR' }[t] || t;
    },
    paymentIcon(t) {
        return { efectivo: '💵', debito: '💳', credito: '💳', transferencia: '🏦', cuenta_corriente: '📋', qr: '📱' }[t] || '💰';
    },
    escHtml(s) { 
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); 
    },
    skeleton(rows = 4) {
        return `<div class="skeleton-container" aria-label="Cargando contenido">${Array.from({ length: rows }, () => `<div class="skeleton-row"></div>`).join('')}</div>`;
    },
    emptyState(icon = '📦', message = 'No hay registros disponibles', subtext = '') {
        return `<div class="empty-state">
            <span class="empty-state-icon" role="img" aria-hidden="true">${icon}</span>
            <strong style="color:var(--text-main); font-size:1rem">${Utils.escHtml(message)}</strong>
            ${subtext ? `<p style="font-size:0.85rem; color:var(--text-muted); margin-top:0.25rem; max-width:400px">${Utils.escHtml(subtext)}</p>` : ''}
        </div>`;
    },

    /* ── ANIME.JS MICRO-INTERACTION HELPERS ── */
    animatePage(container) {
        if (!container || typeof anime === 'undefined') return;
        anime({
            targets: container,
            opacity: [0, 1],
            translateY: [12, 0],
            duration: 320,
            easing: 'easeOutCubic'
        });
    },

    animateStagger(selector, delay = 45) {
        if (typeof anime === 'undefined') return;
        const els = document.querySelectorAll(selector);
        if (!els.length) return;
        anime({
            targets: selector,
            opacity: [0, 1],
            translateY: [14, 0],
            delay: anime.stagger(delay),
            duration: 380,
            easing: 'easeOutQuad'
        });
    }
};

/* ── TOAST SYSTEM (CON ANIME.JS) ── */
const Toast = {
    _getContainer() {
        let c = document.getElementById('toast-container');
        if (!c) {
            c = document.createElement('div');
            c.id = 'toast-container';
            c.setAttribute('aria-live', 'polite');
            c.setAttribute('aria-atomic', 'true');
            document.body.appendChild(c);
        }
        return c;
    },
    show(message, type = 'info', duration = 3200) {
        const c = this._getContainer();
        const toast = document.createElement('div');
        const icons = { success: '✨', danger: '⚠️', warning: '⚡', info: 'ℹ️' };
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span class="toast-message">${Utils.escHtml(message)}</span>`;
        c.appendChild(toast);

        if (typeof anime !== 'undefined') {
            anime({
                targets: toast,
                translateY: [24, 0],
                opacity: [0, 1],
                scale: [0.92, 1],
                duration: 350,
                easing: 'easeOutCubic'
            });
        }

        setTimeout(() => {
            if (typeof anime !== 'undefined') {
                anime({
                    targets: toast,
                    translateX: [0, 40],
                    opacity: [1, 0],
                    duration: 240,
                    easing: 'easeInQuad',
                    complete: () => toast.remove()
                });
            } else {
                toast.classList.add('toast-out');
                setTimeout(() => toast.remove(), 250);
            }
        }, duration);
    }
};

/* ── MODAL SYSTEM (ACCESSIBLE & ANIMATED) ── */
const Modal = {
    _lastActiveElement: null,

    open(html) {
        this._lastActiveElement = document.activeElement;
        let overlay = document.getElementById('modal-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'modal-overlay';
            document.body.appendChild(overlay);
        }
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.innerHTML = `<div class="modal-box" tabindex="-1">
            ${html}
            <button class="modal-close-corner" onclick="Modal.close()" aria-label="Cerrar ventana modal">✕</button>
        </div>`;
        overlay.classList.add('active');

        const box = overlay.querySelector('.modal-box');
        if (box && typeof anime !== 'undefined') {
            anime({
                targets: box,
                scale: [0.9, 1],
                opacity: [0, 1],
                translateY: [-15, 0],
                duration: 320,
                easing: 'easeOutCubic'
            });
        }

        // Focus inside modal
        const focusable = overlay.querySelector('input, select, textarea, button');
        if (focusable) focusable.focus();

        // ESC Key listener
        this._onKeyDown = (e) => {
            if (e.key === 'Escape') Modal.close();
        };
        window.addEventListener('keydown', this._onKeyDown);

        overlay.addEventListener('click', e => {
            if (e.target === overlay) Modal.close();
        }, { once: true });
    },

    close() {
        const o = document.getElementById('modal-overlay');
        if (o && o.classList.contains('active')) {
            const box = o.querySelector('.modal-box');
            if (this._onKeyDown) window.removeEventListener('keydown', this._onKeyDown);

            if (box && typeof anime !== 'undefined') {
                anime({
                    targets: box,
                    scale: [1, 0.93],
                    opacity: [1, 0],
                    translateY: [0, 10],
                    duration: 180,
                    easing: 'easeInQuad',
                    complete: () => {
                        o.classList.remove('active');
                        o.innerHTML = '';
                    }
                });
            } else {
                o.classList.remove('active');
                setTimeout(() => { o.innerHTML = ''; }, 200);
            }

            if (this._lastActiveElement && typeof this._lastActiveElement.focus === 'function') {
                this._lastActiveElement.focus();
            }
        }
    }
};
