'use strict';

const express = require('express');
const { authMiddleware } = require('../lib/auth');
const { requireApprovedOperator } = require('../lib/kyc-gate');
const { requireBankAccount } = require('../lib/bank-gate');
const {
  getUserPresence,
  setCarrierAvailability,
  updateCarrierLocation,
  validLatLng,
} = require('../lib/carrier-presence');

const router = express.Router();
const lastLocationLog = new Map();

function requireCarrier(req, res, next) {
  if (req.user?.role !== 'carrier') {
    return res.status(403).json({ ok: false, error: 'Solo transportista' });
  }
  next();
}

router.get('/presence', authMiddleware, requireCarrier, async (req, res) => {
  try {
    const data = await getUserPresence(req.user.sub);
    res.json({ ok: true, data: data || { is_available: false } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al leer disponibilidad' });
  }
});

router.patch(
  '/availability',
  authMiddleware,
  requireCarrier,
  requireApprovedOperator,
  requireBankAccount,
  async (req, res) => {
    const { is_available, lat, lng } = req.body || {};
    if (typeof is_available !== 'boolean') {
      return res.status(400).json({ ok: false, error: 'is_available (boolean) requerido' });
    }
    if (is_available && !validLatLng(Number(lat), Number(lng))) {
      return res.status(400).json({
        ok: false,
        error: 'Activa «Disponible» con ubicación GPS (permiso del navegador)',
      });
    }
    try {
      const user = await setCarrierAvailability(req.user.sub, is_available, { lat, lng });
      res.json({
        ok: true,
        data: {
          is_available: Boolean(user.is_available),
          last_lat: user.last_lat ?? null,
          last_lng: user.last_lng ?? null,
          location_updated_at: user.location_updated_at || null,
        },
        message: is_available
          ? 'Estás visible como disponible. Compartiremos tu ubicación mientras sigas disponible o en viaje.'
          : 'Ya no apareces como disponible.',
      });
    } catch (e) {
      console.error(e);
      res.status(e.status || 500).json({ ok: false, error: e.message || 'Error' });
    }
  }
);

router.post(
  '/location',
  authMiddleware,
  requireCarrier,
  requireApprovedOperator,
  async (req, res) => {
    const { lat, lng } = req.body || {};
    try {
      const result = await updateCarrierLocation(req.user.sub, lat, lng, {
        logTrip: true,
      });
      lastLocationLog.set(req.user.sub, Date.now());
      res.json({ ok: true, data: result });
    } catch (e) {
      console.error(e);
      res.status(e.status || 500).json({ ok: false, error: e.message || 'Error' });
    }
  }
);

module.exports = router;
