'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeTripProximity, haversineKm, ARRIVAL_RADIUS_KM } = require('../src/lib/trip-proximity');

test('arrival radius default 0.6 km', () => {
  assert.equal(ARRIVAL_RADIUS_KM, 0.6);
});

test('delivery: en destino cuando distancia <= radio', () => {
  const match = { status: 'in_progress', carrier_marked_delivered_at: null };
  const load = { destination_lat: -33.45, destination_lng: -70.65 };
  const r = computeTripProximity(match, load, -33.45, -70.65);
  assert.equal(r.phase, 'delivery');
  assert.equal(r.at_target, true);
});

test('delivery: fuera de destino cuando distancia > radio', () => {
  const match = { status: 'in_progress', carrier_marked_delivered_at: null };
  const load = { destination_lat: -33.45, destination_lng: -70.65 };
  const farLat = -33.45 + 0.02; // ~2.2 km
  const r = computeTripProximity(match, load, farLat, -70.65);
  assert.equal(r.phase, 'delivery');
  assert.equal(r.at_target, false);
});

test('pickup: en embarcadero dentro del radio', () => {
  const match = { status: 'accepted' };
  const load = { origin_lat: -33.6, origin_lng: -70.75 };
  const r = computeTripProximity(match, load, -33.6, -70.75);
  assert.equal(r.phase, 'pickup');
  assert.equal(r.at_target, true);
});

test('haversineKm mismo punto es ~0', () => {
  const d = haversineKm(-33.45, -70.65, -33.45, -70.65);
  assert.ok(d < 0.01);
});
