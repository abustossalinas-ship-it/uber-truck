'use strict';

const supabase = require('../services/supabase');
const { bankAccountFromUser } = require('./penalty-ledger');
const { hasVerifiedCard, listPaymentMethods } = require('./payment-methods');

function bankEnforced() {
  if (!supabase.isConfigured()) return false;
  if (process.env.BANK_ENFORCE === 'false') return false;
  if (process.env.BANK_ENFORCE === 'true') return true;
  return process.env.NODE_ENV === 'production';
}

async function fetchBankAccount(userId) {
  if (!userId || !supabase.isConfigured()) {
    return { complete: false, fields: {} };
  }
  const sb = supabase.getClient();
  const { data, error } = await sb
    .from('users')
    .select(
      'bank_holder_name, bank_rut, bank_name, bank_account_type, bank_account_number, bank_registered_at'
    )
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return bankAccountFromUser(data);
}

async function fetchPaymentSetup(userId) {
  const bank = await fetchBankAccount(userId);
  let methods = [];
  let cardVerified = false;
  try {
    methods = await listPaymentMethods(userId);
    cardVerified = methods.length > 0;
  } catch (e) {
    if (!e.message?.includes('user_payment_methods')) throw e;
  }
  const can_operate = bank.complete || cardVerified;
  return { bank, payment_methods: methods, card_verified: cardVerified, can_operate };
}

function bankBlockMessage() {
  return 'Debes inscribir cuenta bancaria o verificar una tarjeta antes de publicar, ofertar o emparejar (como en Copec/Uber).';
}

/** Bloquea operaciones si no hay banco ni tarjeta verificada (producción por defecto). */
async function requireBankAccount(req, res, next) {
  if (!bankEnforced()) return next();
  if (!req.user?.sub) return next();
  if (req.user.role === 'admin') return next();
  try {
    const setup = await fetchPaymentSetup(req.user.sub);
    req.bank_account = setup.bank;
    req.payment_methods = setup.payment_methods;
    req.payment_setup = setup;
    if (setup.can_operate) return next();
    return res.status(403).json({
      ok: false,
      error: bankBlockMessage(),
      bank_required: true,
      payment_method_required: true,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: 'No se pudo verificar medios de pago' });
  }
}

module.exports = {
  bankEnforced,
  fetchBankAccount,
  fetchPaymentSetup,
  bankBlockMessage,
  requireBankAccount,
};
