function apiHeaders() {
  return typeof Auth !== 'undefined' ? Auth.headers() : { 'Content-Type': 'application/json' };
}

const API = {
  loads: () => fetch('/api/load-requests?status=published', { headers: apiHeaders() }).then((r) => r.json()),
  offers: () => fetch('/api/capacity-offers?status=published', { headers: apiHeaders() }).then((r) => r.json()),
  allLoads: () => fetch('/api/load-requests', { headers: apiHeaders() }).then((r) => r.json()),
  allOffers: () => fetch('/api/capacity-offers', { headers: apiHeaders() }).then((r) => r.json()),
  matches: () => fetch('/api/matches', { headers: apiHeaders() }).then((r) => r.json()),
  cancelOptions: (action, phase, agreedPriceClp, matchId) => {
    let url = `/api/matches/cancel-options?action=${encodeURIComponent(action)}&phase=${encodeURIComponent(phase)}&actor_role=${encodeURIComponent(getActorRole())}`;
    if (agreedPriceClp) url += `&agreed_price_clp=${encodeURIComponent(agreedPriceClp)}`;
    if (matchId) url += `&match_id=${encodeURIComponent(matchId)}`;
    return fetch(url, { headers: apiHeaders() }).then((r) => r.json());
  },
  confirmMutualCancel: (matchId) =>
    fetch(`/api/matches/${matchId}/mutual-cancel`, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ actor_role: getActorRole() }),
    }).then((r) => r.json()),
  suggestions: (loadId) =>
    fetch(`/api/load-requests/${loadId}/match-suggestions`, { headers: apiHeaders() }).then((r) => r.json()),
  postLoad: (body) =>
    fetch('/api/load-requests', { method: 'POST', headers: apiHeaders(), body: JSON.stringify(body) }),
  postOffer: (body) =>
    fetch('/api/capacity-offers', { method: 'POST', headers: apiHeaders(), body: JSON.stringify(body) }),
  postMatch: (body) =>
    fetch('/api/matches', { method: 'POST', headers: apiHeaders(), body: JSON.stringify(body) }),
  patchMatch: (id, body) =>
    fetch(`/api/matches/${id}/status`, {
      method: 'PATCH',
      headers: apiHeaders(),
      body: JSON.stringify({ actor_role: getActorRole(), ...body }),
    }),
  seedDemo: (key) =>
    fetch('/api/demo/seed', {
      method: 'POST',
      headers: { ...apiHeaders(), 'X-Demo-Seed-Key': key || '' },
    }).then((r) => r.json()),
};

const STATUS_LABEL = {
  published: 'Publicada',
  matched: 'Asignada',
  in_transit: 'En ruta',
  delivered: 'Entregada',
  reserved: 'Reservada',
  proposed: 'Propuesto',
  accepted: 'Aceptado',
  in_progress: 'En ejecución',
  completed: 'Cerrado',
  cancelled: 'Cancelado',
};

const CANCEL_ACTION_LABEL = {
  withdraw: 'Retirada',
  reject: 'Rechazada',
  cancel: 'Cancelada',
};

function $(id) {
  return document.getElementById(id);
}

function getActorRole() {
  if (typeof Auth !== 'undefined' && Auth.user?.role) return Auth.user.role;
  return $('demo-actor-role')?.value || 'shipper';
}

function getActorRoleLabel() {
  const role = getActorRole();
  return typeof roleLabel === 'function' ? roleLabel(role) : role;
}

function matchMutualBanner(m) {
  if (!m || !['accepted', 'in_progress'].includes(m.status)) return '';
  const shipper = Boolean(m.mutual_cancel_shipper_at);
  const carrier = Boolean(m.mutual_cancel_carrier_at);
  const role = getActorRole() === 'carrier' ? 'carrier' : 'shipper';
  const myOk = role === 'carrier' ? carrier : shipper;
  const otherOk = role === 'carrier' ? shipper : carrier;
  const phase = m.status === 'in_progress' ? 'in_progress' : 'accepted';
  const price = m.agreed_price_clp || '';
  if (shipper && carrier) {
    return `<p class="match-mutual-banner ready">Acuerdo mutuo completo (embarcador y transportista). Usa <strong>Cancelar emparejamiento</strong> → «Cancelar con acuerdo mutuo».</p>`;
  }
  if (!myOk && otherOk) {
    return `<p class="match-mutual-banner action-needed"><strong>Te falta confirmar</strong> el acuerdo mutuo (eres ${getActorRoleLabel().toLowerCase()}).
      <button type="button" class="btn-mutual-banner" data-action="mutual_confirm" data-id="${m.id}" data-phase="${phase}" data-price="${price}">Confirmar acuerdo mutuo</button></p>`;
  }
  if (myOk && !otherOk) {
    const other = role === 'carrier' ? 'embarcador' : 'transportista';
    return `<p class="match-mutual-banner waiting">Ya confirmaste. Esperando al ${other}.</p>`;
  }
  return '';
}

function renderBoardActor() {
  const box = $('board-actor');
  if (!box) return;
  box.hidden = Boolean(typeof Auth !== 'undefined' && Auth.user);
}

function buildMatchActions(m) {
  const role = getActorRole() === 'carrier' ? 'carrier' : 'shipper';
  if (m.status === 'cancelled') {
    const parts = [];
    if (m.cancel_action) parts.push(CANCEL_ACTION_LABEL[m.cancel_action] || m.cancel_action);
    if (m.cancel_reason) parts.push(m.cancel_reason);
    if (m.penalty_type === 'fee_suggested' && m.penalty_amount_clp) {
      parts.push(`Multa sugerida $${Number(m.penalty_amount_clp).toLocaleString('es-CL')}`);
    }
    if (m.cancelled_by) parts.push(`rol ${m.cancelled_by}`);
    return parts.length
      ? `<p class="muted match-cancel-meta">${parts.join(' · ')}</p>`
      : '';
  }
  let html = '';
  if (m.status === 'proposed') {
    html += `<button type="button" data-action="accept" data-id="${m.id}">Aceptar</button>`;
    if (role === 'shipper') {
      html += `<button type="button" class="btn-secondary" data-action="withdraw" data-id="${m.id}" data-phase="proposed" data-price="${m.agreed_price_clp || ''}">Retirar propuesta</button>`;
      html += `<button type="button" class="btn-secondary" data-action="change_offer" data-load-id="${m.load_request_id}" data-offer-id="${m.capacity_offer_id}" data-id="${m.id}" data-price="${m.agreed_price_clp || ''}">Cambiar oferta</button>`;
    }
    if (role === 'carrier') {
      html += `<button type="button" class="btn-secondary" data-action="reject" data-id="${m.id}" data-phase="proposed" data-price="${m.agreed_price_clp || ''}">Rechazar</button>`;
    }
  }
  if (m.status === 'accepted' || m.status === 'in_progress') {
    const title = m._matchTitle || 'Emparejamiento';
    html += `<button type="button" class="btn-secondary" data-action="chat" data-id="${m.id}" data-title="${title.replace(/"/g, '')}">Chat</button>`;
    if (m.status === 'accepted') {
      html += `<button type="button" data-action="progress" data-id="${m.id}">En ruta</button>`;
      html += `<button type="button" class="btn-danger" data-action="cancel" data-id="${m.id}" data-phase="accepted" data-price="${m.agreed_price_clp || ''}">Cancelar emparejamiento</button>`;
    } else {
      html += `<button type="button" data-action="complete" data-id="${m.id}">Cerrar</button>`;
      html += `<button type="button" class="btn-danger" data-action="cancel" data-id="${m.id}" data-phase="in_progress" data-price="${m.agreed_price_clp || ''}">Cancelar en ejecución</button>`;
    }
  }
  return html;
}

function updateActiveProposalBanner(matches, loadId) {
  const banner = $('active-proposal-banner');
  if (!banner) return;
  const active = (matches || []).filter((m) => m.status === 'proposed' && m.load_request_id === loadId);
  if (!loadId || active.length === 0) {
    banner.hidden = true;
    return;
  }
  banner.hidden = false;
  const names = active
    .map((m) => m._offerName || 'una oferta')
    .join(', ');
  banner.innerHTML = `<strong>Propuesta activa</strong> (${active.length}). Puedes comparar más ofertas, <em>retirar</em> o <em>cambiar oferta</em> en Emparejamientos. ${names ? `Actual: ${names}.` : ''}`;
}

function formatPenaltyLine(opt) {
  const preview = opt?.penalty_preview;
  const penalty = opt?.penalty;
  if (preview?.type === 'fee_suggested' && preview.amount_clp) {
    return `Multa sugerida: $${Number(preview.amount_clp).toLocaleString('es-CL')} CLP. ${preview.note || penalty?.note || ''}`.trim();
  }
  if (!penalty) return 'Sin multa sugerida.';
  if (penalty.type === 'fee_suggested' && penalty.percentOfAgreed) {
    const pct = penalty.percentOfAgreed;
    const min = penalty.minClp ? ` (mín. $${penalty.minClp.toLocaleString('es-CL')})` : '';
    return `Multa sugerida: ~${pct}% del precio acordado${min}. ${penalty.note || ''}`.trim();
  }
  if (penalty.type === 'mediation') return penalty.note || 'Se recomienda mediación.';
  if (penalty.type === 'review') return penalty.note || 'Quedará sujeto a revisión.';
  if (penalty.type === 'none') return penalty.note || 'Sin multa sugerida.';
  return penalty.note || 'Sin multa sugerida.';
}

function updateCancelReasonForm() {
  const code = $('cancel-reason-code')?.value;
  const opt = cancelReasonOptions.find((o) => o.code === code);
  const detailEl = $('cancel-reason-detail');
  const detailLabel = $('cancel-detail-label');
  const penaltyBox = $('cancel-penalty-box');
  const agreeLabel = $('cancel-agreement-label');
  const agreeText = $('cancel-agreement-text');
  if (!opt) return;
  const showDetail = opt.requiresDetail;
  detailLabel.hidden = !showDetail;
  detailEl.hidden = !showDetail;
  detailEl.required = showDetail;
  penaltyBox.hidden = false;
  penaltyBox.textContent = formatPenaltyLine(opt);
  if (opt.requiresAgreement) {
    agreeLabel.hidden = false;
    agreeText.textContent =
      opt.penalty?.type === 'fee_suggested'
        ? 'Confirmo el acuerdo o acepto registrar la multa sugerida (sin cobro automático en esta fase).'
        : 'Confirmo que ambas partes están de acuerdo o acepto las condiciones indicadas.';
  } else {
    agreeLabel.hidden = true;
    $('cancel-agreement').checked = false;
  }
}

let cancelModalMode = 'mutual';

function otherCancelReasonOptions() {
  return (cancelReasonOptions || []).filter((o) => o.code !== 'mutual_agreement');
}

function populateOtherReasonSelect() {
  const sel = $('cancel-reason-code');
  if (!sel) return;
  const opts = otherCancelReasonOptions();
  if (opts.length === 0) {
    sel.innerHTML = '<option value="">Sin motivos para tu rol</option>';
    return;
  }
  sel.innerHTML = opts
    .map((o) => `<option value="${o.code}">${o.label_short || o.label}</option>`)
    .join('');
  updateCancelReasonForm();
}

function applyCancelModalLayout(mode, mutual) {
  const isCancel = cancelModalCtx?.action === 'cancel';
  const mutualPanel = $('cancel-mutual-panel');
  const otherPanel = $('cancel-other-panel');
  const useOther = $('btn-cancel-use-other');
  const useMutual = $('btn-cancel-use-mutual');
  const reasonSel = $('cancel-reason-code');
  const lead = $('cancel-modal-lead');

  if (!isCancel) {
    cancelModalMode = 'other';
    if (mutualPanel) mutualPanel.hidden = true;
    if (otherPanel) {
      otherPanel.hidden = false;
      otherPanel.classList.add('cancel-path-active');
    }
    if (reasonSel) reasonSel.required = true;
    return;
  }

  const ready = Boolean(mutual?.ready);
  if (ready) cancelModalMode = 'mutual';

  if (cancelModalMode === 'mutual' || ready) {
    cancelModalMode = 'mutual';
    if (mutualPanel) {
      mutualPanel.hidden = false;
      mutualPanel.classList.add('cancel-path-active');
    }
    if (otherPanel) {
      otherPanel.hidden = true;
      otherPanel.classList.remove('cancel-path-active');
    }
    if (useOther) useOther.hidden = ready;
    if (useMutual) useMutual.hidden = true;
    if (reasonSel) reasonSel.required = false;
    if (lead) {
      lead.textContent = ready
        ? 'Acuerdo mutuo listo. Finaliza sin multa con el botón naranja.'
        : 'Opción activa: acuerdo mutuo (sin multa). Confirma tu parte aquí.';
    }
    return;
  }

  cancelModalMode = 'other';
  if (mutualPanel) {
    mutualPanel.hidden = true;
    mutualPanel.classList.remove('cancel-path-active');
  }
  if (otherPanel) {
    otherPanel.hidden = false;
    otherPanel.classList.add('cancel-path-active');
  }
  if (useOther) useOther.hidden = true;
  if (useMutual) useMutual.hidden = false;
  if (reasonSel) reasonSel.required = true;
  if (lead) {
    lead.textContent =
      'Opción activa: otro motivo (puede incluir multa). Vuelve arriba si logran acuerdo mutuo.';
  }
  populateOtherReasonSelect();
}

function closeCancelModal() {
  const modal = $('cancel-modal');
  if (modal) {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
  }
  const mutualPanel = $('cancel-mutual-panel');
  const otherPanel = $('cancel-other-panel');
  if (mutualPanel) {
    mutualPanel.hidden = true;
    mutualPanel.classList.remove('cancel-path-active');
  }
  if (otherPanel) {
    otherPanel.hidden = true;
    otherPanel.classList.remove('cancel-path-active');
  }
  cancelModalCtx = null;
  cancelReasonOptions = [];
  cancelModalMode = 'mutual';
}

function renderCancelMutualPanel(ctx, mutual) {
  const panel = $('cancel-mutual-panel');
  if (!panel) return;
  if (ctx.action !== 'cancel') {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  const m = mutual || {};
  const role = getActorRole() === 'carrier' ? 'carrier' : 'shipper';
  const myOk = role === 'carrier' ? m.carrier_confirmed : m.shipper_confirmed;
  const statusEl = $('cancel-mutual-status');
  if (statusEl) {
    const emb = m.shipper_confirmed ? '✓ confirmado' : 'pendiente';
    const tra = m.carrier_confirmed ? '✓ confirmado' : 'pendiente';
    if (m.ready) {
      statusEl.textContent =
        'Embarcador y transportista confirmaron. Pulsa «Cancelar con acuerdo mutuo» para cerrar sin multa.';
    } else if (myOk) {
      statusEl.textContent = `Ya confirmaste como ${getActorRoleLabel().toLowerCase()}. Embarcador: ${emb}. Transportista: ${tra}.`;
    } else {
      const other = role === 'carrier' ? 'embarcador' : 'transportista';
      const otherOk = role === 'carrier' ? m.shipper_confirmed : m.carrier_confirmed;
      statusEl.textContent = otherOk
        ? `El ${other} ya confirmó. Tú (${getActorRoleLabel().toLowerCase()}) debes confirmar abajo.`
        : `Embarcador: ${emb} · Transportista: ${tra}. Confirma tu parte como ${getActorRoleLabel().toLowerCase()}.`;
    }
  }
  const btnConfirm = $('btn-mutual-confirm-in-modal');
  const btnNow = $('btn-mutual-cancel-now');
  if (btnConfirm) {
    btnConfirm.hidden = Boolean(myOk);
    btnConfirm.classList.toggle('mutual-cta-highlight', !myOk && (m.shipper_confirmed || m.carrier_confirmed));
  }
  if (btnNow) btnNow.hidden = !m.ready;
  lastMutualCancelForLayout = m;
  applyCancelModalLayout(cancelModalMode, m);
}

async function refreshCancelModalState() {
  if (!cancelModalCtx) return;
  const { matchId, action, phase, agreedPriceClp } = cancelModalCtx;
  const json = await API.cancelOptions(action, phase, agreedPriceClp, matchId);
  if (!json.ok) return;
  cancelReasonOptions = json.data || [];
  renderCancelMutualPanel(cancelModalCtx, json.mutual_cancel);
  if (typeof Comms !== 'undefined') Comms.refreshBell();
}

async function openCancelModal(ctx) {
  const { matchId, action, phase, title, lead, agreedPriceClp } = ctx;
  const json = await API.cancelOptions(action, phase, agreedPriceClp, matchId);
  if (!json.ok || !json.data?.length) {
    alert(json.error || 'No hay motivos disponibles para esta acción.');
    return;
  }
  cancelModalCtx = ctx;
  cancelReasonOptions = json.data;
  cancelModalMode = action === 'cancel' ? 'mutual' : 'other';
  $('cancel-modal-title').textContent = title;
  $('cancel-modal-lead').textContent = lead || '';
  $('cancel-reason-detail').value = '';
  $('cancel-agreement').checked = false;
  renderCancelMutualPanel(ctx, json.mutual_cancel);
  if (action !== 'cancel') {
    const sel = $('cancel-reason-code');
    if (sel) {
      sel.innerHTML = json.data
        .map((o) => `<option value="${o.code}">${o.label_short || o.label}</option>`)
        .join('');
      updateCancelReasonForm();
    }
    applyCancelModalLayout('other', null);
  }
  const badge = $('cancel-stage-badge');
  if (badge && json.phase_label) {
    badge.hidden = false;
    let badgeText = `Etapa actual: ${json.phase_label}`;
    if (json.mutual_cancel?.ready) badgeText += ' · Acuerdo mutuo listo';
    badge.textContent = badgeText;
  } else if (badge) badge.hidden = true;
  const modal = $('cancel-modal');
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
}

async function submitCancelModal(e) {
  e.preventDefault();
  if (!cancelModalCtx) return;
  if (cancelModalCtx.action === 'cancel' && cancelModalMode === 'mutual') {
    alert(
      'Estás en acuerdo mutuo (sin multa). Confirma tu parte arriba o usa el enlace para cambiar a otro motivo.'
    );
    return;
  }
  const { matchId, action, phase } = cancelModalCtx;
  if (phase === 'in_progress' && action === 'cancel') {
    const ok = confirm(
      '¿Confirmas cancelar un emparejamiento en ejecución? La carga y la oferta volverán a publicarse.'
    );
    if (!ok) return;
  }
  const body = {
    status: 'cancelled',
    action,
    reason_code: $('cancel-reason-code').value,
    reason_detail: $('cancel-reason-detail').value,
    agreement_accepted: $('cancel-agreement').checked,
  };
  const res = await API.patchMatch(matchId, body);
  const json = await res.json();
  if (!res.ok) {
    alert(json.error || 'No se pudo completar la acción');
    return;
  }
  const afterSuccess = cancelModalCtx?.afterSuccess;
  closeCancelModal();
  stickyMatchOfferId = null;
  await refreshBoard();
  if (afterSuccess) await afterSuccess();
  let msg = json.message || 'Listo';
  if (json.penalty?.amount_clp) {
    msg += `\nMulta sugerida: $${Number(json.penalty.amount_clp).toLocaleString('es-CL')} CLP (acuerdo entre partes).`;
  }
  alert(msg);
  if (typeof Comms !== 'undefined') Comms.refreshBell();
  if (json.data?.status === 'cancelled') {
    $('matches-history-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

async function openCancelModalForMatch(matchId) {
  const json = await API.matches();
  const m = (json.data || []).find((x) => x.id === matchId);
  if (!m) {
    if (typeof Comms !== 'undefined') await Comms.dismissMatchNotifications(matchId);
    alert('No se encontró el emparejamiento. Actualiza el tablero.');
    return;
  }
  if (!['accepted', 'in_progress'].includes(m.status)) {
    if (typeof Comms !== 'undefined') await Comms.dismissMatchNotifications(matchId);
    alert('Este emparejamiento ya no admite acuerdo mutuo en esta etapa.');
    return;
  }
  const phase = m.status === 'in_progress' ? 'in_progress' : 'accepted';
  runMatchCancel(matchId, 'cancel', phase, m.agreed_price_clp || null);
}

async function scrollToActiveMatch(matchId) {
  if (typeof showTab === 'function') showTab('board');
  if (typeof refreshBoard === 'function') await refreshBoard();
  const heading = document.getElementById('matches-active-heading');
  const card = document.querySelector(`#list-matches [data-match-id="${matchId}"]`);
  if (card) {
    if (heading) heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('match-highlight');
      setTimeout(() => card.classList.remove('match-highlight'), 2800);
    }, 350);
    return { found: true, where: 'active' };
  }

  const histWrap = $('matches-history-wrap');
  const histCard = document.querySelector(`#list-matches-history [data-match-id="${matchId}"]`);
  if (histCard) {
    if (histWrap) histWrap.open = true;
    histCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    histCard.classList.add('match-highlight');
    setTimeout(() => histCard.classList.remove('match-highlight'), 2800);
    if (typeof Comms !== 'undefined') await Comms.dismissMatchNotifications(matchId);
    alert('Este emparejamiento ya está en el historial (cancelado o cerrado).');
    return { found: true, where: 'history' };
  }

  if (typeof Comms !== 'undefined') await Comms.dismissMatchNotifications(matchId);
  alert(
    'Este emparejamiento ya no está activo. Se archivaron las notificaciones relacionadas.'
  );
  return { found: false };
}

function scrollToMatchCard(matchId) {
  scrollToActiveMatch(matchId);
}

function runMatchCancel(matchId, action, phase, agreedPriceClp) {
  const titles = {
    withdraw: 'Retirar propuesta',
    reject: 'Rechazar propuesta',
    cancel: 'Cancelar emparejamiento',
  };
  const leads = {
    withdraw: 'Elige un motivo de la lista.',
    reject: 'Elige un motivo de la lista.',
    cancel: 'Elige un motivo. La multa depende de la etapa y del motivo.',
  };
  openCancelModal({
    matchId,
    action,
    phase,
    agreedPriceClp,
    title: titles[action] || 'Cancelar',
    lead: leads[action] || '',
  });
}

async function confirmMutualInModal() {
  if (!cancelModalCtx?.matchId) return;
  const json = await API.confirmMutualCancel(cancelModalCtx.matchId);
  if (!json.ok) {
    alert(json.error || 'No se pudo confirmar');
    return;
  }
  await refreshCancelModalState();
  refreshBoard();
  if (json.mutual_cancel?.ready) {
    alert(
      'Listo: embarcador y transportista confirmaron. Ahora puedes pulsar «Cancelar con acuerdo mutuo» en este mismo cuadro.'
    );
  } else {
    alert(json.message || 'Confirmación registrada.');
  }
}

async function cancelWithMutualNow() {
  if (!cancelModalCtx?.matchId) return;
  const res = await API.patchMatch(cancelModalCtx.matchId, {
    status: 'cancelled',
    action: 'cancel',
    reason_code: 'mutual_agreement',
    agreement_accepted: true,
  });
  const json = await res.json();
  if (!res.ok) {
    alert(json.error || 'Error');
    return;
  }
  closeCancelModal();
  await refreshBoard();
  if (typeof Comms !== 'undefined') Comms.refreshBell();
  alert(json.message || 'Emparejamiento cancelado por acuerdo mutuo.');
}

function runChangeOffer(matchId, loadId) {
  openCancelModal({
    matchId,
    action: 'withdraw',
    phase: 'proposed',
    title: 'Cambiar oferta',
    lead: 'Retiramos la propuesta actual para que puedas elegir otra en el tablero.',
    afterSuccess: async () => {
      stickyMatchLoadId = loadId;
      stickyMatchOfferId = null;
      if (loadId) {
        $('match-load').value = loadId;
        loadSuggestionsFor(loadId);
        $('match-offer').value = '';
        $('form-match')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
  });
}

let boardRefreshGen = 0;
let stickyMatchLoadId = null;
let stickyMatchOfferId = null;
let cancelModalCtx = null;
let cancelReasonOptions = [];
let lastMutualCancelForLayout = null;

function showTab(name) {
  document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
  $(`panel-${name}`).classList.add('active');
  document.querySelector(`[data-tab="${name}"]`).classList.add('active');
  if (name === 'board') refreshBoard();
}

function routeLine(row) {
  const from = row.origin_commune
    ? `${row.origin_commune}, ${row.origin_city}`
    : row.origin_city;
  const to = row.destination_commune
    ? `${row.destination_commune}, ${row.destination_city}`
    : row.destination_city;
  let line = `${from} (${row.origin_region}) → ${to} (${row.destination_region})`;
  if (row.distance_km) line += ` · ${row.distance_km} km`;
  return line;
}

function setMatchOffer(offerId, label) {
  const offerSel = $('match-offer');
  if (!offerSel || !offerId) return false;
  stickyMatchOfferId = offerId;
  offerSel.disabled = false;
  const id = String(offerId);
  if (!offerSel.querySelector(`option[value="${id}"]`)) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = label ? `${label} (sugerida)` : 'Oferta sugerida';
    offerSel.appendChild(opt);
  }
  offerSel.value = id;
  offerSel.classList.add('offer-picked');
  offerSel.dispatchEvent(new Event('change', { bubbles: true }));
  showMatchReady();
  return true;
}

async function refreshBoard() {
  const gen = ++boardRefreshGen;
  const keepLoad = stickyMatchLoadId || $('match-load')?.value || '';
  const keepOffer = stickyMatchOfferId || $('match-offer')?.value || '';

  const [loads, offers, matches] = await Promise.all([API.allLoads(), API.allOffers(), API.matches()]);
  if (gen !== boardRefreshGen) return;
  $('list-loads').innerHTML =
    loads.data?.length === 0
      ? '<p class="muted">Sin cargas.</p>'
      : loads.data
          .map(
            (l) => `
      <article class="item" data-id="${l.id}">
        <strong>${l.company_name}</strong>
        <span class="pill">${STATUS_LABEL[l.status] || l.status}</span>
        <p>${routeLine(l)}</p>
        <p class="muted">${l.pallets ? l.pallets + ' pallets · ' : ''}${l.volume_m3 ? l.volume_m3 + ' m³ · ' : ''}${l.cargo_type || ''}${l.distance_duration_min ? ' · ~' + l.distance_duration_min + ' min' : ''}</p>
      </article>`
          )
          .join('');

  $('list-offers').innerHTML =
    offers.data?.length === 0
      ? '<p class="muted">Sin ofertas.</p>'
      : offers.data
          .map(
            (o) => `
      <article class="item" data-id="${o.id}">
        <strong>${o.carrier_name}</strong>
        <span class="pill">${STATUS_LABEL[o.status] || o.status}</span>
        <p>${routeLine(o)}</p>
        <p class="muted">${o.free_volume_m3 ? o.free_volume_m3 + ' m³ libres' : ''}</p>
      </article>`
          )
          .join('');

  const loadById = Object.fromEntries((loads.data || []).map((l) => [l.id, l]));
  const offerById = Object.fromEntries((offers.data || []).map((o) => [o.id, o]));

  const matchRows = matches.data || [];
  matchRows.forEach((m) => {
    const offer = offerById[m.capacity_offer_id];
    if (offer) m._offerName = offer.carrier_name;
  });

  const activeMatches = matchRows.filter((m) => m.status !== 'cancelled');
  const cancelledMatches = matchRows.filter((m) => m.status === 'cancelled');

  function renderMatchCards(rows, emptyMsg) {
    if (rows.length === 0) return `<p class="muted">${emptyMsg}</p>`;
    return rows
      .map((m) => {
        const load = loadById[m.load_request_id];
        const offer = offerById[m.capacity_offer_id];
            const title =
              load && offer
                ? `${load.company_name} (Embarcador) ↔ ${offer.carrier_name} (Transportista)`
                : `Carga · Oferta`;
            m._matchTitle = title;
            const actions = buildMatchActions(m);
            const mutualBanner = matchMutualBanner(m);
        return `
      <article class="item match-item" data-match-id="${m.id}">
        <strong>${title}</strong>
        <span class="pill">${STATUS_LABEL[m.status] || m.status}</span>
        ${mutualBanner}
        ${m.agreed_price_clp ? `<p>$${Number(m.agreed_price_clp).toLocaleString('es-CL')} CLP</p>` : ''}
        <div class="actions match-actions">${actions}</div>
      </article>`;
      })
      .join('');
  }

  $('list-matches').innerHTML = renderMatchCards(
    activeMatches,
    'Sin emparejamientos activos. Crea uno arriba o revisa el historial.'
  );
  const histEl = $('list-matches-history');
  const histWrap = $('matches-history-wrap');
  if (histEl) {
    histEl.innerHTML = renderMatchCards(cancelledMatches, 'Sin cancelaciones recientes.');
    if (histWrap) histWrap.open = cancelledMatches.length > 0;
  }

  const publishedLoads = (loads.data || []).filter((l) => l.status === 'published');
  const publishedOffers = (offers.data || []).filter((o) => o.status === 'published');
  const loadSel = $('match-load');
  const offerSel = $('match-offer');
  const hint = $('board-hint');
  const matchBtn = $('form-match')?.querySelector('button[type="submit"]');

  loadSel.innerHTML =
    publishedLoads.length === 0
      ? '<option value="">No hay cargas publicadas</option>'
      : '<option value="">Elegir carga publicada…</option>';
  publishedLoads.forEach((l) => {
    loadSel.innerHTML += `<option value="${l.id}">${l.company_name} — ${routeLine(l)}</option>`;
  });
  if (keepLoad && loadSel.querySelector(`option[value="${keepLoad}"]`)) {
    loadSel.value = keepLoad;
    stickyMatchLoadId = keepLoad;
  }

  if (publishedOffers.length === 0) {
    offerSel.innerHTML = '<option value="">Sin ofertas — ve a «Tengo espacio en ruta»</option>';
    offerSel.disabled = true;
    if (hint) {
      hint.hidden = false;
      hint.innerHTML =
        'Primero publica una <strong>oferta de capacidad</strong> en la pestaña <button type="button" class="link-btn" data-goto="carrier">Tengo espacio en ruta</button>.';
    }
    if (matchBtn) matchBtn.disabled = true;
  } else {
    offerSel.disabled = false;
    offerSel.innerHTML = '<option value="">Elegir oferta publicada…</option>';
    publishedOffers.forEach((o) => {
      offerSel.innerHTML += `<option value="${o.id}">${o.carrier_name} — ${routeLine(o)}</option>`;
    });
    if (hint) hint.hidden = true;
    if (matchBtn) matchBtn.disabled = false;
    if (keepOffer) {
      setMatchOffer(
        keepOffer,
        publishedOffers.find((o) => o.id === keepOffer)?.carrier_name
      );
    }
  }
  updateActiveProposalBanner(matchRows, loadSel.value);
  loadSuggestionsFor(loadSel.value);
  showMatchReady();
  renderBoardActor();
  if (typeof Comms !== 'undefined') Comms.refreshBell();
}

async function loadSuggestionsFor(loadId) {
  const box = $('match-suggestions');
  if (!box) return;
  if (!loadId) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  box.innerHTML = 'Buscando sugerencias…';
  try {
    const json = await API.suggestions(loadId);
    if (!json.ok || !json.data?.length) {
      box.innerHTML = '<p class="muted">Sin sugerencias automáticas para esta carga.</p>';
      return;
    }
    box.innerHTML =
      '<p><strong>Sugerencias automáticas</strong></p>' +
      json.data
        .slice(0, 3)
        .map(
          (s) => `
      <div class="suggestion-item">
        <span class="pill">${s.score}% match</span>
        <strong>${s.offer.carrier_name}</strong>
        <p class="muted">${s.reasons.join(' · ')}</p>
        <button type="button" class="use-suggestion" data-offer-id="${s.offer.id}" data-carrier="${s.offer.carrier_name.replace(/"/g, '')}">Usar esta oferta</button>
        <button type="button" class="match-suggestion-now" data-offer-id="${s.offer.id}" data-carrier="${s.offer.carrier_name.replace(/"/g, '')}">Emparejar con esta oferta</button>
      </div>`
        )
        .join('');
  } catch {
    box.innerHTML = '<p class="muted">No se pudieron cargar sugerencias.</p>';
  }
}

function cleanFormBody(fd) {
  const body = Object.fromEntries(fd.entries());
  for (const key of Object.keys(body)) {
    if (body[key] === '') delete body[key];
  }
  return body;
}

document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => showTab(btn.dataset.tab));
});

document.body.addEventListener('click', (e) => {
  if (e.target.matches('[data-goto]')) showTab(e.target.dataset.goto);
});

$('form-load').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = cleanFormBody(new FormData(e.target));
  const res = await API.postLoad(body);
  const json = await res.json();
  if (!res.ok) {
    alert(json.errors?.join('\n') || json.error || 'Error');
    return;
  }
  e.target.reset();
  alert('Carga publicada. Visible en el tablero.');
  showTab('board');
});

$('form-offer').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = cleanFormBody(new FormData(e.target));
  if (!body.carrier_name || !body.origin_city || !body.destination_city) {
    alert('Completa transportista, ciudad de origen y ciudad de destino.');
    return;
  }
  const res = await API.postOffer(body);
  const json = await res.json();
  if (!res.ok) {
    alert(json.errors?.join('\n') || json.error || 'Error al publicar oferta');
    return;
  }
  e.target.reset();
  const destRegion = e.target.querySelector('[name="destination_region"]');
  if (destRegion) destRegion.value = 'RM';
  alert('Oferta publicada. Ahora puedes emparejar en el tablero.');
  showTab('board');
});

$('form-match').addEventListener('submit', async (e) => {
  e.preventDefault();
  const loadId = $('match-load').value;
  const offerId = $('match-offer').value;
  if (!loadId) {
    alert('Elige una carga publicada.');
    return;
  }
  if (!offerId || $('match-offer').disabled) {
    alert('No hay ofertas. Ve a «Tengo espacio en ruta», completa el formulario y pulsa «Publicar oferta».');
    showTab('carrier');
    return;
  }
  const body = {
    load_request_id: loadId,
    capacity_offer_id: offerId,
    agreed_price_clp: $('match-price').value || null,
  };
  const res = await API.postMatch(body);
  const json = await res.json();
  if (!res.ok) {
    alert(json.error || json.errors?.join('\n') || 'Error');
    if (res.status === 409) {
      refreshBoard().then(() => {
        $('list-matches')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    return;
  }
  $('match-price').value = '';
  stickyMatchOfferId = null;
  stickyMatchLoadId = null;
  alert('Emparejamiento creado. Abajo en Emparejamientos puedes pulsar Aceptar.');
  refreshBoard().then(() => {
    $('list-matches')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

$('list-matches').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  if (action === 'chat') {
    const title = btn.dataset.title || '';
    if (typeof Comms !== 'undefined') Comms.openChat(id, title);
    return;
  }
  if (action === 'mutual_confirm') {
    const phase = btn.dataset.phase || 'accepted';
    const price = btn.dataset.price ? Number(btn.dataset.price) : null;
    runMatchCancel(id, 'cancel', phase, price);
    return;
  }
  if (action === 'change_offer') {
    runChangeOffer(id, btn.dataset.loadId);
    return;
  }
  const price = btn.dataset.price ? Number(btn.dataset.price) : null;
  if (action === 'withdraw' || action === 'reject') {
    runMatchCancel(id, action, btn.dataset.phase || 'proposed', price);
    return;
  }
  if (action === 'cancel') {
    runMatchCancel(id, 'cancel', btn.dataset.phase, price);
    return;
  }
  const map = { accept: 'accepted', progress: 'in_progress', complete: 'completed' };
  const res = await API.patchMatch(id, { status: map[action] });
  const json = await res.json();
  if (!res.ok) alert(json.error || 'Error');
  else refreshBoard();
});

$('demo-actor-role')?.addEventListener('change', () => refreshBoard());

fetch('/health')
  .then((r) => r.json())
  .then((h) => {
    const el = document.getElementById('storage-badge');
    if (!el) return;
    if (h.ui?.startsWith('match-cancel') || h.ui === 'match-flow-v3') {
      el.textContent = `v${h.version || '?'} · motivos y multas sugeridas`;
    } else if (h.storage === 'supabase' && h.supabase?.connected) {
      el.textContent = 'Conectado a Supabase (actualiza deploy)';
    } else if (h.storage === 'supabase') {
      el.textContent = 'Supabase configurado (revisar conexión)';
    }
  })
  .catch(() => {});

function showMatchReady() {
  const loadId = $('match-load').value;
  const offerId = $('match-offer').value;
  const box = $('match-selected');
  const btn = $('btn-create-match');
  if (!box || !loadId || !offerId) {
    if (box) box.hidden = true;
    return;
  }
  const loadOpt = $('match-load').selectedOptions[0]?.text || 'Carga';
  const offerOpt = $('match-offer').selectedOptions[0]?.text || 'Oferta';
  box.hidden = false;
  box.innerHTML = `Listo: <strong>${offerOpt}</strong> para <strong>${loadOpt}</strong>. Revisa el precio y pulsa el botón naranja abajo.`;
  if (btn) {
    btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

$('match-load')?.addEventListener('change', (e) => {
  stickyMatchLoadId = e.target.value || null;
  stickyMatchOfferId = null;
  loadSuggestionsFor(e.target.value);
  showMatchReady();
});

$('match-offer')?.addEventListener('change', (e) => {
  stickyMatchOfferId = e.target.value || null;
  showMatchReady();
});

document.getElementById('match-suggestions')?.addEventListener('click', (e) => {
  const useBtn = e.target.closest('.use-suggestion');
  const nowBtn = e.target.closest('.match-suggestion-now');
  const btn = useBtn || nowBtn;
  if (!btn) return;
  e.preventDefault();
  const offerId = btn.getAttribute('data-offer-id');
  const label = btn.getAttribute('data-carrier') || btn.closest('.suggestion-item')?.querySelector('strong')?.textContent;
  if (!offerId) return;
  setMatchOffer(offerId, label);
  if (nowBtn) $('form-match')?.requestSubmit();
});

document.getElementById('btn-seed-demo')?.addEventListener('click', async () => {
  const key = prompt('Clave demo (DEMO_SEED_KEY en Railway). Dejar vacío si solo local:') || '';
  const json = await API.seedDemo(key);
  if (!json.ok) {
    alert(json.error || 'No se pudo cargar demo');
    return;
  }
  alert(`Demo listo: ${json.loads} cargas, ${json.offers} ofertas`);
  showTab('board');
});

window.renderBoardActor = renderBoardActor;
window.refreshBoard = refreshBoard;
window.openCancelModalForMatch = openCancelModalForMatch;
window.scrollToMatchCard = scrollToMatchCard;
window.scrollToActiveMatch = scrollToActiveMatch;

$('cancel-reason-code')?.addEventListener('change', updateCancelReasonForm);
$('form-cancel-reason')?.addEventListener('submit', submitCancelModal);
$('btn-mutual-confirm-in-modal')?.addEventListener('click', confirmMutualInModal);
$('btn-mutual-cancel-now')?.addEventListener('click', cancelWithMutualNow);
$('btn-cancel-use-other')?.addEventListener('click', () => {
  if (!cancelModalCtx) return;
  cancelModalMode = 'other';
  applyCancelModalLayout('other', lastMutualCancelForLayout);
});
$('btn-cancel-use-mutual')?.addEventListener('click', () => {
  if (!cancelModalCtx) return;
  cancelModalMode = 'mutual';
  applyCancelModalLayout('mutual', lastMutualCancelForLayout);
});
document.querySelectorAll('[data-close-cancel]').forEach((el) => {
  el.addEventListener('click', closeCancelModal);
});

renderBoardActor();
showTab('shipper');
if (typeof Comms !== 'undefined') {
  if (typeof Auth !== 'undefined' && Auth.user) Comms.refreshBell();
  else Comms.resetUi();
}
