'use strict';

const { filterMatchesForUser } = require('./access-scope');

const SHIPPER_FEE_RATE = 0.1;
const CARRIER_FEE_RATE = 0.05;

function isPilotPaid(match) {
  return match?.pilot_payment_status === 'in_settlement' || match?.pilot_payment_status === 'released';
}

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

function tripRowFromMatch(m, bd, role, loadById, offerById) {
  const load = loadById?.[m.load_request_id];
  const offer = offerById?.[m.capacity_offer_id];
  const shipper = load?.company_name?.trim() || 'Embarcador';
  const carrier = offer?.carrier_name?.trim() || 'Transportista';
  const paid = isPilotPaid(m);
  let status_label = 'Cobro simulado';
  if (role === 'carrier') {
    status_label = paid ? 'Embarcador pagó · cobro en gestión' : 'Esperando pago del embarcador';
  } else if (!paid) {
    status_label = 'Pendiente de pago';
  }
  return {
    match_id: m.id,
    ...bd,
    paid,
    can_pay: role === 'shipper' && !paid,
    status: paid ? 'pilot_settlement' : 'pilot_pending',
    status_label,
    pair: `${shipper} ↔ ${carrier}`,
    completed_at: m.completed_at || m.updated_at || m.created_at,
    pilot_payment_at: m.pilot_payment_at || null,
  };
}

async function buildPaymentSimulation(repo, user) {
  const role = userRole(user);
  const completed = await completedTripsForUser(repo, user);
  const empty = {
    enabled: true,
    pilot: true,
    role,
    fee_rate: role === 'shipper' ? SHIPPER_FEE_RATE : CARRIER_FEE_RATE,
    wallet_balance_clp: 0,
    wallet_label:
      role === 'shipper' ? 'Saldo Cubik (simulado)' : 'Por cobrar — pago en gestión',
    trips: [],
    pending: { trip_count: 0, net_clp: 0, trips: [] },
    totals: { trip_count: 0, agreed_clp: 0, fees_clp: 0, net_clp: 0 },
    note: 'Simulación piloto — confirma el pago para generar el cargo. Sin movimiento real de dinero.',
  };
  if (!completed.length) return empty;

  const loadIds = [...new Set(completed.map((m) => m.load_request_id).filter(Boolean))];
  const offerIds = [...new Set(completed.map((m) => m.capacity_offer_id).filter(Boolean))];
  const [loads, offers] = await Promise.all([
    Promise.all(loadIds.map((id) => repo.getById('load_requests', id))),
    Promise.all(offerIds.map((id) => repo.getById('capacity_offers', id))),
  ]);
  const loadById = Object.fromEntries(loads.filter(Boolean).map((l) => [l.id, l]));
  const offerById = Object.fromEntries(offers.filter(Boolean).map((o) => [o.id, o]));

  const paidTrips = [];
  const pendingTrips = [];
  let paidAgreed = 0;
  let paidFees = 0;
  let paidNet = 0;
  let pendingNet = 0;

  for (const m of completed) {
    const bd = breakdownForMatch(m, role);
    if (!bd) continue;
    const row = tripRowFromMatch(m, bd, role, loadById, offerById);
    if (isPilotPaid(m)) {
      paidTrips.push(row);
      paidAgreed += bd.agreed_price_clp;
      paidFees += bd.fee_clp;
      paidNet += role === 'shipper' ? bd.total_clp : bd.net_clp;
    } else {
      pendingTrips.push(row);
      pendingNet += role === 'shipper' ? bd.total_clp : bd.net_clp;
    }
  }

  const sortTrips = (a, b) =>
    new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime();
  paidTrips.sort(sortTrips);
  pendingTrips.sort(sortTrips);

  const walletBalance = role === 'shipper' ? -paidNet : paidNet;

  return {
    ...empty,
    wallet_balance_clp: walletBalance,
    trips: paidTrips,
    pending: {
      trip_count: pendingTrips.length,
      net_clp: pendingNet,
      trips: pendingTrips,
    },
    totals: {
      trip_count: paidTrips.length,
      agreed_clp: paidAgreed,
      fees_clp: paidFees,
      net_clp: paidNet,
    },
  };
}

function enrichMatchPaymentPilot(match, user) {
  if (!user || match.status !== 'completed') return match;
  const role = userRole(user);
  const bd = breakdownForMatch(match, role);
  if (!bd) return match;
  const paid = isPilotPaid(match);
  const base = {
    payment_pilot: true,
    payment_agreed_clp: bd.agreed_price_clp,
    payment_fee_clp: bd.fee_clp,
    payment_fee_rate: bd.fee_rate,
    payment_fee_label: bd.fee_label,
    pilot_payment_status: match.pilot_payment_status || null,
    pilot_payment_at: match.pilot_payment_at || null,
  };

  if (role === 'shipper') {
    if (!paid) {
      return {
        ...match,
        ...base,
        payment_status: 'pilot_pending',
        can_pilot_pay: true,
        payment_total_clp: bd.total_clp,
        payment_net_clp: bd.total_clp,
        payment_status_label: 'Pendiente de pago',
      };
    }
    return {
      ...match,
      ...base,
      payment_status: 'pilot_settlement',
      can_pilot_pay: false,
      payment_total_clp: bd.total_clp,
      payment_net_clp: bd.total_clp,
      payment_status_label: 'Pagado — en gestión',
    };
  }

  if (!paid) {
    return {
      ...match,
      ...base,
      payment_status: 'pilot_awaiting',
      payment_total_clp: bd.agreed_price_clp,
      payment_net_clp: bd.net_clp,
      payment_status_label: 'Esperando pago del embarcador',
    };
  }
  return {
    ...match,
    ...base,
    payment_status: 'pilot_settlement',
    payment_shipper_paid: true,
    payment_total_clp: bd.agreed_price_clp,
    payment_net_clp: bd.net_clp,
    payment_status_label: 'Embarcador pagó · cobro en gestión',
  };
}

function enrichMatchesPaymentPilot(matches, user) {
  if (!user) return matches;
  return matches.map((m) => enrichMatchPaymentPilot(m, user));
}

module.exports = {
  SHIPPER_FEE_RATE,
  CARRIER_FEE_RATE,
  isPilotPaid,
  breakdownForMatch,
  buildPaymentSimulation,
  enrichMatchPaymentPilot,
  enrichMatchesPaymentPilot,
};
