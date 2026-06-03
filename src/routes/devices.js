'use strict';

const express = require('express');
const { authMiddleware } = require('../lib/auth');
const fcm = require('../services/fcm');

const router = express.Router();

router.get('/push-status', authMiddleware, async (req, res) => {
  try {
    const count = await fcm.countTokensForUser(req.user.sub);
    res.json({
      ok: true,
      ...fcm.statusPayload(),
      device_tokens: count,
      message:
        count > 0
          ? `${count} dispositivo(s) registrado(s) para push.`
          : 'Abre la app Android con sesión iniciada para registrar push.',
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'No se pudo leer estado push' });
  }
});

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
      ...fcm.statusPayload(),
      id: row.id,
      message: fcm.isConfigured()
        ? 'Dispositivo registrado para notificaciones push.'
        : 'Token guardado. Configura FCM_SERVICE_ACCOUNT_B64 (o JSON/FCM_SERVER_KEY) en Railway.',
    });
  } catch (e) {
    const code = e.status || 500;
    if (code !== 500) return res.status(code).json({ ok: false, error: e.message });
    console.error(e);
    res.status(500).json({ ok: false, error: 'No se pudo registrar el dispositivo' });
  }
});

router.post('/push-test', authMiddleware, async (req, res) => {
  if (!fcm.isConfigured()) {
    return res.status(503).json({
      ok: false,
      error: 'FCM no configurado en el servidor (FCM_SERVICE_ACCOUNT_B64, JSON o FCM_SERVER_KEY).',
    });
  }
  try {
    const title = req.body?.title?.trim() || 'Cubik — prueba push';
    const body =
      req.body?.body?.trim() ||
      'Notificación de prueba. Si ves esto, FCM está funcionando.';
    const result = await fcm.sendPushToUser(req.user.sub, {
      title,
      body,
      data: { type: 'test' },
    });
    if (!result.ok) {
      return res.status(400).json({
        ok: false,
        error:
          result.reason === 'no_tokens'
            ? 'No hay dispositivo registrado. Abre la app Android e inicia sesión.'
            : 'No se pudo enviar push',
        ...result,
      });
    }
    res.json({ ok: true, message: 'Push de prueba enviado.', ...result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al enviar push de prueba' });
  }
});

module.exports = router;
