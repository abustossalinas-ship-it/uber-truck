/** Mis viajes — paridad Uber: viaje activo, historial, calificación */

const RATED_MATCHES_KEY = 'ut_rated_matches';

function ratedMatchStorageKey(matchId) {
  const role =
    typeof getActorRole === 'function' && getActorRole() === 'carrier' ? 'carrier' : 'shipper';
  return `${matchId}:${role}`;
}

function loadRatedMatchIds() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(RATED_MATCHES_KEY) || '[]');
    const set = new Set();
    for (const entry of raw) {
      if (typeof entry === 'string' && entry.includes(':')) set.add(entry);
    }
    return set;
  } catch {
    return new Set();
  }
}

function markRatedMatchId(matchId) {
  const set = loadRatedMatchIds();
  set.add(ratedMatchStorageKey(matchId));
  sessionStorage.setItem(RATED_MATCHES_KEY, JSON.stringify([...set]));
}

function clearRatedMatchIds() {
  sessionStorage.removeItem(RATED_MATCHES_KEY);
}

function hasRatedMatchId(matchId, match) {
  if (match?.my_rating?.stars) return true;
  return loadRatedMatchIds().has(ratedMatchStorageKey(matchId));
}

const TRIP_STATUS_LABEL = {
  proposed: 'Esperando precio',
  accepted: 'Camión asignado',
  in_progress: 'En ruta',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

function tripPhase(m) {
  if (['accepted', 'in_progress'].includes(m.status)) return 'active';
  if (m.status === 'proposed') return 'pending';
  if (m.status === 'completed') return 'done';
  if (m.status === 'cancelled') return 'cancelled';
  return 'other';
}

function renderStars(n) {
  const full = Math.round(Number(n) || 0);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

function formatReputation(rep) {
  if (!rep || !rep.rating_count) return 'Sin calificaciones aún';
  const avg = rep.avg_stars != null ? Number(rep.avg_stars).toFixed(1) : '—';
  const n = rep.rating_count;
  return `${avg} ★ · ${n} viaje${n === 1 ? '' : 's'}`;
}

function tripCounterpartyFromMatch(m, role, load, offer) {
  if (m.counterparty?.display) return m.counterparty;
  const display =
    role === 'carrier'
      ? load?.company_name || 'Embarcador'
      : offer?.carrier_name || 'Transportista';
  return {
    display,
    role_label: role === 'carrier' ? 'Embarcador' : 'Transportista',
    person: display,
  };
}

function buildTripPartyHeader(m, role, load, offer) {
  const cp = tripCounterpartyFromMatch(m, role, load, offer);
  const initial = (cp.person || cp.display || '?').charAt(0).toUpperCase();
  const status = TRIP_STATUS_LABEL[m.status] || m.status;
  const showCall = ['accepted', 'in_progress'].includes(m.status);
  return `
    <div class="trip-party-row">
      <span class="trip-party-avatar" aria-hidden="true">${initial}</span>
      <div class="trip-party-meta">
        <span class="trip-party-name">${cp.display}</span>
        <span class="trip-party-sub">${cp.role_label}</span>
      </div>
      <span class="pill trip-status-pill">${status}</span>
    </div>
    ${
      showCall
        ? `<div class="trip-contact-bar">
      <button type="button" class="tab tab-sm trip-call-btn" data-trip-call="${m.id}" title="Llamada enmascarada Cubik">📞 Llamar</button>
    </div>`
        : ''
    }`;
}

function formatRatingTags(role, rating) {
  if (!rating?.tags?.length || typeof RatingTags === 'undefined' || !RatingTags.catalog) {
    return '';
  }
  const labels = rating.tags
    .slice(0, 4)
    .map((id) => RatingTags.labelFor(role, id))
    .join(' · ');
  const more = rating.tags.length > 4 ? ` (+${rating.tags.length - 4})` : '';
  return `<span class="trip-rating-tags">${labels}${more}</span>`;
}

function ratingLine(label, rating, pendingText, roleForTags) {
  if (rating?.stars) {
    const tagsHtml = roleForTags ? formatRatingTags(roleForTags, rating) : '';
    return `<p class="trip-rating-line"><span class="trip-rating-label">${label}</span> ${renderStars(rating.stars)} <span class="muted">(${rating.stars}/5)</span>${tagsHtml ? `<br>${tagsHtml}` : ''}</p>`;
  }
  return `<p class="trip-rating-line muted"><span class="trip-rating-label">${label}</span> ${pendingText}</p>`;
}

/** Estado de pago en UI — piloto sin wallet; luego usa match.payment_status */
function buildTripPaymentBadge(m, role) {
  const ps = m.payment_status;
  if (ps === 'released') {
    const label = role === 'carrier' ? 'Cobrado en Cubik' : 'Pagado en Cubik';
    return `<p class="trip-payment-badge trip-payment-ok">${label}</p>`;
  }
  if (ps === 'retained') {
    return `<p class="trip-payment-badge trip-payment-hold">Saldo retenido en Cubik</p>`;
  }
  if (ps === 'pending_release') {
    return `<p class="trip-payment-badge trip-payment-hold">Pago pendiente — confirma recepción</p>`;
  }
  if (ps === 'pilot_awaiting') {
    return `<p class="trip-payment-badge trip-payment-pilot">Esperando pago del embarcador · Cubik Saldo piloto</p>`;
  }
  if (ps === 'pilot_pending') {
    const agreed = m.payment_agreed_clp;
    const fee = m.payment_fee_clp;
    const total = m.payment_total_clp ?? agreed;
    const feePct = Math.round((m.payment_fee_rate || 0.1) * 100);
    if (agreed && total) {
      return `<div class="trip-payment-badge trip-payment-pending">
        <div class="trip-payment-charged-head">
          <span class="pill pill-warn trip-payment-pill">Pendiente de pago</span>
          <strong class="trip-payment-amount">${total != null ? `$${Number(total).toLocaleString('es-CL')}` : ''}</strong>
        </div>
        <div class="trip-payment-breakdown">
          <div class="trip-pay-row"><span>Flete</span><span>$${Number(agreed).toLocaleString('es-CL')}</span></div>
          ${fee ? `<div class="trip-pay-row fee"><span>Servicio Cubik ${feePct}%</span><span>+$${Number(fee).toLocaleString('es-CL')}</span></div>` : ''}
          <div class="trip-pay-row total"><span>Total a pagar</span><strong>$${Number(total).toLocaleString('es-CL')}</strong></div>
        </div>
        <button type="button" class="btn-match-cta btn-pilot-pay" data-pilot-pay="${m.id}">Pagar con Cubik Saldo</button>
        <span class="trip-payment-hint">Simulación — confirma para generar el cargo</span>
      </div>`;
    }
  }
  if (ps === 'pilot_settlement') {
    const agreed = m.payment_agreed_clp;
    const fee = m.payment_fee_clp;
    const feePct = Math.round((m.payment_fee_rate || (role === 'shipper' ? 0.1 : 0.05)) * 100);
    if (role === 'carrier') {
      const net = m.payment_net_clp;
      const netFmt =
        net != null ? `$${Number(net).toLocaleString('es-CL')}` : '';
      return `<div class="trip-payment-badge trip-payment-settlement">
        <div class="trip-payment-settlement-head">
          <span class="pill pill-ok trip-payment-pill">Embarcador pagó</span>
          <span class="pill pill-warn trip-payment-pill">Cobro en gestión</span>
          ${netFmt ? `<strong class="trip-payment-amount">${netFmt}</strong>` : ''}
        </div>
        ${
          agreed && fee
            ? `<div class="trip-payment-breakdown">
          <div class="trip-pay-row"><span>Flete acordado</span><span>$${Number(agreed).toLocaleString('es-CL')}</span></div>
          <div class="trip-pay-row fee"><span>Comisión Cubik ${feePct}%</span><span>−$${Number(fee).toLocaleString('es-CL')}</span></div>
          <div class="trip-pay-row total"><span>Neto a recibir</span><strong>$${Number(net).toLocaleString('es-CL')}</strong></div>
        </div>`
            : ''
        }
        <span class="trip-payment-hint">Cubik Saldo — simulación piloto</span>
      </div>`;
    }
    const total = m.payment_total_clp ?? agreed;
    if (agreed && fee && total) {
      const feeShare = Math.round((fee / total) * 100);
      const freightShare = 100 - feeShare;
      return `<div class="trip-payment-badge trip-payment-charged">
        <div class="trip-payment-charged-head">
          <span class="pill trip-payment-pill">Pagado</span>
          <strong class="trip-payment-amount trip-payment-negative">−$${Number(total).toLocaleString('es-CL')}</strong>
        </div>
        <div class="cubik-pay-bar" aria-hidden="true">
          <span class="cubik-pay-bar-freight" style="width:${freightShare}%"></span>
          <span class="cubik-pay-bar-fee" style="width:${feeShare}%"></span>
        </div>
        <div class="trip-payment-breakdown">
          <div class="trip-pay-row"><span>Flete</span><span>$${Number(agreed).toLocaleString('es-CL')}</span></div>
          <div class="trip-pay-row fee"><span>Servicio Cubik ${feePct}%</span><span>+$${Number(fee).toLocaleString('es-CL')}</span></div>
          <div class="trip-pay-row total"><span>Total descontado</span><strong>−$${Number(total).toLocaleString('es-CL')}</strong></div>
        </div>
        <span class="trip-payment-hint">Debitado en simulación — transportista en gestión</span>
      </div>`;
    }
  }
  if (m.status === 'in_progress') {
    return `<p class="trip-payment-badge trip-payment-pilot">Pago: se retendrá al marcar en ruta (Cubik Saldo — próx.)</p>`;
  }
  if (m.status !== 'completed') return '';
  const amt =
    m.agreed_price_clp != null
      ? `$${Number(m.agreed_price_clp).toLocaleString('es-CL')} acordados · `
      : '';
  if (role === 'shipper') {
    return `<p class="trip-payment-badge trip-payment-pilot">${amt}Pago no procesado en app (piloto)</p>`;
  }
  return `<p class="trip-payment-badge trip-payment-pilot">Por cobrar — Cubik Saldo próximamente</p>`;
}

function buildTripRatingsBlock(m, role, counterpartyName) {
  if (m.status !== 'completed') return '';
  const cp = counterpartyName || (role === 'shipper' ? 'Transportista' : 'Embarcador');
  const myLabel =
    role === 'shipper' ? 'Tu nota al transportista' : 'Tu nota al embarcador';
  const theirLabel =
    role === 'shipper' ? 'Nota del transportista hacia ti' : 'Nota del embarcador hacia ti';
  const repLabel =
    role === 'shipper'
      ? `Reputación del transportista (${cp})`
      : `Reputación del embarcador (${cp})`;

  const shipperRate = m.rating_by_shipper;
  const carrierRate = m.rating_by_carrier;
  const myR = role === 'shipper' ? shipperRate : carrierRate;
  const theirR = role === 'shipper' ? carrierRate : shipperRate;

  return `
    <div class="trip-ratings-box">
      <p class="trip-ratings-heading">Calificaciones del viaje</p>
      ${ratingLine(myLabel, myR, 'Pendiente — aún no calificas', role)}
      ${ratingLine(theirLabel, theirR, 'La otra parte aún no califica', role === 'shipper' ? 'carrier' : 'shipper')}
      <p class="trip-rating-line trip-reputation-line"><span class="trip-rating-label">${repLabel}</span> <strong>${formatReputation(m.counterparty_reputation)}</strong></p>
    </div>`;
}

let _bannerActiveMatchId = null;

function bindActiveTripBannerNav(matchId) {
  const banner = document.getElementById('active-trip-banner');
  const btn = banner?.querySelector('[data-goto-trip]');
  if (!btn || btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';
  btn.addEventListener('click', () => {
    if (typeof AppShell !== 'undefined' && AppShell.setTab) {
      AppShell.setTab('activity');
    } else if (typeof showTab === 'function') {
      showTab('trips');
    }
    window.setTimeout(() => {
      const card = document.querySelector(`#list-trips [data-trip-id="${matchId}"]`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('match-highlight');
        window.setTimeout(() => card.classList.remove('match-highlight'), 2800);
      }
      if (typeof refreshActiveTripMap === 'function') refreshActiveTripMap(matchId);
    }, 200);
  });
}

function updateActiveTripBanner(matches, loadById, offerById) {
  const banner = document.getElementById('active-trip-banner');
  if (!banner) return;
  const active = (matches || []).find((m) =>
    ['accepted', 'in_progress'].includes(m.status)
  );
  if (!active) {
    banner.hidden = true;
    _bannerActiveMatchId = null;
    const mapEl = document.getElementById('active-trip-map');
    if (mapEl && typeof LiveMap !== 'undefined') LiveMap.destroy(mapEl);
    return;
  }
  const load = loadById[active.load_request_id];
  const offer = offerById[active.capacity_offer_id];
  const route = load ? window.routeLine?.(load) || '' : '';
  const carrier = offer?.carrier_name || 'Transportista';
  const shipper = load?.company_name || 'Embarcador';
  const role =
    typeof getActorRole === 'function' && getActorRole() === 'carrier' ? 'carrier' : 'shipper';
  const statusText = TRIP_STATUS_LABEL[active.status] || active.status;
  const price =
    active.agreed_price_clp != null
      ? `$${Number(active.agreed_price_clp).toLocaleString('es-CL')}`
      : '';
  const counterparty = role === 'shipper' ? carrier : shipper;
  banner.hidden = false;

  const sameMatch = _bannerActiveMatchId === active.id && banner.querySelector('#active-trip-map');
  if (sameMatch) {
    const tag = banner.querySelector('.active-trip-tag');
    const routeEl = banner.querySelector('.active-trip-route');
    const priceEl = banner.querySelector('.active-trip-price');
    if (tag) tag.textContent = statusText;
    if (routeEl) routeEl.innerHTML = `<strong>${counterparty}</strong> · ${route}`;
    if (price) {
      if (priceEl) priceEl.textContent = `${price} CLP acordados`;
      else {
        const mapWrap = banner.querySelector('#active-trip-map');
        const p = document.createElement('p');
        p.className = 'active-trip-price';
        p.textContent = `${price} CLP acordados`;
        mapWrap?.before(p);
      }
    } else if (priceEl) priceEl.remove();
    bindActiveTripBannerNav(active.id);
    if (typeof refreshActiveTripMap === 'function') refreshActiveTripMap(active.id, { soft: true });
    return;
  }

  _bannerActiveMatchId = active.id;
  banner.innerHTML = `
    <div class="active-trip-inner">
      <p class="active-trip-tag">${statusText}</p>
      <p class="active-trip-route"><strong>${counterparty}</strong> · ${route}</p>
      ${price ? `<p class="active-trip-price">${price} CLP acordados</p>` : ''}
      <div id="active-trip-map" class="trip-map-wrap"></div>
      <button type="button" class="btn-secondary" data-goto-trip="${active.id}">Ver viaje</button>
    </div>`;
  bindActiveTripBannerNav(active.id);
  if (typeof refreshActiveTripMap === 'function') refreshActiveTripMap(active.id);
}

function renderTripsList(matches, loadById, offerById) {
  const el = document.getElementById('list-trips');
  if (!el) return;
  const paint = () => {
  const role =
    typeof getActorRole === 'function' && getActorRole() === 'carrier' ? 'carrier' : 'shipper';
  const sorted = [...(matches || [])].sort(
    (a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
  );
  const groups = { active: [], pending: [], done: [], cancelled: [], other: [] };
  sorted.forEach((m) => groups[tripPhase(m)].push(m));

  function cards(rows, empty) {
    if (!rows.length) return `<p class="muted">${empty}</p>`;
    return rows
      .map((m) => {
        const load = loadById[m.load_request_id];
        const offer = offerById[m.capacity_offer_id];
        const title =
          role === 'carrier'
            ? load?.company_name || 'Embarcador'
            : offer?.carrier_name || 'Transportista';
        const partyHeader = buildTripPartyHeader(m, role, load, offer);
        const route = load ? window.routeLine?.(load) || '' : '';
        const price =
          m.agreed_price_clp != null
            ? `$${Number(m.agreed_price_clp).toLocaleString('es-CL')}`
            : m.carrier_offer_clp
              ? `Oferta $${Number(m.carrier_offer_clp).toLocaleString('es-CL')}`
              : '';
        const rateTarget = role === 'shipper' ? 'transportista' : 'embarcador';
        const paymentBadge = buildTripPaymentBadge(m, role);
        const ratingsBlock =
          m.status === 'completed' ? buildTripRatingsBlock(m, role, title) : '';
        const cancelDetail =
          m.status === 'cancelled'
            ? `<p class="trip-cancel-detail muted">${m.cancel_reason || 'Viaje cancelado'}${
                m.penalty_amount_clp
                  ? ` · Multa sugerida $${Number(m.penalty_amount_clp).toLocaleString('es-CL')} CLP`
                  : ''
              }</p>`
            : '';
        let actions = '';
        if (m.status === 'cancelled') {
          if (m.penalty_type === 'fee_suggested' && m.penalty_amount_clp) {
            actions += `<button type="button" class="tab tab-sm" data-open-support="${m.id}" data-support-subject="Multa viaje cancelado">Multa / ayuda</button>`;
            actions += `<button type="button" class="tab tab-sm" data-scroll-penalties>Ir a Cuenta y multas</button>`;
          }
        } else if (m.status === 'proposed') {
          actions = `<button type="button" class="btn-secondary" data-trip-view="${m.id}">Ver propuesta</button>`;
          actions += `<button type="button" class="btn-secondary" data-trip-chat="${m.id}" data-trip-title="${title.replace(/"/g, '')}">Chat</button>`;
        } else if (['accepted', 'in_progress'].includes(m.status)) {
          actions = `<button type="button" class="btn-match-cta" data-trip-chat="${m.id}" data-trip-title="${title.replace(/"/g, '')}">Chat</button>`;
          if (m.status === 'in_progress' && role === 'carrier') {
            actions += `<button type="button" class="btn-secondary" data-trip-incident="${m.id}" data-trip-title="${title.replace(/"/g, '')}">Reportar incidente</button>`;
          }
        } else if (m.status !== 'completed') {
          actions = `<button type="button" class="btn-secondary" data-trip-view="${m.id}">Ver detalle</button>`;
        }
        const alreadyRated = hasRatedMatchId(m.id, m);
        if (m.can_rate && !alreadyRated) {
          actions += `<button type="button" class="btn-trip-rate" data-trip-rate="${m.id}" data-rate-target="${rateTarget}">Calificar ${rateTarget} ★</button>`;
        } else if (m.my_rating?.stars || (alreadyRated && !m.can_rate)) {
          const stars = m.my_rating?.stars;
          if (stars) {
            actions += `<span class="trip-rated-badge" title="Ya calificaste este viaje">${renderStars(stars)} · Calificado</span>`;
          }
        } else if (m.ratings_unavailable) {
          actions += `<span class="muted">Calificaciones no disponibles (revisa /health)</span>`;
        }
        const mapSlot = ['accepted', 'in_progress'].includes(m.status)
          ? `<div class="trip-map-wrap" data-trip-map="${m.id}"></div>`
          : '';
        return `
        <article class="item trip-card" data-trip-id="${m.id}">
          ${partyHeader}
          <p class="trip-route-line">${route}</p>
          ${price ? `<p class="muted">${price}</p>` : ''}
          ${paymentBadge}
          ${m.delivery_note ? `<p class="muted">Entrega: ${m.delivery_note}</p>` : ''}
          ${cancelDetail}
          ${mapSlot}
          ${ratingsBlock}
          <div class="actions">${actions}</div>
        </article>`;
      })
      .join('');
  }

  el.innerHTML = `
    <h3>En curso</h3>
    ${cards(groups.active, 'Sin viajes en curso.')}
    <h3>En negociación</h3>
    ${cards(groups.pending, 'Sin propuestas abiertas.')}
    <h3>Completados</h3>
    ${cards(groups.done, 'Aún no hay viajes cerrados.')}
    <h3>Cancelados</h3>
    ${cards(groups.cancelled, 'Sin viajes cancelados.')}
    ${groups.other.length ? `<h3>Otros</h3>${cards(groups.other, '')}` : ''}
  `;

  el.querySelectorAll('[data-trip-view]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (typeof scrollToActiveMatch === 'function') {
        await scrollToActiveMatch(btn.dataset.tripView);
      }
    });
  });
  el.querySelectorAll('[data-trip-rate]').forEach((btn) => {
    btn.addEventListener('click', () =>
      openRateModal(btn.dataset.tripRate, btn.dataset.rateTarget)
    );
  });
  el.querySelectorAll('[data-trip-chat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (typeof Comms !== 'undefined') {
        Comms.openChat(btn.dataset.tripChat, btn.dataset.tripTitle || '');
      }
    });
  });
  el.querySelectorAll('[data-trip-call]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (typeof ContactUI !== 'undefined') ContactUI.callMatch(btn.dataset.tripCall);
    });
  });
  el.querySelectorAll('[data-trip-incident]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const title = btn.dataset.tripTitle || 'Viaje en curso';
      if (typeof IncidentUI !== 'undefined') {
        IncidentUI.open(btn.dataset.tripIncident, title);
      } else {
        alert('Recarga la app (Ctrl+F5) e intenta de nuevo.');
      }
    });
  });
  el.querySelectorAll('[data-scroll-penalties]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('account-penalties-panel')?.scrollIntoView({ behavior: 'smooth' });
      if (typeof Penalties !== 'undefined') Penalties.refresh();
    });
  });
  groups.active.forEach((m) => {
    if (typeof refreshActiveTripMap === 'function') refreshActiveTripMap(m.id);
  });
  if (typeof PilotPayUI !== 'undefined') PilotPayUI.bind(el);
  };

  if (typeof RatingTags !== 'undefined' && !RatingTags.catalog) {
    RatingTags.loadCatalog().then(paint).catch(paint);
    return;
  }
  paint();
}

let rateModalMatchId = null;
let rateModalRole = 'shipper';

function getRateStars() {
  return Number(document.getElementById('rate-stars')?.value || 5);
}

function setRateStars(n) {
  const stars = Math.max(1, Math.min(5, Number(n) || 5));
  const hidden = document.getElementById('rate-stars');
  if (hidden) hidden.value = String(stars);
  document.querySelectorAll('.rate-star-btn').forEach((btn) => {
    const v = Number(btn.dataset.star);
    btn.classList.toggle('active', v <= stars);
  });
  return stars;
}

function renderRateTags() {
  const wrap = document.getElementById('rate-tags');
  if (!wrap || typeof RatingTags === 'undefined') return;
  const stars = getRateStars();
  const list = RatingTags.tagsForRole(rateModalRole, stars);
  wrap.innerHTML = list
    .map(
      (t) =>
        `<button type="button" class="rate-tag-chip${RatingTags.selected.has(t.id) ? ' selected' : ''}" data-tag-id="${t.id}">${t.label}</button>`
    )
    .join('');
}

function updateRateFormState() {
  const stars = getRateStars();
  const hint = document.getElementById('rate-tags-hint');
  const badge = document.getElementById('rate-tags-badge');
  const commentLabel = document.getElementById('rate-comment-label');
  const comment = document.getElementById('rate-comment');
  const submit = document.getElementById('rate-submit-btn');

  if (stars <= 3) {
    if (hint) hint.textContent = 'Selecciona al menos una opción';
    if (badge) badge.hidden = stars > 2;
  } else if (hint) {
    hint.textContent = 'Opcional: destaca lo que salió bien';
  }
  if (badge) badge.hidden = stars >= 4;

  if (commentLabel) {
    commentLabel.textContent =
      stars <= 2 ? 'Comentario (obligatorio)' : 'Comentario (opcional)';
  }
  if (comment) {
    comment.placeholder =
      stars <= 2
        ? 'Cuéntanos qué podría haber salido mejor…'
        : stars === 3
          ? '¿Qué fue regular? (opcional)'
          : 'Comparte detalles para ayudar a otros en la red…';
    comment.required = stars <= 2;
  }

  if (submit) {
    const errs =
      typeof RatingTags !== 'undefined'
        ? RatingTags.validate(rateModalRole, stars, comment?.value || '')
        : [];
    submit.disabled = errs.length > 0;
  }
}

function onRateStarsChange(stars) {
  if (typeof RatingTags !== 'undefined') RatingTags.clearSelected();
  setRateStars(stars);
  renderRateTags();
  updateRateFormState();
}

function showRateError(message) {
  const el = document.getElementById('rate-error');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
}

function clearRateError() {
  const el = document.getElementById('rate-error');
  if (!el) return;
  el.textContent = '';
  el.hidden = true;
}

function openRateModal(matchId, rateTarget) {
  if (hasRatedMatchId(matchId, null)) {
    alert('Ya calificaste este viaje con esta cuenta. No puedes enviar otra calificación.');
    return;
  }
  rateModalMatchId = matchId;
  const modal = document.getElementById('rate-modal');
  if (!modal) return;
  const role =
    typeof getActorRole === 'function' && getActorRole() === 'carrier' ? 'carrier' : 'shipper';
  const target = rateTarget || (role === 'shipper' ? 'transportista' : 'embarcador');
  const titleEl = document.getElementById('rate-modal-title');
  const leadEl = document.getElementById('rate-modal-lead');
  if (titleEl) titleEl.textContent = `Calificar ${target}`;
  if (leadEl) {
    leadEl.textContent =
      role === 'shipper'
        ? 'Tu nota (1 a 5) queda en la reputación pública del transportista. Ellos también pueden calificarte en este viaje.'
        : 'Tu nota (1 a 5) queda en la reputación pública del embarcador. Ellos también pueden calificarte en este viaje.';
  }
  clearRateError();
  rateModalRole = role;
  if (typeof RatingTags !== 'undefined') {
    RatingTags.clearSelected();
    RatingTags.loadCatalog().then(() => {
      onRateStarsChange(5);
    });
  } else {
    onRateStarsChange(5);
  }
  document.getElementById('rate-comment').value = '';
  const submit = document.getElementById('rate-submit-btn');
  if (submit) {
    submit.textContent = 'Enviar calificación';
  }
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
}

function closeRateModal() {
  rateModalMatchId = null;
  clearRateError();
  const modal = document.getElementById('rate-modal');
  if (modal) {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
  }
}

async function submitRateModal(e) {
  e.preventDefault();
  if (!rateModalMatchId || typeof API === 'undefined') return;
  clearRateError();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const prevLabel = submitBtn?.textContent;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando…';
  }
  const stars = getRateStars();
  const comment = document.getElementById('rate-comment').value;
  const matchId = rateModalMatchId;
  const clientErrors =
    typeof RatingTags !== 'undefined'
      ? RatingTags.validate(rateModalRole, stars, comment)
      : [];
  if (clientErrors.length) {
    showRateError(clientErrors.join(' '));
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = prevLabel || 'Enviar calificación';
    }
    return;
  }
  const tags = typeof RatingTags !== 'undefined' ? RatingTags.selectedIds() : [];
  try {
    const res = await fetch(`/api/matches/${matchId}/rate`, {
      method: 'POST',
      headers: typeof Auth !== 'undefined' ? Auth.headers() : { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stars, comment, tags }),
    });
    let json = {};
    try {
      json = await res.json();
    } catch {
      json = {};
    }
    if (!res.ok) {
      let msg =
        json.error || json.errors?.join('\n') || 'No se pudo guardar la calificación';
      if (json.detail) msg += ` (${json.detail})`;
      if (res.status === 409) {
        markRatedMatchId(matchId);
        closeRateModal();
        if (typeof refreshBoard === 'function') await refreshBoard();
        alert(msg);
        return;
      }
      showRateError(msg);
      updateRateFormState();
      return;
    }
    markRatedMatchId(matchId);
    closeRateModal();
    if (typeof refreshBoard === 'function') await refreshBoard();
    alert(json.message || 'Calificación guardada. ¡Gracias!');
  } catch (err) {
    console.error(err);
    closeRateModal();
    alert('No se pudo conectar con el servidor. Intenta de nuevo.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = prevLabel || 'Enviar calificación';
    }
  }
}

async function scrollToTripCard(matchId) {
  if (!matchId) return;
  if (typeof AppShell !== 'undefined' && AppShell.setTab) {
    AppShell.setTab('activity');
  } else if (typeof showTab === 'function') {
    showTab('trips');
  }
  if (typeof refreshBoard === 'function') await refreshBoard();
  requestAnimationFrame(() => {
    const card = document.querySelector(`[data-trip-id="${matchId}"]`);
    if (!card) return;
    card.classList.add('match-highlight');
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => card.classList.remove('match-highlight'), 2500);
  });
}

window.updateActiveTripBanner = updateActiveTripBanner;
window.renderTripsList = renderTripsList;
window.openRateModal = openRateModal;
window.clearRatedMatchIds = clearRatedMatchIds;
window.scrollToTripCard = scrollToTripCard;

function initRateModalUi() {
  document.getElementById('rate-stars-picker')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.rate-star-btn');
    if (!btn) return;
    onRateStarsChange(Number(btn.dataset.star));
  });
  document.getElementById('rate-tags')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.rate-tag-chip');
    if (!chip || typeof RatingTags === 'undefined') return;
    const id = chip.dataset.tagId;
    if (RatingTags.selected.has(id)) RatingTags.selected.delete(id);
    else RatingTags.selected.add(id);
    chip.classList.toggle('selected');
    updateRateFormState();
  });
  document.getElementById('rate-comment')?.addEventListener('input', updateRateFormState);
  document.getElementById('form-rate')?.addEventListener('submit', submitRateModal);
  document.querySelectorAll('[data-close-rate]').forEach((el) => {
    el.addEventListener('click', closeRateModal);
  });
  if (typeof RatingTags !== 'undefined') RatingTags.loadCatalog();
}

document.addEventListener('DOMContentLoaded', initRateModalUi);
