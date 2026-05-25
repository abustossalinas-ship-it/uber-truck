'use strict';

function trim(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function num(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function addressPayload(body) {
  return {
    origin_address: trim(body.origin_address),
    destination_address: trim(body.destination_address),
    origin_commune: trim(body.origin_commune),
    destination_commune: trim(body.destination_commune),
    origin_lat: num(body.origin_lat),
    origin_lng: num(body.origin_lng),
    destination_lat: num(body.destination_lat),
    destination_lng: num(body.destination_lng),
    distance_km: num(body.distance_km),
    distance_duration_min: num(body.distance_duration_min),
  };
}

module.exports = { addressPayload };
