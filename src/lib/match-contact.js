'use strict';

const { normalizeRole } = require('./match-cancel');
const { filterMatchesForUser } = require('./access-scope');
const { maskPhoneDisplay } = require('./phone-guard');

function partiesFromMaps(load, offer, userById = {}) {
  if (!load || !offer) return null;
  const shipperUser = load.shipper_user_id ? userById[load.shipper_user_id] : null;
  const carrierUser = offer.carrier_user_id ? userById[offer.carrier_user_id] : null;
  const shipperCompany = load.company_name?.trim() || 'Embarcador';
  const carrierCompany = offer.carrier_name?.trim() || 'Transportista';
  const shipperPerson = shipperUser?.full_name?.trim() || shipperCompany;
  const carrierPerson = carrierUser?.full_name?.trim() || carrierCompany;
  return {
    load,
    offer,
    shipper: {
      user_id: load.shipper_user_id,
      person: shipperPerson,
      company: shipperCompany,
      phone: shipperUser?.phone || null,
      display:
        shipperPerson !== shipperCompany ? `${shipperPerson} · ${shipperCompany}` : shipperCompany,
    },
    carrier: {
      user_id: offer.carrier_user_id,
      person: carrierPerson,
      company: carrierCompany,
      phone: carrierUser?.phone || null,
      display:
        carrierPerson !== carrierCompany ? `${carrierPerson} · ${carrierCompany}` : carrierCompany,
    },
  };
}

async function resolveParties(repo, match) {
  const load = await repo.getById('load_requests', match.load_request_id);
  const offer = await repo.getById('capacity_offers', match.capacity_offer_id);
  if (!load || !offer) return null;

  const userById = {};
  const userIds = [load.shipper_user_id, offer.carrier_user_id].filter(Boolean);
  const users = await Promise.all(userIds.map((id) => repo.getById('users', id)));
  users.filter(Boolean).forEach((u) => {
    userById[u.id] = u;
  });
  return partiesFromMaps(load, offer, userById);
}

function counterpartyForRole(parties, viewerRole) {
  if (!parties) return null;
  if (viewerRole === 'carrier') {
    return {
      role: 'shipper',
      role_label: 'Embarcador',
      person: parties.shipper.person,
      company: parties.shipper.company,
      display: parties.shipper.display,
    };
  }
  if (viewerRole === 'shipper') {
    return {
      role: 'carrier',
      role_label: 'Transportista',
      person: parties.carrier.person,
      company: parties.carrier.company,
      display: parties.carrier.display,
    };
  }
  return null;
}

async function enrichMatchCounterparty(repo, match, viewer) {
  if (!viewer?.role || viewer.role === 'admin') return match;
  const parties = await resolveParties(repo, match);
  const cp = counterpartyForRole(parties, normalizeRole(viewer.role));
  if (cp) match.counterparty = cp;
  return match;
}

async function enrichMatchesCounterparty(repo, rows, viewer, ctx = {}) {
  if (!viewer?.role || viewer.role === 'admin' || !rows?.length) return rows;
  const role = normalizeRole(viewer.role);
  let loadById = ctx.loadById;
  let offerById = ctx.offerById;
  if (!loadById || !offerById) {
    const [loads, offers] = await Promise.all([
      repo.list('load_requests', {}),
      repo.list('capacity_offers', {}),
    ]);
    loadById = Object.fromEntries(loads.map((l) => [l.id, l]));
    offerById = Object.fromEntries(offers.map((o) => [o.id, o]));
  }

  const userIds = new Set();
  for (const m of rows) {
    const load = loadById[m.load_request_id];
    const offer = offerById[m.capacity_offer_id];
    if (load?.shipper_user_id) userIds.add(load.shipper_user_id);
    if (offer?.carrier_user_id) userIds.add(offer.carrier_user_id);
  }
  const users = await Promise.all([...userIds].map((id) => repo.getById('users', id)));
  const userById = Object.fromEntries(users.filter(Boolean).map((u) => [u.id, u]));

  return rows.map((m) => {
    const parties = partiesFromMaps(loadById[m.load_request_id], offerById[m.capacity_offer_id], userById);
    const cp = counterpartyForRole(parties, role);
    return cp ? { ...m, counterparty: cp } : m;
  });
}

async function buildMatchContact(repo, matchId, user) {
  const match = await repo.getById('matches', matchId);
  if (!match) {
    const e = new Error('Viaje no encontrado');
    e.status = 404;
    throw e;
  }
  const allowed = await filterMatchesForUser([match], user);
  if (!allowed.length) {
    const e = new Error('No autorizado');
    e.status = 403;
    throw e;
  }
  const parties = await resolveParties(repo, match);
  const viewerRole = normalizeRole(user.role);
  const cp = counterpartyForRole(parties, viewerRole);
  const target =
    viewerRole === 'carrier' ? parties?.shipper : parties?.carrier;

  const tripActive = ['accepted', 'in_progress'].includes(match.status);
  const proxyNumber = process.env.TWILIO_MATCH_PROXY_NUMBER?.trim();
  const hasTargetPhone = Boolean(target?.phone?.trim());

  let call_available = false;
  let dial_url = null;
  let mode = 'chat_only';
  let hint =
    'Por ahora coordina por el chat de Cubik. La llamada enmascarada (como Uber) se activará con número proxy.';

  if (tripActive && proxyNumber) {
    call_available = true;
    dial_url = `tel:${proxyNumber.replace(/\s/g, '')}`;
    mode = 'relay';
    hint =
      'Llamarás a un número Cubik que conecta con la otra parte sin mostrar tu teléfono real.';
  } else if (tripActive && hasTargetPhone) {
    mode = 'relay_pending';
    hint =
      'La otra parte tiene teléfono registrado. Cuando activemos el proxy (Twilio), podrás llamar desde aquí sin salir de Cubik.';
  }

  return {
    match_id: match.id,
    status: match.status,
    counterparty: cp,
    call_available,
    dial_url,
    mode,
    hint,
    masked_hint: hasTargetPhone ? maskPhoneDisplay(target.phone) : null,
    chat_recommended: true,
  };
}

module.exports = {
  resolveParties,
  counterpartyForRole,
  enrichMatchCounterparty,
  enrichMatchesCounterparty,
  buildMatchContact,
};
