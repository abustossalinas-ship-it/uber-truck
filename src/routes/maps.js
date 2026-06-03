'use strict';

const express = require('express');
const maps = require('../services/google-maps');
const { verifyToken } = require('../lib/auth');
const { buildMatchTracking } = require('../lib/match-tracking');
const { LOAD_PRESETS, OFFER_PRESETS } = require('../lib/cubicacion-presets');
const { densityOptions, STANDARD_PALLET_M3 } = require('../lib/cubicacion-estimate');
const { suggestReferenceBudget } = require('../lib/match-price');
const { TRUCK_TYPES, suggestTruckCapacity } = require('../lib/truck-capacity');

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
    truck_types: TRUCK_TYPES,
    weight_formula:
      'Peso sugerido = max(pallets × kg/pallet, m³ × kg/m³) según densidad. El volumen no implica el mismo peso (ej. papas vs pañales).',
    standard_pallet_m3: STANDARD_PALLET_M3,
  });
});

router.post('/truck-suggest', (req, res) => {
  res.json({ ok: true, data: suggestTruckCapacity(req.body || {}) });
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

/** Mapa estático del viaje — proxy servidor (la API key no se expone al navegador). */
router.get('/trip-map/:matchId', async (req, res) => {
  const token =
    req.query.access_token ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);
  const user = token ? verifyToken(token) : null;
  if (!user) {
    return res.status(401).json({ ok: false, error: 'Inicia sesión para ver el mapa' });
  }
  if (!maps.isConfigured()) {
    return res.status(503).json({ ok: false, error: 'Google Maps no configurado' });
  }
  try {
    const tracking = await buildMatchTracking(req.params.matchId, user);
    if (!tracking.static_map_url) {
      return res.status(404).json({
        ok: false,
        error:
          'Sin coordenadas de ruta. La carga debe publicarse eligiendo dirección en Google Maps.',
      });
    }
    const imgRes = await fetch(tracking.static_map_url);
    if (!imgRes.ok) {
      const errText = await imgRes.text().catch(() => '');
      console.error('static map upstream', imgRes.status, errText.slice(0, 200));
      return res.status(502).json({
        ok: false,
        error:
          'Google rechazó el mapa. Habilita «Maps Static API» en Google Cloud para esta API key.',
        status: imgRes.status,
      });
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    res.setHeader('Content-Type', imgRes.headers.get('content-type') || 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.send(buf);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ ok: false, error: e.message || 'Error al generar mapa' });
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
