'use strict';

function normalizeOrgName(name) {
  return (name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,]/g, '');
}

/** Carga pertenece al embarcador (JWT o nombre empresa legacy). */
function loadBelongsToUser(load, user) {
  if (!load || !user || user.role !== 'shipper') return false;
  if (load.shipper_user_id) return load.shipper_user_id === user.sub;
  const u = normalizeOrgName(user.company_name);
  const c = normalizeOrgName(load.company_name);
  return Boolean(u && c && u === c);
}

/** Oferta pertenece al transportista (JWT o nombre flota legacy). */
function offerBelongsToUser(offer, user) {
  if (!offer || !user || user.role !== 'carrier') return false;
  if (offer.carrier_user_id) return offer.carrier_user_id === user.sub;
  const u = normalizeOrgName(user.company_name);
  const c = normalizeOrgName(offer.carrier_name);
  return Boolean(u && c && u === c);
}

module.exports = { normalizeOrgName, loadBelongsToUser, offerBelongsToUser };
