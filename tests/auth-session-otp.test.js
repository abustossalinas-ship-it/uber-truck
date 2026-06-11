'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { hashDeviceId, sessionExpiresAt, isSessionActive } = require('../src/lib/device-session');
const { hashOtp, generateOtpCode } = require('../src/lib/auth-otp');

test('hashDeviceId es estable y distinto por device_id', () => {
  const a = hashDeviceId('device-abc');
  const b = hashDeviceId('device-abc');
  const c = hashDeviceId('device-xyz');
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^[a-f0-9]{64}$/);
});

test('hashDeviceId vacío devuelve null', () => {
  assert.equal(hashDeviceId(''), null);
  assert.equal(hashDeviceId(null), null);
});

test('sessionExpiresAt suma días de SESSION_TTL_DAYS', () => {
  const days = Number(process.env.SESSION_TTL_DAYS || 30);
  const from = new Date('2026-06-01T12:00:00.000Z');
  const exp = new Date(sessionExpiresAt(from));
  const expected = new Date(from);
  expected.setDate(expected.getDate() + days);
  assert.equal(exp.toISOString(), expected.toISOString());
});

test('isSessionActive respeta revoked_at y expires_at', () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  const past = new Date(Date.now() - 86400000).toISOString();
  assert.equal(isSessionActive({ expires_at: future, revoked_at: null }), true);
  assert.equal(isSessionActive({ expires_at: future, revoked_at: past }), false);
  assert.equal(isSessionActive({ expires_at: past, revoked_at: null }), false);
});

test('generateOtpCode produce 4 dígitos', () => {
  for (let i = 0; i < 20; i++) {
    const code = generateOtpCode();
    assert.match(code, /^\d{4}$/);
  }
});

test('hashOtp es determinístico', () => {
  assert.equal(hashOtp('1234'), hashOtp('1234'));
  assert.notEqual(hashOtp('1234'), hashOtp('5678'));
});
