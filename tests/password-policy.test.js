'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { validatePassword, checkPasswordStrength } = require('../src/lib/password-policy');

test('validatePassword acepta clave fuerte', () => {
  const r = validatePassword('Cubik2026');
  assert.equal(r.ok, true);
});

test('validatePassword rechaza corta y sin mayúscula/número', () => {
  assert.equal(validatePassword('abc').ok, false);
  assert.equal(validatePassword('abcdefgh').ok, false);
  assert.equal(validatePassword('Abcdefgh').ok, false);
});

test('checkPasswordStrength marca reglas', () => {
  const c = checkPasswordStrength('Cubik2026');
  assert.equal(c.minLength, true);
  assert.equal(c.hasLetter, true);
  assert.equal(c.hasUpper, true);
  assert.equal(c.hasNumber, true);
});
