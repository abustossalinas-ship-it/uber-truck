'use strict';

const supabase = require('../services/supabase');
const { validateRut } = require('./rut-chile');
const {
  luhnCheck,
  detectBrand,
  last4,
  makeProviderToken,
  validateExpiry,
  validateCvv,
  digitsOnly,
} = require('./card-validation');

const SANDBOX_MICROCHARGE_CLP = Number(process.env.PAYMENT_MICROCHARGE_CLP) || 990;

function paymentProviderMode() {
  const p = (process.env.PAYMENT_PROVIDER || 'sandbox').toLowerCase();
  if (p === 'off' || p === 'none') return 'off';
  if (p === 'mercadopago' && process.env.MERCADOPAGO_ACCESS_TOKEN) return 'mercadopago';
  return 'sandbox';
}

function providerLabel(mode) {
  if (mode === 'mercadopago') return 'Mercado Pago';
  if (mode === 'sandbox') return 'Cubik Sandbox (piloto)';
  return 'desactivado';
}

async function enrollSandboxCard(userId, payload) {
  const holder = payload.holder_name?.trim();
  const rut = validateRut(payload.holder_rut);
  const pan = digitsOnly(payload.card_number);
  const brand = detectBrand(pan);
  const exp = validateExpiry(payload.exp_month, payload.exp_year);
  const cvv = validateCvv(payload.cvv, brand);

  if (!holder) throw Object.assign(new Error('Ingresa el nombre del titular'), { status: 400 });
  if (!rut.ok) throw Object.assign(new Error(rut.error), { status: 400 });
  if (!luhnCheck(pan)) throw Object.assign(new Error('Número de tarjeta inválido'), { status: 400 });
  if (!exp.ok) throw Object.assign(new Error(exp.error), { status: 400 });
  if (!cvv.ok) throw Object.assign(new Error(cvv.error), { status: 400 });

  return {
    provider: 'sandbox',
    provider_token: makeProviderToken(userId, pan, 'sandbox'),
    card_brand: brand,
    card_last4: last4(pan),
    holder_name: holder,
    holder_rut: rut.rut,
    microcharge_clp: SANDBOX_MICROCHARGE_CLP,
    microcharge_status: 'reversed',
    message: `Tarjeta verificada. Cargo simulado de $${SANDBOX_MICROCHARGE_CLP.toLocaleString('es-CL')} CLP (reversado en piloto).`,
  };
}

async function mpFetch(path, options = {}) {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json.message || json.error || 'Error Mercado Pago';
    throw Object.assign(new Error(msg), { status: 502, details: json });
  }
  return json;
}

async function enrollMercadoPagoCard(userId, email, payload) {
  const holder = payload.holder_name?.trim();
  const rut = validateRut(payload.holder_rut);
  const cardToken = payload.card_token?.trim();

  if (!holder) throw Object.assign(new Error('Ingresa el nombre del titular'), { status: 400 });
  if (!rut.ok) throw Object.assign(new Error(rut.error), { status: 400 });
  if (!cardToken) {
    throw Object.assign(new Error('Falta token de tarjeta (formulario Mercado Pago)'), { status: 400 });
  }

  const search = await mpFetch(
    `/v1/customers/search?email=${encodeURIComponent(email || `${userId}@cubik.local`)}`
  );
  let customer = search.results?.[0];
  if (!customer) {
    customer = await mpFetch('/v1/customers', {
      method: 'POST',
      body: JSON.stringify({
        email: email || `${userId}@cubik.local`,
        first_name: holder.split(' ')[0],
        last_name: holder.split(' ').slice(1).join(' ') || holder,
      }),
    });
  }

  const card = await mpFetch(`/v1/customers/${customer.id}/cards`, {
    method: 'POST',
    body: JSON.stringify({ token: cardToken }),
  });

  return {
    provider: 'mercadopago',
    provider_token: String(card.id),
    card_brand: card.payment_method?.id || card.payment_method?.name || 'card',
    card_last4: card.last_four_digits || '0000',
    holder_name: holder,
    holder_rut: rut.rut,
    microcharge_clp: SANDBOX_MICROCHARGE_CLP,
    microcharge_status: 'authorized',
    message: 'Tarjeta registrada con Mercado Pago.',
  };
}

async function enrollCard(userId, email, payload) {
  const mode = paymentProviderMode();
  if (mode === 'off') {
    throw Object.assign(new Error('Pasarela de pagos no configurada'), { status: 503 });
  }
  if (mode === 'mercadopago') return enrollMercadoPagoCard(userId, email, payload);
  return enrollSandboxCard(userId, payload);
}

module.exports = {
  paymentProviderMode,
  providerLabel,
  enrollCard,
  SANDBOX_MICROCHARGE_CLP,
};
