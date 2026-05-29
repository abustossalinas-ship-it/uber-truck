/** Tiempos tipo Uber Eats: prep origen + ruta Maps + descarga + checklist */

const LoadTimingUI = {
  recalc(form) {
    if (!form || form.id !== 'form-load') return;
    const body = this.formSnapshot(form);
    const timing = this.suggestClient(body);
    this.applySuggestedInputs(form, timing);
    this.updateEtaDisplay(form, timing);
  },

  formSnapshot(form) {
    const fd = new FormData(form);
    const body = Object.fromEntries(fd.entries());
    body.has_dispatch_guide = form.querySelector('[name="has_dispatch_guide"]')?.value || 'no';
    body.distance_duration_min = form.querySelector('[name="distance_duration_min"]')?.value;
    return body;
  },

  suggestClient(body) {
    const pallets = Number(body.pallets) || (body.volume_m3 ? Math.ceil(Number(body.volume_m3) / 2) : 2);
    const hasGuide = body.has_dispatch_guide === 'yes';
    const cargo_ready = body.prep_cargo_ready === 'on';
    const docs_ready = body.prep_docs_ready === 'on';
    let load_min = 20 + pallets * 12;
    let paperwork_min = hasGuide ? 15 : 40;
    let unload_min = 20 + pallets * 8;
    let prep_min = 0;
    if (!cargo_ready) prep_min += 25;
    if (!docs_ready) prep_min += 20;
    const drive = Number(body.distance_duration_min) || 0;
    const origin_ops_min = prep_min + load_min + paperwork_min;
    return {
      prep_min,
      load_min,
      paperwork_min,
      unload_min,
      origin_ops_min,
      drive_min: drive,
      eta_total_min: origin_ops_min + drive + unload_min,
    };
  },

  applySuggestedInputs(form, t) {
    const set = (name, val) => {
      const el = form.querySelector(`[name="${name}"]`);
      if (el && el.dataset.userEdited !== '1') el.value = val;
    };
    set('prep_min', t.prep_min);
    set('load_min', t.load_min);
    set('paperwork_min', t.paperwork_min);
    set('unload_min', t.unload_min);
  },

  updateEtaDisplay(form, timing) {
    const box = form.querySelector('[data-distance-box]');
    if (!box) return;
    const dist = form.querySelector('[name="distance_km"]')?.value;
    const distTxt = dist ? `Distancia: ${Number(dist).toLocaleString('es-CL')} km` : '';
    if (!timing.drive_min && !dist) {
      box.textContent = 'Selecciona origen y destino para calcular la ruta.';
      return;
    }
    const lines = [];
    if (distTxt) lines.push(distTxt);
    if (timing.drive_min) lines.push(`Ruta (camión): ${timing.drive_min} min`);
    lines.push(
      `Preparación origen: ${timing.origin_ops_min} min (prep ${timing.prep_min} + carga ${timing.load_min} + papeles ${timing.paperwork_min})`
    );
    lines.push(`Descarga destino: ${timing.unload_min} min`);
    lines.push(`Tiempo total estimado: ~${timing.eta_total_min} min`);
    box.textContent = lines.join(' · ');
    box.classList.add('distance-box-eta');
  },

  getPayload(form) {
    const body = this.formSnapshot(form);
    const t = this.suggestClient(body);
    return {
      prep_min: Number(form.querySelector('[name="prep_min"]')?.value) || t.prep_min,
      load_min: Number(form.querySelector('[name="load_min"]')?.value) || t.load_min,
      paperwork_min: Number(form.querySelector('[name="paperwork_min"]')?.value) || t.paperwork_min,
      unload_min: Number(form.querySelector('[name="unload_min"]')?.value) || t.unload_min,
      prep_cargo_ready: form.querySelector('[name="prep_cargo_ready"]')?.checked || false,
      prep_docs_ready: form.querySelector('[name="prep_docs_ready"]')?.checked || false,
      prep_pickup_window_set: form.querySelector('[name="prep_pickup_window_set"]')?.checked || false,
    };
  },

  bind(form) {
    if (!form || form.id !== 'form-load') return;
    form.querySelectorAll('[name="prep_min"],[name="load_min"],[name="paperwork_min"],[name="unload_min"]').forEach((el) => {
      el.addEventListener('input', () => {
        el.dataset.userEdited = '1';
        this.recalc(form);
      });
    });
    ['prep_cargo_ready', 'prep_docs_ready', 'prep_pickup_window_set', 'has_dispatch_guide'].forEach((name) => {
      const el = form.querySelector(`[name="${name}"]`);
      el?.addEventListener('change', () => {
        form.querySelectorAll('[name="prep_min"],[name="load_min"],[name="paperwork_min"],[name="unload_min"]').forEach((i) => {
          i.dataset.userEdited = '';
        });
        this.recalc(form);
      });
    });
    ['pallets', 'volume_m3'].forEach((name) => {
      form.querySelector(`[name="${name}"]`)?.addEventListener('input', () => this.recalc(form));
    });
    this.recalc(form);
  },
};

function formatLoadTimingLine(load) {
  if (!load) return '';
  const parts = [];
  const summary =
    typeof formatTimingSummaryFromLoad === 'function'
      ? formatTimingSummaryFromLoad(load)
      : null;
  if (summary) parts.push(summary);
  const c = load.prep_checklist;
  if (c && (c.cargo_ready || c.docs_ready)) {
    const bits = [];
    if (c.cargo_ready) bits.push('lista');
    if (c.docs_ready) bits.push('docs OK');
    if (bits.length) parts.push(`Checklist: ${bits.join(', ')}`);
  }
  return parts.length ? `<p class="muted load-timing-line">${parts.join(' · ')}</p>` : '';
}

function formatTimingSummaryFromLoad(load) {
  const drive = Number(load.distance_duration_min) || 0;
  const total = Number(load.eta_total_min);
  if (!drive && !total) return '';
  if (total) return `ETA total ~${total} min (ruta ${drive} min)`;
  return `Ruta ~${drive} min`;
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-load');
  if (form) LoadTimingUI.bind(form);
});
