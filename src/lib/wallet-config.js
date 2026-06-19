'use strict';

const { SHIPPER_FEE_RATE, CARRIER_FEE_RATE } = require('./payment-simulation');
const { paymentProviderMode } = require('./payment-config');

const PUBLISH_RESERVE_RATIO = Number(process.env.WALLET_PUBLISH_RESERVE_RATIO) || 0.2;
const SANDBOX_TOPUP_MAX_CLP = Number(process.env.WALLET_SANDBOX_TOPUP_MAX_CLP) || 10_000_000;

function walletEnabled() {
  return process.env.WALLET_ENABLED === 'true';
}

function walletEnforced() {
  if (!walletEnabled()) return false;
  if (process.env.WALLET_ENFORCE === 'false') return false;
  if (process.env.WALLET_ENFORCE === 'true') return true;
  return process.env.NODE_ENV === 'production';
}

function walletSandboxPilot() {
  return walletEnabled() && paymentProviderMode() === 'sandbox';
}

function roundClp(n) {
  return Math.round(Number(n) || 0);
}

function escrowAmounts(agreedClp) {
  const agreed = roundClp(agreedClp);
  if (!agreed) return null;
  const shipperFee = roundClp(agreed * SHIPPER_FEE_RATE);
  const carrierFee = roundClp(agreed * CARRIER_FEE_RATE);
  return {
    agreed_price_clp: agreed,
    shipper_fee_clp: shipperFee,
    carrier_fee_clp: carrierFee,
    shipper_hold_clp: agreed + shipperFee,
    carrier_payout_clp: agreed - carrierFee,
    platform_fee_clp: shipperFee + carrierFee,
  };
}

function publishReserveRequired(budgetMaxClp) {
  const max = roundClp(budgetMaxClp);
  if (!max) return 0;
  return roundClp(max * PUBLISH_RESERVE_RATIO);
}

function walletConfig() {
  const pilot = walletSandboxPilot();
  return {
    enabled: walletEnabled(),
    enforced: walletEnforced(),
    sandbox_pilot: pilot,
    bank_deferred: pilot,
    publish_reserve_ratio: PUBLISH_RESERVE_RATIO,
    sandbox_topup_max_clp: SANDBOX_TOPUP_MAX_CLP,
    escrow_on: 'in_progress',
    fees: { shipper_rate: SHIPPER_FEE_RATE, carrier_rate: CARRIER_FEE_RATE },
  };
}

module.exports = {
  PUBLISH_RESERVE_RATIO,
  SANDBOX_TOPUP_MAX_CLP,
  walletEnabled,
  walletEnforced,
  walletSandboxPilot,
  roundClp,
  escrowAmounts,
  publishReserveRequired,
  walletConfig,
};
