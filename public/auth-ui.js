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
    this.user = {
      ...user,
      name: user.full_name || user.name,
      company_name: user.company_name,
      phone: user.phone,
    };
    localStorage.setItem('ut_token', token);
    localStorage.setItem('ut_user', JSON.stringify(this.user));
    this.render();
  },

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('ut_token');
    localStorage.removeItem('ut_user');
    if (typeof Comms !== 'undefined') Comms.resetUi();
    if (typeof Penalties !== 'undefined') Penalties.resetUi();
    this.render();
  },

  render() {
    const btn = document.getElementById('btn-auth');
    const btnReg = document.getElementById('btn-register');
    const label = document.getElementById('auth-user');
    if (!btn) return;
    if (this.user) {
      label.hidden = false;
      const rol =
        typeof roleLabel === 'function' ? roleLabel(this.user.role) : this.user.role;
      const org = this.user.company_name ? ` · ${this.user.company_name}` : '';
      label.textContent = `${this.user.name || this.user.email} · ${rol}${org}`;
      btn.textContent = 'Salir';
      if (btnReg) btnReg.hidden = true;
    } else {
      label.hidden = true;
      btn.textContent = 'Ingresar';
      if (btnReg) btnReg.hidden = false;
    }
    if (typeof applyRoleUi === 'function') applyRoleUi();
    if (typeof renderBoardActor === 'function') renderBoardActor();
    if (typeof refreshBoard === 'function') refreshBoard();
    if (typeof Comms !== 'undefined') {
      if (this.user) Comms.refreshBell();
      else Comms.resetUi();
    }
    if (typeof Penalties !== 'undefined') {
      if (this.user) Penalties.refresh();
      else Penalties.resetUi();
    }
  },
};

let authRegisterMode = false;

function updateRegisterLabels() {
  const role = document.getElementById('auth-role')?.value || 'shipper';
  const companyLabel = document.getElementById('auth-company-label');
  if (companyLabel) {
    companyLabel.textContent =
      role === 'carrier'
        ? 'Nombre transportista / flota'
        : 'Razón social embarcadora';
  }
}

function setAuthMode(register) {
  authRegisterMode = register;
  const panel = document.getElementById('auth-panel');
  const title = document.getElementById('auth-title');
  const submit = document.getElementById('auth-submit');
  const toggle = document.getElementById('auth-toggle-mode');
  if (!panel) return;
  panel.classList.toggle('is-register', register);
  title.textContent = register ? 'Crear cuenta empresa' : 'Iniciar sesión';
  submit.textContent = register ? 'Registrarse' : 'Entrar';
  if (toggle) toggle.textContent = register ? 'Ya tengo cuenta — iniciar sesión' : '¿No tienes cuenta? Crear cuenta';
  if (register) updateRegisterLabels();
}

function openAuthPanel(register = false) {
  const panel = document.getElementById('auth-panel');
  if (!panel) return;
  setAuthMode(register);
  panel.hidden = false;
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

document.getElementById('auth-role')?.addEventListener('change', updateRegisterLabels);

document.getElementById('btn-auth')?.addEventListener('click', () => {
  if (Auth.user) {
    Auth.logout();
    document.getElementById('auth-panel').hidden = true;
    return;
  }
  const panel = document.getElementById('auth-panel');
  if (!panel.hidden && !authRegisterMode) {
    panel.hidden = true;
    return;
  }
  openAuthPanel(false);
});

document.getElementById('btn-register')?.addEventListener('click', () => {
  if (Auth.user) return;
  openAuthPanel(true);
});

document.getElementById('auth-toggle-mode')?.addEventListener('click', () => {
  openAuthPanel(!authRegisterMode);
});

document.getElementById('form-auth')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target).entries());
  if (authRegisterMode) {
    if (!body.full_name?.trim()) {
      alert('Ingresa el nombre de contacto');
      return;
    }
    if (!body.company_name?.trim()) {
      alert('Ingresa el nombre de la empresa');
      return;
    }
  }
  const url = authRegisterMode ? '/api/auth/register' : '/api/auth/login';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    alert(json.error || 'Error de autenticación');
    return;
  }
  Auth.save(json.token, json.user);
  document.getElementById('auth-panel').hidden = true;
  if (typeof Penalties !== 'undefined') Penalties.refresh();
  const rol = typeof roleLabel === 'function' ? roleLabel(json.user.role) : json.user.role;
  alert(
    authRegisterMode
      ? `Cuenta ${rol} creada. Ya puedes publicar según tu rol.`
      : 'Sesión iniciada'
  );
});

Auth.render();
