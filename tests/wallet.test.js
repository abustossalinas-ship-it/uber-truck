'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  escrowAmounts,
  publishReserveRequired,
  walletEnabled,
  PUBLISH_RESERVE_RATIO,
} = require('../src/lib/wallet-config');
const { ledgerLabel } = require('../src/lib/wallet');

test('escrowAmounts calcula retención 10/5', () => {
  const a = escrowAmounts(1_000_000);
  assert.equal(a.agreed_price_clp, 1_000_000);
  assert.equal(a.shipper_fee_clp, 100_000);
  assert.equal(a.carrier_fee_clp, 50_000);
  assert.equal(a.shipper_hold_clp, 1_100_000);
  assert.equal(a.carrier_payout_clp, 950_000);
  assert.equal(a.platform_fee_clp, 150_000);
});

test('publishReserveRequired exige 20% del presupuesto máximo', () => {
  assert.equal(publishReserveRequired(500_000), 100_000);
  assert.equal(PUBLISH_RESERVE_RATIO, 0.2);
});

test('walletEnabled solo con WALLET_ENABLED=true', () => {
  const prev = process.env.WALLET_ENABLED;
  delete process.env.WALLET_ENABLED;
  assert.equal(walletEnabled(), false);
  process.env.WALLET_ENABLED = 'true';
  assert.equal(walletEnabled(), true);
  if (prev === undefined) delete process.env.WALLET_ENABLED;
  else process.env.WALLET_ENABLED = prev;
});

test('ledgerLabel en español', () => {
  assert.equal(ledgerLabel({ entry_type: 'escrow_hold' }), 'Retención en ruta');
  assert.equal(ledgerLabel({ entry_type: 'topup_sandbox' }), 'Recarga sandbox');
});
