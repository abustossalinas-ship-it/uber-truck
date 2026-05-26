'use strict';

const express = require('express');
const repo = require('../lib/repository');
const { optionalNumber, parseBody } = require('../lib/validate');
const { optionalAuth } = require('../lib/optional-auth');
const {
  canPerform,
  validateReasonPayload,
  checkWithdrawLimit,
  applyCancelPatch,
  releaseLoadAndOffer,
  normalizeRole,
  ACTION_LABELS,
  computePenalty,
  getReasonByCode,
} = require('../lib/match-cancel');
const { listReasonOptions, phaseLabel } = require('../lib/match-cancel-reasons');
const {
  isMutualCancelReady,
  mutualCancelStatus,
  fieldForRole,
} = require('../lib/mutual-cancel');
const comms = require('../services/comms');
const { otherRole } = require('../lib/match-comms');
const { getMatchParties } = require('../lib/match-parties');
const {
  filterMatchesForUser,
  assertCanMatchLoad,
  assertCanMatchOffer,
} = require('../lib/access-scope');

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
  return normalizeRole(req.body?.actor_role || req.query?.actor_role);
}

router.get('/cancel-options', optionalAuth, async (req, res) => {
  const action = req.query.action;
  const phase = req.query.phase || req.query.status;
  const role = resolveActorRole(req);
  if (!action || !phase) {
    return res.status(400).json({ ok: false, error: 'Query: action y phase (estado del match)' });
  }
  const agreed = req.query.agreed_price_clp ? Number(req.query.agreed_price_clp) : null;
  let mutual = { ready: false, shipper_confirmed: false, carrier_confirmed: false };
  const matchId = req.query.match_id;
  if (matchId) {
    const match = await repo.getById('matches', matchId);
    if (match) mutual = mutualCancelStatus(match);
  }
  const options = listReasonOptions(action, phase, role, agreed, {
    mutualReady: mutual.ready,
  });
  res.json({
    ok: true,
    phase,
    phase_label: phaseLabel(phase),
    mutual_cancel: mutual,
    data: options,
    limits: { note: 'Multas sugeridas; acuerdo entre partes. Sin cobro automático en MVP.' },
  });
});

router.get('/', optionalAuth, async (req, res) => {
  try {
    let rows = await repo.list('matches', {});
    rows = await filterMatchesForUser(rows, req.user);
    res.json({ ok: true, data: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al listar matches' });
  }
});

router.post('/', optionalAuth, async (req, res) => {
  const body = req.body || {};
  try {
    const load = await repo.getById('load_requests', body.load_request_id);
    const offer = await repo.getById('capacity_offers', body.capacity_offer_id);
    if (!load || !offer) {
      return res.status(400).json({ ok: false, error: 'Carga u oferta no válida' });
    }
    const loadErr = assertCanMatchLoad(req.user, load);
    if (loadErr) return res.status(403).json({ ok: false, error: loadErr });
    const offerErr = assertCanMatchOffer(req.user, offer);
    if (offerErr) return res.status(403).json({ ok: false, error: offerErr });
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
          reason_code: null,
          reason_detail: null,
          penalty_type: null,
          penalty_amount_clp: null,
          agreement_accepted: false,
          mutual_cancel_shipper_at: null,
          mutual_cancel_carrier_at: null,
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

router.post('/:id/mutual-cancel', optionalAuth, async (req, res) => {
  try {
    const match = await repo.getById('matches', req.params.id);
    if (!match) return res.status(404).json({ ok: false, error: 'No encontrado' });
    if (!['accepted', 'in_progress'].includes(match.status)) {
      return res.status(400).json({
        ok: false,
        error: 'Acuerdo mutuo solo aplica con emparejamiento aceptado o en ruta.',
      });
    }
    const role = resolveActorRole(req);
    const field = fieldForRole(role);
    if (!field) {
      return res.status(403).json({ ok: false, error: 'Rol no válido para confirmar acuerdo mutuo.' });
    }
    if (match[field]) {
      return res.json({
        ok: true,
        data: match,
        mutual_cancel: mutualCancelStatus(match),
        message: 'Ya habías confirmado el acuerdo mutuo.',
      });
    }
    const updated = await repo.update('matches', match.id, {
      [field]: new Date().toISOString(),
    });
    const status = mutualCancelStatus(updated);
    const message = status.ready
      ? 'Ambos confirmaron. En «Cancelar emparejamiento» puedes finalizar con acuerdo mutuo.'
      : role === 'shipper'
        ? 'Embarcador confirmó. Falta confirmación del transportista.'
        : 'Transportista confirmó. Falta confirmación del embarcador.';

    const target = otherRole(role);
    const parties = await getMatchParties(repo, match);
    const pairLine = parties?.labeled || 'Embarcador y transportista';
    const whoConfirmedLabel = role === 'shipper' ? parties?.shipper_name || 'Embarcador' : parties?.carrier_name || 'Transportista';
    const whoMustAct = target === 'shipper' ? 'embarcador' : 'transportista';
    await comms.addNotification({
      match_id: match.id,
      for_role: target,
      type: 'mutual_cancel',
      title: parties?.short ? `Acuerdo mutuo — ${parties.short}` : `Acuerdo mutuo — falta el ${whoMustAct}`,
      body: `${pairLine}. ${whoConfirmedLabel} confirmó cancelar sin multa. Confirma tu parte en el emparejamiento activo.`,
    });

    res.json({ ok: true, data: updated, mutual_cancel: status, message });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al registrar acuerdo mutuo' });
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
      const reasonErr = validateReasonPayload({
        action,
        matchStatus: match.status,
        role,
        reason_code: req.body?.reason_code,
        reason_detail: req.body?.reason_detail,
        agreement_accepted: req.body?.agreement_accepted,
        mutualReady: isMutualCancelReady(match),
      });
      if (reasonErr) return res.status(400).json({ ok: false, error: reasonErr });

      if (action === 'withdraw') {
        const limitErr = await checkWithdrawLimit(repo, match.load_request_id);
        if (limitErr) return res.status(429).json({ ok: false, error: limitErr });
      }

      const reason = getReasonByCode(req.body.reason_code);
      const penalty = computePenalty(reason, match.agreed_price_clp);
      const updated = await applyCancelPatch(match, action, role, req.body);
      await releaseLoadAndOffer(match);
      return res.json({
        ok: true,
        data: updated,
        message: cancelMessage(action),
        penalty,
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
  return 'Emparejamiento cancelado. Carga y oferta liberadas. Revisa multa sugerida si aplica.';
}

module.exports = router;
