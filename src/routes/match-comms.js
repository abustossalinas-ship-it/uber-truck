'use strict';

const express = require('express');
const repo = require('../lib/repository');
const comms = require('../services/comms');
const { CHAT_PRESETS, otherRole, presetByCode } = require('../lib/match-comms');
const { optionalAuth } = require('../lib/optional-auth');
const { normalizeRole } = require('../lib/match-cancel');
const { getMatchParties } = require('../lib/match-parties');

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
    const parties = await getMatchParties(repo, match);
    const senderName =
      role === 'shipper' ? parties?.shipper_name || 'Embarcador' : parties?.carrier_name || 'Transportista';
    const pairLine = parties?.labeled ? `${parties.labeled}. ` : '';
    await comms.addNotification({
      match_id: match.id,
      for_role: target,
      type: 'chat',
      title: parties?.short ? `Mensaje — ${parties.short}` : 'Nuevo mensaje en el emparejamiento',
      body: `${pairLine}${senderName}: ${body.slice(0, 100)}`,
    });

    res.status(201).json({ ok: true, data: msg });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al enviar mensaje' });
  }
});

const STALE_MATCH_STATUSES = new Set(['cancelled', 'completed']);

router.get('/notifications/list', async (req, res) => {
  try {
    const role = resolveActorRole(req);
    if (!['shipper', 'carrier'].includes(role)) {
      return res.status(400).json({ ok: false, error: 'Rol shipper o carrier requerido' });
    }
    const raw = await comms.listNotifications(role);
    const visible = [];
    for (const n of raw) {
      const match = await repo.getById('matches', n.match_id);
      const stale = !match || STALE_MATCH_STATUSES.has(match.status);
      if (stale) {
        if (!n.read_at) await comms.markNotificationRead(n.id);
        continue;
      }
      visible.push(n);
    }
    const unread = visible.filter((n) => !n.read_at).length;
    res.json({ ok: true, data: visible, unread });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al leer notificaciones' });
  }
});

router.patch('/notifications/match/:matchId/read', async (req, res) => {
  try {
    const role = resolveActorRole(req);
    if (!['shipper', 'carrier'].includes(role)) {
      return res.status(400).json({ ok: false, error: 'Rol shipper o carrier requerido' });
    }
    const marked = await comms.markAllReadForMatch(role, req.params.matchId);
    res.json({ ok: true, marked });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al marcar notificaciones' });
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
