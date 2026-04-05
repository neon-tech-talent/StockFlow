const Auth = {
  SESSION_KEY: 'flowstock_session',

  getSession() {
    try {
      const raw = localStorage.getItem(this.SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  setSession(user) {
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(user));
  },

  logout() {
    localStorage.removeItem(this.SESSION_KEY);
    window.location.href = 'login.html';
  },

  requireLogin() {
    const s = this.getSession();
    if (!s) {
      window.location.href = 'login.html';
      return null;
    }
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
