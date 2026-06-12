'use strict';

const express = require('express');
const { authMiddleware } = require('../lib/auth');
const prospectos = require('../lib/prospectos');

const router = express.Router();

router.get('/config', (_req, res) => {
  const cfg = prospectos.whatsappConfig();
  const whatsappCloud = require('../services/whatsapp-cloud');
  res.json({
    ok: true,
    whatsapp: {
      configured: cfg.configured,
      bot: cfg.bot && whatsappCloud.isConfigured(),
      urls: {
        shipper: prospectos.buildWhatsAppUrl('shipper'),
        carrier: prospectos.buildWhatsAppUrl('carrier'),
      },
    },
  });
});

router.post('/', async (req, res) => {
  try {
    const row = await prospectos.createProspecto(req.body || {});
    res.status(201).json({
      ok: true,
      data: { id: row.id },
      message: 'Recibimos tu solicitud. Te contactaremos pronto.',
    });
  } catch (e) {
    const code = e.statusCode || 500;
    if (code !== 500) return res.status(code).json({ ok: false, error: e.message });
    console.error(e);
    res.status(500).json({ ok: false, error: 'No pudimos guardar tu solicitud. Intenta de nuevo.' });
  }
});

router.get('/', authMiddleware, async (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Solo administradores' });
  }
  try {
    const role = prospectos.normalizeRole(req.query.role);
    const filters = {};
    if (role) filters.role = role;
    if (req.query.status) filters.status = String(req.query.status);
    const rows = await prospectos.listProspectos(filters);
    res.json({ ok: true, data: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al listar prospectos' });
  }
});

module.exports = router;
