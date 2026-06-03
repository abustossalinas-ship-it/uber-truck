'use strict';

const express = require('express');
const { authMiddleware } = require('../lib/auth');
const fcm = require('../services/fcm');

const router = express.Router();

router.post('/push-token', authMiddleware, async (req, res) => {
  const token = req.body?.token?.trim();
  const platform = req.body?.platform?.trim() || 'android';
  if (!token || token.length < 20) {
    return res.status(400).json({ ok: false, error: 'Token push inválido' });
  }
  try {
    const row = await fcm.upsertDeviceToken(req.user.sub, token, platform);
    res.json({
      ok: true,
      registered: true,
      fcm_configured: fcm.isConfigured(),
      id: row.id,
      message: fcm.isConfigured()
        ? 'Dispositivo registrado para notificaciones push.'
        : 'Token guardado. Configura FCM_SERVER_KEY en el servidor para enviar push.',
    });
  } catch (e) {
    const code = e.status || 500;
    if (code !== 500) return res.status(code).json({ ok: false, error: e.message });
    console.error(e);
    res.status(500).json({ ok: false, error: 'No se pudo registrar el dispositivo' });
  }
});

module.exports = router;
