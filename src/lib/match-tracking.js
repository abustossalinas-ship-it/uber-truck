'use strict';

const repo = require('./repository');
const maps = require('../services/google-maps');
const { filterMatchesForUser } = require('./access-scope');

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

  return {
    match_id: match.id,
    status: match.status,
    tracking_active: trackingActive,
    route: {
      origin,
      destination,
      distance_km: load?.distance_km ?? null,
      duration_min: load?.distance_duration_min ?? null,
    },
    carrier_position: carrier,
    static_map_url,
    maps_configured: maps.isConfigured(),
  };
}

module.exports = { buildMatchTracking };
