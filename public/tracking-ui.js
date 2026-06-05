/** GPS transportista — Disponible + mapa interactivo del viaje activo */

let gpsWatchId = null;
let lastGpsSentAt = 0;
let activeTrackMatchId = null;
const trackingFetchByMatch = new Map();

function trackingHeaders() {
  return typeof Auth !== 'undefined' ? Auth.headers() : { 'Content-Type': 'application/json' };
}

function formatGpsTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '';
  }
}

async function readCurrentPosition() {
  if (!navigator.geolocation) {
    throw new Error('Tu navegador no soporta GPS');
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 15000 }
    );
  });
}

function stopGpsWatch() {
  if (gpsWatchId != null) {
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
  }
}

function shouldShareGps() {
  const user = typeof Auth !== 'undefined' ? Auth.user : null;
  return Boolean(user && user.role === 'carrier');
}

async function postCarrierLocation(lat, lng) {
  const now = Date.now();
  if (now - lastGpsSentAt < 25000) return;
  lastGpsSentAt = now;
  try {
    const res = await fetch('/api/carrier/location', {
      method: 'POST',
      headers: trackingHeaders(),
      body: JSON.stringify({ lat, lng }),
    });
    const json = await res.json();
    if (res.ok && json.data?.active_match_id && typeof refreshActiveTripMap === 'function') {
      refreshActiveTripMap(json.data.active_match_id, { soft: true });
    }
  } catch (e) {
    console.error('gps post', e);
  }
}

function startGpsWatch() {
  if (!navigator.geolocation || gpsWatchId != null) return;
  gpsWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      if (!shouldShareGps()) return;
      postCarrierLocation(pos.coords.latitude, pos.coords.longitude);
    },
    (err) => {
      const status = document.getElementById('carrier-gps-status');
      if (status) status.textContent = `GPS: ${err.message || 'sin señal'}`;
    },
    { enableHighAccuracy: true, maximumAge: 30000, timeout: 25000 }
  );
}

function syncGpsWatch() {
  if (shouldShareGps()) startGpsWatch();
  else stopGpsWatch();
}

async function refreshCarrierPresencePanel() {
  const panel = document.getElementById('carrier-presence-panel');
  const toggle = document.getElementById('carrier-available-toggle');
  const label = document.getElementById('carrier-available-label');
  const status = document.getElementById('carrier-gps-status');
  const user = typeof Auth !== 'undefined' ? Auth.user : null;
  if (!panel || !toggle) return;
  if (!user || user.role !== 'carrier') {
    panel.hidden = true;
    stopGpsWatch();
    return;
  }
  panel.hidden = false;
  try {
    const res = await fetch('/api/carrier/presence', { headers: trackingHeaders() });
    const json = await res.json();
    if (res.ok && json.data) {
      user.is_available = Boolean(json.data.is_available);
      Auth.user.is_available = user.is_available;
      toggle.checked = user.is_available;
    } else {
      toggle.checked = Boolean(user.is_available);
    }
  } catch {
    toggle.checked = Boolean(user.is_available);
  }
  if (label) {
    label.textContent = toggle.checked
      ? 'Visible en tablero para nuevas cargas'
      : 'No visible en tablero (GPS sigue activo en viaje)';
  }
  if (status) {
    const t = formatGpsTime(user.location_updated_at);
    status.textContent = toggle.checked
      ? `GPS activo · visible en tablero${t ? ` · última: ${t}` : ''}`
      : `GPS activo en sesión${t ? ` · última: ${t}` : ''} · activa el interruptor para aparecer en el tablero`;
  }
  syncGpsWatch();
  if (typeof initCarrierTruckProfile === 'function') initCarrierTruckProfile();
  if (user.role === 'carrier') {
    try {
      const pos = await readCurrentPosition();
      await postCarrierLocation(pos.lat, pos.lng);
    } catch (_) {
      /* permiso GPS pendiente */
    }
  }
}

async function setCarrierAvailable(on) {
  const status = document.getElementById('carrier-gps-status');
  if (on) {
    if (status) status.textContent = 'Obteniendo ubicación…';
    const pos = await readCurrentPosition();
    const res = await fetch('/api/carrier/availability', {
      method: 'PATCH',
      headers: trackingHeaders(),
      body: JSON.stringify({ is_available: true, lat: pos.lat, lng: pos.lng }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'No se pudo activar');
    if (typeof Auth !== 'undefined' && Auth.user) {
      Auth.user.is_available = true;
      Auth.user.last_lat = pos.lat;
      Auth.user.last_lng = pos.lng;
      Auth.user.location_updated_at = json.data?.location_updated_at || new Date().toISOString();
    }
  } else {
    const res = await fetch('/api/carrier/availability', {
      method: 'PATCH',
      headers: trackingHeaders(),
      body: JSON.stringify({ is_available: false }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'No se pudo desactivar');
    if (typeof Auth !== 'undefined' && Auth.user) Auth.user.is_available = false;
  }
  await refreshCarrierPresencePanel();
  syncGpsWatch();
}

document.getElementById('carrier-available-toggle')?.addEventListener('change', async (e) => {
  const toggle = e.target;
  toggle.disabled = true;
  try {
    await setCarrierAvailable(toggle.checked);
  } catch (err) {
    toggle.checked = !toggle.checked;
    alert(err.message || 'No se pudo cambiar disponibilidad. Revisa permisos de ubicación.');
  } finally {
    toggle.disabled = false;
  }
});

function tripMapImageSrc(matchId) {
  if (matchId && typeof Auth !== 'undefined' && Auth.token) {
    return `/api/maps/trip-map/${encodeURIComponent(matchId)}?access_token=${encodeURIComponent(Auth.token)}`;
  }
  return null;
}

function renderTripMapStatic(container, tracking) {
  if (!container) return;
  const updated = formatGpsTime(tracking.carrier_position?.updated_at);
  const mapSrc = tripMapImageSrc(tracking.match_id);
  const hasRoute = tracking.route?.origin?.lat != null && tracking.route?.destination?.lat != null;
  const mapBlock = mapSrc
    ? `<img class="trip-map-img" src="${mapSrc}" alt="Mapa del viaje" loading="lazy" />`
    : hasRoute
      ? `<p class="muted">Mapa no disponible (configura GOOGLE_MAPS_API_KEY).</p>`
      : `<p class="muted">Sin mapa: publica la carga con sugerencias Google Maps.</p>`;
  const posNote = tracking.carrier_position
    ? `<p class="muted trip-map-meta">Camión (naranja)${updated ? ` · ${updated}` : ''}</p>`
    : `<p class="muted trip-map-meta">El camión aparece cuando el transportista comparte GPS.</p>`;
  container.innerHTML = `<div class="trip-map-card">${mapBlock}${posNote}</div>`;
  const img = container.querySelector('.trip-map-img');
  if (img) {
    img.addEventListener('error', () => {
      img.replaceWith(
        Object.assign(document.createElement('p'), {
          className: 'muted trip-map-fallback',
          textContent: 'No se pudo cargar el mapa estático. Habilita Maps Static API.',
        })
      );
    });
  }
}

async function renderTripMapEl(container, tracking) {
  if (!container) return;
  if (!tracking?.tracking_active) {
    if (typeof LiveMap !== 'undefined') LiveMap.destroy(container);
    container.hidden = true;
    container.innerHTML = '';
    return;
  }
  container.hidden = false;

  if (typeof LiveMap !== 'undefined') {
    const ok = await LiveMap.render(container, tracking);
    if (ok) return;
  }
  renderTripMapStatic(container, tracking);
}

async function fetchTracking(matchId) {
  const res = await fetch(`/api/matches/${encodeURIComponent(matchId)}/tracking`, {
    headers: trackingHeaders(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Mapa no disponible');
  return json.data;
}

async function refreshActiveTripMap(matchId, opts = {}) {
  const soft = Boolean(opts.soft);
  activeTrackMatchId =
    matchId && typeof Auth !== 'undefined' && Auth.user?.role === 'carrier' ? matchId : null;
  syncGpsWatch();

  const bannerMap = document.getElementById('active-trip-map');
  const cardMap = document.querySelector(`[data-trip-map="${matchId}"]`);
  if (!matchId || typeof Auth === 'undefined' || !Auth.token) {
    if (bannerMap && typeof LiveMap !== 'undefined') LiveMap.destroy(bannerMap);
    return;
  }
  const targets = [bannerMap, cardMap].filter(Boolean);
  if (!targets.length) return;

  if (!soft) {
    targets.forEach((el) => {
      if (!el.querySelector('.trip-map-live') && !el.querySelector('.trip-map-img')) {
        el.hidden = false;
        el.innerHTML = '<p class="muted">Cargando mapa…</p>';
      }
    });
  }

  try {
    let tracking = null;
    const inflight = trackingFetchByMatch.get(matchId);
    if (inflight) tracking = await inflight;
    else {
      const p = fetchTracking(matchId);
      trackingFetchByMatch.set(matchId, p);
      try {
        tracking = await p;
      } finally {
        trackingFetchByMatch.delete(matchId);
      }
    }

    await Promise.all(targets.map((el) => renderTripMapEl(el, tracking)));

    if (tracking?.tracking_active && Auth.user?.role === 'carrier') {
      activeTrackMatchId = matchId;
      syncGpsWatch();
      try {
        const pos = await readCurrentPosition();
        await postCarrierLocation(pos.lat, pos.lng);
      } catch (_) {}
    }
  } catch (e) {
    console.error(e);
    if (!soft) {
      targets.forEach((el) => {
        el.innerHTML = `<p class="muted">${e.message || 'No se pudo cargar el mapa.'}</p>`;
      });
    }
  }
}

function onBoardMatchesUpdated(matches) {
  const active = (matches || []).find((m) => ['accepted', 'in_progress'].includes(m.status));
  if (active) refreshActiveTripMap(active.id);
  else {
    activeTrackMatchId = null;
    syncGpsWatch();
    const bannerMap = document.getElementById('active-trip-map');
    if (bannerMap && typeof LiveMap !== 'undefined') LiveMap.destroy(bannerMap);
    else if (bannerMap) {
      bannerMap.hidden = true;
      bannerMap.innerHTML = '';
    }
  }
}

window.refreshCarrierPresencePanel = refreshCarrierPresencePanel;
window.refreshActiveTripMap = refreshActiveTripMap;
window.onBoardMatchesUpdated = onBoardMatchesUpdated;
