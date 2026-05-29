/** Ayuda / moderación — casos tipo Uber Support (piloto) */

const SupportUI = {
  activeCaseId: null,
  activeMatchId: null,

  headers() {
    return typeof apiHeaders === 'function' ? apiHeaders() : { 'Content-Type': 'application/json' };
  },

  async openCase(matchId, subject) {
    if (!matchId) return;
    const res = await fetch('/api/support/cases', {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        match_id: matchId,
        subject: subject || 'Revisión de multa / cancelación',
        message:
          'Solicito revisión del caso. Adjunto antecedentes: (completa aquí horarios, acuerdos, fotos, etc.)',
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error || 'No se pudo abrir el caso');
      return;
    }
    await this.openDrawer(json.data.id, json.data.subject);
    if (typeof Penalties !== 'undefined') Penalties.refresh();
  },

  async openDrawer(caseId, title) {
    this.activeCaseId = caseId;
    const drawer = document.getElementById('support-drawer');
    const titleEl = document.getElementById('support-title');
    if (!drawer) return;
    if (titleEl) titleEl.textContent = title ? `Ayuda — ${title}` : 'Ayuda / revisión';
    drawer.hidden = false;
    drawer.setAttribute('aria-hidden', 'false');
    await this.loadMessages();
    if (typeof Auth !== 'undefined' && Auth.user?.role === 'admin') {
      document.getElementById('support-admin-actions')?.removeAttribute('hidden');
    } else {
      document.getElementById('support-admin-actions')?.setAttribute('hidden', '');
    }
  },

  closeDrawer() {
    const drawer = document.getElementById('support-drawer');
    if (drawer) {
      drawer.hidden = true;
      drawer.setAttribute('aria-hidden', 'true');
    }
    this.activeCaseId = null;
  },

  async loadMessages() {
    const box = document.getElementById('support-messages');
    if (!box || !this.activeCaseId) return;
    const json = await fetch(`/api/support/cases/${this.activeCaseId}/messages`, {
      headers: this.headers(),
    }).then((r) => r.json());
    const rows = json.data || [];
    const roleLabel =
      typeof window.roleLabel === 'function' ? window.roleLabel : (r) => r;
    box.innerHTML =
      rows.length === 0
        ? '<p class="muted">Sin mensajes. Escribe abajo; un moderador (admin) puede responder.</p>'
        : rows
            .map((m) => {
              const who =
                m.sender_role === 'moderator'
                  ? 'Moderador'
                  : roleLabel(m.sender_role);
              const when = m.created_at
                ? new Date(m.created_at).toLocaleString('es-CL', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '';
              return `<div class="chat-bubble ${m.sender_role === 'moderator' ? 'moderator' : m.sender_role === (typeof getActorRole === 'function' ? getActorRole() : '') ? 'mine' : 'theirs'}">
          <span class="chat-role">${who} · ${when}</span>
          <p>${m.body}</p>
        </div>`;
            })
            .join('');
    box.scrollTop = box.scrollHeight;
  },

  async sendMessage(body) {
    if (!this.activeCaseId || !body?.trim()) return;
    const res = await fetch(`/api/support/cases/${this.activeCaseId}/messages`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        body,
        as_moderator: typeof Auth !== 'undefined' && Auth.user?.role === 'admin',
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error || 'No se pudo enviar');
      return;
    }
    document.getElementById('support-input').value = '';
    await this.loadMessages();
  },

  async markPenaltyPaid() {
    if (!this.activeMatchId) {
      alert('Este caso no tiene emparejamiento vinculado.');
      return;
    }
    const note = window.prompt('Nota de regularización (opcional):', 'Acuerdo en revisión moderador');
    if (note === null) return;
    const res = await fetch(
      `/api/account/penalties/${encodeURIComponent(this.activeMatchId)}/mark-paid`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ note: note || undefined }),
      }
    );
    const json = await res.json();
    if (!res.ok) {
      alert(json.error || 'No se pudo marcar');
      return;
    }
    alert(json.message || 'Multa regularizada');
    if (typeof Penalties !== 'undefined') Penalties.refresh();
    await this.loadMessages();
  },

  async setStatus(status) {
    if (!this.activeCaseId) return;
    const res = await fetch(`/api/support/cases/${this.activeCaseId}/status`, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error || 'Error');
      return;
    }
    alert(`Caso marcado como ${status}`);
    await this.loadMessages();
  },
};

document.getElementById('support-close')?.addEventListener('click', () => SupportUI.closeDrawer());
document.getElementById('form-support')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = document.getElementById('support-input')?.value?.trim();
  if (text) SupportUI.sendMessage(text);
});
document.getElementById('support-mark-review')?.addEventListener('click', () =>
  SupportUI.setStatus('in_review')
);
document.getElementById('support-mark-resolved')?.addEventListener('click', () =>
  SupportUI.setStatus('resolved')
);
document.getElementById('support-mark-penalty-paid')?.addEventListener('click', () =>
  SupportUI.markPenaltyPaid()
);

document.body.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-open-support]');
  if (!btn) return;
  e.preventDefault();
  SupportUI.openCase(btn.dataset.openSupport, btn.dataset.supportSubject);
});

window.SupportUI = SupportUI;
