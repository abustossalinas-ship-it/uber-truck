'use strict';

const express = require('express');
const supabase = require('../services/supabase');
const repo = require('../lib/repository');
const { authMiddleware } = require('../lib/auth');
const { buildPenaltySummary, bankAccountFromUser } = require('../lib/penalty-ledger');

const router = express.Router();

router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const role = req.user.role === 'carrier' ? 'carrier' : 'shipper';
    const penalties = await buildPenaltySummary(repo, role);

    let bank = { complete: false, fields: {} };
    if (supabase.isConfigured()) {
      const sb = supabase.getClient();
      const { data, error } = await sb
        .from('users')
        .select(
          'bank_holder_name, bank_rut, bank_name, bank_account_type, bank_account_number, bank_registered_at'
        )
        .eq('id', req.user.sub)
        .maybeSingle();
      if (error) throw error;
      bank = bankAccountFromUser(data);
    }

    const needsBank =
      penalties.total_owed_clp > 0 && !bank.complete;

    res.json({
      ok: true,
      penalties,
      bank_account: bank,
      can_generate_charge: bank.complete,
      bank_required_for_charges: needsBank,
      note: 'Multas sugeridas; cobro automático en fase posterior.',
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
  try {
    const sb = supabase.getClient();
    const { data, error } = await sb
      .from('users')
      .update({
        bank_holder_name: holder,
        bank_rut: rut,
        bank_name: bankName,
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

module.exports = router;
