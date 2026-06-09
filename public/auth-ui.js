const Auth = {
  token: localStorage.getItem('ut_token'),
  user: JSON.parse(localStorage.getItem('ut_user') || 'null'),

  headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    return h;
  },

  save(token, user) {
    if (typeof clearRatedMatchIds === 'function') clearRatedMatchIds();
    this.token = token;
    this.user = {
      ...user,
      name: user.full_name || user.name,
      company_name: user.company_name,
      phone: user.phone,
      kyc_status: user.kyc_status || 'pending',
      is_available: Boolean(user.is_available),
      last_lat: user.last_lat ?? null,
      last_lng: user.last_lng ?? null,
      location_updated_at: user.location_updated_at || null,
      default_truck_type_id: user.default_truck_type_id || null,
    };
    localStorage.setItem('ut_token', token);
    localStorage.setItem('ut_user', JSON.stringify(this.user));
    clearAuthError();
    this.render();
    if (typeof AppShell?.registerPushAfterAuth === 'function') AppShell.registerPushAfterAuth();
  },

  logout() {
    if (typeof clearRatedMatchIds === 'function') clearRatedMatchIds();
    this.token = null;
    this.user = null;
    localStorage.removeItem('ut_token');
    localStorage.removeItem('ut_user');
    if (typeof Comms !== 'undefined') Comms.resetUi();
    if (typeof Penalties !== 'undefined') Penalties.resetUi();
    setAuthMode(false, false);
    clearAuthError();
    this.render();
  },

  render() {
    const btn = document.getElementById('btn-auth');
    const btnReg = document.getElementById('btn-register');
    const label = document.getElementById('auth-user');
    if (!btn) return;
    const btnChangePw = document.getElementById('btn-change-password');
    if (this.user) {
      label.hidden = false;
      const rol =
        typeof roleLabel === 'function' ? roleLabel(this.user.role) : this.user.role;
      const org = this.user.company_name ? ` · ${this.user.company_name}` : '';
      label.textContent = `${this.user.name || this.user.email} · ${rol}${org}`;
      btn.textContent = 'Salir';
      if (btnReg) btnReg.hidden = true;
      if (btnChangePw) btnChangePw.hidden = false;
    } else {
      label.hidden = true;
      btn.textContent = 'Ingresar';
      if (btnReg) btnReg.hidden = false;
      if (btnChangePw) btnChangePw.hidden = true;
      document.getElementById('change-password-panel')?.setAttribute('hidden', '');
    }
    const isAppGuest = document.body.classList.contains('cubik-app') && !this.user;
    if (isAppGuest) {
      if (typeof AppShell?.hideNativeSplash === 'function') AppShell.hideNativeSplash();
      return;
    }
    if (typeof renderKycBanner === 'function') renderKycBanner();
    if (typeof refreshAdminKycPanel === 'function') refreshAdminKycPanel();
    if (typeof refreshAdminHubNav === 'function') refreshAdminHubNav();
    if (typeof refreshAdminOpsPanel === 'function') refreshAdminOpsPanel();
    if (this.user?.role === 'admin' && typeof scrollToAdminSection === 'function') {
      const goKyc = sessionStorage.getItem('ut_admin_focus') === 'kyc';
      if (goKyc) {
        sessionStorage.removeItem('ut_admin_focus');
        setTimeout(() => scrollToAdminSection('kyc'), 400);
      }
    }
    if (typeof refreshCarrierPresencePanel === 'function') refreshCarrierPresencePanel();
    if (typeof applyRoleUi === 'function') applyRoleUi();
    if (typeof renderBoardActor === 'function') renderBoardActor();
    if (typeof refreshBoard === 'function') refreshBoard();
    if (typeof Comms !== 'undefined') Comms.resetUi();
    if (typeof Penalties !== 'undefined') Penalties.resetUi();
  },
};

let authRegisterMode = false;
let authForgotMode = false;
let pendingAuthRegister = false;

const AUTH_INTENT_KEY = 'ut_auth_intent_role';

function normalizeAuthIntentRole(raw) {
  if (typeof normalizeAppRole === 'function') return normalizeAppRole(raw);
  const r = String(raw || '')
    .toLowerCase()
    .trim();
  if (r === 'carrier' || r === 'transportista') return 'carrier';
  if (r === 'shipper' || r === 'embarcador' || r === 'embarcadora') return 'shipper';
  return r === 'carrier' || r === 'shipper' ? r : null;
}

function readAuthIntentFromUrl() {
  try {
    const q = new URLSearchParams(window.location.search);
    return normalizeAuthIntentRole(q.get('rol') || q.get('role'));
  } catch (_) {
    return null;
  }
}

function getAuthIntentRole() {
  try {
    const stored = sessionStorage.getItem(AUTH_INTENT_KEY);
    const role = normalizeAuthIntentRole(stored);
    if (role) return role;
  } catch (_) {}
  return readAuthIntentFromUrl();
}

function setAuthIntentRole(role) {
  const normalized = normalizeAuthIntentRole(role);
  if (!normalized) return;
  try {
    sessionStorage.setItem(AUTH_INTENT_KEY, normalized);
  } catch (_) {}
  syncAuthRoleFields(normalized);
  refreshAuthIntentUi();
}

function clearAuthIntentRole() {
  try {
    sessionStorage.removeItem(AUTH_INTENT_KEY);
  } catch (_) {}
  refreshAuthIntentUi();
}

function authIntentHeadline(role, register) {
  const label = typeof roleLabel === 'function' ? roleLabel(role) : role;
  if (register) return `Crear cuenta — ${label}`;
  return `${label} — iniciar sesión`;
}

function authIntentRegisterIntro(role) {
  if (role === 'carrier') {
    return 'Registra tu flota o servicio de transporte. Un administrador debe aprobar la cuenta antes de ofertar y emparejar.';
  }
  return 'Registra tu empresa embarcadora. Un administrador debe aprobar la cuenta antes de publicar cargas y emparejar.';
}

function syncAuthRoleFields(role) {
  const select = document.getElementById('auth-role');
  if (select && role) select.value = role;
  document.querySelectorAll('[data-role-pick]').forEach((btn) => {
    const pick = btn.dataset.rolePick;
    btn.classList.toggle('active', pick === role);
    btn.setAttribute('aria-pressed', pick === role ? 'true' : 'false');
  });
  updateRegisterLabels();
}

function refreshAuthIntentUi() {
  const role = getAuthIntentRole();
  const badge = document.getElementById('auth-intent-badge');
  const changeBtn = document.getElementById('auth-change-intent');
  const label = role && typeof roleLabel === 'function' ? roleLabel(role) : role;
  if (badge) {
    if (role && !authForgotMode) {
      badge.hidden = false;
      badge.removeAttribute('hidden');
      badge.textContent = `Perfil: ${label}`;
    } else {
      badge.hidden = true;
      badge.textContent = '';
    }
  }
  if (changeBtn) changeBtn.hidden = !role || authForgotMode;
  document.querySelectorAll('[data-role-card]').forEach((card) => {
    const pick = card.dataset.roleCard;
    card.classList.toggle('selected', Boolean(role) && pick === role);
  });
  if (role) syncAuthRoleFields(role);
}

function showWelcomeRoleStep() {
  const roles = document.getElementById('app-welcome-roles');
  if (roles) {
    roles.hidden = false;
    roles.removeAttribute('hidden');
  }
  refreshAuthIntentUi();
}

function setPanelSectionVisible(el, visible) {
  if (!el) return;
  if (visible) {
    el.hidden = false;
    el.removeAttribute('hidden');
  } else {
    el.hidden = true;
    el.setAttribute('hidden', '');
  }
}

function showAuthIntentStep(show) {
  setPanelSectionVisible(document.getElementById('auth-intent-step'), show);
  setPanelSectionVisible(document.getElementById('auth-form-wrap'), !show);
}

function pickAuthIntent(role) {
  const normalized = normalizeAuthIntentRole(role);
  if (!normalized) return;
  setAuthIntentRole(normalized);
  openAuthPanel(pendingAuthRegister, false, normalized);
}

function bindAuthIntentPickers() {
  if (bindAuthIntentPickers.bound) return;
  bindAuthIntentPickers.bound = true;
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-auth-intent]');
    if (!btn) return;
    const inAuthStep = btn.closest('#auth-intent-step');
    const inWelcome = btn.closest('#app-welcome-roles');
    if (inAuthStep?.hasAttribute('hidden')) return;
    if (inWelcome?.hasAttribute('hidden') || inWelcome?.hidden) return;
    e.preventDefault();
    pickAuthIntent(btn.dataset.authIntent);
  });
}

function checkAuthIntentMismatch(user) {
  const intent = getAuthIntentRole();
  if (!intent || !user?.role) return;
  const actual = typeof normalizeAppRole === 'function' ? normalizeAppRole(user.role) : user.role;
  if (actual === 'admin') return;
  if (actual !== intent) {
    const actualLabel = typeof roleLabel === 'function' ? roleLabel(actual) : actual;
    const intentLabel = typeof roleLabel === 'function' ? roleLabel(intent) : intent;
    alert(
      `Tu cuenta es de ${actualLabel}, pero entraste como ${intentLabel}. Puedes seguir; las opciones dependen de tu rol real en Cubik.`
    );
  }
}

function showAuthError(message) {
  const el = document.getElementById('auth-error');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  el.removeAttribute('hidden');
  const panel = document.getElementById('auth-panel');
  if (panel) {
    panel.hidden = false;
    panel.removeAttribute('hidden');
  }
  if (document.body.classList.contains('cubik-app')) {
    document.getElementById('app-welcome')?.setAttribute('hidden', '');
    const welcome = document.getElementById('app-welcome');
    if (welcome) welcome.hidden = true;
  } else {
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function notifyAuthFailure(message) {
  showAuthError(message);
  if (document.body.classList.contains('cubik-app')) {
    alert(message);
  }
}

function clearAuthError() {
  const el = document.getElementById('auth-error');
  if (!el) return;
  el.textContent = '';
  el.hidden = true;
}

function authErrorMessage(res, json, register) {
  const code = json?.code;
  if (code === 'email_not_found') {
    return 'No existe una cuenta con ese email. Pulsa «Crear cuenta» si es tu primera vez.';
  }
  if (code === 'wrong_password') {
    return 'Contraseña incorrecta. Revisa mayúsculas o usa «¿Olvidaste tu contraseña?»';
  }
  if (code === 'no_password') {
    return json?.error || 'Esta cuenta no tiene contraseña. Usa «¿Olvidaste tu contraseña?»';
  }
  let msg = json?.error || 'Error de autenticación';
  if (res.status === 409 && register) {
    msg =
      'Ese email ya tiene cuenta. Pulsa «Ya tengo cuenta — iniciar sesión» e ingresa tu contraseña.';
  } else if (res.status === 401 && !register && !code) {
    msg = 'Email o contraseña incorrectos. Revisa mayúsculas y que sean al menos 6 caracteres.';
  } else if (res.status === 503) {
    msg = 'El servidor no puede conectar con la base de datos. Intenta en unos minutos.';
  }
  return msg;
}

function updateRegisterLabels() {
  const role = document.getElementById('auth-role')?.value || getAuthIntentRole() || 'shipper';
  const companyLabel = document.getElementById('auth-company-label');
  const intro = document.getElementById('auth-register-intro');
  if (companyLabel) {
    companyLabel.textContent =
      role === 'carrier'
        ? 'Nombre transportista / flota'
        : 'Razón social embarcadora';
  }
  if (intro && authRegisterMode) intro.textContent = authIntentRegisterIntro(role);
}

function setRegisterFieldsRequired(register) {
  ['auth-company', 'auth-full-name'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.required = register;
  });
}

function setAuthMode(register, forgot = false) {
  authRegisterMode = register;
  authForgotMode = forgot;
  const panel = document.getElementById('auth-panel');
  const title = document.getElementById('auth-title');
  const formLogin = document.getElementById('form-auth');
  const formForgot = document.getElementById('form-forgot');
  const toggle = document.getElementById('auth-toggle-mode');
  const forgotLink = document.getElementById('auth-forgot-link');
  const backLogin = document.getElementById('auth-back-login');
  const rolePicker = document.getElementById('auth-role-picker');
  const intentRole = getAuthIntentRole();
  if (!panel) return;
  panel.classList.toggle('is-register', register && !forgot);
  panel.classList.toggle('is-forgot', forgot);
  panel.classList.toggle('has-auth-intent', Boolean(intentRole) && !forgot);
  setRegisterFieldsRequired(register && !forgot);
  clearAuthError();
  refreshAuthIntentUi();
  const forgotErr = document.getElementById('auth-forgot-error');
  if (forgotErr) {
    forgotErr.textContent = '';
    forgotErr.hidden = true;
  }
  if (forgot) {
    title.textContent = 'Recuperar contraseña';
    if (formLogin) formLogin.hidden = true;
    if (formForgot) formForgot.hidden = false;
    if (toggle) toggle.hidden = true;
    if (forgotLink) forgotLink.hidden = true;
    if (backLogin) backLogin.hidden = false;
    if (rolePicker) rolePicker.hidden = true;
  } else {
    if (formLogin) formLogin.hidden = false;
    if (formForgot) formForgot.hidden = true;
    if (toggle) {
      toggle.hidden = false;
      toggle.textContent = register ? 'Ya tengo cuenta — iniciar sesión' : '¿No tienes cuenta? Crear cuenta';
    }
    if (forgotLink) forgotLink.hidden = register;
    if (backLogin) backLogin.hidden = true;
    if (rolePicker) rolePicker.hidden = !register;
    if (intentRole) {
      title.textContent = authIntentHeadline(intentRole, register);
      syncAuthRoleFields(intentRole);
    } else {
      title.textContent = register ? 'Crear cuenta' : 'Iniciar sesión';
    }
    const submit = document.getElementById('auth-submit');
    if (submit) submit.textContent = register ? 'Registrarse' : 'Entrar';
    if (register) updateRegisterLabels();
  }
}

function closeAuthPanel() {
  const panel = document.getElementById('auth-panel');
  setPanelSectionVisible(panel, false);
  showAuthIntentStep(true);
  if (document.body.classList.contains('cubik-app') && !Auth.user) {
    const welcome = document.getElementById('app-welcome');
    if (welcome) welcome.hidden = false;
    showWelcomeRoleStep();
  }
}

function openAuthPanel(register = false, forgot = false, roleIntent = null) {
  const panel = document.getElementById('auth-panel');
  if (!panel) return;
  pendingAuthRegister = register;
  if (roleIntent) setAuthIntentRole(roleIntent);
  const intent = getAuthIntentRole();
  setPanelSectionVisible(panel, true);
  document.getElementById('change-password-panel')?.setAttribute('hidden', '');
  if (document.body.classList.contains('cubik-app')) {
    const welcome = document.getElementById('app-welcome');
    if (welcome) welcome.hidden = true;
  }
  if (forgot) {
    showAuthIntentStep(false);
    setAuthMode(false, true);
  } else if (!intent) {
    showAuthIntentStep(true);
    setAuthMode(register, false);
  } else {
    showAuthIntentStep(false);
    setAuthMode(register, false);
    if (!document.body.classList.contains('cubik-app')) {
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    setTimeout(() => {
      const email = document.querySelector('#form-auth [name="email"]');
      if (email && !authForgotMode) email.focus();
    }, 50);
  }
}

window.openAuthPanel = openAuthPanel;
window.setAuthIntentRole = setAuthIntentRole;
window.getAuthIntentRole = getAuthIntentRole;
window.clearAuthIntentRole = clearAuthIntentRole;
window.showWelcomeRoleStep = showWelcomeRoleStep;

document.getElementById('auth-role')?.addEventListener('change', updateRegisterLabels);

document.querySelectorAll('[data-role-pick]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const role = btn.dataset.rolePick;
    if (!role) return;
    setAuthIntentRole(role);
    updateRegisterLabels();
  });
});

document.getElementById('auth-change-intent')?.addEventListener('click', () => {
  clearAuthIntentRole();
  if (document.body.classList.contains('cubik-app') && !Auth.user) {
    closeAuthPanel();
    return;
  }
  pendingAuthRegister = authRegisterMode;
  showAuthIntentStep(true);
});

document.getElementById('auth-intent-cancel')?.addEventListener('click', () => {
  closeAuthPanel();
});

document.getElementById('btn-auth')?.addEventListener('click', () => {
  if (Auth.user) {
    Auth.logout();
    closeAuthPanel();
    return;
  }
  const panel = document.getElementById('auth-panel');
  if (!panel.hidden && !authRegisterMode) {
    closeAuthPanel();
    return;
  }
  openAuthPanel(false);
});

document.getElementById('btn-register')?.addEventListener('click', () => {
  if (Auth.user) return;
  openAuthPanel(true);
});

document.getElementById('auth-toggle-mode')?.addEventListener('click', () => {
  openAuthPanel(!authRegisterMode, false);
});

document.getElementById('auth-forgot-link')?.addEventListener('click', () => {
  const email = document.querySelector('#form-auth [name="email"]')?.value;
  openAuthPanel(false, true);
  const forgotEmail = document.querySelector('#form-forgot [name="email"]');
  if (forgotEmail && email) forgotEmail.value = email;
});

document.getElementById('auth-back-login')?.addEventListener('click', () => {
  openAuthPanel(false, false);
});

document.getElementById('form-forgot')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('auth-forgot-error');
  const btn = document.getElementById('auth-forgot-submit');
  const email = new FormData(e.target).get('email');
  if (errEl) errEl.hidden = true;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Enviando…';
  }
  try {
    const res = await apiFetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const json = await res.json();
    if (!res.ok && res.status !== 200) {
      if (errEl) {
        errEl.textContent = json.error || 'No se pudo enviar';
        errEl.hidden = false;
      }
      return;
    }
    let msg = json.message || 'Revisa tu correo.';
    if (json.dev_reset_url) {
      msg += `\n\n[Desarrollo] Enlace directo:\n${json.dev_reset_url}`;
    }
    alert(msg);
    openAuthPanel(false, false);
  } catch (err) {
    console.error(err);
    if (errEl) {
      errEl.textContent = 'No se pudo conectar.';
      errEl.hidden = false;
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Enviar enlace';
    }
  }
});

document.getElementById('btn-change-password')?.addEventListener('click', () => {
  if (!Auth.user) return;
  document.getElementById('auth-panel')?.setAttribute('hidden', '');
  const panel = document.getElementById('change-password-panel');
  if (panel) {
    panel.hidden = false;
    panel.removeAttribute('hidden');
    if (!document.body.classList.contains('cubik-app')) {
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
});

document.getElementById('change-password-cancel')?.addEventListener('click', () => {
  document.getElementById('change-password-panel')?.setAttribute('hidden', '');
});

document.getElementById('form-change-password')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('change-password-error');
  const fd = new FormData(e.target);
  const current = fd.get('current_password');
  const next = fd.get('new_password');
  const confirm = fd.get('new_password_confirm');
  if (next !== confirm) {
    if (errEl) {
      errEl.textContent = 'La nueva contraseña y la repetición no coinciden.';
      errEl.hidden = false;
    }
    return;
  }
  if (errEl) errEl.hidden = true;
  try {
    const res = await apiFetch('/api/auth/change-password', {
      method: 'POST',
      headers: Auth.headers(),
      body: JSON.stringify({ current_password: current, new_password: next }),
    });
    const json = await res.json();
    if (!res.ok) {
      if (errEl) {
        errEl.textContent = json.error || 'Error';
        errEl.hidden = false;
      }
      return;
    }
    alert(json.message || 'Contraseña actualizada.');
    e.target.reset();
    document.getElementById('change-password-panel')?.setAttribute('hidden', '');
  } catch (err) {
    console.error(err);
    if (errEl) {
      errEl.textContent = 'No se pudo conectar.';
      errEl.hidden = false;
    }
  }
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
    const intent = getAuthIntentRole();
    if (intent) body.role = intent;
    if (!body.role || !normalizeAuthIntentRole(body.role)) {
      showAuthError('Elige si eres transportista o empresa embarcadora');
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
    const res = await apiFetch(url, {
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
      notifyAuthFailure(msg);
      return;
    }
    Auth.save(json.token, json.user);
    try {
      const meRes = await apiFetch('/api/auth/me', { headers: Auth.headers() });
      const meJson = await meRes.json();
      if (meRes.ok && meJson.user) Auth.save(json.token, meJson.user);
    } catch (_) {}
    checkAuthIntentMismatch(Auth.user);
    document.getElementById('auth-panel').hidden = true;
    if (authRegisterMode && Auth.user?.kyc_status === 'pending' && Auth.user?.role !== 'admin') {
      alert(
        'Cuenta creada. Quedó en revisión: un administrador debe aprobarla antes de publicar o emparejar.'
      );
    }
    if (typeof Penalties !== 'undefined') Penalties.refresh();
  } catch (err) {
    console.error(err);
    notifyAuthFailure('No se pudo conectar con el servidor. Revisa tu internet e intenta de nuevo.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = prevLabel || (authRegisterMode ? 'Registrarse' : 'Entrar');
    }
  }
});

setAuthMode(false, false);
bindAuthIntentPickers();
const urlIntent = readAuthIntentFromUrl();
if (urlIntent) setAuthIntentRole(urlIntent);
if (document.body.classList.contains('cubik-app') && !Auth.user) {
  showWelcomeRoleStep();
}
Auth.render();
