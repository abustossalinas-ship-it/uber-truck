'use strict';

const express = require('express');
const maps = require('../services/google-maps');
const { LOAD_PRESETS, OFFER_PRESETS } = require('../lib/cubicacion-presets');

const router = express.Router();

router.get('/status', (_req, res) => {
  res.json({ ok: true, configured: maps.isConfigured() });
});

router.get('/cubicacion-presets', (_req, res) => {
  res.json({ ok: true, load: LOAD_PRESETS, offer: OFFER_PRESETS });
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
