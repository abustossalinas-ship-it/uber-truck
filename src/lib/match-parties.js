'use strict';

async function getMatchParties(repo, match) {
  if (!match?.load_request_id || !match?.capacity_offer_id) return null;
  const load = await repo.getById('load_requests', match.load_request_id);
  const offer = await repo.getById('capacity_offers', match.capacity_offer_id);
  const shipperName = load?.company_name?.trim() || 'Embarcador';
  const carrierName = offer?.carrier_name?.trim() || 'Transportista';
  return {
    shipper_name: shipperName,
    carrier_name: carrierName,
    short: `${shipperName} ↔ ${carrierName}`,
    labeled: `Embarcador: ${shipperName} · Transportista: ${carrierName}`,
  };
}

module.exports = { getMatchParties };
