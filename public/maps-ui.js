/** Autocompletado de direcciones y distancia (Google Maps vía API backend) */

const MapsUI = {
  configured: false,
  _debounce: null,

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
    if (!this.configured) return;
    document.querySelectorAll('form[data-maps-form]').forEach((form) => this.bindForm(form));
  },

  bindForm(form) {
    form.querySelectorAll('[data-address]').forEach((wrap) => this.bindAddressField(form, wrap));
    form.addEventListener('maps:place-selected', () => this.updateDistance(form));
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
};

async function bindCubicacionPresets() {
  try {
    const r = await fetch('/api/maps/cubicacion-presets');
    const j = await r.json();
    if (!j.ok) return;
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
        if (p.weight_kg != null) form.weight_kg.value = p.weight_kg;
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
  } catch {
    /* presets opcionales */
  }
}

document.addEventListener('DOMContentLoaded', () => {
  MapsUI.init();
  bindCubicacionPresets();
});
