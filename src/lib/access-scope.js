'use strict';

const repo = require('./repository');
const { loadBelongsToUser, offerBelongsToUser } = require('./ownership');

/** Filtros de listado según rol (JWT: sub, role, company_name). */
function loadListFilters(user, query = {}) {
  const base = {};
  if (query.status) base.status = query.status;
  if (query.region) base.region = query.region;
  if (!user) return base;
  if (user.role === 'admin') return base;
  if (user.role === 'shipper') {
    return { ...base };
  }
  if (user.role === 'carrier') {
    return { ...base, status: query.status || 'published' };
  }
  return base;
}

function offerListFilters(user, query = {}) {
  const base = {};
  if (query.status) base.status = query.status;
  if (query.region) base.region = query.region;
  if (!user) return base;
  if (user.role === 'admin') return base;
  if (user.role === 'carrier') {
    return { ...base, status: query.status || 'published' };
  }
  if (user.role === 'shipper') {
    return { ...base, status: query.status || 'published' };
  }
  return base;
}

function filterLoadsForUser(rows, user) {
  if (!user || user.role === 'admin') return rows;
  if (user.role === 'shipper') return rows.filter((l) => loadBelongsToUser(l, user));
  return rows;
}

function filterOffersForUser(rows, user) {
  if (!user || user.role === 'admin') return rows;
  if (user.role === 'carrier') return rows.filter((o) => offerBelongsToUser(o, user));
  return rows;
}

async function filterMatchesForUser(matches, user) {
  if (!user || user.role === 'admin') return matches;
  const loads = await repo.list('load_requests', {});
  const offers = await repo.list('capacity_offers', {});
  const loadById = Object.fromEntries(loads.map((l) => [l.id, l]));
  const offerById = Object.fromEntries(offers.map((o) => [o.id, o]));
  return matches.filter((m) => {
    if (user.role === 'shipper') {
      return loadBelongsToUser(loadById[m.load_request_id], user);
    }
    if (user.role === 'carrier') {
      return offerBelongsToUser(offerById[m.capacity_offer_id], user);
    }
    return true;
  });
}

function assertCanPublishLoad(user) {
  if (!user) return 'Inicia sesión para publicar una carga';
  if (user.role === 'carrier') return 'Las cuentas transportista publican ofertas, no cargas';
  if (user.role === 'admin') return 'La cuenta administrador no publica cargas en este MVP';
  return null;
}

function assertCanPublishOffer(user) {
  if (!user) return 'Inicia sesión para publicar una oferta';
  if (user.role === 'shipper') return 'Las cuentas embarcadoras publican cargas, no ofertas';
  if (user.role === 'admin') return 'La cuenta administrador no publica ofertas en este MVP';
  return null;
}

function assertCanMatchLoad(user, load) {
  if (!user || user.role === 'admin') return null;
  if (user.role === 'shipper' && !loadBelongsToUser(load, user)) {
    return 'Solo puedes emparejar cargas de tu empresa';
  }
  return null;
}

function assertCanMatchOffer(user, offer) {
  if (!user || user.role === 'admin') return null;
  if (user.role === 'carrier' && !offerBelongsToUser(offer, user)) {
    return 'Solo puedes emparejar usando tus ofertas';
  }
  return null;
}

module.exports = {
  loadListFilters,
  offerListFilters,
  filterLoadsForUser,
  filterOffersForUser,
  filterMatchesForUser,
  assertCanPublishLoad,
  assertCanPublishOffer,
  assertCanMatchLoad,
  assertCanMatchOffer,
};
