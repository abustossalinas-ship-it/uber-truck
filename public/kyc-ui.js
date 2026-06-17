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
  if (Auth.user.docs_compliance_status === 'expired' || Auth.user.kyc_phase === 'docs_expired') {
    return false;
  }
  return Auth.user.kyc_status === 'approved';
}

function kycStatusLabel(status) {
  if (status === 'approved') return 'Aprobada';
  if (status === 'rejected') return 'Rechazada';
  return 'En revisión';
}

function carrierPhaseLabel(phase) {
  if (phase === 'docs_expired') return 'Documentación vencida — cuenta bloqueada';
  if (phase === 'docs_pending') return 'Pendiente: documentación';
  if (phase === 'admin_review') return 'Documentación recibida — revisión Cubik';
  if (phase === 'rejected') return 'Cuenta no habilitada';
  return 'Validación en curso';
}

function carrierTourSteps(user) {
  const progress = user.onboarding_progress;
  const phase = user.kyc_phase || 'docs_pending';
  const done = progress?.done ?? 0;
  const total = progress?.total ?? 7;

  const docsState =
    phase === 'approved' || phase === 'admin_review'
      ? 'done'
      : done > 0
        ? 'partial'
        : 'active';

  return [
    {
      id: 'register',
      num: 1,
      title: 'Cuenta creada',
      tool: 'App getcubik.cl',
      hint: 'Email y rol transportista',
      state: 'done',
    },
    {
      id: 'docs',
      num: 2,
      title: 'Documentación',
      tool: 'WhatsApp Cubik',
      hint:
        phase === 'admin_review' || phase === 'approved'
          ? 'Recibimos tus documentos'
          : `${done}/${total} ítems marcados por Cubik`,
      state: docsState,
    },
    {
      id: 'review',
      num: 3,
      title: 'Revisión Cubik',
      tool: 'Equipo validación',
      hint: 'Hasta 24 h hábiles tras docs completos',
      state: phase === 'admin_review' ? 'active' : phase === 'approved' ? 'done' : 'pending',
    },
    {
      id: 'operate',
      num: 4,
      title: 'Operar en marketplace',
      tool: 'App Cubik',
      hint: 'Ofertar rutas y emparejar cargas',
      state: phase === 'approved' ? 'done' : 'pending',
    },
  ];
}

function renderCarrierTourHtml(user, waUrl) {
  const steps = carrierTourSteps(user);
  const phase = user.kyc_phase || 'docs_pending';
  const rows = steps
    .map((step) => {
      let action = '';
      if (step.id === 'docs' && (step.state === 'active' || step.state === 'partial')) {
        if (waUrl) {
          action = `<a class="kyc-tour-cta" href="${waUrl}" target="_blank" rel="noopener">Abrir WhatsApp</a>`;
        }
        action +=
          '<span class="kyc-tour-tip">Al bot escribe <strong>documentos</strong> o elige opción <strong>6</strong></span>';
      }
      return `
        <li class="kyc-tour-step kyc-tour-step--${step.state}">
          <span class="kyc-tour-num" aria-hidden="true">${step.num}</span>
          <div class="kyc-tour-body">
            <strong>${step.title}</strong>
            <span class="kyc-tour-tool">${step.tool}</span>
            <span class="kyc-tour-hint">${step.hint}</span>
            ${action}
          </div>
        </li>`;
    })
    .join('');

  const future =
    '<p class="kyc-tour-future muted">Próximamente: subir CI, licencia y póliza en la app con verificación automática (O1–O2).</p>';

  return `
    <div class="kyc-tour">
      <p class="kyc-tour-head"><strong>${carrierPhaseLabel(phase)}</strong></p>
      <ol class="kyc-tour-steps">${rows}</ol>
      ${future}
    </div>`;
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
    const docsExpired =
      user.docs_compliance_status === 'expired' || user.kyc_phase === 'docs_expired';
    if (!docsExpired) {
      el.hidden = true;
      document.body.classList.remove('kyc-pending');
      return;
    }
  }
  el.hidden = false;
  document.body.classList.add('kyc-pending');

  const docsExpired =
    user.docs_compliance_status === 'expired' || user.kyc_phase === 'docs_expired';

  if (user.role === 'carrier' && (user.kyc_status === 'pending' || docsExpired)) {
    const wa = await loadCarrierWhatsAppUrl();
    const tour = renderCarrierTourHtml(user, wa);
    const msg = docsExpired
      ? 'Tu documentación venció y no puedes operar. Solo puedes actualizar documentos por WhatsApp Cubik (escribe <strong>documentos</strong> e indica tu RUT).'
      : 'Completa la validación para operar. Sigue el tour: cada paso indica qué herramienta usar (app o WhatsApp).';
    el.innerHTML = `<div class="kyc-banner-inner kyc-banner-inner--blocked"><p>${msg}</p>${tour}<p class="muted">Estado KYC: ${kycStatusLabel(user.kyc_status)} · Docs: ${user.docs_compliance_status || '—'}</p></div>`;
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
      : 'Tu cuenta está <strong>en revisión</strong>. Puedes explorar la app, pero aún no puedes publicar cargas ni emparejar hasta que un administrador te apruebe.';
  el.innerHTML = `<div class="kyc-banner-inner"><p>${msg}</p><p class="muted">Estado: ${kycStatusLabel(user.kyc_status)}</p></div>`;
}

function assertCanOperate() {
  if (!isOperatorApproved()) {
    const user = Auth.user;
    let text =
      user?.kyc_status === 'rejected'
        ? 'Tu cuenta no fue aprobada para operar.'
        : 'Tu cuenta aún no está aprobada. Espera la confirmación del administrador.';
    if (user?.role === 'carrier' && user?.kyc_phase === 'docs_expired') {
      text =
        'Documentación vencida. Actualiza CI, licencia o seguro por WhatsApp Cubik (escribe documentos e indica tu RUT).';
    } else if (user?.role === 'carrier' && user?.kyc_phase === 'docs_pending') {
      text =
        'Falta enviar documentación por WhatsApp Cubik (CI, licencia, SOAP, seguro). Revisa el tour en tu cuenta.';
    } else if (user?.role === 'carrier' && user?.kyc_phase === 'admin_review') {
      text = 'Tus documentos están en revisión. Te avisaremos cuando puedas operar.';
    }
    alert(text);
    document.getElementById('kyc-banner')?.scrollIntoView({ behavior: 'smooth' });
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
  if (res?.status === 403 && json?.docs_blocked) {
    if (typeof Auth !== 'undefined' && Auth.user) {
      Auth.user.docs_compliance_status = 'expired';
      Auth.user.kyc_phase = 'docs_expired';
      Auth.render?.();
    }
    alert(json.error || 'Documentación vencida');
    document.getElementById('kyc-banner')?.scrollIntoView({ behavior: 'smooth' });
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
