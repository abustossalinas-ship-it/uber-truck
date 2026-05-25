'use strict';

const { parseAddressComponents } = require('../lib/chile-regions');

function isConfigured() {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY || process.env.MAPS_API_KEY);
}

function apiKey() {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.MAPS_API_KEY;
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
    fields: 'address_component,geometry,formatted_address,name',
  });
  const r = data.result;
  if (!r) return null;
  const parsed = parseAddressComponents(r.address_components || []);
  const loc = r.geometry?.location;
  return {
    place_id: placeId,
    formatted_address: r.formatted_address,
    name: r.name,
    lat: loc?.lat ?? null,
    lng: loc?.lng ?? null,
    commune: parsed.commune,
    city: parsed.city,
    region: parsed.region,
    region_name: parsed.region_name,
  };
}

async function distanceKm(origin, destination) {
  const o = `${origin.lat},${origin.lng}`;
  const d = `${destination.lat},${destination.lng}`;
  const data = await googleGet('distancematrix/json', {
    origins: o,
    destinations: d,
    mode: 'driving',
    units: 'metric',
  });
  const el = data.rows?.[0]?.elements?.[0];
  if (!el || el.status !== 'OK') {
    return { ok: false, error: el?.status || 'NO_ROUTE' };
  }
  return {
    ok: true,
    distance_km: Math.round((el.distance.value / 1000) * 10) / 10,
    duration_min: Math.round(el.duration.value / 60),
    distance_text: el.distance.text,
    duration_text: el.duration.text,
  };
}

module.exports = {
  isConfigured,
  autocomplete,
  placeDetails,
  distanceKm,
};
