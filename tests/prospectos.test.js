'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validatePayload, buildWhatsAppUrl, whatsappConfig } = require('../src/lib/prospectos');

describe('prospectos', () => {
  it('valida payload mínimo', () => {
    const { row, error } = validatePayload({
      role: 'shipper',
      full_name: 'María',
      email: 'maria@test.cl',
      company_name: 'Acme SpA',
      phone: '987654321',
      team_size: 12,
      monthly_volume: '80',
    });
    assert.equal(error, undefined);
    assert.equal(row.role, 'shipper');
    assert.equal(row.phone, '+56987654321');
  });

  it('rechaza email inválido', () => {
    const { error } = validatePayload({
      role: 'carrier',
      full_name: 'Juan',
      email: 'no-email',
      company_name: 'Flota',
      phone: '987654321',
      monthly_volume: '20',
    });
    assert.match(error, /correo/i);
  });

  it('arma url de WhatsApp Chile', () => {
    const prev = process.env.CUBIK_WHATSAPP_E164;
    process.env.CUBIK_WHATSAPP_E164 = '56971419384';
    const url = buildWhatsAppUrl('shipper');
    assert.ok(url?.includes('wa.me/56971419384'));
    assert.ok(url?.includes(encodeURIComponent('Hola Cubik, soy empresa')));
    assert.ok(!url?.includes(encodeURIComponent('👋')));
    if (prev == null) delete process.env.CUBIK_WHATSAPP_E164;
    else process.env.CUBIK_WHATSAPP_E164 = prev;
  });

  it('no antepone 56 a numero Meta test US', () => {
    const prev = process.env.CUBIK_WHATSAPP_E164;
    process.env.CUBIK_WHATSAPP_E164 = '5551976732';
    assert.equal(whatsappConfig().e164, '15551976732');
    const url = buildWhatsAppUrl('shipper');
    assert.ok(url?.includes('wa.me/15551976732'));
    if (prev == null) delete process.env.CUBIK_WHATSAPP_E164;
    else process.env.CUBIK_WHATSAPP_E164 = prev;
  });
});
