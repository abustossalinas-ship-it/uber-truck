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
const {
  listReasonOptions,
  phaseLabel,
  reputationMessage,
} = require('../lib/match-cancel-reasons');
const {
  isPickupDeadlinePassed,
  formatDeadlineLabel,
} = require('../lib/match-deadline');
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
  filterMatchesForUserWithMaps,
  assertCanMatchLoad,
  assertCanMatchOffer,
} = require('../lib/access-scope');
const { copyBudgetFromLoad, outsideRangeMessages } = require('../lib/match-price');
const { enrichMatchesWithRatings } = require('../lib/match-ratings');
const { requireAuthIfDb } = require('../lib/require-auth');
const { requireApprovedOperator } = require('../lib/kyc-gate');
const { requireBankAccount } = require('../lib/bank-gate');
const { requirePenaltyClear } = require('../lib/penalty-gate');
const { openCaseForCancelledMatch } = require('../lib/support-cases');
const { logMatchTrip } = require('../lib/match-trip-log');
const { listTripEvents } = require('../lib/trip-events');
const { buildMatchTracking } = require('../lib/match-tracking');
const { enrichMatchesCounterparty, buildMatchContact } = require('../lib/match-contact');
const { enrichMatchesPaymentPilot } = require('../lib/payment-simulation');
const { walletEnabled } = require('../lib/wallet-config');
const {
  holdEscrowOnRoute,
  releaseEscrowOnComplete,
  refundEscrowOnCancel,
  enrichMatchesWalletPayment,
} = require('../lib/wallet-settlement');
const { processPilotPay } = require('../lib/pilot-payment');

function enrichMatchesPayment(matches, user) {
  if (walletEnabled()) return enrichMatchesWalletPayment(matches, user);
  return enrichMatchesPaymentPilot(matches, user);
}
const maps = require('../services/google-maps');
const { computeDestinationEtaFromRoute } = require('../lib/load-time-estimate');

const router = express.Router();
const operatorGate = [requireAuthIfDb, requireApprovedOperator, requireBankAccount, requirePenaltyClear];

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
  let deadlinePast = false;
  let pickup_deadline_label = null;
  const matchId = req.query.match_id;
  if (matchId) {
    const match = await repo.getById('matches', matchId);
    if (match) {
      mutual = mutualCancelStatus(match);
      const load = await repo.getById('load_requests', match.load_request_id);
      if (load) {
        deadlinePast = isPickupDeadlinePassed(load, match);
        pickup_deadline_label = formatDeadlineLabel(load, match);
      }
    }
  }
  const options = listReasonOptions(action, phase, role, agreed, {
    mutualReady: mutual.ready,
    deadlinePast,
  });
  res.json({
    ok: true,
    phase,
    phase_label: phaseLabel(phase),
    mutual_cancel: mutual,
    pickup_deadline_label,
    deadline_past: deadlinePast,
    data: options,
    limits: { note: 'Multas sugeridas; acuerdo entre partes. Sin cobro automático en MVP.' },
  });
});

router.get('/', optionalAuth, async (req, res) => {
  try {
    const [rows, loads, offers] = await Promise.all([
      repo.list('matches', {}),
      repo.list('load_requests', {}),
      repo.list('capacity_offers', {}),
    ]);
    const loadById = Object.fromEntries(loads.map((l) => [l.id, l]));
    const offerById = Object.fromEntries(offers.map((o) => [o.id, o]));
    const ctx = { loadById, offerById, allMatches: rows };
    let filtered = filterMatchesForUserWithMaps(rows, req.user, loadById, offerById);
    filtered = await enrichMatchesWithRatings(repo, filtered, req.user, ctx);
    filtered = await enrichMatchesCounterparty(repo, filtered, req.user, ctx);
    filtered = enrichMatchesPayment(filtered, req.user);
    res.json({ ok: true, data: filtered });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al listar matches' });
  }
});

router.get('/:id/contact', optionalAuth, requireAuthIfDb, async (req, res) => {
  try {
    const data = await buildMatchContact(repo, req.params.id, req.user);
    res.json({ ok: true, data });
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ ok: false, error: e.message || 'Contacto no disponible' });
  }
});

router.get('/:id/tracking', optionalAuth, requireAuthIfDb, async (req, res) => {
  try {
    const data = await buildMatchTracking(req.params.id, req.user);
    res.json({ ok: true, data });
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ ok: false, error: e.message || 'Error al leer tracking' });
  }
});

router.get('/:id/events', optionalAuth, requireAuthIfDb, async (req, res) => {
  try {
    const match = await repo.getById('matches', req.params.id);
    if (!match) return res.status(404).json({ ok: false, error: 'No encontrado' });
    const allowed = await filterMatchesForUser([match], req.user);
    if (!allowed.length) {
      return res.status(403).json({ ok: false, error: 'No participas en este viaje' });
    }
    const events = await listTripEvents(match.id);
    res.json({ ok: true, data: events });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al leer historial del viaje' });
  }
});

router.post('/', optionalAuth, ...operatorGate, async (req, res) => {
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

    const errors = parseBody([
      () => optionalNumber(body.carrier_offer_clp, 'carrier_offer_clp'),
      () => optionalNumber(body.agreed_price_clp, 'agreed_price_clp'),
    ]);
    if (errors.length) return res.status(400).json({ ok: false, errors });

    const budget = copyBudgetFromLoad(load);
    const role = resolveActorRole(req);
    let carrierOffer =
      body.carrier_offer_clp != null ? Number(body.carrier_offer_clp) : null;
    if (body.agreed_price_clp != null && carrierOffer == null) {
      carrierOffer = Number(body.agreed_price_clp);
    }
    let priceStatus = 'pending_offer';
    if (carrierOffer != null) priceStatus = 'pending_acceptance';

    const existing = await repo.findMatchPair(load.id, offer.id);
    if (existing) {
      if (existing.status === 'cancelled') {
        const revived = await repo.update('matches', existing.id, {
          status: 'proposed',
          ...budget,
          carrier_offer_clp: carrierOffer,
          price_status: priceStatus,
          agreed_price_clp: null,
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
        await logMatchTrip(req, revived, {
          event_type: 'match_revived',
          from_status: existing.status,
          to_status: 'proposed',
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
      ...budget,
      carrier_offer_clp: carrierOffer,
      price_status: priceStatus,
      agreed_price_clp: null,
      status: 'proposed',
      notes: body.notes?.trim() || null,
    });

    await logMatchTrip(req, row, {
      event_type: 'match_created',
      to_status: 'proposed',
      payload: { carrier_offer_clp: carrierOffer },
    });

    if (carrierOffer != null && role === 'carrier') {
      try {
        const parties = await getMatchParties(repo, row);
        await comms.notifyPriceOffer({
          match_id: row.id,
          for_role: 'shipper',
          carrier_name: parties?.carrier_name,
          amount_clp: carrierOffer,
          is_update: false,
        });
      } catch (notifyErr) {
        console.error('match notification failed', notifyErr);
      }
    }

    const rangeMsg = outsideRangeMessages(
      carrierOffer,
      budget.budget_min_clp,
      budget.budget_max_clp
    );
    res.status(201).json({
      ok: true,
      data: row,
      within_budget: rangeMsg.within,
      range_message: rangeMsg.carrier,
    });
  } catch (e) {
    console.error(e);
    const msg = e.message || '';
    const dup = e.code === '23505' || /duplicate/i.test(msg);
    if (dup) {
      return res.status(409).json({
        ok: false,
        error:
          'Ya existe un emparejamiento para esta carga y esta oferta. Revisa la sección Emparejamientos más abajo.',
      });
    }
    if (/trip_events|price_status|carrier_offer_clp|42P01|PGRST204/i.test(msg)) {
      return res.status(503).json({
        ok: false,
        error:
          'Falta aplicar migraciones SQL en Supabase (010 precios, 015 trip_events). Revisa docs/SQL-SUPABASE.md.',
        detail: msg,
      });
    }
    res.status(500).json({
      ok: false,
      error: msg || 'Error al crear match',
    });
  }
});

router.post('/:id/mutual-cancel', optionalAuth, ...operatorGate, async (req, res) => {
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

router.patch('/:id/carrier-offer', optionalAuth, ...operatorGate, async (req, res) => {
  try {
    const match = await repo.getById('matches', req.params.id);
    if (!match) return res.status(404).json({ ok: false, error: 'No encontrado' });
    if (match.status !== 'proposed') {
      return res.status(400).json({ ok: false, error: 'Solo en propuesta puedes ofertar precio' });
    }
    const role = resolveActorRole(req);
    if (role !== 'carrier' && req.user?.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Solo el transportista puede ofertar precio' });
    }
    const amount = Number(req.body?.carrier_offer_clp);
    if (!amount || amount < 1) {
      return res.status(400).json({ ok: false, error: 'Indica un monto válido en CLP' });
    }
    const previousOffer = match.carrier_offer_clp;
    const updated = await repo.update('matches', match.id, {
      carrier_offer_clp: amount,
      price_status: 'pending_acceptance',
    });
      await logMatchTrip(req, updated, {
        event_type: 'carrier_offer_updated',
        from_status: match.status,
        to_status: match.status,
        payload: {
          carrier_offer_clp: amount,
          previous_offer_clp: previousOffer,
          previous_offered_at:
            previousOffer != null ? match.updated_at || match.created_at : null,
        },
      });
    if (req.user?.sub) {
      const offer = await repo.getById('capacity_offers', match.capacity_offer_id);
      if (offer && !offer.carrier_user_id) {
        await repo.update('capacity_offers', offer.id, { carrier_user_id: req.user.sub });
      }
    }
    const parties = await getMatchParties(repo, match);
    await comms.notifyPriceOffer({
      match_id: match.id,
      for_role: 'shipper',
      carrier_name: parties?.carrier_name,
      amount_clp: amount,
      previous_amount_clp: previousOffer,
      is_update: previousOffer != null,
    });
    const rangeMsg = outsideRangeMessages(
      amount,
      match.budget_min_clp,
      match.budget_max_clp
    );
    res.json({
      ok: true,
      data: updated,
      within_budget: rangeMsg.within,
      range_message: rangeMsg.carrier,
      message: rangeMsg.carrier
        ? 'Oferta enviada (fuera del rango publicado).'
        : 'Oferta enviada al embarcador',
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al guardar oferta' });
  }
});

router.patch('/:id/accept-offer', optionalAuth, ...operatorGate, async (req, res) => {
  try {
    const match = await repo.getById('matches', req.params.id);
    if (!match) return res.status(404).json({ ok: false, error: 'No encontrado' });
    if (match.status !== 'proposed') {
      return res.status(400).json({ ok: false, error: 'El match ya no está en propuesta' });
    }
    const role = resolveActorRole(req);
    if (role !== 'shipper' && req.user?.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Solo el embarcador puede aceptar el precio' });
    }
    if (!match.carrier_offer_clp) {
      return res.status(400).json({
        ok: false,
        error: 'Aún no hay oferta del transportista. Espera su monto o elige otra oferta.',
      });
    }
    const updated = await repo.update('matches', match.id, {
      status: 'accepted',
      agreed_price_clp: Number(match.carrier_offer_clp),
      price_status: 'agreed',
    });
    await logMatchTrip(req, updated, {
      event_type: 'price_accepted',
      from_status: match.status,
      to_status: 'accepted',
      payload: { agreed_price_clp: updated.agreed_price_clp },
    });
    await repo.update('load_requests', match.load_request_id, { status: 'matched' });
    await repo.update('capacity_offers', match.capacity_offer_id, { status: 'reserved' });
    const parties = await getMatchParties(repo, match);
    await comms.markReadForMatchTypes('shipper', match.id, ['price_offer']);
    const allMatches = await repo.list('matches', {});
    const staleProposals = allMatches.filter(
      (m) =>
        m.load_request_id === match.load_request_id &&
        m.id !== match.id &&
        m.status === 'proposed'
    );
    for (const other of staleProposals) {
      await comms.markReadForMatchTypes('shipper', other.id, ['price_offer']);
    }
    await comms.addNotification({
      match_id: match.id,
      for_role: 'carrier',
      type: 'price_accepted',
      title: 'Precio aceptado',
      body: `${parties?.shipper_name || 'Embarcador'} aceptó $${Number(match.carrier_offer_clp).toLocaleString('es-CL')} CLP.`,
    });
    res.json({
      ok: true,
      data: updated,
      message: 'Precio aceptado. Emparejamiento confirmado.',
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al aceptar oferta' });
  }
});

router.patch('/:id/status', optionalAuth, ...operatorGate, async (req, res) => {
  try {
    const match = await repo.getById('matches', req.params.id);
    if (!match) return res.status(404).json({ ok: false, error: 'No encontrado' });

    const role = resolveActorRole(req);

    if (req.body?.action === 'mark_delivered') {
      if (role !== 'carrier' && req.user?.role !== 'admin') {
        return res.status(403).json({
          ok: false,
          error: 'Solo el transportista marca la entrega en destino',
        });
      }
      if (match.status !== 'in_progress') {
        return res.status(400).json({
          ok: false,
          error: 'Solo puedes marcar entrega cuando el viaje está en ruta',
        });
      }
      if (match.carrier_marked_delivered_at) {
        return res.status(409).json({
          ok: false,
          error: 'Ya marcaste entrega. Espera la confirmación del embarcador.',
        });
      }
      const note = req.body?.delivery_note?.trim()?.slice(0, 500) || null;
      const updated = await repo.update('matches', match.id, {
        carrier_marked_delivered_at: new Date().toISOString(),
        ...(note ? { delivery_note: note } : {}),
      });
      await logMatchTrip(req, updated, {
        event_type: 'carrier_marked_delivered',
        from_status: match.status,
        to_status: match.status,
        payload: { delivery_note: note },
      });
      const parties = await getMatchParties(repo, match);
      await comms.addNotification({
        match_id: match.id,
        for_role: 'shipper',
        type: 'delivery_pending_confirm',
        title: 'Confirma recepción de carga',
        body: `${parties?.carrier_name || 'Transportista'} marcó entrega. Revisa y confirma en el emparejamiento.`,
      });
      return res.json({
        ok: true,
        data: updated,
        message:
          'Entrega registrada. El embarcador debe confirmar recepción para cerrar el viaje.',
      });
    }

    const next = req.body?.status;
    if (next === 'accepted' && match.status === 'proposed') {
      return res.status(400).json({
        ok: false,
        error:
          'Usa «Aceptar precio» cuando el transportista haya enviado su oferta en CLP.',
      });
    }

    const allowed = MATCH_TRANSITIONS[match.status] || [];
    if (!next || !allowed.includes(next)) {
      return res.status(400).json({
        ok: false,
        error: `Transición no permitida desde ${match.status}`,
        allowed,
      });
    }

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
      const load = await repo.getById('load_requests', match.load_request_id);
      const deadlinePast = load ? isPickupDeadlinePassed(load, match) : false;
      const reasonErr = validateReasonPayload({
        action,
        matchStatus: match.status,
        role,
        reason_code: req.body?.reason_code,
        reason_detail: req.body?.reason_detail,
        agreement_accepted: req.body?.agreement_accepted,
        mutualReady: isMutualCancelReady(match),
        deadlinePast,
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
      let finalMatch = updated;
      if (walletEnabled()) {
        try {
          finalMatch = await refundEscrowOnCancel(repo, updated);
        } catch (walletErr) {
          console.error('wallet refund cancel', walletErr);
        }
      }
      await comms.markAllReadForMatch('shipper', match.id);
      await comms.markAllReadForMatch('carrier', match.id);
      await logMatchTrip(req, updated, {
        event_type: 'match_cancelled',
        from_status: match.status,
        to_status: 'cancelled',
        payload: { action, reason_code: req.body?.reason_code || null },
      });
      const repNote = reputationMessage(reason);
      let support_case = null;
      if (action === 'cancel' && penalty?.type === 'fee_suggested' && penalty?.amount_clp) {
        support_case = await openCaseForCancelledMatch(finalMatch, role, penalty);
      }
      return res.json({
        ok: true,
        data: finalMatch,
        message: cancelMessage(action),
        penalty,
        reputation_note: repNote,
        support_case,
        support_hint:
          support_case?.id
            ? 'Se abrió un caso de ayuda. Usa «Ayuda / revisión» en Cuenta y multas para aportar antecedentes.'
            : null,
      });
    }

    if (next === 'completed') {
      if (match.status !== 'in_progress') {
        return res.status(400).json({
          ok: false,
          error: 'Solo se cierra un viaje que está en ejecución (en ruta)',
        });
      }
      if (role === 'carrier') {
        return res.status(403).json({
          ok: false,
          error:
            'El transportista marca «Entregado en destino»; el embarcador confirma la recepción para cerrar.',
        });
      }
      if (!match.carrier_marked_delivered_at) {
        return res.status(400).json({
          ok: false,
          error: 'El transportista debe marcar entrega antes de confirmar recepción',
        });
      }
      const patch = {
        status: 'completed',
        completed_at: new Date().toISOString(),
        shipper_confirmed_receipt_at: new Date().toISOString(),
      };
      if (req.body?.delivery_note?.trim()) {
        patch.delivery_note = req.body.delivery_note.trim().slice(0, 500);
      }
      const completed = await repo.update('matches', match.id, patch);
      let settled = completed;
      if (walletEnabled()) {
        try {
          settled = await releaseEscrowOnComplete(repo, completed);
          const { breakdownForMatch } = require('../lib/payment-simulation');
          const carrierBd = breakdownForMatch(settled, 'carrier');
          await comms.addNotification({
            match_id: match.id,
            for_role: 'carrier',
            type: 'wallet_payment',
            title: 'Pago acreditado en Cubik Saldo',
            body: `Neto $${Number(carrierBd?.net_clp || 0).toLocaleString('es-CL')} CLP en tu saldo Cubik.`,
            amount_clp: carrierBd?.net_clp || null,
          });
        } catch (walletErr) {
          console.error('wallet release complete', walletErr);
        }
      }
      await logMatchTrip(req, settled, {
        event_type: 'trip_completed',
        from_status: match.status,
        to_status: 'completed',
        payload: { delivery_note: patch.delivery_note || null },
      });
      await repo.update('load_requests', match.load_request_id, { status: 'delivered' });
      await repo.update('capacity_offers', match.capacity_offer_id, { status: 'reserved' });
      const parties = await getMatchParties(repo, match);
      await comms.addNotification({
        match_id: match.id,
        for_role: 'carrier',
        type: 'trip_completed',
        title: 'Viaje completado',
        body: `${parties?.shipper_name || 'Embarcador'} confirmó recepción. Califica el viaje en Mis viajes.`,
      });
      await comms.markReadForMatchTypes('shipper', match.id, [
        'delivery_pending_confirm',
        'chat',
        'approaching_destination',
        'arrived_at_destination',
        'price_offer',
        'support',
      ]);
      await comms.markReadForMatchTypes('carrier', match.id, [
        'delivery_pending_confirm',
        'chat',
        'approaching_destination',
        'arrived_at_destination',
        'price_accepted',
        'support',
      ]);
      return res.json({
        ok: true,
        data: settled,
        message: walletEnabled()
          ? 'Viaje cerrado. Pago liberado al transportista en Cubik Saldo.'
          : 'Viaje cerrado. Puedes calificar a la otra parte en Mis viajes.',
        prompt_rating: true,
      });
    }

    if (next === 'in_progress') {
      if (role !== 'carrier' && req.user?.role !== 'admin') {
        return res.status(403).json({
          ok: false,
          error: 'Solo el transportista marca que el camión salió / está en ruta',
        });
      }
      if (walletEnabled()) {
        try {
          await holdEscrowOnRoute(repo, match);
        } catch (e) {
          return res.status(e.status || 402).json({
            ok: false,
            error: e.message || 'No se pudo retener pago en Cubik Saldo',
            wallet_insufficient: e.code === 'wallet_insufficient_balance',
          });
        }
      }
      const updated = await repo.update('matches', match.id, { status: next });
      await logMatchTrip(req, updated, {
        event_type: 'status_change',
        from_status: match.status,
        to_status: next,
      });
      const load = await repo.getById('load_requests', match.load_request_id);
      let loadPatch = { status: 'in_transit' };
      if (load?.origin_lat != null && load?.destination_lat != null && maps.isConfigured()) {
        try {
          const route = await maps.distanceKm(
            { lat: load.origin_lat, lng: load.origin_lng },
            { lat: load.destination_lat, lng: load.destination_lng },
            { traffic: true }
          );
          const etaFields = computeDestinationEtaFromRoute(route, load);
          if (etaFields) loadPatch = { ...loadPatch, ...etaFields };
        } catch (err) {
          console.error('ETA destino al iniciar viaje', err);
        }
      }
      await repo.update('load_requests', match.load_request_id, loadPatch);
      const parties = await getMatchParties(repo, match);
      if (walletEnabled()) {
        try {
          await comms.addNotification({
            match_id: match.id,
            for_role: 'shipper',
            type: 'wallet_escrow',
            title: 'Pago retenido en Cubik Saldo',
            body: `${parties?.carrier_name || 'Transportista'} marcó en ruta. Retuvimos flete + servicio 10%.`,
          });
        } catch (notifyErr) {
          console.error('wallet escrow notify', notifyErr);
        }
      }
      return res.json({
        ok: true,
        data: enrichMatchesPayment([updated], req.user)[0] || updated,
        message: walletEnabled()
          ? 'Camión en ruta. Pago retenido en Cubik Saldo del embarcador.'
          : 'Camión en ruta.',
      });
    }

    const updated = await repo.update('matches', match.id, { status: next });
    await logMatchTrip(req, updated, {
      event_type: 'status_change',
      from_status: match.status,
      to_status: next,
    });

    if (next === 'accepted') {
      await repo.update('load_requests', match.load_request_id, { status: 'matched' });
      await repo.update('capacity_offers', match.capacity_offer_id, { status: 'reserved' });
    }

    res.json({ ok: true, data: updated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al actualizar match' });
  }
});

router.post('/:id/pilot-pay', requireAuthIfDb, async (req, res) => {
  try {
    if (walletEnabled()) {
      return res.status(400).json({
        ok: false,
        error: 'Con Cubik Saldo prod el pago se retiene al marcar «En ruta», no al completar.',
      });
    }
    const { breakdownForMatch: bdFn, enrichMatchPaymentPilot } = require('../lib/payment-simulation');
    const raw = await processPilotPay(repo, req.params.id, req.user);
    const updated = enrichMatchPaymentPilot(raw, req.user);
    const shipperBd = bdFn(updated, 'shipper');
    const carrierBd = bdFn(updated, 'carrier');
    const parties = await getMatchParties(repo, updated);
    try {
      await comms.addNotification({
        match_id: updated.id,
        for_role: 'carrier',
        type: 'pilot_payment',
        title: 'Embarcador pagó el flete',
        body: `${parties?.shipper_name || 'Embarcador'} confirmó el pago (Cubik Saldo piloto). Neto $${Number(carrierBd?.net_clp || 0).toLocaleString('es-CL')} en gestión.`,
        amount_clp: shipperBd?.total_clp || null,
      });
    } catch (notifyErr) {
      console.error('pilot-pay notification', notifyErr);
    }
    res.json({
      ok: true,
      data: updated,
      message: 'Pago simulado registrado. El transportista verá el monto en gestión.',
    });
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ ok: false, error: e.message || 'Error al procesar pago piloto' });
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

router.use(require('./match-ratings'));
router.use(require('./match-incidents'));

module.exports = router;
