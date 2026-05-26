'use strict';

const express = require('express');
const repo = require('../lib/repository');
const { requiredString, optionalNumber, parseBody } = require('../lib/validate');
const { addressPayload } = require('../lib/geo-fields');
const { requireMapsAddresses } = require('../lib/geo-validate');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const rows = await repo.list('capacity_offers', {
      region: req.query.region,
      status: req.query.status,
    });
    res.json({ ok: true, data: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al listar ofertas' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const row = await repo.getById('capacity_offers', req.params.id);
    if (!row) return res.status(404).json({ ok: false, error: 'No encontrado' });
    res.json({ ok: true, data: row });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al leer oferta' });
  }
});

router.post('/', async (req, res) => {
  const body = req.body || {};
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

  try {
    const row = await repo.insert('capacity_offers', {
      carrier_name: body.carrier_name.trim(),
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
