function apiHeaders() {
  return typeof Auth !== 'undefined' ? Auth.headers() : { 'Content-Type': 'application/json' };
}

const API = {
  loads: () =>
    apiFetch('/api/load-requests?status=published', { headers: apiHeaders() }).then((r) => r.json()),
  offers: () =>
    apiFetch('/api/capacity-offers?status=published', { headers: apiHeaders() }).then((r) => r.json()),
  allLoads: () => apiFetch('/api/load-requests', { headers: apiHeaders() }).then((r) => r.json()),
  allOffers: () => apiFetch('/api/capacity-offers', { headers: apiHeaders() }).then((r) => r.json()),
  matches: () => apiFetch('/api/matches', { headers: apiHeaders() }).then((r) => r.json()),
  cancelOptions: (action, phase, agreedPriceClp, matchId) => {
    let url = `/api/matches/cancel-options?action=${encodeURIComponent(action)}&phase=${encodeURIComponent(phase)}&actor_role=${encodeURIComponent(getActorRole())}`;
    if (agreedPriceClp) url += `&agreed_price_clp=${encodeURIComponent(agreedPriceClp)}`;
    if (matchId) url += `&match_id=${encodeURIComponent(matchId)}`;
    return apiFetch(url, { headers: apiHeaders() }).then((r) => r.json());
  },
  confirmMutualCancel: (matchId) =>
    apiFetch(`/api/matches/${matchId}/mutual-cancel`, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ actor_role: getActorRole() }),
    }).then((r) => r.json()),
  suggestions: (loadId) =>
    apiFetch(`/api/load-requests/${loadId}/match-suggestions`, { headers: apiHeaders() }).then((r) =>
      r.json()
    ),
  postLoad: (body) =>
    apiFetch('/api/load-requests', { method: 'POST', headers: apiHeaders(), body: JSON.stringify(body) }),
  postOffer: (body) =>
    apiFetch('/api/capacity-offers', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify(body),
    }),
  postMatch: (body) =>
    apiFetch('/api/matches', { method: 'POST', headers: apiHeaders(), body: JSON.stringify(body) }),
  patchMatch: (id, body) =>
    apiFetch(`/api/matches/${id}/status`, {
      method: 'PATCH',
      headers: apiHeaders(),
      body: JSON.stringify({ actor_role: getActorRole(), ...body }),
    }),
  patchCarrierOffer: (id, carrier_offer_clp) =>
    apiFetch(`/api/matches/${id}/carrier-offer`, {
      method: 'PATCH',
      headers: apiHeaders(),
      body: JSON.stringify({ carrier_offer_clp, actor_role: getActorRole() }),
    }).then((r) => r.json()),
  patchAcceptOffer: (id) =>
    apiFetch(`/api/matches/${id}/accept-offer`, {
      method: 'PATCH',
      headers: apiHeaders(),
      body: JSON.stringify({ actor_role: getActorRole() }),
    }).then((r) => r.json()),
  patchLoadBudget: (loadId, budget_min_clp, budget_max_clp) =>
    apiFetch(`/api/load-requests/${loadId}/budget`, {
      method: 'PATCH',
      headers: apiHeaders(),
      body: JSON.stringify({ budget_min_clp, budget_max_clp }),
    }).then((r) => r.json()),
  postIncident: (matchId, body) =>
    apiFetch(`/api/matches/${matchId}/incidents`, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify(body),
    }).then((r) => r.json()),
  rateMatch: (matchId, body) =>
    apiFetch(`/api/matches/${matchId}/rate`, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify(body),
    }).then((r) => r.json()),
  seedDemo: (key) =>
    apiFetch('/api/demo/seed', {
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

function formatPublishedDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusPillHtml(status, createdAt) {
  const label = STATUS_LABEL[status] || status;
  const when = formatPublishedDate(createdAt);
  if (!when) return `<span class="pill">${label}</span>`;
  return `<span class="pill pill-with-date" title="Publicado ${when}">${label} <span class="pill-date">${when}</span></span>`;
}

const CANCEL_ACTION_LABEL = {
  withdraw: 'Retirada',
  reject: 'Rechazada',
  cancel: 'Cancelada',
};

const MATCH_ACTION_CONFIRM = {
  progress:
    '¿Marcar este emparejamiento como «En ruta»?\n\nConfirma que el transporte ya salió o está en camino.',
  mark_delivered:
    '¿Marcaste la entrega en destino?\n\nEl embarcador recibirá aviso y deberá confirmar que recibió la mercadería.',
  confirm_receipt:
    '¿Confirmas que recibiste la mercadería conforme?\n\nEl viaje se cerrará y ambos podrán calificar. Solo confirma si ya tienes la carga.',
  accept_offer:
    '¿Aceptar el precio del transportista y confirmar el emparejamiento?\n\nLa carga y la oferta quedarán reservadas para este viaje.',
};

let matchActionBusy = false;

function confirmMatchAction(action) {
  const msg = MATCH_ACTION_CONFIRM[action];
  if (!msg) return true;
  return confirm(msg);
}

function beginMatchAction(btn) {
  if (matchActionBusy) return false;
  matchActionBusy = true;
  if (btn) {
    btn.disabled = true;
    btn.dataset.busyLabel = btn.textContent;
    btn.textContent = 'Procesando…';
  }
  return true;
}

function endMatchAction(btn) {
  matchActionBusy = false;
  if (btn) {
    btn.disabled = false;
    if (btn.dataset.busyLabel) {
      btn.textContent = btn.dataset.busyLabel;
      delete btn.dataset.busyLabel;
    }
  }
}

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

function formatCargoTrustLine(l) {
  if (!l) return '';
  const desc = l.cargo_description || l.cargo_type;
  const val =
    l.declared_cargo_value_clp != null
      ? `$${Number(l.declared_cargo_value_clp).toLocaleString('es-CL')}`
      : '';
  if (!desc && !val) return '';
  const guide = l.has_dispatch_guide
    ? l.dispatch_guide_folio
      ? `Guía/ref. ${l.dispatch_guide_folio}`
      : 'Con guía declarada'
    : 'Sin guía declarada';
  const ins = l.requires_cargo_insurance ? ' · Seguro solicitado' : '';
  return `<p class="cargo-trust-line">Mercadería: ${desc || '—'}${val ? ` · Valor ref. ${val}` : ''} · ${guide}${ins}</p>`;
}

function formatReputationBadge(rep, roleLabel) {
  const prefix = roleLabel ? `${roleLabel}: ` : '';
  if (!rep?.rating_count) {
    return `<p class="match-rep-line"><span class="match-rep-badge match-rep-new">${prefix}Sin calificaciones aún</span></p>`;
  }
  const avg = rep.avg_stars != null ? Number(rep.avg_stars).toFixed(1) : '—';
  const n = rep.rating_count;
  return `<p class="match-rep-line"><span class="match-rep-badge">${prefix}<strong>${avg} ★</strong> · ${n} viaje${n === 1 ? '' : 's'}</span></p>`;
}

function reputationBadgeInline(rep) {
  if (!rep?.rating_count) return '';
  const avg = Number(rep.avg_stars).toFixed(1);
  return `<span class="match-rep-inline" title="Promedio histórico">${avg} ★ · ${rep.rating_count}</span>`;
}

function buildMatchReputationHtml(m, load, offer) {
  const role = getActorRole();
  if (role === 'shipper') {
    return formatReputationBadge(
      m.carrier_reputation || offer?.reputation,
      'Reputación transportista'
    );
  }
  if (role === 'carrier') {
    return formatReputationBadge(
      m.shipper_reputation || load?.reputation,
      'Reputación embarcador'
    );
  }
  return (
    formatReputationBadge(m.carrier_reputation, 'Transportista') +
    formatReputationBadge(m.shipper_reputation, 'Embarcador')
  );
}

function formatBudgetRange(min, max) {
  const fmt = (n) => (n != null && n !== '' ? `$${Number(n).toLocaleString('es-CL')}` : null);
  const a = fmt(min);
  const b = fmt(max);
  if (a && b) return `${a} – ${b}`;
  if (b) return `hasta ${b}`;
  if (a) return `desde ${a}`;
  return 'sin rango definido';
}

function isOutsideBudget(m) {
  if (m.carrier_offer_clp == null) return false;
  const min = m.budget_min_clp;
  const max = m.budget_max_clp;
  if (min == null && max == null) return false;
  const o = Number(m.carrier_offer_clp);
  if (min != null && o < Number(min)) return true;
  if (max != null && o > Number(max)) return true;
  return false;
}

/** Detecta ofertas muy bajas vs rango (ej. 350 en vez de 350000). */
function suggestOfferTypoFix(amount, budgetMin, budgetMax) {
  const n = Number(amount);
  const min = budgetMin != null ? Number(budgetMin) : null;
  const max = budgetMax != null ? Number(budgetMax) : null;
  if (!min || !Number.isFinite(n) || n <= 0) return null;
  if (n >= min * 0.25) return null;
  for (const mult of [10, 100, 1000]) {
    const c = n * mult;
    if (c >= min * 0.85 && (max == null || c <= max * 1.15)) return c;
  }
  return null;
}

async function promptCarrierOfferAmount(match, currentOffer) {
  const cur = currentOffer != null ? String(currentOffer) : '';
  const hint = suggestOfferTypoFix(cur, match.budget_min_clp, match.budget_max_clp);
  const defaultVal = hint ? String(hint) : cur;
  const range = formatBudgetRange(match.budget_min_clp, match.budget_max_clp);
  let msg = `Nuevo monto de tu oferta en CLP.\n\nRango publicado del embarcador: ${range}.`;
  if (hint && Number(cur) !== hint) {
    msg += `\n\n¿Quisiste decir $${hint.toLocaleString('es-CL')}? (detectamos un posible error de ceros).`;
  }
  const val = prompt(msg, defaultVal);
  if (val === null) return null;
  const amount = Number(String(val).replace(/\D/g, ''));
  if (!amount || amount < 1) {
    alert('Indica un monto válido en CLP.');
    return null;
  }
  if (hint && amount === Number(cur) && Number(cur) < (match.budget_min_clp || 0) * 0.25) {
    const useFix = confirm(
      `Tu oferta ($${amount.toLocaleString('es-CL')}) está muy por debajo del rango.\n\n¿Usar $${hint.toLocaleString('es-CL')} CLP?`
    );
    if (useFix) return hint;
  }
  return amount;
}

function buildMatchPriceBox(m) {
  const role = getActorRole() === 'carrier' ? 'carrier' : 'shipper';
  const range = formatBudgetRange(m.budget_min_clp, m.budget_max_clp);
  const outside = isOutsideBudget(m);
  let html = `<div class="match-price-box"><p><strong>Precio</strong> · Rango embarcador: ${range}</p>`;
  if (m.agreed_price_clp) {
    html += `<p>Acordado: <strong>$${Number(m.agreed_price_clp).toLocaleString('es-CL')} CLP</strong></p></div>`;
    return html;
  }
  if (m.carrier_offer_clp) {
    html += `<p>Oferta transportista: <strong>$${Number(m.carrier_offer_clp).toLocaleString('es-CL')} CLP</strong></p>`;
    if (outside) {
      const typo = role === 'carrier' ? suggestOfferTypoFix(m.carrier_offer_clp, m.budget_min_clp, m.budget_max_clp) : null;
      html +=
        role === 'shipper'
          ? `<p class="match-price-outside">Fuera de tu rango publicado. Puedes <strong>aceptar</strong> igual o <strong>ampliar el rango</strong> si no cerraste con otro transportista.</p>`
          : `<p class="match-price-outside">Fuera del rango del embarcador.${typo ? ` ¿Quisiste <strong>$${typo.toLocaleString('es-CL')}</strong>?` : ''} Usa <strong>Corregir oferta</strong> para actualizar el monto.</p>`;
    }
    if (role === 'shipper') {
      html += `<div class="match-price-cta"><button type="button" class="btn-accept-match" data-action="accept_offer" data-id="${m.id}">Aceptar precio y confirmar match</button></div>`;
      if (outside) {
        html += `<button type="button" class="btn-secondary" data-action="adjust_budget" data-load-id="${m.load_request_id}" data-id="${m.id}">Ampliar mi rango presupuesto</button>`;
      }
    } else {
      html += `<p class="muted">Esperando que el embarcador acepte tu oferta.</p>`;
      html += `<div class="match-price-cta match-carrier-offer-cta">`;
      html += `<button type="button" class="btn-secondary" data-action="fix_offer" data-id="${m.id}" data-offer="${m.carrier_offer_clp}">Corregir oferta (CLP)</button>`;
      html += `</div>`;
      html += `<input type="number" class="match-offer-input" data-id="${m.id}" min="1" step="1000" value="${m.carrier_offer_clp}" aria-label="Monto oferta CLP" />`;
      html += `<button type="button" class="btn-secondary" data-action="offer_price" data-id="${m.id}">Guardar monto del cuadro</button>`;
    }
  } else if (role === 'carrier') {
    html += `<input type="number" class="match-offer-input" data-id="${m.id}" min="1" step="1000" placeholder="Tu oferta CLP" />`;
    html += `<button type="button" data-action="offer_price" data-id="${m.id}">Enviar oferta al embarcador</button>`;
  } else {
    html += `<p class="muted">Esperando oferta de precio del transportista.</p>`;
  }
  html += '</div>';
  return html;
}

function updateMatchPriceStep() {
  const hint = $('match-budget-hint');
  const wrap = $('match-carrier-offer-wrap');
  const loadId = $('match-load')?.value;
  const load = window._boardLoadsById?.[loadId];
  const role = getActorRole();
  if (hint) {
    if (load) {
      hint.textContent = `Rango que paga el embarcador: ${formatBudgetRange(load.budget_min_clp, load.budget_max_clp)}`;
    } else {
      hint.textContent = 'Selecciona una carga para ver el rango del embarcador.';
    }
  }
  if (wrap) {
    const showCarrier =
      role === 'carrier' ||
      (typeof Auth === 'undefined' || !Auth.user) && $('demo-actor-role')?.value === 'carrier';
    wrap.hidden = !showCarrier;
  }
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
    if (role === 'shipper') {
      html += `<button type="button" class="btn-secondary" data-action="withdraw" data-id="${m.id}" data-phase="proposed" data-price="${m.agreed_price_clp || ''}">Retirar propuesta</button>`;
      html += `<button type="button" class="btn-secondary" data-action="change_offer" data-load-id="${m.load_request_id}" data-offer-id="${m.capacity_offer_id}" data-id="${m.id}" data-price="${m.agreed_price_clp || ''}">Cambiar oferta</button>`;
    }
    if (role === 'carrier') {
      if (m.carrier_offer_clp) {
        html += `<button type="button" class="btn-secondary" data-action="fix_offer" data-id="${m.id}" data-offer="${m.carrier_offer_clp}">Corregir oferta</button>`;
      }
      html += `<button type="button" class="btn-secondary" data-action="reject" data-id="${m.id}" data-phase="proposed" data-price="${m.agreed_price_clp || ''}">Rechazar propuesta</button>`;
    }
  }
  if (m.status === 'accepted' || m.status === 'in_progress') {
    const title = m._matchTitle || 'Emparejamiento';
    const titleEsc = title.replace(/"/g, '');
    html += `<button type="button" class="btn-secondary" data-action="chat" data-id="${m.id}" data-title="${titleEsc}">Chat</button>`;
    if (m.status === 'accepted') {
      if (role === 'carrier') {
        html += `<button type="button" class="btn-match-progress" data-action="progress" data-id="${m.id}">Marcar en ruta</button>`;
        html += `<p class="muted match-role-hint">Solo cancela si aún <strong>no</strong> retiraste la carga. Al marcar en ruta ya no podrás cancelar el viaje.</p>`;
        html += `<button type="button" class="btn-danger" data-action="cancel" data-id="${m.id}" data-phase="accepted" data-price="${m.agreed_price_clp || ''}">No puedo cumplir antes del retiro</button>`;
      } else {
        html += `<p class="muted match-role-hint">Esperando que el transportista marque «En ruta» cuando retira la carga.</p>`;
        html += `<button type="button" class="btn-danger" data-action="cancel" data-id="${m.id}" data-phase="accepted" data-price="${m.agreed_price_clp || ''}">Cancelar emparejamiento</button>`;
      }
    } else if (role === 'carrier') {
      html += `<button type="button" class="btn-secondary" data-action="report_incident" data-id="${m.id}">Reportar incidente</button>`;
      if (!m.carrier_marked_delivered_at) {
        html += `<button type="button" class="btn-secondary" data-action="mark_delivered" data-id="${m.id}">Marcar entregado en destino</button>`;
      } else {
        html += `<p class="muted match-role-hint">Entrega marcada. Falta confirmación del embarcador.</p>`;
      }
      html += `<p class="muted match-role-hint">Con carga en ruta no puedes cancelar el viaje. Usa incidente o acuerdo mutuo con el embarcador.</p>`;
    } else {
      if (m.carrier_marked_delivered_at) {
        html += `<button type="button" class="btn-secondary" data-action="confirm_receipt" data-id="${m.id}">Confirmar recepción de carga</button>`;
      } else {
        html += `<p class="muted match-role-hint">Cuando el transportista marque entrega en destino, confirma aquí la recepción.</p>`;
      }
      html += `<button type="button" class="btn-danger" data-action="cancel" data-id="${m.id}" data-phase="in_progress" data-price="${m.agreed_price_clp || ''}">Cancelar (caso grave o acuerdo mutuo)</button>`;
      html += `<p class="muted match-cancel-hint">Con mercadería en camión solo cancelación excepcional: acuerdo mutuo, fuerza mayor o falla grave del transportista (con detalle y multa sugerida).</p>`;
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

function formatReputationLine(opt) {
  if (opt?.reputation_impact === 'negative') {
    return 'Puede afectar la reputación del responsable en calificaciones futuras.';
  }
  return '';
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
  const repLine = formatReputationLine(opt);
  penaltyBox.textContent = [formatPenaltyLine(opt), repLine].filter(Boolean).join(' ');
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

function normalizeMutualCancel(m) {
  if (!m) return { shipper_confirmed: false, carrier_confirmed: false, ready: false };
  const shipper = Boolean(m.shipper_confirmed ?? m.mutual_cancel_shipper_at);
  const carrier = Boolean(m.carrier_confirmed ?? m.mutual_cancel_carrier_at);
  return {
    shipper_confirmed: shipper,
    carrier_confirmed: carrier,
    ready: Boolean(m.ready ?? (shipper && carrier)),
  };
}

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
  const m = normalizeMutualCancel(mutual);
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
  if (btnNow) {
    btnNow.hidden = !m.ready;
    btnNow.classList.toggle('btn-mutual-banner', m.ready);
  }
  lastMutualCancelForLayout = m;
  applyCancelModalLayout(m.ready ? 'mutual' : cancelModalMode, m);
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
    if (json.pickup_deadline_label) {
      badgeText += ` · Plazo retiro: ${json.pickup_deadline_label}`;
      if (json.deadline_past) badgeText += ' (vencido)';
    }
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
      '¿Confirmas cancelar con la carga ya en ruta?\n\nSolo usa esto en casos graves o con acuerdo mutuo. La carga y la oferta volverán a publicarse.'
    );
    if (!ok) return;
  }
  if (phase === 'accepted' && action === 'cancel' && getActorRole() === 'carrier') {
    const ok = confirm(
      '¿Confirmas que no podrás cumplir antes de retirar la carga?\n\nSi ya tienes la mercadería, primero no marques «En ruta» y contacta al embarcador por chat.'
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
  if (json.reputation_note) {
    msg += `\n\n${json.reputation_note}`;
  }
  if (json.support_hint) {
    msg += `\n\n${json.support_hint}`;
  }
  alert(msg);
  if (json.support_case?.id && typeof SupportUI !== 'undefined') {
    if (confirm('¿Abrir el chat de ayuda / moderación de este caso ahora?')) {
      SupportUI.openDrawer(json.support_case.id, json.support_case.subject);
    }
  }
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
    cancel:
      phase === 'in_progress'
        ? 'Carga en ruta: solo motivos graves o acuerdo mutuo. El transportista no puede cancelar desde aquí.'
        : phase === 'accepted' && getActorRole() === 'carrier'
          ? 'Solo antes de marcar «En ruta». Indica el motivo; puede haber multa sugerida y afectar reputación.'
          : 'Elige un motivo. La multa y reputación dependen de la etapa y del motivo.',
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
  const mutualFromPost = normalizeMutualCancel(json.mutual_cancel);
  renderCancelMutualPanel(cancelModalCtx, mutualFromPost);
  await refreshCancelModalState();
  if (mutualFromPost.ready) {
    renderCancelMutualPanel(cancelModalCtx, mutualFromPost);
    applyCancelModalLayout('mutual', mutualFromPost);
    $('btn-mutual-cancel-now')?.focus();
  } else {
    alert(json.message || 'Confirmación registrada. Falta la otra parte.');
  }
  refreshBoard();
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
  if (!name) return;
  const panel = $(`panel-${name}`);
  const tab = document.querySelector(`#main-nav [data-tab="${name}"]`);
  if (!panel) return;
  document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('#main-nav .tab').forEach((t) => t.classList.remove('active'));
  panel.classList.add('active');
  if (tab) tab.classList.add('active');
  if (name === 'board' || name === 'trips') refreshBoard();
}

window.showTab = showTab;

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
  if (
    document.body.classList.contains('cubik-app') &&
    typeof Auth !== 'undefined' &&
    !Auth.user
  ) {
    return;
  }
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
        <strong>${l.company_name}${reputationBadgeInline(l.reputation)}</strong>
        ${statusPillHtml(l.status, l.created_at)}
        <p>${routeLine(l)}</p>
        <p class="muted">${l.pallets ? l.pallets + ' pallets · ' : ''}${l.volume_m3 ? l.volume_m3 + ' m³ · ' : ''}${l.cargo_type || ''}${l.distance_duration_min ? ' · ruta ' + l.distance_duration_min + ' min' : ''}${l.eta_total_min ? ' · ETA ~' + l.eta_total_min + ' min' : ''}</p>
        ${typeof formatTripScheduleHtml === 'function' ? formatTripScheduleHtml(l, 'load') : ''}
        ${formatLoadTimingLine(l)}
        ${l.budget_min_clp || l.budget_max_clp ? `<p class="muted">Presupuesto flete: ${formatBudgetRange(l.budget_min_clp, l.budget_max_clp)}</p>` : ''}
        ${l.created_at ? `<p class="muted">Publicada ${formatDateTime(l.created_at)}</p>` : ''}
        ${formatCargoTrustLine(l)}
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
        <strong>${o.carrier_name}${reputationBadgeInline(o.reputation)}</strong>
        ${statusPillHtml(o.status, o.created_at)}
        <p>${routeLine(o)}</p>
        ${typeof formatTripScheduleHtml === 'function' ? formatTripScheduleHtml(o, 'offer') : ''}
        <p class="muted">${o.free_volume_m3 ? o.free_volume_m3 + ' m³ libres' : ''}${o.created_at ? ' · Ofertado ' + formatDateTime(o.created_at) : ''}</p>
      </article>`
          )
          .join('');

  const loadById = Object.fromEntries((loads.data || []).map((l) => [l.id, l]));
  const offerById = Object.fromEntries((offers.data || []).map((o) => [o.id, o]));

  const matchRows = matches.data || [];
  window._boardMatchesById = Object.fromEntries(matchRows.map((m) => [m.id, m]));
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
            const cargoLine = formatCargoTrustLine(load);
        const scheduleLine =
          load && typeof formatTripScheduleHtml === 'function'
            ? formatTripScheduleHtml(load, 'load')
            : '';
        const proposedAt = m.created_at
          ? `<p class="muted match-meta">Propuesta ${formatDateTime(m.created_at)}${offer?.created_at ? ` · Oferta publicada ${formatDateTime(offer.created_at)}` : ''}</p>`
          : '';
        return `
      <article class="item match-item" data-match-id="${m.id}">
        <strong>${title}</strong>
        ${statusPillHtml(m.status, m.created_at)}
        ${proposedAt}
        ${scheduleLine}
        ${buildMatchReputationHtml(m, load, offer)}
        ${mutualBanner}
        ${cargoLine}
        ${buildMatchPriceBox(m)}
        <div class="actions match-actions">${actions}</div>
      </article>`;
      })
      .join('');
  }

  $('list-matches').innerHTML = renderMatchCards(
    activeMatches,
    'Sin emparejamientos activos. Crea una propuesta arriba o revisa cargas y ofertas abajo.'
  );
  const histEl = $('list-matches-history');
  const histWrap = $('matches-history-wrap');
  if (histEl) {
    histEl.innerHTML = renderMatchCards(cancelledMatches, 'Sin cancelaciones recientes.');
    if (histWrap) histWrap.open = cancelledMatches.length > 0;
  }

  const publishedLoads = (loads.data || []).filter((l) => l.status === 'published');
  window._boardLoadsById = Object.fromEntries((loads.data || []).map((l) => [l.id, l]));
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
    const br =
      l.budget_min_clp || l.budget_max_clp
        ? ` · ${formatBudgetRange(l.budget_min_clp, l.budget_max_clp)}`
        : '';
    const sched =
      l.schedule_mode === 'scheduled' && l.scheduled_pickup_at
        ? ` · ${formatDateTime(l.scheduled_pickup_at)}`
        : '';
    loadSel.innerHTML += `<option value="${l.id}">${l.company_name} — ${routeLine(l)}${sched}${br}</option>`;
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
      const repOpt =
        o.reputation?.rating_count && o.reputation.avg_stars != null
          ? ` · ${Number(o.reputation.avg_stars).toFixed(1)} ★`
          : '';
      offerSel.innerHTML += `<option value="${o.id}">${o.carrier_name}${repOpt} — ${routeLine(o)}</option>`;
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
  updateMatchPriceStep();
  showMatchReady();
  if (typeof ProposalCompare !== 'undefined') {
    const compareLoad =
      loadSel.value ||
      (() => {
        const proposed = matchRows.filter((m) => m.status === 'proposed');
        const byLoad = {};
        proposed.forEach((m) => {
          byLoad[m.load_request_id] = (byLoad[m.load_request_id] || 0) + 1;
        });
        const top = Object.entries(byLoad).sort((a, b) => b[1] - a[1])[0];
        return top && top[1] >= 2 ? top[0] : loadSel.value;
      })();
    ProposalCompare.render(compareLoad);
  }
  renderBoardActor();
  if (typeof Comms !== 'undefined') Comms.refreshBell();
  if (typeof updateActiveTripBanner === 'function') {
    updateActiveTripBanner(matchRows, loadById, offerById);
  }
  if (typeof renderTripsList === 'function') {
    renderTripsList(matchRows, loadById, offerById);
  }
  if (typeof syncBoardRealtime === 'function') {
    syncBoardRealtime(activeMatches);
  }
  if (typeof onBoardMatchesUpdated === 'function') {
    onBoardMatchesUpdated(matchRows);
  }
}

async function loadSuggestionsFor(loadId) {
  const box = $('match-suggestions');
  if (!box) return;
  if (!loadId) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  box.classList.add('is-searching');
  box.innerHTML =
    '<p class="searching-trucks"><span class="searching-dot"></span> Buscando camiones en tu corredor…</p>';
  try {
    const json = await API.suggestions(loadId);
    box.classList.remove('is-searching');
    if (!json.ok || !json.data?.length) {
      box.innerHTML =
        '<p class="muted">Seguimos buscando. Publica o espera ofertas en el tablero; también puedes crear propuesta manual.</p>';
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
        <strong>${s.offer.carrier_name}${reputationBadgeInline(s.reputation)}</strong>
        <p class="muted">${s.reasons.join(' · ')}</p>
        <button type="button" class="use-suggestion" data-offer-id="${s.offer.id}" data-carrier="${s.offer.carrier_name.replace(/"/g, '')}">Usar esta oferta</button>
        <button type="button" class="match-suggestion-now" data-offer-id="${s.offer.id}" data-carrier="${s.offer.carrier_name.replace(/"/g, '')}">Emparejar con esta oferta</button>
      </div>`
        )
        .join('');
  } catch {
    box.classList.remove('is-searching');
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

document.querySelectorAll('#main-nav .tab[data-tab]').forEach((btn) => {
  btn.addEventListener('click', () => showTab(btn.dataset.tab));
});

document.body.addEventListener('click', (e) => {
  if (e.target.matches('[data-goto]')) showTab(e.target.dataset.goto);
});

$('form-load').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (typeof LoadFormValidation !== 'undefined') {
    const missing = LoadFormValidation.check(e.target);
    if (missing.length) {
      LoadFormValidation.show(missing);
      return;
    }
    LoadFormValidation.clear();
  }
  if (typeof assertCanOperate === 'function' && !assertCanOperate()) return;
  if (typeof Auth !== 'undefined' && Auth.user?.role === 'carrier') {
    alert('Tu cuenta es transportista. Publica en «Mis ofertas».');
    showTab('carrier');
    return;
  }
  if (typeof Auth !== 'undefined' && !Auth.user) {
    const h = await fetch('/health').then((r) => r.json()).catch(() => ({}));
    if (h.storage === 'supabase' && h.supabase?.connected) {
      alert('Inicia sesión como empresa embarcadora para publicar una carga.');
      return;
    }
  }
  const mapsErr = typeof MapsUI !== 'undefined' ? MapsUI.assertFormReady(e.target) : null;
  if (mapsErr) {
    if (typeof LoadFormValidation !== 'undefined') {
      LoadFormValidation.show([{ label: mapsErr, el: e.target.querySelector('.address-search') }]);
    } else {
      alert(mapsErr);
    }
    return;
  }
  const fd = new FormData(e.target);
  if (!fd.get('terms_cargo_accepted')) {
    if (typeof LoadFormValidation !== 'undefined') {
      LoadFormValidation.show([
        { label: 'Aceptar términos de confianza y carga', el: document.getElementById('terms_cargo_accepted') },
      ]);
    } else {
      alert('Debes aceptar los términos de confianza y carga para publicar.');
    }
    return;
  }
  const body = cleanFormBody(fd);
  delete body.cargo_density;
  if (typeof LoadTimingUI !== 'undefined') {
    Object.assign(body, LoadTimingUI.getPayload(e.target));
  }
  if (typeof TripScheduleUI !== 'undefined') {
    Object.assign(body, TripScheduleUI.getPayload(e.target));
  }
  if (typeof LoadCapacityUI !== 'undefined') {
    const cap = LoadCapacityUI.getPayload(e.target);
    Object.assign(body, cap);
    if (cap.trips_required > 1) {
      const ok = confirm(
        `${cap.message || 'La carga supera un camión.'}\n\n¿Publicar igual? (puede requerir dividir la carga o varios viajes).`
      );
      if (!ok) return;
    }
  }
  if (body.schedule_mode === 'scheduled' && !body.scheduled_pickup_at) {
    if (typeof LoadFormValidation !== 'undefined') {
      LoadFormValidation.show([
        {
          label: 'Fecha y hora de retiro programado',
          el: e.target.querySelector('[name="scheduled_pickup_at"]'),
        },
      ]);
    } else {
      alert('Al programar el viaje, indica fecha y hora de retiro.');
    }
    return;
  }
  body.terms_cargo_accepted = true;
  if (body.has_dispatch_guide === 'yes') body.has_dispatch_guide = 'yes';
  const res = await API.postLoad(body);
  const json = await res.json();
  if (!res.ok) {
    if (typeof handleApiKycError === 'function' && handleApiKycError(res, json)) return;
    const errLines = json.errors?.length ? json.errors : json.error ? [json.error] : ['Error al publicar'];
    if (typeof LoadFormValidation !== 'undefined') {
      LoadFormValidation.show(errLines.map((label) => ({ label, el: null })));
    } else {
      alert(errLines.join('\n'));
    }
    return;
  }
  if (typeof LoadFormValidation !== 'undefined') LoadFormValidation.clear();
  e.target.reset();
  const loadId = json.data?.id;
  if (loadId) {
    stickyMatchLoadId = loadId;
    alert(
      'Carga publicada. Buscando camiones compatibles en el tablero…'
    );
    showTab('board');
  } else {
    alert('Carga publicada. Visible en el tablero.');
    showTab('board');
  }
});

$('form-offer').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (typeof assertCanOperate === 'function' && !assertCanOperate()) return;
  if (typeof Auth !== 'undefined' && Auth.user?.role === 'shipper') {
    alert('Tu cuenta es embarcadora. Publica en «Mis cargas».');
    showTab('shipper');
    return;
  }
  if (typeof Auth !== 'undefined' && !Auth.user) {
    const h = await fetch('/health').then((r) => r.json()).catch(() => ({}));
    if (h.storage === 'supabase' && h.supabase?.connected) {
      alert('Inicia sesión como empresa transportista para publicar una oferta.');
      return;
    }
  }
  const mapsErr = typeof MapsUI !== 'undefined' ? MapsUI.assertFormReady(e.target) : null;
  if (mapsErr) {
    alert(mapsErr);
    return;
  }
  const body = cleanFormBody(new FormData(e.target));
  if (!body.carrier_name || !body.origin_city || !body.destination_city) {
    alert('Completa transportista, ciudad de origen y ciudad de destino.');
    return;
  }
  if (typeof LoadCapacityUI !== 'undefined') {
    const cap = LoadCapacityUI.getOfferPayload(e.target);
    Object.assign(body, cap);
    const check = LoadCapacityUI.validateOfferCapacity(e.target);
    if (!check.truck) {
      alert(check.message || 'Elige el tipo de camión.');
      return;
    }
    if (!check.pallets || check.pallets < 1) {
      alert('Indica cuántos pallets puedes llevar en este viaje.');
      return;
    }
    if (check.exceeds || check.weight_exceeds) {
      alert(
        check.message ||
          'Los pallets superan la capacidad de tu camión. Reduce pallets o cambia el tipo de camión.'
      );
      return;
    }
  }
  if (typeof TripScheduleUI !== 'undefined') {
    Object.assign(body, TripScheduleUI.getPayload(e.target));
  }
  if (body.schedule_mode === 'scheduled' && !body.scheduled_depart_at) {
    alert('Al programar el viaje, indica fecha y hora de salida.');
    return;
  }
  const res = await API.postOffer(body);
  const json = await res.json();
  if (!res.ok) {
    if (typeof handleApiKycError === 'function' && handleApiKycError(res, json)) return;
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
  if (typeof assertCanOperate === 'function' && !assertCanOperate()) return;
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
    actor_role: getActorRole(),
  };
  const role = getActorRole();
  if (role === 'carrier') {
    const offerClp = $('match-carrier-offer')?.value;
    if (!offerClp) {
      alert('Ingresa tu oferta en CLP al embarcador.');
      return;
    }
    body.carrier_offer_clp = offerClp;
  }
  const res = await API.postMatch(body);
  const json = await res.json();
  if (!res.ok) {
    let errMsg = json.error || json.errors?.join('\n') || 'Error';
    if (json.detail && res.status === 503) errMsg += `\n\nDetalle: ${json.detail}`;
    alert(errMsg);
    if (res.status === 409) {
      refreshBoard().then(() => {
        $('list-matches')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    return;
  }
  $('match-carrier-offer') && ($('match-carrier-offer').value = '');
  stickyMatchOfferId = null;
  stickyMatchLoadId = null;
  const msg =
    json.range_message ||
    (role === 'carrier'
      ? 'Propuesta creada con tu oferta. El embarcador puede aceptar el precio abajo.'
      : 'Propuesta creada. El transportista debe enviar su oferta en CLP; luego aceptas el precio.');
  alert(msg);
  refreshBoard().then(() => {
    $('list-matches')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

$('panel-board')?.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn || btn.disabled) return;
  if (!btn.closest('#list-matches, #proposal-compare-panel, #list-matches-history')) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  if (action === 'chat') {
    const title = btn.dataset.title || '';
    if (typeof Comms !== 'undefined') Comms.openChat(id, title);
    return;
  }
  if (action === 'report_incident') {
    const type = prompt(
      'Tipo de incidente:\n1 theft (robo/extravío)\n2 damage (daño)\n3 shortage (faltante)\n4 delay (atraso grave)\n5 other\n\nEscribe el código:',
      'theft'
    );
    if (!type) return;
    const normalized = type.trim().toLowerCase();
    const allowed = ['theft', 'damage', 'shortage', 'delay', 'other'];
    if (!allowed.includes(normalized)) {
      alert('Tipo no válido. Usa: theft, damage, shortage, delay, other');
      return;
    }
    const description = prompt('Describe qué ocurrió (mín. 10 caracteres):');
    if (!description || description.trim().length < 10) {
      alert('Descripción demasiado corta.');
      return;
    }
    const json = await API.postIncident(id, {
      incident_type: normalized,
      description: description.trim(),
    });
    if (!json.ok) alert(json.error || json.errors?.join('\n') || 'No se pudo registrar');
    else alert(json.message || 'Incidente registrado');
    return;
  }
  if (action === 'accept_offer') {
    if (!confirmMatchAction('accept_offer')) return;
    if (!beginMatchAction(btn)) return;
    try {
      const json = await API.patchAcceptOffer(id);
      if (!json.ok) alert(json.error || 'Error');
      else {
        alert(json.message || 'Precio aceptado');
        await refreshBoard();
      }
    } finally {
      endMatchAction(btn);
    }
    return;
  }
  if (action === 'fix_offer' || action === 'offer_price') {
    const match = window._boardMatchesById?.[id];
    let amount;
    if (action === 'fix_offer' && match) {
      amount = await promptCarrierOfferAmount(match, btn.dataset.offer || match.carrier_offer_clp);
      if (amount == null) return;
    } else {
      const input = document.querySelector(`.match-offer-input[data-id="${id}"]`);
      amount = input?.value;
      if (!amount) {
        alert('Ingresa el monto en CLP o usa «Corregir oferta».');
        return;
      }
      amount = Number(amount);
    }
    if (!beginMatchAction(btn)) return;
    try {
      const json = await API.patchCarrierOffer(id, amount);
      if (!json.ok) alert(json.error || 'Error');
      else {
        alert(json.range_message || json.message || 'Oferta actualizada');
        await refreshBoard();
      }
    } finally {
      endMatchAction(btn);
    }
    return;
  }
  if (action === 'adjust_budget') {
    const loadId = btn.dataset.loadId;
    const load = window._boardLoadsById?.[loadId];
    const curMin = load?.budget_min_clp ?? '';
    const curMax = load?.budget_max_clp ?? '';
    const newMin = prompt(
      `Monto mínimo CLP (actual: ${curMin || '—'}). Vacío = sin cambio.`,
      curMin !== '' && curMin != null ? String(curMin) : ''
    );
    if (newMin === null) return;
    const newMax = prompt(
      `Monto máximo CLP (actual: ${curMax || '—'}). Vacío = sin cambio.`,
      curMax !== '' && curMax != null ? String(curMax) : ''
    );
    if (newMax === null) return;
    const body = {};
    if (newMin.trim()) body.budget_min_clp = Number(newMin);
    if (newMax.trim()) body.budget_max_clp = Number(newMax);
    if (!body.budget_min_clp && !body.budget_max_clp) {
      alert('Indica al menos un monto.');
      return;
    }
    const json = await API.patchLoadBudget(loadId, body.budget_min_clp, body.budget_max_clp);
    if (!json.ok) alert(json.error || json.errors?.join('\n') || 'Error');
    else {
      alert(json.message || 'Rango actualizado');
      refreshBoard();
    }
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
  if (action === 'accept') {
    alert('Primero el transportista debe ofertar precio; luego usa «Aceptar precio y confirmar match».');
    return;
  }
  if (action === 'mark_delivered') {
    if (!confirmMatchAction('mark_delivered')) return;
    const note = prompt(
      'Nota de entrega (opcional). Ej. hora, receptor, observaciones:',
      'Entregado en bodega destino'
    );
    if (note === null) return;
    if (!beginMatchAction(btn)) return;
    try {
      const res = await API.patchMatch(id, {
        action: 'mark_delivered',
        delivery_note: note.trim() || undefined,
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || 'Error');
        return;
      }
      alert(json.message || 'Entrega marcada');
      await refreshBoard();
    } finally {
      endMatchAction(btn);
    }
    return;
  }
  if (action === 'confirm_receipt' || action === 'complete') {
    if (!confirmMatchAction('confirm_receipt')) return;
    const note = prompt(
      'Observación de recepción (opcional). Cancelar para volver:',
      'Mercadería recibida conforme'
    );
    if (note === null) return;
    if (!beginMatchAction(btn)) return;
    try {
      const res = await API.patchMatch(id, {
        status: 'completed',
        delivery_note: note.trim() || undefined,
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || 'Error');
        return;
      }
      await refreshBoard();
      if (json.prompt_rating && typeof openRateModal === 'function') {
        openRateModal(id);
      } else {
        alert(json.message || 'Viaje cerrado');
      }
    } finally {
      endMatchAction(btn);
    }
    return;
  }
  if (action === 'progress') {
    if (!confirmMatchAction('progress')) return;
    if (!beginMatchAction(btn)) return;
    try {
      const res = await API.patchMatch(id, { status: 'in_progress' });
      const json = await res.json();
      if (!res.ok) alert(json.error || 'Error');
      else {
        alert('Viaje marcado como en ruta. Cuando entregues en destino, usa «Marcar entregado en destino».');
        await refreshBoard();
      }
    } finally {
      endMatchAction(btn);
    }
    return;
  }
});


fetch('/health')
  .then((r) => r.json())
  .then((h) => {
    const el = document.getElementById('storage-badge');
    if (!el) return;
    if (h.ui?.startsWith('match-cancel') || h.ui === 'match-flow-v3') {
      let label = `v${h.version || '?'} · motivos y multas sugeridas`;
      if (h.supabase?.match_ratings_tags_column === false) {
        label += ' · ⚠ aplica SQL 013 + Reload schema';
      } else if (h.supabase?.match_ratings_table === false) {
        label += ' · ⚠ calificaciones: aplica SQL 012';
      }
      el.textContent = label;
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
  const role = getActorRole();
  const priceNote =
    role === 'carrier'
      ? 'Ingresa <strong>tu oferta en CLP</strong> y crea la propuesta.'
      : 'El transportista debe <strong>ofertar precio</strong>; tú lo aceptas en Emparejamientos.';
  box.innerHTML = `Listo: <strong>${offerOpt}</strong> para <strong>${loadOpt}</strong>. ${priceNote}`;
  if (btn) {
    btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

$('match-load')?.addEventListener('change', (e) => {
  stickyMatchLoadId = e.target.value || null;
  stickyMatchOfferId = null;
  loadSuggestionsFor(e.target.value);
  updateMatchPriceStep();
  showMatchReady();
});

$('demo-actor-role')?.addEventListener('change', () => {
  updateMatchPriceStep();
  refreshBoard();
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
const isAppGuest =
  document.body.classList.contains('cubik-app') &&
  (typeof Auth === 'undefined' || !Auth.user);
if (!isAppGuest) {
  showTab('shipper');
}
if (typeof Comms !== 'undefined') {
  if (typeof Auth !== 'undefined' && Auth.user) Comms.refreshBell();
  else Comms.resetUi();
}
if (typeof Penalties !== 'undefined') {
  if (typeof Auth !== 'undefined' && Auth.user) Penalties.refresh();
  else Penalties.resetUi();
}
if (isAppGuest && typeof AppShell?.hideNativeSplash === 'function') {
  AppShell.hideNativeSplash();
}
