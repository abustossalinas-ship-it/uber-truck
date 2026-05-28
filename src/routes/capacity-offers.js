'use strict';

const express = require('express');
const repo = require('../lib/repository');
const supabaseService = require('../services/supabase');
const { requiredString, optionalNumber, parseBody } = require('../lib/validate');
const { addressPayload } = require('../lib/geo-fields');
const { requireMapsAddresses } = require('../lib/geo-validate');
const { optionalAuth } = require('../lib/optional-auth');
const { requireAuthIfDb } = require('../lib/require-auth');
const { offerListFilters, assertCanPublishOffer } = require('../lib/access-scope');

const router = express.Router();

router.get('/', optionalAuth, async (req, res) => {
  try {
    const filters = offerListFilters(req.user, req.query);
    let rows = await repo.list('capacity_offers', filters);
    const { getReputationIndex, pickRep } = require('../lib/match-ratings');
    const repIndex = await getReputationIndex(repo);
    rows = rows.map((o) => ({
      ...o,
      reputation: pickRep(repIndex, 'carrier', o.carrier_user_id, o.carrier_name),
    }));
    res.json({ ok: true, data: rows, scope: req.user?.role || 'public' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al listar ofertas' });
  }
});

router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const row = await repo.getById('capacity_offers', req.params.id);
    if (!row) return res.status(404).json({ ok: false, error: 'No encontrado' });
    res.json({ ok: true, data: row });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al leer oferta' });
  }
});

router.post('/', optionalAuth, requireAuthIfDb, async (req, res) => {
  const body = req.body || {};
  if (supabaseService.isConfigured()) {
    const pubErr = assertCanPublishOffer(req.user);
    if (pubErr) return res.status(403).json({ ok: false, error: pubErr });
  }
  const errors = parseBody([
    () => requiredString(body.carrier_name, 'carrier_name'),
    () => requiredString(body.origin_city, 'origin_city'),
    () => requiredString(body.origin_region, 'origin_region', 10),
    () => requiredString(body.destination_city, 'destination_city'),
    () => requiredString(body.destination_region, 'destination_region', 10),
    () => optionalNumber(body.free_volume_m3, 'free_volume_m3'),
    () => optionalNumber(body.max_weight_kg, 'max_weight_kg'),
  ]);
  const geoErrors = requireMapsAddresses(body);
  if (geoErrors.length) return res.status(400).json({ ok: false, errors: geoErrors });
  if (errors.length) return res.status(400).json({ ok: false, errors });

  const carrierName =
    req.user?.role === 'carrier' && req.user.company_name
      ? req.user.company_name
      : body.carrier_name.trim();

  try {
    const row = await repo.insert('capacity_offers', {
      carrier_user_id: req.user?.sub || null,
      carrier_name: carrierName,
      origin_city: body.origin_city.trim(),
      origin_region: body.origin_region.trim().toUpperCase(),
      destination_city: body.destination_city.trim(),
      destination_region: body.destination_region.trim().toUpperCase(),
      free_volume_m3: body.free_volume_m3 != null ? Number(body.free_volume_m3) : null,
      max_weight_kg: body.max_weight_kg != null ? Number(body.max_weight_kg) : null,
      cargo_types: body.cargo_types?.trim() || null,
      available_from: body.available_from || null,
      available_until: body.available_until || null,
      status: 'published',
      notes: body.notes?.trim() || null,
      ...addressPayload(body),
    });
    res.status(201).json({ ok: true, data: row });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al publicar oferta' });
  }
});

module.exports = router;
