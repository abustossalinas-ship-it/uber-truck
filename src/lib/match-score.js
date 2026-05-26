'use strict';

/** Puntaje 0–100 para emparejar carga con oferta */
function scoreMatch(load, offer) {
  let score = 0;
  const reasons = [];

  if (load.destination_region && offer.destination_region === load.destination_region) {
    score += 35;
    reasons.push('Misma región destino');
  }
  if (load.origin_region && offer.origin_region === load.origin_region) {
    score += 25;
    reasons.push('Misma región origen');
  }
  if (
    load.destination_city &&
    offer.destination_city &&
    load.destination_city.toLowerCase() === offer.destination_city.toLowerCase()
  ) {
    score += 15;
    reasons.push('Misma ciudad destino');
  }
  const needVol = Number(load.volume_m3) || 0;
  const freeVol = Number(offer.free_volume_m3) || 0;
  if (needVol > 0 && freeVol >= needVol) {
    score += 20;
    reasons.push('Cubicación suficiente');
  } else if (needVol === 0 && freeVol > 0) {
    score += 10;
    reasons.push('Oferta con espacio');
  }
  const needW = Number(load.weight_kg) || 0;
  const maxW = Number(offer.max_weight_kg) || 0;
  if (needW > 0 && maxW > 0 && maxW >= needW) {
    score += 10;
    reasons.push('Peso dentro de capacidad');
  }
  if (load.origin_city && offer.origin_city &&
    load.origin_city.toLowerCase() === offer.origin_city.toLowerCase()) {
    score += 5;
    reasons.push('Misma ciudad origen');
  }

  return { score: Math.min(100, score), reasons };
}

function rankOffersForLoad(load, offers) {
  return offers
    .filter((o) => o.status === 'published')
    .map((o) => ({ offer: o, ...scoreMatch(load, o) }))
    .filter((x) => x.score >= 25)
    .sort((a, b) => b.score - a.score);
}

module.exports = { scoreMatch, rankOffersForLoad };
