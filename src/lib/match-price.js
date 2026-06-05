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

/** Múltiplo usado en formulario (step=1000) y ofertas. */
const BUDGET_CLP_STEP = 1000;

/** Coeficientes sugerencia flete — calibrados corredor RM–V (jun 2026). Ver .env.example */
function budgetRates() {
  const num = (key, fallback) => {
    const v = Number(process.env[key]);
    return Number.isFinite(v) && v >= 0 ? v : fallback;
  };
  return {
    baseClp: num('BUDGET_BASE_CLP', 80_000),
    rateKm: num('BUDGET_RATE_KM_CLP', 450),
    rateKg: num('BUDGET_RATE_KG_CLP', 22),
    urgentMult: num('BUDGET_URGENT_MULT', 1.18),
    minRatio: num('BUDGET_MIN_RATIO', 0.82),
    maxRatio: num('BUDGET_MAX_RATIO', 1.25),
  };
}

/**
 * Redondea montos CLP a números “cerrados” (miles) para inputs type=number step=1000.
 * @param {'nearest'|'down'|'up'} mode
 */
function roundBudgetClp(n, mode = 'nearest') {
  const v = Number(n) || 0;
  const step = BUDGET_CLP_STEP;
  if (mode === 'down') return Math.floor(v / step) * step;
  if (mode === 'up') return Math.ceil(v / step) * step;
  return Math.round(v / step) * step;
}

/**
 * Referencia de presupuesto: peso, urgencia, distancia.
 * Defaults calibrados vs piloto (ej. Renca–La Serena ~463 km → ~$550k–570k con 10–12 t).
 * No bloquea ofertas fuera de rango; el mercado fija agreed_price_clp.
 */
function suggestReferenceBudget(load) {
  const { baseClp, rateKm, rateKg, urgentMult, minRatio, maxRatio } = budgetRates();
  const km = Number(load.distance_km) || 0;
  const kg = Number(load.weight_kg) || 0;
  let base = baseClp;
  if (km > 0) base += km * rateKm;
  if (kg > 0) base += kg * rateKg;
  if (load.urgency === 'urgent') base = Math.round(base * urgentMult);
  let budget_min_clp = roundBudgetClp(base * minRatio, 'down');
  let budget_max_clp = roundBudgetClp(base * maxRatio, 'up');
  if (budget_min_clp < BUDGET_CLP_STEP) budget_min_clp = BUDGET_CLP_STEP;
  if (budget_max_clp <= budget_min_clp) {
    budget_max_clp = budget_min_clp + roundBudgetClp(base * 0.15, 'up') || 10000;
  }
  return {
    budget_min_clp,
    budget_max_clp,
    note: `Sugerencia referencial (base $${baseClp.toLocaleString('es-CL')}, $${rateKm}/km, $${rateKg}/kg), redondeada a miles.`,
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
  BUDGET_CLP_STEP,
  budgetRates,
  roundBudgetClp,
  copyBudgetFromLoad,
  validateLoadBudget,
  formatBudgetRange,
  offerWithinBudget,
  outsideRangeMessages,
  suggestReferenceBudget,
  findAcceptedMatchOnLoad,
  assertCanAdjustLoadBudget,
};
