'use strict';

function copyBudgetFromLoad(load) {
  return {
    budget_min_clp: load.budget_min_clp != null ? Number(load.budget_min_clp) : null,
    budget_max_clp: load.budget_max_clp != null ? Number(load.budget_max_clp) : null,
  };
}

function validateLoadBudget(min, max) {
  const errors = [];
  if (min != null && max != null && Number(min) > Number(max)) {
    errors.push('El monto mínimo no puede ser mayor que el máximo');
  }
  if (min != null && Number(min) < 0) errors.push('Monto mínimo inválido');
  if (max != null && Number(max) < 0) errors.push('Monto máximo inválido');
  return errors;
}

function formatBudgetRange(min, max) {
  const fmt = (n) => (n != null ? `$${Number(n).toLocaleString('es-CL')}` : '—');
  if (min != null && max != null) return `${fmt(min)} – ${fmt(max)}`;
  if (max != null) return `hasta ${fmt(max)}`;
  if (min != null) return `desde ${fmt(min)}`;
  return 'sin rango';
}

function offerWithinBudget(offer, min, max) {
  if (offer == null) return null;
  const o = Number(offer);
  if (min == null && max == null) return null;
  if (min != null && o < Number(min)) return false;
  if (max != null && o > Number(max)) return false;
  return true;
}

/** Mensajes UX: oferta fuera de rango es válida; el embarcador puede ampliar presupuesto. */
function outsideRangeMessages(offer, min, max) {
  const within = offerWithinBudget(offer, min, max);
  if (within !== false) return { within: within !== false, carrier: null, shipper: null };
  const offerFmt = `$${Number(offer).toLocaleString('es-CL')}`;
  const rangeFmt = formatBudgetRange(min, max);
  return {
    within: false,
    carrier:
      `Tu oferta (${offerFmt}) está fuera del rango publicado (${rangeFmt}). Se envió igual: peso, urgencia o ruta pueden justificar otro valor. El embarcador puede ampliar su rango si aún no cerró con otro transportista.`,
    shipper:
      `Oferta ${offerFmt} fuera de tu rango (${rangeFmt}). Puedes ampliar el presupuesto si no hay otro match con precio ya acordado.`,
  };
}

/**
 * Referencia futura (no bloquea): peso, urgencia, distancia.
 * Sustituir por tarifario real cuando exista data de mercado.
 */
function suggestReferenceBudget(load) {
  const km = Number(load.distance_km) || 0;
  const kg = Number(load.weight_kg) || 0;
  let base = 120000;
  if (km > 0) base += km * 750;
  if (kg > 0) base += kg * 45;
  if (load.urgency === 'urgent') base = Math.round(base * 1.18);
  return {
    budget_min_clp: Math.round(base * 0.82),
    budget_max_clp: Math.round(base * 1.25),
    note: 'Sugerencia referencial (peso, urgencia, km). Ajusta según tu experiencia.',
  };
}

async function findAcceptedMatchOnLoad(repo, loadId) {
  const matches = await repo.list('matches', {});
  return (
    matches.find(
      (m) =>
        m.load_request_id === loadId &&
        ['accepted', 'in_progress', 'completed'].includes(m.status) &&
        m.agreed_price_clp != null
    ) || null
  );
}

async function assertCanAdjustLoadBudget(repo, loadId) {
  const locked = await findAcceptedMatchOnLoad(repo, loadId);
  if (locked) {
    const amt = Number(locked.agreed_price_clp).toLocaleString('es-CL');
    return `No puedes cambiar el rango: ya hay un precio acordado con otro transportista ($${amt} CLP).`;
  }
  return null;
}

module.exports = {
  copyBudgetFromLoad,
  validateLoadBudget,
  formatBudgetRange,
  offerWithinBudget,
  outsideRangeMessages,
  suggestReferenceBudget,
  findAcceptedMatchOnLoad,
  assertCanAdjustLoadBudget,
};
