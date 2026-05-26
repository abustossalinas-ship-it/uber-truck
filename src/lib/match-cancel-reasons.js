'use strict';

/**
 * Catálogo de motivos, límites y multas sugeridas (acuerdo entre partes; sin cobro automático en MVP).
 * @see docs/MATCH-CANCEL-POLICY.md
 */

const REASONS = [
  // —— Fase 1–2: propuesta (embarcador retira / cambia oferta) ——
  {
    code: 'wrong_offer',
    label: 'Me equivoqué de oferta',
    actions: ['withdraw'],
    phases: ['proposed'],
    roles: ['shipper', 'admin'],
    penalty: { type: 'none' },
    requiresDetail: false,
    requiresAgreement: false,
  },
  {
    code: 'better_offer',
    label: 'Apareció una oferta mejor en el tablero',
    actions: ['withdraw'],
    phases: ['proposed'],
    roles: ['shipper', 'admin'],
    penalty: { type: 'none' },
    requiresDetail: false,
    requiresAgreement: false,
  },
  {
    code: 'timing_change',
    label: 'Cambió la fecha o urgencia del envío',
    actions: ['withdraw'],
    phases: ['proposed'],
    roles: ['shipper', 'admin'],
    penalty: { type: 'none' },
    requiresDetail: false,
    requiresAgreement: false,
  },
  {
    code: 'duplicate_error',
    label: 'Propuesta duplicada por error',
    actions: ['withdraw'],
    phases: ['proposed'],
    roles: ['shipper', 'admin'],
    penalty: { type: 'none' },
    requiresDetail: false,
    requiresAgreement: false,
  },
  // —— Fase 2: transportista rechaza propuesta ——
  {
    code: 'route_not_fit',
    label: 'La ruta no calza con mi viaje',
    actions: ['reject'],
    phases: ['proposed'],
    roles: ['carrier', 'admin'],
    penalty: { type: 'none' },
    requiresDetail: false,
    requiresAgreement: false,
  },
  {
    code: 'capacity_taken',
    label: 'Ya asigné el espacio a otra carga',
    actions: ['reject'],
    phases: ['proposed'],
    roles: ['carrier', 'admin'],
    penalty: { type: 'none' },
    requiresDetail: false,
    requiresAgreement: false,
  },
  {
    code: 'price_below_floor',
    label: 'Precio propuesto bajo mi piso',
    actions: ['reject'],
    phases: ['proposed'],
    roles: ['carrier', 'admin'],
    penalty: { type: 'none' },
    requiresDetail: false,
    requiresAgreement: false,
  },
  // —— Fase 3: cancelar después de aceptar / en ruta ——
  {
    code: 'mutual_agreement',
    label: 'Acuerdo mutuo entre embarcador y transportista',
    actions: ['cancel'],
    phases: ['accepted', 'in_progress'],
    roles: ['shipper', 'carrier', 'admin'],
    penalty: { type: 'none' },
    requiresDetail: false,
    requiresAgreement: false,
    requiresMutualConfirm: true,
  },
  {
    code: 'shipper_change_plans',
    label: 'Embarcador cancela por cambio de planes',
    actions: ['cancel'],
    phases: ['accepted', 'in_progress'],
    roles: ['shipper', 'admin'],
    penalty: {
      type: 'fee_suggested',
      percentOfAgreed: 15,
      minClp: 30000,
      note: 'Compensación sugerida al transportista por reserva de capacidad.',
    },
    requiresDetail: false,
    requiresAgreement: true,
  },
  {
    code: 'carrier_unavailable',
    label: 'Transportista no puede cumplir el servicio',
    actions: ['cancel'],
    phases: ['accepted'],
    roles: ['carrier', 'admin'],
    penalty: {
      type: 'fee_suggested',
      percentOfAgreed: 10,
      minClp: 20000,
      note: 'Compensación sugerida al embarcador por incumplimiento del transportista.',
    },
    requiresDetail: false,
    requiresAgreement: true,
  },
  {
    code: 'carrier_no_show',
    label: 'Transportista no se presentó / falla operativa grave',
    actions: ['cancel'],
    phases: ['in_progress'],
    roles: ['carrier', 'admin'],
    penalty: {
      type: 'fee_suggested',
      percentOfAgreed: 20,
      minClp: 40000,
      note: 'Compensación sugerida al embarcador. Solo con evidencia o acuerdo.',
    },
    requiresDetail: true,
    requiresAgreement: true,
  },
  {
    code: 'shipper_cancel_in_transit',
    label: 'Embarcador cancela con carga ya en ruta',
    actions: ['cancel'],
    phases: ['in_progress'],
    roles: ['shipper', 'admin'],
    penalty: {
      type: 'fee_suggested',
      percentOfAgreed: 25,
      minClp: 50000,
      note: 'Compensación sugerida al transportista por costos ya incurridos.',
    },
    requiresDetail: true,
    requiresAgreement: true,
  },
  {
    code: 'price_dispute',
    label: 'Desacuerdo de precio o condiciones',
    actions: ['cancel'],
    phases: ['accepted', 'in_progress'],
    roles: ['shipper', 'carrier', 'admin'],
    penalty: { type: 'mediation', note: 'Se recomienda mediación antes de volver a publicar.' },
    requiresDetail: true,
    requiresAgreement: true,
  },
  {
    code: 'force_majeure',
    label: 'Fuerza mayor (accidente, clima, restricción vial)',
    actions: ['cancel'],
    phases: ['accepted', 'in_progress'],
    roles: ['shipper', 'carrier', 'admin'],
    penalty: { type: 'none', note: 'Sin multa sugerida si el motivo es verificable.' },
    requiresDetail: true,
    requiresAgreement: false,
  },
  {
    code: 'other',
    label: 'Otro motivo (especificar)',
    actions: ['withdraw', 'reject', 'cancel'],
    phases: ['proposed', 'accepted', 'in_progress'],
    roles: ['shipper', 'carrier', 'admin'],
    penalty: { type: 'review', note: 'El equipo puede revisar el caso.' },
    requiresDetail: true,
    requiresAgreement: false,
  },
];

/** Límites operativos (MVP) */
const LIMITS = {
  withdrawPerLoadPerDay: 8,
  minDetailLength: { default: 8, force_majeure: 15, other: 12 },
};

function normalizeRole(role) {
  if (role === 'carrier' || role === 'admin') return role;
  return 'shipper';
}

function listReasonOptions(action, matchStatus, role, agreedPriceClp = null, opts = {}) {
  const r = normalizeRole(role);
  const mutualReady = Boolean(opts.mutualReady);
  return REASONS.filter(
    (x) =>
      x.actions.includes(action) &&
      x.phases.includes(matchStatus) &&
      x.roles.includes(r) &&
      (!x.requiresMutualConfirm || mutualReady)
  ).map((x) => {
    const penaltyPreview = computePenalty(x, agreedPriceClp);
    const feeLabel =
      penaltyPreview.type === 'fee_suggested' && penaltyPreview.amount_clp
        ? ` — multa sugerida $${penaltyPreview.amount_clp.toLocaleString('es-CL')}`
        : penaltyPreview.type === 'none'
          ? ' — sin multa'
          : '';
    return {
      code: x.code,
      label: x.label,
      label_short: x.label + feeLabel,
      requiresDetail: x.requiresDetail,
      requiresAgreement: x.requiresAgreement,
      penalty: x.penalty,
      penalty_preview: penaltyPreview,
    };
  });
}

const PHASE_LABELS = {
  proposed: 'Propuesta (sin compromiso de ruta)',
  accepted: 'Aceptado — camión aún no marcado en ruta',
  in_progress: 'En ejecución — camión en ruta',
};

function phaseLabel(matchStatus) {
  return PHASE_LABELS[matchStatus] || matchStatus;
}

function getReasonByCode(code) {
  return REASONS.find((x) => x.code === code) || null;
}

function computePenalty(reason, agreedPriceClp) {
  const p = reason.penalty || { type: 'none' };
  if (p.type !== 'fee_suggested' || !agreedPriceClp) {
    return { type: p.type, amount_clp: null, note: p.note || null };
  }
  const pct = (agreedPriceClp * (p.percentOfAgreed || 0)) / 100;
  const amount = Math.max(Math.round(pct), p.minClp || 0);
  return { type: 'fee_suggested', amount_clp: amount, note: p.note || null };
}

function buildReasonSummary(reason, detail) {
  let text = reason.label;
  if (detail) text += `: ${detail}`;
  return text;
}

function validateReasonPayload({
  action,
  matchStatus,
  role,
  reason_code,
  reason_detail,
  agreement_accepted,
  mutualReady,
}) {
  const reason = getReasonByCode(reason_code);
  if (!reason) return 'Selecciona un motivo válido.';
  if (!reason.actions.includes(action) || !reason.phases.includes(matchStatus)) {
    return 'Este motivo no aplica a esta acción o estado.';
  }
  if (!reason.roles.includes(normalizeRole(role))) {
    return 'Tu rol no puede usar este motivo.';
  }
  if (reason.requiresMutualConfirm && !mutualReady) {
    return 'Acuerdo mutuo: ambas partes deben confirmar primero en Emparejamientos (botones Confirmar acuerdo mutuo).';
  }
  const detail = (reason_detail || '').trim();
  if (reason.requiresDetail) {
    const min =
      reason.code === 'force_majeure'
        ? LIMITS.minDetailLength.force_majeure
        : reason.code === 'other'
          ? LIMITS.minDetailLength.other
          : LIMITS.minDetailLength.default;
    if (detail.length < min) {
      return `Indica más detalle (mínimo ${min} caracteres).`;
    }
  }
  if (reason.requiresAgreement && !agreement_accepted) {
    return 'Debes confirmar el acuerdo o la multa sugerida para continuar.';
  }
  return null;
}

async function checkWithdrawLimit(repo, loadRequestId) {
  const rows = await repo.list('matches', {});
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const count = rows.filter(
    (m) =>
      m.load_request_id === loadRequestId &&
      m.cancel_action === 'withdraw' &&
      m.status === 'cancelled' &&
      m.created_at &&
      new Date(m.created_at).getTime() > dayAgo
  ).length;
  if (count >= LIMITS.withdrawPerLoadPerDay) {
    return `Límite diario: máximo ${LIMITS.withdrawPerLoadPerDay} retiros por carga en 24 h.`;
  }
  return null;
}

module.exports = {
  REASONS,
  LIMITS,
  PHASE_LABELS,
  phaseLabel,
  listReasonOptions,
  getReasonByCode,
  computePenalty,
  buildReasonSummary,
  validateReasonPayload,
  checkWithdrawLimit,
};
