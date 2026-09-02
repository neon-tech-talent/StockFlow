const Auth = {
  SESSION_KEY: 'flowstock_session',
  ACTIVITY_KEY: 'flowstock_last_activity',
  LOGOUT_REASON_KEY: 'flowstock_logout_reason',
  INACTIVITY_TIMEOUT_MS: 10 * 60 * 1000, // 10 minutos de inactividad

  getSession() {
    try {
      const raw = localStorage.getItem(this.SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  setSession(user) {
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(user));
    this.recordActivity();
  },

  logout() {
    localStorage.removeItem(this.SESSION_KEY);
    localStorage.removeItem(this.ACTIVITY_KEY);
    sessionStorage.removeItem(this.LOGOUT_REASON_KEY);
    window.location.href = 'login.html';
  },

  logoutByInactivity() {
    localStorage.removeItem(this.SESSION_KEY);
    localStorage.removeItem(this.ACTIVITY_KEY);
    sessionStorage.setItem(this.LOGOUT_REASON_KEY, 'inactivity');
    window.location.href = 'login.html?reason=inactivity';
  },

  recordActivity() {
    localStorage.setItem(this.ACTIVITY_KEY, Date.now().toString());
  },

  getLastActivity() {
    const act = localStorage.getItem(this.ACTIVITY_KEY);
    return act ? parseInt(act, 10) : 0;
  },

  checkInactivity() {
    const session = this.getSession();
    if (!session) return;

    const last = this.getLastActivity();
    if (last && (Date.now() - last >= this.INACTIVITY_TIMEOUT_MS)) {
      this.logoutByInactivity();
    }
  },

  initInactivityTracker() {
    const session = this.getSession();
    if (!session) return;

    // Verificar si ya expiró por inactividad
    this.checkInactivity();

    // Registrar actividad inicial
    if (!this.getLastActivity()) {
      this.recordActivity();
    }

    // Escuchar interacción del usuario con throttle (máximo 1 actualización cada 3 segundos)
    let lastThrottledTime = 0;
    const onUserActivity = () => {
      const now = Date.now();
      if (now - lastThrottledTime > 3000) {
        lastThrottledTime = now;
        this.recordActivity();
      }
    };

    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'].forEach(evt => {
      window.addEventListener(evt, onUserActivity, { passive: true });
    });

    // Verificación periódica en segundo plano cada 10 segundos
    if (this._inactivityInterval) clearInterval(this._inactivityInterval);
    this._inactivityInterval = setInterval(() => {
      this.checkInactivity();
    }, 10000);

    // Sincronizar logout con otras pestañas
    window.addEventListener('storage', (e) => {
      if (e.key === this.SESSION_KEY && !e.newValue) {
        window.location.href = 'login.html';
      }
    });
  },

  requireLogin() {
    const s = this.getSession();
    if (!s) {
      window.location.href = 'login.html';
      return null;
    }

    // Verificar si ya pasaron más de 10 min de inactividad
    const last = this.getLastActivity();
    if (last && (Date.now() - last >= this.INACTIVITY_TIMEOUT_MS)) {
      this.logoutByInactivity();
      return null;
    }

    this.recordActivity();
    this.initInactivityTracker();
    return s;
  },

  getAdminId() {
    const s = this.getSession();
    return s ? s.id : null;
  },

  getRole() {
    const s = this.getSession();
    return s ? s.role : null;
  },

  isSuperAdmin() {
    return this.getRole() === 'superadmin';
  }
};
