'use strict';

const express = require('express');
const repo = require('../lib/repository');
const comms = require('../services/comms');
const { CHAT_PRESETS, otherRole, presetByCode } = require('../lib/match-comms');
const { optionalAuth } = require('../lib/optional-auth');
const { normalizeRole } = require('../lib/match-cancel');

const router = express.Router();

function resolveActorRole(req) {
  if (req.user?.role) return normalizeRole(req.user.role);
  return normalizeRole(req.body?.actor_role || req.query?.actor_role);
}

router.get('/presets', (_req, res) => {
  res.json({ ok: true, data: CHAT_PRESETS });
});

router.get('/:matchId/messages', async (req, res) => {
  try {
    const match = await repo.getById('matches', req.params.matchId);
    if (!match) return res.status(404).json({ ok: false, error: 'Emparejamiento no encontrado' });
    const data = await comms.listMessages(match.id);
    res.json({ ok: true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al leer mensajes' });
  }
});

router.post('/:matchId/messages', optionalAuth, async (req, res) => {
  try {
    const match = await repo.getById('matches', req.params.matchId);
    if (!match) return res.status(404).json({ ok: false, error: 'Emparejamiento no encontrado' });
    const role = resolveActorRole(req);
    let body = (req.body?.body || '').trim();
    const preset = presetByCode(req.body?.preset_code);
    if (preset) body = preset.body;
    if (!body) return res.status(400).json({ ok: false, error: 'Mensaje vacío' });

    const msg = await comms.addMessage({
      match_id: match.id,
      sender_role: role,
      body,
      preset_code: preset?.code || null,
    });

    const target = otherRole(role);
    await comms.addNotification({
      match_id: match.id,
      for_role: target,
      type: 'chat',
      title: 'Nuevo mensaje en el emparejamiento',
      body: body.slice(0, 120),
    });

    res.status(201).json({ ok: true, data: msg });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al enviar mensaje' });
  }
});

router.get('/notifications/list', async (req, res) => {
  try {
    const role = resolveActorRole(req);
    if (!['shipper', 'carrier'].includes(role)) {
      return res.status(400).json({ ok: false, error: 'Rol shipper o carrier requerido' });
    }
    const data = await comms.listNotifications(role);
    const unread = data.filter((n) => !n.read_at).length;
    res.json({ ok: true, data, unread });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al leer notificaciones' });
  }
});

router.patch('/notifications/:id/read', async (req, res) => {
  try {
    const data = await comms.markNotificationRead(req.params.id);
    if (!data) return res.status(404).json({ ok: false, error: 'No encontrada' });
    res.json({ ok: true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al marcar leída' });
  }
});

module.exports = router;
