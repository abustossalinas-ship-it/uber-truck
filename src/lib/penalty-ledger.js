'use strict';

const PENALTY_DUE_DAYS = Number(process.env.PENALTY_DUE_DAYS) || 7;
const PENALTY_CONFIRM_HOURS = Number(process.env.PENALTY_CONFIRM_HOURS) || 24;

const PAYMENT_STATUSES = [
  'pending',
  'claimed',
  'confirmed',
  'disputed',
  'confirm_expired',
  'settled_moderator',
];

const DEBTOR_BY_REASON = {
  shipper_change_plans: 'shipper',
  shipper_cancel_in_transit: 'shipper',
  shipper_carrier_late: 'carrier',
  shipper_carrier_failed: 'carrier',
  carrier_unavailable: 'carrier',
  carrier_missed_deadline: 'carrier',
  carrier_no_show: 'carrier',
};

function effectivePaymentStatus(match) {
  if (!match) return 'pending';
  if (match.penalty_payment_status) return match.penalty_payment_status;
  if (match.penalty_paid_at) return 'settled_moderator';
  return 'pending';
}

function isPenaltySettled(match) {
  const s = effectivePaymentStatus(match);
  return s === 'confirmed' || s === 'settled_moderator';
}

function debtorRoleForMatch(match) {
  if (!match || match.status !== 'cancelled') return null;
  if (isPenaltySettled(match)) return null;
  if (match.penalty_type !== 'fee_suggested' || !match.penalty_amount_clp) return null;
  return DEBTOR_BY_REASON[match.reason_code] || null;
}

function creditorRoleForMatch(match) {
  const debtor = DEBTOR_BY_REASON[match?.reason_code];
  if (!debtor) return null;
  return debtor === 'shipper' ? 'carrier' : 'shipper';
}

function cancelTimestamp(match) {
  const raw = match.updated_at || match.created_at;
  if (!raw) return null;
  return new Date(raw);
}

function dueDateFromCancel(match) {
  const base = cancelTimestamp(match);
  if (!base || Number.isNaN(base.getTime())) return null;
  const due = new Date(base);
  due.setDate(due.getDate() + PENALTY_DUE_DAYS);
  return due;
}

function daysLate(dueAt) {
  if (!dueAt) return 0;
  const ms = Date.now() - new Date(dueAt).getTime();
  return ms > 0 ? Math.ceil(ms / (24 * 60 * 60 * 1000)) : 0;
}

function hoursUntil(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return ms > 0 ? Math.ceil(ms / (60 * 60 * 1000)) : 0;
}

/** Bloquea al deudor: multa vencida sin cerrar, o pago declarado sin confirmar. */
function debtorMustWaitToOperate(item, userRole) {
  if (!item || item.debtor_role !== userRole) return false;
  if (item.payment_status === 'confirmed' || item.payment_status === 'settled_moderator') {
    return false;
  }
  if (item.payment_status === 'claimed') return true;
  if (item.payment_status === 'disputed' || item.payment_status === 'confirm_expired') {
    return true;
  }
  return item.time_status === 'overdue';
}

function buildPenaltyItem(match, load, offer) {
  const due = dueDateFromCancel(match);
  const late = due ? daysLate(due) : 0;
  const debtor = DEBTOR_BY_REASON[match.reason_code] || null;
  const creditor = debtor ? (debtor === 'shipper' ? 'carrier' : 'shipper') : null;
  const payment_status = effectivePaymentStatus(match);
  const settled = isPenaltySettled(match);
  const time_status = settled ? 'paid' : late > 0 ? 'overdue' : 'pending';

  return {
    match_id: match.id,
    pair: `${load?.company_name || 'Embarcador'} ↔ ${offer?.carrier_name || 'Transportista'}`,
    shipper_name: load?.company_name || null,
    carrier_name: offer?.carrier_name || null,
    amount_clp: Number(match.penalty_amount_clp),
    reason_code: match.reason_code,
    reason_summary: match.cancel_reason || null,
    debtor_role: debtor,
    creditor_role: creditor,
    due_at: due ? due.toISOString() : null,
    days_late: settled ? 0 : late,
    time_status,
    payment_status,
    status: settled
      ? 'paid'
      : payment_status === 'claimed'
        ? 'awaiting_confirm'
        : payment_status === 'disputed'
          ? 'disputed'
          : payment_status === 'confirm_expired'
            ? 'confirm_expired'
            : time_status,
    claim_note: match.penalty_claim_note || null,
    dispute_note: match.penalty_dispute_note || null,
    claimed_at: match.penalty_claimed_at || null,
    confirm_deadline_at: match.penalty_confirm_deadline_at || null,
    hours_left_confirm: hoursUntil(match.penalty_confirm_deadline_at),
    paid_at: match.penalty_paid_at || match.penalty_confirmed_at || null,
    payment_note: match.penalty_payment_note || null,
    deadline_days: PENALTY_DUE_DAYS,
    confirm_hours: PENALTY_CONFIRM_HOURS,
    has_payment_proof: Boolean(match.penalty_payment_proof_data),
    payment_proof_at: match.penalty_payment_proof_at || null,
    can_claim:
      !settled && ['pending', 'disputed', 'confirm_expired'].includes(payment_status),
    can_confirm: payment_status === 'claimed',
    can_dispute: payment_status === 'claimed',
    can_view_proof: Boolean(match.penalty_payment_proof_data),
  };
}

async function buildPenaltySummary(repo, user) {
  const role =
    user?.role === 'carrier' ? 'carrier' : user?.role === 'shipper' ? 'shipper' : 'shipper';

  try {
    const { processExpiredClaims } = require('./penalty-payment');
    await processExpiredClaims();
  } catch (e) {
    console.error('processExpiredClaims', e);
  }

  const { filterMatchesForUser } = require('./access-scope');
  const allMatches = await repo.list('matches', {});
  const matches = user?.sub
    ? await filterMatchesForUser(allMatches, user)
    : allMatches.filter((m) => {
        const debtor = DEBTOR_BY_REASON[m.reason_code];
        return debtor === role;
      });
  const owed = [];
  const owedToMe = [];
  const paid_history = [];
  const pending_confirmations = [];

  for (const m of matches) {
    if (m.penalty_type !== 'fee_suggested' || !m.penalty_amount_clp) continue;
    if (m.status !== 'cancelled') continue;
    const historicalDebtor = DEBTOR_BY_REASON[m.reason_code] || null;
    if (!historicalDebtor) continue;
    const load = await repo.getById('load_requests', m.load_request_id);
    const offer = await repo.getById('capacity_offers', m.capacity_offer_id);
    const item = buildPenaltyItem(m, load, offer);

    if (isPenaltySettled(m)) {
      if (historicalDebtor === role) paid_history.push(item);
      continue;
    }

    const creditor = item.creditor_role;
    if (item.payment_status === 'claimed' && creditor === role) {
      pending_confirmations.push(item);
    }

    if (historicalDebtor === role) owed.push(item);
    else if (creditor === role) owedToMe.push(item);
  }

  const sum = (arr) => arr.reduce((a, x) => a + (x.amount_clp || 0), 0);

  const awaiting_confirm_count = owed.filter((x) => x.payment_status === 'claimed').length;
  const overdue_count = owed.filter(
    (x) => x.time_status === 'overdue' || x.status === 'confirm_expired'
  ).length;
  const blocked_awaiting_confirm = owed.some((x) => x.payment_status === 'claimed');
  const blocked_disputed = owed.some((x) =>
    ['disputed', 'confirm_expired'].includes(x.payment_status)
  );
  const blocked_overdue = owed.some(
    (x) => x.time_status === 'overdue' && x.payment_status === 'pending'
  );

  return {
    role,
    owed,
    owed_to_me: owedToMe,
    paid_history,
    pending_confirmations,
    total_owed_clp: sum(owed),
    total_receivable_clp: sum(owedToMe),
    overdue_count,
    awaiting_confirm_count,
    blocked_awaiting_confirm,
    blocked_disputed,
    blocked_overdue,
    penalty_due_days: PENALTY_DUE_DAYS,
    penalty_confirm_hours: PENALTY_CONFIRM_HOURS,
  };
}

function evaluateOperatingBlock(summary) {
  const totalOwed = Number(summary?.total_owed_clp) || 0;
  const dueDays = summary?.penalty_due_days || PENALTY_DUE_DAYS;
  const confirmHours = summary?.penalty_confirm_hours || PENALTY_CONFIRM_HOURS;
  const hasDebt = totalOwed > 0;
  const blockedAwaiting = Boolean(summary?.blocked_awaiting_confirm);
  const blockedDisputed = Boolean(summary?.blocked_disputed);
  const blockedOverdue = Boolean(summary?.blocked_overdue);
  const blocked = hasDebt && (blockedAwaiting || blockedOverdue || blockedDisputed);

  let message = null;
  let block_reason = null;
  if (blockedAwaiting) {
    block_reason = 'awaiting_confirm';
    message =
      `Declaraste pago de multa; el acreedor tiene ${confirmHours} h para confirmarlo. ` +
      `No puedes publicar, ofertar ni emparejar hasta la confirmación o cierre por moderador.`;
  } else if (blockedDisputed) {
    block_reason = 'disputed';
    message =
      'Hay una multa en disputa o sin confirmación del acreedor (plazo vencido). ' +
      'Regulariza con ayuda / moderador o vuelve a declarar el pago.';
  } else if (blockedOverdue) {
    block_reason = 'overdue';
    message =
      `Tienes multas vencidas por $${totalOwed.toLocaleString('es-CL')} CLP. ` +
      `Declara el pago y espera confirmación del acreedor, o abre Ayuda / revisión.`;
  } else if (hasDebt) {
    message =
      `Tienes $${totalOwed.toLocaleString('es-CL')} CLP en multas sugeridas. ` +
      `Plazo de pago: ${dueDays} días desde la cancelación. Después del vencimiento se bloquean nuevas operaciones.`;
  }

  return {
    blocked,
    block_reason,
    has_debt: hasDebt,
    total_owed_clp: totalOwed,
    overdue_count: summary?.overdue_count || 0,
    awaiting_confirm_count: summary?.awaiting_confirm_count || 0,
    penalty_due_days: dueDays,
    penalty_confirm_hours: confirmHours,
    message,
  };
}

function bankAccountFromUser(user) {
  if (!user) {
    return { complete: false, fields: {} };
  }
  const fields = {
    bank_holder_name: user.bank_holder_name || '',
    bank_rut: user.bank_rut || '',
    bank_name: user.bank_name || '',
    bank_account_type: user.bank_account_type || '',
    bank_account_number: user.bank_account_number || '',
  };
  const complete = Boolean(
    fields.bank_holder_name &&
      fields.bank_rut &&
      fields.bank_name &&
      fields.bank_account_type &&
      fields.bank_account_number
  );
  return { complete, fields, registered_at: user.bank_registered_at || null };
}

module.exports = {
  PENALTY_DUE_DAYS,
  PENALTY_CONFIRM_HOURS,
  PAYMENT_STATUSES,
  DEBTOR_BY_REASON,
  effectivePaymentStatus,
  isPenaltySettled,
  debtorRoleForMatch,
  creditorRoleForMatch,
  debtorMustWaitToOperate,
  buildPenaltySummary,
  evaluateOperatingBlock,
  bankAccountFromUser,
};
