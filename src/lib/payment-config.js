'use strict';

function paymentProviderMode() {
  const explicit = (process.env.PAYMENT_PROVIDER || '').toLowerCase();
  const isProd = process.env.NODE_ENV === 'production';

  if (explicit === 'off' || explicit === 'none') return 'off';
  if (explicit === 'mercadopago') {
    return process.env.MERCADOPAGO_ACCESS_TOKEN ? 'mercadopago' : 'unconfigured';
  }
  if (explicit === 'sandbox' || process.env.PAYMENT_ALLOW_SANDBOX === 'true') return 'sandbox';
  if (!isProd) return 'sandbox';
  if (process.env.MERCADOPAGO_ACCESS_TOKEN) return 'mercadopago';
  return 'sandbox';
}

function providerLabel(mode) {
  if (mode === 'mercadopago') return 'Mercado Pago';
  if (mode === 'sandbox') return 'Cubik Sandbox (piloto)';
  if (mode === 'unconfigured') return 'Pasarela producción pendiente';
  return 'desactivado';
}

function paymentConfig() {
  const mode = paymentProviderMode();
  const isProd = process.env.NODE_ENV === 'production';
  return {
    provider_mode: mode,
    provider_label: providerLabel(mode),
    card_entry: mode === 'mercadopago' ? 'mercadopago_token' : 'sandbox_form',
    mercadopago_public_key: process.env.MERCADOPAGO_PUBLIC_KEY || null,
    production: isProd,
    sandbox_in_production: isProd && mode === 'sandbox',
    microcharge_clp: Number(process.env.PAYMENT_MICROCHARGE_CLP) || 990,
    ready: mode === 'sandbox' || mode === 'mercadopago',
  };
}

module.exports = {
  paymentProviderMode,
  providerLabel,
  paymentConfig,
};
