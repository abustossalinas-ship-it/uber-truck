/** Mis viajes — paridad Uber: viaje activo, historial, calificación */

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
        if (m.can_rate) {
          actions += `<button type="button" data-trip-rate="${m.id}">Calificar ★</button>`;
        } else if (m.my_rating) {
          actions += `<span class="muted">${renderStars(m.my_rating.stars)}</span>`;
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

function openRateModal(matchId) {
  rateModalMatchId = matchId;
  const modal = document.getElementById('rate-modal');
  if (!modal) return;
  document.getElementById('rate-stars').value = '5';
  document.getElementById('rate-comment').value = '';
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
}

function closeRateModal() {
  rateModalMatchId = null;
  const modal = document.getElementById('rate-modal');
  if (modal) {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
  }
}

async function submitRateModal(e) {
  e.preventDefault();
  if (!rateModalMatchId || typeof API === 'undefined') return;
  const stars = document.getElementById('rate-stars').value;
  const comment = document.getElementById('rate-comment').value;
  const json = await API.rateMatch(rateModalMatchId, { stars: Number(stars), comment });
  if (!json.ok) {
    alert(json.error || json.errors?.join('\n') || 'No se pudo calificar');
    return;
  }
  closeRateModal();
  alert(json.message || 'Calificación guardada');
  if (typeof refreshBoard === 'function') refreshBoard();
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
