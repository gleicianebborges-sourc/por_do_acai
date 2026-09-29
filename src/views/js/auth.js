/**
 * auth.js
 * Client-side authentication & session guard for the POS system.
 * Verifies active session before allowing access to index.html.
 */

class AuthGuard {
  constructor() {
    this.tokenKey = 'pos_token';
    this.userKey = 'pos_user';
    this.currentUser = null;
  }

  /**
   * Fast synchronous check before rendering, followed by backend validation
   */
  async verifySessionOrRedirect() {
    const token = localStorage.getItem(this.tokenKey);
    const userJson = localStorage.getItem(this.userKey);

    if (!token || !userJson) {
      this.redirectToLogin();
      return false;
    }

    try {
      this.currentUser = JSON.parse(userJson);
      this.updateHeaderProfile(this.currentUser);
    } catch (e) {
      this.redirectToLogin();
      return false;
    }

    // Validate token against backend
    try {
      const res = await fetch('/api/auth/session', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok || !data.authenticated) {
        console.warn('Session expired or invalidated by server');
        this.clearSessionAndRedirect();
        return false;
      }

      this.currentUser = data.user;
      this.updateHeaderProfile(this.currentUser);
      return true;
    } catch (err) {
      console.warn('Backend session validation warning (offline/cached):', err);
      // If network glitch but local token exists, allow continued offline cashiering
      return true;
    }
  }

  updateHeaderProfile(user) {
    if (!user) return;
    const nameEl = document.getElementById('header-user-name');
    const roleEl = document.getElementById('header-user-role');

    if (nameEl) nameEl.textContent = user.name || user.email;
    if (roleEl) {
      roleEl.textContent = user.role === 'gerente' ? 'Gerência' : 'Operador';
      if (user.role === 'gerente') {
        roleEl.style.background = 'rgba(129, 140, 248, 0.25)';
        roleEl.style.color = '#c7d2fe';
      }
    }
  }

  async logout() {
    const token = localStorage.getItem(this.tokenKey);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ token })
      });
    } catch (e) {
      // Ignore network errors on logout
    }

    this.clearSessionAndRedirect();
  }

  clearSessionAndRedirect() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.redirectToLogin();
  }

  redirectToLogin() {
    if (!window.location.pathname.endsWith('login.html')) {
      window.location.href = 'login.html';
    }
  }
}

window.authGuard = new AuthGuard();
// Run instant check
window.authGuard.verifySessionOrRedirect();

document.addEventListener('DOMContentLoaded', () => {
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      if (confirm('Deseja realmente encerrar a sessão do caixa?')) {
        window.authGuard.logout();
      }
    });
  }
});
