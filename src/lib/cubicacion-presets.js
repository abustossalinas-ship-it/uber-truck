'use strict';

/** Presets de cubicación para embarcador (demanda) */
const LOAD_PRESETS = [
  { id: 'p1', label: '1 pallet estándar (~1.2 m³)', volume_m3: 1.2, pallets: 1, weight_kg: 800 },
  { id: 'p2', label: '2 pallets (~2.4 m³)', volume_m3: 2.4, pallets: 2, weight_kg: 1600 },
  { id: 'p4', label: '4 pallets (~4.8 m³)', volume_m3: 4.8, pallets: 4, weight_kg: 3200 },
  { id: 'p6', label: '6 pallets (~7 m³)', volume_m3: 7, pallets: 6, weight_kg: 4800 },
  { id: 'ltl', label: 'Carga parcial LTL (~12 m³)', volume_m3: 12, pallets: 8, weight_kg: 6000 },
  { id: 'custom', label: 'Personalizado (editar abajo)', volume_m3: null, pallets: null, weight_kg: null },
];

/** Presets de espacio libre para transportista (oferta) */
const OFFER_PRESETS = [
  { id: 's4', label: '4 m³ libres', free_volume_m3: 4, max_weight_kg: 2500 },
  { id: 's8', label: '8 m³ libres', free_volume_m3: 8, max_weight_kg: 5000 },
  { id: 's15', label: '15 m³ (medio camión)', free_volume_m3: 15, max_weight_kg: 9000 },
  { id: 's30', label: '30 m³ (camión completo)', free_volume_m3: 30, max_weight_kg: 18000 },
  { id: 'custom', label: 'Personalizado', free_volume_m3: null, max_weight_kg: null },
];

module.exports = { LOAD_PRESETS, OFFER_PRESETS };
