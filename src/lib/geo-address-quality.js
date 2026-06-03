'use strict';

/** Tipos Google que no bastan para retiro/entrega logístico (solo ciudad/región). */
const VAGUE_ONLY_TYPES = new Set([
  'locality',
  'administrative_area_level_1',
  'administrative_area_level_2',
  'administrative_area_level_3',
  'political',
  'country',
  'colloquial_area',
]);

/** Tipos que indican punto concreto (calle, bodega, puerto, planta). */
const SPECIFIC_TYPES = new Set([
  'street_address',
  'route',
  'premise',
  'subpremise',
  'establishment',
  'point_of_interest',
  'store',
  'storage',
  'warehouse',
  'transit_station',
]);

function parsePlaceTypes(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value !== 'string' || !value.trim()) return [];
  return value.split(',').map((t) => t.trim()).filter(Boolean);
}

function isSpecificAddress(placeTypes) {
  const types = parsePlaceTypes(placeTypes);
  if (!types.length) return false;
  if (types.some((t) => SPECIFIC_TYPES.has(t))) return true;
  const nonVague = types.filter((t) => !VAGUE_ONLY_TYPES.has(t) && t !== 'geocode');
  return nonVague.length > 0;
}

function addressQualityError(role, placeTypes) {
  const label = role === 'origin' ? 'Origen' : 'Destino';
  if (!parsePlaceTypes(placeTypes).length) {
    return `${label}: elige una dirección desde «Buscar dirección» (lista de Google Maps).`;
  }
  if (!isSpecificAddress(placeTypes)) {
    return `${label}: la dirección es muy genérica (ej. solo «Arica» o una comuna). Indica calle, bodega, planta o puerto concreto.`;
  }
  return null;
}

module.exports = {
  VAGUE_ONLY_TYPES,
  SPECIFIC_TYPES,
  parsePlaceTypes,
  isSpecificAddress,
  addressQualityError,
};
