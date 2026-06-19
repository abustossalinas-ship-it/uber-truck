'use strict';

const supabase = require('../services/supabase');
const { fetchDefaultBankAccount, listBankAccounts } = require('./bank-accounts');
const { hasVerifiedCard, listPaymentMethods } = require('./payment-methods');
const { walletSandboxPilot } = require('./wallet-config');

function bankEnforced() {
  if (walletSandboxPilot()) return false;
  if (!supabase.isConfigured()) return false;
  if (process.env.BANK_ENFORCE === 'false') return false;
  if (process.env.BANK_ENFORCE === 'true') return true;
  return process.env.NODE_ENV === 'production';
}

async function fetchBankAccount(userId) {
  return fetchDefaultBankAccount(userId);
}

async function fetchPaymentSetup(userId) {
  const bank = await fetchBankAccount(userId);
  let bankAccounts = [];
  let methods = [];
  let cardVerified = false;
  try {
    bankAccounts = await listBankAccounts(userId);
  } catch (e) {
    if (!e.message?.includes('user_bank_accounts')) throw e;
  }
  try {
    methods = await listPaymentMethods(userId);
    cardVerified = methods.length > 0;
  } catch (e) {
    if (!e.message?.includes('user_payment_methods')) throw e;
  }
  const wallet_pilot = walletSandboxPilot();
  const can_operate = bank.complete || cardVerified || wallet_pilot;
  return {
    bank,
    bank_accounts: bankAccounts,
    payment_methods: methods,
    card_verified: cardVerified,
    wallet_pilot,
    bank_deferred: wallet_pilot,
    can_operate,
  };
}

function bankBlockMessage() {
  if (walletSandboxPilot()) {
    return 'Recarga Cubik Saldo en Cuenta para publicar o completar viajes (etapa piloto sin banco real).';
  }
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
    req.bank_accounts = setup.bank_accounts;
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
