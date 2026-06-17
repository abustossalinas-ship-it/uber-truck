/** Cuentas aprobadas — marketplace semi-curado */

let carrierWhatsAppUrl = null;

async function loadCarrierWhatsAppUrl() {
  if (carrierWhatsAppUrl) return carrierWhatsAppUrl;
  try {
    const res = await fetch('/api/prospectos/config');
    const json = await res.json();
    carrierWhatsAppUrl = json?.whatsapp?.urls?.carrier || null;
  } catch (_e) {
    carrierWhatsAppUrl = null;
  }
  return carrierWhatsAppUrl;
}

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

async function renderKycBanner() {
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
  let extra = '';
  if (user.role === 'carrier' && user.kyc_status === 'pending') {
    const wa = await loadCarrierWhatsAppUrl();
    extra = wa
      ? `<p class="muted">Piloto: envía CI, licencia, SOAP y seguro por <a href="${wa}" target="_blank" rel="noopener">WhatsApp Cubik</a> (mismo email de la app). Escribe <strong>documentos</strong> al bot.</p>`
      : '<p class="muted">Piloto: envía CI, licencia, SOAP y seguro por WhatsApp Cubik (mismo email de la app).</p>';
  }
  const msg =
    user.kyc_status === 'rejected'
      ? 'Tu cuenta no está habilitada para operar en el piloto. Escríbenos si crees que es un error.'
      : 'Tu cuenta está <strong>en revisión</strong>. Puedes explorar la app, pero aún no puedes publicar cargas, ofertas ni emparejar hasta que un administrador te apruebe.';
  el.innerHTML = `<div class="kyc-banner-inner"><p>${msg}</p>${extra}<p class="muted">Estado: ${kycStatusLabel(user.kyc_status)}</p></div>`;
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
  const bankRequired =
    typeof Penalties !== 'undefined' && Penalties.summary?.bank_required_for_operate;
  if (bankRequired) {
    alert(
      'Debes inscribir tu cuenta bancaria antes de operar. Ve a Cuenta y multas → Inscribir cuenta bancaria.'
    );
    document.getElementById('account-penalties-panel')?.scrollIntoView({ behavior: 'smooth' });
    if (typeof Penalties !== 'undefined') Penalties.openBankModal();
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
  if (res?.status === 403 && json?.bank_required) {
    if (typeof Penalties !== 'undefined') {
      Penalties.refresh();
      Penalties.openBankModal();
    }
    alert(json.error || 'Inscribe tu cuenta bancaria para operar.');
    return true;
  }
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
