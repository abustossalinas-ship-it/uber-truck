'use strict';

/** Capacidades orientativas por tipo de camión (Chile, pallets en una capa). */
const TRUCK_TYPES = [
  { id: 'truck_34', label: 'Camión 3/4 (2 ejes)', europallet_max: 8, american_max: 6, weight_kg_max: 3500 },
  { id: 'truck_5t', label: 'Camión 5 ton', europallet_max: 12, american_max: 10, weight_kg_max: 5000 },
  { id: 'truck_8t', label: 'Camión 8 ton', europallet_max: 18, american_max: 14, weight_kg_max: 8000 },
  { id: 'torton', label: 'Tortón (3 ejes)', europallet_max: 20, american_max: 16, weight_kg_max: 15000 },
  { id: 'trailer', label: 'Tráiler 13,6 m', europallet_max: 33, american_max: 26, weight_kg_max: 24000 },
];

function palletCapKey(palletType) {
  return palletType === 'american' ? 'american_max' : 'europallet_max';
}

function capacityForTruck(truck, palletType, stackable) {
  const base = truck[palletCapKey(palletType)] || truck.europallet_max;
  return stackable ? base * 2 : base;
}

/**
 * Sugiere el camión más chico que cubre la carga; si no alcanza, indica viajes extra.
 */
function suggestTruckCapacity({ pallets, pallet_type = 'euro', stackable = false, weight_kg }) {
  const p = Number(pallets) || 0;
  if (p <= 0) {
    return { truck: null, trips_required: 0, capacity_per_trip: 0, exceeds_single: false, message: '' };
  }

  const stack = stackable === true || stackable === '1' || stackable === 1 || stackable === 'on';
  let suggested = null;
  let cap = 0;

  for (const t of TRUCK_TYPES) {
    cap = capacityForTruck(t, pallet_type, stack);
    if (p <= cap) {
      suggested = t;
      break;
    }
  }

  if (suggested) {
    const w = Number(weight_kg) || 0;
    const weightOk = !w || w <= suggested.weight_kg_max;
    return {
      truck: suggested,
      trips_required: 1,
      capacity_per_trip: cap,
      exceeds_single: false,
      weight_exceeds: !weightOk,
      message: weightOk
        ? `Camión sugerido: ${suggested.label} (hasta ${cap} pallets).`
        : `Camión sugerido: ${suggested.label}, pero el peso supera ~${suggested.weight_kg_max.toLocaleString('es-CL')} kg — revisa tonelaje.`,
    };
  }

  const biggest = TRUCK_TYPES[TRUCK_TYPES.length - 1];
  cap = capacityForTruck(biggest, pallet_type, stack);
  const trips = Math.ceil(p / cap);
  return {
    truck: biggest,
    trips_required: trips,
    capacity_per_trip: cap,
    exceeds_single: true,
    weight_exceeds: false,
    message: `Supera un ${biggest.label} (~${cap} pallets/viaje). Se sugieren ~${trips} viajes.`,
  };
}

module.exports = {
  TRUCK_TYPES,
  suggestTruckCapacity,
  capacityForTruck,
  palletCapKey,
};
