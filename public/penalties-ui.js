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

  emptyPenalties() {
    const role = typeof getActorRole === 'function' ? getActorRole() : 'shipper';
    return {
      role,
      owed: [],
      owed_to_me: [],
      paid_history: [],
      pending_confirmations: [],
      total_owed_clp: 0,
      total_receivable_clp: 0,
      overdue_count: 0,
      awaiting_confirm_count: 0,
      penalty_due_days: 7,
      penalty_confirm_hours: 24,
    };
  },

  async fetchSummary() {
    if (!this.isSessionActive()) return null;
    try {
      const res = await fetch('/api/account/summary', { headers: this.headers() });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        this.summary = {
          ok: false,
          error: json.error || 'No se pudo cargar multas',
          penalties: this.emptyPenalties(),
          operating_status: { blocked: false, has_debt: false },
        };
        return this.summary;
      }
      this.summary = { ...json, ok: true };
      return this.summary;
    } catch (e) {
      console.error(e);
      this.summary = {
        ok: false,
        error: 'Sin conexión con el servidor',
        penalties: this.emptyPenalties(),
        operating_status: { blocked: false, has_debt: false },
      };
      return this.summary;
    }
  },

  statusPill(p) {
    if (p.status === 'paid') return '<span class="pill pill-ok">Regularizada</span>';
    if (p.status === 'awaiting_confirm') {
      const h = p.hours_left_confirm != null ? `${p.hours_left_confirm} h restantes` : '24 h';
      return `<span class="pill pill-warn">Esperando confirmación · ${h}</span>`;
    }
    if (p.status === 'disputed') return '<span class="pill pill-warn">Pago rechazado</span>';
    if (p.status === 'confirm_expired') {
      return '<span class="pill pill-warn">Plazo confirmación vencido · moderador</span>';
    }
    if (p.status === 'overdue') {
      return `<span class="pill pill-warn">${p.days_late} día(s) de atraso</span>`;
    }
    return `<span class="pill">Plazo ${p.deadline_days} días</span>`;
  },

  actionButtons(p, { showAdminPaid = false, creditorReview = false } = {}) {
    const isAdmin = typeof Auth !== 'undefined' && Auth.user?.role === 'admin';
    const role = typeof getActorRole === 'function' ? getActorRole() : Auth?.user?.role;
    const parts = [];
    if (p.can_claim && p.debtor_role === role) {
      parts.push(
        `<button type="button" class="tab tab-sm" data-claim-penalty="${p.match_id}">Declarar pago realizado</button>`
      );
    }
    if (creditorReview && p.can_confirm && p.creditor_role === role) {
      parts.push(
        `<button type="button" class="tab tab-sm btn-creditor-review" data-creditor-review="${p.match_id}">Revisar comprobante y confirmar</button>`
      );
    } else {
      if (p.can_view_proof && p.creditor_role === role) {
        parts.push(
          `<button type="button" class="tab tab-sm tab-outline" data-view-payment-proof="${p.match_id}">Ver comprobante</button>`
        );
      }
      if (p.can_confirm && p.creditor_role === role) {
        parts.push(
          `<button type="button" class="tab tab-sm" data-confirm-penalty="${p.match_id}">Confirmar que recibí el pago</button>`
        );
      }
      if (p.can_dispute && p.creditor_role === role) {
        parts.push(
          `<button type="button" class="tab tab-sm tab-outline" data-dispute-penalty="${p.match_id}">No recibí el pago</button>`
        );
      }
    }
    if (p.can_view_proof && p.debtor_role === role && !creditorReview) {
      parts.push(
        `<button type="button" class="tab tab-sm tab-outline" data-view-payment-proof="${p.match_id}">Ver mi comprobante enviado</button>`
      );
    }
    if (p.status !== 'paid') {
      parts.push(
        `<button type="button" class="tab tab-sm" data-open-support="${p.match_id}" data-support-subject="Multa ${this.formatClp(p.amount_clp)}">Ayuda / revisión</button>`
      );
    }
    if (showAdminPaid && isAdmin && p.status !== 'paid') {
      parts.push(
        `<button type="button" class="tab tab-sm" data-mark-penalty-paid="${p.match_id}">Cerrar por moderador</button>`
      );
    }
    return parts.length
      ? `<div class="penalty-line-actions">${parts.join('')}</div>`
      : '';
  },

  renderCreditorPendingCards(items) {
    if (!items?.length) return `<p class="muted">Sin pagos por confirmar.</p>`;
    return items
      .map((p) => {
        const h =
          p.hours_left_confirm != null ? `${p.hours_left_confirm} h restantes` : '24 h';
        const note = p.claim_note
          ? `<p class="muted">Nota del transportista: ${p.claim_note}</p>`
          : '';
        return `<div class="penalty-line penalty-creditor-review" data-creditor-card="${p.match_id}">
          <strong>${p.pair}</strong>
          <p>${this.formatClp(p.amount_clp)} · pago declarado fuera de la app · ${h}</p>
          <p class="muted">${p.reason_summary || ''}</p>
          ${note}
          <div class="creditor-proof-thumb-wrap" data-proof-thumb="${p.match_id}">
            <p class="muted">Cargando comprobante…</p>
          </div>
          ${this.actionButtons(p, { creditorReview: true })}
        </div>`;
      })
      .join('');
  },

  renderPenaltyLines(items, label, opts = {}) {
    if (!items?.length) return `<p class="muted">Sin ${label}.</p>`;
    return items
      .map((p) => {
        const due = p.due_at
          ? new Date(p.due_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
          : '—';
        const extra =
          p.status === 'paid' && p.paid_at
            ? `<p class="muted">Regularizada ${new Date(p.paid_at).toLocaleDateString('es-CL')}</p>`
            : p.claim_note
              ? `<p class="muted">Nota de pago: ${p.claim_note}</p>`
              : '';
        return `<div class="penalty-line">
          <strong>${p.pair}</strong>
          <p>${this.formatClp(p.amount_clp)} · vence ${due} ${this.statusPill(p)}</p>
          <p class="muted">${p.reason_summary || p.reason_code || ''}</p>
          ${extra}
          ${this.actionButtons(p, opts)}
        </div>`;
      })
      .join('');
  },

  bindPenaltyActions(box) {
    box.querySelectorAll('[data-mark-penalty-paid]').forEach((btn) => {
      btn.addEventListener('click', () => this.markPenaltyPaid(btn.dataset.markPenaltyPaid));
    });
    box.querySelectorAll('[data-claim-penalty]').forEach((btn) => {
      btn.addEventListener('click', () => this.claimPenalty(btn.dataset.claimPenalty));
    });
    box.querySelectorAll('[data-confirm-penalty]').forEach((btn) => {
      btn.addEventListener('click', () => this.confirmPenalty(btn.dataset.confirmPenalty));
    });
    box.querySelectorAll('[data-dispute-penalty]').forEach((btn) => {
      btn.addEventListener('click', () => this.disputePenalty(btn.dataset.disputePenalty));
    });
    box.querySelectorAll('[data-view-payment-proof]').forEach((btn) => {
      btn.addEventListener('click', () => this.viewPaymentProof(btn.dataset.viewPaymentProof));
    });
    box.querySelectorAll('[data-creditor-review]').forEach((btn) => {
      btn.addEventListener('click', () => this.openCreditorReviewModal(btn.dataset.creditorReview));
    });
    box.querySelectorAll('[data-proof-thumb]').forEach((el) => {
      this.loadProofThumbnail(el.dataset.proofThumb, el);
    });
  },

  reviewMatchId: null,

  async loadProofIntoElement(matchId, container, { large = false } = {}) {
    if (!matchId || !container) return;
    try {
      const res = await fetch(
        `/api/account/penalties/${encodeURIComponent(matchId)}/payment-proof`,
        { headers: this.headers() }
      );
      if (!res.ok) {
        container.innerHTML = '<p class="muted">Sin comprobante adjunto.</p>';
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const cls = large ? 'creditor-proof-large' : 'creditor-proof-thumb';
      container.innerHTML = `<img src="${url}" alt="Comprobante de transferencia" class="${cls}" data-creditor-review-img="${matchId}" />`;
      container.querySelector('[data-creditor-review-img]')?.addEventListener('click', () => {
        if (!large) this.openCreditorReviewModal(matchId);
      });
    } catch {
      container.innerHTML = '<p class="muted">No se pudo cargar el comprobante.</p>';
    }
  },

  loadProofThumbnail(matchId, el) {
    this.loadProofIntoElement(matchId, el);
  },

  openCreditorReviewModal(matchId) {
    this.reviewMatchId = matchId;
    const modal = document.getElementById('creditor-review-modal');
    const meta = document.getElementById('creditor-review-meta');
    const proofBox = document.getElementById('creditor-review-proof');
    const item = [
      ...(this.summary?.penalties?.pending_confirmations || []),
      ...(this.summary?.penalties?.owed_to_me || []),
    ].find((x) => x.match_id === matchId);
    if (meta && item) {
      meta.innerHTML = `<strong>${item.pair}</strong> · ${this.formatClp(item.amount_clp)}${
        item.claim_note ? `<br><span class="muted">Nota: ${item.claim_note}</span>` : ''
      }`;
    }
    if (proofBox) {
      proofBox.innerHTML = '<p class="muted">Cargando comprobante…</p>';
      this.loadProofIntoElement(matchId, proofBox, { large: true });
    }
    if (modal) {
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
    }
  },

  closeCreditorReviewModal() {
    this.reviewMatchId = null;
    const modal = document.getElementById('creditor-review-modal');
    if (modal) {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
    }
  },

  async confirmFromReviewModal() {
    const id = this.reviewMatchId;
    if (!id) return;
    if (!window.confirm('¿Confirmas que el comprobante coincide y recibiste el pago en tu cuenta?')) return;
    try {
      const json = await this.postPenalty(id, 'confirm-payment');
      this.closeCreditorReviewModal();
      alert(json.message);
      await this.refresh();
    } catch (e) {
      alert(e.message);
    }
  },

  async disputeFromReviewModal() {
    const id = this.reviewMatchId;
    if (!id) return;
    const note = window.prompt('Indica por qué no validas el pago (obligatorio):', 'El comprobante no coincide o no hay abono en cuenta');
    if (!note?.trim()) return;
    try {
      const json = await this.postPenalty(id, 'dispute-payment', { note });
      this.closeCreditorReviewModal();
      alert(json.message);
      await this.refresh();
    } catch (e) {
      alert(e.message);
    }
  },

  claimMatchId: null,

  openClaimPaymentModal(matchId) {
    this.claimMatchId = matchId;
    const modal = document.getElementById('claim-payment-modal');
    const err = document.getElementById('claim-payment-error');
    const file = document.getElementById('claim-payment-file');
    const note = document.getElementById('claim-payment-note');
    const previewWrap = document.getElementById('claim-payment-preview-wrap');
    const preview = document.getElementById('claim-payment-preview');
    document.getElementById('claim-payment-match-id').value = matchId || '';
    if (note) note.value = '';
    if (file) file.value = '';
    if (previewWrap) previewWrap.hidden = true;
    if (preview) preview.removeAttribute('src');
    if (err) {
      err.hidden = true;
      err.textContent = '';
    }
    if (modal) {
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
    }
  },

  closeClaimPaymentModal() {
    this.claimMatchId = null;
    const modal = document.getElementById('claim-payment-modal');
    if (modal) {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
    }
  },

  async fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
      reader.readAsDataURL(file);
    });
  },

  async viewPaymentProof(matchId) {
    if (!matchId) return;
    try {
      const res = await fetch(`/api/account/penalties/${encodeURIComponent(matchId)}/payment-proof`, {
        headers: this.headers(),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'No se pudo abrir el comprobante');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      alert(e.message);
    }
  },

  async postPenalty(matchId, path, body) {
    const res = await fetch(`/api/account/penalties/${encodeURIComponent(matchId)}/${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body || {}),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error');
    return json;
  },

  async claimPenalty(matchId) {
    this.openClaimPaymentModal(matchId);
  },

  async submitClaimPayment(e) {
    e.preventDefault();
    const matchId = this.claimMatchId || document.getElementById('claim-payment-match-id')?.value;
    const fileInput = document.getElementById('claim-payment-file');
    const errEl = document.getElementById('claim-payment-error');
    const note = document.getElementById('claim-payment-note')?.value?.trim();
    const file = fileInput?.files?.[0];
    if (!matchId || !file) {
      if (errEl) {
        errEl.textContent = 'Selecciona una imagen del comprobante.';
        errEl.hidden = false;
      }
      return;
    }
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const prev = submitBtn?.textContent;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando…';
    }
    try {
      const dataUrl = await this.fileToBase64(file);
      const json = await this.postPenalty(matchId, 'claim-paid', {
        note: note || undefined,
        proof_base64: dataUrl,
        proof_mime: file.type,
      });
      this.closeClaimPaymentModal();
      alert(json.message);
      await this.refresh();
      if (typeof refreshBoard === 'function') refreshBoard();
    } catch (e) {
      if (errEl) {
        errEl.textContent = e.message;
        errEl.hidden = false;
      } else alert(e.message);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = prev || 'Enviar comprobante';
      }
    }
  },

  async confirmPenalty(matchId) {
    if (this.summary?.penalties?.pending_confirmations?.some((x) => x.match_id === matchId)) {
      this.openCreditorReviewModal(matchId);
      return;
    }
    if (!window.confirm('¿Confirmas que recibiste el pago de esta multa?')) return;
    try {
      const json = await this.postPenalty(matchId, 'confirm-payment');
      alert(json.message);
      await this.refresh();
      if (typeof refreshBoard === 'function') refreshBoard();
    } catch (e) {
      alert(e.message);
    }
  },

  async disputePenalty(matchId) {
    const note = window.prompt('Motivo del rechazo (obligatorio):', 'No se recibió el pago acordado');
    if (!note?.trim()) return;
    try {
      const json = await this.postPenalty(matchId, 'dispute-payment', { note });
      alert(json.message);
      await this.refresh();
    } catch (e) {
      alert(e.message);
    }
  },

  async markPenaltyPaid(matchId) {
    if (!matchId) return;
    const note = window.prompt('Nota de cierre moderador (opcional):', 'Resolución moderador');
    if (note === null) return;
    try {
      const json = await this.postPenalty(matchId, 'mark-paid', { note: note || undefined });
      alert(json.message);
      await this.refresh();
      if (typeof refreshBoard === 'function') refreshBoard();
    } catch (e) {
      alert(e.message);
    }
  },

  renderBox() {
    const box = document.getElementById('account-penalties-panel');
    if (!box) return;
    if (!this.isSessionActive()) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    box.hidden = false;
    const s = this.summary;
    if (!s) {
      box.innerHTML =
        '<h2>Cuenta y multas</h2><p class="muted">Cargando resumen…</p>';
      return;
    }
    const p = s.penalties || this.emptyPenalties();
    if (s.ok === false || s.penalties_error) {
      box.innerHTML = `
        <h2>Cuenta y multas</h2>
        <p class="penalty-block-warn"><strong>No se pudo cargar:</strong> ${s.error || s.penalties_error || 'Error'}</p>
        <p class="muted">Si acabas de desplegar v0.0.52+, ejecuta <code>RUN_024_SUPABASE.sql</code> en Supabase.</p>
        <button type="button" class="tab tab-sm" id="btn-penalties-retry">Reintentar</button>`;
      document.getElementById('btn-penalties-retry')?.addEventListener('click', () => this.refresh());
      return;
    }
    const rolText =
      typeof window.roleLabel === 'function' ? window.roleLabel(p.role) : p.role;
    const op = s.operating_status || {};
    const confirmH = p.penalty_confirm_hours || 24;
    const hasAnyPenalty =
      p.total_owed_clp > 0 ||
      p.total_receivable_clp > 0 ||
      p.pending_confirmations?.length ||
      p.paid_history?.length;
    const blockWarn = op.blocked
      ? `<p class="penalty-block-warn"><strong>Operaciones bloqueadas:</strong> ${op.message || ''}</p>`
      : op.has_debt
        ? `<p class="muted penalty-grace-hint">${op.message || ''}</p>`
        : !hasAnyPenalty
          ? '<p class="muted">Sin multas en tus emparejamientos cancelados.</p>'
          : '';
    const bankOperate = s.payment_required_for_operate || s.bank_required_for_operate
      ? `<p class="penalty-bank-warn"><strong>Medio de pago obligatorio</strong> para operar (tarjeta verificada o cuenta bancaria). <button type="button" class="link-btn" id="btn-open-card-inline">Agregar tarjeta</button> · <button type="button" class="link-btn" id="btn-open-bank-inline">Cuenta bancaria</button></p>`
      : s.bank_required_for_charges
        ? `<p class="penalty-bank-warn">Inscribe tarjeta o cuenta bancaria para multas y cobros.</p>`
        : '';
    const pm = s.payment_summary?.default;
    const cardOk = s.payment_summary?.verified
      ? `<p class="muted">Tarjeta verificada · ${pm?.card_brand || 'card'} •••• ${pm?.card_last4 || '****'} (${pm?.holder_rut || ''})</p>`
      : `<button type="button" class="tab tab-sm" id="btn-open-card">Agregar tarjeta (Copec)</button>`;
    const bankOk = s.bank_account?.complete
      ? '<p class="muted">Cuenta bancaria registrada.</p>'
      : `<button type="button" class="tab tab-sm" id="btn-open-bank">Inscribir cuenta bancaria</button>`;

    const pendingBlock = p.pending_confirmations?.length
      ? `<section class="penalty-confirm-pending"><h3>Pagos por confirmar (${confirmH} h)</h3>
         <p class="muted">El transportista declaró pago <strong>fuera de la app</strong>. Tú solo <strong>ves el comprobante</strong> y confirmas o rechazas si el dinero llegó a tu cuenta.</p>
         ${this.renderCreditorPendingCards(p.pending_confirmations)}</section>`
      : '';

    box.innerHTML = `
      <h2>Cuenta y multas</h2>
      <p class="muted">Resumen para ${rolText || 'tu cuenta'}. Plazo ${p.penalty_due_days || 7} días para pagar; al declarar pago el acreedor tiene ${confirmH} h para confirmar. Sin confirmación → moderador.</p>
      ${blockWarn}
      ${pendingBlock}
      ${bankOperate}
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
      ${cardOk}
      <p class="muted penalty-note">${s.note || ''}</p>
    `;
    document.getElementById('btn-open-bank')?.addEventListener('click', () => this.openBankModal());
    document.getElementById('btn-open-bank-inline')?.addEventListener('click', () => this.openBankModal());
    document.getElementById('btn-open-card')?.addEventListener('click', () => this.openCardModal());
    document.getElementById('btn-open-card-inline')?.addEventListener('click', () => this.openCardModal());
    this.bindPenaltyActions(box);
  },

  renderNotifSummary() {
    const el = document.getElementById('notif-penalties-summary');
    if (!el || !this.summary) return;
    const p = this.summary.penalties || {};
    if (
      !p.owed?.length &&
      !p.owed_to_me?.length &&
      !p.pending_confirmations?.length &&
      !this.summary.bank_required_for_charges
    ) {
      el.innerHTML = '';
      el.hidden = true;
      return;
    }
    el.hidden = false;
    let html = '<div class="notif-penalty-summary"><h4>Cuenta y multas</h4>';
    if (p.pending_confirmations?.length) {
      html += `<p class="penalty-bank-warn"><strong>${p.pending_confirmations.length} pago(s) por confirmar</strong></p>`;
    }
    if (p.total_owed_clp > 0) {
      html += `<p><strong>Debes:</strong> ${this.formatClp(p.total_owed_clp)}`;
      if (p.awaiting_confirm_count) {
        html += ` · <span class="pill pill-warn">${p.awaiting_confirm_count} esperando confirmación</span>`;
      }
      if (p.overdue_count) html += ` · <span class="pill pill-warn">${p.overdue_count} vencida(s)</span>`;
      html += '</p>';
    }
    if (p.total_receivable_clp > 0) {
      html += `<p><strong>Te deben:</strong> ${this.formatClp(p.total_receivable_clp)}</p>`;
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

  openCardModal() {
    const modal = document.getElementById('card-modal');
    if (!modal) return;
    const hint = document.getElementById('card-modal-hint');
    const provider = this.summary?.payment_summary?.provider_label;
    if (hint && provider) {
      hint.textContent = `Pasarela: ${provider}. Validamos titular y RUT. Cargo simulado $990 CLP en piloto (reversado).`;
    }
    const pm = this.summary?.payment_summary?.default;
    $('card-holder-name').value = pm?.holder_name || this.summary?.bank_account?.fields?.bank_holder_name || '';
    $('card-holder-rut').value = pm?.holder_rut || this.summary?.bank_account?.fields?.bank_rut || '';
    $('card-number').value = '';
    $('card-exp-month').value = '';
    $('card-exp-year').value = '';
    $('card-cvv').value = '';
    const err = document.getElementById('card-enroll-error');
    if (err) err.hidden = true;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
  },

  closeCardModal() {
    const modal = document.getElementById('card-modal');
    if (modal) {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
    }
  },

  async submitCard(e) {
    e.preventDefault();
    const errEl = document.getElementById('card-enroll-error');
    const body = {
      holder_name: $('card-holder-name').value,
      holder_rut: $('card-holder-rut').value,
      card_number: $('card-number').value,
      exp_month: $('card-exp-month').value,
      exp_year: $('card-exp-year').value,
      cvv: $('card-cvv').value,
    };
    const res = await fetch('/api/account/payment-methods/enroll', {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      if (errEl) {
        errEl.textContent = json.error || 'No se pudo verificar la tarjeta';
        errEl.hidden = false;
      } else alert(json.error || 'No se pudo verificar');
      return;
    }
    this.closeCardModal();
    await this.refresh();
    alert(json.message || 'Tarjeta verificada');
  },

  async removeCard(methodId) {
    if (!methodId || !confirm('¿Eliminar esta tarjeta?')) return;
    const res = await fetch(`/api/account/payment-methods/${encodeURIComponent(methodId)}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error || 'No se pudo eliminar');
      return;
    }
    await this.refresh();
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
    const box = document.getElementById('account-penalties-panel');
    if (box) {
      box.hidden = false;
      box.innerHTML = '<h2>Cuenta y multas</h2><p class="muted">Cargando resumen…</p>';
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
    const p = this.summary?.penalties;
    const showStrip =
      op?.blocked ||
      op?.has_debt ||
      p?.pending_confirmations?.length ||
      p?.total_owed_clp > 0 ||
      this.summary?.bank_required_for_operate;
    if (!showStrip) {
      el.hidden = true;
      el.innerHTML = '';
      document.body.classList.remove('penalty-blocked');
      return;
    }
    el.hidden = false;
    if (op?.blocked) document.body.classList.add('penalty-blocked');
    else document.body.classList.remove('penalty-blocked');
    const title = this.summary?.payment_required_for_operate || this.summary?.bank_required_for_operate
      ? 'Medio de pago requerido'
      : op?.blocked
        ? op.block_reason === 'awaiting_confirm'
          ? 'Esperando confirmación del acreedor'
          : 'No puedes tomar nuevos viajes'
        : p?.pending_confirmations?.length
          ? 'Pagos por confirmar'
          : 'Multas pendientes';
    const detail = this.summary?.payment_required_for_operate || this.summary?.bank_required_for_operate
      ? 'Agrega tarjeta verificada o cuenta bancaria para publicar, ofertar y emparejar.'
      : op?.blocked
        ? op.message
        : p?.pending_confirmations?.length
          ? `Tienes ${p.pending_confirmations.length} pago(s) declarados por confirmar (24 h).`
          : p?.total_owed_clp > 0
            ? `Debes ${this.formatClp(p.total_owed_clp)} en multas sugeridas.`
            : op?.message || '';
    el.innerHTML = `<div class="penalty-block-inner"><p><strong>${title}</strong> — ${detail || ''} <button type="button" class="link-btn" data-scroll-penalties>Ver detalle</button></p></div>`;
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
    this.closeCardModal();
  },
};

function $(id) {
  return document.getElementById(id);
}

document.getElementById('form-bank')?.addEventListener('submit', (e) => Penalties.submitBank(e));
document.getElementById('form-card')?.addEventListener('submit', (e) => Penalties.submitCard(e));
document.querySelectorAll('[data-close-bank]').forEach((el) => {
  el.addEventListener('click', () => Penalties.closeBankModal());
});
document.querySelectorAll('[data-close-card]').forEach((el) => {
  el.addEventListener('click', () => Penalties.closeCardModal());
});
document.getElementById('btn-bank-to-card')?.addEventListener('click', () => {
  Penalties.closeBankModal();
  Penalties.openCardModal();
});
document.getElementById('btn-card-to-bank')?.addEventListener('click', () => {
  Penalties.closeCardModal();
  Penalties.openBankModal();
});
document.getElementById('form-claim-payment')?.addEventListener('submit', (e) =>
  Penalties.submitClaimPayment(e)
);
document.querySelectorAll('[data-close-claim-payment]').forEach((el) => {
  el.addEventListener('click', () => Penalties.closeClaimPaymentModal());
});
document.getElementById('btn-creditor-confirm')?.addEventListener('click', () =>
  Penalties.confirmFromReviewModal()
);
document.getElementById('btn-creditor-dispute')?.addEventListener('click', () =>
  Penalties.disputeFromReviewModal()
);
document.querySelectorAll('[data-close-creditor-review]').forEach((el) => {
  el.addEventListener('click', () => Penalties.closeCreditorReviewModal());
});
document.getElementById('claim-payment-file')?.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  const wrap = document.getElementById('claim-payment-preview-wrap');
  const img = document.getElementById('claim-payment-preview');
  if (!file || !wrap || !img) return;
  const url = URL.createObjectURL(file);
  img.src = url;
  wrap.hidden = false;
});

window.Penalties = Penalties;
