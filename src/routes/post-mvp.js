'use strict';

const express = require('express');
const { authMiddleware } = require('../lib/auth');
const { buildPostMvpStatus } = require('../lib/post-mvp-status');
const fcm = require('../services/fcm');

const router = express.Router();

function attachUserIfBearer(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return next();
  return authMiddleware(req, res, next);
}

router.get('/status', attachUserIfBearer, async (req, res) => {
  try {
    let fcm_tokens = 0;
    if (req.user?.sub) {
      fcm_tokens = await fcm.countTokensForUser(req.user.sub);
    }
    res.json({ ok: true, ...buildPostMvpStatus({ fcm_tokens }) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'No se pudo leer estado Post-MVP' });
  }
});

router.post('/validate-note', authMiddleware, (req, res) => {
  const { item_id, note, validated } = req.body || {};
  if (!item_id?.trim()) {
    return res.status(400).json({ ok: false, error: 'item_id requerido' });
  }
  res.json({
    ok: true,
    stored: 'client',
    message:
      'Validación registrada en el navegador (localStorage). Actualiza memoria al cerrar ítem en prod.',
    item_id: item_id.trim(),
    validated: Boolean(validated),
    note: note?.trim() || null,
    user_id: req.user.sub,
  });
});

module.exports = router;
