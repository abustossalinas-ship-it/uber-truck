'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { buildPostMvpStatus } = require('../src/lib/post-mvp-status');

test('buildPostMvpStatus devuelve 8 ítems en orden', () => {
  const { items } = buildPostMvpStatus({ fcm_tokens: 0 });
  assert.equal(items.length, 8);
  assert.equal(items[0].id, 'oauth');
  assert.equal(items[4].id, 'push_fcm');
  assert.equal(items[7].id, 'escrow_en_route');
  assert.equal(items[7].blocked_by[0], 'wallet_prod');
});

test('escrow depende de wallet_prod', () => {
  const { items } = buildPostMvpStatus();
  const escrow = items.find((i) => i.id === 'escrow_en_route');
  assert.equal(escrow.status, 'blocked_deps');
  assert.deepEqual(escrow.blocked_by, ['wallet_prod']);
});
