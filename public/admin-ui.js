/** Panel admin — aprobar cuentas del piloto */

async function adminHeaders() {
  return typeof Auth !== 'undefined' ? Auth.headers() : {};
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
  list.innerHTML = '<p class="muted">Cargando solicitudes…</p>';
  try {
    const res = await fetch('/api/admin/users?status=pending', { headers: await adminHeaders() });
    const json = await res.json();
    if (!res.ok) {
      list.innerHTML = `<p class="muted">${json.error || 'Error al cargar'}</p>`;
      return;
    }
    const rows = json.data || [];
    if (!rows.length) {
      list.innerHTML = '<p class="muted">No hay cuentas pendientes de aprobación.</p>';
      return;
    }
    list.innerHTML = rows
      .map(
        (u) => `
      <article class="item admin-kyc-item">
        <strong>${u.company_name || '—'}</strong>
        <span class="pill">${u.role}</span>
        <p class="muted">${u.full_name} · ${u.email}</p>
        <div class="actions">
          <button type="button" class="btn-secondary" data-kyc-approve="${u.id}">Aprobar</button>
          <button type="button" class="btn-danger" data-kyc-reject="${u.id}">Rechazar</button>
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

document.getElementById('admin-kyc-refresh')?.addEventListener('click', refreshAdminKycPanel);

document.getElementById('admin-kyc-list')?.addEventListener('click', (e) => {
  const approve = e.target.closest('[data-kyc-approve]');
  const reject = e.target.closest('[data-kyc-reject]');
  if (approve) patchKyc(approve.dataset.kycApprove, 'approved');
  if (reject) patchKyc(reject.dataset.kycReject, 'rejected');
});

window.refreshAdminKycPanel = refreshAdminKycPanel;
