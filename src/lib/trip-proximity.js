'use strict';

/** Radio para considerar llegada al embarcadero o destino (km). */
const ARRIVAL_RADIUS_KM = 0.6;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeTripProximity(match, load, lat, lng) {
  if (!match || !load || lat == null || lng == null) return null;

  if (match.status === 'accepted' && load.origin_lat != null && load.origin_lng != null) {
    const distance_km = haversineKm(lat, lng, load.origin_lat, load.origin_lng);
    if (distance_km == null) return null;
    return {
      phase: 'pickup',
      distance_km: Math.round(distance_km * 100) / 100,
      at_target: distance_km <= ARRIVAL_RADIUS_KM,
    };
  }

  if (
    match.status === 'in_progress' &&
    !match.carrier_marked_delivered_at &&
    load.destination_lat != null &&
    load.destination_lng != null
  ) {
    const distance_km = haversineKm(lat, lng, load.destination_lat, load.destination_lng);
    if (distance_km == null) return null;
    return {
      phase: 'delivery',
      distance_km: Math.round(distance_km * 100) / 100,
      at_target: distance_km <= ARRIVAL_RADIUS_KM,
    };
  }

  return null;
}

module.exports = {
  ARRIVAL_RADIUS_KM,
  haversineKm,
  computeTripProximity,
};
