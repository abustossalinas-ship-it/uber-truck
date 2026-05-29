'use strict';

const repo = require('./repository');
const { debtorRoleForMatch } = require('./penalty-ledger');
const { logMatchTrip } = require('./match-trip-log');

async function markPenaltyPaid(matchId, adminUser, note) {
  if (!adminUser?.sub || adminUser.role !== 'admin') {
    const e = new Error('Solo administrador puede marcar multa pagada');
    e.status = 403;
    throw e;
  }
  const match = await repo.getById('matches', matchId);
  if (!match) {
    const e = new Error('Emparejamiento no encontrado');
    e.status = 404;
    throw e;
  }
  if (match.status !== 'cancelled') {
    const e = new Error('Solo viajes cancelados pueden tener multa regularizada');
    e.status = 400;
    throw e;
  }
  if (match.penalty_type !== 'fee_suggested' || !match.penalty_amount_clp) {
    const e = new Error('Este emparejamiento no tiene multa sugerida');
    e.status = 400;
    throw e;
  }
  if (match.penalty_paid_at) {
    return { match, already_paid: true };
  }
  const debtor = debtorRoleForMatch(match);
  const updated = await repo.update('matches', matchId, {
    penalty_paid_at: new Date().toISOString(),
    penalty_paid_by_user_id: adminUser.sub,
    penalty_payment_note: note?.trim() || null,
  });
  await logMatchTrip({
    match_id: matchId,
    event_type: 'penalty_marked_paid',
    actor_role: 'admin',
    actor_user_id: adminUser.sub,
    payload: {
      amount_clp: Number(match.penalty_amount_clp),
      debtor_role: debtor,
      note: note?.trim() || null,
    },
  });
  return { match: updated, already_paid: false };
}

module.exports = { markPenaltyPaid };
