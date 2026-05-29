/** Panel admin — aprobar cuentas del piloto */

let adminKycTab = 'pending';

const ADMIN_KYC_EMPTY = {
  pending: 'No hay cuentas pendientes de aprobación.',
  approved: 'No hay cuentas aprobadas (embarcador/transportista).',
  rejected: 'No hay cuentas rechazadas.',
};

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
    return `
      <button type="button" class="btn-secondary" data-kyc-approve="${u.id}">Aprobar</button>
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
        <strong>${u.company_name || '—'}</strong>
        <span class="pill">${adminKycRoleLabel(u.role)}</span>
        <span class="pill pill-muted">${u.kyc_status}</span>
        <p class="muted">${u.full_name} · ${u.email}</p>
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

async function patchKyc(userId, kyc_status) {
  const res = await fetch(`/api/admin/users/${userId}/kyc`, {
    method: 'PATCH',
    headers: await adminHeaders(),
    body: JSON.stringify({ kyc_status }),
  });
  const json = await res.json();
  if (!res.ok) {
    alert(json.error || 'No se pudo actualizar');
    return;
  }
  alert(json.message || 'Actualizado');
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
  if (approve) patchKyc(approve.dataset.kycApprove, 'approved');
  if (reject) patchKyc(reject.dataset.kycReject, 'rejected');
  if (pending) patchKyc(pending.dataset.kycPending, 'pending');
});

window.refreshAdminKycPanel = refreshAdminKycPanel;
