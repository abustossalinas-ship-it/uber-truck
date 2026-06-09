'use strict';

const repo = require('./repository');
const maps = require('../services/google-maps');
const comms = require('../services/comms');
const { getMatchParties } = require('./match-parties');
const { recordTripEvent, listTripEvents } = require('./trip-events');
const { computeTripProximity } = require('./trip-proximity');

const APPROACHING_ETA_MIN = 5;

function hasEventType(events, type) {
  return (events || []).some((e) => e.event_type === type);
}

async function notifyApproachingDestination({ match, load, durationText }) {
  const parties = await getMatchParties(repo, match);
  const carrier = parties?.carrier_name || 'Transportista';
  const dest = load?.destination_address || 'destino';
  const etaLine = durationText ? ` · ${durationText}` : '';
  await comms.addNotification({
    match_id: match.id,
    for_role: 'shipper',
    type: 'approaching_destination',
    title: 'Transportista llegando al destino',
    body: `${carrier} se acerca a ${dest}${etaLine}. Prepárate para recibir la carga.`,
  });
  await comms.addNotification({
    match_id: match.id,
    for_role: 'carrier',
    type: 'approaching_destination',
    title: 'Llegando al destino',
    body: `Estás a ~${durationText || '5 min'} del destino. Al llegar, marca entregado cuando descargues.`,
  });
}

async function notifyArrivedAtDestination({ match, load }) {
  const parties = await getMatchParties(repo, match);
  const carrier = parties?.carrier_name || 'Transportista';
  const dest = load?.destination_address || 'el destino';
  await comms.addNotification({
    match_id: match.id,
    for_role: 'shipper',
    type: 'arrived_at_destination',
    title: 'Transportista en destino',
    body: `${carrier} llegó a ${dest}. El camión dejó de estar en ruta; confirma cuando recibas la carga.`,
  });
  await comms.addNotification({
    match_id: match.id,
    for_role: 'carrier',
    type: 'arrived_at_destination',
    title: 'Llegaste al destino',
    body: 'Estás en el punto de entrega. Marca entregado cuando descargues la carga.',
  });
}

async function maybeRecordProximityArrival({ match, proximity, carrierUserId, events, logTrip }) {
  if (!logTrip || !proximity?.at_target) return;
  const arrivalType =
    proximity.phase === 'pickup' ? 'arrival_at_pickup' : 'arrival_at_destination';
  if (hasEventType(events, arrivalType)) return;
  await recordTripEvent({
    match_id: match.id,
    event_type: arrivalType,
    from_status: match.status,
    to_status: match.status,
    actor_role: 'carrier',
    actor_user_id: carrierUserId,
    payload: { distance_km: proximity.distance_km },
  });
}

async function maybeNotifyApproaching({ match, load, lat, lng, events }) {
  if (match.status !== 'in_progress' || match.arrived_at_destination_at) return false;
  if (hasEventType(events, 'approaching_destination')) return false;
  if (load?.destination_lat == null || load?.destination_lng == null) return false;
  if (!maps.isConfigured()) return false;

  const dm = await maps.distanceKm(
    { lat, lng },
    { lat: load.destination_lat, lng: load.destination_lng },
    { traffic: true }
  );
  if (!dm.ok || dm.duration_min == null || dm.duration_min > APPROACHING_ETA_MIN) return false;

  await recordTripEvent({
    match_id: match.id,
    event_type: 'approaching_destination',
    from_status: match.status,
    to_status: match.status,
    actor_role: 'system',
    payload: {
      duration_min: dm.duration_min,
      duration_text: dm.duration_text,
    },
  });
  await notifyApproachingDestination({
    match,
    load,
    durationText: dm.duration_text || `~${Math.max(1, Math.round(dm.duration_min))} min`,
  });
  return true;
}

async function maybeMarkArrivedAtDestination({ match, load, proximity, carrierUserId, events }) {
  if (match.status !== 'in_progress' || match.carrier_marked_delivered_at) return match;
  if (match.arrived_at_destination_at) return match;
  if (proximity?.phase !== 'delivery' || !proximity.at_target) return match;

  const now = new Date().toISOString();
  const updated = await repo.update('matches', match.id, {
    arrived_at_destination_at: now,
  });

  if (!hasEventType(events, 'arrived_at_destination')) {
    await recordTripEvent({
      match_id: match.id,
      event_type: 'arrived_at_destination',
      from_status: match.status,
      to_status: match.status,
      actor_role: 'carrier',
      actor_user_id: carrierUserId,
      payload: { distance_km: proximity.distance_km, auto: true },
    });
  }

  await notifyArrivedAtDestination({ match: updated, load });
  return updated;
}

/**
 * GPS del transportista: proximidad, aviso ~5 min y llegada automática al destino.
 */
async function handleCarrierLocationAlerts(match, load, lat, lng, carrierUserId, { logTrip = true } = {}) {
  const proximity = computeTripProximity(match, load, lat, lng);
  const events = await listTripEvents(match.id);

  await maybeRecordProximityArrival({
    match,
    proximity,
    carrierUserId,
    events,
    logTrip,
  });

  let current = match;
  const approaching_notified = await maybeNotifyApproaching({
    match: current,
    load,
    lat,
    lng,
    events,
  });

  const arrivedMatch = await maybeMarkArrivedAtDestination({
    match: current,
    load,
    proximity,
    carrierUserId,
    events,
  });
  if (arrivedMatch?.id) current = arrivedMatch;

  return {
    match: current,
    proximity,
    pickup_ready: Boolean(proximity?.phase === 'pickup' && proximity.at_target),
    arrival_ready: Boolean(proximity?.phase === 'delivery' && proximity.at_target),
    approaching_notified,
    arrived_notified: Boolean(
      arrivedMatch?.arrived_at_destination_at &&
        !match.arrived_at_destination_at
    ),
  };
}

module.exports = {
  APPROACHING_ETA_MIN,
  handleCarrierLocationAlerts,
};
