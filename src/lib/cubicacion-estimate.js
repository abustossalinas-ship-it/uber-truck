'use strict';

/** Densidad típica por tipo de mercancía (referencia Chile pallet estándar ~1,2 m³) */
const CARGO_DENSITY = {
  light: { id: 'light', label: 'Liviana (snacks, papel, pañales)', kgPerPallet: 400, kgPerM3: 333 },
  normal: { id: 'normal', label: 'Normal (retail mixto)', kgPerPallet: 800, kgPerM3: 667 },
  heavy: { id: 'heavy', label: 'Pesada (bebidas, construcción)', kgPerPallet: 1200, kgPerM3: 1000 },
};

const STANDARD_PALLET_M3 = 1.2;

/**
 * Peso estimado: volumen y pallets miden espacio; el peso depende de la densidad.
 * Se usa el mayor entre pallets×kg/pallet y m³×kg/m³ (no sumar ambos para no duplicar).
 */
function estimateWeightKg({ pallets, volume_m3, densityId }) {
  const d = CARGO_DENSITY[densityId] || CARGO_DENSITY.normal;
  const p = Number(pallets) || 0;
  const v = Number(volume_m3) || 0;
  const fromPallets = p > 0 ? p * d.kgPerPallet : 0;
  const fromVol = v > 0 ? v * d.kgPerM3 : 0;
  if (fromPallets <= 0 && fromVol <= 0) return null;
  return Math.round(Math.max(fromPallets, fromVol));
}

function densityOptions() {
  return Object.values(CARGO_DENSITY).map((d) => ({
    id: d.id,
    label: d.label,
    kg_per_pallet: d.kgPerPallet,
    kg_per_m3: d.kgPerM3,
  }));
}

module.exports = {
  CARGO_DENSITY,
  STANDARD_PALLET_M3,
  estimateWeightKg,
  densityOptions,
};
