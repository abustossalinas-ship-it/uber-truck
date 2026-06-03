'use strict';

const { TRUCK_TYPES, capacityForTruck } = require('./truck-capacity');

function truckById(id) {
  return TRUCK_TYPES.find((t) => t.id === id) || null;
}

function validateOfferCapacityBody(body) {
  const errors = [];
  const truck = truckById(body.truck_type_id?.trim());
  if (!truck) errors.push('Indica el tipo de camión con el que ofreces el viaje.');
  const pallets = Number(body.available_pallets);
  if (!pallets || pallets < 1) errors.push('Indica cuántos pallets puedes llevar (mín. 1).');
  if (truck && pallets > 0) {
    const stackable =
      body.cargo_stackable === true ||
      body.cargo_stackable === '1' ||
      body.cargo_stackable === 1 ||
      body.cargo_stackable === 'on';
    const cap = capacityForTruck(truck, body.pallet_type || 'euro', stackable);
    if (pallets > cap) {
      errors.push(
        `Supera la capacidad de tu ${truck.label}: máximo ${cap} pallets${stackable ? ' remontables' : ''}. Reduce pallets o usa otro camión.`
      );
    }
    const w = Number(body.max_weight_kg);
    if (w > 0 && w > truck.weight_kg_max) {
      errors.push(
        `El peso máximo supera ~${truck.weight_kg_max.toLocaleString('es-CL')} kg de tu ${truck.label}.`
      );
    }
  }
  return errors;
}

function offerCapacityPayload(body) {
  const truck = truckById(body.truck_type_id?.trim());
  const stackable =
    body.cargo_stackable === true ||
    body.cargo_stackable === '1' ||
    body.cargo_stackable === 1 ||
    body.cargo_stackable === 'on';
  return {
    available_pallets: body.available_pallets != null ? Number(body.available_pallets) : null,
    pallet_type: ['euro', 'american'].includes(body.pallet_type) ? body.pallet_type : 'euro',
    cargo_stackable: stackable,
    truck_type_id: truck?.id || body.truck_type_id?.trim() || null,
    truck_type_label: truck?.label || body.truck_type_label?.trim() || null,
  };
}

module.exports = { validateOfferCapacityBody, offerCapacityPayload, truckById };
