/** Llamada enmascarada — modelo Uber (proxy Twilio cuando esté configurado) */

const ContactUI = {
  headers() {
    return typeof Auth !== 'undefined' ? Auth.headers() : { 'Content-Type': 'application/json' };
  },

  async fetchContact(matchId) {
    const res = await fetch(`/api/matches/${encodeURIComponent(matchId)}/contact`, {
      headers: this.headers(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'No se pudo obtener contacto');
    return json.data;
  },

  showCallModal(data) {
    const modal = document.getElementById('call-modal');
    const title = document.getElementById('call-modal-title');
    const body = document.getElementById('call-modal-body');
    if (!modal || !body) return;
    if (title) {
      title.textContent = data.counterparty?.display
        ? `Llamar — ${data.counterparty.display}`
        : 'Llamar';
    }
    const cpLine = data.counterparty
      ? `<p><strong>${data.counterparty.display}</strong> <span class="muted">(${data.counterparty.role_label})</span></p>`
      : '';
    body.innerHTML = `
      ${cpLine}
      <p class="muted">${data.hint || ''}</p>
      ${data.masked_hint ? `<p class="muted">Referencia Cubik: ${data.masked_hint}</p>` : ''}
      <p class="call-modal-note">Cubik no muestra números reales para evitar acuerdos fuera de la plataforma. Coordina precio y entrega dentro del app.</p>`;
    const dialBtn = document.getElementById('call-modal-dial');
    if (dialBtn) {
      if (data.call_available && data.dial_url) {
        dialBtn.hidden = false;
        dialBtn.dataset.dialUrl = data.dial_url;
      } else {
        dialBtn.hidden = true;
        dialBtn.removeAttribute('data-dial-url');
      }
    }
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
  },

  closeCallModal() {
    const modal = document.getElementById('call-modal');
    if (modal) {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
    }
  },

  async callMatch(matchId) {
    try {
      const data = await this.fetchContact(matchId);
      if (data.call_available && data.dial_url) {
        if (
          confirm(
            `${data.hint}\n\n¿Llamar ahora vía Cubik?`
          )
        ) {
          window.location.href = data.dial_url;
        }
        return;
      }
      this.showCallModal(data);
    } catch (e) {
      alert(e.message || 'No se pudo iniciar la llamada');
    }
  },
};

document.getElementById('call-modal-close')?.addEventListener('click', () => ContactUI.closeCallModal());
document.getElementById('call-modal-backdrop')?.addEventListener('click', () => ContactUI.closeCallModal());
document.getElementById('call-modal-dial')?.addEventListener('click', (e) => {
  const url = e.currentTarget.dataset.dialUrl;
  if (url) window.location.href = url;
});

window.ContactUI = ContactUI;
