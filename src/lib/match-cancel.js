'use strict';

const repo = require('./repository');

/** Quién puede ejecutar cada acción según estado del match */
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

function validateReason(action, matchStatus, reason) {
  if (action === 'withdraw' || action === 'reject') return null;
  const text = (reason || '').trim();
  if (matchStatus === 'in_progress') {
    if (text.length < 10) {
      return 'Indica un motivo de al menos 10 caracteres para cancelar en ejecución.';
    }
    return null;
  }
  if (text.length < 5) {
    return 'Indica un motivo de al menos 5 caracteres.';
  }
  return null;
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

module.exports = {
  PERMISSIONS,
  ACTION_LABELS,
  normalizeRole,
  canPerform,
  validateReason,
  releaseLoadAndOffer,
};
