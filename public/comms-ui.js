const Comms = {
  activeMatchId: null,
  presets: [],
  chatFree: false,

  headers() {
    return typeof apiHeaders === 'function' ? apiHeaders() : { 'Content-Type': 'application/json' };
  },

  actorRole() {
    return typeof getActorRole === 'function' ? getActorRole() : 'shipper';
  },

  isSessionActive() {
    return typeof Auth !== 'undefined' && Boolean(Auth.user && Auth.token);
  },

  resetUi() {
    const panel = document.getElementById('notif-panel');
    const list = document.getElementById('notif-list');
    const bell = document.getElementById('btn-notifications');
    const countEl = document.getElementById('notif-count');
    if (panel) panel.hidden = true;
    if (list) list.innerHTML = '';
    if (countEl) {
      countEl.textContent = '0';
      countEl.hidden = true;
    }
    if (bell) bell.hidden = true;
    this.closeChat();
    if (typeof Penalties !== 'undefined') Penalties.resetUi();
  },

  async loadPresets() {
    if (this.presets.length) return this.presets;
    const json = await fetch('/api/comms/presets').then((r) => r.json());
    this.presets = json.data || [];
    return this.presets;
  },

  async refreshBell() {
    const bell = document.getElementById('btn-notifications');
    const countEl = document.getElementById('notif-count');
    if (!this.isSessionActive()) {
      this.resetUi();
      return;
    }
    if (bell) bell.hidden = false;
    const json = await fetch('/api/comms/notifications/list', {
      headers: this.headers(),
    }).then((r) => r.json());
    if (!countEl) return;
    if (!json.ok) {
      countEl.hidden = true;
      return;
    }
    const n = json.unread || 0;
    countEl.textContent = String(n);
    countEl.hidden = n === 0;
  },

  formatNotifDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('es-CL', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  },

  async openNotifPanel() {
    if (!this.isSessionActive()) {
      this.resetUi();
      alert('Inicia sesión para ver notificaciones.');
      return;
    }
    const panel = document.getElementById('notif-panel');
    const list = document.getElementById('notif-list');
    if (!panel || !list) return;
    const json = await fetch('/api/comms/notifications/list', {
      headers: this.headers(),
    }).then((r) => r.json());
    const rows = (json.data || []).slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    list.innerHTML =
      rows.length === 0
        ? '<p class="muted">Sin notificaciones.</p>'
        : rows
            .map((n) => {
              const mutual = n.type === 'mutual_cancel';
              const actions = mutual
                ? `<div class="notif-actions">
          <button type="button" class="tab tab-sm notif-cta" data-open-cancel="${n.match_id}">Confirmar acuerdo mutuo</button>
          <button type="button" class="link-btn" data-scroll-match="${n.match_id}">Ver en emparejamientos activos</button>
        </div>`
                : `<button type="button" class="link-btn" data-scroll-match="${n.match_id}">Ver en emparejamientos activos</button>`;
              const when = this.formatNotifDate(n.created_at);
              const offerBody =
                n.type === 'price_offer' && Array.isArray(n.offer_lines) && n.offer_lines.length
                  ? n.offer_lines
                      .map((line) => {
                        const lineWhen = line.at ? this.formatNotifDate(line.at) : '';
                        return `<p class="notif-offer-line"><strong>${line.label}:</strong> $${Number(line.amount_clp).toLocaleString('es-CL')} CLP${lineWhen ? ` · <time class="notif-date">${lineWhen}</time>` : ''}</p>`;
                      })
                      .join('')
                  : `<p class="muted">${n.body}</p>`;
              const headWhen =
                n.type === 'price_offer' && n.offer_lines?.length > 1 ? '' : when ? `<time class="notif-date">${when}</time>` : '';
              return `
        <article class="notif-item ${n.read_at ? '' : 'unread'}" data-id="${n.id}" data-match="${n.match_id}">
          <div class="notif-head">
            <strong>${n.title}</strong>
            ${headWhen}
          </div>
          ${offerBody}
          ${actions}
        </article>`;
            })
            .join('');
    if (typeof Penalties !== 'undefined') {
      await Penalties.fetchSummary();
      Penalties.renderNotifSummary();
    }
    panel.hidden = false;
    await this.refreshBell();
  },

  async markRead(id) {
    await fetch(`/api/comms/notifications/${id}/read`, {
      method: 'PATCH',
      headers: this.headers(),
    });
    await this.refreshBell();
  },

  async dismissMatchNotifications(matchId) {
    if (!matchId) return;
    await fetch(`/api/comms/notifications/match/${encodeURIComponent(matchId)}/read`, {
      method: 'PATCH',
      headers: this.headers(),
    });
    await this.refreshBell();
  },

  async openChat(matchId, title) {
    this.activeMatchId = matchId;
    const drawer = document.getElementById('chat-drawer');
    const titleEl = document.getElementById('chat-title');
    if (!drawer) return;
    if (titleEl) titleEl.textContent = title ? `Chat — ${title}` : 'Chat del emparejamiento';
    drawer.hidden = false;
    drawer.setAttribute('aria-hidden', 'false');
    await this.loadPresets();
    await this.renderPresets();
    await this.loadMessages();
    this.syncChatComposer();
  },

  closeChat() {
    const drawer = document.getElementById('chat-drawer');
    if (drawer) {
      drawer.hidden = true;
      drawer.setAttribute('aria-hidden', 'true');
    }
    this.activeMatchId = null;
    this.chatFree = false;
    this.syncChatComposer();
  },

  syncChatComposer() {
    const input = document.getElementById('chat-input');
    const form = document.getElementById('form-chat');
    const hint = document.getElementById('chat-mode-hint');
    const locked = !this.chatFree;
    if (input) {
      input.disabled = locked;
      input.placeholder = locked
        ? 'Texto libre cuando un agente Cubik atienda…'
        : 'Escribe un mensaje…';
    }
    if (form) {
      const btn = form.querySelector('button[type="submit"]');
      if (btn) btn.disabled = locked;
    }
    if (hint) {
      hint.hidden = false;
      hint.textContent = locked
        ? 'Usa solo los mensajes rápidos del pedido. Para escribir libremente, pulsa «Solicitar agente Cubik» y espera atención humana.'
        : 'Agente humano activo: ya puedes escribir libremente.';
      hint.classList.toggle('chat-mode-free', !locked);
    }
  },

  async renderPresets() {
    const box = document.getElementById('chat-presets');
    if (!box) return;
    box.innerHTML = this.presets
      .map(
        (p) =>
          `<button type="button" class="tab tab-sm" data-preset="${p.code}">${p.label}</button>`
      )
      .join('');
  },

  async loadMessages() {
    const box = document.getElementById('chat-messages');
    if (!box || !this.activeMatchId) return;
    const json = await fetch(`/api/comms/${this.activeMatchId}/messages`, {
      headers: this.headers(),
    }).then((r) => r.json());
    this.chatFree = Boolean(json.chat_free);
    const rows = json.data || [];
    box.innerHTML =
      rows.length === 0
        ? '<p class="muted">Sin mensajes. Usa un mensaje rápido abajo.</p>'
        : rows
            .map(
              (m) => `
      <div class="chat-bubble ${m.sender_role === this.actorRole() ? 'mine' : 'theirs'} ${m.sender_role === 'moderator' ? 'moderator' : ''}">
        <span class="chat-role">${m.sender_role === 'moderator' ? 'Cubik' : typeof roleLabel === 'function' ? roleLabel(m.sender_role) : m.sender_role}</span>
        <p>${m.body}</p>
      </div>`
            )
            .join('');
    box.scrollTop = box.scrollHeight;
    this.syncChatComposer();
  },

  async sendMessage(body, presetCode) {
    if (!this.activeMatchId) return;
    const res = await fetch(`/api/comms/${this.activeMatchId}/messages`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        actor_role: this.actorRole(),
        body,
        preset_code: presetCode || null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error || 'No se pudo enviar');
      return;
    }
    if (json.chat_free != null) this.chatFree = Boolean(json.chat_free);
    document.getElementById('chat-input').value = '';
    await this.loadMessages();
    await this.refreshBell();
  },
};

document.getElementById('btn-notifications')?.addEventListener('click', () => {
  if (!Comms.isSessionActive()) {
    Comms.resetUi();
    alert('Inicia sesión para ver notificaciones.');
    return;
  }
  Comms.openNotifPanel();
});
document.getElementById('notif-close')?.addEventListener('click', () => {
  document.getElementById('notif-panel').hidden = true;
});
document.getElementById('notif-list')?.addEventListener('click', async (e) => {
  const cancelBtn = e.target.closest('[data-open-cancel]');
  if (cancelBtn) {
    const id = cancelBtn.dataset.openCancel;
    document.getElementById('notif-panel').hidden = true;
    if (typeof showTab === 'function') showTab('board');
    if (typeof openCancelModalForMatch === 'function') {
      await openCancelModalForMatch(id);
    } else {
      alert('Recarga la página (Ctrl+F5) e intenta de nuevo.');
    }
    return;
  }
  const scrollBtn = e.target.closest('[data-scroll-match]');
  if (scrollBtn) {
    const id = scrollBtn.dataset.scrollMatch;
    document.getElementById('notif-panel').hidden = true;
    if (typeof scrollToActiveMatch === 'function') await scrollToActiveMatch(id);
    else if (typeof scrollToMatchCard === 'function') scrollToMatchCard(id);
    return;
  }
  const item = e.target.closest('.notif-item');
  if (item?.dataset.id && item.classList.contains('unread')) {
    await Comms.markRead(item.dataset.id);
    item.classList.remove('unread');
  }
});

document.getElementById('chat-close')?.addEventListener('click', () => Comms.closeChat());
document.getElementById('chat-presets')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-preset]');
  if (!btn) return;
  const preset = Comms.presets.find((p) => p.code === btn.dataset.preset);
  if (preset) Comms.sendMessage(preset.body, preset.code);
});
document.getElementById('form-chat')?.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!Comms.chatFree) {
    alert('Solo mensajes rápidos hasta que un agente Cubik atienda. Usa «Solicitar agente Cubik» si necesitas ayuda.');
    return;
  }
  const text = document.getElementById('chat-input')?.value?.trim();
  if (text) Comms.sendMessage(text);
});

window.Comms = Comms;
