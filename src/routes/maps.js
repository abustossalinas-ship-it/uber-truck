'use strict';

const express = require('express');
const maps = require('../services/google-maps');
const { LOAD_PRESETS, OFFER_PRESETS } = require('../lib/cubicacion-presets');
const { densityOptions, STANDARD_PALLET_M3 } = require('../lib/cubicacion-estimate');
const { suggestReferenceBudget } = require('../lib/match-price');

const router = express.Router();

router.get('/status', (_req, res) => {
  res.json({ ok: true, configured: maps.isConfigured() });
});

router.post('/budget-estimate', (req, res) => {
  const body = req.body || {};
  const hint = suggestReferenceBudget({
    distance_km: body.distance_km,
    weight_kg: body.weight_kg,
    urgency: body.urgency,
  });
  res.json({
    ok: true,
    data: hint,
    disclaimer:
      'Solo referencia (km, peso, urgencia). No obliga al transportista; puedes editar el rango.',
  });
});

router.get('/cubicacion-presets', (_req, res) => {
  res.json({
    ok: true,
    load: LOAD_PRESETS,
    offer: OFFER_PRESETS,
    density_options: densityOptions(),
    weight_formula:
      'Peso sugerido = max(pallets × kg/pallet, m³ × kg/m³) según densidad. El volumen no implica el mismo peso (ej. papas vs pañales).',
    standard_pallet_m3: STANDARD_PALLET_M3,
  });
});

router.get('/autocomplete', async (req, res) => {
  if (!maps.isConfigured()) {
    return res.status(503).json({ ok: false, error: 'Google Maps no configurado (GOOGLE_MAPS_API_KEY)' });
  }
  try {
    const predictions = await maps.autocomplete(req.query.input || '');
    res.json({ ok: true, data: predictions });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message || 'Error autocomplete' });
  }
});

router.get('/place/:placeId', async (req, res) => {
  if (!maps.isConfigured()) {
    return res.status(503).json({ ok: false, error: 'Google Maps no configurado' });
  }
  try {
    const place = await maps.placeDetails(req.params.placeId);
    if (!place) return res.status(404).json({ ok: false, error: 'Lugar no encontrado' });
    res.json({ ok: true, data: place });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message || 'Error place details' });
  }
});

router.post('/distance', async (req, res) => {
  if (!maps.isConfigured()) {
    return res.status(503).json({ ok: false, error: 'Google Maps no configurado' });
  }
  const { origin, destination } = req.body || {};
  if (!origin?.lat || !destination?.lat) {
    return res.status(400).json({ ok: false, error: 'Origen y destino con coordenadas requeridos' });
  }
  try {
    const result = await maps.distanceKm(origin, destination);
    res.json({ ok: result.ok, ...result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message || 'Error distancia' });
  }
});

module.exports = router;
