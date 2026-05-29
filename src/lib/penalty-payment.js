'use strict';

const repo = require('./repository');
const {
  debtorRoleForMatch,
  DEBTOR_BY_REASON,
  effectivePaymentStatus,
  isPenaltySettled,
  PENALTY_CONFIRM_HOURS,
} = require('./penalty-ledger');
const { logMatchTrip } = require('./match-trip-log');
const { userCanAccessMatch, findOpenCaseForMatch } = require('./support-cases');
const comms = require('../services/comms');

function httpError(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}

async function getMatchPenaltyParties(match) {
  const debtorRole = DEBTOR_BY_REASON[match.reason_code] || null;
  if (!debtorRole) return null;
  const creditorRole = debtorRole === 'shipper' ? 'carrier' : 'shipper';
  const load = await repo.getById('load_requests', match.load_request_id);
  const offer = await repo.getById('capacity_offers', match.capacity_offer_id);
  return {
    debtor_role: debtorRole,
    creditor_role: creditorRole,
    load,
    offer,
  };
}

function userIsDebtor(user, parties) {
  if (!user || !parties) return false;
  if (user.role === 'admin') return false;
  return user.role === parties.debtor_role;
}

function userIsCreditor(user, parties) {
  if (!user || !parties) return false;
  if (user.role === 'admin') return false;
  return user.role === parties.creditor_role;
}

async function assertPenaltyMatch(matchId, user) {
  const match = await repo.getById('matches', matchId);
  if (!match) throw httpError('Emparejamiento no encontrado', 404);
  if (match.status !== 'cancelled') {
    throw httpError('Solo viajes cancelados con multa', 400);
  }
  if (match.penalty_type !== 'fee_suggested' || !match.penalty_amount_clp) {
    throw httpError('Este emparejamiento no tiene multa sugerida', 400);
  }
  if (!(await userCanAccessMatch(user, match))) {
    throw httpError('No participas en este emparejamiento', 403);
  }
  const parties = await getMatchPenaltyParties(match);
  if (!parties) throw httpError('Multa sin deudor definido', 400);
  return { match, parties };
}

async function notifyPenalty(matchId, forRole, title, body) {
  try {
    await comms.addNotification({
      match_id: matchId,
      for_role: forRole,
      type: 'penalty_payment',
      title,
      body,
    });
  } catch (e) {
    console.error('penalty notify failed', e);
  }
}

async function escalateConfirmExpired(match, parties) {
  const now = new Date().toISOString();
  const amount = Number(match.penalty_amount_clp).toLocaleString('es-CL');
  const msg =
    `Plazo de ${PENALTY_CONFIRM_HOURS} h vencido sin confirmación del acreedor. ` +
    `Multa $${amount} CLP — caso escalado a moderador. El deudor sigue bloqueado hasta resolución.`;

  let supportCase = await findOpenCaseForMatch(match.id);
  if (!supportCase) {
    supportCase = await repo.insert('support_cases', {
      match_id: match.id,
      opened_by_user_id: null,
      opened_by_role: 'system',
      subject: `Confirmación de pago vencida — multa $${amount} CLP`,
      status: 'in_review',
      auto_opened: true,
      created_at: now,
      updated_at: now,
    });
  } else if (supportCase.status === 'open') {
    await repo.update('support_cases', supportCase.id, {
      status: 'in_review',
      updated_at: now,
    });
  }

  await repo.insert('support_messages', {
    case_id: supportCase.id,
    sender_role: 'moderator',
    sender_user_id: null,
    body: msg,
    created_at: now,
  });

  await notifyPenalty(
    match.id,
    parties.creditor_role,
    'Plazo de confirmación vencido',
    msg
  );
  await notifyPenalty(match.id, parties.debtor_role, 'Pago en revisión por moderador', msg);
}

async function processExpiredClaims() {
  const matches = await repo.list('matches', {});
  const now = Date.now();
  for (const m of matches) {
    if (effectivePaymentStatus(m) !== 'claimed') continue;
    if (!m.penalty_confirm_deadline_at) continue;
    if (new Date(m.penalty_confirm_deadline_at).getTime() > now) continue;

    const parties = await getMatchPenaltyParties(m);
    if (!parties) continue;

    let updated;
    try {
      updated = await repo.update('matches', m.id, {
        penalty_payment_status: 'confirm_expired',
      });
    } catch (e) {
      console.error('confirm_expired update', m.id, e.message);
      continue;
    }

    await logMatchTrip({
      match_id: m.id,
      event_type: 'penalty_confirm_expired',
      actor_role: 'system',
      payload: { deadline_at: m.penalty_confirm_deadline_at },
    });

    await escalateConfirmExpired(updated, parties);
  }
}

async function claimPenaltyPaid(matchId, user, note) {
  const { match, parties } = await assertPenaltyMatch(matchId, user);
  if (!userIsDebtor(user, parties)) {
    throw httpError('Solo quien debe la multa puede declarar el pago', 403);
  }
  const status = effectivePaymentStatus(match);
  if (isPenaltySettled(match)) {
    throw httpError('La multa ya está regularizada', 400);
  }
  if (status === 'claimed') {
    throw httpError('Ya declaraste el pago; espera confirmación del acreedor', 400);
  }
  if (!['pending', 'disputed', 'confirm_expired'].includes(status)) {
    throw httpError('No puedes declarar pago en este estado', 400);
  }

  const now = new Date();
  const deadline = new Date(now.getTime() + PENALTY_CONFIRM_HOURS * 60 * 60 * 1000);
  let updated;
  try {
    updated = await repo.update('matches', matchId, {
    penalty_payment_status: 'claimed',
    penalty_claimed_at: now.toISOString(),
    penalty_claimed_by_user_id: user.sub,
    penalty_claim_note: note?.trim() || null,
    penalty_confirm_deadline_at: deadline.toISOString(),
    penalty_disputed_at: null,
    penalty_dispute_note: null,
    });
  } catch (e) {
    if (e.message?.includes('penalty_payment_status') || e.code === 'PGRST204') {
      throw httpError(
        'Falta migración SQL 024 en Supabase (penalty_payment_status). Ejecuta RUN_024_SUPABASE.sql',
        503
      );
    }
    throw e;
  }

  await logMatchTrip({
    match_id: matchId,
    event_type: 'penalty_payment_claimed',
    actor_role: user.role,
    actor_user_id: user.sub,
    payload: {
      amount_clp: Number(match.penalty_amount_clp),
      confirm_deadline_at: deadline.toISOString(),
      note: note?.trim() || null,
    },
  });

  const amount = Number(match.penalty_amount_clp).toLocaleString('es-CL');
  await notifyPenalty(
    matchId,
    parties.creditor_role,
    'Confirma recepción del pago de multa',
    `El deudor declaró pago de $${amount} CLP. Tienes ${PENALTY_CONFIRM_HOURS} h para confirmar o rechazar en Cuenta y multas.`
  );

  return { match: updated };
}

async function confirmPenaltyPayment(matchId, user) {
  const { match, parties } = await assertPenaltyMatch(matchId, user);
  if (!userIsCreditor(user, parties) && user.role !== 'admin') {
    throw httpError('Solo quien debe recibir el pago puede confirmarlo', 403);
  }
  if (effectivePaymentStatus(match) !== 'claimed') {
    throw httpError('No hay un pago declarado pendiente de confirmación', 400);
  }

  const now = new Date().toISOString();
  const updated = await repo.update('matches', matchId, {
    penalty_payment_status: 'confirmed',
    penalty_confirmed_at: now,
    penalty_confirmed_by_user_id: user.sub,
    penalty_paid_at: now,
    penalty_paid_by_user_id: user.sub,
    penalty_payment_note: match.penalty_claim_note || null,
  });

  await logMatchTrip({
    match_id: matchId,
    event_type: 'penalty_payment_confirmed',
    actor_role: user.role,
    actor_user_id: user.sub,
    payload: { amount_clp: Number(match.penalty_amount_clp) },
  });

  await notifyPenalty(
    matchId,
    parties.debtor_role,
    'Pago de multa confirmado',
    'El acreedor confirmó el pago. Ya puedes operar si no tienes otras multas pendientes.'
  );

  return { match: updated };
}

async function disputePenaltyPayment(matchId, user, note) {
  const { match, parties } = await assertPenaltyMatch(matchId, user);
  if (!userIsCreditor(user, parties)) {
    throw httpError('Solo quien debe recibir el pago puede rechazar la declaración', 403);
  }
  if (effectivePaymentStatus(match) !== 'claimed') {
    throw httpError('No hay un pago declarado para rechazar', 400);
  }
  if (!note?.trim()) {
    throw httpError('Indica el motivo del rechazo', 400);
  }

  const now = new Date().toISOString();
  const updated = await repo.update('matches', matchId, {
    penalty_payment_status: 'disputed',
    penalty_disputed_at: now,
    penalty_dispute_note: note.trim(),
    penalty_confirm_deadline_at: null,
  });

  await logMatchTrip({
    match_id: matchId,
    event_type: 'penalty_payment_disputed',
    actor_role: user.role,
    actor_user_id: user.sub,
    payload: { note: note.trim() },
  });

  await notifyPenalty(
    matchId,
    parties.debtor_role,
    'Pago de multa no confirmado',
    `El acreedor no validó el pago: ${note.trim()}. Puedes aportar antecedentes en Ayuda / revisión.`
  );

  return { match: updated };
}

async function markPenaltyPaid(matchId, adminUser, note) {
  if (!adminUser?.sub || adminUser.role !== 'admin') {
    throw httpError('Solo administrador puede cerrar por moderador', 403);
  }
  const match = await repo.getById('matches', matchId);
  if (!match) throw httpError('Emparejamiento no encontrado', 404);
  if (match.status !== 'cancelled') {
    throw httpError('Solo viajes cancelados pueden tener multa regularizada', 400);
  }
  if (match.penalty_type !== 'fee_suggested' || !match.penalty_amount_clp) {
    throw httpError('Este emparejamiento no tiene multa sugerida', 400);
  }
  if (isPenaltySettled(match)) {
    return { match, already_paid: true };
  }

  const now = new Date().toISOString();
  const updated = await repo.update('matches', matchId, {
    penalty_payment_status: 'settled_moderator',
    penalty_paid_at: now,
    penalty_paid_by_user_id: adminUser.sub,
    penalty_payment_note: note?.trim() || null,
    penalty_confirmed_at: now,
    penalty_confirmed_by_user_id: adminUser.sub,
  });

  const debtor = debtorRoleForMatch(match) || DEBTOR_BY_REASON[match.reason_code];
  await logMatchTrip({
    match_id: matchId,
    event_type: 'penalty_settled_moderator',
    actor_role: 'admin',
    actor_user_id: adminUser.sub,
    payload: {
      amount_clp: Number(match.penalty_amount_clp),
      debtor_role: debtor,
      note: note?.trim() || null,
    },
  });

  if (debtor) {
    await notifyPenalty(
      matchId,
      debtor,
      'Multa cerrada por moderador',
      'Un moderador registró la multa como regularizada. Ya puedes operar si no tienes otras deudas.'
    );
  }

  return { match: updated, already_paid: false };
}

module.exports = {
  processExpiredClaims,
  claimPenaltyPaid,
  confirmPenaltyPayment,
  disputePenaltyPayment,
  markPenaltyPaid,
  getMatchPenaltyParties,
};
