'use strict';

const { filterMatchesForUser } = require('./access-scope');
const { getMatchParties } = require('./match-parties');

const SHIPPER_FEE_RATE = 0.1;
const CARRIER_FEE_RATE = 0.05;

function roundClp(n) {
  return Math.round(Number(n) || 0);
}

function userRole(user) {
  return user?.role === 'carrier' ? 'carrier' : 'shipper';
}

function breakdownForMatch(match, role) {
  const agreed = roundClp(match?.agreed_price_clp);
  if (!agreed) return null;
  if (role === 'shipper') {
    const fee = roundClp(agreed * SHIPPER_FEE_RATE);
    return {
      agreed_price_clp: agreed,
      fee_clp: fee,
      fee_rate: SHIPPER_FEE_RATE,
      fee_label: 'Servicio Cubik 10%',
      total_clp: agreed + fee,
      net_clp: agreed + fee,
    };
  }
  const fee = roundClp(agreed * CARRIER_FEE_RATE);
  return {
    agreed_price_clp: agreed,
    fee_clp: fee,
    fee_rate: CARRIER_FEE_RATE,
    fee_label: 'Comisión Cubik 5%',
    total_clp: agreed,
    net_clp: agreed - fee,
  };
}

async function completedTripsForUser(repo, user) {
  if (!user?.sub) return [];
  let matches = await repo.list('matches', { status: 'completed' });
  matches = await filterMatchesForUser(matches, user);
  return matches.filter((m) => roundClp(m.agreed_price_clp) > 0);
}

async function buildPaymentSimulation(repo, user) {
  const role = userRole(user);
  const completed = await completedTripsForUser(repo, user);
  const trips = [];
  let totalAgreed = 0;
  let totalFees = 0;
  let totalNet = 0;

  for (const m of completed) {
    const bd = breakdownForMatch(m, role);
    if (!bd) continue;
    const parties = await getMatchParties(repo, m);
    totalAgreed += bd.agreed_price_clp;
    totalFees += bd.fee_clp;
    totalNet += role === 'shipper' ? bd.total_clp : bd.net_clp;
    trips.push({
      match_id: m.id,
      ...bd,
      status: 'pilot_settlement',
      status_label: role === 'carrier' ? 'Pago en gestión' : 'Cobro simulado',
      pair: parties?.short || 'Viaje completado',
      completed_at: m.updated_at || m.created_at,
    });
  }

  trips.sort(
    (a, b) => new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime()
  );

  const walletBalance = role === 'shipper' ? -totalNet : totalNet;

  return {
    enabled: true,
    pilot: true,
    role,
    fee_rate: role === 'shipper' ? SHIPPER_FEE_RATE : CARRIER_FEE_RATE,
    wallet_balance_clp: walletBalance,
    wallet_label:
      role === 'shipper' ? 'Saldo Cubik (simulado)' : 'Por cobrar — pago en gestión',
    trips,
    totals: {
      trip_count: trips.length,
      agreed_clp: totalAgreed,
      fees_clp: totalFees,
      net_clp: totalNet,
    },
    note: 'Simulación piloto — sin movimiento real de dinero. Cubik Saldo disponible próximamente.',
  };
}

function enrichMatchPaymentPilot(match, user) {
  if (!user || match.payment_status || match.status !== 'completed') return match;
  const role = userRole(user);
  const bd = breakdownForMatch(match, role);
  if (!bd) return match;
  return {
    ...match,
    payment_status: 'pilot_settlement',
    payment_pilot: true,
    payment_agreed_clp: bd.agreed_price_clp,
    payment_fee_clp: bd.fee_clp,
    payment_fee_rate: bd.fee_rate,
    payment_fee_label: bd.fee_label,
    payment_total_clp: role === 'shipper' ? bd.total_clp : bd.agreed_price_clp,
    payment_net_clp: role === 'shipper' ? bd.total_clp : bd.net_clp,
    payment_status_label: role === 'carrier' ? 'Pago en gestión' : 'Cobro simulado',
  };
}

function enrichMatchesPaymentPilot(matches, user) {
  if (!user) return matches;
  return matches.map((m) => enrichMatchPaymentPilot(m, user));
}

module.exports = {
  SHIPPER_FEE_RATE,
  CARRIER_FEE_RATE,
  breakdownForMatch,
  buildPaymentSimulation,
  enrichMatchPaymentPilot,
  enrichMatchesPaymentPilot,
};
