'use strict';

const repo = require('./repository');

/** Filtros de listado según rol (JWT: sub, role, company_name). */
function loadListFilters(user, query = {}) {
  const base = {};
  if (query.status) base.status = query.status;
  if (query.region) base.region = query.region;
  if (!user) return base;
  if (user.role === 'admin') return base;
  if (user.role === 'shipper') {
    return { ...base, shipper_user_id: user.sub };
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
    return { ...base, carrier_user_id: user.sub };
  }
  if (user.role === 'shipper') {
    return { ...base, status: query.status || 'published' };
  }
  return base;
}

async function filterMatchesForUser(matches, user) {
  if (!user || user.role === 'admin') return matches;
  const loads = await repo.list('load_requests', {});
  const offers = await repo.list('capacity_offers', {});
  const loadById = Object.fromEntries(loads.map((l) => [l.id, l]));
  const offerById = Object.fromEntries(offers.map((o) => [o.id, o]));
  return matches.filter((m) => {
    if (user.role === 'shipper') {
      return loadById[m.load_request_id]?.shipper_user_id === user.sub;
    }
    if (user.role === 'carrier') {
      const offer = offerById[m.capacity_offer_id];
      if (!offer) return false;
      if (offer.carrier_user_id) return offer.carrier_user_id === user.sub;
      const company = (user.company_name || '').trim();
      const offerName = (offer.carrier_name || '').trim();
      return Boolean(company && offerName && company === offerName);
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
  if (!user) return null;
  if (user.role === 'admin') return null;
  if (user.role === 'shipper' && load.shipper_user_id && load.shipper_user_id !== user.sub) {
    return 'Solo puedes emparejar cargas de tu empresa';
  }
  return null;
}

function assertCanMatchOffer(user, offer) {
  if (!user) return null;
  if (user.role === 'admin') return null;
  if (user.role === 'carrier' && offer.carrier_user_id && offer.carrier_user_id !== user.sub) {
    return 'Solo puedes emparejar usando tus ofertas';
  }
  return null;
}

module.exports = {
  loadListFilters,
  offerListFilters,
  filterMatchesForUser,
  assertCanPublishLoad,
  assertCanPublishOffer,
  assertCanMatchLoad,
  assertCanMatchOffer,
};
