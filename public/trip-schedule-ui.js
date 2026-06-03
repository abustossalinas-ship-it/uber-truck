/** Programar viaje — estilo Uber: Ahora vs Programar (carga y oferta) */

const TripScheduleUI = {
  MIN_AHEAD_MIN: 30,
  MAX_AHEAD_DAYS: 90,

  bind(form) {
    if (!form) return;
    const kind = form.id === 'form-offer' ? 'offer' : 'load';
    const root = form.querySelector('[data-trip-schedule]');
    if (!root) return;

    const radios = root.querySelectorAll('[name="schedule_mode"]');
    const pickupPanel = root.querySelector('[data-schedule-panel="scheduled"]');
    const pickupInput =
      kind === 'load'
        ? root.querySelector('[name="scheduled_pickup_at"]')
        : root.querySelector('[name="scheduled_depart_at"]');

    const sync = () => {
      const mode = root.querySelector('[name="schedule_mode"]:checked')?.value || 'now';
      const scheduled = mode === 'scheduled';
      if (pickupPanel) pickupPanel.hidden = !scheduled;
      if (pickupInput) pickupInput.required = scheduled;
      root.classList.toggle('trip-schedule--scheduled', scheduled);
    };

    radios.forEach((r) => r.addEventListener('change', sync));
    sync();

    if (pickupInput) {
      this.setDatetimeMin(pickupInput);
      pickupInput.addEventListener('focus', () => this.setDatetimeMin(pickupInput));
    }
  },

  setDatetimeMin(input) {
    const min = new Date(Date.now() + this.MIN_AHEAD_MIN * 60 * 1000);
    const max = new Date(Date.now() + this.MAX_AHEAD_DAYS * 24 * 60 * 60 * 1000);
    input.min = this.toDatetimeLocalValue(min);
    input.max = this.toDatetimeLocalValue(max);
  },

  toDatetimeLocalValue(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  },

  getPayload(form) {
    const root = form?.querySelector('[data-trip-schedule]');
    if (!root) return {};
    const mode = root.querySelector('[name="schedule_mode"]:checked')?.value || 'now';
    const out = { schedule_mode: mode };
    if (form.id === 'form-load') {
      const pickup = root.querySelector('[name="scheduled_pickup_at"]')?.value;
      if (mode === 'scheduled' && pickup) {
        out.scheduled_pickup_at = pickup;
        out.cargo_ready_at = pickup;
      }
    } else if (form.id === 'form-offer') {
      const depart = root.querySelector('[name="scheduled_depart_at"]')?.value;
      if (mode === 'scheduled' && depart) out.scheduled_depart_at = depart;
    }
    return out;
  },
};

function formatTripScheduleHtml(row, kind = 'load') {
  if (!row) return '';
  const mode = row.schedule_mode || 'now';
  const at =
    kind === 'offer' ? row.scheduled_depart_at : row.scheduled_pickup_at || row.cargo_ready_at;
  const etaDest =
    kind === 'load' && row.needed_by_at && row.status === 'in_transit'
      ? row.needed_by_at
      : null;

  if (mode === 'scheduled' && at) {
    const when =
      typeof formatDateTime === 'function' ? formatDateTime(at) : new Date(at).toLocaleString('es-CL');
    const label = kind === 'offer' ? 'Salida programada' : 'Retiro programado';
    let html = `<p class="trip-schedule-line"><span class="pill pill-scheduled">Programado</span> ${label}: <strong>${when}</strong>`;
    if (etaDest) {
      const eta =
        typeof formatDateTime === 'function' ? formatDateTime(etaDest) : new Date(etaDest).toLocaleString('es-CL');
      html += ` · ETA destino (en ruta): <strong>${eta}</strong>`;
    }
    html += '</p>';
    return html;
  }
  if (mode === 'now') {
    const txt = kind === 'offer' ? 'Disponible ya' : 'Retiro lo antes posible';
    if (etaDest) {
      const eta =
        typeof formatDateTime === 'function' ? formatDateTime(etaDest) : new Date(etaDest).toLocaleString('es-CL');
      return `<p class="muted trip-schedule-line">${txt} · ETA destino (en ruta): <strong>${eta}</strong></p>`;
    }
    return `<p class="muted trip-schedule-line">${txt}</p>`;
  }
  return '';
}

document.addEventListener('DOMContentLoaded', () => {
  TripScheduleUI.bind(document.getElementById('form-load'));
  TripScheduleUI.bind(document.getElementById('form-offer'));
});
