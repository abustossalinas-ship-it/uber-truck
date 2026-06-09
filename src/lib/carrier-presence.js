'use strict';

const repo = require('./repository');
const { recordTripEvent } = require('./trip-events');
const { handleCarrierLocationAlerts } = require('./trip-arrival-alerts');

const USER_PRESENCE_COLS =
  'id, role, is_available, last_lat, last_lng, location_updated_at';

function parseCoord(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

function validLatLng(lat, lng) {
  if (lat == null || lng == null) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  return true;
}

async function getUserPresence(userId) {
  if (!userId) return null;
  const row = await repo.getById('users', userId);
  if (!row) return null;
  return {
    is_available: Boolean(row.is_available),
    last_lat: row.last_lat ?? null,
    last_lng: row.last_lng ?? null,
    location_updated_at: row.location_updated_at || null,
  };
}

async function findCarrierActiveMatch(carrierUserId) {
  if (!carrierUserId) return null;
  const offers = await repo.list('capacity_offers', { carrier_user_id: carrierUserId });
  const offerIds = new Set(offers.map((o) => o.id));
  if (!offerIds.size) return null;
  const matches = await repo.list('matches', {});
  return (
    matches.find(
      (m) =>
        offerIds.has(m.capacity_offer_id) &&
        ['accepted', 'in_progress'].includes(m.status) &&
        !m.carrier_marked_delivered_at
    ) || null
  );
}

async function updateCarrierLocation(userId, lat, lng, { logTrip = true } = {}) {
  const la = parseCoord(lat);
  const ln = parseCoord(lng);
  if (!validLatLng(la, ln)) {
    const e = new Error('Coordenadas inválidas');
    e.status = 400;
    throw e;
  }
  const now = new Date().toISOString();
  await repo.update('users', userId, {
    last_lat: la,
    last_lng: ln,
    location_updated_at: now,
  });

  let proximity = null;
  let approaching_notified = false;
  let arrived_notified = false;
  const active = await findCarrierActiveMatch(userId);
  if (active) {
    await repo.update('matches', active.id, {
      track_lat: la,
      track_lng: ln,
      track_updated_at: now,
    });
    const load = await repo.getById('load_requests', active.load_request_id);
    if (logTrip) {
      await recordTripEvent({
        match_id: active.id,
        event_type: 'location_update',
        actor_role: 'carrier',
        actor_user_id: userId,
        payload: { lat: la, lng: ln },
      });
    }
    const alerts = await handleCarrierLocationAlerts(active, load, la, ln, userId, {
      logTrip,
    });
    proximity = alerts.proximity;
    approaching_notified = alerts.approaching_notified;
    arrived_notified = alerts.arrived_notified;
  }

  return {
    active_match_id: active?.id || null,
    updated_at: now,
    proximity,
    pickup_ready: Boolean(proximity?.phase === 'pickup' && proximity.at_target),
    arrival_ready: Boolean(proximity?.phase === 'delivery' && proximity.at_target),
    approaching_notified,
    arrived_notified,
  };
}

async function setCarrierAvailability(userId, isAvailable, coords = {}) {
  const patch = { is_available: Boolean(isAvailable) };
  const la = parseCoord(coords.lat);
  const ln = parseCoord(coords.lng);
  if (validLatLng(la, ln)) {
    patch.last_lat = la;
    patch.last_lng = ln;
    patch.location_updated_at = new Date().toISOString();
  }
  const user = await repo.update('users', userId, patch);
  if (validLatLng(la, ln)) {
    await updateCarrierLocation(userId, la, ln, { logTrip: false });
  }
  const active = await findCarrierActiveMatch(userId);
  if (active?.id) {
    await recordTripEvent({
      match_id: active.id,
      event_type: isAvailable ? 'availability_on' : 'availability_off',
      actor_role: 'carrier',
      actor_user_id: userId,
      payload: { is_available: Boolean(isAvailable) },
    });
  }
  return user;
}

module.exports = {
  USER_PRESENCE_COLS,
  validLatLng,
  getUserPresence,
  findCarrierActiveMatch,
  updateCarrierLocation,
  setCarrierAvailability,
};
