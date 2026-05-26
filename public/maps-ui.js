/** Autocompletado de direcciones, bloqueo de campos y peso estimado (Google Maps vía API backend) */

const MapsUI = {
  configured: false,
  _debounce: null,
  densityMap: {
    light: { kg_per_pallet: 400, kg_per_m3: 333 },
    normal: { kg_per_pallet: 800, kg_per_m3: 667 },
    heavy: { kg_per_pallet: 1200, kg_per_m3: 1000 },
  },

  async init() {
    try {
      const r = await fetch('/api/maps/status');
      const j = await r.json();
      this.configured = j.configured;
    } catch {
      this.configured = false;
    }
    document.querySelectorAll('.maps-banner').forEach((el) => {
      el.hidden = this.configured;
    });
    document.querySelectorAll('form[data-maps-form]').forEach((form) => this.bindForm(form));
  },

  bindForm(form) {
    form.querySelectorAll('[data-address]').forEach((wrap) => this.bindAddressField(form, wrap));
    form.addEventListener('maps:place-selected', () => {
      this.updateDistance(form);
      this.updateFormGate(form);
    });
    this.updateFormGate(form);
    this.bindWeightEstimate(form);
  },

  isRoleValidated(form, role) {
    const lat = form.querySelector(`[name="${role}_lat"]`)?.value;
    const lng = form.querySelector(`[name="${role}_lng"]`)?.value;
    const addr = form.querySelector(`[name="${role}_address"]`)?.value?.trim();
    const placeId = form.querySelector(`[name="${role}_place_id"]`)?.value?.trim();
    if (!this.configured) return true;
    return !!(lat && lng && addr && placeId);
  },

  bothAddressesValidated(form) {
    return this.isRoleValidated(form, 'origin') && this.isRoleValidated(form, 'destination');
  },

  clearRole(form, role) {
    const fields = ['address', 'commune', 'city', 'region', 'lat', 'lng', 'place_id'];
    fields.forEach((suffix) => {
      const el = form.querySelector(`[name="${role}_${suffix}"]`);
      if (el) el.value = '';
    });
  },

  updateFormGate(form) {
    const gated = form.querySelector('.maps-gated-section');
    if (!gated) return;
    const ready = this.bothAddressesValidated(form);
    const lock = this.configured && !ready;
    gated.disabled = lock;
    gated.classList.toggle('maps-gated-locked', lock);
    const hint = form.querySelector('.maps-gate-hint');
    if (hint) {
      hint.hidden = !this.configured || ready;
    }
    form.querySelectorAll('.maps-geo-readonly').forEach((el) => {
      if (this.configured) {
        el.readOnly = true;
        el.title = 'Se completa al elegir una dirección en la lista';
      }
    });
  },

  assertFormReady(form) {
    if (!this.configured) return null;
    if (!this.isRoleValidated(form, 'origin')) {
      return 'Selecciona el origen desde la lista de Google Maps (no solo escribas texto).';
    }
    if (!this.isRoleValidated(form, 'destination')) {
      return 'Selecciona el destino desde la lista de Google Maps (no solo escribas texto).';
    }
    return null;
  },

  bindAddressField(form, wrap) {
    const role = wrap.dataset.address;
    const input = wrap.querySelector('.address-search');
    const list = wrap.querySelector('.address-suggestions');
    if (!input || !list) return;

    const hide = () => {
      list.hidden = true;
      list.innerHTML = '';
    };

    input.addEventListener('input', () => {
      clearTimeout(this._debounce);
      if (input.dataset.mapsValidated === '1') {
        input.dataset.mapsValidated = '';
        input.dataset.mapsLocked = '';
        this.clearRole(form, role);
        const dk = form.querySelector('[name="distance_km"]');
        const dm = form.querySelector('[name="distance_duration_min"]');
        if (dk) dk.value = '';
        if (dm) dm.value = '';
        this.updateFormGate(form);
      }
      const q = input.value.trim();
      if (q.length < 3) {
        hide();
        return;
      }
      this._debounce = setTimeout(async () => {
        try {
          const r = await fetch(`/api/maps/autocomplete?input=${encodeURIComponent(q)}`);
          const j = await r.json();
          if (!j.ok || !j.data?.length) {
            hide();
            return;
          }
          list.hidden = false;
          list.innerHTML = j.data
            .map(
              (p) =>
                `<li><button type="button" data-place-id="${p.place_id}">${p.description}</button></li>`
            )
            .join('');
        } catch {
          hide();
        }
      }, 280);
    });

    list.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-place-id]');
      if (!btn) return;
      hide();
      input.value = btn.textContent;
      input.dataset.mapsValidated = '1';
      input.dataset.mapsLocked = '1';
      try {
        const r = await fetch(`/api/maps/place/${btn.dataset.placeId}`);
        const j = await r.json();
        if (!j.ok) return;
        this.applyPlace(form, role, j.data);
        form.dispatchEvent(new Event('maps:place-selected'));
      } catch {
        alert('No se pudo cargar la dirección');
      }
    });

    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) hide();
    });
  },

  applyPlace(form, role, place) {
    const set = (suffix, val) => {
      const el = form.querySelector(`[name="${role}_${suffix}"]`);
      if (el) el.value = val ?? '';
    };
    set('address', place.formatted_address);
    set('commune', place.commune || place.city);
    set('city', place.city || place.commune);
    set('region', place.region);
    set('lat', place.lat);
    set('lng', place.lng);
    set('place_id', place.place_id);
  },

  async updateDistance(form) {
    const box = form.querySelector('[data-distance-box]');
    if (!box) return;
    const g = (role, f) => form.querySelector(`[name="${role}_${f}"]`)?.value;
    const olat = g('origin', 'lat');
    const olng = g('origin', 'lng');
    const dlat = g('destination', 'lat');
    const dlng = g('destination', 'lng');
    if (!olat || !olng || !dlat || !dlng) {
      box.textContent = 'Selecciona origen y destino en el mapa para calcular distancia.';
      return;
    }
    box.textContent = 'Calculando distancia…';
    try {
      const r = await fetch('/api/maps/distance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: { lat: Number(olat), lng: Number(olng) },
          destination: { lat: Number(dlat), lng: Number(dlng) },
        }),
      });
      const j = await r.json();
      if (!j.ok) {
        box.textContent = 'No se pudo calcular la ruta.';
        return;
      }
      const dk = form.querySelector('[name="distance_km"]');
      const dm = form.querySelector('[name="distance_duration_min"]');
      if (dk) dk.value = j.distance_km;
      if (dm) dm.value = j.duration_min;
      box.textContent = `Distancia: ${j.distance_text} · Tiempo estimado: ${j.duration_text}`;
    } catch {
      box.textContent = 'Error al calcular distancia.';
    }
  },

  bindWeightEstimate(form) {
    if (form.id !== 'form-load') return;
    const density = form.querySelector('[name="cargo_density"]');
    const pallets = form.querySelector('[name="pallets"]');
    const volume = form.querySelector('[name="volume_m3"]');
    const weight = form.querySelector('[name="weight_kg"]');
    if (!weight) return;

    const recalc = () => {
      const d = this.densityMap[density?.value || 'normal'] || this.densityMap.normal;
      if (!d) return;
      const p = Number(pallets?.value) || 0;
      const v = Number(volume?.value) || 0;
      const fromP = p > 0 ? p * d.kg_per_pallet : 0;
      const fromV = v > 0 ? v * d.kg_per_m3 : 0;
      if (fromP <= 0 && fromV <= 0) return;
      if (weight.dataset.userEdited === '1') return;
      weight.value = Math.round(Math.max(fromP, fromV));
      this.updateWeightHint(form);
    };

    weight.addEventListener('input', () => {
      weight.dataset.userEdited = '1';
    });
    density?.addEventListener('change', () => {
      weight.dataset.userEdited = '';
      recalc();
    });
    pallets?.addEventListener('input', () => {
      weight.dataset.userEdited = '';
      recalc();
    });
    volume?.addEventListener('input', () => {
      weight.dataset.userEdited = '';
      recalc();
    });
    form._recalcWeight = recalc;
  },

  updateWeightHint(form) {
    const hint = form.querySelector('.maps-weight-hint');
    const density = form.querySelector('[name="cargo_density"]');
    const d = this.densityMap[density?.value || 'normal'];
    if (!hint || !d) return;
    hint.textContent = `Peso sugerido: max(${d.kg_per_pallet} kg/pallet, ${d.kg_per_m3} kg/m³). Papas y pañales ocupan parecido en m³ pero no pesan igual — ajusta densidad o el kg si lo sabes.`;
  },
};

async function bindCubicacionPresets() {
  try {
    const r = await fetch('/api/maps/cubicacion-presets');
    const j = await r.json();
    if (!j.ok) return;
    MapsUI.densityMap = Object.fromEntries((j.density_options || []).map((d) => [d.id, d]));

    const loadSel = document.getElementById('load-cubicacion-preset');
    const offerSel = document.getElementById('offer-cubicacion-preset');
    if (loadSel) {
      loadSel.innerHTML =
        '<option value="">Elegir cubicación…</option>' +
        j.load.map((p) => `<option value="${p.id}">${p.label}</option>`).join('');
      loadSel.addEventListener('change', () => {
        const p = j.load.find((x) => x.id === loadSel.value);
        if (!p || p.id === 'custom') return;
        const form = document.getElementById('form-load');
        if (p.volume_m3 != null) form.volume_m3.value = p.volume_m3;
        if (p.pallets != null) form.pallets.value = p.pallets;
        const w = form.querySelector('[name="weight_kg"]');
        if (w) {
          w.dataset.userEdited = '';
          if (p.weight_kg != null) w.value = p.weight_kg;
        }
        form._recalcWeight?.();
      });
    }
    if (offerSel) {
      offerSel.innerHTML =
        '<option value="">Elegir espacio disponible…</option>' +
        j.offer.map((p) => `<option value="${p.id}">${p.label}</option>`).join('');
      offerSel.addEventListener('change', () => {
        const p = j.offer.find((x) => x.id === offerSel.value);
        if (!p || p.id === 'custom') return;
        const form = document.getElementById('form-offer');
        if (p.free_volume_m3 != null) form.free_volume_m3.value = p.free_volume_m3;
        if (p.max_weight_kg != null) form.max_weight_kg.value = p.max_weight_kg;
      });
    }
    const loadForm = document.getElementById('form-load');
    if (loadForm) MapsUI.updateWeightHint(loadForm);
  } catch {
    /* presets opcionales */
  }
}

document.addEventListener('DOMContentLoaded', () => {
  MapsUI.init();
  bindCubicacionPresets();
});
