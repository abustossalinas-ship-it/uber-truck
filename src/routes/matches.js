'use strict';

const express = require('express');
const repo = require('../lib/repository');
const { optionalNumber, parseBody } = require('../lib/validate');
const { optionalAuth } = require('../lib/optional-auth');
const {
  canPerform,
  validateReason,
  releaseLoadAndOffer,
  normalizeRole,
  ACTION_LABELS,
} = require('../lib/match-cancel');

const router = express.Router();

const MATCH_TRANSITIONS = {
  proposed: ['accepted', 'cancelled'],
  accepted: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  disputed: ['completed', 'cancelled'],
};

function resolveActorRole(req) {
  if (req.user?.role) return normalizeRole(req.user.role);
  return normalizeRole(req.body?.actor_role);
}

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

    const existing = await repo.findMatchPair(load.id, offer.id);
    if (existing) {
      if (existing.status === 'cancelled') {
        const revived = await repo.update('matches', existing.id, {
          status: 'proposed',
          agreed_price_clp: body.agreed_price_clp != null ? Number(body.agreed_price_clp) : null,
          cancel_action: null,
          cancelled_by: null,
          cancel_reason: null,
          notes: body.notes?.trim() || existing.notes,
        });
        return res.status(201).json({ ok: true, data: revived, revived: true });
      }
      return res.status(409).json({
        ok: false,
        error:
          'Ya existe un emparejamiento para esta carga y esta oferta. Revisa la sección Emparejamientos más abajo.',
        data: existing,
      });
    }

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
    const dup = e.code === '23505' || /duplicate/i.test(e.message || '');
    if (dup) {
      return res.status(409).json({
        ok: false,
        error:
          'Ya existe un emparejamiento para esta carga y esta oferta. Revisa la sección Emparejamientos más abajo.',
      });
    }
    res.status(500).json({ ok: false, error: 'Error al crear match' });
  }
});

router.patch('/:id/status', optionalAuth, async (req, res) => {
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

    const role = resolveActorRole(req);
    const action = req.body?.action || (next === 'cancelled' ? 'cancel' : null);

    if (next === 'cancelled') {
      if (!action || !['withdraw', 'reject', 'cancel'].includes(action)) {
        return res.status(400).json({
          ok: false,
          error: 'Indica action: withdraw, reject o cancel',
        });
      }
      if (!canPerform(match.status, action, role)) {
        return res.status(403).json({
          ok: false,
          error: `Tu rol (${role}) no puede ${ACTION_LABELS[action] || action} en estado ${match.status}`,
        });
      }
      const reasonErr = validateReason(action, match.status, req.body?.reason);
      if (reasonErr) return res.status(400).json({ ok: false, error: reasonErr });

      const patch = {
        status: 'cancelled',
        cancel_action: action,
        cancelled_by: role,
        cancel_reason: req.body?.reason?.trim() || null,
      };
      const updated = await repo.update('matches', match.id, patch);
      await releaseLoadAndOffer(match);
      return res.json({ ok: true, data: updated, message: cancelMessage(action) });
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

    res.json({ ok: true, data: updated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al actualizar match' });
  }
});

function cancelMessage(action) {
  if (action === 'withdraw') {
    return 'Propuesta retirada. La carga vuelve a estar disponible para otras ofertas.';
  }
  if (action === 'reject') {
    return 'Propuesta rechazada. La oferta sigue publicada para otras cargas.';
  }
  return 'Emparejamiento cancelado. Carga y oferta liberadas.';
}

module.exports = router;
