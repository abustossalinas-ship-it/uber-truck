/** Pago piloto Cubik Saldo — drawer simulación carga y débito */

const PilotPayUI = {
  matchId: null,
  meta: null,
  step: 'confirm',

  formatClp(n) {
    return `$${Number(n || 0).toLocaleString('es-CL')}`;
  },

  open(matchId, meta) {
    this.matchId = matchId;
    this.meta = meta || {};
    this.step = 'confirm';
    const drawer = document.getElementById('pilot-pay-drawer');
    if (!drawer) return;
    drawer.hidden = false;
    drawer.setAttribute('aria-hidden', 'false');
    this.render();
  },

  close() {
    const drawer = document.getElementById('pilot-pay-drawer');
    if (drawer) {
      drawer.hidden = true;
      drawer.setAttribute('aria-hidden', 'true');
    }
    this.matchId = null;
    this.meta = null;
    this.step = 'confirm';
  },

  render() {
    const body = document.getElementById('pilot-pay-body');
    const title = document.getElementById('pilot-pay-title');
    const ctx = document.getElementById('pilot-pay-context');
    const actions = document.getElementById('pilot-pay-actions');
    if (!body) return;

    const m = this.meta;
    const feePct = Math.round((m.fee_rate || 0.1) * 100);
    const pair = m.pair || 'Viaje completado';
    const total = m.total_clp || 0;

    if (title) title.textContent = 'Pagar con Cubik Saldo';
    if (ctx) ctx.innerHTML = `<strong>${pair}</strong>`;

    if (this.step === 'processing') {
      body.innerHTML = `
        <div class="pilot-pay-processing">
          <p class="pilot-pay-spinner" aria-hidden="true"></p>
          <p><strong>Procesando pago simulado…</strong></p>
          <p class="muted">Cargando saldo y debitando ${this.formatClp(total)} CLP</p>
        </div>`;
      if (actions) actions.hidden = true;
      return;
    }

    if (this.step === 'done') {
      body.innerHTML = `
        <div class="help-bot-bubble pilot-pay-done">
          <span class="help-bot-tag">Cubik</span>
          <p><strong>Pago registrado</strong></p>
          <p class="muted">Debitamos ${this.formatClp(total)} de tu Cubik Saldo (simulación). El transportista verá el pago en gestión.</p>
        </div>`;
      if (actions) {
        actions.hidden = false;
        actions.innerHTML =
          '<button type="button" class="btn-match-cta" id="pilot-pay-done-btn">Listo</button>';
        document.getElementById('pilot-pay-done-btn')?.addEventListener('click', () => this.close());
      }
      return;
    }

    body.innerHTML = `
      <div class="trip-payment-breakdown pilot-pay-breakdown">
        <div class="trip-pay-row"><span>Flete acordado</span><span>${this.formatClp(m.agreed_clp)}</span></div>
        <div class="trip-pay-row fee"><span>Servicio Cubik ${feePct}%</span><span>+${this.formatClp(m.fee_clp)}</span></div>
        <div class="trip-pay-row total"><span>Total a debitar</span><strong>${this.formatClp(total)}</strong></div>
      </div>
      <p class="muted pilot-pay-note">Simulación piloto: no hay cargo real a tu tarjeta. En producción se usará tu saldo Cubik o medio de pago verificado.</p>
      <div class="help-bot-bubble">
        <span class="help-bot-tag">Cubik</span>
        <p>Al confirmar, generamos el cargo y el transportista pasa a <strong>pago en gestión</strong>.</p>
      </div>`;

    if (actions) {
      actions.hidden = false;
      actions.innerHTML = `
        <button type="button" class="btn-match-cta" id="pilot-pay-confirm">Confirmar pago</button>
        <button type="button" class="link-btn" id="pilot-pay-cancel">Cancelar</button>`;
      document.getElementById('pilot-pay-confirm')?.addEventListener('click', () => this.submit());
      document.getElementById('pilot-pay-cancel')?.addEventListener('click', () => this.close());
    }
  },

  async submit() {
    if (!this.matchId) return;
    this.step = 'processing';
    this.render();
    try {
      const res = await fetch(`/api/matches/${encodeURIComponent(this.matchId)}/pilot-pay`, {
        method: 'POST',
        headers: typeof apiHeaders === 'function' ? apiHeaders() : { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'No se pudo procesar el pago');
      }
      await new Promise((r) => setTimeout(r, 700));
      this.step = 'done';
      this.render();
      if (typeof refreshBoard === 'function') await refreshBoard();
      if (typeof Penalties !== 'undefined') await Penalties.refresh();
      if (typeof Comms !== 'undefined') Comms.refreshBell();
    } catch (e) {
      this.step = 'confirm';
      this.render();
      alert(e.message || 'Error al pagar');
    }
  },

  openFromMatch(m) {
    if (!m?.id) return;
    this.open(m.id, {
      pair:
        m.counterparty?.display ||
        (typeof window._boardMatchesById !== 'undefined' ? '' : '') ||
        'Viaje',
      agreed_clp: m.payment_agreed_clp ?? m.agreed_price_clp,
      fee_clp: m.payment_fee_clp,
      fee_rate: m.payment_fee_rate || 0.1,
      total_clp: m.payment_total_clp,
    });
  },

  bind(root) {
    (root || document).querySelectorAll('[data-pilot-pay]').forEach((btn) => {
      if (btn.dataset.boundPilotPay === '1') return;
      btn.dataset.boundPilotPay = '1';
      btn.addEventListener('click', () => {
        const id = btn.dataset.pilotPay;
        const match =
          window._boardMatchesById?.[id] ||
          window._tripsCache?.matchRows?.find((x) => x.id === id);
        if (match) {
          this.openFromMatch(match);
          return;
        }
        this.open(id, {
          agreed_clp: Number(btn.dataset.pilotAgreed || 0),
          fee_clp: Number(btn.dataset.pilotFee || 0),
          total_clp: Number(btn.dataset.pilotTotal || 0),
          fee_rate: 0.1,
          pair: btn.dataset.pilotPair || 'Viaje',
        });
      });
    });
  },
};

document.getElementById('pilot-pay-close')?.addEventListener('click', () => PilotPayUI.close());
