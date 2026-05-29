'use strict';

/** Horas desde aceptación si la carga no tiene `needed_by`. */
const SLA_HOURS_BY_URGENCY = {
  urgent: 24,
  normal: 48,
  flexible: 120,
};

function pickupDeadlineAt(load, match) {
  if (load?.needed_by) {
    const d = new Date(load.needed_by);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const anchor =
    match?.accepted_at ||
    match?.updated_at ||
    match?.created_at ||
    load?.created_at;
  const base = new Date(anchor || Date.now());
  const hours = SLA_HOURS_BY_URGENCY[load?.urgency] ?? SLA_HOURS_BY_URGENCY.normal;
  base.setHours(base.getHours() + hours);
  return base;
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
  isPickupDeadlinePassed,
  formatDeadlineLabel,
};
