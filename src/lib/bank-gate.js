'use strict';

const supabase = require('../services/supabase');
const { bankAccountFromUser } = require('./penalty-ledger');

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

function bankBlockMessage() {
  return 'Debes inscribir tu cuenta bancaria antes de publicar, ofertar o emparejar (como en Uber).';
}

/** Bloquea operaciones si no hay cuenta bancaria inscrita (producción por defecto). */
async function requireBankAccount(req, res, next) {
  if (!bankEnforced()) return next();
  if (!req.user?.sub) return next();
  if (req.user.role === 'admin') return next();
  try {
    const bank = await fetchBankAccount(req.user.sub);
    req.bank_account = bank;
    if (bank.complete) return next();
    return res.status(403).json({
      ok: false,
      error: bankBlockMessage(),
      bank_required: true,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: 'No se pudo verificar cuenta bancaria' });
  }
}

module.exports = {
  bankEnforced,
  fetchBankAccount,
  bankBlockMessage,
  requireBankAccount,
};
