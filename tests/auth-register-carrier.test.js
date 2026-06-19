'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateCarrierRegistrationFields } = require('../src/lib/auth-register');

describe('auth-register carrier', () => {
  it('exige RUT y patente válidos', () => {
    const ok = validateCarrierRegistrationFields({
      national_rut: '15.363.398-3',
      vehicle_plates: 'DCYZ31',
    });
    assert.equal(ok.ok, true);
    assert.equal(ok.national_rut, '15363398-3');
    assert.equal(ok.vehicle_plates, 'DCYZ31');
  });

  it('rechaza RUT inválido', () => {
    const r = validateCarrierRegistrationFields({
      national_rut: '123',
      vehicle_plates: 'DCYZ31',
    });
    assert.equal(r.ok, false);
  });

  it('rechaza patente vacía', () => {
    const r = validateCarrierRegistrationFields({
      national_rut: '15.363.398-3',
      vehicle_plates: '',
    });
    assert.equal(r.ok, false);
  });
});
