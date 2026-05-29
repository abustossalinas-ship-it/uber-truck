'use strict';

const DEFAULTS = {
  base_load_min: 20,
  per_pallet_load_min: 12,
  paperwork_guide_yes_min: 15,
  paperwork_guide_no_min: 40,
  base_unload_min: 20,
  per_pallet_unload_min: 8,
  prep_not_ready_min: 25,
  prep_docs_pending_min: 20,
};

function palletsFromBody(body) {
  const p = Number(body.pallets);
  if (p > 0) return Math.min(p, 500);
  const v = Number(body.volume_m3);
  if (v > 0) return Math.max(1, Math.ceil(v / 2));
  return 2;
}

function parseChecklist(body) {
  const cargo_ready =
    body.prep_cargo_ready === true ||
    body.prep_cargo_ready === '1' ||
    body.prep_cargo_ready === 'on';
  const docs_ready =
    body.prep_docs_ready === true ||
    body.prep_docs_ready === '1' ||
    body.prep_docs_ready === 'on';
  const pickup_window_set =
    body.prep_pickup_window_set === true ||
    body.prep_pickup_window_set === '1' ||
    body.prep_pickup_window_set === 'on';
  return { cargo_ready, docs_ready, pickup_window_set };
}

function suggestMinutes(body) {
  const pallets = palletsFromBody(body);
  const hasGuide = body.has_dispatch_guide === 'yes';
  let load_min =
    body.load_min != null && body.load_min !== ''
      ? Number(body.load_min)
      : DEFAULTS.base_load_min + pallets * DEFAULTS.per_pallet_load_min;
  let paperwork_min =
    body.paperwork_min != null && body.paperwork_min !== ''
      ? Number(body.paperwork_min)
      : hasGuide
        ? DEFAULTS.paperwork_guide_yes_min
        : DEFAULTS.paperwork_guide_no_min;
  let unload_min =
    body.unload_min != null && body.unload_min !== ''
      ? Number(body.unload_min)
      : DEFAULTS.base_unload_min + pallets * DEFAULTS.per_pallet_unload_min;

  load_min = Math.max(0, Math.min(480, Math.round(load_min)));
  paperwork_min = Math.max(0, Math.min(240, Math.round(paperwork_min)));
  unload_min = Math.max(0, Math.min(480, Math.round(unload_min)));

  const checklist = parseChecklist(body);
  let prep_min = body.prep_min != null && body.prep_min !== '' ? Number(body.prep_min) : 0;
  if (!prep_min) {
    if (!checklist.cargo_ready) prep_min += DEFAULTS.prep_not_ready_min;
    if (!checklist.docs_ready) prep_min += DEFAULTS.prep_docs_pending_min;
  }
  prep_min = Math.max(0, Math.min(480, Math.round(prep_min)));

  const origin_ops_min = prep_min + load_min + paperwork_min;
  const drive_min = Number(body.distance_duration_min) || 0;
  const eta_total_min = origin_ops_min + drive_min + unload_min;

  return {
    prep_min,
    load_min,
    paperwork_min,
    unload_min,
    origin_ops_min,
    eta_total_min,
    prep_checklist: checklist,
  };
}

function parseIsoDatetime(value) {
  if (!value || typeof value !== 'string') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function buildLoadTimingPayload(body) {
  const timing = suggestMinutes(body);
  return {
    ...timing,
    prep_checklist: timing.prep_checklist,
    cargo_ready_at: parseIsoDatetime(body.cargo_ready_at),
    needed_by_at: parseIsoDatetime(body.needed_by_at),
    needed_by: body.needed_by_at ? body.needed_by_at.slice(0, 10) : body.needed_by || null,
  };
}

function formatTimingSummary(load) {
  if (!load) return '';
  const drive = Number(load.distance_duration_min) || 0;
  const origin = Number(load.origin_ops_min) || 0;
  const unload = Number(load.unload_min) || 0;
  const total = Number(load.eta_total_min) || origin + drive + unload;
  if (!drive && !origin) return '';
  const parts = [];
  if (drive) parts.push(`Ruta ${drive} min`);
  if (origin) parts.push(`Origen ${origin} min`);
  if (unload) parts.push(`Descarga ${unload} min`);
  if (total) parts.push(`Total ~${total} min`);
  return parts.join(' · ');
}

function checklistLabel(load) {
  const c = load.prep_checklist || {};
  const bits = [];
  if (c.cargo_ready) bits.push('Carga lista');
  if (c.docs_ready) bits.push('Docs listos');
  if (c.pickup_window_set) bits.push('Ventana retiro');
  return bits.length ? bits.join(' · ') : null;
}

module.exports = {
  DEFAULTS,
  suggestMinutes,
  buildLoadTimingPayload,
  formatTimingSummary,
  checklistLabel,
  parseChecklist,
};
