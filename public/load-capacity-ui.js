/** Pallets ↔ volumen, sugerencia de camión y aviso multi-viaje. */

const LoadCapacityUI = {
  STANDARD_PALLET_M3: 1.2,

  TRUCK_TYPES: [
    { id: 'truck_34', label: 'Camión 3/4 (2 ejes)', europallet_max: 8, american_max: 6 },
    { id: 'truck_5t', label: 'Camión 5 ton', europallet_max: 12, american_max: 10 },
    { id: 'truck_8t', label: 'Camión 8 ton', europallet_max: 18, american_max: 14 },
    { id: 'torton', label: 'Tortón (3 ejes)', europallet_max: 20, american_max: 16 },
    { id: 'trailer', label: 'Tráiler 13,6 m', europallet_max: 33, american_max: 26 },
  ],

  capKey(palletType) {
    return palletType === 'american' ? 'american_max' : 'europallet_max';
  },

  capacityForTruck(truck, palletType, stackable) {
    const base = truck[this.capKey(palletType)] || truck.europallet_max;
    return stackable ? base * 2 : base;
  },

  suggest(form) {
    const pallets = Number(form.querySelector('[name="pallets"]')?.value) || 0;
    const palletType = form.querySelector('[name="pallet_type"]')?.value || 'euro';
    const stackable = form.querySelector('[name="cargo_stackable"]')?.checked || false;
    const weight = Number(form.querySelector('[name="weight_kg"]')?.value) || 0;

    if (pallets <= 0) {
      return { truck: null, trips_required: 0, capacity_per_trip: 0, exceeds_single: false, message: '' };
    }

    let suggested = null;
    let cap = 0;
    for (const t of this.TRUCK_TYPES) {
      cap = this.capacityForTruck(t, palletType, stackable);
      if (pallets <= cap) {
        suggested = t;
        break;
      }
    }

    if (suggested) {
      return {
        truck: suggested,
        trips_required: 1,
        capacity_per_trip: cap,
        exceeds_single: false,
        pallets,
        message: `Camión sugerido: ${suggested.label} (hasta ${cap} pallets${stackable ? ', remontable' : ''}).`,
      };
    }

    const biggest = this.TRUCK_TYPES[this.TRUCK_TYPES.length - 1];
    cap = this.capacityForTruck(biggest, palletType, stackable);
    const trips = Math.ceil(pallets / cap);
    return {
      truck: biggest,
      trips_required: trips,
      capacity_per_trip: cap,
      exceeds_single: true,
      pallets,
      message: `Supera un ${biggest.label} (~${cap} pallets/viaje). Necesitas ~${trips} viajes.`,
    };
  },

  applySuggestion(form, result) {
    const hint = form.querySelector('[data-load-capacity-hint]');
    const select = form.querySelector('[name="truck_type_preference"]');
    if (select && result.truck) {
      if (select.dataset.userEdited !== '1') select.value = result.truck.id;
    }
    if (hint) {
      if (!result.message) {
        hint.hidden = true;
        hint.textContent = '';
        hint.classList.remove('load-capacity-warn');
        return;
      }
      hint.hidden = false;
      hint.textContent = result.message;
      hint.classList.toggle('load-capacity-warn', result.exceeds_single);
    }
  },

  syncVolumeFromPallets(form) {
    const pallets = form.querySelector('[name="pallets"]');
    const volume = form.querySelector('[name="volume_m3"]');
    if (!pallets || !volume || volume.dataset.userEdited === '1') return;
    const p = Number(pallets.value) || 0;
    if (p <= 0) return;
    volume.value = Math.round(p * this.STANDARD_PALLET_M3 * 10) / 10;
  },

  syncPalletsFromVolume(form) {
    const pallets = form.querySelector('[name="pallets"]');
    const volume = form.querySelector('[name="volume_m3"]');
    if (!pallets || !volume || pallets.dataset.userEdited === '1') return;
    const v = Number(volume.value) || 0;
    if (v <= 0) return;
    pallets.value = Math.max(1, Math.ceil(v / this.STANDARD_PALLET_M3));
  },

  recalc(form) {
    if (!form || form.id !== 'form-load') return;
    const result = this.suggest(form);
    this.applySuggestion(form, result);
    form._capacityResult = result;
    if (typeof LoadTimingUI !== 'undefined') LoadTimingUI.recalc(form);
    form._recalcWeight?.();
  },

  getPayload(form) {
    const result = form._capacityResult || this.suggest(form);
    const truckId = form.querySelector('[name="truck_type_preference"]')?.value;
    const truck =
      this.TRUCK_TYPES.find((t) => t.id === truckId) || result.truck;
    return {
      truck_type_preference: truck?.id || null,
      truck_type_label: truck?.label || null,
      pallet_type: form.querySelector('[name="pallet_type"]')?.value || 'euro',
      cargo_stackable: form.querySelector('[name="cargo_stackable"]')?.checked || false,
      trips_required: result.trips_required || 1,
      pallets: result.pallets || Number(form.querySelector('[name="pallets"]')?.value) || null,
      message: result.message || '',
    };
  },

  populateTruckSelect(form) {
    const sel = form.querySelector('[name="truck_type_preference"]');
    if (!sel || sel.options.length > 1) return;
    sel.innerHTML =
      '<option value="">Sugerido automáticamente…</option>' +
      this.TRUCK_TYPES.map((t) => `<option value="${t.id}">${t.label}</option>`).join('');
  },

  bind(form) {
    if (!form || form.id !== 'form-load') return;
    this.populateTruckSelect(form);

    const pallets = form.querySelector('[name="pallets"]');
    const volume = form.querySelector('[name="volume_m3"]');
    const truckSel = form.querySelector('[name="truck_type_preference"]');

    pallets?.addEventListener('input', () => {
      pallets.dataset.userEdited = '1';
      this.syncVolumeFromPallets(form);
      this.recalc(form);
    });
    volume?.addEventListener('input', () => {
      volume.dataset.userEdited = '1';
      this.syncPalletsFromVolume(form);
      this.recalc(form);
    });
    truckSel?.addEventListener('change', () => {
      truckSel.dataset.userEdited = '1';
    });

    ['pallet_type', 'cargo_stackable', 'weight_kg'].forEach((name) => {
      const el = form.querySelector(`[name="${name}"]`);
      el?.addEventListener('change', () => this.recalc(form));
      el?.addEventListener('input', () => this.recalc(form));
    });

    this.recalc(form);
  },
};

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-load');
  if (form) LoadCapacityUI.bind(form);
});
