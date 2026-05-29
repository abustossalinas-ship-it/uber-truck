'use strict';

const express = require('express');
const repo = require('../lib/repository');
const supabaseService = require('../services/supabase');
const { requiredString, optionalNumber, parseBody } = require('../lib/validate');
const { addressPayload } = require('../lib/geo-fields');
const { requireMapsAddresses } = require('../lib/geo-validate');
const { optionalAuth } = require('../lib/optional-auth');
const { requireAuthIfDb } = require('../lib/require-auth');
const {
  loadListFilters,
  filterLoadsForUser,
  assertCanPublishLoad,
  assertCanMatchLoad,
} = require('../lib/access-scope');
const {
  validateLoadBudget,
  copyBudgetFromLoad,
  assertCanAdjustLoadBudget,
  outsideRangeMessages,
  suggestReferenceBudget,
} = require('../lib/match-price');
const { validateCargoDeclaration, cargoTrustPayload } = require('../lib/cargo-trust');
const { buildLoadTimingPayload } = require('../lib/load-time-estimate');
const { buildLoadScheduleFields } = require('../lib/trip-schedule');
const { rankProposalsForLoad, RANK_MODES } = require('../lib/proposal-ranking');
const { requireApprovedOperator } = require('../lib/kyc-gate');
const { requirePenaltyClear } = require('../lib/penalty-gate');

const router = express.Router();
const operatorGate = [requireAuthIfDb, requireApprovedOperator, requirePenaltyClear];

router.get('/', optionalAuth, async (req, res) => {
  try {
    const filters = loadListFilters(req.user, req.query);
    let rows = await repo.list('load_requests', filters);
    rows = filterLoadsForUser(rows, req.user);
    const { getReputationIndex, pickRep } = require('../lib/match-ratings');
    const repIndex = await getReputationIndex(repo);
    rows = rows.map((l) => ({
      ...l,
      reputation: pickRep(repIndex, 'shipper', l.shipper_user_id, l.company_name),
    }));
    res.json({ ok: true, data: rows, scope: req.user?.role || 'public' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al listar cargas' });
  }
});

router.get('/:id/match-suggestions', optionalAuth, async (req, res) => {
  try {
    const load = await repo.getById('load_requests', req.params.id);
    if (!load) return res.status(404).json({ ok: false, error: 'Carga no encontrada' });
    const scopeErr = assertCanMatchLoad(req.user, load);
    if (scopeErr) return res.status(403).json({ ok: false, error: scopeErr });
    const { filterOffersForUser } = require('../lib/access-scope');
    let offers = await repo.list('capacity_offers', { status: 'published' });
    if (req.user?.role === 'carrier') {
      offers = filterOffersForUser(offers, req.user);
    }
    const { rankOffersForLoad } = require('../lib/match-score');
    const { getReputationIndex, pickRep } = require('../lib/match-ratings');
    const repIndex = await getReputationIndex(repo);
    const ranked = rankOffersForLoad(load, offers).map((row) => ({
      ...row,
      reputation: pickRep(
        repIndex,
        'carrier',
        row.offer?.carrier_user_id,
        row.offer?.carrier_name
      ),
    }));
    res.json({ ok: true, load_id: load.id, data: ranked });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al sugerir matches' });
  }
});

router.get('/:id/budget-hint', optionalAuth, async (req, res) => {
  try {
    const load = await repo.getById('load_requests', req.params.id);
    if (!load) return res.status(404).json({ ok: false, error: 'Carga no encontrada' });
    const hint = suggestReferenceBudget(load);
    res.json({ ok: true, data: hint, disclaimer: 'Solo referencia; no obliga al transportista ni al embarcador.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al calcular referencia' });
  }
});

router.patch('/:id/budget', optionalAuth, ...operatorGate, async (req, res) => {
  try {
    const load = await repo.getById('load_requests', req.params.id);
    if (!load) return res.status(404).json({ ok: false, error: 'Carga no encontrada' });
    if (req.user?.role !== 'shipper' && req.user?.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Solo el embarcador puede ajustar el rango' });
    }
    const scopeErr = assertCanMatchLoad(req.user, load);
    if (scopeErr) return res.status(403).json({ ok: false, error: scopeErr });
    const lockErr = await assertCanAdjustLoadBudget(repo, load.id);
    if (lockErr) return res.status(409).json({ ok: false, error: lockErr });

    const min = req.body?.budget_min_clp != null ? Number(req.body.budget_min_clp) : load.budget_min_clp;
    const max = req.body?.budget_max_clp != null ? Number(req.body.budget_max_clp) : load.budget_max_clp;
    const budgetErrors = validateLoadBudget(min, max);
    if (budgetErrors.length) return res.status(400).json({ ok: false, errors: budgetErrors });

    const updated = await repo.update('load_requests', load.id, {
      budget_min_clp: min,
      budget_max_clp: max,
    });
    const budget = copyBudgetFromLoad(updated);
    const matches = await repo.list('matches', {});
    const proposed = matches.filter(
      (m) => m.load_request_id === load.id && m.status === 'proposed'
    );
    for (const m of proposed) {
      await repo.update('matches', m.id, budget);
    }
    res.json({
      ok: true,
      data: updated,
      message: 'Rango actualizado en la carga y en propuestas abiertas.',
      matches_updated: proposed.length,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al actualizar presupuesto' });
  }
});

router.get('/:id/proposals/compare', optionalAuth, async (req, res) => {
  try {
    const load = await repo.getById('load_requests', req.params.id);
    if (!load) return res.status(404).json({ ok: false, error: 'Carga no encontrada' });
    const mode = String(req.query.mode || 'balanced');
    if (!RANK_MODES[mode]) {
      return res.status(400).json({ ok: false, error: 'mode: balanced, cheap, fast, trusted' });
    }
    const matches = await repo.list('matches', {});
    const proposed = matches.filter(
      (m) => m.load_request_id === load.id && m.status === 'proposed'
    );
    const offers = await repo.list('capacity_offers', {});
    const offersById = Object.fromEntries(offers.map((o) => [o.id, o]));
    const { getReputationIndex, pickRep } = require('../lib/match-ratings');
    const repIndex = await getReputationIndex(repo);
    for (const m of proposed) {
      const offer = offersById[m.capacity_offer_id];
      if (offer) {
        offer.reputation = pickRep(
          repIndex,
          'carrier',
          offer.carrier_user_id,
          offer.carrier_name
        );
      }
    }
    const ranking = rankProposalsForLoad(load, proposed, offersById, mode);
    res.json({
      ok: true,
      load: {
        id: load.id,
        company_name: load.company_name,
        published_at: load.created_at,
        schedule_mode: load.schedule_mode,
        scheduled_pickup_at: load.scheduled_pickup_at,
        needed_by_at: load.needed_by_at,
        budget_min_clp: load.budget_min_clp,
        budget_max_clp: load.budget_max_clp,
        eta_total_min: load.eta_total_min,
      },
      modes: Object.keys(RANK_MODES),
      ranking,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al comparar propuestas' });
  }
});

router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const row = await repo.getById('load_requests', req.params.id);
    if (!row) return res.status(404).json({ ok: false, error: 'No encontrado' });
    res.json({ ok: true, data: row });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al leer carga' });
  }
});

router.post('/', optionalAuth, ...operatorGate, async (req, res) => {
  const body = req.body || {};
  if (supabaseService.isConfigured()) {
    const pubErr = assertCanPublishLoad(req.user);
    if (pubErr) return res.status(403).json({ ok: false, error: pubErr });
  }
  const errors = parseBody([
    () => requiredString(body.company_name, 'company_name'),
    () => requiredString(body.origin_city, 'origin_city'),
    () => requiredString(body.origin_region, 'origin_region', 10),
    () => requiredString(body.destination_city, 'destination_city'),
    () => requiredString(body.destination_region, 'destination_region', 10),
    () => optionalNumber(body.volume_m3, 'volume_m3'),
    () => optionalNumber(body.weight_kg, 'weight_kg'),
    () => optionalNumber(body.pallets, 'pallets', { max: 500 }),
    () => optionalNumber(body.budget_min_clp, 'budget_min_clp'),
    () => optionalNumber(body.budget_max_clp, 'budget_max_clp'),
  ]);
  const budgetErrors = validateLoadBudget(body.budget_min_clp, body.budget_max_clp);
  if (budgetErrors.length) return res.status(400).json({ ok: false, errors: budgetErrors });
  const geoErrors = requireMapsAddresses(body);
  if (geoErrors.length) return res.status(400).json({ ok: false, errors: geoErrors });
  const cargoErrors = validateCargoDeclaration(body);
  if (cargoErrors.length) return res.status(400).json({ ok: false, errors: cargoErrors });
  if (errors.length) return res.status(400).json({ ok: false, errors });

  const companyName =
    req.user?.role === 'shipper' && req.user.company_name
      ? req.user.company_name
      : body.company_name.trim();

  try {
    const schedule = buildLoadScheduleFields(body);
    if (schedule.errors.length) {
      return res.status(400).json({ ok: false, errors: schedule.errors });
    }
    const timing = buildLoadTimingPayload({
      ...body,
      cargo_ready_at: schedule.cargo_ready_at || body.cargo_ready_at,
      distance_duration_min: body.distance_duration_min,
    });
    const row = await repo.insert('load_requests', {
      shipper_user_id: req.user?.sub || null,
      company_name: companyName,
      origin_city: body.origin_city.trim(),
      origin_region: body.origin_region.trim().toUpperCase(),
      destination_city: body.destination_city.trim(),
      destination_region: body.destination_region.trim().toUpperCase(),
      volume_m3: body.volume_m3 != null ? Number(body.volume_m3) : null,
      weight_kg: body.weight_kg != null ? Number(body.weight_kg) : null,
      pallets: body.pallets != null ? Number(body.pallets) : null,
      cargo_type: body.cargo_type?.trim() || null,
      urgency: ['urgent', 'flexible'].includes(body.urgency) ? body.urgency : 'normal',
      schedule_mode: schedule.schedule_mode,
      scheduled_pickup_at: schedule.scheduled_pickup_at,
      needed_by: timing.needed_by,
      needed_by_at: timing.needed_by_at,
      cargo_ready_at: schedule.cargo_ready_at || timing.cargo_ready_at,
      prep_min: timing.prep_min,
      load_min: timing.load_min,
      paperwork_min: timing.paperwork_min,
      unload_min: timing.unload_min,
      origin_ops_min: timing.origin_ops_min,
      eta_total_min: timing.eta_total_min,
      prep_checklist: timing.prep_checklist,
      status: 'published',
      notes: body.notes?.trim() || null,
      budget_min_clp: body.budget_min_clp != null ? Number(body.budget_min_clp) : null,
      budget_max_clp: body.budget_max_clp != null ? Number(body.budget_max_clp) : null,
      ...addressPayload(body),
      ...cargoTrustPayload(body),
    });
    res.status(201).json({ ok: true, data: row });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al publicar carga' });
  }
});

module.exports = router;
