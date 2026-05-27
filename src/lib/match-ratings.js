'use strict';

const { normalizeRole } = require('./match-cancel');

function validateRating(body) {
  const stars = Number(body?.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return ['stars: indica una calificación de 1 a 5'];
  }
  const comment = body?.comment?.trim?.() || '';
  if (comment.length > 500) return ['comment: máximo 500 caracteres'];
  return [];
}

function pushScore(bucket, userId, stars) {
  if (!userId) return;
  if (!bucket[userId]) bucket[userId] = [];
  bucket[userId].push(Number(stars));
}

function avgScores(bucket) {
  const out = {};
  for (const [id, arr] of Object.entries(bucket)) {
    if (!arr.length) continue;
    const avg = arr.reduce((s, n) => s + n, 0) / arr.length;
    out[id] = {
      avg_stars: Math.round(avg * 10) / 10,
      rating_count: arr.length,
    };
  }
  return out;
}

function buildReputationIndex(ratings, matches, loadById, offerById) {
  const matchById = Object.fromEntries(matches.map((m) => [m.id, m]));
  const carrierFromShipper = {};
  const shipperFromCarrier = {};
  for (const r of ratings) {
    const m = matchById[r.match_id];
    if (!m) continue;
    const load = loadById[m.load_request_id];
    const offer = offerById[m.capacity_offer_id];
    if (r.rater_role === 'shipper') {
      pushScore(carrierFromShipper, offer?.carrier_user_id, r.stars);
    } else if (r.rater_role === 'carrier') {
      pushScore(shipperFromCarrier, load?.shipper_user_id, r.stars);
    }
  }
  return {
    carrier: avgScores(carrierFromShipper),
    shipper: avgScores(shipperFromCarrier),
  };
}

function pickRep(repIndex, role, userId) {
  if (!userId) return null;
  const bucket = role === 'carrier' ? repIndex.carrier : repIndex.shipper;
  return bucket[userId] || { avg_stars: null, rating_count: 0 };
}

function ratingRow(r) {
  if (!r) return null;
  return { stars: r.stars, comment: r.comment || null };
}

async function enrichMatchesWithRatings(repo, matches, user) {
  if (!matches?.length) return matches;
  let ratings = [];
  try {
    ratings = await repo.list('match_ratings', {});
  } catch (e) {
    console.error('match_ratings list:', e.message || e);
    return matches.map((m) => ({
      ...m,
      my_rating: null,
      their_rating: null,
      can_rate: false,
      ratings_unavailable: true,
    }));
  }

  const loads = await repo.list('load_requests', {});
  const offers = await repo.list('capacity_offers', {});
  const loadById = Object.fromEntries(loads.map((l) => [l.id, l]));
  const offerById = Object.fromEntries(offers.map((o) => [o.id, o]));
  const repIndex = buildReputationIndex(ratings, matches, loadById, offerById);

  const byMatch = {};
  for (const r of ratings) {
    if (!byMatch[r.match_id]) byMatch[r.match_id] = [];
    byMatch[r.match_id].push(r);
  }

  const role =
    user?.role === 'carrier' ? 'carrier' : user?.role === 'shipper' ? 'shipper' : null;
  const otherRole = role === 'carrier' ? 'shipper' : role === 'shipper' ? 'carrier' : null;

  return matches.map((m) => {
    const list = byMatch[m.id] || [];
    const load = loadById[m.load_request_id];
    const offer = offerById[m.capacity_offer_id];
    const byShipper = list.find((r) => r.rater_role === 'shipper');
    const byCarrier = list.find((r) => r.rater_role === 'carrier');

    const myRating = role ? list.find((r) => r.rater_role === role) : null;
    const theirRating = otherRole ? list.find((r) => r.rater_role === otherRole) : null;

    const counterpartyUserId =
      role === 'shipper' ? offer?.carrier_user_id : role === 'carrier' ? load?.shipper_user_id : null;
    const counterpartyRep = role
      ? pickRep(repIndex, role === 'shipper' ? 'carrier' : 'shipper', counterpartyUserId)
      : null;

    const canRate = Boolean(role && m.status === 'completed' && !myRating);

    return {
      ...m,
      rating_by_shipper: ratingRow(byShipper),
      rating_by_carrier: ratingRow(byCarrier),
      my_rating: ratingRow(myRating),
      their_rating: ratingRow(theirRating),
      can_rate: canRate,
      counterparty_reputation: counterpartyRep,
      trip_rating_avg:
        list.length > 0
          ? Math.round((list.reduce((s, r) => s + r.stars, 0) / list.length) * 10) / 10
          : null,
      trip_rating_count: list.length,
    };
  });
}

function reputationFromStats({ completed = 0, cancelled = 0, avgStars = null, incidents = 0 }) {
  let score = 70;
  if (avgStars != null) score = Math.round(avgStars * 18);
  score -= Math.min(30, cancelled * 5);
  score -= Math.min(20, incidents * 8);
  score += Math.min(15, completed * 2);
  score = Math.max(0, Math.min(100, score));
  let label = 'Nuevo';
  if (score >= 85) label = 'Excelente';
  else if (score >= 70) label = 'Bueno';
  else if (score >= 50) label = 'Regular';
  else label = 'En revisión';
  return { score, label };
}

module.exports = {
  validateRating,
  enrichMatchesWithRatings,
  reputationFromStats,
  normalizeRole,
  buildReputationIndex,
};
