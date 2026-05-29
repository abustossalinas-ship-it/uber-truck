'use strict';

/** Horas desde aceptación si la carga no tiene plazos explícitos (fallback). */
const SLA_HOURS_BY_URGENCY = {
  urgent: 24,
  normal: 48,
  flexible: 120,
};

function addMinutes(date, minutes) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

function originOpsMinutes(load) {
  if (load?.origin_ops_min != null) return Number(load.origin_ops_min);
  const prep = Number(load?.prep_min) || 0;
  const loadM = Number(load?.load_min) || 30;
  const paper = Number(load?.paperwork_min) || 30;
  return prep + loadM + paper;
}

/** Plazo para retirar carga (antes de «En ruta»). */
function pickupDeadlineAt(load, match) {
  const ops = originOpsMinutes(load);
  if (load?.cargo_ready_at) {
    const ready = new Date(load.cargo_ready_at);
    if (!Number.isNaN(ready.getTime())) return addMinutes(ready, ops);
  }
  const anchor =
    match?.accepted_at ||
    match?.updated_at ||
    match?.created_at ||
    load?.created_at;
  const base = new Date(anchor || Date.now());
  if (ops > 0) return addMinutes(base, ops);
  const hours = SLA_HOURS_BY_URGENCY[load?.urgency] ?? SLA_HOURS_BY_URGENCY.normal;
  return addMinutes(base, hours * 60);
}

/** Plazo de entrega en destino (si el embarcador lo indicó). */
function deliveryDeadlineAt(load) {
  if (load?.needed_by_at) {
    const d = new Date(load.needed_by_at);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (load?.needed_by) {
    const d = new Date(load.needed_by);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function isPickupDeadlinePassed(load, match, now = Date.now()) {
  return now > pickupDeadlineAt(load, match).getTime();
}

function formatDeadlineLabel(load, match) {
  const d = pickupDeadlineAt(load, match);
  return d.toLocaleString('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

module.exports = {
  SLA_HOURS_BY_URGENCY,
  pickupDeadlineAt,
  deliveryDeadlineAt,
  isPickupDeadlinePassed,
  formatDeadlineLabel,
  originOpsMinutes,
};
