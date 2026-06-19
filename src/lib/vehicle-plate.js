'use strict';

/** Normaliza patente chilena (sin espacios ni guiones). */
function normalizeVehiclePlate(input) {
  return String(input || '')
    .trim()
    .toUpperCase()
    .replace(/[\s.\-]/g, '');
}

function validateVehiclePlate(input) {
  const plate = normalizeVehiclePlate(input);
  if (!plate || plate.length < 5 || plate.length > 8) {
    return { ok: false, error: 'Patente inválida (5–8 caracteres)' };
  }
  if (!/^[A-Z0-9]+$/.test(plate)) {
    return { ok: false, error: 'Patente inválida (solo letras y números)' };
  }
  return { ok: true, plate };
}

module.exports = { normalizeVehiclePlate, validateVehiclePlate };
