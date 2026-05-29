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
  // —— Aceptado: antes de «Marcar en ruta» (sin mercadería en camión) ——
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
    phases: ['accepted'],
    roles: ['shipper', 'admin'],
    penalty: {
      type: 'fee_suggested',
      percentOfAgreed: 15,
      minClp: 30000,
      note: 'Compensación sugerida al transportista por reserva de capacidad.',
    },
    requiresDetail: false,
    requiresAgreement: true,
    reputationImpact: 'negative',
  },
  {
    code: 'carrier_unavailable',
    label: 'Transportista no puede cumplir antes del retiro',
    actions: ['cancel'],
    phases: ['accepted'],
    roles: ['carrier', 'admin'],
    penalty: {
      type: 'fee_suggested',
      percentOfAgreed: 10,
      minClp: 20000,
      note: 'Compensación sugerida al embarcador. Afecta reputación si no hay fuerza mayor.',
    },
    requiresDetail: true,
    requiresAgreement: true,
    reputationImpact: 'negative',
  },
  {
    code: 'carrier_missed_deadline',
    label: 'Transportista no llegará al plazo acordado (antes del retiro)',
    actions: ['cancel'],
    phases: ['accepted'],
    roles: ['carrier', 'admin'],
    penalty: {
      type: 'fee_suggested',
      percentOfAgreed: 12,
      minClp: 25000,
      note: 'Incumplimiento de plazo antes de retirar la carga. Multa sugerida al embarcador.',
    },
    requiresDetail: true,
    requiresAgreement: true,
    reputationImpact: 'negative',
  },
  {
    code: 'shipper_carrier_late',
    label: 'Transportista no cumplió el plazo (aún no marcó en ruta)',
    actions: ['cancel'],
    phases: ['accepted'],
    roles: ['shipper', 'admin'],
    penalty: {
      type: 'fee_suggested',
      percentOfAgreed: 15,
      minClp: 30000,
      note: 'Plazo de retiro vencido. Compensación sugerida al embarcador.',
    },
    requiresDetail: true,
    requiresAgreement: true,
    requiresDeadlinePast: true,
    reputationImpact: 'negative',
  },
  {
    code: 'carrier_no_show',
    label: 'Transportista no se presentó al retiro',
    actions: ['cancel'],
    phases: ['accepted'],
    roles: ['shipper', 'admin'],
    penalty: {
      type: 'fee_suggested',
      percentOfAgreed: 20,
      minClp: 40000,
      note: 'No show antes de salir. Compensación sugerida al embarcador.',
    },
    requiresDetail: true,
    requiresAgreement: true,
    reputationImpact: 'negative',
  },
  // —— En ejecución: solo embarcador (carga ya en ruta); transportista usa incidente ——
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
    reputationImpact: 'negative',
  },
  {
    code: 'shipper_carrier_failed',
    label: 'Transportista no entregó / falla grave en ruta',
    actions: ['cancel'],
    phases: ['in_progress'],
    roles: ['shipper', 'admin'],
    penalty: {
      type: 'fee_suggested',
      percentOfAgreed: 20,
      minClp: 40000,
      note: 'Compensación sugerida al embarcador. Indica evidencia en el detalle.',
    },
    requiresDetail: true,
    requiresAgreement: true,
    reputationImpact: 'negative',
  },
  {
    code: 'price_dispute',
    label: 'Desacuerdo de precio o condiciones',
    actions: ['cancel'],
    phases: ['accepted'],
    roles: ['shipper', 'carrier', 'admin'],
    penalty: { type: 'mediation', note: 'Se recomienda mediación antes de volver a publicar.' },
    requiresDetail: true,
    requiresAgreement: true,
  },
  {
    code: 'force_majeure',
    label: 'Fuerza mayor (accidente, clima, restricción vial)',
    actions: ['cancel'],
    phases: ['accepted'],
    roles: ['shipper', 'carrier', 'admin'],
    penalty: { type: 'none', note: 'Sin multa sugerida si el motivo es verificable.' },
    requiresDetail: true,
    requiresAgreement: false,
  },
  {
    code: 'force_majeure_in_transit',
    label: 'Fuerza mayor con carga en ruta',
    actions: ['cancel'],
    phases: ['in_progress'],
    roles: ['shipper', 'admin'],
    penalty: { type: 'none', note: 'Sin multa sugerida si el motivo es verificable.' },
    requiresDetail: true,
    requiresAgreement: false,
  },
  {
    code: 'other',
    label: 'Otro motivo (especificar)',
    actions: ['withdraw', 'reject', 'cancel'],
    phases: ['proposed', 'accepted'],
    roles: ['shipper', 'carrier', 'admin'],
    penalty: { type: 'review', note: 'El equipo puede revisar el caso.' },
    requiresDetail: true,
    requiresAgreement: false,
  },
  {
    code: 'other_in_transit',
    label: 'Otro motivo grave en ruta (especificar)',
    actions: ['cancel'],
    phases: ['in_progress'],
    roles: ['shipper', 'admin'],
    penalty: { type: 'review', note: 'Solo embarcador; revisión manual.' },
    requiresDetail: true,
    requiresAgreement: true,
  },
];

/** Límites operativos (MVP) */
const LIMITS = {
  withdrawPerLoadPerDay: 8,
  minDetailLength: {
    default: 8,
    force_majeure: 15,
    force_majeure_in_transit: 15,
    other: 12,
    other_in_transit: 12,
  },
};

function normalizeRole(role) {
  if (role === 'carrier' || role === 'admin') return role;
  return 'shipper';
}

function listReasonOptions(action, matchStatus, role, agreedPriceClp = null, opts = {}) {
  const r = normalizeRole(role);
  const mutualReady = Boolean(opts.mutualReady);
  const deadlinePast = Boolean(opts.deadlinePast);
  return REASONS.filter((x) => {
    if (!x.actions.includes(action) || !x.phases.includes(matchStatus) || !x.roles.includes(r)) {
      return false;
    }
    if (x.requiresMutualConfirm && !mutualReady) return false;
    if (x.requiresDeadlinePast && !deadlinePast) return false;
    return true;
  }).map((x) => {
    const penaltyPreview = computePenalty(x, agreedPriceClp);
    const feeLabel =
      penaltyPreview.type === 'fee_suggested' && penaltyPreview.amount_clp
        ? ` — multa sugerida $${penaltyPreview.amount_clp.toLocaleString('es-CL')}`
        : penaltyPreview.type === 'none'
          ? ' — sin multa'
          : '';
    const repLabel = x.reputationImpact === 'negative' ? ' · afecta reputación' : '';
    return {
      code: x.code,
      label: x.label,
      label_short: x.label + feeLabel + repLabel,
      requiresDetail: x.requiresDetail,
      requiresAgreement: x.requiresAgreement,
      penalty: x.penalty,
      penalty_preview: penaltyPreview,
      reputation_impact: x.reputationImpact || null,
    };
  });
}

const PHASE_LABELS = {
  proposed: 'Propuesta (sin compromiso de ruta)',
  accepted: 'Aceptado — aún no marcado en ruta (sin carga en camión)',
  in_progress: 'En ejecución — carga en ruta (cancelación muy restringida)',
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
  deadlinePast,
}) {
  const reason = getReasonByCode(reason_code);
  if (!reason) return 'Selecciona un motivo válido.';
  if (!reason.actions.includes(action) || !reason.phases.includes(matchStatus)) {
    return 'Este motivo no aplica a esta acción o estado.';
  }
  if (!reason.roles.includes(normalizeRole(role))) {
    return 'Tu rol no puede usar este motivo en esta etapa.';
  }
  if (
    matchStatus === 'in_progress' &&
    normalizeRole(role) === 'carrier' &&
    action === 'cancel' &&
    !(reason.code === 'mutual_agreement' && mutualReady)
  ) {
    return 'Con la carga en ruta el transportista no cancela el viaje. Usa «Reportar incidente» o acuerdo mutuo con el embarcador.';
  }
  if (reason.requiresMutualConfirm && !mutualReady) {
    return 'Acuerdo mutuo: ambas partes deben confirmar primero en Emparejamientos (botones Confirmar acuerdo mutuo).';
  }
  if (reason.requiresDeadlinePast && !deadlinePast) {
    return 'Este motivo solo aplica cuando ya venció el plazo de retiro acordado.';
  }
  const detail = (reason_detail || '').trim();
  if (reason.requiresDetail) {
    const min =
      reason.code === 'force_majeure' || reason.code === 'force_majeure_in_transit'
        ? LIMITS.minDetailLength.force_majeure
        : reason.code === 'other' || reason.code === 'other_in_transit'
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

function reputationMessage(reason) {
  if (reason?.reputationImpact !== 'negative') return null;
  return 'Este motivo queda registrado y puede afectar la reputación en futuras calificaciones.';
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
  reputationMessage,
};
