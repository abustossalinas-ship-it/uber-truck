const Comms = {
  activeMatchId: null,
  presets: [],

  headers() {
    return typeof apiHeaders === 'function' ? apiHeaders() : { 'Content-Type': 'application/json' };
  },

  actorRole() {
    return typeof getActorRole === 'function' ? getActorRole() : 'shipper';
  },

  async loadPresets() {
    if (this.presets.length) return this.presets;
    const json = await fetch('/api/comms/presets').then((r) => r.json());
    this.presets = json.data || [];
    return this.presets;
  },

  async refreshBell() {
    const role = this.actorRole();
    const json = await fetch(`/api/comms/notifications/list?actor_role=${encodeURIComponent(role)}`, {
      headers: this.headers(),
    }).then((r) => r.json());
    const countEl = document.getElementById('notif-count');
    if (!countEl) return;
    const n = json.unread || 0;
    countEl.textContent = String(n);
    countEl.hidden = n === 0;
  },

  async openNotifPanel() {
    const panel = document.getElementById('notif-panel');
    const list = document.getElementById('notif-list');
    if (!panel || !list) return;
    const role = this.actorRole();
    const json = await fetch(`/api/comms/notifications/list?actor_role=${encodeURIComponent(role)}`, {
      headers: this.headers(),
    }).then((r) => r.json());
    const rows = json.data || [];
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
              return `
        <article class="notif-item ${n.read_at ? '' : 'unread'}" data-id="${n.id}" data-match="${n.match_id}">
          <strong>${n.title}</strong>
          <p class="muted">${n.body}</p>
          ${actions}
        </article>`;
            })
            .join('');
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
  },

  closeChat() {
    const drawer = document.getElementById('chat-drawer');
    if (drawer) {
      drawer.hidden = true;
      drawer.setAttribute('aria-hidden', 'true');
    }
    this.activeMatchId = null;
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
    const rows = json.data || [];
    box.innerHTML =
      rows.length === 0
        ? '<p class="muted">Sin mensajes. Usa un mensaje rápido o escribe abajo.</p>'
        : rows
            .map(
              (m) => `
      <div class="chat-bubble ${m.sender_role === this.actorRole() ? 'mine' : 'theirs'}">
        <span class="chat-role">${typeof roleLabel === 'function' ? roleLabel(m.sender_role) : m.sender_role}</span>
        <p>${m.body}</p>
      </div>`
            )
            .join('');
    box.scrollTop = box.scrollHeight;
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
    document.getElementById('chat-input').value = '';
    await this.loadMessages();
    await this.refreshBell();
  },
};

document.getElementById('btn-notifications')?.addEventListener('click', () => Comms.openNotifPanel());
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
  const text = document.getElementById('chat-input')?.value?.trim();
  if (text) Comms.sendMessage(text);
});

window.Comms = Comms;
