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
    const token = this.token;
    if (token && typeof apiFetch === 'function' && typeof getAuthDevicePayload === 'function') {
      apiFetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(getAuthDevicePayload()),
      }).catch(() => {});
    }
    if (typeof clearRatedMatchIds === 'function') clearRatedMatchIds();
    this.token = null;
    this.user = null;
    localStorage.removeItem('ut_token');
    localStorage.removeItem('ut_user');
    if (typeof Comms !== 'undefined') Comms.resetUi();
    if (typeof Penalties !== 'undefined') Penalties.resetUi();
    showAuthOtpStep(false);
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
let pendingOtp = null;
let otpResendTimer = null;

function authDeviceBody(extra = {}) {
  const device =
    typeof getAuthDevicePayload === 'function' ? getAuthDevicePayload() : { device_id: null };
  return { ...device, ...extra };
}

function getOtpDigits() {
  return Array.from(document.querySelectorAll('.auth-otp-digit'));
}

function readOtpCodeFromDigits() {
  return getOtpDigits()
    .map((el) => el.value.replace(/\D/g, ''))
    .join('');
}

function clearOtpDigits() {
  getOtpDigits().forEach((el) => {
    el.value = '';
  });
  const err = document.getElementById('auth-otp-error');
  if (err) {
    err.textContent = '';
    err.hidden = true;
    err.setAttribute('hidden', '');
  }
}

function showOtpError(message) {
  const err = document.getElementById('auth-otp-error');
  if (!err) return;
  err.textContent = message;
  err.hidden = false;
  err.removeAttribute('hidden');
}

function clearOtpResendTimer() {
  if (otpResendTimer) {
    clearInterval(otpResendTimer);
    otpResendTimer = null;
  }
}

function updateOtpResendLabel(secondsLeft) {
  const btn = document.getElementById('auth-otp-resend');
  if (!btn) return;
  if (secondsLeft > 0) {
    btn.disabled = true;
    btn.textContent = `Reenviar en ${secondsLeft} s`;
  } else {
    btn.disabled = false;
    btn.textContent = 'Reenviar código';
  }
}

function startOtpResendCooldown(seconds) {
  clearOtpResendTimer();
  let left = Math.max(0, Number(seconds) || 60);
  updateOtpResendLabel(left);
  if (left <= 0) return;
  otpResendTimer = setInterval(() => {
    left -= 1;
    if (left <= 0) {
      clearOtpResendTimer();
      updateOtpResendLabel(0);
      return;
    }
    updateOtpResendLabel(left);
  }, 1000);
}

function showAuthOtpStep(show) {
  const step = document.getElementById('auth-otp-step');
  const form = document.getElementById('form-auth');
  const footer = document.querySelector('#auth-form-wrap .auth-login-footer');
  const toggle = document.getElementById('auth-role-toggle');
  const context = document.getElementById('auth-context');
  const title = document.getElementById('auth-title');
  setPanelSectionVisible(step, show);
  if (form) form.hidden = show;
  if (footer) footer.hidden = show;
  if (show) {
    if (toggle) {
      toggle.hidden = true;
      toggle.setAttribute('hidden', '');
    }
    if (context) {
      context.hidden = true;
      context.setAttribute('hidden', '');
    }
    const badge = document.getElementById('auth-app-role-badge');
    if (badge) {
      badge.hidden = true;
      badge.setAttribute('hidden', '');
    }
    if (title) title.hidden = true;
    setTimeout(() => getOtpDigits()[0]?.focus(), 50);
  } else {
    pendingOtp = null;
    clearOtpDigits();
    clearOtpResendTimer();
    updateOtpResendLabel(0);
    if (title) title.hidden = false;
    refreshAuthIntentUi();
  }
}

function openOtpStepFromLogin(json, email, password) {
  pendingOtp = {
    otp_id: json.otp_id,
    email: email.trim(),
    password,
    intent_role: getAuthIntentRole(),
  };
  const lead = document.getElementById('auth-otp-lead');
  if (lead) {
    lead.textContent =
      json.message ||
      `Enviamos un código de 4 dígitos a ${email}. Revisa bandeja y spam. Válido 10 minutos.`;
  }
  showAuthOtpStep(true);
  startOtpResendCooldown(60);
  if (json.dev_code) {
    const digits = String(json.dev_code).replace(/\D/g, '').slice(0, 4);
    getOtpDigits().forEach((el, i) => {
      el.value = digits[i] || '';
    });
  }
}

async function finishAuthLogin(json, register) {
  let userPayload = json.user;
  try {
    const meRes = await apiFetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${json.token}` },
    });
    const meJson = await meRes.json();
    if (meRes.ok && meJson.user) userPayload = meJson.user;
  } catch (_) {}
  if (blockAuthIntentMismatch(userPayload)) return;
  Auth.save(json.token, userPayload);
  showAuthOtpStep(false);
  document.getElementById('auth-panel').hidden = true;
  if (register && Auth.user?.kyc_status === 'pending' && Auth.user?.role !== 'admin') {
    alert(
      'Cuenta creada. Quedó en revisión: un administrador debe aprobarla antes de publicar o emparejar.'
    );
  }
  if (typeof Penalties !== 'undefined') Penalties.refresh();
}

const AUTH_INTENT_KEY = 'ut_auth_intent_role';

const AUTH_CONTEXT_COPY = {
  carrier: {
    icon: '🚛',
    role: 'Transportista',
    taglineLogin: 'Encuentra carga para aprovechar tu ruta',
    taglineRegister: 'Registra tu flota y conecta con cargas en tu ruta',
    flowSrc: '/brand/welcome/auth-flow-carrier.svg',
  },
  shipper: {
    icon: '📦',
    role: 'Empresa',
    taglineLogin: 'Encuentra transporte disponible cuando lo necesites',
    taglineRegister: 'Publica cargas y empareja con transportistas',
    flowSrc: '/brand/welcome/auth-flow-shipper.svg',
  },
};

const AUTH_ROLE_SVG = {
  carrier:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17h4"/><path d="M3 17h2"/><path d="M19 17h2"/><path d="M5 17H3v-5l2-4h10v9"/><path d="M14 8h3l3 4v5h-2"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/></svg>',
  shipper:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/></svg>',
};

function renderAuthRoleIcon(el, role) {
  if (!el) return;
  const normalized = normalizeAuthIntentRole(role);
  el.innerHTML = normalized ? AUTH_ROLE_SVG[normalized] || '' : '';
}

function normalizeAuthIntentRole(raw) {
  const r = String(raw ?? '')
    .toLowerCase()
    .trim();
  if (!r) return null;
  if (r === 'carrier' || r === 'transportista' || r === 'transportador') return 'carrier';
  if (r === 'shipper' || r === 'embarcador' || r === 'embarcadora') return 'shipper';
  return null;
}

function readAuthIntentFromUrl() {
  try {
    const q = new URLSearchParams(window.location.search);
    const raw = q.get('rol') ?? q.get('role');
    if (raw == null || raw === '') return null;
    return normalizeAuthIntentRole(raw);
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

function syncAuthRoleToggle(role) {
  const toggle = document.getElementById('auth-role-toggle');
  if (!toggle) return;
  if (isAppRouteGuest()) {
    toggle.hidden = true;
    toggle.setAttribute('hidden', '');
    delete toggle.dataset.active;
    return;
  }
  if (role && !authForgotMode) {
    toggle.hidden = false;
    toggle.removeAttribute('hidden');
    toggle.dataset.active = role;
    toggle.querySelectorAll('[data-auth-toggle]').forEach((btn) => {
      const active = btn.dataset.authToggle === role;
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  } else {
    toggle.hidden = true;
    toggle.setAttribute('hidden', '');
    delete toggle.dataset.active;
  }
}

function switchAuthIntentRole(role) {
  const normalized = normalizeAuthIntentRole(role);
  if (!normalized) return;
  setAuthIntentRole(normalized);
  setAuthMode(authRegisterMode, false);
}

function syncAuthContext(role) {
  const ctx = document.getElementById('auth-context');
  const title = document.getElementById('auth-title');
  const panel = document.getElementById('auth-panel');
  const badge = document.getElementById('auth-app-role-badge');
  const badgeLabel = document.getElementById('auth-app-role-label');
  const badgeIcon = document.getElementById('auth-app-role-icon');
  const cfg = role ? AUTH_CONTEXT_COPY[role] : null;

  if (isAppRouteGuest()) {
    if (ctx) {
      ctx.hidden = true;
      ctx.setAttribute('hidden', '');
      delete ctx.dataset.role;
    }
    if (badge) {
      if (cfg && !authForgotMode) {
        badge.hidden = false;
        badge.removeAttribute('hidden');
        badge.dataset.role = role;
        badge.classList.toggle('auth-app-role-badge--carrier', role === 'carrier');
        badge.classList.toggle('auth-app-role-badge--shipper', role === 'shipper');
        if (badgeLabel) badgeLabel.textContent = cfg.role;
        renderAuthRoleIcon(badgeIcon, role);
      } else {
        badge.hidden = true;
        badge.setAttribute('hidden', '');
        delete badge.dataset.role;
        badge.classList.remove('auth-app-role-badge--carrier', 'auth-app-role-badge--shipper');
        if (badgeIcon) badgeIcon.innerHTML = '';
      }
    }
    if (title && !authForgotMode) {
      title.textContent = authRegisterMode ? 'Crear cuenta' : 'Iniciar sesión';
      title.classList.remove('auth-title-sr');
      title.hidden = false;
    }
    if (panel) {
      if (role) panel.dataset.authRole = role;
      else delete panel.dataset.authRole;
    }
    return;
  }
  if (badge) {
    badge.hidden = true;
    badge.setAttribute('hidden', '');
    delete badge.dataset.role;
    badge.classList.remove('auth-app-role-badge--carrier', 'auth-app-role-badge--shipper');
    if (badgeIcon) badgeIcon.innerHTML = '';
  }
  if (!ctx) return;
  if (cfg && !authForgotMode) {
    ctx.hidden = false;
    ctx.removeAttribute('hidden');
    ctx.dataset.role = role;
    const iconEl = document.getElementById('auth-context-icon');
    const roleEl = document.getElementById('auth-context-role');
    const taglineEl = document.getElementById('auth-context-tagline');
    const flowEl = document.getElementById('auth-context-flow');
    if (iconEl) iconEl.textContent = cfg.icon;
    if (roleEl) roleEl.textContent = cfg.role;
    if (taglineEl) {
      taglineEl.textContent = authRegisterMode ? cfg.taglineRegister : cfg.taglineLogin;
    }
    if (flowEl) flowEl.src = cfg.flowSrc;
    if (title) {
      title.textContent = authIntentHeadline(role, authRegisterMode);
      title.classList.add('auth-title-sr');
    }
    if (panel) panel.dataset.authRole = role;
  } else {
    ctx.hidden = true;
    ctx.setAttribute('hidden', '');
    delete ctx.dataset.role;
    if (title) title.classList.remove('auth-title-sr');
    if (panel) delete panel.dataset.authRole;
  }
}

function refreshAuthIntentUi() {
  const role = getAuthIntentRole();
  syncAuthRoleToggle(role);
  syncAuthContext(role);
  document.querySelectorAll('[data-role-card]').forEach((card) => {
    const pick = card.dataset.roleCard;
    card.classList.toggle('selected', Boolean(role) && pick === role);
  });
  document.querySelectorAll('.app-welcome-role-btn[data-auth-intent]').forEach((btn) => {
    btn.classList.toggle('selected', Boolean(role) && btn.dataset.authIntent === role);
  });
  if (role) syncAuthRoleFields(role);
}

function showWelcomeRoleStep() {
  const welcome = document.getElementById('app-welcome');
  if (welcome) {
    welcome.hidden = false;
    welcome.removeAttribute('hidden');
  }
  const roles = document.getElementById('app-welcome-roles');
  if (roles) {
    roles.hidden = false;
    roles.removeAttribute('hidden');
  }
  bindWelcomeAuthButtons();
  bindWelcomeSignIn();
  bindWelcomeRegister();
  refreshAuthIntentUi();
  const role = readAuthIntentFromUrl();
  const appEntry =
    (location.pathname || '').replace(/\/$/, '') === '/app' ||
    new URLSearchParams(location.search).get('app') === '1';
  if (role && appEntry && isCubikAppGuest()) {
    pickAuthIntent(role);
  }
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

function isCubikAppGuest() {
  return document.body.classList.contains('cubik-app') && !Auth.user;
}

function isAppRouteOnly() {
  const path = (location.pathname || '/').replace(/\/$/, '') || '/';
  return path === '/app';
}

/** Login simplificado solo en https://…/app (no en ?app=1 ni web principal). */
function isAppRouteGuest() {
  return isAppRouteOnly() && isCubikAppGuest();
}

function showAuthIntentStep(show) {
  if (isCubikAppGuest()) show = false;
  setPanelSectionVisible(document.getElementById('auth-intent-step'), show);
  setPanelSectionVisible(document.getElementById('auth-form-wrap'), !show);
}

function isAuthFormEmpty() {
  const form = document.getElementById('form-auth');
  if (!form) return true;
  const email = form.querySelector('[name="email"]')?.value?.trim();
  const password = form.querySelector('[name="password"]')?.value;
  if (email || password) return false;
  if (authRegisterMode) {
    const company = form.querySelector('[name="company_name"]')?.value?.trim();
    const fullName = form.querySelector('[name="full_name"]')?.value?.trim();
    const phone = form.querySelector('[name="phone"]')?.value?.trim();
    if (company || fullName || phone) return false;
  }
  return true;
}

function handleAuthBackNavigation() {
  const panel = document.getElementById('auth-panel');
  if (!panel || panel.hidden) return false;
  const otpStep = document.getElementById('auth-otp-step');
  if (otpStep && !otpStep.hidden) {
    showAuthOtpStep(false);
    setAuthMode(false, false);
    return true;
  }
  if (authForgotMode) {
    openAuthPanel(false, false);
    return true;
  }
  if (!isAuthFormEmpty()) return false;
  closeAuthPanel();
  return true;
}

function showAppWelcome() {
  const welcome = document.getElementById('app-welcome');
  if (welcome) {
    welcome.hidden = false;
    welcome.removeAttribute('hidden');
  }
  showWelcomeRoleStep();
}

function pickAuthIntent(role) {
  const normalized = normalizeAuthIntentRole(role);
  if (!normalized) return;
  setAuthIntentRole(normalized);
  openAuthPanel(pendingAuthRegister, false, normalized);
}

function openWelcomeSignIn() {
  const role = getAuthIntentRole();
  if (role) {
    openAuthPanel(false, false, role);
    return;
  }
  pulseWelcomeRolePick();
}

function openWelcomeRegister() {
  const role = getAuthIntentRole();
  if (role) {
    openAuthPanel(true, false, role);
    return;
  }
  pulseWelcomeRolePick();
}

function pulseWelcomeRolePick() {
  const rolesEl = document.getElementById('app-welcome-roles');
  if (rolesEl) {
    rolesEl.classList.add('app-welcome-needs-role');
    window.setTimeout(() => rolesEl.classList.remove('app-welcome-needs-role'), 2400);
  }
}

function bindWelcomeSignIn() {
  const btn = document.getElementById('app-welcome-signin');
  if (!btn || btn.dataset.welcomeBound === '1') return;
  btn.dataset.welcomeBound = '1';
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    openWelcomeSignIn();
  });
}

function bindWelcomeRegister() {
  const btn = document.getElementById('app-welcome-register');
  if (!btn || btn.dataset.welcomeBound === '1') return;
  btn.dataset.welcomeBound = '1';
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    openWelcomeRegister();
  });
}

function bindWelcomeAuthButtons() {
  document.querySelectorAll('#app-welcome-roles [data-auth-intent]').forEach((btn) => {
    if (btn.dataset.welcomeBound === '1') return;
    btn.dataset.welcomeBound = '1';
    const go = (e) => {
      e.preventDefault();
      e.stopPropagation();
      pickAuthIntent(btn.dataset.authIntent);
    };
    btn.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      go(e);
    });
  });
}

function bindAuthIntentPickers() {
  bindWelcomeAuthButtons();
  if (bindAuthIntentPickers.bound) return;
  bindAuthIntentPickers.bound = true;
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-auth-intent]');
    if (!btn) return;
    const inAuthStep = btn.closest('#auth-intent-step');
    const inWelcome = btn.closest('#app-welcome-roles');
    if (inAuthStep?.hasAttribute('hidden')) return;
    if (inWelcome) {
      if (inWelcome.hasAttribute('hidden') || inWelcome.hidden) return;
      e.preventDefault();
      pickAuthIntent(btn.dataset.authIntent);
      return;
    }
    e.preventDefault();
    pickAuthIntent(btn.dataset.authIntent);
  });
}

function blockAuthIntentMismatch(user) {
  const intent = getAuthIntentRole();
  if (!intent || !user?.role) return false;
  const actual = typeof normalizeAppRole === 'function' ? normalizeAppRole(user.role) : user.role;
  if (actual === 'admin' || actual === intent) return false;
  const actualLabel = typeof roleLabel === 'function' ? roleLabel(actual) : actual;
  switchAuthIntentRole(actual);
  const pwdField = document.querySelector('#form-auth [name="password"]');
  if (pwdField) pwdField.value = '';
  if (isAppRouteGuest()) {
    closeAuthPanel();
    const rolesEl = document.getElementById('app-welcome-roles');
    rolesEl?.classList.add('app-welcome-needs-role');
    window.setTimeout(() => rolesEl?.classList.remove('app-welcome-needs-role'), 2400);
    notifyAuthFailure(
      `Esta cuenta es de ${actualLabel}. Pulsa «Soy ${actual === 'carrier' ? 'transportista' : 'empresa'}» e ingresa de nuevo.`
    );
    return true;
  }
  showAuthError(
    `Esta cuenta es de ${actualLabel}. Cambiamos la pestaña de arriba — vuelve a ingresar tu contraseña.`
  );
  const panel = document.getElementById('auth-panel');
  if (panel) {
    panel.hidden = false;
    panel.removeAttribute('hidden');
  }
  return true;
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
  if (code === 'wrong_otp') {
    return 'Código incorrecto. Revisa los 4 dígitos o pide uno nuevo.';
  }
  if (code === 'role_mismatch') {
    if (json?.actual_role) switchAuthIntentRole(json.actual_role);
    return (
      json?.error ||
      'Esta cuenta no coincide con la pestaña elegida. Cambiamos la pestaña — vuelve a ingresar tu contraseña.'
    );
  }
  let msg = json?.error || 'Error de autenticación';
  if (res.status === 429 && json?.wait_seconds) {
    return msg || `Espera ${json.wait_seconds} s antes de pedir otro código.`;
  }
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
  if (!forgot) showAuthOtpStep(false);
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
      syncAuthRoleFields(intentRole);
    } else {
      title.textContent = register ? 'Crear cuenta' : 'Iniciar sesión';
      title.classList.remove('auth-title-sr');
    }
    const submit = document.getElementById('auth-submit');
    if (submit) {
      submit.textContent = register ? 'Registrarse' : isAppRouteGuest() ? 'Iniciar sesión' : 'Entrar';
    }
    if (register) updateRegisterLabels();
  }
}

function closeAuthPanel() {
  const panel = document.getElementById('auth-panel');
  setPanelSectionVisible(panel, false);
  clearAuthError();
  if (isCubikAppGuest()) {
    showAuthIntentStep(false);
    showAppWelcome();
  } else {
    showAuthIntentStep(true);
  }
}

function openAuthPanel(register = false, forgot = false, roleIntent = null) {
  const panel = document.getElementById('auth-panel');
  if (!panel) return;
  if (typeof AppShell?.mountAuthInGate === 'function') AppShell.mountAuthInGate();
  pendingAuthRegister = register;
  if (roleIntent) setAuthIntentRole(roleIntent);
  const intent = getAuthIntentRole();
  setPanelSectionVisible(panel, true);
  document.getElementById('change-password-panel')?.setAttribute('hidden', '');
  if (isCubikAppGuest()) {
    const welcome = document.getElementById('app-welcome');
    if (welcome) {
      welcome.hidden = true;
      welcome.setAttribute('hidden', '');
    }
    const gate = document.getElementById('app-gate');
    if (gate) {
      gate.hidden = false;
      gate.removeAttribute('hidden');
    }
  }
  if (forgot) {
    showAuthIntentStep(false);
    setAuthMode(false, true);
  } else if (!intent) {
    if (isCubikAppGuest()) {
      closeAuthPanel();
      return;
    }
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
window.pickAuthIntent = pickAuthIntent;
window.setAuthIntentRole = setAuthIntentRole;
window.getAuthIntentRole = getAuthIntentRole;
window.clearAuthIntentRole = clearAuthIntentRole;
window.showWelcomeRoleStep = showWelcomeRoleStep;
window.handleAuthBackNavigation = handleAuthBackNavigation;

document.getElementById('auth-role')?.addEventListener('change', updateRegisterLabels);

document.querySelectorAll('[data-role-pick]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const role = btn.dataset.rolePick;
    if (!role) return;
    setAuthIntentRole(role);
    updateRegisterLabels();
  });
});

document.getElementById('auth-role-toggle')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-auth-toggle]');
  if (!btn) return;
  const role = btn.dataset.authToggle;
  if (!role || role === getAuthIntentRole()) return;
  switchAuthIntentRole(role);
});

document.getElementById('auth-intent-cancel')?.addEventListener('click', () => {
  closeAuthPanel();
});

document.getElementById('auth-app-back')?.addEventListener('click', () => {
  if (typeof handleAuthBackNavigation === 'function') handleAuthBackNavigation();
});

document.getElementById('auth-password-toggle')?.addEventListener('click', () => {
  const input = document.getElementById('auth-password');
  const btn = document.getElementById('auth-password-toggle');
  if (!input || !btn) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.setAttribute('aria-pressed', show ? 'true' : 'false');
  btn.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
  btn.querySelector('.auth-eye-open')?.toggleAttribute('hidden', show);
  btn.querySelector('.auth-eye-closed')?.toggleAttribute('hidden', !show);
});

document.getElementById('btn-auth')?.addEventListener('click', () => {
  if (Auth.user) {
    Auth.logout();
    closeAuthPanel();
    return;
  }
  if (isCubikAppGuest()) {
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
    if (!res.ok) {
      if (errEl) {
        errEl.textContent = json.error || json.detail || 'No se pudo enviar';
        errEl.hidden = false;
      }
      return;
    }
    let msg = json.message || 'Revisa tu correo.';
    if (json.throttled) {
      alert(msg);
      return;
    }
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
  if (typeof AppShell?.openChangePassword === 'function') {
    AppShell.openChangePassword();
    return;
  }
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
  if (typeof AppShell?.closeChangePassword === 'function') {
    AppShell.closeChangePassword();
    return;
  }
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
  if (typeof PasswordPolicy !== 'undefined') {
    const policy = PasswordPolicy.validate(next);
    if (!policy.ok) {
      if (errEl) {
        errEl.textContent = policy.error;
        errEl.hidden = false;
      }
      return;
    }
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
    if (typeof AppShell?.closeChangePassword === 'function') AppShell.closeChangePassword();
    else document.getElementById('change-password-panel')?.setAttribute('hidden', '');
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
      showAuthError(
        authRegisterMode
          ? 'La contraseña debe cumplir los requisitos de seguridad (8+ caracteres, letra, mayúscula y número).'
          : 'Revisa email y contraseña.'
      );
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
    if (typeof PasswordPolicy !== 'undefined') {
      const policy = PasswordPolicy.validate(body.password);
      if (!policy.ok) {
        showAuthError(policy.error);
        return;
      }
    }
  } else {
    const intent = getAuthIntentRole();
    if (intent) body.intent_role = intent;
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
  const payload = authDeviceBody(body);
  try {
    const res = await apiFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    let json = {};
    try {
      json = await res.json();
    } catch {
      json = {};
    }
    if (!res.ok) {
      const msg = authErrorMessage(res, json, authRegisterMode);
      if (json?.code === 'role_mismatch') {
        showAuthOtpStep(false);
        const pwdField = document.querySelector('#form-auth [name="password"]');
        if (pwdField) pwdField.value = '';
      }
      notifyAuthFailure(msg);
      return;
    }
    if (!authRegisterMode && json.need_otp) {
      if (blockAuthIntentMismatch(json.user)) return;
      openOtpStepFromLogin(json, body.email, body.password);
      return;
    }
    await finishAuthLogin(json, authRegisterMode);
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

async function submitOtpVerification() {
  if (!pendingOtp?.otp_id) {
    showOtpError('Vuelve a iniciar sesión para recibir un código nuevo.');
    return;
  }
  const code = readOtpCodeFromDigits();
  if (code.length !== 4) {
    showOtpError('Ingresa los 4 dígitos del correo.');
    return;
  }
  const btn = document.getElementById('auth-otp-submit');
  const prev = btn?.textContent;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Verificando…';
  }
  try {
    const res = await apiFetch('/api/auth/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        authDeviceBody({
          otp_id: pendingOtp.otp_id,
          code,
          email: pendingOtp.email,
          password: pendingOtp.password,
          intent_role: pendingOtp.intent_role,
        })
      ),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      showOtpError(authErrorMessage(res, json, false));
      return;
    }
    await finishAuthLogin(json, false);
  } catch (err) {
    console.error(err);
    showOtpError('No se pudo conectar. Revisa tu internet e intenta de nuevo.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = prev || 'Siguiente →';
    }
  }
}

document.getElementById('auth-otp-submit')?.addEventListener('click', () => {
  submitOtpVerification();
});

document.getElementById('auth-otp-back')?.addEventListener('click', () => {
  showAuthOtpStep(false);
  setAuthMode(false, false);
});

document.getElementById('auth-otp-resend')?.addEventListener('click', async () => {
  if (!pendingOtp?.email || !pendingOtp?.password) return;
  const btn = document.getElementById('auth-otp-resend');
  if (btn?.disabled) return;
  try {
    const res = await apiFetch('/api/auth/otp/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        authDeviceBody({
          email: pendingOtp.email,
          password: pendingOtp.password,
          intent_role: pendingOtp.intent_role,
        })
      ),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      showOtpError(authErrorMessage(res, json, false));
      if (json.wait_seconds) startOtpResendCooldown(json.wait_seconds);
      return;
    }
    pendingOtp.otp_id = json.otp_id;
    const lead = document.getElementById('auth-otp-lead');
    if (lead && json.message) lead.textContent = json.message;
    clearOtpDigits();
    startOtpResendCooldown(json.wait_seconds || 60);
    if (json.dev_code) {
      const digits = String(json.dev_code).replace(/\D/g, '').slice(0, 4);
      getOtpDigits().forEach((el, i) => {
        el.value = digits[i] || '';
      });
    }
    getOtpDigits()[0]?.focus();
  } catch (err) {
    console.error(err);
    showOtpError('No se pudo reenviar el código.');
  }
});

getOtpDigits().forEach((input, idx, all) => {
  input.addEventListener('input', () => {
    const v = input.value.replace(/\D/g, '').slice(-1);
    input.value = v;
    if (v && idx < all.length - 1) all[idx + 1].focus();
    if (readOtpCodeFromDigits().length === 4) submitOtpVerification();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !input.value && idx > 0) all[idx - 1].focus();
  });
  input.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 4);
    if (!text) return;
    all.forEach((el, i) => {
      el.value = text[i] || '';
    });
    all[Math.min(text.length, all.length - 1)]?.focus();
    if (text.length === 4) submitOtpVerification();
  });
});

setAuthMode(false, false);
bindAuthIntentPickers();
try {
  const stored = sessionStorage.getItem(AUTH_INTENT_KEY);
  if (stored && !normalizeAuthIntentRole(stored)) {
    sessionStorage.removeItem(AUTH_INTENT_KEY);
  }
} catch (_) {}
const urlIntent = readAuthIntentFromUrl();
if (urlIntent) setAuthIntentRole(urlIntent);
if (document.body.classList.contains('cubik-app') && !Auth.user) {
  showWelcomeRoleStep();
}

(function initPasswordStrength() {
  const registerPw = document.querySelector('#form-auth input[name="password"]');
  const changePw = document.querySelector('#form-change-password input[name="new_password"]');
  if (typeof PasswordStrengthUI === 'undefined') return;
  if (registerPw) {
    PasswordStrengthUI.attach(registerPw, { showWhen: () => authRegisterMode });
  }
  if (changePw) PasswordStrengthUI.attach(changePw);
})();

Auth.render();
