/** Entrega y cierre de viaje — drawer tipo Uber Eats (sin prompt/alert nativos) */

const DeliveryCloseUI = {
  mode: null,
  step: 'confirm',
  matchId: null,
  triggerBtn: null,
  onDone: null,

  CONFIG: {
    mark_delivered: {
      title: 'Entregar en destino',
      confirmLead: '¿Confirmas que dejaste la carga en destino?',
      confirmDetail:
        'Avisaremos al embarcador. Debe confirmar la recepción para cerrar el viaje.',
      noteLabel: 'Nota de entrega (opcional)',
      notePlaceholder: 'Ej. hora, receptor, bodega…',
      noteDefault: 'Entregado en bodega destino',
      submitLabel: 'Registrar entrega',
    },
    confirm_receipt: {
      title: 'Confirmar recepción',
      confirmLead: '¿Recibiste la mercadería conforme?',
      confirmDetail:
        'El viaje se cerrará y ambos podrán calificar. Solo confirma si ya tienes la carga en tus manos.',
      noteLabel: 'Observación de recepción (opcional)',
      notePlaceholder: 'Ej. conforme, faltante, daño menor…',
      noteDefault: 'Mercadería recibida conforme',
      submitLabel: 'Confirmar y cerrar viaje',
    },
  },

  open(mode, matchId, triggerBtn, onDone) {
    if (!this.CONFIG[mode]) return;
    this.mode = mode;
    this.step = 'confirm';
    this.matchId = matchId;
    this.triggerBtn = triggerBtn || null;
    this.onDone = typeof onDone === 'function' ? onDone : null;
    const drawer = document.getElementById('delivery-close-drawer');
    if (!drawer) return;
    drawer.hidden = false;
    drawer.setAttribute('aria-hidden', 'false');
    this.render();
  },

  close() {
    const drawer = document.getElementById('delivery-close-drawer');
    if (drawer) {
      drawer.hidden = true;
      drawer.setAttribute('aria-hidden', 'true');
    }
    this.mode = null;
    this.step = 'confirm';
    this.matchId = null;
    this.triggerBtn = null;
    this.onDone = null;
  },

  cfg() {
    return this.CONFIG[this.mode] || {};
  },

  render() {
    const c = this.cfg();
    const title = document.getElementById('delivery-close-title');
    const ctx = document.getElementById('delivery-close-context');
    const body = document.getElementById('delivery-close-body');
    const form = document.getElementById('form-delivery-close');
    const back = document.getElementById('delivery-close-back');
    const noteLabel = document.getElementById('delivery-close-note-label');
    const note = document.getElementById('delivery-close-note');
    const submit = document.getElementById('delivery-close-submit');
    if (!body) return;

    if (title) title.textContent = c.title || 'Viaje';
    if (ctx) {
      ctx.innerHTML = `<strong>Emparejamiento activo</strong><span class="muted">Paso ${this.step === 'confirm' ? '1' : this.step === 'note' ? '2' : '3'} de 3</span>`;
    }
    if (back) {
      back.hidden = this.step !== 'note';
      back.setAttribute('aria-hidden', this.step !== 'note' ? 'true' : 'false');
    }
    if (form) form.hidden = this.step !== 'note';
    if (noteLabel) noteLabel.textContent = c.noteLabel || 'Nota (opcional)';
    if (note && this.step === 'note') note.value = c.noteDefault || '';
    if (submit) submit.textContent = c.submitLabel || 'Confirmar';

    if (this.step === 'confirm') {
      body.innerHTML = `
        <div class="help-bot-bubble">
          <span class="help-bot-tag">Cubik</span>
          <p><strong>${c.confirmLead}</strong></p>
          <p class="muted">${c.confirmDetail}</p>
        </div>
        <div class="delivery-close-actions">
          <button type="button" class="btn-match-cta" id="delivery-close-yes">Sí, continuar</button>
          <button type="button" class="link-btn delivery-close-back-link" id="delivery-close-no">Volver</button>
        </div>`;
      document.getElementById('delivery-close-yes')?.addEventListener(
        'click',
        () => {
          this.step = 'note';
          this.render();
        },
        { once: true }
      );
      document.getElementById('delivery-close-no')?.addEventListener('click', () => this.close(), {
        once: true,
      });
      return;
    }

    if (this.step === 'note') {
      body.innerHTML = `
        <div class="help-bot-bubble">
          <span class="help-bot-tag">Cubik</span>
          <p>Puedes dejar una nota para la otra parte. Si no aplica, deja el texto sugerido o bórralo.</p>
        </div>`;
      return;
    }

    if (this.step === 'done') {
      body.innerHTML = `
        <div class="help-bot-bubble help-bot-ok">
          <span class="help-bot-tag">Cubik</span>
          <p id="delivery-close-done-msg"></p>
        </div>
        <button type="button" class="btn-match-cta help-done-btn" id="delivery-close-done-btn">Listo</button>`;
      document.getElementById('delivery-close-done-btn')?.addEventListener(
        'click',
        () => {
          const cb = this.onDone;
          this.close();
          if (cb) cb();
        },
        { once: true }
      );
    }
  },

  showDone(message) {
    this.step = 'done';
    const form = document.getElementById('form-delivery-close');
    if (form) form.hidden = true;
    this.render();
    const msg = document.getElementById('delivery-close-done-msg');
    if (msg) msg.textContent = message || 'Listo.';
  },

  showError(message) {
    const body = document.getElementById('delivery-close-body');
    if (!body) return;
    const err = document.createElement('p');
    err.className = 'field-error auth-error';
    err.setAttribute('role', 'alert');
    err.textContent = message;
    body.prepend(err);
  },

  async submitNote(rawNote) {
    if (!this.matchId || !this.mode) return;
    const note = (rawNote || '').trim();
    const btn = document.getElementById('delivery-close-submit');
    if (btn) btn.disabled = true;
    if (typeof beginMatchAction === 'function' && this.triggerBtn) {
      if (!beginMatchAction(this.triggerBtn)) {
        if (btn) btn.disabled = false;
        return;
      }
    }
    try {
      let res;
      let json;
      if (this.mode === 'mark_delivered') {
        res = await API.patchMatch(this.matchId, {
          action: 'mark_delivered',
          delivery_note: note || undefined,
        });
        json = await res.json();
      } else {
        res = await API.patchMatch(this.matchId, {
          status: 'completed',
          delivery_note: note || undefined,
        });
        json = await res.json();
      }
      if (!res.ok) {
        this.showError(json.error || 'No se pudo completar. Intenta de nuevo.');
        return;
      }
      const doneMsg =
        json.message ||
        (this.mode === 'mark_delivered'
          ? 'Entrega registrada. El embarcador debe confirmar recepción para cerrar el viaje.'
          : 'Viaje cerrado. Puedes calificar a la otra parte.');
      const promptRating = json.prompt_rating;
      const matchId = this.matchId;
      this.showDone(doneMsg);
      this.onDone = async () => {
        if (typeof refreshBoard === 'function') await refreshBoard();
        if (promptRating && typeof openRateModal === 'function') {
          openRateModal(matchId);
        }
      };
    } finally {
      if (typeof endMatchAction === 'function' && this.triggerBtn) {
        endMatchAction(this.triggerBtn);
      }
      if (btn) btn.disabled = false;
    }
  },
};

document.getElementById('delivery-close-cancel')?.addEventListener('click', () => DeliveryCloseUI.close());
document.getElementById('delivery-close-back')?.addEventListener('click', () => {
  if (DeliveryCloseUI.step === 'note') {
    DeliveryCloseUI.step = 'confirm';
    DeliveryCloseUI.render();
  } else {
    DeliveryCloseUI.close();
  }
});
document.getElementById('form-delivery-close')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const note = document.getElementById('delivery-close-note')?.value;
  DeliveryCloseUI.submitNote(note);
});

window.DeliveryCloseUI = DeliveryCloseUI;
