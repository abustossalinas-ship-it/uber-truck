/** Autocompletado de direcciones, bloqueo de campos y peso estimado (Google Maps vía API backend) */

const MapsUI = {
  configured: false,
  _debounce: null,
  densityMap: {
    light: { kg_per_pallet: 400, kg_per_m3: 333 },
    normal: { kg_per_pallet: 800, kg_per_m3: 667 },
    heavy: { kg_per_pallet: 1200, kg_per_m3: 1000 },
  },

  isSpecificPlace(typesValue) {
    const types = String(typesValue || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const SPECIFIC = new Set([
      'street_address',
      'route',
      'premise',
      'subpremise',
      'establishment',
      'point_of_interest',
      'store',
      'storage',
      'warehouse',
      'transit_station',
    ]);
    const VAGUE = new Set([
      'locality',
      'administrative_area_level_1',
      'administrative_area_level_2',
      'administrative_area_level_3',
      'political',
      'country',
    ]);
    if (!types.length) return false;
    if (types.some((t) => SPECIFIC.has(t))) return true;
    if (types.includes('locality') || types.includes('administrative_area_level_1')) return false;
    return types.some((t) => !VAGUE.has(t) && t !== 'geocode');
  },

  async init() {
    try {
      const r = await fetch('/api/maps/status');
      const j = await r.json();
      this.configured = j.configured;
    } catch {
      this.configured = false;
    }
    this.bindIosKeyboard();
    document.querySelectorAll('.maps-banner').forEach((el) => {
      el.hidden = this.configured;
    });
    document.querySelectorAll('form[data-maps-form]').forEach((form) => this.bindForm(form));
    this.bindGlobalPickerDismiss();
  },

  bindGlobalPickerDismiss() {
    if (this._globalDismissBound) return;
    this._globalDismissBound = true;
    document.addEventListener('click', (e) => {
      if (e.target.closest('.address-suggestions') || e.target.closest('.address-wrap')) return;
      this.closeAllSuggestions();
    });
  },

  /** Cierra listas de ambos formularios (evita que Ofertar ruta tape Publicar carga). */
  closeAllSuggestions(exceptWrap = null) {
    let anyOpen = false;
    document.querySelectorAll('form[data-maps-form]').forEach((form) => {
      form.querySelectorAll('[data-address]').forEach((wrap) => {
        if (exceptWrap && wrap === exceptWrap) return;
        const list = wrap.querySelector('.address-suggestions');
        if (!list) return;
        wrap.classList.remove('address-suggestions-open');
        list.hidden = true;
        list.innerHTML = '';
        this.unportalSuggestions(list, wrap);
        this.setAddressStatus(wrap, '', false);
      });
    });
    document.querySelectorAll('.address-suggestions-portal').forEach((list) => {
      if (!list.hidden) anyOpen = true;
    });
    if (!anyOpen) document.body.classList.remove('maps-picker-open');
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
    const fields = ['address', 'commune', 'city', 'region', 'lat', 'lng', 'place_id', 'place_types'];
    fields.forEach((suffix) => {
      const el = form.querySelector(`[name="${role}_${suffix}"]`);
      if (el) el.value = '';
    });
    this.updateGeoUi(form, role);
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
    for (const role of ['origin', 'destination']) {
      const label = role === 'origin' ? 'Origen' : 'Destino';
      const wrap = form.querySelector(`[data-address="${role}"]`);
      const input = wrap?.querySelector('.address-search');
      if (input?.value.trim() && input.dataset.mapsValidated !== '1') {
        return `${label}: elige una dirección de la lista de Google Maps (no escribas solo «${input.value.trim()}»).`;
      }
      if (!this.isRoleValidated(form, role)) {
        return `${label}: selecciona la dirección desde la lista de Google Maps (un clic en la sugerencia).`;
      }
      const types = form.querySelector(`[name="${role}_place_types"]`)?.value;
      if (types && !this.isSpecificPlace(types)) {
        return `${label}: la dirección es muy genérica. Indica calle, bodega, planta o puerto concreto (no solo ciudad o región).`;
      }
    }
    return null;
  },

  bindIosKeyboard() {
    if (this._iosKbBound) return;
    this._iosKbBound = true;
    const apply = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--kb-inset', `${Math.round(kb)}px`);
    };
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', apply);
      window.visualViewport.addEventListener('scroll', apply);
      apply();
    }
  },

  fetchApi(path, options) {
    if (typeof apiFetch === 'function') return apiFetch(path, options);
    return fetch(path, options);
  },

  ensureAddressStatus(wrap) {
    let el = wrap.querySelector('.address-search-status');
    if (!el) {
      el = document.createElement('p');
      el.className = 'address-search-status muted';
      el.setAttribute('aria-live', 'polite');
      wrap.querySelector('.address-search')?.insertAdjacentElement('afterend', el);
    }
    return el;
  },

  setAddressStatus(wrap, message, visible = true) {
    const el = this.ensureAddressStatus(wrap);
    if (!message || !visible) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.textContent = message;
  },

  isCubikApp() {
    return document.body.classList.contains('cubik-app');
  },

  shouldPortalSuggestions() {
    return this.isCubikApp() || window.matchMedia('(max-width: 768px)').matches;
  },

  /** Alinea la lista al campo (evita desfase a la izquierda en móvil / visualViewport). */
  positionPortalList(list, input) {
    if (!list || !input) return;
    const vv = window.visualViewport;
    const pad = 12;
    const vw = vv?.width ?? window.innerWidth;
    const vLeft = vv?.offsetLeft ?? 0;
    const vTop = vv?.offsetTop ?? 0;
    const rect = input.getBoundingClientRect();
    const left = Math.max(pad, rect.left + vLeft);
    const maxW = vw - left - pad;
    const width = Math.max(160, Math.min(rect.width, maxW));
    const spaceBelow = (vv?.height ?? window.innerHeight) - rect.bottom;
    const maxH = Math.min(260, Math.max(120, spaceBelow - 12));
    let top = rect.bottom + vTop + 4;
    if (spaceBelow < 140 && rect.top > 180) {
      top = Math.max(vTop + pad, rect.top + vTop - Math.min(220, maxH) - 4);
    }
    list.style.position = 'fixed';
    list.style.left = `${Math.round(left)}px`;
    list.style.width = `${Math.round(width)}px`;
    list.style.right = 'auto';
    list.style.top = `${Math.round(top)}px`;
    list.style.bottom = 'auto';
    list.style.maxHeight = `${Math.round(maxH)}px`;
    list.classList.add('address-suggestions-portal-aligned');
  },

  bindPortalReposition(list, input) {
    if (!list || list._portalRepositionBound) return;
    list._portalRepositionBound = true;
    const tick = () => {
      if (!list.hidden && list.classList.contains('address-suggestions-portal')) {
        this.positionPortalList(list, input);
      }
    };
    window.addEventListener('resize', tick);
    window.addEventListener('scroll', tick, true);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', tick);
      window.visualViewport.addEventListener('scroll', tick);
    }
    list._portalRepositionTick = tick;
  },

  unbindPortalReposition(list) {
    if (!list?._portalRepositionBound) return;
    const tick = list._portalRepositionTick;
    if (tick) {
      window.removeEventListener('resize', tick);
      window.removeEventListener('scroll', tick, true);
      window.visualViewport?.removeEventListener('resize', tick);
      window.visualViewport?.removeEventListener('scroll', tick);
    }
    delete list._portalRepositionBound;
    delete list._portalRepositionTick;
    list.style.cssText = '';
    list.classList.remove('address-suggestions-portal-aligned');
  },

  portalSuggestions(list, wrap) {
    if (!this.shouldPortalSuggestions()) return;
    const input = wrap.querySelector('.address-search');
    if (list.parentElement !== document.body) {
      document.body.appendChild(list);
    }
    list.classList.add('address-suggestions-portal');
    list.dataset.portalRole = wrap.dataset.address || '';
    list.dataset.portalForm = wrap.closest('form')?.id || '';
    document.body.classList.add('maps-picker-open');
    if (input) {
      this.positionPortalList(list, input);
      this.bindPortalReposition(list, input);
    }
  },

  unportalSuggestions(list, wrap) {
    this.unbindPortalReposition(list);
    list.classList.remove('address-suggestions-portal');
    delete list.dataset.portalRole;
    if (wrap && list.parentElement === document.body) {
      wrap.appendChild(list);
    }
    if (!document.querySelector('.address-suggestions-portal:not([hidden])')) {
      document.body.classList.remove('maps-picker-open');
    }
  },

  scrollAddressIntoView(input) {
    if (!input) return;
    const scrollMain = () => {
      const main =
        document.querySelector('body.cubik-app.app-main-visible main') ||
        document.querySelector('main') ||
        document.scrollingElement;
      if (main && typeof main.scrollTo === 'function') {
        const rect = input.getBoundingClientRect();
        const top = rect.top + (main.scrollTop || window.scrollY) - 72;
        main.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      } else {
        input.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    };
    setTimeout(scrollMain, 80);
    setTimeout(scrollMain, 320);
  },

  updateGeoUi(form, role) {
    const validated = this.isRoleValidated(form, role);
    const geo = form.querySelector(`[data-address-geo="${role}"]`);
    const summary = form.querySelector(`[data-address-summary="${role}"]`);
    const block = form.querySelector(`[data-address-block="${role}"]`);
    if (block) block.classList.toggle('address-validated', validated);
    if (geo) geo.classList.toggle('address-geo-ready', validated);
    if (summary) {
      if (validated) {
        const addr = form.querySelector(`[name="${role}_address"]`)?.value;
        const commune = form.querySelector(`[name="${role}_commune"]`)?.value;
        const region = form.querySelector(`[name="${role}_region"]`)?.value;
        summary.hidden = false;
        summary.textContent = [addr, commune, region].filter(Boolean).join(' · ');
      } else {
        summary.hidden = true;
        summary.textContent = '';
      }
    }
  },

  bindAddressField(form, wrap) {
    const role = wrap.dataset.address;
    const input = wrap.querySelector('.address-search');
    const list = wrap.querySelector('.address-suggestions');
    if (!input || !list) return;

    const hide = () => {
      wrap.classList.remove('address-suggestions-open');
      list.hidden = true;
      list.innerHTML = '';
      this.unportalSuggestions(list, wrap);
      this.setAddressStatus(wrap, '', false);
    };

    const pickPlace = async (btn) => {
      if (!btn) return;
      hide();
      input.value = btn.textContent;
      input.dataset.mapsValidated = '1';
      input.dataset.mapsLocked = '1';
      try {
        const r = await this.fetchApi(`/api/maps/place/${btn.dataset.placeId}`);
        const j = await r.json();
        if (!j.ok) return;
        if (j.data.types?.length && !this.isSpecificPlace(j.data.types.join(','))) {
          input.dataset.mapsValidated = '';
          input.dataset.mapsLocked = '';
          this.clearRole(form, role);
          alert(
            role === 'origin'
              ? 'Origen demasiado genérico. Busca una dirección concreta: calle, bodega o planta (no solo el nombre de la ciudad).'
              : 'Destino demasiado genérico. Busca puerto, bodega o dirección exacta (no solo «Arica» o una comuna).'
          );
          return;
        }
        this.applyPlace(form, role, j.data);
        document.body.classList.remove('keyboard-open');
        hide();
        form.dispatchEvent(new Event('maps:place-selected'));
      } catch {
        alert('No se pudo cargar la dirección');
      }
    };

    input.addEventListener('focus', () => {
      document.body.classList.add('keyboard-open');
      this.scrollAddressIntoView(input);
      if (!this.configured) {
        this.setAddressStatus(
          wrap,
          'Google Maps no está disponible. Configura GOOGLE_MAPS_API_KEY en el servidor.'
        );
      }
    });
    input.addEventListener('blur', () => {
      window.setTimeout(() => {
        const active = document.activeElement;
        if (
          !active?.closest('.address-wrap') &&
          !active?.closest('.address-suggestions') &&
          !active?.closest('.address-suggestions-portal')
        ) {
          document.body.classList.remove('keyboard-open');
          hide();
        }
      }, 200);
    });

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
        if (q.length > 0) {
          this.setAddressStatus(wrap, 'Escribe al menos 3 letras para buscar en Maps.');
        }
        return;
      }
      if (!this.configured) return;
      this.closeAllSuggestions(wrap);
      this.setAddressStatus(wrap, 'Buscando direcciones…');
      this._debounce = setTimeout(async () => {
        try {
          const r = await this.fetchApi(`/api/maps/autocomplete?input=${encodeURIComponent(q)}`);
          const j = await r.json();
          if (!j.ok) {
            hide();
            this.setAddressStatus(
              wrap,
              j.error || 'No se pudo consultar Maps. Revisa conexión a internet.'
            );
            return;
          }
          if (!j.data?.length) {
            hide();
            this.setAddressStatus(wrap, 'Sin resultados. Prueba calle, bodega o puerto.');
            return;
          }
          wrap.classList.add('address-suggestions-open');
          list.hidden = false;
          list.innerHTML = j.data
            .map(
              (p) =>
                `<li><button type="button" data-place-id="${p.place_id}">${p.description}</button></li>`
            )
            .join('');
          this.portalSuggestions(list, wrap);
          const inp = wrap.querySelector('.address-search');
          if (inp) this.positionPortalList(list, inp);
          this.setAddressStatus(wrap, 'Toca una sugerencia de la lista (no solo Enter).');
          this.scrollAddressIntoView(input);
        } catch {
          hide();
          this.setAddressStatus(
            wrap,
            'Sin conexión al servidor. En emulador: activa internet y reinstala la APK.'
          );
        }
      }, 280);
    });

    list.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const btn = e.target.closest('[data-place-id]');
      if (btn) pickPlace(btn);
    });
    list.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-place-id]');
      if (btn) pickPlace(btn);
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
    set('place_types', Array.isArray(place.types) ? place.types.join(',') : '');
    const search = form.querySelector(`[data-address="${role}"] .address-search`);
    if (search) search.dataset.mapsValidated = '1';
    this.updateGeoUi(form, role);
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
      box.textContent = `Distancia: ${j.distance_text} · Ruta: ${j.duration_text}`;
      if (typeof LoadTimingUI !== 'undefined') LoadTimingUI.recalc(form);
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
        form.querySelector('[name="volume_m3"]') && (form.querySelector('[name="volume_m3"]').dataset.userEdited = '');
        form.querySelector('[name="pallets"]') && (form.querySelector('[name="pallets"]').dataset.userEdited = '');
        form.querySelector('[name="truck_type_preference"]') &&
          (form.querySelector('[name="truck_type_preference"]').dataset.userEdited = '');
        form._recalcWeight?.();
        if (typeof LoadCapacityUI !== 'undefined') LoadCapacityUI.recalc(form);
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
