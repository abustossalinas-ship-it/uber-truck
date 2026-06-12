(function () {
  const ICONS = {
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 7 10-7"/></svg>',
    building:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    users:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    chart:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="m7 16 4-6 4 3 5-8"/></svg>',
    whatsapp:
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>',
    calendar:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  };

  const TOOL_OPTIONS = [
    { id: 'excel', label: 'Excel / planillas' },
    { id: 'whatsapp', label: 'WhatsApp' },
    { id: 'tms', label: 'TMS / WMS' },
    { id: 'erp', label: 'ERP (SAP, Odoo, etc.)' },
    { id: 'none', label: 'Ninguna / manual' },
  ];

  const COPY = {
    carrier: {
      volumeLabel: '¿Cuántos viajes haces al mes?',
      volumePlaceholder: 'Ej: 40',
      companyLabel: '¿Cuál es el nombre de tu flota o empresa?',
      companyPlaceholder: 'Transportes Sur SpA',
    },
    shipper: {
      volumeLabel: '¿Cuántos envíos gestionas al mes?',
      volumePlaceholder: 'Ej: 120',
      companyLabel: '¿Cuál es el nombre de tu empresa?',
      companyPlaceholder: 'Mi Empresa SpA',
    },
  };

  let config = null;
  let modalEl = null;

  function role() {
    return document.body.dataset.prospectRole === 'carrier' ? 'carrier' : 'shipper';
  }

  function copy() {
    return COPY[role()] || COPY.shipper;
  }

  async function loadConfig() {
    if (config) return config;
    try {
      const res = await fetch('/api/prospectos/config');
      const json = await res.json();
      if (res.ok && json.ok) config = json.whatsapp;
    } catch (_) {}
    return config;
  }

  function whatsappUrl() {
    const urls = config?.urls || {};
    return urls[role()] || urls.shipper || null;
  }

  function bindWhatsAppLinks() {
    document.querySelectorAll('[data-prospect-whatsapp]').forEach((el) => {
      el.addEventListener('click', async (e) => {
        await loadConfig();
        const url = whatsappUrl();
        if (!url) {
          e.preventDefault();
          alert('WhatsApp comercial aún no configurado. Usa «Agendar demo» o escríbenos a admin@getcubik.cl');
          return;
        }
        if (el.tagName === 'A') el.href = url;
        else window.open(url, '_blank', 'noopener,noreferrer');
      });
    });
  }

  function fieldHtml(id, label, icon, inputHtml, required = true) {
    return `
      <div class="prospect-field">
        <label for="${id}">${label}${required ? ' <span class="req">*</span>' : ''}</label>
        <div class="prospect-input-wrap">
          <span class="prospect-input-icon" aria-hidden="true">${ICONS[icon] || ''}</span>
          ${inputHtml}
        </div>
      </div>`;
  }

  function ensureModal() {
    if (modalEl) return modalEl;
    const c = copy();
    const tools = TOOL_OPTIONS.map(
      (t) =>
        `<label class="prospect-tool-opt"><input type="checkbox" name="tools" value="${t.id}" /> ${t.label}</label>`
    ).join('');

    modalEl = document.createElement('div');
    modalEl.id = 'prospect-modal';
    modalEl.className = 'prospect-modal';
    modalEl.hidden = true;
    modalEl.innerHTML = `
      <div class="prospect-modal-backdrop" data-prospect-close tabindex="-1"></div>
      <div class="prospect-modal-card" role="dialog" aria-modal="true" aria-labelledby="prospect-modal-title">
        <button type="button" class="prospect-modal-close" data-prospect-close aria-label="Cerrar">×</button>
        <p class="prospect-modal-progress">Paso 1 de 1 · <span>100%</span>
          <span class="prospect-modal-progress-bar" aria-hidden="true"><span></span></span>
        </p>
        <h2 id="prospect-modal-title">¡Encantados de conocerte!</h2>
        <p class="prospect-modal-lead">Cuéntanos un poco sobre ti y te agendamos una demo de Cubik.</p>
        <p id="prospect-form-error" class="prospect-error" role="alert" hidden></p>
        <p id="prospect-form-success" class="prospect-success" hidden></p>
        <form id="prospect-form">
          ${fieldHtml('prospect-name', '¿Cuál es tu nombre?', 'user', '<input id="prospect-name" name="full_name" required autocomplete="name" placeholder="Juan Pérez" />')}
          ${fieldHtml('prospect-email', '¿Cuál es tu correo?', 'mail', '<input id="prospect-email" name="email" type="email" required autocomplete="email" placeholder="juan@miempresa.com" />')}
          ${fieldHtml('prospect-company', c.companyLabel, 'building', `<input id="prospect-company" name="company_name" required autocomplete="organization" placeholder="${c.companyPlaceholder}" />`)}
          <div class="prospect-field">
            <label for="prospect-phone">WhatsApp <span class="req">*</span></label>
            <div class="prospect-input-wrap">
              <span class="prospect-phone-prefix">CL +56</span>
              <span class="prospect-input-icon" aria-hidden="true">${ICONS.phone}</span>
              <input id="prospect-phone" name="phone" type="tel" inputmode="numeric" required autocomplete="tel" placeholder="9 8765 4321" />
            </div>
          </div>
          ${fieldHtml('prospect-team', '¿Cuántas personas trabajan en tu empresa?', 'users', '<input id="prospect-team" name="team_size" type="number" min="1" required inputmode="numeric" placeholder="Ej: 25" />')}
          ${fieldHtml('prospect-volume', c.volumeLabel, 'chart', `<input id="prospect-volume" name="monthly_volume" required inputmode="numeric" placeholder="${c.volumePlaceholder}" />`)}
          <div class="prospect-field">
            <label>¿Qué herramientas usas actualmente?</label>
            <div class="prospect-tools">${tools}</div>
          </div>
          <button type="submit" class="prospect-submit" id="prospect-submit">Continuar →</button>
        </form>
      </div>`;
    document.body.appendChild(modalEl);

    modalEl.querySelectorAll('[data-prospect-close]').forEach((el) => {
      el.addEventListener('click', closeModal);
    });
    modalEl.querySelector('#prospect-form')?.addEventListener('submit', onSubmit);
    return modalEl;
  }

  function openModal() {
    const el = ensureModal();
    el.hidden = false;
    document.body.style.overflow = 'hidden';
    el.querySelector('#prospect-form-error')?.setAttribute('hidden', '');
    el.querySelector('#prospect-form-success')?.setAttribute('hidden', '');
    el.querySelector('#prospect-form')?.reset();
    window.setTimeout(() => el.querySelector('#prospect-name')?.focus(), 50);
  }

  function closeModal() {
    if (!modalEl) return;
    modalEl.hidden = true;
    document.body.style.overflow = '';
  }

  async function onSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const errEl = modalEl.querySelector('#prospect-form-error');
    const okEl = modalEl.querySelector('#prospect-form-success');
    const btn = modalEl.querySelector('#prospect-submit');
    errEl.hidden = true;
    okEl.hidden = true;

    const tools = [...form.querySelectorAll('input[name="tools"]:checked')].map((i) => i.value);
    const payload = {
      role: role(),
      source_page: location.pathname,
      full_name: form.full_name.value,
      email: form.email.value,
      company_name: form.company_name.value,
      phone: form.phone.value,
      team_size: form.team_size.value,
      monthly_volume: form.monthly_volume.value,
      current_tools: tools,
    };

    btn.disabled = true;
    btn.textContent = 'Enviando…';
    try {
      const res = await fetch('/api/prospectos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'No pudimos guardar tu solicitud');
      okEl.textContent = json.message || '¡Listo! Te contactaremos pronto.';
      okEl.hidden = false;
      form.hidden = true;
      window.setTimeout(() => {
        closeModal();
        form.hidden = false;
        form.reset();
      }, 2800);
    } catch (err) {
      errEl.textContent = err.message || 'Error al enviar';
      errEl.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Continuar →';
    }
  }

  function bindDemoButtons() {
    document.querySelectorAll('[data-prospect-demo]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openModal();
      });
    });
  }

  function decorateCtaIcons() {
    document.querySelectorAll('[data-prospect-whatsapp]').forEach((el) => {
      if (el.dataset.iconDone === '1') return;
      el.dataset.iconDone = '1';
      const wrap = document.createElement('span');
      wrap.setAttribute('aria-hidden', 'true');
      wrap.innerHTML = ICONS.whatsapp;
      el.prepend(wrap);
    });
    document.querySelectorAll('[data-prospect-demo]').forEach((el) => {
      if (el.dataset.iconDone === '1') return;
      el.dataset.iconDone = '1';
      const wrap = document.createElement('span');
      wrap.setAttribute('aria-hidden', 'true');
      wrap.innerHTML = ICONS.calendar;
      el.prepend(wrap);
    });
  }

  async function init() {
    if (!document.body.dataset.prospectRole) return;
    decorateCtaIcons();
    await loadConfig();
    const url = whatsappUrl();
    document.querySelectorAll('[data-prospect-whatsapp]').forEach((el) => {
      if (el.tagName === 'A' && url) el.href = url;
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    });
    bindWhatsAppLinks();
    bindDemoButtons();
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalEl && !modalEl.hidden) closeModal();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
