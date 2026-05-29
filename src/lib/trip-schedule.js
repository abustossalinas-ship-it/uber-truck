'use strict';

const MIN_AHEAD_MIN = 30;
const MAX_AHEAD_DAYS = 90;

function parseScheduleMode(value) {
  return value === 'scheduled' ? 'scheduled' : 'now';
}

function parseIsoDatetime(value) {
  if (!value || typeof value !== 'string') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function validateScheduledAt(iso, label = 'fecha programada') {
  const errors = [];
  if (!iso) {
    errors.push(`Indica ${label} al programar el viaje.`);
    return errors;
  }
  const t = new Date(iso).getTime();
  const now = Date.now();
  const min = now + MIN_AHEAD_MIN * 60 * 1000;
  const max = now + MAX_AHEAD_DAYS * 24 * 60 * 60 * 1000;
  if (t < min) {
    errors.push(`${label}: debe ser al menos ${MIN_AHEAD_MIN} minutos desde ahora.`);
  }
  if (t > max) {
    errors.push(`${label}: máximo ${MAX_AHEAD_DAYS} días de anticipación.`);
  }
  return errors;
}

function buildLoadScheduleFields(body) {
  const schedule_mode = parseScheduleMode(body.schedule_mode);
  let scheduled_pickup_at = null;
  let cargo_ready_at = parseIsoDatetime(body.cargo_ready_at);

  if (schedule_mode === 'scheduled') {
    scheduled_pickup_at =
      parseIsoDatetime(body.scheduled_pickup_at) || cargo_ready_at;
    cargo_ready_at = scheduled_pickup_at;
  } else {
    scheduled_pickup_at = null;
    if (!cargo_ready_at && body.scheduled_pickup_at) {
      cargo_ready_at = parseIsoDatetime(body.scheduled_pickup_at);
    }
  }

  const errors = [];
  if (schedule_mode === 'scheduled') {
    errors.push(...validateScheduledAt(scheduled_pickup_at, 'retiro programado'));
  }

  return {
    schedule_mode,
    scheduled_pickup_at,
    cargo_ready_at,
    errors,
  };
}

function buildOfferScheduleFields(body) {
  const schedule_mode = parseScheduleMode(body.schedule_mode);
  let scheduled_depart_at = parseIsoDatetime(body.scheduled_depart_at);
  const errors = [];

  if (schedule_mode === 'scheduled') {
    errors.push(...validateScheduledAt(scheduled_depart_at, 'salida programada'));
  } else {
    scheduled_depart_at = null;
  }

  const available_from = scheduled_depart_at
    ? scheduled_depart_at.slice(0, 10)
    : body.available_from || null;
  const available_until = body.available_until || null;

  return {
    schedule_mode,
    scheduled_depart_at,
    available_from,
    available_until,
    errors,
  };
}

function formatScheduleSummary(row, role = 'load') {
  if (!row) return '';
  const mode = row.schedule_mode || 'now';
  if (mode !== 'scheduled') {
    return role === 'offer' ? 'Disponible ya' : 'Retiro lo antes posible';
  }
  const at = role === 'offer' ? row.scheduled_depart_at : row.scheduled_pickup_at;
  if (!at) return 'Programado (sin hora)';
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return 'Programado';
  const when = d.toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return role === 'offer' ? `Salida programada ${when}` : `Retiro programado ${when}`;
}

module.exports = {
  MIN_AHEAD_MIN,
  MAX_AHEAD_DAYS,
  parseScheduleMode,
  parseIsoDatetime,
  validateScheduledAt,
  buildLoadScheduleFields,
  buildOfferScheduleFields,
  formatScheduleSummary,
};
