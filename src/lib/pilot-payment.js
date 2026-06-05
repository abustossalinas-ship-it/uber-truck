'use strict';

const { loadBelongsToUser } = require('./ownership');
const { breakdownForMatch, isPilotPaid } = require('./payment-simulation');

async function assertCanPilotPay(repo, match, user) {
  if (!user?.sub) {
    const e = new Error('Inicia sesión para pagar');
    e.status = 401;
    throw e;
  }
  if (user.role !== 'shipper' && user.role !== 'admin') {
    const e = new Error('Solo el embarcador puede pagar el flete');
    e.status = 403;
    throw e;
  }
  if (!match) {
    const e = new Error('Viaje no encontrado');
    e.status = 404;
    throw e;
  }
  if (match.status !== 'completed') {
    const e = new Error('Solo puedes pagar viajes completados');
    e.status = 400;
    throw e;
  }
  if (!breakdownForMatch(match, 'shipper')) {
    const e = new Error('Este viaje no tiene precio acordado');
    e.status = 400;
    throw e;
  }
  if (isPilotPaid(match)) {
    const e = new Error('Este viaje ya fue pagado en Cubik Saldo (piloto)');
    e.status = 409;
    throw e;
  }
  if (user.role !== 'admin') {
    const load = await repo.getById('load_requests', match.load_request_id);
    if (!loadBelongsToUser(load, user)) {
      const e = new Error('No autorizado');
      e.status = 403;
      throw e;
    }
  }
}

async function processPilotPay(repo, matchId, user) {
  const match = await repo.getById('matches', matchId);
  await assertCanPilotPay(repo, match, user);
  const now = new Date().toISOString();
  const updated = await repo.update('matches', matchId, {
    pilot_payment_status: 'in_settlement',
    pilot_payment_at: now,
  });
  return updated;
}

module.exports = {
  isPilotPaid,
  assertCanPilotPay,
  processPilotPay,
};
