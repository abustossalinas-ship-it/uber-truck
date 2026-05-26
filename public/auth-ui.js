const Auth = {
  token: localStorage.getItem('ut_token'),
  user: JSON.parse(localStorage.getItem('ut_user') || 'null'),

  headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    return h;
  },

  save(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('ut_token', token);
    localStorage.setItem('ut_user', JSON.stringify(user));
    this.render();
  },

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('ut_token');
    localStorage.removeItem('ut_user');
    this.render();
  },

  render() {
    const btn = document.getElementById('btn-auth');
    const label = document.getElementById('auth-user');
    if (!btn) return;
    if (this.user) {
      label.hidden = false;
      label.textContent = `${this.user.name || this.user.email} (${this.user.role})`;
      btn.textContent = 'Salir';
    } else {
      label.hidden = true;
      btn.textContent = 'Ingresar';
    }
  },
};

document.getElementById('btn-auth')?.addEventListener('click', () => {
  if (Auth.user) {
    Auth.logout();
    return;
  }
  const panel = document.getElementById('auth-panel');
  panel.hidden = !panel.hidden;
});

let authRegisterMode = false;
document.getElementById('auth-toggle-mode')?.addEventListener('click', () => {
  authRegisterMode = !authRegisterMode;
  document.getElementById('auth-title').textContent = authRegisterMode ? 'Crear cuenta' : 'Iniciar sesión';
  document.getElementById('auth-submit').textContent = authRegisterMode ? 'Registrarse' : 'Entrar';
  document.getElementById('auth-name-label').hidden = !authRegisterMode;
  document.getElementById('auth-full-name').hidden = !authRegisterMode;
  document.getElementById('auth-role-label').hidden = !authRegisterMode;
  document.getElementById('auth-role').hidden = !authRegisterMode;
  document.getElementById('auth-toggle-mode').textContent = authRegisterMode
    ? 'Ya tengo cuenta'
    : 'Crear cuenta';
});

document.getElementById('form-auth')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target).entries());
  const url = authRegisterMode ? '/api/auth/register' : '/api/auth/login';
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) {
    alert(json.error || 'Error de autenticación');
    return;
  }
  Auth.save(json.token, { ...json.user, name: json.user.full_name });
  document.getElementById('auth-panel').hidden = true;
  alert(authRegisterMode ? 'Cuenta creada' : 'Sesión iniciada');
});

Auth.render();
