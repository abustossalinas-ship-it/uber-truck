function apiHeaders() {
  return typeof Auth !== 'undefined' ? Auth.headers() : { 'Content-Type': 'application/json' };
}

const API = {
  loads: () => fetch('/api/load-requests?status=published', { headers: apiHeaders() }).then((r) => r.json()),
  offers: () => fetch('/api/capacity-offers?status=published', { headers: apiHeaders() }).then((r) => r.json()),
  allLoads: () => fetch('/api/load-requests', { headers: apiHeaders() }).then((r) => r.json()),
  allOffers: () => fetch('/api/capacity-offers', { headers: apiHeaders() }).then((r) => r.json()),
  matches: () => fetch('/api/matches', { headers: apiHeaders() }).then((r) => r.json()),
  suggestions: (loadId) =>
    fetch(`/api/load-requests/${loadId}/match-suggestions`, { headers: apiHeaders() }).then((r) => r.json()),
  postLoad: (body) =>
    fetch('/api/load-requests', { method: 'POST', headers: apiHeaders(), body: JSON.stringify(body) }),
  postOffer: (body) =>
    fetch('/api/capacity-offers', { method: 'POST', headers: apiHeaders(), body: JSON.stringify(body) }),
  postMatch: (body) =>
    fetch('/api/matches', { method: 'POST', headers: apiHeaders(), body: JSON.stringify(body) }),
  patchMatch: (id, status) =>
    fetch(`/api/matches/${id}/status`, {
      method: 'PATCH',
      headers: apiHeaders(),
      body: JSON.stringify({ status }),
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

function $(id) {
  return document.getElementById(id);
}

let boardRefreshGen = 0;
let stickyMatchLoadId = null;
let stickyMatchOfferId = null;

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

  $('list-matches').innerHTML =
    matches.data?.length === 0
      ? '<p class="muted">Sin emparejamientos aún.</p>'
      : matches.data
          .map((m) => {
            const load = loadById[m.load_request_id];
            const offer = offerById[m.capacity_offer_id];
            const title =
              load && offer
                ? `${load.company_name} ↔ ${offer.carrier_name}`
                : `Carga · Oferta`;
            const actions =
              m.status === 'proposed'
                ? `<button type="button" data-action="accept" data-id="${m.id}">Aceptar</button>`
                : m.status === 'accepted'
                  ? `<button type="button" data-action="progress" data-id="${m.id}">En ruta</button>`
                  : m.status === 'in_progress'
                    ? `<button type="button" data-action="complete" data-id="${m.id}">Cerrar</button>`
                    : '';
            return `
      <article class="item match-item">
        <strong>${title}</strong>
        <span class="pill">${STATUS_LABEL[m.status] || m.status}</span>
        ${m.agreed_price_clp ? `<p>$${Number(m.agreed_price_clp).toLocaleString('es-CL')} CLP</p>` : ''}
        <div class="actions">${actions}</div>
      </article>`;
          })
          .join('');

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
  loadSuggestionsFor(loadSel.value);
  showMatchReady();
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
  const map = { accept: 'accepted', progress: 'in_progress', complete: 'completed' };
  const res = await API.patchMatch(btn.dataset.id, map[btn.dataset.action]);
  const json = await res.json();
  if (!res.ok) alert(json.error || 'Error');
  refreshBoard();
});

fetch('/health')
  .then((r) => r.json())
  .then((h) => {
    const el = document.getElementById('storage-badge');
    if (!el) return;
    if (h.ui === 'match-flow-v3' || h.ui === 'match-flow-v2') {
      el.textContent = `v${h.version || '?'} · emparejar mejorado`;
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

showTab('shipper');
