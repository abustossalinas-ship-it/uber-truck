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

function updateActiveTripBanner(matches, loadById, offerById) {
  const banner = document.getElementById('active-trip-banner');
  if (!banner) return;
  const active = (matches || []).find((m) =>
    ['accepted', 'in_progress'].includes(m.status)
  );
  if (!active) {
    banner.hidden = true;
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
  banner.hidden = false;
  banner.innerHTML = `
    <div class="active-trip-inner">
      <p class="active-trip-tag">${statusText}</p>
      <p class="active-trip-route"><strong>${role === 'shipper' ? carrier : shipper}</strong> · ${route}</p>
      ${price ? `<p class="active-trip-price">${price} CLP acordados</p>` : ''}
      <button type="button" class="btn-secondary" data-goto-trip="${active.id}">Ver viaje</button>
    </div>`;
  banner.querySelector('[data-goto-trip]')?.addEventListener('click', () => {
    if (typeof showTab === 'function') showTab('trips');
    if (typeof scrollToActiveMatch === 'function') scrollToActiveMatch(active.id);
  });
}

function renderTripsList(matches, loadById, offerById) {
  const el = document.getElementById('list-trips');
  if (!el) return;
  if (typeof RatingTags !== 'undefined' && !RatingTags.catalog) {
    RatingTags.loadCatalog().then(() => renderTripsList(matches, loadById, offerById));
    return;
  }
  const role =
    typeof getActorRole === 'function' && getActorRole() === 'carrier' ? 'carrier' : 'shipper';
  const sorted = [...(matches || [])].sort(
    (a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
  );
  const groups = { active: [], pending: [], done: [], other: [] };
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
        const route = load ? window.routeLine?.(load) || '' : '';
        const price =
          m.agreed_price_clp != null
            ? `$${Number(m.agreed_price_clp).toLocaleString('es-CL')}`
            : m.carrier_offer_clp
              ? `Oferta $${Number(m.carrier_offer_clp).toLocaleString('es-CL')}`
              : '';
        const rateTarget = role === 'shipper' ? 'transportista' : 'embarcador';
        const ratingsBlock =
          m.status === 'completed' ? buildTripRatingsBlock(m, role, title) : '';
        let actions = '';
        if (m.status !== 'completed') {
          const openLabel =
            m.status === 'proposed' ? 'Ver propuesta' : 'Gestionar viaje';
          actions = `<button type="button" class="btn-secondary" data-trip-view="${m.id}">${openLabel}</button>`;
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
        if (['accepted', 'in_progress'].includes(m.status)) {
          actions += `<button type="button" class="btn-secondary" data-trip-chat="${m.id}" data-trip-title="${title.replace(/"/g, '')}">Chat</button>`;
        }
        return `
        <article class="item trip-card" data-trip-id="${m.id}">
          <strong>${title}</strong>
          <span class="pill">${TRIP_STATUS_LABEL[m.status] || m.status}</span>
          <p>${route}</p>
          ${price ? `<p class="muted">${price}</p>` : ''}
          ${m.delivery_note ? `<p class="muted">Entrega: ${m.delivery_note}</p>` : ''}
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
    ${groups.other.length ? `<h3>Otros</h3>${cards(groups.other, '')}` : ''}
  `;

  el.querySelectorAll('[data-trip-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (typeof scrollToActiveMatch === 'function') {
        showTab('board');
        scrollToActiveMatch(btn.dataset.tripView);
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

window.updateActiveTripBanner = updateActiveTripBanner;
window.renderTripsList = renderTripsList;
window.openRateModal = openRateModal;
window.clearRatedMatchIds = clearRatedMatchIds;

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
