'use strict';

const PENALTY_DUE_DAYS = Number(process.env.PENALTY_DUE_DAYS) || 7;

const DEBTOR_BY_REASON = {
  shipper_change_plans: 'shipper',
  shipper_cancel_in_transit: 'shipper',
  carrier_unavailable: 'carrier',
  carrier_no_show: 'carrier',
};

function debtorRoleForMatch(match) {
  if (!match || match.status !== 'cancelled') return null;
  if (match.penalty_type !== 'fee_suggested' || !match.penalty_amount_clp) return null;
  return DEBTOR_BY_REASON[match.reason_code] || null;
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

function buildPenaltyItem(match, load, offer) {
  const due = dueDateFromCancel(match);
  const late = due ? daysLate(due) : 0;
  const debtor = debtorRoleForMatch(match);
  return {
    match_id: match.id,
    pair: `${load?.company_name || 'Embarcador'} ↔ ${offer?.carrier_name || 'Transportista'}`,
    shipper_name: load?.company_name || null,
    carrier_name: offer?.carrier_name || null,
    amount_clp: Number(match.penalty_amount_clp),
    reason_code: match.reason_code,
    reason_summary: match.cancel_reason || null,
    debtor_role: debtor,
    due_at: due ? due.toISOString() : null,
    days_late: late,
    status: late > 0 ? 'overdue' : 'pending',
    deadline_days: PENALTY_DUE_DAYS,
  };
}

async function buildPenaltySummary(repo, userRole) {
  const role = userRole === 'carrier' ? 'carrier' : 'shipper';
  const matches = await repo.list('matches', {});
  const owed = [];
  const owedToMe = [];

  for (const m of matches) {
    const debtor = debtorRoleForMatch(m);
    if (!debtor) continue;
    const load = await repo.getById('load_requests', m.load_request_id);
    const offer = await repo.getById('capacity_offers', m.capacity_offer_id);
    const item = buildPenaltyItem(m, load, offer);
    if (debtor === role) owed.push(item);
    else owedToMe.push(item);
  }

  const sum = (arr) => arr.reduce((a, x) => a + (x.amount_clp || 0), 0);

  return {
    role,
    owed,
    owed_to_me: owedToMe,
    total_owed_clp: sum(owed),
    total_receivable_clp: sum(owedToMe),
    overdue_count: owed.filter((x) => x.status === 'overdue').length,
    penalty_due_days: PENALTY_DUE_DAYS,
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
  debtorRoleForMatch,
  buildPenaltySummary,
  bankAccountFromUser,
};
