'use strict';

const maps = require('../services/google-maps');
const { addressQualityError, isSpecificAddress, parsePlaceTypes } = require('./geo-address-quality');

function hasValidatedAddress(body, role) {
  const lat = body[`${role}_lat`];
  const lng = body[`${role}_lng`];
  const addr = body[`${role}_address`];
  const placeId = body[`${role}_place_id`];
  return (
    lat != null &&
    lat !== '' &&
    lng != null &&
    lng !== '' &&
    !Number.isNaN(Number(lat)) &&
    !Number.isNaN(Number(lng)) &&
    typeof addr === 'string' &&
    addr.trim().length > 0 &&
    typeof placeId === 'string' &&
    placeId.trim().length > 0
  );
}

/** Si Maps está configurado, origen y destino deben venir de una sugerencia elegida y ser puntuales. */
function requireMapsAddresses(body) {
  if (!maps.isConfigured()) return [];
  const errors = [];
  if (!hasValidatedAddress(body, 'origin')) {
    errors.push('Origen: elige una dirección real desde «Buscar dirección» (lista de Google Maps).');
  } else {
    const q = addressQualityError('origin', body.origin_place_types);
    if (q) errors.push(q);
  }
  if (!hasValidatedAddress(body, 'destination')) {
    errors.push('Destino: elige una dirección real desde «Buscar dirección» (lista de Google Maps).');
  } else {
    const q = addressQualityError('destination', body.destination_place_types);
    if (q) errors.push(q);
  }
  return errors;
}

module.exports = { hasValidatedAddress, requireMapsAddresses, isSpecificAddress, parsePlaceTypes };
