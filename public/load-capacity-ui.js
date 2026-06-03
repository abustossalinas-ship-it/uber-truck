/** Pallets ↔ volumen, sugerencia de camión y aviso multi-viaje. */

const LoadCapacityUI = {
  STANDARD_PALLET_M3: 1.2,

  TRUCK_TYPES: [
    { id: 'truck_34', label: 'Camión 3/4 (2 ejes)', europallet_max: 8, american_max: 6, weight_kg_max: 3500 },
    { id: 'truck_5t', label: 'Camión 5 ton', europallet_max: 12, american_max: 10, weight_kg_max: 5000 },
    { id: 'truck_8t', label: 'Camión 8 ton', europallet_max: 18, american_max: 14, weight_kg_max: 8000 },
    { id: 'torton', label: 'Tortón (3 ejes)', europallet_max: 20, american_max: 16, weight_kg_max: 15000 },
    { id: 'trailer', label: 'Tráiler 13,6 m', europallet_max: 33, american_max: 26, weight_kg_max: 24000 },
  ],

  truckById(id) {
    return this.TRUCK_TYPES.find((t) => t.id === id) || null;
  },

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

  populateTruckSelect(form, fieldName = 'truck_type_preference', emptyLabel = 'Sugerido automáticamente…') {
    const sel = form.querySelector(`[name="${fieldName}"]`);
    if (!sel || sel.options.length > 1) return;
    sel.innerHTML =
      `<option value="">${emptyLabel}</option>` +
      this.TRUCK_TYPES.map((t) => `<option value="${t.id}">${t.label}</option>`).join('');
  },

  /** Oferta: valida pallets vs el camión que el transportista declara. */
  validateOfferCapacity(form) {
    const truckId = form.querySelector('[name="truck_type_id"]')?.value;
    const truck = this.truckById(truckId);
    const pallets = Number(form.querySelector('[name="available_pallets"]')?.value) || 0;
    const palletType = form.querySelector('[name="pallet_type"]')?.value || 'euro';
    const stackable = form.querySelector('[name="cargo_stackable"]')?.checked || false;
    const weight = Number(form.querySelector('[name="max_weight_kg"]')?.value) || 0;

    if (!truck) {
      return {
        truck: null,
        capacity_pallets: 0,
        exceeds: false,
        weight_exceeds: false,
        message: 'Elige el tipo de camión con el que harás el viaje.',
      };
    }

    const cap = this.capacityForTruck(truck, palletType, stackable);
    if (pallets <= 0) {
      return {
        truck,
        capacity_pallets: cap,
        exceeds: false,
        weight_exceeds: false,
        message: `Tu ${truck.label} admite hasta ${cap} pallets${stackable ? ' (remontable)' : ''} (~${Math.round(cap * this.STANDARD_PALLET_M3 * 10) / 10} m³).`,
      };
    }

    const exceeds = pallets > cap;
    const weightExceeds = weight > 0 && weight > truck.weight_kg_max;
    let message = `${truck.label}: máximo ${cap} pallets${stackable ? ' remontables' : ''} · ofreces ${pallets} (~${Math.round(pallets * this.STANDARD_PALLET_M3 * 10) / 10} m³).`;
    if (exceeds) {
      message = `Supera tu ${truck.label}: máximo ${cap} pallets${stackable ? ' remontables' : ''}. Reduce pallets o elige otro camión en tu perfil.`;
    } else if (weightExceeds) {
      message = `El peso supera ~${truck.weight_kg_max.toLocaleString('es-CL')} kg de tu ${truck.label}. Ajusta peso máx.`;
    }

    return {
      truck,
      capacity_pallets: cap,
      exceeds,
      weight_exceeds: weightExceeds,
      pallets,
      message,
    };
  },

  applyOfferHint(form, result) {
    const hint = form.querySelector('[data-offer-capacity-hint]');
    const capLine = form.querySelector('[data-offer-truck-capacity]');
    if (capLine && result.truck) {
      capLine.hidden = false;
      capLine.textContent = `Capacidad del camión: hasta ${result.capacity_pallets} pallets (${result.truck.label}).`;
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
      hint.classList.toggle('load-capacity-warn', result.exceeds || result.weight_exceeds);
    }
  },

  syncOfferVolumeFromPallets(form) {
    const pallets = form.querySelector('[name="available_pallets"]');
    const volume = form.querySelector('[name="free_volume_m3"]');
    if (!pallets || !volume || volume.dataset.userEdited === '1') return;
    const p = Number(pallets.value) || 0;
    if (p <= 0) return;
    volume.value = Math.round(p * this.STANDARD_PALLET_M3 * 10) / 10;
  },

  syncOfferWeightFromTruck(form) {
    const truckId = form.querySelector('[name="truck_type_id"]')?.value;
    const truck = this.truckById(truckId);
    const weight = form.querySelector('[name="max_weight_kg"]');
    if (!truck || !weight || weight.dataset.userEdited === '1') return;
    weight.value = truck.weight_kg_max;
  },

  recalcOffer(form) {
    if (!form || form.id !== 'form-offer') return;
    const result = this.validateOfferCapacity(form);
    this.applyOfferHint(form, result);
    form._offerCapacityResult = result;
    this.syncOfferVolumeFromPallets(form);
    this.syncOfferWeightFromTruck(form);
  },

  getOfferPayload(form) {
    const result = form._offerCapacityResult || this.validateOfferCapacity(form);
    const truck = result.truck || this.truckById(form.querySelector('[name="truck_type_id"]')?.value);
    return {
      truck_type_id: truck?.id || null,
      truck_type_label: truck?.label || null,
      available_pallets: result.pallets || Number(form.querySelector('[name="available_pallets"]')?.value) || null,
      pallet_type: form.querySelector('[name="pallet_type"]')?.value || 'euro',
      cargo_stackable: form.querySelector('[name="cargo_stackable"]')?.checked || false,
      free_volume_m3: Number(form.querySelector('[name="free_volume_m3"]')?.value) || null,
      max_weight_kg: Number(form.querySelector('[name="max_weight_kg"]')?.value) || null,
    };
  },

  prefillOfferTruck(form, truckId) {
    if (!form || !truckId) return;
    const sel = form.querySelector('[name="truck_type_id"]');
    if (sel && !sel.value) sel.value = truckId;
    this.recalcOffer(form);
  },

  bindOffer(form) {
    if (!form || form.id !== 'form-offer') return;
    this.populateTruckSelect(form, 'truck_type_id', 'Elige tu camión…');

    const userTruck =
      typeof Auth !== 'undefined' && Auth.user?.default_truck_type_id
        ? Auth.user.default_truck_type_id
        : null;
    if (userTruck) this.prefillOfferTruck(form, userTruck);

    const pallets = form.querySelector('[name="available_pallets"]');
    const volume = form.querySelector('[name="free_volume_m3"]');
    const truckSel = form.querySelector('[name="truck_type_id"]');
    const weight = form.querySelector('[name="max_weight_kg"]');

    truckSel?.addEventListener('change', () => {
      truckSel.dataset.userEdited = '1';
      this.recalcOffer(form);
    });
    pallets?.addEventListener('input', () => {
      pallets.dataset.userEdited = '1';
      this.syncOfferVolumeFromPallets(form);
      this.recalcOffer(form);
    });
    volume?.addEventListener('input', () => {
      volume.dataset.userEdited = '1';
      this.recalcOffer(form);
    });
    weight?.addEventListener('input', () => {
      weight.dataset.userEdited = '1';
      this.recalcOffer(form);
    });
    ['pallet_type', 'cargo_stackable'].forEach((name) => {
      const el = form.querySelector(`[name="${name}"]`);
      el?.addEventListener('change', () => this.recalcOffer(form));
    });

    this.recalcOffer(form);
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

function initCarrierTruckProfile() {
  const sel = document.getElementById('carrier-default-truck');
  const user = typeof Auth !== 'undefined' ? Auth.user : null;
  if (!sel || !user || user.role !== 'carrier') return;
  if (sel.options.length <= 1) {
    sel.innerHTML =
      '<option value="">Elige tu camión…</option>' +
      LoadCapacityUI.TRUCK_TYPES.map((t) => `<option value="${t.id}">${t.label}</option>`).join('');
  }
  sel.value = user.default_truck_type_id || '';
}

async function saveCarrierDefaultTruck() {
  const sel = document.getElementById('carrier-default-truck');
  const status = document.getElementById('carrier-truck-save-status');
  if (!sel || typeof Auth === 'undefined' || !Auth.user || Auth.user.role !== 'carrier') return;
  const truckId = sel.value;
  if (!truckId) {
    alert('Elige el tipo de camión que sueles usar.');
    return;
  }
  const btn = document.getElementById('btn-save-carrier-truck');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Guardando…';
  }
  try {
    const res = await apiFetch('/api/auth/me', {
      method: 'PATCH',
      headers: Auth.headers(),
      body: JSON.stringify({ default_truck_type_id: truckId }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error || 'No se pudo guardar el camión');
      return;
    }
    if (json.user) Auth.save(Auth.token, json.user);
    const offerForm = document.getElementById('form-offer');
    if (offerForm && typeof LoadCapacityUI !== 'undefined') {
      LoadCapacityUI.prefillOfferTruck(offerForm, truckId);
    }
    if (status) {
      const label = LoadCapacityUI.truckById(truckId)?.label || 'Camión';
      status.hidden = false;
      status.textContent = `Guardado: ${label}. Se usará al ofertar ruta.`;
    }
  } catch (e) {
    console.error(e);
    alert('No se pudo conectar para guardar el camión.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Guardar camión';
    }
  }
}

window.initCarrierTruckProfile = initCarrierTruckProfile;

document.getElementById('btn-save-carrier-truck')?.addEventListener('click', saveCarrierDefaultTruck);

document.addEventListener('DOMContentLoaded', () => {
  const loadForm = document.getElementById('form-load');
  if (loadForm) LoadCapacityUI.bind(loadForm);
  const offerForm = document.getElementById('form-offer');
  if (offerForm) LoadCapacityUI.bindOffer(offerForm);
  initCarrierTruckProfile();
});
