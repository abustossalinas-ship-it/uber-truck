/** Validación cliente del formulario publicar carga — lista qué falta y lleva al campo. */

const LoadFormValidation = {
  check(form) {
    const missing = [];

    const add = (label, el, section) => {
      missing.push({ label, el, section });
    };

    const originSearch = form.querySelector('[data-address="origin"] .address-search');
    const destSearch = form.querySelector('[data-address="destination"] .address-search');

    if (typeof MapsUI !== 'undefined' && MapsUI.configured) {
      if (originSearch?.value.trim() && originSearch.dataset.mapsValidated !== '1') {
        add('Origen: elige una dirección de la lista (no solo escribas el nombre)', originSearch, 'Origen');
      } else if (!MapsUI.isRoleValidated(form, 'origin')) {
        add('Origen: busca y selecciona dirección en Google Maps', originSearch || form, 'Origen');
      } else {
        const types = form.querySelector('[name="origin_place_types"]')?.value;
        if (types && typeof MapsUI.isSpecificPlace === 'function' && !MapsUI.isSpecificPlace(types)) {
          add('Origen: indica calle, bodega o planta (no solo ciudad/región)', originSearch, 'Origen');
        }
      }
      if (destSearch?.value.trim() && destSearch.dataset.mapsValidated !== '1') {
        add('Destino: elige una dirección de la lista (no solo escribas el nombre)', destSearch, 'Destino');
      } else if (!MapsUI.isRoleValidated(form, 'destination')) {
        add('Destino: busca y selecciona en Google Maps (ej. puerto, bodega destino)', destSearch || form, 'Destino');
      } else {
        const types = form.querySelector('[name="destination_place_types"]')?.value;
        if (types && typeof MapsUI.isSpecificPlace === 'function' && !MapsUI.isSpecificPlace(types)) {
          add('Destino: indica dirección concreta (puerto, bodega, no solo «Arica» o comuna)', destSearch, 'Destino');
        }
      }
    } else {
      if (!form.querySelector('[name="origin_city"]')?.value?.trim()) {
        add('Ciudad origen', form.querySelector('[name="origin_city"]'), 'Origen');
      }
      if (!form.querySelector('[name="destination_city"]')?.value?.trim()) {
        add('Ciudad destino', form.querySelector('[name="destination_city"]'), 'Destino');
      }
    }

    const company = form.querySelector('[name="company_name"]');
    if (!company?.value?.trim()) add('Empresa', company, 'Datos');

    const pallets = Number(form.querySelector('[name="pallets"]')?.value) || 0;
    const volume = Number(form.querySelector('[name="volume_m3"]')?.value) || 0;
    if (pallets <= 0 && volume <= 0) {
      add('Pallets o volumen (m³)', form.querySelector('[name="pallets"]'), 'Cubicación');
    }

    const desc = form.querySelector('[name="cargo_description"]');
    if (!desc?.value?.trim() || desc.value.trim().length < 8) {
      add('Descripción de mercadería (mín. 8 caracteres)', desc, 'Mercadería');
    }

    const val = form.querySelector('[name="declared_cargo_value_clp"]');
    if (!val?.value || Number(val.value) < 1000) {
      add('Valor referencial de la mercadería (CLP)', val, 'Mercadería');
    }

    if (!form.querySelector('[name="terms_cargo_accepted"]')?.checked) {
      add('Aceptar términos de confianza y carga', form.querySelector('#terms_cargo_accepted'), 'Legal');
    }

    const mode = form.querySelector('[name="schedule_mode"]:checked')?.value || 'now';
    if (mode === 'scheduled' && !form.querySelector('[name="scheduled_pickup_at"]')?.value) {
      add('Fecha y hora de retiro programado', form.querySelector('[name="scheduled_pickup_at"]'), 'Horario');
    }

    return missing;
  },

  show(missing) {
    const box = document.getElementById('load-form-errors');
    if (!box) {
      alert('Completa el formulario:\n\n• ' + missing.map((m) => m.label).join('\n• '));
      if (missing[0]?.el) this.scrollTo(missing[0].el);
      return;
    }
    box.hidden = false;
    box.innerHTML =
      '<p><strong>Falta completar:</strong></p><ul>' +
      missing.map((m) => `<li><button type="button" class="link-btn load-form-goto" data-goto-field>${m.label}</button></li>`).join('') +
      '</ul>';
    box.querySelectorAll('[data-goto-field]').forEach((btn, i) => {
      btn.addEventListener('click', () => this.scrollTo(missing[i].el));
    });
    this.scrollTo(missing[0].el);
  },

  scrollTo(el) {
    if (!el) return;
    const fieldset = el.closest('.maps-gated-section');
    if (fieldset?.disabled) {
      const hint = document.querySelector('#form-load .maps-gate-hint');
      hint?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (el.focus) {
      try {
        el.focus({ preventScroll: true });
      } catch {
        el.focus();
      }
    }
    el.classList.add('field-missing-flash');
    setTimeout(() => el.classList.remove('field-missing-flash'), 2200);
  },

  clear() {
    const box = document.getElementById('load-form-errors');
    if (box) {
      box.hidden = true;
      box.innerHTML = '';
    }
  },
};
