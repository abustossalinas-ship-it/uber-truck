'use strict';

const express = require('express');
const { verifyToken } = require('../lib/auth');
const realtime = require('../services/realtime-bus');
const repo = require('../lib/repository');
const { filterMatchesForUser } = require('../lib/access-scope');

const router = express.Router();

function resolveUser(req) {
  if (req.user) return req.user;
  const token = req.query.access_token;
  if (token) return verifyToken(token);
  return null;
}

router.get('/matches/:id/stream', async (req, res) => {
  const user = resolveUser(req);
  if (!user) {
    return res.status(401).json({ ok: false, error: 'Token requerido para tiempo real' });
  }
  try {
    const match = await repo.getById('matches', req.params.id);
    if (!match) return res.status(404).json({ ok: false, error: 'Viaje no encontrado' });
    const allowed = await filterMatchesForUser([match], user);
    if (!allowed.length) {
      return res.status(403).json({ ok: false, error: 'No participas en este viaje' });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const send = (payload) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    send({ type: 'connected', match_id: match.id });

    const unsubscribe = realtime.subscribeMatch(match.id, send);

    const heartbeat = setInterval(() => {
      res.write(': ping\n\n');
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'Error al abrir canal en tiempo real' });
    } else {
      res.end();
    }
  }
});

module.exports = router;
