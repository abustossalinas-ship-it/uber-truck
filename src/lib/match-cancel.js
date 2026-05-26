'use strict';

const repo = require('./repository');
const {
  validateReasonPayload,
  checkWithdrawLimit,
  getReasonByCode,
  computePenalty,
  buildReasonSummary,
} = require('./match-cancel-reasons');

const PERMISSIONS = {
  proposed: {
    withdraw: ['shipper', 'admin'],
    reject: ['carrier', 'admin'],
  },
  accepted: {
    cancel: ['shipper', 'carrier', 'admin'],
  },
  in_progress: {
    cancel: ['shipper', 'carrier', 'admin'],
  },
};

const ACTION_LABELS = {
  withdraw: 'retirar propuesta',
  reject: 'rechazar propuesta',
  cancel: 'cancelar emparejamiento',
};

function normalizeRole(role) {
  if (role === 'carrier' || role === 'admin') return role;
  return 'shipper';
}

function canPerform(matchStatus, action, role) {
  const allowed = PERMISSIONS[matchStatus]?.[action];
  if (!allowed) return false;
  return allowed.includes(normalizeRole(role));
}

async function releaseLoadAndOffer(match) {
  const load = await repo.getById('load_requests', match.load_request_id);
  const offer = await repo.getById('capacity_offers', match.capacity_offer_id);
  if (load && ['matched', 'in_transit'].includes(load.status)) {
    await repo.update('load_requests', load.id, { status: 'published' });
  }
  if (offer && offer.status === 'reserved') {
    await repo.update('capacity_offers', offer.id, { status: 'published' });
  }
}

async function applyCancelPatch(match, action, role, body) {
  const reason = getReasonByCode(body.reason_code);
  const penalty = computePenalty(reason, match.agreed_price_clp);
  const summary = buildReasonSummary(reason, body.reason_detail?.trim());

  return repo.update('matches', match.id, {
    status: 'cancelled',
    cancel_action: action,
    cancelled_by: role,
    cancel_reason: summary,
    reason_code: body.reason_code,
    reason_detail: body.reason_detail?.trim() || null,
    penalty_type: penalty.type,
    penalty_amount_clp: penalty.amount_clp,
    agreement_accepted: Boolean(body.agreement_accepted),
  });
}

module.exports = {
  PERMISSIONS,
  ACTION_LABELS,
  normalizeRole,
  canPerform,
  validateReasonPayload,
  checkWithdrawLimit,
  applyCancelPatch,
  releaseLoadAndOffer,
  computePenalty,
  buildReasonSummary,
  getReasonByCode,
};
