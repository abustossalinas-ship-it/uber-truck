'use strict';

const repo = require('./repository');
const maps = require('../services/google-maps');
const { filterMatchesForUser } = require('./access-scope');
const { listTripEvents } = require('./trip-events');
const { computeTripProximity } = require('./trip-proximity');
const { APPROACHING_ETA_MIN } = require('./trip-arrival-alerts');

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

  const trackingActive =
    ['accepted', 'in_progress'].includes(match.status) && !match.carrier_marked_delivered_at;
  const arrivedAtDestination = Boolean(match.arrived_at_destination_at);
  const routeLive = trackingActive && !arrivedAtDestination;

  const static_map_url =
    maps.isConfigured() && trackingActive
      ? maps.staticMapUrl({ origin, destination, carrier })
      : null;

  const trail = trackingActive ? await buildLocationTrail(matchId, carrier) : [];
  const eventRows = trackingActive ? await listTripEvents(matchId) : [];

  let trip_phase =
    match.status === 'accepted' ? 'pickup' : match.status === 'in_progress' ? 'delivery' : null;
  if (arrivedAtDestination && match.status === 'in_progress') {
    trip_phase = 'arrived';
  }

  let driving_path = [];
  if (routeLive && maps.isConfigured()) {
    if (trip_phase === 'pickup' && origin) {
      const from = carrier || null;
      if (from) {
        const route = await maps.drivingRoutePath(from, origin);
        if (route.ok) driving_path = route.path;
      }
    } else if (trip_phase === 'delivery' && origin && destination) {
      const from = carrier || origin;
      const route = await maps.drivingRoutePath(from, destination);
      if (route.ok) driving_path = route.path;
    }
  }

  let eta = null;
  if (routeLive && carrier && maps.isConfigured()) {
    const etaTarget =
      trip_phase === 'pickup' ? origin : trip_phase === 'delivery' ? destination : null;
    if (etaTarget?.lat != null) {
      const dm = await maps.distanceKm(
        { lat: carrier.lat, lng: carrier.lng },
        { lat: etaTarget.lat, lng: etaTarget.lng },
        { traffic: true }
      );
      if (dm.ok) {
        eta = {
          phase: trip_phase,
          duration_min: dm.duration_min,
          duration_text: dm.duration_text,
          distance_km: dm.distance_km,
          distance_text: dm.distance_text,
        };
      }
    }
  }

  const approachingByEvent = eventRows.some((e) => e.event_type === 'approaching_destination');
  const approachingByEta =
    trip_phase === 'delivery' &&
    eta?.duration_min != null &&
    eta.duration_min <= APPROACHING_ETA_MIN;
  const approaching_destination = approachingByEvent || approachingByEta;

  const navTarget =
    trip_phase === 'pickup' ? origin : trip_phase === 'arrived' ? destination : destination;
  const navFrom = carrier || (trip_phase === 'pickup' ? null : origin);
  const navigation = routeLive
    ? maps.buildNavigationUrls(navFrom, navTarget)
    : {
        navigation_url: null,
        navigation_android_intent: null,
        navigation_waze_url: null,
        navigation_waze_intent: null,
      };

  const proximity =
    carrier?.lat != null && carrier?.lng != null
      ? computeTripProximity(match, load, carrier.lat, carrier.lng)
      : null;

  return {
    match_id: match.id,
    status: match.status,
    trip_phase,
    route_live: routeLive,
    tracking_active: trackingActive,
    arrived_at_destination_at: match.arrived_at_destination_at || null,
    approaching_destination,
    carrier_marked_delivered_at: match.carrier_marked_delivered_at || null,
    proximity,
    pickup_ready: Boolean(proximity?.phase === 'pickup' && proximity.at_target),
    arrival_ready: Boolean(proximity?.phase === 'delivery' && proximity.at_target),
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
