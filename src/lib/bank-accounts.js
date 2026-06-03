'use strict';

const supabase = require('../services/supabase');
const { validateRut } = require('./rut-chile');
const { isValidChileBank, normalizeBankName } = require('./chile-banks');
const { bankAccountFromUser } = require('./penalty-ledger');
const { hasVerifiedCard } = require('./payment-methods');

function toApiRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    holder_name: row.holder_name,
    holder_rut: row.holder_rut,
    bank_name: row.bank_name,
    account_type: row.account_type,
    account_number: row.account_number,
    account_last4: String(row.account_number || '').slice(-4),
    label: row.label || null,
    is_default: row.is_default,
    created_at: row.created_at,
  };
}

function rowToBankAccount(row) {
  if (!row) return { complete: false, fields: {} };
  return {
    id: row.id,
    complete: true,
    is_default: row.is_default,
    fields: {
      bank_holder_name: row.holder_name,
      bank_rut: row.holder_rut,
      bank_name: row.bank_name,
      bank_account_type: row.account_type,
      bank_account_number: row.account_number,
    },
    registered_at: row.created_at,
  };
}

function parseBankPayload(body) {
  const holder = body.bank_holder_name?.trim() || body.holder_name?.trim();
  const rut = body.bank_rut?.trim() || body.holder_rut?.trim();
  const bankName = body.bank_name?.trim();
  const accountType = body.bank_account_type?.trim() || body.account_type?.trim();
  const accountNumber = body.bank_account_number?.trim() || body.account_number?.trim();
  const label = body.label?.trim() || null;
  if (!holder || !rut || !bankName || !accountType || !accountNumber) {
    throw Object.assign(new Error('Completa titular, RUT, banco, tipo y número de cuenta'), {
      status: 400,
    });
  }
  if (!isValidChileBank(bankName)) {
    throw Object.assign(new Error('Elige un banco de la lista'), { status: 400 });
  }
  const rutCheck = validateRut(rut);
  if (!rutCheck.ok) {
    throw Object.assign(new Error(rutCheck.error), { status: 400 });
  }
  return {
    holder_name: holder,
    holder_rut: rutCheck.rut,
    bank_name: normalizeBankName(bankName),
    account_type: accountType,
    account_number: accountNumber,
    label,
  };
}

async function syncLegacyUserColumns(userId, row) {
  if (!userId || !row || !supabase.isConfigured()) return;
  const sb = supabase.getClient();
  await sb
    .from('users')
    .update({
      bank_holder_name: row.holder_name,
      bank_rut: row.holder_rut,
      bank_name: row.bank_name,
      bank_account_type: row.account_type,
      bank_account_number: row.account_number,
      bank_registered_at: row.created_at || new Date().toISOString(),
    })
    .eq('id', userId);
}

async function listBankAccounts(userId) {
  if (!userId || !supabase.isConfigured()) return [];
  const sb = supabase.getClient();
  const { data, error } = await sb
    .from('user_bank_accounts')
    .select(
      'id, holder_name, holder_rut, bank_name, account_type, account_number, label, is_default, created_at'
    )
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) {
    if (error.message?.includes('user_bank_accounts')) return [];
    throw error;
  }
  return (data || []).map(toApiRow);
}

async function fetchDefaultBankAccount(userId) {
  const rows = await listBankAccounts(userId);
  if (rows.length) {
    const def = rows.find((r) => r.is_default) || rows[0];
    return rowToBankAccount({
      ...def,
      holder_name: def.holder_name,
      holder_rut: def.holder_rut,
      bank_name: def.bank_name,
      account_type: def.account_type,
      account_number: def.account_number,
      created_at: def.created_at,
    });
  }
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

async function clearDefaultFlags(userId) {
  const sb = supabase.getClient();
  await sb.from('user_bank_accounts').update({ is_default: false }).eq('user_id', userId);
}

async function createBankAccount(userId, payload, { setDefault } = {}) {
  const parsed = parseBankPayload(payload);
  const sb = supabase.getClient();
  const existing = await listBankAccounts(userId);
  const makeDefault = existing.length === 0 || setDefault === true;
  if (makeDefault) await clearDefaultFlags(userId);
  const { data, error } = await sb
    .from('user_bank_accounts')
    .insert({
      user_id: userId,
      ...parsed,
      is_default: makeDefault,
    })
    .select(
      'id, holder_name, holder_rut, bank_name, account_type, account_number, label, is_default, created_at'
    )
    .single();
  if (error) throw error;
  if (data.is_default) await syncLegacyUserColumns(userId, data);
  return toApiRow(data);
}

async function updateBankAccount(userId, accountId, payload) {
  const parsed = parseBankPayload(payload);
  const sb = supabase.getClient();
  const { data, error } = await sb
    .from('user_bank_accounts')
    .update(parsed)
    .eq('id', accountId)
    .eq('user_id', userId)
    .select(
      'id, holder_name, holder_rut, bank_name, account_type, account_number, label, is_default, created_at'
    )
    .maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error('Cuenta bancaria no encontrada'), { status: 404 });
  if (data.is_default) await syncLegacyUserColumns(userId, data);
  return toApiRow(data);
}

async function setDefaultBankAccount(userId, accountId) {
  const sb = supabase.getClient();
  const { data: target, error: findErr } = await sb
    .from('user_bank_accounts')
    .select(
      'id, holder_name, holder_rut, bank_name, account_type, account_number, label, is_default, created_at'
    )
    .eq('id', accountId)
    .eq('user_id', userId)
    .maybeSingle();
  if (findErr) throw findErr;
  if (!target) throw Object.assign(new Error('Cuenta bancaria no encontrada'), { status: 404 });
  await clearDefaultFlags(userId);
  const { data, error } = await sb
    .from('user_bank_accounts')
    .update({ is_default: true })
    .eq('id', accountId)
    .eq('user_id', userId)
    .select(
      'id, holder_name, holder_rut, bank_name, account_type, account_number, label, is_default, created_at'
    )
    .single();
  if (error) throw error;
  await syncLegacyUserColumns(userId, data);
  return toApiRow(data);
}

async function deleteBankAccount(userId, accountId) {
  const rows = await listBankAccounts(userId);
  const target = rows.find((r) => r.id === accountId);
  if (!target) throw Object.assign(new Error('Cuenta bancaria no encontrada'), { status: 404 });
  if (rows.length <= 1) {
    const cardOk = await hasVerifiedCard(userId);
    if (!cardOk) {
      throw Object.assign(
        new Error('Debes tener otra cuenta bancaria o una tarjeta verificada antes de eliminar la única cuenta.'),
        { status: 400 }
      );
    }
  }
  const sb = supabase.getClient();
  const { error } = await sb
    .from('user_bank_accounts')
    .delete()
    .eq('id', accountId)
    .eq('user_id', userId);
  if (error) throw error;
  if (target.is_default) {
    const remaining = rows.filter((r) => r.id !== accountId);
    if (remaining.length) {
      await setDefaultBankAccount(userId, remaining[0].id);
    } else {
      await sb
        .from('users')
        .update({
          bank_holder_name: null,
          bank_rut: null,
          bank_name: null,
          bank_account_type: null,
          bank_account_number: null,
          bank_registered_at: null,
        })
        .eq('id', userId);
    }
  }
  return { ok: true };
}

async function upsertDefaultBankAccount(userId, payload) {
  const rows = await listBankAccounts(userId);
  const def = rows.find((r) => r.is_default) || rows[0];
  if (def) return updateBankAccount(userId, def.id, payload);
  return createBankAccount(userId, payload, { setDefault: true });
}

function bankAccountsSummary(accounts) {
  const def = accounts.find((a) => a.is_default) || accounts[0] || null;
  return {
    count: accounts.length,
    has_any: accounts.length > 0,
    default: def,
  };
}

module.exports = {
  listBankAccounts,
  fetchDefaultBankAccount,
  createBankAccount,
  updateBankAccount,
  setDefaultBankAccount,
  deleteBankAccount,
  upsertDefaultBankAccount,
  bankAccountsSummary,
  rowToBankAccount,
};
