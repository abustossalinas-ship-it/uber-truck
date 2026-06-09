'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  notificationVisibleForMatch,
  isStaleProposal,
} = require('../src/lib/notification-visibility');

const baseMatch = {
  id: 'm1',
  status: 'proposed',
  load_request_id: 'l1',
  carrier_marked_delivered_at: null,
  shipper_confirmed_receipt_at: null,
  arrived_at_destination_at: null,
  chat_human_at: null,
};

const publishedLoad = {
  id: 'l1',
  status: 'published',
  urgency: 'flexible',
  created_at: new Date().toISOString(),
};

test('price_offer oculta si el match ya no está en propuesta', () => {
  const n = { type: 'price_offer' };
  assert.equal(notificationVisibleForMatch(n, { ...baseMatch, status: 'accepted' }), false);
  assert.equal(notificationVisibleForMatch(n, { ...baseMatch, status: 'in_progress' }), false);
});

test('price_offer oculta si la carga ya no está publicada (otro emparejamiento ganó)', () => {
  const n = { type: 'price_offer' };
  assert.equal(
    notificationVisibleForMatch(n, baseMatch, { ...publishedLoad, status: 'matched' }),
    false
  );
});

test('delivery_pending_confirm solo mientras espera confirmación del embarcador', () => {
  const n = { type: 'delivery_pending_confirm' };
  const waiting = {
    ...baseMatch,
    status: 'in_progress',
    carrier_marked_delivered_at: '2026-06-08T00:00:00.000Z',
  };
  assert.equal(notificationVisibleForMatch(n, waiting), true);
  assert.equal(
    notificationVisibleForMatch(n, {
      ...waiting,
      shipper_confirmed_receipt_at: '2026-06-08T01:00:00.000Z',
      status: 'completed',
    }),
    false
  );
});

test('viaje completado oculta todo (incluye cierre y pago)', () => {
  const completed = { ...baseMatch, status: 'completed' };
  assert.equal(notificationVisibleForMatch({ type: 'chat' }, completed), false);
  assert.equal(notificationVisibleForMatch({ type: 'price_offer' }, completed), false);
  assert.equal(
    notificationVisibleForMatch({ type: 'delivery_pending_confirm' }, completed),
    false
  );
  assert.equal(notificationVisibleForMatch({ type: 'trip_completed' }, completed), false);
  assert.equal(notificationVisibleForMatch({ type: 'pilot_payment' }, completed), false);
});

test('support oculta cuando el chat ya está libre (agente atendió)', () => {
  const n = { type: 'support' };
  assert.equal(notificationVisibleForMatch(n, { ...baseMatch, status: 'accepted' }), true);
  assert.equal(
    notificationVisibleForMatch(n, {
      ...baseMatch,
      status: 'accepted',
      chat_human_at: '2026-06-04T00:00:00.000Z',
    }),
    false
  );
});

test('match cancelado oculta todo', () => {
  const cancelled = { ...baseMatch, status: 'cancelled' };
  assert.equal(notificationVisibleForMatch({ type: 'chat' }, cancelled), false);
  assert.equal(notificationVisibleForMatch({ type: 'trip_completed' }, cancelled), false);
});

test('isStaleProposal detecta carga ya emparejada', () => {
  assert.equal(isStaleProposal(baseMatch, publishedLoad), false);
  assert.equal(isStaleProposal(baseMatch, { ...publishedLoad, status: 'delivered' }), true);
});
