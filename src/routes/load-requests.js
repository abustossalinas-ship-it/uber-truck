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
  assertCanPublishLoad,
  assertCanMatchLoad,
} = require('../lib/access-scope');

const router = express.Router();

router.get('/', optionalAuth, async (req, res) => {
  try {
    const filters = loadListFilters(req.user, req.query);
    const rows = await repo.list('load_requests', filters);
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
    const offerFilters = req.user?.role === 'carrier'
      ? { carrier_user_id: req.user.sub, status: 'published' }
      : { status: 'published' };
    const offers = await repo.list('capacity_offers', offerFilters);
    const { rankOffersForLoad } = require('../lib/match-score');
    const ranked = rankOffersForLoad(load, offers);
    res.json({ ok: true, load_id: load.id, data: ranked });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al sugerir matches' });
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

router.post('/', optionalAuth, requireAuthIfDb, async (req, res) => {
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
  const budgetErrors = require('../lib/match-price').validateLoadBudget(
    body.budget_min_clp,
    body.budget_max_clp
  );
  if (budgetErrors.length) return res.status(400).json({ ok: false, errors: budgetErrors });
  const geoErrors = requireMapsAddresses(body);
  if (geoErrors.length) return res.status(400).json({ ok: false, errors: geoErrors });
  if (errors.length) return res.status(400).json({ ok: false, errors });

  const companyName =
    req.user?.role === 'shipper' && req.user.company_name
      ? req.user.company_name
      : body.company_name.trim();

  try {
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
      urgency: body.urgency === 'urgent' ? 'urgent' : 'normal',
      needed_by: body.needed_by || null,
      status: 'published',
      notes: body.notes?.trim() || null,
      budget_min_clp: body.budget_min_clp != null ? Number(body.budget_min_clp) : null,
      budget_max_clp: body.budget_max_clp != null ? Number(body.budget_max_clp) : null,
      ...addressPayload(body),
    });
    res.status(201).json({ ok: true, data: row });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al publicar carga' });
  }
});

module.exports = router;
