'use strict';

const { scoreMatch } = require('./match-score');
const { offerWithinBudget } = require('./match-price');

const RANK_MODES = {
  balanced: { price: 0.35, reputation: 0.3, time: 0.2, fit: 0.15, label: 'Recomendado (equilibrio)' },
  cheap: { price: 0.55, reputation: 0.15, time: 0.1, fit: 0.2, label: 'Más barato' },
  fast: { price: 0.15, reputation: 0.15, time: 0.5, fit: 0.2, label: 'Más rápido (respondió antes)' },
  trusted: { price: 0.2, reputation: 0.5, time: 0.1, fit: 0.2, label: 'Más confiable' },
};

function normalizeMinMax(value, min, max) {
  if (max <= min) return 100;
  return Math.round(((value - min) / (max - min)) * 100);
}

function rankProposalsForLoad(load, proposedMatches, offersById, mode = 'balanced') {
  const weights = RANK_MODES[mode] || RANK_MODES.balanced;
  const rows = proposedMatches.filter((m) => m.status === 'proposed' && m.carrier_offer_clp != null);

  if (rows.length === 0) return { mode, mode_label: weights.label, data: [] };

  const prices = rows.map((m) => Number(m.carrier_offer_clp));
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);

  const createdTimes = rows.map((m) => new Date(m.created_at || 0).getTime());
  const minT = Math.min(...createdTimes);
  const maxT = Math.max(...createdTimes);

  const scored = rows.map((m) => {
    const offer = offersById[m.capacity_offer_id];
    const price = Number(m.carrier_offer_clp);
    const priceScore =
      maxP > minP ? Math.round(((maxP - price) / (maxP - minP)) * 100) : 100;
    const rep = offer?.reputation?.avg_stars;
    const repScore =
      rep != null && Number(rep) > 0 ? Math.min(100, Math.round((Number(rep) / 5) * 100)) : 40;
    const t = new Date(m.created_at || 0).getTime();
    const timeScore =
      maxT > minT ? Math.round(((maxT - t) / (maxT - minT)) * 100) : 80;
    const fit = offer ? scoreMatch(load, offer) : { score: 50 };
    const fitScore = fit.score;

    const total = Math.round(
      priceScore * weights.price +
        repScore * weights.reputation +
        timeScore * weights.time +
        fitScore * weights.fit
    );

    const within = offerWithinBudget(price, m.budget_min_clp, m.budget_max_clp);

    return {
      match_id: m.id,
      carrier_name: offer?.carrier_name || 'Transportista',
      carrier_offer_clp: price,
      created_at: m.created_at,
      reputation: offer?.reputation || { avg_stars: null, rating_count: 0 },
      within_budget: within !== false,
      breakdown: {
        price: priceScore,
        reputation: repScore,
        time: timeScore,
        fit: fitScore,
      },
      total_score: total,
      fit_reasons: fit.reasons?.slice(0, 2) || [],
      eta_total_min: load?.eta_total_min || null,
    };
  });

  scored.sort((a, b) => b.total_score - a.total_score);
  scored.forEach((row, i) => {
    row.rank = i + 1;
    row.recommended = i === 0;
  });

  return {
    mode,
    mode_label: weights.label,
    load_id: load.id,
    proposal_count: scored.length,
    data: scored,
  };
}

module.exports = {
  RANK_MODES,
  rankProposalsForLoad,
};
