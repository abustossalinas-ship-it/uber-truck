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
            .map(
              (n) => `
        <article class="notif-item ${n.read_at ? '' : 'unread'}" data-id="${n.id}" data-match="${n.match_id}">
          <strong>${n.title}</strong>
          <p class="muted">${n.body}</p>
          <button type="button" class="link-btn" data-open-match="${n.match_id}">Ver emparejamiento</button>
        </article>`
            )
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
        <span class="chat-role">${m.sender_role === 'shipper' ? 'Embarcador' : 'Transportista'}</span>
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
  const open = e.target.closest('[data-open-match]');
  if (open) {
    const id = open.dataset.openMatch;
    await Comms.markRead(e.target.closest('.notif-item')?.dataset.id);
    document.getElementById('notif-panel').hidden = true;
    if (typeof showTab === 'function') showTab('board');
    Comms.openChat(id);
    return;
  }
  const item = e.target.closest('.notif-item');
  if (item?.dataset.id && !item.classList.contains('read')) {
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
