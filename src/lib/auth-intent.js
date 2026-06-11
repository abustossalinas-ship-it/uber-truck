'use strict';

const ROLE_LABEL = {
  shipper: 'Embarcador',
  carrier: 'Transportista',
  admin: 'Administrador',
};

function normalizeLoginIntentRole(raw) {
  const r = String(raw ?? '')
    .toLowerCase()
    .trim();
  if (!r) return null;
  if (r === 'carrier' || r === 'transportista' || r === 'transportador') return 'carrier';
  if (r === 'shipper' || r === 'embarcador' || r === 'embarcadora') return 'shipper';
  return null;
}

function normalizeAccountRole(role) {
  const r = String(role ?? '')
    .toLowerCase()
    .trim();
  if (r === 'carrier' || r === 'transportista' || r === 'transportador') return 'carrier';
  if (r === 'shipper' || r === 'embarcador' || r === 'embarcadora') return 'shipper';
  if (r === 'admin' || r === 'administrador') return 'admin';
  return r || null;
}

function readIntentFromBody(body = {}) {
  return normalizeLoginIntentRole(body.intent_role ?? body.role);
}

function assertLoginIntentRole(user, body = {}) {
  const intent = readIntentFromBody(body);
  if (!intent) return;
  const actual = normalizeAccountRole(user?.role);
  if (!actual || actual === 'admin' || actual === intent) return;
  const label = ROLE_LABEL[actual] || actual;
  const err = new Error(
    `Esta cuenta es de ${label}. Cambiamos la pestaña de arriba — vuelve a ingresar tu contraseña.`
  );
  err.status = 403;
  err.code = 'role_mismatch';
  err.actual_role = actual;
  throw err;
}

module.exports = {
  ROLE_LABEL,
  normalizeLoginIntentRole,
  normalizeAccountRole,
  readIntentFromBody,
  assertLoginIntentRole,
};
