/** Rango de presupuesto sugerido al publicar carga (referencia km + peso + urgencia) */

function formatClp(n) {
  return `$${Number(n).toLocaleString('es-CL')}`;
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
    const minIn = form.querySelector('[name="budget_min_clp"]');
    const maxIn = form.querySelector('[name="budget_max_clp"]');
    if (minIn) minIn.value = j.data.budget_min_clp;
    if (maxIn) maxIn.value = j.data.budget_max_clp;
    box.innerHTML = `<strong>Sugerencia:</strong> ${formatClp(j.data.budget_min_clp)} – ${formatClp(j.data.budget_max_clp)}. ${j.data.note || ''} ${j.disclaimer || ''}`;
  } catch {
    box.textContent = 'Error al obtener sugerencia.';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-load');
  document.getElementById('btn-budget-hint')?.addEventListener('click', () => {
    applyBudgetHintFromForm(form);
  });
});
