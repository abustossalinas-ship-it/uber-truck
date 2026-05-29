/** Rango de presupuesto sugerido al publicar carga (referencia km + peso + urgencia) */

const BUDGET_STEP = 1000;

function formatClp(n) {
  return `$${Number(n).toLocaleString('es-CL')}`;
}

function roundBudgetToStep(n, mode = 'nearest') {
  const v = Number(n) || 0;
  if (mode === 'down') return Math.floor(v / BUDGET_STEP) * BUDGET_STEP;
  if (mode === 'up') return Math.ceil(v / BUDGET_STEP) * BUDGET_STEP;
  return Math.round(v / BUDGET_STEP) * BUDGET_STEP;
}

async function applyBudgetHintFromForm(form) {
  const box = document.getElementById('load-budget-hint-result');
  if (!form || !box) return;
  const distance_km = form.querySelector('[name="distance_km"]')?.value;
  const weight_kg = form.querySelector('[name="weight_kg"]')?.value;
  const urgency = form.querySelector('[name="urgency"]')?.value || 'normal';
  if (!distance_km && !weight_kg) {
    alert('Completa origen y destino en Maps (distancia) y/o peso en m³/pallets para una sugerencia.');
    return;
  }
  box.hidden = false;
  box.textContent = 'Calculando rango sugerido…';
  try {
    const r = await fetch('/api/maps/budget-estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ distance_km, weight_kg, urgency }),
    });
    const j = await r.json();
    if (!j.ok || !j.data) {
      box.textContent = 'No se pudo calcular la sugerencia.';
      return;
    }
    const minRounded = roundBudgetToStep(j.data.budget_min_clp, 'down');
    let maxRounded = roundBudgetToStep(j.data.budget_max_clp, 'up');
    if (maxRounded <= minRounded) maxRounded = minRounded + 10000;
    const minIn = form.querySelector('[name="budget_min_clp"]');
    const maxIn = form.querySelector('[name="budget_max_clp"]');
    if (minIn) minIn.value = minRounded;
    if (maxIn) maxIn.value = maxRounded;
    box.innerHTML = `<strong>Sugerencia aplicada:</strong> ${formatClp(minRounded)} – ${formatClp(maxRounded)} (miles de $). ${j.data.note || ''} ${j.disclaimer || ''}`;
  } catch {
    box.textContent = 'Error al obtener sugerencia.';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-load');
  document.getElementById('btn-budget-hint')?.addEventListener('click', (e) => {
    e.preventDefault();
    applyBudgetHintFromForm(form);
  });
});
