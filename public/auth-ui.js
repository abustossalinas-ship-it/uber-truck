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
    clearAuthError();
    this.render();
  },

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('ut_token');
    localStorage.removeItem('ut_user');
    if (typeof Comms !== 'undefined') Comms.resetUi();
    if (typeof Penalties !== 'undefined') Penalties.resetUi();
    setAuthMode(false);
    clearAuthError();
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

function showAuthError(message) {
  const el = document.getElementById('auth-error');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearAuthError() {
  const el = document.getElementById('auth-error');
  if (!el) return;
  el.textContent = '';
  el.hidden = true;
}

function authErrorMessage(res, json, register) {
  let msg = json?.error || 'Error de autenticación';
  if (res.status === 409 && register) {
    msg =
      'Ese email ya tiene cuenta. Pulsa «Ya tengo cuenta — iniciar sesión» e ingresa tu contraseña.';
  } else if (res.status === 401 && !register) {
    msg = 'Email o contraseña incorrectos. Revisa mayúsculas y que sean al menos 6 caracteres.';
  } else if (res.status === 503) {
    msg = 'El servidor no puede conectar con la base de datos. Intenta en unos minutos.';
  }
  return msg;
}

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

function setRegisterFieldsRequired(register) {
  ['auth-company', 'auth-full-name'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.required = register;
  });
}

function setAuthMode(register) {
  authRegisterMode = register;
  const panel = document.getElementById('auth-panel');
  const title = document.getElementById('auth-title');
  const submit = document.getElementById('auth-submit');
  const toggle = document.getElementById('auth-toggle-mode');
  if (!panel) return;
  panel.classList.toggle('is-register', register);
  setRegisterFieldsRequired(register);
  clearAuthError();
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

const formAuth = document.getElementById('form-auth');
formAuth?.addEventListener(
  'invalid',
  (e) => {
    e.preventDefault();
    const field = e.target;
    if (field?.name === 'email') {
      showAuthError('Ingresa un email válido.');
    } else if (field?.name === 'password') {
      showAuthError('La contraseña debe tener al menos 6 caracteres.');
    } else if (authRegisterMode) {
      showAuthError('Completa los datos de registro marcados en el formulario.');
    } else {
      showAuthError('Revisa email y contraseña.');
    }
  },
  true
);

formAuth?.addEventListener('input', () => clearAuthError());

formAuth?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearAuthError();
  const submitBtn = document.getElementById('auth-submit');
  const prevLabel = submitBtn?.textContent;
  const body = Object.fromEntries(new FormData(e.target).entries());
  if (authRegisterMode) {
    if (!body.full_name?.trim()) {
      showAuthError('Ingresa el nombre de contacto');
      return;
    }
    if (!body.company_name?.trim()) {
      showAuthError('Ingresa el nombre de la empresa');
      return;
    }
  } else {
    delete body.role;
    delete body.company_name;
    delete body.full_name;
    delete body.phone;
    delete body.admin_key;
  }
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = authRegisterMode ? 'Registrando…' : 'Entrando…';
  }
  const url = authRegisterMode ? '/api/auth/register' : '/api/auth/login';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let json = {};
    try {
      json = await res.json();
    } catch {
      json = {};
    }
    if (!res.ok) {
      const msg = authErrorMessage(res, json, authRegisterMode);
      showAuthError(msg);
      return;
    }
    Auth.save(json.token, json.user);
    document.getElementById('auth-panel').hidden = true;
    if (typeof Penalties !== 'undefined') Penalties.refresh();
  } catch (err) {
    console.error(err);
    showAuthError('No se pudo conectar con el servidor. Revisa tu internet e intenta de nuevo.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = prevLabel || (authRegisterMode ? 'Registrarse' : 'Entrar');
    }
  }
});

setAuthMode(false);
Auth.render();
