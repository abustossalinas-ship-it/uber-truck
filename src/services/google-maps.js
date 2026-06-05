'use strict';

const { parseAddressComponents } = require('../lib/chile-regions');

function isConfigured() {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY || process.env.MAPS_API_KEY);
}

function apiKey() {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.MAPS_API_KEY;
}

/** Clave para Maps JavaScript API en el navegador (APK/web). */
function browserApiKey() {
  return (
    process.env.GOOGLE_MAPS_BROWSER_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.MAPS_API_KEY ||
    null
  );
}

function interactiveMapsAvailable() {
  return isConfigured() && Boolean(browserApiKey());
}

async function googleGet(path, params) {
  const url = new URL(`https://maps.googleapis.com/maps/api/${path}`);
  url.searchParams.set('key', apiKey());
  url.searchParams.set('language', 'es');
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') url.searchParams.set(k, v);
  }
  const res = await fetch(url);
  const data = await res.json();
  if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    const err = new Error(data.error_message || data.status);
    err.googleStatus = data.status;
    throw err;
  }
  return data;
}

async function autocomplete(input) {
  if (!input || input.trim().length < 3) return [];
  const data = await googleGet('place/autocomplete/json', {
    input: input.trim(),
    components: 'country:cl',
    types: 'geocode|establishment',
  });
  return (data.predictions || []).map((p) => ({
    place_id: p.place_id,
    description: p.description,
    main_text: p.structured_formatting?.main_text || p.description,
  }));
}

async function placeDetails(placeId) {
  const data = await googleGet('place/details/json', {
    place_id: placeId,
    fields: 'address_component,geometry,formatted_address,name,types',
  });
  const r = data.result;
  if (!r) return null;
  const parsed = parseAddressComponents(r.address_components || []);
  const loc = r.geometry?.location;
  return {
    place_id: placeId,
    formatted_address: r.formatted_address,
    name: r.name,
    types: r.types || [],
    lat: loc?.lat ?? null,
    lng: loc?.lng ?? null,
    commune: parsed.commune,
    city: parsed.city,
    region: parsed.region,
    region_name: parsed.region_name,
  };
}

async function distanceKm(origin, destination, opts = {}) {
  const o = `${origin.lat},${origin.lng}`;
  const d = `${destination.lat},${destination.lng}`;
  const params = {
    origins: o,
    destinations: d,
    mode: 'driving',
    units: 'metric',
  };
  if (opts.traffic) params.departure_time = 'now';
  const data = await googleGet('distancematrix/json', params);
  const el = data.rows?.[0]?.elements?.[0];
  if (!el || el.status !== 'OK') {
    return { ok: false, error: el?.status || 'NO_ROUTE' };
  }
  const durationSec = el.duration_in_traffic?.value ?? el.duration.value;
  return {
    ok: true,
    distance_km: Math.round((el.distance.value / 1000) * 10) / 10,
    duration_min: Math.round(durationSec / 60),
    distance_text: el.distance.text,
    duration_text: el.duration_in_traffic?.text || el.duration.text,
    duration_in_traffic: Boolean(el.duration_in_traffic),
  };
}

function decodePolyline(encoded) {
  if (!encoded) return [];
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

/** Ruta por calles (Directions API) — overview polyline. */
async function drivingRoutePath(origin, destination) {
  if (!origin?.lat || !destination?.lat) return { ok: false, path: [] };
  try {
    const data = await googleGet('directions/json', {
      origin: `${origin.lat},${origin.lng}`,
      destination: `${destination.lat},${destination.lng}`,
      mode: 'driving',
    });
    const route = data.routes?.[0];
    if (!route) return { ok: false, path: [] };
    const encoded = route.overview_polyline?.points;
    return { ok: true, path: decodePolyline(encoded) };
  } catch {
    return { ok: false, path: [] };
  }
}

function buildNavigationUrls(origin, destination) {
  if (!destination?.lat) return {};
  const dest = `${destination.lat},${destination.lng}`;
  let navigation_url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving`;
  if (origin?.lat != null) {
    navigation_url += `&origin=${encodeURIComponent(`${origin.lat},${origin.lng}`)}`;
  }
  return {
    navigation_url,
    navigation_android_intent: `google.navigation:q=${dest}`,
  };
}

/** Mapa estático para embarcador / seguimiento (origen, destino, camión). */
function staticMapUrl({ origin, destination, carrier, size = '640x280' }) {
  if (!isConfigured()) return null;
  const parts = [];
  if (origin?.lat != null) {
    parts.push(`markers=color:green|label:${origin.label || 'O'}|${origin.lat},${origin.lng}`);
  }
  if (destination?.lat != null) {
    parts.push(
      `markers=color:red|label:${destination.label || 'D'}|${destination.lat},${destination.lng}`
    );
  }
  if (carrier?.lat != null) {
    parts.push(`markers=color:orange|label:${carrier.label || 'T'}|${carrier.lat},${carrier.lng}`);
  }
  if (!parts.length) return null;
  const url = new URL('https://maps.googleapis.com/maps/api/staticmap');
  url.searchParams.set('size', size);
  url.searchParams.set('scale', '2');
  url.searchParams.set('maptype', 'roadmap');
  url.searchParams.set('key', apiKey());
  url.searchParams.set('language', 'es');
  if (origin?.lat != null && destination?.lat != null) {
    url.searchParams.append(
      'path',
      `color:0xf26522|weight:4|${origin.lat},${origin.lng}|${destination.lat},${destination.lng}`
    );
  }
  for (const p of parts) {
    url.searchParams.append('markers', p.replace(/^markers=/, ''));
  }
  return url.toString();
}

module.exports = {
  isConfigured,
  browserApiKey,
  interactiveMapsAvailable,
  autocomplete,
  placeDetails,
  distanceKm,
  drivingRoutePath,
  buildNavigationUrls,
  staticMapUrl,
};
