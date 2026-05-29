const Penalties = {
  summary: null,

  headers() {
    return typeof apiHeaders === 'function' ? apiHeaders() : { 'Content-Type': 'application/json' };
  },

  isSessionActive() {
    return typeof Auth !== 'undefined' && Boolean(Auth.user && Auth.token);
  },

  formatClp(n) {
    return `$${Number(n || 0).toLocaleString('es-CL')} CLP`;
  },

  async fetchSummary() {
    if (!this.isSessionActive()) return null;
    const json = await fetch('/api/account/summary', { headers: this.headers() }).then((r) => r.json());
    if (!json.ok) return null;
    this.summary = json;
    return json;
  },

  renderPenaltyLines(items, label, { showAdminPaid = false } = {}) {
    if (!items?.length) return `<p class="muted">Sin ${label}.</p>`;
    const isAdmin = typeof Auth !== 'undefined' && Auth.user?.role === 'admin';
    return items
      .map((p) => {
        const late =
          p.status === 'overdue'
            ? `<span class="pill pill-warn">${p.days_late} día(s) de atraso</span>`
            : p.status === 'paid'
              ? `<span class="pill pill-ok">Pagada</span>`
              : `<span class="pill">Plazo ${p.deadline_days} días</span>`;
        const due = p.due_at
          ? new Date(p.due_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
          : '—';
        const paidNote =
          p.status === 'paid' && p.paid_at
            ? `<p class="muted">Regularizada ${new Date(p.paid_at).toLocaleDateString('es-CL')}</p>`
            : '';
        const adminBtn =
          showAdminPaid && isAdmin && p.status !== 'paid'
            ? `<button type="button" class="tab tab-sm" data-mark-penalty-paid="${p.match_id}">Marcar pagada (admin)</button>`
            : '';
        const helpBtn =
          p.status !== 'paid'
            ? `<button type="button" class="tab tab-sm" data-open-support="${p.match_id}" data-support-subject="Multa ${this.formatClp(p.amount_clp)}">Ayuda / revisión</button>`
            : '';
        return `<div class="penalty-line">
          <strong>${p.pair}</strong>
          <p>${this.formatClp(p.amount_clp)} · vence ${due} ${late}</p>
          <p class="muted">${p.reason_summary || p.reason_code || ''}</p>
          ${paidNote}
          <div class="penalty-line-actions">${helpBtn}${adminBtn}</div>
        </div>`;
      })
      .join('');
  },

  renderBox() {
    const box = document.getElementById('account-penalties-panel');
    if (!box) return;
    if (!this.isSessionActive()) {
      box.hidden = true;
      return;
    }
    const s = this.summary;
    if (!s) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    const p = s.penalties || {};
    const rolText =
      typeof window.roleLabel === 'function' ? window.roleLabel(p.role) : p.role;
    const op = s.operating_status || {};
    const blockWarn = op.blocked
      ? `<p class="penalty-block-warn"><strong>Operaciones bloqueadas:</strong> ${op.message || 'Multas vencidas. Regulariza o abre un caso de ayuda.'}</p>`
      : op.has_debt
        ? `<p class="muted penalty-grace-hint">${op.message || ''}</p>`
        : '';
    const bankWarn = s.bank_required_for_charges
      ? `<p class="penalty-bank-warn">Para <strong>generar un cargo</strong> debes inscribir cuenta bancaria (obligatorio si tienes multas pendientes).</p>`
      : '';
    const bankOk = s.bank_account?.complete
      ? '<p class="muted">Cuenta bancaria registrada.</p>'
      : `<button type="button" class="tab tab-sm" id="btn-open-bank">Inscribir cuenta bancaria</button>`;

    box.innerHTML = `
      <h2>Cuenta y multas</h2>
      <p class="muted">Resumen para ${rolText || 'tu cuenta'}. Multas sugeridas según cancelaciones. Plazo ${p.penalty_due_days || 7} días; después se bloquean nuevas cargas/ofertas/viajes.</p>
      ${blockWarn}
      ${bankWarn}
      <div class="penalty-grid">
        <section>
          <h3>Debes (como ${rolText?.toLowerCase() || 'usuario'})</h3>
          <p class="penalty-total">${this.formatClp(p.total_owed_clp)}</p>
          ${this.renderPenaltyLines(p.owed, 'multas por pagar', { showAdminPaid: true })}
        </section>
        <section>
          <h3>Te deben</h3>
          <p class="penalty-total receivable">${this.formatClp(p.total_receivable_clp)}</p>
          ${this.renderPenaltyLines(p.owed_to_me, 'por cobrar', { showAdminPaid: true })}
        </section>
      </div>
      ${
        p.paid_history?.length
          ? `<section class="penalty-paid-history"><h3>Multas regularizadas</h3>${this.renderPenaltyLines(p.paid_history, 'historial')}</section>`
          : ''
      }
      ${bankOk}
      <p class="muted penalty-note">${s.note || ''}</p>
    `;
    document.getElementById('btn-open-bank')?.addEventListener('click', () => this.openBankModal());
    box.querySelectorAll('[data-mark-penalty-paid]').forEach((btn) => {
      btn.addEventListener('click', () => this.markPenaltyPaid(btn.dataset.markPenaltyPaid));
    });
  },

  async markPenaltyPaid(matchId) {
    if (!matchId) return;
    const note = window.prompt('Nota de regularización (opcional):', 'Pago acordado / revisión moderador');
    if (note === null) return;
    const res = await fetch(`/api/account/penalties/${encodeURIComponent(matchId)}/mark-paid`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ note: note || undefined }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error || 'No se pudo marcar');
      return;
    }
    alert(json.message || 'Multa regularizada');
    await this.refresh();
    if (typeof refreshBoard === 'function') refreshBoard();
  },

  renderNotifSummary() {
    const el = document.getElementById('notif-penalties-summary');
    if (!el || !this.summary) return;
    const p = this.summary.penalties || {};
    if (!p.owed?.length && !p.owed_to_me?.length && !this.summary.bank_required_for_charges) {
      el.innerHTML = '';
      el.hidden = true;
      return;
    }
    el.hidden = false;
    let html = '<div class="notif-penalty-summary"><h4>Cuenta y multas</h4>';
    if (p.total_owed_clp > 0) {
      html += `<p><strong>Debes:</strong> ${this.formatClp(p.total_owed_clp)}`;
      if (p.overdue_count) html += ` · <span class="pill pill-warn">${p.overdue_count} vencida(s)</span>`;
      html += '</p>';
      p.owed.slice(0, 2).forEach((x) => {
        html += `<p class="muted">${x.pair}: ${this.formatClp(x.amount_clp)}`;
        if (x.days_late) html += ` (${x.days_late} días atraso)`;
        html += '</p>';
      });
    }
    if (p.total_receivable_clp > 0) {
      html += `<p><strong>Te deben:</strong> ${this.formatClp(p.total_receivable_clp)}</p>`;
    }
    if (this.summary.bank_required_for_charges) {
      html +=
        '<p class="penalty-bank-warn">Inscribe cuenta bancaria para poder generar cargos.</p>';
    }
    html += '</div>';
    el.innerHTML = html;
  },

  openBankModal() {
    const modal = document.getElementById('bank-modal');
    if (!modal) return;
    const f = this.summary?.bank_account?.fields || {};
    $('bank-holder-name').value = f.bank_holder_name || '';
    $('bank-rut').value = f.bank_rut || '';
    $('bank-name').value = f.bank_name || '';
    $('bank-account-type').value = f.bank_account_type || 'corriente';
    $('bank-account-number').value = f.bank_account_number || '';
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
  },

  closeBankModal() {
    const modal = document.getElementById('bank-modal');
    if (modal) {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
    }
  },

  async submitBank(e) {
    e.preventDefault();
    const body = {
      bank_holder_name: $('bank-holder-name').value,
      bank_rut: $('bank-rut').value,
      bank_name: $('bank-name').value,
      bank_account_type: $('bank-account-type').value,
      bank_account_number: $('bank-account-number').value,
    };
    const res = await fetch('/api/account/bank', {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error || 'No se pudo guardar');
      return;
    }
    this.closeBankModal();
    await this.refresh();
    alert(json.message || 'Cuenta guardada');
  },

  async refresh() {
    if (!this.isSessionActive()) {
      const box = document.getElementById('account-penalties-panel');
      if (box) box.hidden = true;
      this.summary = null;
      return;
    }
    await this.fetchSummary();
    this.renderBox();
    this.renderNotifSummary();
    this.renderBlockBanner();
  },

  renderBlockBanner() {
    const el = document.getElementById('penalty-block-banner');
    if (!el) return;
    const op = this.summary?.operating_status;
    if (!op?.blocked && !op?.has_debt) {
      el.hidden = true;
      document.body.classList.remove('penalty-blocked');
      return;
    }
    el.hidden = false;
    if (op.blocked) document.body.classList.add('penalty-blocked');
    else document.body.classList.remove('penalty-blocked');
    el.innerHTML = op.blocked
      ? `<div class="penalty-block-inner"><p><strong>No puedes tomar nuevos viajes</strong> — multas vencidas (${this.formatClp(op.total_owed_clp)}). Regulariza o abre <button type="button" class="link-btn" data-scroll-penalties>ayuda / revisión</button>.</p></div>`
      : `<div class="penalty-block-inner"><p>${op.message || ''}</p></div>`;
    el.querySelector('[data-scroll-penalties]')?.addEventListener('click', () => {
      document.getElementById('account-penalties-panel')?.scrollIntoView({ behavior: 'smooth' });
    });
  },

  resetUi() {
    this.summary = null;
    const box = document.getElementById('account-penalties-panel');
    if (box) {
      box.hidden = true;
      box.innerHTML = '';
    }
    const el = document.getElementById('notif-penalties-summary');
    if (el) {
      el.innerHTML = '';
      el.hidden = true;
    }
    this.closeBankModal();
  },
};

function $(id) {
  return document.getElementById(id);
}

document.getElementById('form-bank')?.addEventListener('submit', (e) => Penalties.submitBank(e));
document.querySelectorAll('[data-close-bank]').forEach((el) => {
  el.addEventListener('click', () => Penalties.closeBankModal());
});

window.Penalties = Penalties;
