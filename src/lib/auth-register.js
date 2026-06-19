'use strict';

const { validateRut } = require('./rut-chile');
const { validateVehiclePlate } = require('./vehicle-plate');

function validateCarrierRegistrationFields({ national_rut, vehicle_plates }) {
  const rut = validateRut(national_rut);
  if (!rut.ok) {
    return { ok: false, error: rut.error || 'RUT inválido' };
  }
  const plate = validateVehiclePlate(vehicle_plates);
  if (!plate.ok) {
    return { ok: false, error: plate.error || 'Patente inválida' };
  }
  return {
    ok: true,
    national_rut: rut.rut,
    vehicle_plates: plate.plate,
  };
}

module.exports = { validateCarrierRegistrationFields };
