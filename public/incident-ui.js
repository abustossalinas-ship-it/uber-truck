/** Ayuda / incidentes en viaje — flujo tipo Uber Eats */

const IncidentUI = {
  matchId: null,
  matchTitle: '',
  selectedType: null,
  step: 'triage',

  OPTIONS: [
    {
      code: 'theft',
      label: 'Robo o extravío de carga',
      hint: 'Mercadería robada, asaltada o no localizada.',
    },
    {
      code: 'damage',
      label: 'Daño a la mercadería',
      hint: 'Producto dañado durante carga, tránsito o descarga.',
    },
    {
      code: 'shortage',
      label: 'Faltante en la entrega',
      hint: 'Llegó menos cantidad o bultos de los acordados.',
    },
    {
      code: 'delay',
      label: 'Atraso grave',
      hint: 'Riesgo de incumplir ventana de entrega acordada.',
    },
    {
      code: 'other',
      label: 'Otro problema en el viaje',
      hint: 'Accidente, avería, documentación u otro inconveniente.',
    },
  ],

  headers() {
    return typeof apiHeaders === 'function' ? apiHeaders() : { 'Content-Type': 'application/json' };
  },

  open(matchId, title) {
    this.matchId = matchId;
    this.matchTitle = title || 'Viaje en curso';
    this.selectedType = null;
    this.step = 'triage';
    const drawer = document.getElementById('incident-drawer');
    if (!drawer) return;
    drawer.hidden = false;
    drawer.setAttribute('aria-hidden', 'false');
    this.render();
  },

  close() {
    const drawer = document.getElementById('incident-drawer');
    if (drawer) {
      drawer.hidden = true;
      drawer.setAttribute('aria-hidden', 'true');
    }
    this.matchId = null;
    this.selectedType = null;
    this.step = 'triage';
  },

  render() {
    const ctx = document.getElementById('incident-trip-context');
    const body = document.getElementById('incident-body');
    const form = document.getElementById('form-incident');
    if (!body) return;
    if (ctx) {
      ctx.innerHTML = `<strong>${this.matchTitle}</strong><span class="muted">Emparejamiento activo</span>`;
    }
    if (form) form.hidden = this.step !== 'detail';
    if (this.step === 'triage') {
      body.innerHTML = `
        <div class="help-bot-bubble">
          <span class="help-bot-tag">Cubik</span>
          <p>Hola${typeof Auth !== 'undefined' && Auth.user?.full_name ? `, ${Auth.user.full_name.split(' ')[0]}` : ''}: estoy aquí para ayudarte con este viaje. ¿Qué ocurrió?</p>
        </div>
        <div class="help-option-list">
          ${this.OPTIONS.map(
            (o) =>
              `<button type="button" class="help-option-btn" data-incident-type="${o.code}">
            <span class="help-option-label">${o.label}</span>
            <span class="help-option-hint">${o.hint}</span>
          </button>`
          ).join('')}
        </div>
        <p class="muted help-footnote">Un agente Cubik puede revisar el caso. También recibirás confirmación por notificación.</p>`;
      return;
    }
    if (this.step === 'detail') {
      const opt = this.OPTIONS.find((o) => o.code === this.selectedType);
      body.innerHTML = `
        <div class="help-bot-bubble">
          <span class="help-bot-tag">Cubik</span>
          <p>Cuéntanos qué pasó con <strong>${opt?.label || 'este incidente'}</strong>. Mínimo 10 caracteres.</p>
        </div>`;
      const ta = document.getElementById('incident-description');
      if (ta) {
        ta.value = '';
        ta.placeholder = opt?.hint || 'Describe lo ocurrido con el mayor detalle posible…';
      }
      return;
    }
    if (this.step === 'done') {
      body.innerHTML = `
        <div class="help-bot-bubble help-bot-ok">
          <span class="help-bot-tag">Cubik</span>
          <p>Registramos tu reporte. Conservamos el antecedente y la otra parte fue notificada. Si necesitas seguimiento humano, revisa la campana o la sección Ayuda en Cuenta.</p>
        </div>
        <button type="button" class="btn-match-cta help-done-btn" id="incident-done-close">Listo</button>`;
      document.getElementById('incident-done-close')?.addEventListener('click', () => this.close(), {
        once: true,
      });
    }
  },

  pickType(code) {
    this.selectedType = code;
    this.step = 'detail';
    this.render();
  },

  async submit(description) {
    if (!this.matchId || !this.selectedType) return;
    const text = (description || '').trim();
    if (text.length < 10) {
      alert('Describe el incidente con al menos 10 caracteres.');
      return;
    }
    const btn = document.querySelector('#form-incident button[type="submit"]');
    if (btn) btn.disabled = true;
    try {
      const json = await API.postIncident(this.matchId, {
        incident_type: this.selectedType,
        description: text,
      });
      if (!json.ok) {
        alert(json.error || json.errors?.join('\n') || 'No se pudo registrar');
        return;
      }
      const opt = this.OPTIONS.find((o) => o.code === this.selectedType);
      if (typeof SupportUI !== 'undefined') {
        try {
          await fetch('/api/support/cases', {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify({
              match_id: this.matchId,
              subject: `Incidente — ${opt?.label || this.selectedType}`,
              message: text,
            }),
          });
        } catch (_) {}
      }
      if (typeof Comms !== 'undefined') await Comms.refreshBell();
      this.step = 'done';
      this.render();
    } finally {
      if (btn) btn.disabled = false;
    }
  },
};

document.getElementById('incident-close')?.addEventListener('click', () => IncidentUI.close());
document.getElementById('incident-back')?.addEventListener('click', () => {
  if (IncidentUI.step === 'detail') {
    IncidentUI.step = 'triage';
    IncidentUI.selectedType = null;
    IncidentUI.render();
  } else {
    IncidentUI.close();
  }
});
document.getElementById('incident-body')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-incident-type]');
  if (btn) IncidentUI.pickType(btn.dataset.incidentType);
});
document.getElementById('form-incident')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = document.getElementById('incident-description')?.value;
  IncidentUI.submit(text);
});

window.IncidentUI = IncidentUI;
