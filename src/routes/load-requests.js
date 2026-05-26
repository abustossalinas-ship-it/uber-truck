'use strict';

const express = require('express');
const repo = require('../lib/repository');
const { requiredString, optionalNumber, parseBody } = require('../lib/validate');
const { addressPayload } = require('../lib/geo-fields');
const { requireMapsAddresses } = require('../lib/geo-validate');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const rows = await repo.list('load_requests', {
      region: req.query.region,
      status: req.query.status,
    });
    res.json({ ok: true, data: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al listar cargas' });
  }
});

router.get('/:id/match-suggestions', async (req, res) => {
  try {
    const load = await repo.getById('load_requests', req.params.id);
    if (!load) return res.status(404).json({ ok: false, error: 'Carga no encontrada' });
    const offers = await repo.list('capacity_offers', { status: 'published' });
    const { rankOffersForLoad } = require('../lib/match-score');
    const ranked = rankOffersForLoad(load, offers);
    res.json({ ok: true, load_id: load.id, data: ranked });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al sugerir matches' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const row = await repo.getById('load_requests', req.params.id);
    if (!row) return res.status(404).json({ ok: false, error: 'No encontrado' });
    res.json({ ok: true, data: row });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al leer carga' });
  }
});

router.post('/', async (req, res) => {
  const body = req.body || {};
  const errors = parseBody([
    () => requiredString(body.company_name, 'company_name'),
    () => requiredString(body.origin_city, 'origin_city'),
    () => requiredString(body.origin_region, 'origin_region', 10),
    () => requiredString(body.destination_city, 'destination_city'),
    () => requiredString(body.destination_region, 'destination_region', 10),
    () => optionalNumber(body.volume_m3, 'volume_m3'),
    () => optionalNumber(body.weight_kg, 'weight_kg'),
    () => optionalNumber(body.pallets, 'pallets', { max: 500 }),
  ]);
  const geoErrors = requireMapsAddresses(body);
  if (geoErrors.length) return res.status(400).json({ ok: false, errors: geoErrors });
  if (errors.length) return res.status(400).json({ ok: false, errors });

  try {
    const row = await repo.insert('load_requests', {
      company_name: body.company_name.trim(),
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
      ...addressPayload(body),
    });
    res.status(201).json({ ok: true, data: row });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al publicar carga' });
  }
});

module.exports = router;
