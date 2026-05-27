/** Mis viajes — paridad Uber: viaje activo, historial, calificación */

const RATED_MATCHES_KEY = 'ut_rated_matches';

function loadRatedMatchIds() {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(RATED_MATCHES_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function markRatedMatchId(matchId) {
  const set = loadRatedMatchIds();
  set.add(matchId);
  sessionStorage.setItem(RATED_MATCHES_KEY, JSON.stringify([...set]));
}

function hasRatedMatchId(matchId, match) {
  if (match?.my_rating) return true;
  return loadRatedMatchIds().has(matchId);
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
        let actions = `<button type="button" class="btn-secondary" data-trip-view="${m.id}">Abrir</button>`;
        const alreadyRated = hasRatedMatchId(m.id, m);
        if (m.can_rate && !alreadyRated) {
          actions += `<button type="button" class="btn-trip-rate" data-trip-rate="${m.id}">Calificar ★</button>`;
        } else if (m.my_rating || alreadyRated) {
          const stars = m.my_rating?.stars || 5;
          actions += `<span class="trip-rated-badge" title="Ya calificaste este viaje">${renderStars(stars)} · Calificado</span>`;
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
    btn.addEventListener('click', () => openRateModal(btn.dataset.tripRate));
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

function openRateModal(matchId) {
  if (hasRatedMatchId(matchId, null)) {
    alert('Ya calificaste este viaje. No puedes enviar otra calificación.');
    return;
  }
  rateModalMatchId = matchId;
  const modal = document.getElementById('rate-modal');
  if (!modal) return;
  clearRateError();
  document.getElementById('rate-stars').value = '5';
  document.getElementById('rate-comment').value = '';
  const submit = document.querySelector('#form-rate button[type="submit"]');
  if (submit) {
    submit.disabled = false;
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
  const stars = document.getElementById('rate-stars').value;
  const comment = document.getElementById('rate-comment').value;
  const matchId = rateModalMatchId;
  try {
    const res = await fetch(`/api/matches/${matchId}/rate`, {
      method: 'POST',
      headers: typeof Auth !== 'undefined' ? Auth.headers() : { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stars: Number(stars), comment }),
    });
    let json = {};
    try {
      json = await res.json();
    } catch {
      json = {};
    }
    if (!res.ok) {
      const msg =
        json.error || json.errors?.join('\n') || 'No se pudo guardar la calificación';
      if (res.status === 409) {
        markRatedMatchId(matchId);
        closeRateModal();
        if (typeof refreshBoard === 'function') await refreshBoard();
        alert(msg);
        return;
      }
      showRateError(msg);
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

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('form-rate')?.addEventListener('submit', submitRateModal);
  document.querySelectorAll('[data-close-rate]').forEach((el) => {
    el.addEventListener('click', closeRateModal);
  });
});
