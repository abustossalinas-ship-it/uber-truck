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
  if (min != null && o < Number(min)) return false;
  if (max != null && o > Number(max)) return false;
  return true;
}

module.exports = {
  copyBudgetFromLoad,
  validateLoadBudget,
  formatBudgetRange,
  offerWithinBudget,
};
