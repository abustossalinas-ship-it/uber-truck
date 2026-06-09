/** Rango de presupuesto sugerido + ayuda honesta de urgencia al publicar carga */

const BUDGET_STEP = 1000;

/** Copy opción 2 (comercial) — tono menos técnico, piloto honesto */
const URGENCY_HINTS = {
  normal: {
    tone: 'normal',
    title: 'Normal — equilibrio precio y plazo',
    lines: [
      'Equilibrio entre <strong>precio y plazo</strong> de retiro (referencia ~48 h si no programas fecha).',
      'Al usar «Ver rango sugerido», el presupuesto es el <strong>estándar</strong> para tu ruta y peso.',
      'Tu carga aparece en el tablero <strong>como cualquier otra</strong>; todos los transportistas la ven en el mismo momento.',
    ],
  },
  urgent: {
    tone: 'urgent',
    title: 'Urgente — retiro rápido',
    lines: [
      'Necesitas retiro <strong>más rápido</strong> (referencia ~24 h si no programas fecha).',
      'La sugerencia de presupuesto sale <strong>más alta (~18%)</strong> para atraer camión antes.',
      'Hoy <strong>todos la ven al mismo tiempo</strong> — la fila prioritaria en tablero es un próximo paso, no está activa en el piloto.',
    ],
  },
  flexible: {
    tone: 'flexible',
    title: 'Flexible — sin apuro',
    lines: [
      'Sin apuro: tienes <strong>más margen</strong> (referencia hasta ~5 días) para cerrar con un camión.',
      'Presupuesto sugerido <strong>estándar</strong>, igual que Normal.',
      'Ideal si puedes esperar a que un transportista encaje tu carga en una ruta ya planificada.',
    ],
  },
};

const CARGO_FREIGHT_MIN_RATIO = 0.005;

function formatClp(n) {
  return `$${Number(n).toLocaleString('es-CL')}`;
}

function syncCargoFreightInsight(form) {
  const box = document.getElementById('load-cargo-freight-insight');
  if (!form || !box) return;
  const cargo = Number(form.querySelector('[name="declared_cargo_value_clp"]')?.value);
  const maxB = Number(form.querySelector('[name="budget_max_clp"]')?.value);
  if (!cargo || cargo < 1000) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  let html = `Valor mercadería: ${formatClp(cargo)}. El flete es el costo logístico; para seguro conviene no desalinearlo del valor declarado.`;
  if (maxB > 0) {
    const pct = ((maxB / cargo) * 100).toFixed(2);
    html += ` Tope flete ${formatClp(maxB)} ≈ ${pct}% del valor.`;
    if (maxB < cargo * CARGO_FREIGHT_MIN_RATIO) {
      box.className = 'load-cargo-freight-insight load-cargo-freight-warn';
      html +=
        ' <strong>Revisa:</strong> el flete parece muy bajo vs el valor de la carga (referencia seguro ~0,5%).';
    } else {
      box.className = 'load-cargo-freight-insight muted';
    }
  } else {
    box.className = 'load-cargo-freight-insight muted';
  }
  box.innerHTML = html;
}

function bindCargoFreightInsight(form) {
  if (!form) return;
  ['declared_cargo_value_clp', 'budget_min_clp', 'budget_max_clp'].forEach((name) => {
    form.querySelector(`[name="${name}"]`)?.addEventListener('input', () => syncCargoFreightInsight(form));
  });
  syncCargoFreightInsight(form);
}

function roundBudgetToStep(n, mode = 'nearest') {
  const v = Number(n) || 0;
  if (mode === 'down') return Math.floor(v / BUDGET_STEP) * BUDGET_STEP;
  if (mode === 'up') return Math.ceil(v / BUDGET_STEP) * BUDGET_STEP;
  return Math.round(v / BUDGET_STEP) * BUDGET_STEP;
}

function renderLoadUrgencyHint(value) {
  const box = document.getElementById('load-urgency-hint');
  if (!box) return;
  const hint = URGENCY_HINTS[value] || URGENCY_HINTS.normal;
  box.className = `load-urgency-hint load-urgency-hint--${hint.tone}`;
  box.innerHTML = `
    <p class="load-urgency-hint__title">${hint.title}</p>
    <ul class="load-urgency-hint__list">
      ${hint.lines.map((line) => `<li>${line}</li>`).join('')}
    </ul>
    <p class="load-urgency-hint__foot muted">Cubik no cobra un cargo extra por marcar urgente; solo orienta plazo y presupuesto sugerido.</p>
  `;
}

function bindLoadUrgencyHint(form) {
  const select = form?.querySelector('[name="urgency"]');
  if (!select) return;
  const sync = () => renderLoadUrgencyHint(select.value || 'normal');
  select.addEventListener('change', sync);
  sync();
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
    const urgentNote =
      urgency === 'urgent'
        ? ' Incluye recargo referencial por urgente (~18% vs Normal).'
        : '';
    box.innerHTML = `<strong>Sugerencia aplicada:</strong> ${formatClp(minRounded)} – ${formatClp(maxRounded)} (miles de $).${urgentNote} ${j.data.note || ''} ${j.disclaimer || ''}`;
    syncCargoFreightInsight(form);
  } catch {
    box.textContent = 'Error al obtener sugerencia.';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-load');
  bindLoadUrgencyHint(form);
  bindCargoFreightInsight(form);
  document.getElementById('btn-budget-hint')?.addEventListener('click', (e) => {
    e.preventDefault();
    applyBudgetHintFromForm(form);
  });
});
