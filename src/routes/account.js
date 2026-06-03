'use strict';

const express = require('express');
const supabase = require('../services/supabase');
const repo = require('../lib/repository');
const { authMiddleware } = require('../lib/auth');
const { buildPenaltySummary, bankAccountFromUser } = require('../lib/penalty-ledger');
const { getOperatingStatus } = require('../lib/penalty-gate');
const { bankEnforced, fetchPaymentSetup } = require('../lib/bank-gate');
const { paymentConfig } = require('../lib/payment-config');
const { validateRut } = require('../lib/rut-chile');
const { isValidChileBank, normalizeBankName } = require('../lib/chile-banks');
const {
  listPaymentMethods,
  enrollPaymentMethod,
  deletePaymentMethod,
  paymentMethodsSummary,
} = require('../lib/payment-methods');
const {
  markPenaltyPaid,
  claimPenaltyPaid,
  confirmPenaltyPayment,
  disputePenaltyPayment,
  getPenaltyPaymentProof,
} = require('../lib/penalty-payment');

const router = express.Router();

router.get('/payment-config', async (_req, res) => {
  res.json({ ok: true, ...paymentConfig() });
});

router.get('/chile-banks', (_req, res) => {
  const { CHILE_BANKS } = require('../lib/chile-banks');
  res.json({ ok: true, data: CHILE_BANKS });
});

router.get('/summary', authMiddleware, async (req, res) => {
  try {
    let penalties;
    let penalties_error = null;
    try {
      penalties = await buildPenaltySummary(repo, req.user);
    } catch (e) {
      console.error('buildPenaltySummary', e);
      penalties_error = e.message || 'Error al calcular multas';
      const role = req.user.role === 'carrier' ? 'carrier' : 'shipper';
      penalties = {
        role,
        owed: [],
        owed_to_me: [],
        paid_history: [],
        pending_confirmations: [],
        total_owed_clp: 0,
        total_receivable_clp: 0,
        overdue_count: 0,
        awaiting_confirm_count: 0,
        blocked_awaiting_confirm: false,
        blocked_disputed: false,
        blocked_overdue: false,
        penalty_due_days: Number(process.env.PENALTY_DUE_DAYS) || 7,
        penalty_confirm_hours: Number(process.env.PENALTY_CONFIRM_HOURS) || 24,
      };
    }
    const operating = await getOperatingStatus(req.user);

    const setup = req.user?.sub ? await fetchPaymentSetup(req.user.sub) : {
      bank: { complete: false, fields: {} },
      payment_methods: [],
      card_verified: false,
      can_operate: false,
    };
    const bank = setup.bank;
    const paymentSummary = paymentMethodsSummary(setup.payment_methods);
    const enforced = bankEnforced() && req.user?.role !== 'admin';
    const payment_required_for_operate = enforced && !setup.can_operate;
    const needsBank = payment_required_for_operate || (penalties.total_owed_clp > 0 && !setup.can_operate);

    res.json({
      ok: true,
      penalties,
      penalties_error,
      operating_status: operating,
      bank_account: bank,
      payment_methods: setup.payment_methods,
      payment_summary: paymentSummary,
      bank_enforced: enforced,
      can_generate_charge: setup.can_operate,
      bank_required_for_operate: payment_required_for_operate,
      payment_required_for_operate,
      bank_required_for_charges: needsBank,
      note:
        'Declara el pago; el acreedor tiene 24 h para confirmar. Sin confirmación se escala a moderador. Admin puede cerrar el caso.',
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al leer resumen de cuenta' });
  }
});

router.patch('/bank', authMiddleware, async (req, res) => {
  if (!supabase.isConfigured()) {
    return res.status(503).json({
      ok: false,
      error: 'Cuenta bancaria requiere Supabase configurado',
    });
  }
  const body = req.body || {};
  const holder = body.bank_holder_name?.trim();
  const rut = body.bank_rut?.trim();
  const bankName = body.bank_name?.trim();
  const accountType = body.bank_account_type?.trim();
  const accountNumber = body.bank_account_number?.trim();
  if (!holder || !rut || !bankName || !accountType || !accountNumber) {
    return res.status(400).json({
      ok: false,
      error: 'Completa titular, RUT, banco, tipo y número de cuenta',
    });
  }
  if (!isValidChileBank(bankName)) {
    return res.status(400).json({ ok: false, error: 'Elige un banco de la lista' });
  }
  const rutCheck = validateRut(rut);
  if (!rutCheck.ok) {
    return res.status(400).json({ ok: false, error: rutCheck.error });
  }
  try {
    const sb = supabase.getClient();
    const { data, error } = await sb
      .from('users')
      .update({
        bank_holder_name: holder,
        bank_rut: rutCheck.rut,
        bank_name: normalizeBankName(bankName),
        bank_account_type: accountType,
        bank_account_number: accountNumber,
        bank_registered_at: new Date().toISOString(),
      })
      .eq('id', req.user.sub)
      .select(
        'bank_holder_name, bank_rut, bank_name, bank_account_type, bank_account_number, bank_registered_at'
      )
      .single();
    if (error) throw error;
    res.json({
      ok: true,
      bank_account: bankAccountFromUser(data),
      can_generate_charge: true,
      message: 'Cuenta bancaria guardada. Podrás generar cargos cuando esté habilitado el cobro.',
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al guardar cuenta bancaria' });
  }
});

router.get('/payment-methods', authMiddleware, async (req, res) => {
  try {
    const methods = await listPaymentMethods(req.user.sub);
    res.json({
      ok: true,
      payment_methods: methods,
      payment_summary: paymentMethodsSummary(methods),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al listar medios de pago' });
  }
});

router.post('/payment-methods/enroll', authMiddleware, async (req, res) => {
  try {
    const { method, message } = await enrollPaymentMethod(
      req.user.sub,
      req.user.email,
      req.body || {}
    );
    const operating = await getOperatingStatus(req.user);
    res.json({
      ok: true,
      payment_method: method,
      message,
      operating_status: operating,
    });
  } catch (e) {
    const code = e.status || 500;
    if (code !== 500) return res.status(code).json({ ok: false, error: e.message });
    console.error(e);
    res.status(500).json({ ok: false, error: 'No se pudo verificar la tarjeta' });
  }
});

router.delete('/payment-methods/:id', authMiddleware, async (req, res) => {
  try {
    await deletePaymentMethod(req.user.sub, req.params.id);
    const operating = await getOperatingStatus(req.user);
    res.json({
      ok: true,
      message: 'Tarjeta eliminada.',
      operating_status: operating,
    });
  } catch (e) {
    const code = e.status || 500;
    if (code !== 500) return res.status(code).json({ ok: false, error: e.message });
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al eliminar tarjeta' });
  }
});

async function runPenaltyRoute(req, res, fn) {
  try {
    const payload = await fn();
    const operating = await getOperatingStatus(req.user);
    res.json({ ...payload, operating_status: operating });
  } catch (e) {
    const code = e.status || 500;
    if (code !== 500) return res.status(code).json({ ok: false, error: e.message });
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error en multa' });
  }
}

router.post('/penalties/:matchId/claim-paid', authMiddleware, async (req, res) => {
  await runPenaltyRoute(req, res, async () => {
    const { match, proof_url } = await claimPenaltyPaid(req.params.matchId, req.user, {
      note: req.body?.note,
      proof_base64: req.body?.proof_base64,
      proof_mime: req.body?.proof_mime,
    });
    const h = process.env.PENALTY_CONFIRM_HOURS || 24;
    return {
      ok: true,
      data: match,
      proof_url,
      message: `Pago declarado con comprobante. El acreedor tiene ${h} h para confirmar.`,
    };
  });
});

router.get('/penalties/:matchId/payment-proof', authMiddleware, async (req, res) => {
  try {
    const proof = await getPenaltyPaymentProof(req.params.matchId, req.user);
    const buf = Buffer.from(proof.base64, 'base64');
    res.setHeader('Content-Type', proof.mime);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buf);
  } catch (e) {
    const code = e.status || 500;
    if (code !== 500) return res.status(code).json({ ok: false, error: e.message });
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al leer comprobante' });
  }
});

router.post('/penalties/:matchId/confirm-payment', authMiddleware, async (req, res) => {
  await runPenaltyRoute(req, res, async () => {
    const { match } = await confirmPenaltyPayment(req.params.matchId, req.user);
    return {
      ok: true,
      data: match,
      message: 'Pago confirmado. El deudor puede volver a operar si no tiene otras multas bloqueantes.',
    };
  });
});

router.post('/penalties/:matchId/dispute-payment', authMiddleware, async (req, res) => {
  await runPenaltyRoute(req, res, async () => {
    const { match } = await disputePenaltyPayment(
      req.params.matchId,
      req.user,
      req.body?.note
    );
    return {
      ok: true,
      data: match,
      message:
        'Pago no confirmado. El deudor sigue bloqueado; puede abrir ayuda o volver a declarar el pago.',
    };
  });
});

router.post('/penalties/:matchId/mark-paid', authMiddleware, async (req, res) => {
  await runPenaltyRoute(req, res, async () => {
    const { match, already_paid } = await markPenaltyPaid(
      req.params.matchId,
      req.user,
      req.body?.note
    );
    return {
      ok: true,
      data: match,
      already_paid,
      message: already_paid
        ? 'La multa ya estaba regularizada.'
        : 'Cerrado por moderador. Operaciones desbloqueadas si no hay otras deudas.',
    };
  });
});

module.exports = router;
