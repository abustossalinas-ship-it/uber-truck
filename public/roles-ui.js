/** Etiquetas de rol en español (UI). Código interno: shipper | carrier */
const ROLE_LABEL = {
  shipper: 'Embarcador',
  carrier: 'Transportista',
  admin: 'Administrador',
};

function roleLabel(role) {
  return ROLE_LABEL[role] || role || '';
}

window.ROLE_LABEL = ROLE_LABEL;
window.roleLabel = roleLabel;
