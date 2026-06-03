/** Única cuenta con acceso completo (todas las opciones en app y web). */
const CUBIK_SUPER_ADMIN_EMAIL = 'admin@cubik.cl';

/** Etiquetas de rol en español (UI). Código interno: shipper | carrier */
const ROLE_LABEL = {
  shipper: 'Embarcador',
  carrier: 'Transportista',
  admin: 'Administrador',
};

function normalizeAppRole(role) {
  const r = String(role || '')
    .toLowerCase()
    .trim();
  if (r === 'shipper' || r === 'embarcador' || r === 'embarcadora') return 'shipper';
  if (r === 'carrier' || r === 'transportista' || r === 'transportador') return 'carrier';
  if (r === 'admin' || r === 'administrador') return 'admin';
  return r || 'guest';
}

function roleLabel(role) {
  const key = normalizeAppRole(role);
  return ROLE_LABEL[key] || role || '';
}

function isCubikSuperAdmin(user) {
  return String(user?.email || '').toLowerCase().trim() === CUBIK_SUPER_ADMIN_EMAIL;
}

/** Inicio y Opciones en app móvil: embarcador solo Publicar carga; transportista solo Ofertar ruta. */
function applyAppShellRole(user) {
  const role = user ? normalizeAppRole(user.role) : 'guest';
  const superAdmin = isCubikSuperAdmin(user);
  if (document.body.classList.contains('cubik-app')) {
    document.body.dataset.appRole = role;
    if (superAdmin) document.body.dataset.appSuperAdmin = '1';
    else delete document.body.dataset.appSuperAdmin;
  } else {
    delete document.body.dataset.appRole;
    delete document.body.dataset.appSuperAdmin;
  }

  const showShipper = role === 'shipper' || superAdmin;
  const showCarrier = role === 'carrier' || superAdmin;

  const quickShipper = document.getElementById('app-quick-shipper');
  const quickCarrier = document.getElementById('app-quick-carrier');
  const optShipper = document.getElementById('app-opt-shipper');
  const optCarrier = document.getElementById('app-opt-carrier');

  if (quickShipper) quickShipper.hidden = !showShipper;
  if (quickCarrier) quickCarrier.hidden = !showCarrier;
  if (optShipper) optShipper.hidden = !showShipper;
  if (optCarrier) optCarrier.hidden = !showCarrier;

  return role;
}

window.CUBIK_SUPER_ADMIN_EMAIL = CUBIK_SUPER_ADMIN_EMAIL;
window.ROLE_LABEL = ROLE_LABEL;
window.roleLabel = roleLabel;
window.normalizeAppRole = normalizeAppRole;
window.isCubikSuperAdmin = isCubikSuperAdmin;
window.applyAppShellRole = applyAppShellRole;
