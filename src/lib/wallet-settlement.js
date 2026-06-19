'use strict';

const { applyEntry } = require('./wallet');
const { escrowAmounts, walletEnabled } = require('./wallet-config');

async function resolveShipperUserId(repo, match) {
  const load = await repo.getById('load_requests', match.load_request_id);
  return load?.shipper_user_id || null;
}

async function resolveCarrierUserId(repo, match) {
  const offer = await repo.getById('capacity_offers', match.capacity_offer_id);
  return offer?.carrier_user_id || null;
}

async function holdEscrowOnRoute(repo, match) {
  if (!walletEnabled()) return match;
  if (match.wallet_payment_status === 'held') return match;
  const amounts = escrowAmounts(match.agreed_price_clp);
  if (!amounts) {
    const e = new Error('Define un precio acordado antes de marcar en ruta');
    e.status = 400;
    throw e;
  }
  const shipperId = await resolveShipperUserId(repo, match);
  if (!shipperId) {
    const e = new Error('Embarcador sin cuenta vinculada — no se puede retener pago');
    e.status = 400;
    throw e;
  }

  await applyEntry(shipperId, {
    amount_clp: -amounts.shipper_hold_clp,
    entry_type: 'escrow_hold',
    match_id: match.id,
    note: `Retención flete + servicio 10% · $${amounts.shipper_hold_clp.toLocaleString('es-CL')}`,
    meta: {
      agreed_price_clp: amounts.agreed_price_clp,
      shipper_fee_clp: amounts.shipper_fee_clp,
    },
  });

  const now = new Date().toISOString();
  return repo.update('matches', match.id, {
    wallet_escrow_clp: amounts.shipper_hold_clp,
    wallet_escrow_at: now,
    wallet_shipper_fee_clp: amounts.shipper_fee_clp,
    wallet_carrier_fee_clp: amounts.carrier_fee_clp,
    wallet_payment_status: 'held',
  });
}

async function releaseEscrowOnComplete(repo, match) {
  if (!walletEnabled()) return match;
  if (match.wallet_payment_status === 'released') return match;
  if (match.wallet_payment_status !== 'held') return match;

  const amounts = escrowAmounts(match.agreed_price_clp);
  if (!amounts) return match;

  const carrierId = await resolveCarrierUserId(repo, match);
  if (!carrierId) {
    const e = new Error('Transportista sin cuenta vinculada — no se puede acreditar pago');
    e.status = 400;
    throw e;
  }

  await applyEntry(carrierId, {
    amount_clp: amounts.carrier_payout_clp,
    entry_type: 'escrow_release',
    match_id: match.id,
    note: `Pago flete neto (5% comisión) · $${amounts.carrier_payout_clp.toLocaleString('es-CL')}`,
    meta: {
      agreed_price_clp: amounts.agreed_price_clp,
      carrier_fee_clp: amounts.carrier_fee_clp,
    },
  });

  const now = new Date().toISOString();
  return repo.update('matches', match.id, {
    wallet_payment_status: 'released',
    wallet_settled_at: now,
    pilot_payment_status: 'released',
    pilot_payment_at: now,
  });
}

async function refundEscrowOnCancel(repo, match) {
  if (!walletEnabled()) return match;
  if (match.wallet_payment_status !== 'held') return match;

  const hold = Number(match.wallet_escrow_clp) || 0;
  if (!hold) return match;

  const shipperId = await resolveShipperUserId(repo, match);
  if (!shipperId) return match;

  await applyEntry(shipperId, {
    amount_clp: hold,
    entry_type: 'escrow_refund',
    match_id: match.id,
    note: `Devolución retención por cancelación · $${hold.toLocaleString('es-CL')}`,
  });

  return repo.update('matches', match.id, {
    wallet_payment_status: 'refunded',
    wallet_settled_at: new Date().toISOString(),
  });
}

function enrichMatchWalletPayment(match, user) {
  if (!walletEnabled() || !match || !user) return match;
  const role = user.role === 'carrier' ? 'carrier' : 'shipper';
  const amounts = escrowAmounts(match.agreed_price_clp);
  if (!amounts) return match;

  const base = {
    wallet_prod: true,
    wallet_payment_status: match.wallet_payment_status || null,
    wallet_escrow_clp: match.wallet_escrow_clp || null,
    payment_agreed_clp: amounts.agreed_price_clp,
    payment_fee_clp: role === 'shipper' ? amounts.shipper_fee_clp : amounts.carrier_fee_clp,
    payment_fee_rate: role === 'shipper' ? 0.1 : 0.05,
  };

  if (match.wallet_payment_status === 'held') {
    return {
      ...match,
      ...base,
      payment_status: 'wallet_held',
      payment_status_label:
        role === 'shipper'
          ? 'Retenido en Cubik Saldo (en ruta)'
          : 'Pago retenido — se libera al completar',
      payment_total_clp: role === 'shipper' ? amounts.shipper_hold_clp : amounts.carrier_payout_clp,
      payment_net_clp: role === 'shipper' ? amounts.shipper_hold_clp : amounts.carrier_payout_clp,
      can_pilot_pay: false,
    };
  }
  if (match.wallet_payment_status === 'released' && match.status === 'completed') {
    return {
      ...match,
      ...base,
      payment_status: 'wallet_released',
      payment_status_label:
        role === 'shipper' ? 'Pagado con Cubik Saldo' : 'Acreditado en Cubik Saldo',
      payment_total_clp: role === 'shipper' ? amounts.shipper_hold_clp : amounts.carrier_payout_clp,
      payment_net_clp: role === 'shipper' ? amounts.shipper_hold_clp : amounts.carrier_payout_clp,
      can_pilot_pay: false,
    };
  }
  if (match.status === 'accepted' || match.status === 'proposed') {
    return {
      ...match,
      ...base,
      payment_status: 'wallet_pending_route',
      payment_status_label: 'El pago se retiene al marcar En ruta',
      can_pilot_pay: false,
    };
  }
  return match;
}

function enrichMatchesWalletPayment(matches, user) {
  if (!walletEnabled() || !user) return matches;
  return matches.map((m) => enrichMatchWalletPayment(m, user));
}

module.exports = {
  resolveShipperUserId,
  resolveCarrierUserId,
  holdEscrowOnRoute,
  releaseEscrowOnComplete,
  refundEscrowOnCancel,
  enrichMatchWalletPayment,
  enrichMatchesWalletPayment,
};
