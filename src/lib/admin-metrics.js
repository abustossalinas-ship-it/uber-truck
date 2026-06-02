'use strict';

const TAKE_RATE = Number(process.env.TAKE_RATE_PERCENT) || 0.135;

function median(values) {
  const nums = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

function parseRange(from, to) {
  const start = from ? new Date(from) : null;
  const end = to ? new Date(to) : null;
  if (start && Number.isNaN(start.getTime())) return { error: 'from inválido' };
  if (end && Number.isNaN(end.getTime())) return { error: 'to inválido' };
  if (end) end.setHours(23, 59, 59, 999);
  return { start, end };
}

function inRange(iso, start, end) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  if (start && t < start.getTime()) return false;
  if (end && t > end.getTime()) return false;
  return true;
}

function routeText(row) {
  if (!row) return '';
  return [
    row.origin_city,
    row.destination_city,
    row.origin_region,
    row.destination_region,
    row.origin_address,
    row.destination_address,
    row.origin_label,
    row.destination_label,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function isPilotCorridorRow(row) {
  const text = routeText(row);
  if (!text) return false;
  const hasRm =
    /metropolitana|regi[oó]n metropolitana|santiago|san bernardo|puente alto|maip[uú]|quilicura|rm\b/.test(
      text
    );
  const hasV =
    /valpara[ií]so|san antonio|quillota|vi[nñ]a del mar|v regi[oó]n|valparaiso/.test(text);
  return hasRm && hasV;
}

function formatClp(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return `$${Math.round(v).toLocaleString('es-CL')}`;
}

function statusLabel(status) {
  const map = {
    proposed: 'Propuesto',
    accepted: 'Aceptado',
    in_progress: 'En ejecución',
    completed: 'Completado',
    cancelled: 'Cancelado',
    disputed: 'Disputado',
  };
  return map[status] || status;
}

async function loadAdminData(repo) {
  const [matches, loads, offers, users, ratings] = await Promise.all([
    repo.list('matches', {}),
    repo.list('load_requests', {}),
    repo.list('capacity_offers', {}),
    repo.list('users', {}),
    repo.list('match_ratings', {}),
  ]);
  const loadById = Object.fromEntries(loads.map((l) => [l.id, l]));
  const offerById = Object.fromEntries(offers.map((o) => [o.id, o]));
  return { matches, loads, offers, users, ratings, loadById, offerById };
}

function filterMatches(matches, loadById, { start, end, corridor }) {
  return matches.filter((m) => {
    if (!inRange(m.updated_at || m.created_at, start, end)) return false;
    if (corridor === 'pilot') {
      const load = loadById[m.load_request_id];
      if (!isPilotCorridorRow(load)) return false;
    }
    return true;
  });
}

function computeKpis(allMatches, loads, loadById, ratings, { start, end, corridor }) {
  const matches = filterMatches(allMatches, loadById, { start, end, corridor });
  const completed = matches.filter((m) => m.status === 'completed');
  const cancelled = matches.filter((m) => m.status === 'cancelled');
  const active = matches.filter((m) => ['proposed', 'accepted', 'in_progress'].includes(m.status));

  const gmv = completed.reduce((s, m) => s + (Number(m.agreed_price_clp) || 0), 0);

  const publishedLoads = loads.filter(
    (l) => l.status === 'published' || l.status === 'matched' || l.status === 'in_transit'
  );
  const loadsWithMatch = new Set(matches.map((m) => m.load_request_id));
  const loadsAccepted = new Set(
    matches
      .filter((m) => ['accepted', 'in_progress', 'completed'].includes(m.status))
      .map((m) => m.load_request_id)
  );
  const eligibleLoads = publishedLoads.filter((l) => {
    if (corridor === 'pilot' && !isPilotCorridorRow(l)) return false;
    return loadsWithMatch.has(l.id);
  });
  const matchRate =
    eligibleLoads.length > 0
      ? Math.round((loadsAccepted.size / eligibleLoads.length) * 1000) / 10
      : null;

  const reachedAccepted = matches.filter(
    (m) =>
      ['accepted', 'in_progress', 'completed'].includes(m.status) ||
      (m.status === 'cancelled' && Number(m.agreed_price_clp) > 0)
  );
  const cancelledAfterAccepted = matches.filter(
    (m) => m.status === 'cancelled' && Number(m.agreed_price_clp) > 0
  );
  const cancelPostRate =
    reachedAccepted.length > 0
      ? Math.round((cancelledAfterAccepted.length / reachedAccepted.length) * 1000) / 10
      : null;

  const hoursToMatch = [];
  for (const m of matches.filter((x) => ['accepted', 'in_progress', 'completed'].includes(x.status))) {
    const load = loadById[m.load_request_id];
    if (!load?.created_at || !m.updated_at) continue;
    const h = (new Date(m.updated_at) - new Date(load.created_at)) / (3600 * 1000);
    if (h >= 0 && h < 24 * 30) hoursToMatch.push(h);
  }
  const medianHoursToMatch = median(hoursToMatch);

  const starsShipper = ratings.filter((r) => r.rater_role === 'shipper').map((r) => Number(r.stars));
  const starsCarrier = ratings.filter((r) => r.rater_role === 'carrier').map((r) => Number(r.stars));
  const avgStars = (arr) =>
    arr.length ? Math.round((arr.reduce((s, n) => s + n, 0) / arr.length) * 10) / 10 : null;

  return {
    counts: {
      total: matches.length,
      active: active.length,
      completed: completed.length,
      cancelled: cancelled.length,
      proposed: matches.filter((m) => m.status === 'proposed').length,
    },
    gmv_clp: gmv,
    take_rate_percent: TAKE_RATE * 100,
    revenue_estimated_clp: Math.round(gmv * TAKE_RATE),
    match_rate_percent: matchRate,
    cancel_post_accepted_percent: cancelPostRate,
    median_hours_to_match: medianHoursToMatch != null ? Math.round(medianHoursToMatch * 10) / 10 : null,
    avg_stars_shipper_rates_carrier: avgStars(starsShipper),
    avg_stars_carrier_rates_shipper: avgStars(starsCarrier),
    ratings_count: ratings.length,
  };
}

function computeLiquidity(loads, offers, corridor) {
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 3600 * 1000;
  const activeLoad = (l) => {
    const t = new Date(l.created_at || 0).getTime();
    if (t < weekAgo) return false;
    if (corridor === 'pilot' && !isPilotCorridorRow(l)) return false;
    return l.status === 'published' || l.status === 'matched';
  };
  const activeOffer = (o) => {
    const t = new Date(o.created_at || 0).getTime();
    if (t < weekAgo) return false;
    if (corridor === 'pilot' && !isPilotCorridorRow(o)) return false;
    return o.status === 'published';
  };
  return {
    published_loads_7d: loads.filter(activeLoad).length,
    published_offers_7d: offers.filter(activeOffer).length,
    pilot_targets: { loads_min: 3, offers_min: 2 },
  };
}

async function buildAdminDashboard(repo, query = {}) {
  const range = parseRange(query.from, query.to);
  if (range.error) return { error: range.error };
  const corridor = query.corridor === 'pilot' ? 'pilot' : 'all';
  const { matches, loads, offers, users, ratings, loadById } = await loadAdminData(repo);
  const kpis = computeKpis(matches, loads, loadById, ratings, {
    start: range.start,
    end: range.end,
    corridor,
  });
  const liquidity = computeLiquidity(loads, offers, corridor === 'pilot' ? 'pilot' : 'all');
  kpis.liquidity_week = {
    published_loads: liquidity.published_loads_7d,
    published_offers: liquidity.published_offers_7d,
    targets: liquidity.pilot_targets,
  };

  const pendingKyc = users.filter(
    (u) => u.role !== 'admin' && (u.kyc_status === 'pending' || !u.kyc_status)
  ).length;

  return {
    ok: true,
    period: {
      from: query.from || null,
      to: query.to || null,
      corridor,
    },
    summary: {
      ...kpis,
      pending_kyc: pendingKyc,
      users_total: users.filter((u) => u.role !== 'admin').length,
    },
    liquidity,
  };
}

function buildTripRow(m, loadById, offerById, ratingsByMatch) {
  const load = loadById[m.load_request_id];
  const offer = offerById[m.capacity_offer_id];
  const rs = ratingsByMatch[m.id] || [];
  const shipperStars = rs.find((r) => r.rater_role === 'shipper');
  const carrierStars = rs.find((r) => r.rater_role === 'carrier');
  const route =
    load && (load.origin_city || load.destination_city)
      ? `${load.origin_city || '—'} → ${load.destination_city || '—'}`
      : '—';
  return {
    id: m.id,
    status: m.status,
    status_label: statusLabel(m.status),
    route,
    shipper: load?.company_name || '—',
    carrier: offer?.carrier_name || m.carrier_name || '—',
    agreed_price_clp: m.agreed_price_clp,
    agreed_price_label: formatClp(m.agreed_price_clp),
    penalty_amount_clp: m.penalty_amount_clp,
    reason_code: m.reason_code || null,
    updated_at: m.updated_at || m.created_at,
    stars_shipper: shipperStars?.stars ?? null,
    stars_carrier: carrierStars?.stars ?? null,
    pilot_corridor: isPilotCorridorRow(load),
  };
}

async function listAdminTrips(repo, query = {}) {
  const range = parseRange(query.from, query.to);
  if (range.error) return { error: range.error };
  const corridor = query.corridor === 'pilot' ? 'pilot' : 'all';
  const status = query.status && query.status !== 'all' ? query.status : null;
  const limit = Math.min(Math.max(Number(query.limit) || 80, 1), 200);

  const { matches, loads, offers, ratings, loadById, offerById } = await loadAdminData(repo);
  const ratingsByMatch = {};
  for (const r of ratings) {
    if (!ratingsByMatch[r.match_id]) ratingsByMatch[r.match_id] = [];
    ratingsByMatch[r.match_id].push(r);
  }

  let rows = filterMatches(matches, loadById, {
    start: range.start,
    end: range.end,
    corridor,
  });
  if (status) rows = rows.filter((m) => m.status === status);
  rows.sort(
    (a, b) =>
      new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)
  );
  rows = rows.slice(0, limit);

  return {
    ok: true,
    data: rows.map((m) => buildTripRow(m, loadById, offerById, ratingsByMatch)),
    total: rows.length,
  };
}

module.exports = {
  buildAdminDashboard,
  listAdminTrips,
  isPilotCorridorRow,
};
