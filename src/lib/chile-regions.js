'use strict';

/** Mapeo nombre Google → código corto usado en filtros */
const REGION_BY_NAME = {
  'región metropolitana de santiago': 'RM',
  'región metropolitana': 'RM',
  "libertador general bernardo o'higgins": 'VI',
  'valparaíso': 'V',
  "o'higgins": 'VI',
  maule: 'VII',
  biobío: 'VIII',
  'araucanía': 'IX',
  'los lagos': 'X',
  'los ríos': 'XIV',
  'aysén': 'XI',
  'magallanes y la antártica chilena': 'XII',
  'arica y parinacota': 'XV',
  tarapacá: 'I',
  antofagasta: 'II',
  atacama: 'III',
  coquimbo: 'IV',
  ñuble: 'XVI',
};

function regionCodeFromGoogleName(name) {
  if (!name) return '';
  const key = name.trim().toLowerCase();
  if (REGION_BY_NAME[key]) return REGION_BY_NAME[key];
  if (key.includes('metropolitana')) return 'RM';
  if (key.startsWith('región ')) {
    const short = key.replace('región ', '').slice(0, 12);
    for (const [k, v] of Object.entries(REGION_BY_NAME)) {
      if (k.includes(short) || short.includes(k.slice(0, 6))) return v;
    }
  }
  return name.slice(0, 10).toUpperCase();
}

function parseAddressComponents(components = []) {
  const get = (type) => components.find((c) => c.types.includes(type))?.long_name || '';
  const commune =
    get('locality') ||
    get('administrative_area_level_3') ||
    get('sublocality') ||
    get('administrative_area_level_2');
  const city = get('administrative_area_level_2') || get('locality') || commune;
  const regionName = get('administrative_area_level_1');
  return {
    commune,
    city,
    region: regionCodeFromGoogleName(regionName),
    region_name: regionName,
  };
}

module.exports = { regionCodeFromGoogleName, parseAddressComponents, REGION_BY_NAME };
