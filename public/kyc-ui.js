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

function accountKycRowMeta(user) {
  if (!user || user.role !== 'carrier') {
    return typeof kycStatusLabel === 'function' ? kycStatusLabel(user?.kyc_status) : user?.kyc_status || '—';
  }
  const profile = user.document_profile;
  const progress = profile?.progress || user.onboarding_progress;
  if (profile?.warning_level === 'danger') return 'Docs vencidos';
  if (profile?.missing_labels?.length) {
    return `${progress?.done ?? 0}/${progress?.total ?? 7} · pendiente`;
  }
  if (user.kyc_status === 'approved') return 'Aprobada';
  if (typeof carrierPhaseLabel === 'function') return carrierPhaseLabel(user.kyc_phase);
  return user.kyc_status || '—';
}

function formatDocExpiry(iso) {
  if (!iso) return '—';
  const s = String(iso).slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function docStatusIcon(status) {
  if (status === 'ok') return '✓';
  if (status === 'expiring') return '⚠';
  if (status === 'expired') return '✕';
  if (status === 'incomplete') return '…';
  return '○';
}

async function renderCarrierDocumentsPanel() {
  const slot = document.getElementById('app-account-kyc-slot');
  if (!slot) return;
  let panel = document.getElementById('carrier-docs-panel');
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'carrier-docs-panel';
    panel.className = 'carrier-docs-panel card';
    panel.hidden = true;
    slot.appendChild(panel);
  }

  const user = typeof Auth !== 'undefined' ? Auth.user : null;
  if (!user || user.role !== 'carrier') {
    panel.hidden = true;
    return;
  }

  const profile = user.document_profile;
  if (!profile) {
    panel.hidden = true;
    return;
  }

  panel.hidden = false;
  const wa = await loadCarrierWhatsAppUrl();
  const progress = profile.progress;
  const legalRows = (profile.legal_docs || [])
    .map((doc) => {
      const tone =
        doc.status === 'ok'
          ? 'ok'
          : doc.status === 'expired'
            ? 'bad'
            : doc.status === 'expiring'
              ? 'warn'
              : 'pending';
      return `<li class="carrier-doc-row carrier-doc-row--${tone}">
        <span class="carrier-doc-status" aria-hidden="true">${docStatusIcon(doc.status)}</span>
        <div class="carrier-doc-body">
          <strong>${doc.label}</strong>
          <span class="muted">Vence: ${formatDocExpiry(doc.expires_at)}</span>
        </div>
      </li>`;
    })
    .join('');

  const metaRows = (profile.meta || [])
    .map(
      (item) =>
        `<li class="carrier-doc-meta-row ${item.ok ? 'carrier-doc-meta-row--ok' : 'carrier-doc-meta-row--pending'}">
          <span>${item.label}</span>
          <strong>${item.value}</strong>
        </li>`
    )
    .join('');

  const warn = profile.warning_message
    ? `<div class="carrier-docs-alert carrier-docs-alert--${profile.warning_level || 'warn'}" role="status">
        <p>${profile.warning_message}</p>
      </div>`
    : `<div class="carrier-docs-alert carrier-docs-alert--ok" role="status">
        <p>Documentación completa según registros Cubik.</p>
      </div>`;

  const waBtn = wa
    ? `<a class="carrier-docs-wa btn-secondary" href="${wa}" target="_blank" rel="noopener">Enviar docs por WhatsApp</a>`
    : '';

  panel.innerHTML = `
    <header class="carrier-docs-head">
      <h3>Documentación legal</h3>
      <span class="pill ${profile.complete ? 'pill-done' : 'pill-warn'}">Checklist ${progress?.done ?? 0}/${progress?.total ?? 7}</span>
    </header>
    <p class="muted carrier-docs-lead">Solo lectura — Cubik valida con las fotos que envías por WhatsApp. Los cambios los confirma el equipo en revisión.</p>
    ${warn}
    <dl class="carrier-docs-rut">
      <dt>RUT titular</dt>
      <dd>${profile.rut || '—'}</dd>
    </dl>
    <ul class="carrier-doc-list" aria-label="Documentos legales">${legalRows}</ul>
    <ul class="carrier-doc-meta" aria-label="Datos operativos">${metaRows}</ul>
    <p class="muted carrier-docs-foot">Estado KYC: ${kycStatusLabel(user.kyc_status)} · Vencimientos: ${profile.docs_compliance_status || '—'}</p>
    ${waBtn}`;
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
    const profile = user.document_profile;
    const missingDocs = profile?.missing_labels?.length;
    if (!docsExpired && !missingDocs) {
      el.hidden = true;
      document.body.classList.remove('kyc-pending');
      await renderCarrierDocumentsPanel();
      return;
    }
    if (!docsExpired && missingDocs) {
      el.hidden = true;
      document.body.classList.remove('kyc-pending');
      await renderCarrierDocumentsPanel();
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
    await renderCarrierDocumentsPanel();
    return;
  }

  if (user.kyc_status === 'approved') {
    el.hidden = true;
    document.body.classList.remove('kyc-pending');
    await renderCarrierDocumentsPanel();
    return;
  }

  el.hidden = false;
  document.body.classList.add('kyc-pending');

  const msg =
    user.kyc_status === 'rejected'
      ? 'Tu cuenta no está habilitada para operar en el piloto. Escríbenos si crees que es un error.'
      : 'Tu cuenta está <strong>en revisión</strong>. Puedes explorar la app, pero aún no puedes publicar cargas ni emparejar hasta que un administrador te apruebe.';
  el.innerHTML = `<div class="kyc-banner-inner"><p>${msg}</p><p class="muted">Estado: ${kycStatusLabel(user.kyc_status)}</p></div>`;
  await renderCarrierDocumentsPanel();
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
window.renderCarrierDocumentsPanel = renderCarrierDocumentsPanel;
window.accountKycRowMeta = accountKycRowMeta;
window.assertCanOperate = assertCanOperate;
window.handleApiKycError = handleApiKycError;
