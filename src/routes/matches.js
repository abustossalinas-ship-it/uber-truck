'use strict';

const express = require('express');
const repo = require('../lib/repository');
const { optionalNumber, parseBody } = require('../lib/validate');

const router = express.Router();

const MATCH_TRANSITIONS = {
  proposed: ['accepted', 'cancelled'],
  accepted: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  disputed: ['completed', 'cancelled'],
};

router.get('/', async (_req, res) => {
  try {
    const rows = await repo.list('matches', {});
    res.json({ ok: true, data: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al listar matches' });
  }
});

router.post('/', async (req, res) => {
  const body = req.body || {};
  try {
    const load = await repo.getById('load_requests', body.load_request_id);
    const offer = await repo.getById('capacity_offers', body.capacity_offer_id);
    if (!load || !offer) {
      return res.status(400).json({ ok: false, error: 'Carga u oferta no válida' });
    }
    if (load.status !== 'published') {
      return res.status(400).json({ ok: false, error: 'La carga ya no está disponible' });
    }
    if (offer.status !== 'published') {
      return res.status(400).json({ ok: false, error: 'La oferta ya no está disponible' });
    }

    const errors = parseBody([() => optionalNumber(body.agreed_price_clp, 'agreed_price_clp')]);
    if (errors.length) return res.status(400).json({ ok: false, errors });

    const row = await repo.insert('matches', {
      load_request_id: load.id,
      capacity_offer_id: offer.id,
      agreed_price_clp: body.agreed_price_clp != null ? Number(body.agreed_price_clp) : null,
      status: 'proposed',
      notes: body.notes?.trim() || null,
    });

    res.status(201).json({ ok: true, data: row });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al crear match' });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const match = await repo.getById('matches', req.params.id);
    if (!match) return res.status(404).json({ ok: false, error: 'No encontrado' });

    const next = req.body?.status;
    const allowed = MATCH_TRANSITIONS[match.status] || [];
    if (!next || !allowed.includes(next)) {
      return res.status(400).json({
        ok: false,
        error: `Transición no permitida desde ${match.status}`,
        allowed,
      });
    }

    const updated = await repo.update('matches', match.id, { status: next });

    if (next === 'accepted') {
      await repo.update('load_requests', match.load_request_id, { status: 'matched' });
      await repo.update('capacity_offers', match.capacity_offer_id, { status: 'reserved' });
    }
    if (next === 'in_progress') {
      await repo.update('load_requests', match.load_request_id, { status: 'in_transit' });
    }
    if (next === 'completed') {
      await repo.update('load_requests', match.load_request_id, { status: 'delivered' });
      await repo.update('capacity_offers', match.capacity_offer_id, { status: 'reserved' });
    }
    if (next === 'cancelled' && match.status === 'proposed') {
      const load = await repo.getById('load_requests', match.load_request_id);
      const offer = await repo.getById('capacity_offers', match.capacity_offer_id);
      if (load?.status === 'matched') {
        await repo.update('load_requests', load.id, { status: 'published' });
      }
      if (offer?.status === 'reserved') {
        await repo.update('capacity_offers', offer.id, { status: 'published' });
      }
    }

    res.json({ ok: true, data: updated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al actualizar match' });
  }
});

module.exports = router;
