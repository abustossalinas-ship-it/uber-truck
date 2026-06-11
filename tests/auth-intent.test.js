'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  normalizeLoginIntentRole,
  normalizeAccountRole,
  assertLoginIntentRole,
} = require('../src/lib/auth-intent');

test('normalizeLoginIntentRole acepta sinónimos', () => {
  assert.equal(normalizeLoginIntentRole('transportista'), 'carrier');
  assert.equal(normalizeLoginIntentRole('embarcador'), 'shipper');
});

test('assertLoginIntentRole permite admin y coincidencia', () => {
  assert.doesNotThrow(() =>
    assertLoginIntentRole({ role: 'admin' }, { intent_role: 'carrier' })
  );
  assert.doesNotThrow(() =>
    assertLoginIntentRole({ role: 'shipper' }, { intent_role: 'shipper' })
  );
  assert.doesNotThrow(() => assertLoginIntentRole({ role: 'carrier' }, {}));
});

test('assertLoginIntentRole rechaza mismatch antes de OTP', () => {
  assert.throws(
    () => assertLoginIntentRole({ role: 'shipper' }, { intent_role: 'carrier' }),
    (e) => e.code === 'role_mismatch' && e.actual_role === 'shipper'
  );
});

test('normalizeAccountRole unifica roles', () => {
  assert.equal(normalizeAccountRole('embarcador'), 'shipper');
  assert.equal(normalizeAccountRole('transportista'), 'carrier');
});
