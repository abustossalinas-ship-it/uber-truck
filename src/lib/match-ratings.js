'use strict';

const { normalizeRole } = require('./match-cancel');

const { validateRatingPayload } = require('./rating-tags');

function validateRating(raterRole, body) {
  return validateRatingPayload(raterRole, body || {});
}

function entityKey(userId, nameRole, displayName) {
  if (userId) return String(userId);
  const name = (displayName || '').trim();
  return name ? `${nameRole}:${name}` : null;
}

function pushScore(bucket, key, stars) {
  if (!key) return;
  if (!bucket[key]) bucket[key] = [];
  bucket[key].push(Number(stars));
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
      pushScore(
        carrierFromShipper,
        entityKey(offer?.carrier_user_id, 'carrier', offer?.carrier_name),
        r.stars
      );
    } else if (r.rater_role === 'carrier') {
      pushScore(
        shipperFromCarrier,
        entityKey(load?.shipper_user_id, 'shipper', load?.company_name),
        r.stars
      );
    }
  }
  return {
    carrier: avgScores(carrierFromShipper),
    shipper: avgScores(shipperFromCarrier),
  };
}

function pickRep(repIndex, role, userId, displayName) {
  const key = entityKey(userId, role === 'carrier' ? 'carrier' : 'shipper', displayName);
  if (!key) return { avg_stars: null, rating_count: 0 };
  const bucket = role === 'carrier' ? repIndex.carrier : repIndex.shipper;
  return bucket[key] || { avg_stars: null, rating_count: 0 };
}

async function getReputationIndex(repo) {
  let ratings = [];
  try {
    ratings = await repo.list('match_ratings', {});
  } catch {
    return { carrier: {}, shipper: {} };
  }
  const [matches, loads, offers] = await Promise.all([
    repo.list('matches', {}),
    repo.list('load_requests', {}),
    repo.list('capacity_offers', {}),
  ]);
  const loadById = Object.fromEntries(loads.map((l) => [l.id, l]));
  const offerById = Object.fromEntries(offers.map((o) => [o.id, o]));
  return buildReputationIndex(ratings, matches, loadById, offerById);
}

function ratingRow(r) {
  if (!r) return null;
  return {
    stars: r.stars,
    comment: r.comment || null,
    tags: Array.isArray(r.tags) ? r.tags : [],
    tag_band: r.tag_band || null,
  };
}

async function enrichMatchesWithRatings(repo, matches, user, ctx = {}) {
  if (!matches?.length) return matches;
  let ratings = [];
  try {
    ratings = await repo.list('match_ratings', {});
  } catch (e) {
    if (!/PGRST204|rater_user_id|schema cache/i.test(e.message || '')) {
      console.error('match_ratings list:', e.message || e);
    }
    return matches.map((m) => ({
      ...m,
      my_rating: null,
      their_rating: null,
      can_rate: false,
      ratings_unavailable: true,
    }));
  }

  let loadById = ctx.loadById;
  let offerById = ctx.offerById;
  let allMatches = ctx.allMatches;
  if (!loadById || !offerById) {
    const [loads, offers] = await Promise.all([
      repo.list('load_requests', {}),
      repo.list('capacity_offers', {}),
    ]);
    loadById = Object.fromEntries(loads.map((l) => [l.id, l]));
    offerById = Object.fromEntries(offers.map((o) => [o.id, o]));
  }
  if (!allMatches) {
    allMatches = await repo.list('matches', {});
  }
  const repIndex = buildReputationIndex(ratings, allMatches, loadById, offerById);

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

    const carrierRep = pickRep(
      repIndex,
      'carrier',
      offer?.carrier_user_id,
      offer?.carrier_name
    );
    const shipperRep = pickRep(
      repIndex,
      'shipper',
      load?.shipper_user_id,
      load?.company_name
    );
    const counterpartyRep =
      role === 'shipper' ? carrierRep : role === 'carrier' ? shipperRep : null;

    const canRate = Boolean(role && m.status === 'completed' && !myRating);

    return {
      ...m,
      rating_by_shipper: ratingRow(byShipper),
      rating_by_carrier: ratingRow(byCarrier),
      my_rating: ratingRow(myRating),
      their_rating: ratingRow(theirRating),
      can_rate: canRate,
      counterparty_reputation: counterpartyRep,
      carrier_reputation: carrierRep,
      shipper_reputation: shipperRep,
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
  getReputationIndex,
  pickRep,
  entityKey,
};
