'use strict';

const express = require('express');
const repo = require('../lib/repository');
const comms = require('../services/comms');
const { listTripEvents } = require('../lib/trip-events');
const { CHAT_PRESETS, otherRole, presetByCode } = require('../lib/match-comms');
const { optionalAuth } = require('../lib/optional-auth');
const { normalizeRole } = require('../lib/match-cancel');
const { getMatchParties } = require('../lib/match-parties');
const { isMatchChatFree, enableMatchFreeChat } = require('../lib/match-chat');
const { textContainsPhone } = require('../lib/phone-guard');
const support = require('../lib/support-cases');

const router = express.Router();

function resolveActorRole(req) {
  if (req.user?.role) return normalizeRole(req.user.role);
  return normalizeRole(req.body?.actor_role || req.query?.actor_role);
}

router.get('/presets', (_req, res) => {
  res.json({
    ok: true,
    data: CHAT_PRESETS.map(({ code, label, body, opens_support, category }) => ({
      code,
      label,
      body,
      category: category || 'coordination',
      opens_support: Boolean(opens_support),
    })),
  });
});

router.get('/:matchId/messages', async (req, res) => {
  try {
    const match = await repo.getById('matches', req.params.matchId);
    if (!match) return res.status(404).json({ ok: false, error: 'Emparejamiento no encontrado' });
    const data = await comms.listMessages(match.id);
    const chat_free = await isMatchChatFree(match);
    const in_route = match.status === 'in_progress';
    res.json({
      ok: true,
      data,
      chat_free,
      in_route,
      chat_mode: chat_free ? 'free' : 'presets_only',
    });
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
    const preset = presetByCode(req.body?.preset_code);
    let body = (req.body?.body || '').trim();
    if (preset) body = preset.body;

    if (!body) return res.status(400).json({ ok: false, error: 'Mensaje vacío' });

    const chatFree = await isMatchChatFree(match);
    const isAdmin = req.user?.role === 'admin';

    if (!preset && !chatFree && !isAdmin) {
      return res.status(403).json({
        ok: false,
        error:
          'Solo mensajes rápidos hasta que el viaje esté en ruta. Para emergencias (pago, robo, daño grave), usa las opciones de agente Cubik.',
        chat_mode: 'presets_only',
      });
    }

    if (!preset && !isAdmin && textContainsPhone(body)) {
      return res.status(403).json({
        ok: false,
        error:
          'Por seguridad no puedes compartir teléfonos en el chat. Usa el botón «Llamar» del viaje (número enmascarado Cubik).',
        chat_mode: 'no_phone',
      });
    }

    if (preset?.opens_support && req.user?.sub) {
      try {
        await support.createCase({
          match_id: match.id,
          user: req.user,
          subject: 'Emergencia — chat emparejamiento',
          initial_message: body,
          auto: false,
        });
        await comms.addNotification({
          match_id: match.id,
          for_role: otherRole(role),
          type: 'support',
          title: 'Emergencia reportada',
          body: 'Se registró una emergencia en el viaje. Un agente Cubik revisará el caso.',
        });
        await comms.addNotification({
          match_id: match.id,
          for_role: role,
          type: 'support',
          title: 'Solicitud de agente registrada',
          body: 'Un moderador Cubik revisará el caso. Cuando atienda, podrás escribir libremente en el chat.',
        });
      } catch (err) {
        console.error('support case from chat preset', err);
      }
    }

    if (isAdmin && !preset) {
      await enableMatchFreeChat(match.id);
    }

    const msg = await comms.addMessage({
      match_id: match.id,
      sender_role: isAdmin && !preset ? 'moderator' : role,
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

    const refreshed = await repo.getById('matches', match.id);
    const chat_free = isAdmin ? true : await isMatchChatFree(refreshed || match);
    res.status(201).json({
      ok: true,
      data: msg,
      chat_free,
      in_route: (refreshed || match).status === 'in_progress',
      chat_mode: chat_free ? 'free' : 'presets_only',
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al enviar mensaje' });
  }
});

const STALE_MATCH_STATUSES = new Set(['cancelled', 'completed']);

router.get('/notifications/list', optionalAuth, async (req, res) => {
  try {
    if (!req.user?.role) {
      return res.json({ ok: true, data: [], unread: 0, requires_login: true });
    }
    const role = normalizeRole(req.user.role);
    if (!['shipper', 'carrier'].includes(role)) {
      return res.status(400).json({ ok: false, error: 'Rol shipper o carrier requerido' });
    }
    const raw = await comms.listNotifications(role);
    const visible = [];
    const eventsByMatch = new Map();
    const priceNotifsByMatch = new Map();
    for (const n of raw) {
      if (n.type === 'price_offer') {
        if (!priceNotifsByMatch.has(n.match_id)) priceNotifsByMatch.set(n.match_id, []);
        priceNotifsByMatch.get(n.match_id).push(n);
      }
    }
    for (const n of raw) {
      const match = await repo.getById('matches', n.match_id);
      const stale = !match || STALE_MATCH_STATUSES.has(match.status);
      if (stale) {
        if (!n.read_at) await comms.markNotificationRead(n.id);
        continue;
      }
      let row = n;
      if (n.type === 'price_offer') {
        const parties = await getMatchParties(repo, match);
        const name = parties?.carrier_name || 'Transportista';
        if (!eventsByMatch.has(match.id)) {
          try {
            eventsByMatch.set(match.id, await listTripEvents(match.id));
          } catch {
            eventsByMatch.set(match.id, []);
          }
        }
        row = comms.enrichPriceOfferNotification(
          n,
          match,
          eventsByMatch.get(match.id),
          name,
          priceNotifsByMatch.get(match.id)
        );
      }
      visible.push(row);
    }
    visible.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const unread = visible.filter((n) => !n.read_at).length;
    res.json({ ok: true, data: visible, unread });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al leer notificaciones' });
  }
});

router.patch('/notifications/match/:matchId/read', optionalAuth, async (req, res) => {
  try {
    if (!req.user?.role) {
      return res.status(401).json({ ok: false, error: 'Inicia sesión' });
    }
    const role = normalizeRole(req.user.role);
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

router.patch('/notifications/:id/read', optionalAuth, async (req, res) => {
  try {
    if (!req.user?.role) {
      return res.status(401).json({ ok: false, error: 'Inicia sesión' });
    }
    const data = await comms.markNotificationRead(req.params.id);
    if (!data) return res.status(404).json({ ok: false, error: 'No encontrada' });
    res.json({ ok: true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al marcar leída' });
  }
});

module.exports = router;
