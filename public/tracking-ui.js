/** GPS transportista — Disponible + mapa del viaje activo */

let gpsWatchId = null;
let lastGpsSentAt = 0;
let activeTrackMatchId = null;

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

/** Transportista: GPS activo con sesión (mapa en viaje + última posición). El toggle solo es visibilidad en tablero. */
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
      refreshActiveTripMap(json.data.active_match_id);
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

function tripMapImageSrc(matchId, tracking) {
  if (matchId && typeof Auth !== 'undefined' && Auth.token) {
    return `/api/maps/trip-map/${encodeURIComponent(matchId)}?access_token=${encodeURIComponent(Auth.token)}`;
  }
  return tracking?.static_map_url || null;
}

function renderTripMapEl(container, tracking) {
  if (!container) return;
  if (!tracking?.tracking_active) {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }
  container.hidden = false;
  const updated = formatGpsTime(tracking.carrier_position?.updated_at);
  const mapSrc = tripMapImageSrc(tracking.match_id, tracking);
  const hasRoute = tracking.route?.origin?.lat != null && tracking.route?.destination?.lat != null;
  const mapBlock = mapSrc
    ? `<img class="trip-map-img" src="${mapSrc}" alt="Mapa del viaje: origen, destino y camión" loading="lazy" />`
    : hasRoute
      ? `<p class="muted">Mapa no disponible (configura GOOGLE_MAPS_API_KEY en el servidor).</p>`
      : `<p class="muted">Sin mapa: la carga no tiene coordenadas. Vuelve a publicarla eligiendo origen y destino en Google Maps.</p>`;
  const posNote = tracking.carrier_position
    ? `<p class="muted trip-map-meta">Camión en mapa (naranja)${updated ? ` · ${updated}` : ''}</p>`
    : `<p class="muted trip-map-meta">Origen (verde) y destino (rojo). El camión (naranja) aparece cuando el transportista activa «Disponible» o comparte GPS en ruta.</p>`;
  container.innerHTML = `<div class="trip-map-card">${mapBlock}${posNote}</div>`;
  const img = container.querySelector('.trip-map-img');
  if (img) {
    img.addEventListener('error', () => {
      img.replaceWith(
        Object.assign(document.createElement('p'), {
          className: 'muted trip-map-fallback',
          textContent:
            'No se pudo cargar el mapa. En Google Cloud habilita «Maps Static API» para la misma clave que Places.',
        })
      );
    });
  }
}

async function refreshActiveTripMap(matchId) {
  activeTrackMatchId =
    matchId && typeof Auth !== 'undefined' && Auth.user?.role === 'carrier' ? matchId : null;
  syncGpsWatch();

  const bannerMap = document.getElementById('active-trip-map');
  const cardMap = document.querySelector(`[data-trip-map="${matchId}"]`);
  if (!matchId || typeof Auth === 'undefined' || !Auth.token) {
    if (bannerMap) {
      bannerMap.hidden = true;
      bannerMap.innerHTML = '';
    }
    return;
  }
  const targets = [bannerMap, cardMap].filter(Boolean);
  if (!targets.length) return;
  targets.forEach((el) => {
    el.hidden = false;
    el.innerHTML = '<p class="muted">Cargando mapa…</p>';
  });
  try {
    const res = await fetch(`/api/matches/${encodeURIComponent(matchId)}/tracking`, {
      headers: trackingHeaders(),
    });
    const json = await res.json();
    if (!res.ok) {
      targets.forEach((el) => {
        el.innerHTML = `<p class="muted">${json.error || 'Mapa no disponible'}</p>`;
      });
      return;
    }
    targets.forEach((el) => renderTripMapEl(el, json.data));
    if (json.data?.tracking_active && Auth.user?.role === 'carrier') {
      activeTrackMatchId = matchId;
      syncGpsWatch();
      try {
        const pos = await readCurrentPosition();
        await postCarrierLocation(pos.lat, pos.lng);
      } catch (_) {}
    }
  } catch (e) {
    console.error(e);
    targets.forEach((el) => {
      el.innerHTML = '<p class="muted">No se pudo cargar el mapa.</p>';
    });
  }
}

function onBoardMatchesUpdated(matches) {
  const active = (matches || []).find((m) => ['accepted', 'in_progress'].includes(m.status));
  if (active) refreshActiveTripMap(active.id);
  else {
    activeTrackMatchId = null;
    syncGpsWatch();
    const bannerMap = document.getElementById('active-trip-map');
    if (bannerMap) {
      bannerMap.hidden = true;
      bannerMap.innerHTML = '';
    }
  }
}

window.refreshCarrierPresencePanel = refreshCarrierPresencePanel;
window.refreshActiveTripMap = refreshActiveTripMap;
window.onBoardMatchesUpdated = onBoardMatchesUpdated;
