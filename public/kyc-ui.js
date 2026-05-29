/** Cuentas aprobadas — marketplace semi-curado */

function isOperatorApproved() {
  if (typeof Auth === 'undefined' || !Auth.user) return true;
  if (Auth.user.role === 'admin') return true;
  return Auth.user.kyc_status === 'approved';
}

function kycStatusLabel(status) {
  if (status === 'approved') return 'Aprobada';
  if (status === 'rejected') return 'Rechazada';
  return 'En revisión';
}

function renderKycBanner() {
  const el = document.getElementById('kyc-banner');
  if (!el) return;
  const user = typeof Auth !== 'undefined' ? Auth.user : null;
  if (!user || user.role === 'admin') {
    el.hidden = true;
    document.body.classList.remove('kyc-pending');
    return;
  }
  if (user.kyc_status === 'approved') {
    el.hidden = true;
    document.body.classList.remove('kyc-pending');
    return;
  }
  el.hidden = false;
  document.body.classList.add('kyc-pending');
  const msg =
    user.kyc_status === 'rejected'
      ? 'Tu cuenta no está habilitada para operar en el piloto. Escríbenos si crees que es un error.'
      : 'Tu cuenta está <strong>en revisión</strong>. Puedes explorar la app, pero aún no puedes publicar cargas, ofertas ni emparejar hasta que un administrador te apruebe.';
  el.innerHTML = `<div class="kyc-banner-inner"><p>${msg}</p><p class="muted">Estado: ${kycStatusLabel(user.kyc_status)}</p></div>`;
}

function assertCanOperate() {
  if (!isOperatorApproved()) {
    const user = Auth.user;
    const text =
      user?.kyc_status === 'rejected'
        ? 'Tu cuenta no fue aprobada para operar.'
        : 'Tu cuenta aún no está aprobada. Espera la confirmación del administrador.';
    alert(text);
    return false;
  }
  const blocked = typeof Penalties !== 'undefined' && Penalties.summary?.operating_status?.blocked;
  if (blocked) {
    alert(
      Penalties.summary.operating_status.message ||
        'Tienes multas vencidas. No puedes tomar nuevos viajes hasta regularizar.'
    );
    return false;
  }
  return true;
}

function handleApiKycError(res, json) {
  if (res?.status === 403 && json?.penalty_block) {
    if (typeof Penalties !== 'undefined') Penalties.refresh();
    alert(json.error || 'Multas vencidas: operación bloqueada');
    return true;
  }
  if (res?.status === 403 && json?.kyc_status) {
    if (typeof Auth !== 'undefined' && Auth.user) {
      Auth.user.kyc_status = json.kyc_status;
      Auth.render?.();
    }
    alert(json.error || 'Cuenta no aprobada');
    return true;
  }
  return false;
}

window.isOperatorApproved = isOperatorApproved;
window.renderKycBanner = renderKycBanner;
window.assertCanOperate = assertCanOperate;
window.handleApiKycError = handleApiKycError;
