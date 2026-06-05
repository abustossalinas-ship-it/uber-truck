'use strict';

const repo = require('./repository');
const maps = require('../services/google-maps');
const { filterMatchesForUser } = require('./access-scope');
const { listTripEvents } = require('./trip-events');

async function buildLocationTrail(matchId, carrier) {
  const events = await listTripEvents(matchId);
  const trail = events
    .filter((e) => e.event_type === 'location_update' && e.payload?.lat != null)
    .map((e) => ({
      lat: Number(e.payload.lat),
      lng: Number(e.payload.lng),
      at: e.created_at,
    }));
  if (carrier?.lat != null && carrier?.lng != null) {
    const last = trail[trail.length - 1];
    if (!last || last.lat !== carrier.lat || last.lng !== carrier.lng) {
      trail.push({
        lat: carrier.lat,
        lng: carrier.lng,
        at: carrier.updated_at || new Date().toISOString(),
      });
    }
  }
  return trail;
}

async function buildMatchTracking(matchId, user) {
  const match = await repo.getById('matches', matchId);
  if (!match) {
    const e = new Error('Viaje no encontrado');
    e.status = 404;
    throw e;
  }
  const allowed = await filterMatchesForUser([match], user);
  if (!allowed.length) {
    const e = new Error('No autorizado');
    e.status = 403;
    throw e;
  }

  const load = await repo.getById('load_requests', match.load_request_id);
  const offer = await repo.getById('capacity_offers', match.capacity_offer_id);

  const origin =
    load?.origin_lat != null && load?.origin_lng != null
      ? { lat: load.origin_lat, lng: load.origin_lng, label: 'O', address: load.origin_address }
      : null;
  const destination =
    load?.destination_lat != null && load?.destination_lng != null
      ? {
          lat: load.destination_lat,
          lng: load.destination_lng,
          label: 'D',
          address: load.destination_address,
        }
      : null;

  let carrier = null;
  if (match.track_lat != null && match.track_lng != null) {
    carrier = {
      lat: match.track_lat,
      lng: match.track_lng,
      label: 'T',
      updated_at: match.track_updated_at,
    };
  } else if (offer?.carrier_user_id) {
    const u = await repo.getById('users', offer.carrier_user_id);
    if (u?.last_lat != null && u?.last_lng != null) {
      carrier = {
        lat: u.last_lat,
        lng: u.last_lng,
        label: 'T',
        updated_at: u.location_updated_at,
        is_available: Boolean(u.is_available),
      };
    }
  }

  const trackingActive = ['accepted', 'in_progress'].includes(match.status);
  const static_map_url =
    maps.isConfigured() && trackingActive
      ? maps.staticMapUrl({ origin, destination, carrier })
      : null;

  const trail = trackingActive ? await buildLocationTrail(matchId, carrier) : [];

  let driving_path = [];
  if (trackingActive && maps.isConfigured() && origin && destination) {
    const route = await maps.drivingRoutePath(origin, destination);
    if (route.ok) driving_path = route.path;
  }

  let eta = null;
  if (
    trackingActive &&
    match.status === 'in_progress' &&
    carrier &&
    destination &&
    maps.isConfigured()
  ) {
    const dm = await maps.distanceKm(
      { lat: carrier.lat, lng: carrier.lng },
      { lat: destination.lat, lng: destination.lng },
      { traffic: true }
    );
    if (dm.ok) {
      eta = {
        duration_min: dm.duration_min,
        duration_text: dm.duration_text,
        distance_km: dm.distance_km,
        distance_text: dm.distance_text,
      };
    }
  }

  const navFrom = carrier || origin;
  const navigation = maps.buildNavigationUrls(navFrom, destination);

  return {
    match_id: match.id,
    status: match.status,
    tracking_active: trackingActive,
    route: {
      origin,
      destination,
      distance_km: load?.distance_km ?? null,
      duration_min: load?.distance_duration_min ?? null,
      driving_path,
    },
    carrier_position: carrier,
    location_trail: trail,
    eta,
    navigation_url: navigation.navigation_url || null,
    navigation_android_intent: navigation.navigation_android_intent || null,
    navigation_waze_url: navigation.navigation_waze_url || null,
    navigation_waze_intent: navigation.navigation_waze_intent || null,
    static_map_url,
    maps_configured: maps.isConfigured(),
  };
}

module.exports = { buildMatchTracking };
