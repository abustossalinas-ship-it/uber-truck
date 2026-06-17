/** Panel admin — aprobar cuentas del piloto + operaciones */

function scrollToAdminSection(section) {
  const id = section === 'ops' ? 'admin-ops-panel' : 'admin-kyc-panel';
  const el = document.getElementById(id);
  if (!el) return;
  el.hidden = false;
  if (section === 'kyc') {
    setAdminKycTab('pending');
  }
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (section === 'kyc') refreshAdminKycPanel();
  else if (section === 'ops') refreshAdminOpsPanel();
}

async function refreshAdminHubNav() {
  const nav = document.getElementById('admin-hub-nav');
  const btnKyc = document.getElementById('admin-goto-kyc');
  if (!nav) return;
  const user = typeof Auth !== 'undefined' ? Auth.user : null;
  if (!user || user.role !== 'admin') {
    nav.hidden = true;
    return;
  }
  nav.hidden = false;
  if (!btnKyc) return;
  btnKyc.textContent = 'Cuentas KYC — aprobar';
  try {
    const res = await fetch('/api/admin/users?status=pending', { headers: await adminHeaders() });
    const json = await res.json();
    if (res.ok) {
      const n = (json.data || []).length;
      btnKyc.textContent =
        n > 0 ? `Cuentas KYC — ${n} pendiente${n === 1 ? '' : 's'}` : 'Cuentas KYC — sin pendientes';
    }
  } catch (_e) {
    /* ignore */
  }
}

document.getElementById('admin-goto-kyc')?.addEventListener('click', () => scrollToAdminSection('kyc'));
document.getElementById('admin-goto-ops')?.addEventListener('click', () => scrollToAdminSection('ops'));

let adminKycTab = 'pending';

const ADMIN_KYC_EMPTY = {
  pending: 'No hay cuentas pendientes de aprobación.',
  approved: 'No hay cuentas aprobadas (embarcador/transportista).',
  rejected: 'No hay cuentas rechazadas.',
};

const CARRIER_RUBROS = [
  { id: '', label: '— Rubro —' },
  { id: 'construccion', label: 'Construcción / materiales' },
  { id: 'retail_alimentos', label: 'Retail / alimentos secos' },
  { id: 'refrigerados', label: 'Refrigerados / congelados' },
  { id: 'retail_general', label: 'Retail / carga general' },
  { id: 'quimicos', label: 'Químicos / especial' },
];

const INSURANCE_LEVELS = [
  { id: '', label: '— Seguro —' },
  { id: 'A', label: 'A — Básico' },
  { id: 'B', label: 'B — Rubro' },
  { id: 'C', label: 'C — Especial' },
];

async function adminHeaders() {
  return typeof Auth !== 'undefined' ? Auth.headers() : {};
}

function setAdminKycTab(tab) {
  adminKycTab = tab;
  document.querySelectorAll('[data-admin-kyc-tab]').forEach((btn) => {
    const active = btn.dataset.adminKycTab === tab;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  refreshAdminKycPanel();
}

function adminKycRoleLabel(role) {
  return typeof roleLabel === 'function' ? roleLabel(role) : role;
}

function renderAdminKycActions(u, tab) {
  if (tab === 'pending') {
    const incomplete =
      u.role === 'carrier' && u.onboarding_progress && !u.onboarding_progress.complete;
    const disabled = incomplete
      ? ' disabled title="Completa checklist C3a (7/7) antes de aprobar"'
      : '';
    return `
      <button type="button" class="btn-secondary" data-kyc-approve="${u.id}"${disabled}>Aprobar</button>
      <button type="button" class="btn-danger" data-kyc-reject="${u.id}">Rechazar</button>`;
  }
  if (tab === 'approved') {
    return `
      <button type="button" class="btn-danger" data-kyc-reject="${u.id}">Rechazar</button>
      <button type="button" class="btn-secondary" data-kyc-pending="${u.id}">Volver a pendiente</button>`;
  }
  return `
      <button type="button" class="btn-secondary" data-kyc-approve="${u.id}">Aprobar</button>
      <button type="button" class="btn-secondary" data-kyc-pending="${u.id}">Volver a pendiente</button>`;
}

function onboardingProgressLabel(u) {
  const p = u.onboarding_progress;
  if (!p) return '';
  const tone = p.complete ? 'pill-done' : 'pill-warn';
  return `<span class="pill ${tone}">Checklist ${p.done}/${p.total}</span>`;
}

function renderCarrierOnboardingForm(u) {
  if (u.role !== 'carrier') return '';
  const rubroOpts = CARRIER_RUBROS.map(
    (r) =>
      `<option value="${r.id}" ${u.carrier_rubro === r.id ? 'selected' : ''}>${r.label}</option>`
  ).join('');
  const insOpts = INSURANCE_LEVELS.map(
    (r) =>
      `<option value="${r.id}" ${u.insurance_level === r.id ? 'selected' : ''}>${r.label}</option>`
  ).join('');
  const chk = (field) => (u[field] ? 'checked' : '');
  const dateVal = (field) => escapeHtml(u[field] || '');
  const legalRows = [
    { check: 'onboarding_doc_ci', expiry: 'doc_ci_expires_at', label: 'CI — cédula' },
    { check: 'onboarding_doc_license', expiry: 'doc_license_expires_at', label: 'Licencia de conducir' },
    { check: 'onboarding_doc_soap', expiry: 'doc_soap_expires_at', label: 'SOAP' },
    { check: 'onboarding_doc_insurance', expiry: 'doc_insurance_expires_at', label: 'Seguro RC/carga' },
  ]
    .map(
      (row) => `
        <div class="admin-legal-doc-row">
          <label class="admin-legal-doc-check">
            <input type="checkbox" data-onb-field="${row.check}" ${chk(row.check)} />
            ${row.label} <span class="muted">recibido y legible</span>
          </label>
          <label class="admin-legal-doc-date">Vence (fecha en documento)
            <input type="date" data-onb-field="${row.expiry}" value="${dateVal(row.expiry)}" />
          </label>
        </div>`
    )
    .join('');
  return `
    <div class="admin-onboarding" data-onboarding-card="${u.id}">
      <p class="admin-onboarding-title"><strong>Checklist C3a</strong> — docs vía WhatsApp (piloto manual)</p>
      <p class="muted admin-onboarding-lead">
        <strong>Regla:</strong> RUT y fechas de vencimiento deben tomarse del <em>documento legal</em> recibido por WhatsApp (no inventar fechas).
        Marca ☑ solo si revisaste la foto/PDF. OCR automático: roadmap O2.
      </p>
      <fieldset class="admin-legal-docs">
        <legend>Documentación legal verificada</legend>
        <label class="admin-legal-rut">RUT titular (como en cédula)
          <input type="text" data-onb-field="national_rut" value="${escapeHtml(u.national_rut || '')}" placeholder="12.345.678-9" />
        </label>
        ${legalRows}
      </fieldset>
      ${u.docs_compliance_status ? `<p class="muted">Estado vencimientos: <strong>${escapeHtml(u.docs_compliance_status)}</strong></p>` : ''}
      <div class="admin-onboarding-grid">
        <label>Rubro <select data-onb-field="carrier_rubro">${rubroOpts}</select></label>
        <label>Nivel seguro <select data-onb-field="insurance_level">${insOpts}</select></label>
        <label>Tipo flota <input type="text" data-onb-field="carrier_fleet_type" value="${escapeHtml(u.carrier_fleet_type || '')}" placeholder="tolva, semi, furgón…" /></label>
        <label>Patente(s) <input type="text" data-onb-field="onboarding_vehicle_plates" value="${escapeHtml(u.onboarding_vehicle_plates || '')}" placeholder="ABCD12, EFGH34" /></label>
      </div>
      <label class="admin-onboarding-notes">Notas admin (link Drive, nº póliza, observaciones legales)
        <textarea data-onb-field="onboarding_notes" rows="2" placeholder="Link Drive, observaciones…">${escapeHtml(u.onboarding_notes || '')}</textarea>
      </label>
      <div class="actions">
        <button type="button" class="btn-secondary" data-save-onboarding="${u.id}">Guardar checklist</button>
      </div>
    </div>`;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function readOnboardingPayload(card) {
  if (!card) return {};
  const payload = {};
  card.querySelectorAll('[data-onb-field]').forEach((el) => {
    const key = el.dataset.onbField;
    if (el.type === 'checkbox') payload[key] = el.checked;
    else payload[key] = el.value;
  });
  return payload;
}

async function refreshAdminKycPanel() {
  const panel = document.getElementById('admin-kyc-panel');
  const list = document.getElementById('admin-kyc-list');
  if (!panel || !list) return;
  const user = typeof Auth !== 'undefined' ? Auth.user : null;
  if (!user || user.role !== 'admin') {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  list.innerHTML = '<p class="muted">Cargando cuentas…</p>';
  try {
    const res = await fetch(`/api/admin/users?status=${adminKycTab}`, {
      headers: await adminHeaders(),
    });
    const json = await res.json();
    if (!res.ok) {
      list.innerHTML = `<p class="muted">${json.error || 'Error al cargar'}</p>`;
      return;
    }
    const rows = json.data || [];
    if (!rows.length) {
      list.innerHTML = `<p class="muted">${ADMIN_KYC_EMPTY[adminKycTab] || 'Sin resultados.'}</p>`;
      return;
    }
    list.innerHTML = rows
      .map(
        (u) => `
      <article class="item admin-kyc-item">
        <strong>${escapeHtml(u.company_name || '—')}</strong>
        <span class="pill">${adminKycRoleLabel(u.role)}</span>
        <span class="pill pill-muted">${u.kyc_status}</span>
        ${onboardingProgressLabel(u)}
        <p class="muted">${escapeHtml(u.full_name)} · ${escapeHtml(u.email)}${u.phone ? ` · ${escapeHtml(u.phone)}` : ''}</p>
        ${renderCarrierOnboardingForm(u)}
        <div class="actions">
          ${renderAdminKycActions(u, adminKycTab)}
        </div>
      </article>`
      )
      .join('');
  } catch (e) {
    console.error(e);
    list.innerHTML = '<p class="muted">No se pudo conectar.</p>';
  }
}

async function patchKyc(userId, kyc_status, force) {
  const res = await fetch(`/api/admin/users/${userId}/kyc`, {
    method: 'PATCH',
    headers: await adminHeaders(),
    body: JSON.stringify({ kyc_status, force: !!force }),
  });
  const json = await res.json();
  if (res.status === 409 && json.code === 'onboarding_incomplete') {
    const msg = `${json.error}\n\n¿Aprobar igual? (solo si falta un ítem menor)`;
    if (confirm(msg)) {
      return patchKyc(userId, kyc_status, true);
    }
    return;
  }
  if (res.status === 409 && json.code === 'legal_docs_incomplete') {
    alert(json.error || 'Completa RUT y fechas según documentos legales antes de aprobar.');
    return;
  }
  if (!res.ok) {
    alert(json.error || 'No se pudo actualizar');
    return;
  }
  alert(json.message || 'Actualizado');
  refreshAdminKycPanel();
  refreshAdminHubNav();
}

async function saveOnboarding(userId, card) {
  const payload = readOnboardingPayload(card);
  const res = await fetch(`/api/admin/users/${userId}/onboarding`, {
    method: 'PATCH',
    headers: await adminHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) {
    alert(json.error || 'No se pudo guardar');
    return;
  }
  alert(json.message || 'Checklist guardado');
  refreshAdminKycPanel();
}

document.getElementById('admin-kyc-tabs')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-admin-kyc-tab]');
  if (!btn) return;
  setAdminKycTab(btn.dataset.adminKycTab);
});

document.getElementById('admin-kyc-refresh')?.addEventListener('click', refreshAdminKycPanel);

document.getElementById('admin-backfill-owners')?.addEventListener('click', async () => {
  if (!confirm('¿Vincular cargas y ofertas sin dueño a usuarios con el mismo nombre de empresa?')) return;
  try {
    const res = await fetch('/api/admin/backfill-owners', {
      method: 'POST',
      headers: await adminHeaders(),
    });
    const json = await res.json();
    alert(json.message || json.error || 'Listo');
  } catch (e) {
    console.error(e);
    alert('No se pudo conectar.');
  }
});

document.getElementById('admin-kyc-list')?.addEventListener('click', (e) => {
  const approve = e.target.closest('[data-kyc-approve]');
  const reject = e.target.closest('[data-kyc-reject]');
  const pending = e.target.closest('[data-kyc-pending]');
  const saveBtn = e.target.closest('[data-save-onboarding]');
  if (saveBtn) {
    const card = saveBtn.closest('[data-onboarding-card]');
    saveOnboarding(saveBtn.dataset.saveOnboarding, card);
    return;
  }
  if (approve) patchKyc(approve.dataset.kycApprove, 'approved');
  if (reject) patchKyc(reject.dataset.kycReject, 'rejected');
  if (pending) patchKyc(pending.dataset.kycPending, 'pending');
});

window.refreshAdminKycPanel = refreshAdminKycPanel;
window.refreshAdminHubNav = refreshAdminHubNav;
window.scrollToAdminSection = scrollToAdminSection;

function formatAdminClp(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return `$${Math.round(v).toLocaleString('es-CL')}`;
}

function adminOpsQuery() {
  return {
    corridor: document.getElementById('admin-ops-corridor')?.value || 'all',
    status: document.getElementById('admin-ops-status')?.value || 'all',
  };
}

function renderAdminKpiCards(summary, liquidity) {
  const c = summary.counts || {};
  const liq = summary.liquidity_week || liquidity || {};
  const targets = liq.targets || { loads_min: 3, offers_min: 2 };
  const cards = [
    { label: 'Viajes (filtro)', value: c.total ?? 0 },
    { label: 'En curso / propuestos', value: (c.active ?? 0) + (c.proposed ?? 0) },
    { label: 'Completados', value: c.completed ?? 0 },
    { label: 'Cancelados', value: c.cancelled ?? 0 },
    { label: 'GMV completados', value: formatAdminClp(summary.gmv_clp) },
    {
      label: `Ingreso est. (${summary.take_rate_percent || 13.5}%)`,
      value: formatAdminClp(summary.revenue_estimated_clp),
    },
    {
      label: 'Match rate',
      value: summary.match_rate_percent != null ? `${summary.match_rate_percent}%` : '—',
    },
    {
      label: 'Cancel. post-asignación',
      value:
        summary.cancel_post_accepted_percent != null
          ? `${summary.cancel_post_accepted_percent}%`
          : '—',
    },
    {
      label: 'Mediana h → match',
      value:
        summary.median_hours_to_match != null ? `${summary.median_hours_to_match} h` : '—',
    },
    {
      label: '★ embarcador → transp.',
      value: summary.avg_stars_shipper_rates_carrier ?? '—',
    },
    {
      label: '★ transportista → emb.',
      value: summary.avg_stars_carrier_rates_shipper ?? '—',
    },
    { label: 'KYC pendientes', value: summary.pending_kyc ?? 0 },
    {
      label: 'Liquidez 7 d (cargas / ofertas)',
      value: `${liq.published_loads ?? 0} / ${liq.published_offers ?? 0}`,
      hint: `Meta semanal ≥${targets.loads_min} / ≥${targets.offers_min}`,
    },
  ];
  return cards
    .map(
      (card) => `
    <div class="admin-kpi-card">
      <strong>${card.value}</strong>
      <span>${card.label}${card.hint ? `<br />${card.hint}` : ''}</span>
    </div>`
    )
    .join('');
}

function renderAdminTripsTable(rows) {
  if (!rows.length) return '<p class="muted">No hay viajes con estos filtros.</p>';
  const head = `
    <thead><tr>
      <th>Estado</th><th>Ruta</th><th>Embarcador</th><th>Transportista</th>
      <th>Precio</th><th>★ E→T</th><th>★ T→E</th><th>Actualizado</th>
    </tr></thead>`;
  const body = rows
    .map((t) => {
      const dt = t.updated_at ? new Date(t.updated_at).toLocaleString('es-CL') : '—';
      const pilot = t.pilot_corridor ? ' <span class="pill-pilot">piloto</span>' : '';
      return `<tr>
        <td>${t.status_label}${pilot}</td>
        <td>${t.route}</td>
        <td>${t.shipper}</td>
        <td>${t.carrier}</td>
        <td>${t.agreed_price_label}</td>
        <td>${t.stars_shipper ?? '—'}</td>
        <td>${t.stars_carrier ?? '—'}</td>
        <td>${dt}</td>
      </tr>`;
    })
    .join('');
  return `<table class="admin-ops-table">${head}<tbody>${body}</tbody></table>`;
}

async function refreshAdminOpsPanel() {
  const panel = document.getElementById('admin-ops-panel');
  const kpisEl = document.getElementById('admin-ops-kpis');
  const tripsEl = document.getElementById('admin-ops-trips');
  if (!panel || !kpisEl || !tripsEl) return;
  const user = typeof Auth !== 'undefined' ? Auth.user : null;
  if (!user || user.role !== 'admin') {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  kpisEl.innerHTML = '<p class="muted">Cargando métricas…</p>';
  tripsEl.innerHTML = '';
  const q = adminOpsQuery();
  const qs = new URLSearchParams();
  if (q.corridor !== 'all') qs.set('corridor', q.corridor);
  if (q.status !== 'all') qs.set('status', q.status);
  try {
    const headers = await adminHeaders();
    const [dashRes, tripsRes] = await Promise.all([
      fetch(`/api/admin/dashboard?${qs}`, { headers }),
      fetch(`/api/admin/trips?${qs}&limit=80`, { headers }),
    ]);
    const dash = await dashRes.json();
    const trips = await tripsRes.json();
    if (!dashRes.ok) {
      kpisEl.innerHTML = `<p class="muted">${dash.error || 'Error KPIs'}</p>`;
      return;
    }
    kpisEl.innerHTML = renderAdminKpiCards(dash.summary, dash.liquidity);
    if (!tripsRes.ok) {
      tripsEl.innerHTML = `<p class="muted">${trips.error || 'Error viajes'}</p>`;
      return;
    }
    tripsEl.innerHTML = renderAdminTripsTable(trips.data || []);
  } catch (e) {
    console.error(e);
    kpisEl.innerHTML = '<p class="muted">No se pudo conectar.</p>';
  }
}

document.getElementById('admin-ops-refresh')?.addEventListener('click', refreshAdminOpsPanel);
document.getElementById('admin-ops-corridor')?.addEventListener('change', refreshAdminOpsPanel);
document.getElementById('admin-ops-status')?.addEventListener('change', refreshAdminOpsPanel);

window.refreshAdminOpsPanel = refreshAdminOpsPanel;
