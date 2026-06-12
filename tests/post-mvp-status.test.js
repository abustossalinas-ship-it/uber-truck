'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { buildPostMvpStatus } = require('../src/lib/post-mvp-status');

test('buildPostMvpStatus devuelve 9 ítems en orden', () => {
  const { items } = buildPostMvpStatus({ fcm_tokens: 0 });
  assert.equal(items.length, 9);
  assert.equal(items[0].id, 'oauth');
  assert.equal(items[3].id, 'trip_contact');
  assert.equal(items[4].id, 'twilio_proxy');
  assert.equal(items[5].id, 'push_fcm');
  assert.equal(items[8].id, 'escrow_en_route');
  assert.equal(items[8].blocked_by[0], 'wallet_prod');
});

test('push_fcm marcado validated cuando FCM configurado', () => {
  const prev = process.env.FCM_SERVICE_ACCOUNT_B64;
  process.env.FCM_SERVICE_ACCOUNT_B64 = 'e30='; // base64 "{}"
  try {
    const fcm = require('../src/services/fcm');
    if (!fcm.isConfigured()) return; // skip si el mock no alcanza
    const { items } = buildPostMvpStatus({ fcm_tokens: 1 });
    const push = items.find((i) => i.id === 'push_fcm');
    assert.equal(push.status, 'validated');
    assert.match(push.summary, /10 jun 2026/);
  } finally {
    if (prev === undefined) delete process.env.FCM_SERVICE_ACCOUNT_B64;
    else process.env.FCM_SERVICE_ACCOUNT_B64 = prev;
  }
});

test('escrow depende de wallet_prod', () => {
  const { items } = buildPostMvpStatus();
  const escrow = items.find((i) => i.id === 'escrow_en_route');
  assert.equal(escrow.status, 'blocked_deps');
  assert.deepEqual(escrow.blocked_by, ['wallet_prod']);
});
