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

async function enrichMatchesWithRatings(repo, matches, user) {
  if (!matches?.length) return matches;
  let ratings = [];
  try {
    ratings = await repo.list('match_ratings', {});
  } catch {
    return matches.map((m) => ({ ...m, my_rating: null, can_rate: false }));
  }
  const byMatch = {};
  for (const r of ratings) {
    if (!byMatch[r.match_id]) byMatch[r.match_id] = [];
    byMatch[r.match_id].push(r);
  }
  const role =
    user?.role === 'carrier' ? 'carrier' : user?.role === 'shipper' ? 'shipper' : null;

  return matches.map((m) => {
    const list = byMatch[m.id] || [];
    const myRating = role ? list.find((r) => r.rater_role === role) : null;
    const canRate = Boolean(
      role && m.status === 'completed' && !myRating
    );
    const avg =
      list.length > 0
        ? Math.round((list.reduce((s, r) => s + r.stars, 0) / list.length) * 10) / 10
        : null;
    return {
      ...m,
      my_rating: myRating ? { stars: myRating.stars, comment: myRating.comment } : null,
      can_rate: canRate,
      trip_rating_avg: avg,
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
};
