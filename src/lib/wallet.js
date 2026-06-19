'use strict';

const supabase = require('../services/supabase');
const repo = require('./repository');
const {
  walletEnabled,
  roundClp,
  SANDBOX_TOPUP_MAX_CLP,
} = require('./wallet-config');
const { paymentProviderMode } = require('./payment-config');

function mapLedgerRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    amount_clp: Number(row.amount_clp),
    balance_after_clp: Number(row.balance_after_clp),
    entry_type: row.entry_type,
    match_id: row.match_id || null,
    note: row.note || null,
    meta: row.meta || {},
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
  };
}

function mapAccountRow(row) {
  if (!row) return { user_id: null, balance_clp: 0 };
  return {
    user_id: row.user_id,
    balance_clp: Number(row.balance_clp) || 0,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

async function getAccount(userId) {
  if (!userId) return { user_id: null, balance_clp: 0 };
  if (supabase.isConfigured()) {
    const sb = supabase.getClient();
    const { data, error } = await sb
      .from('wallet_accounts')
      .select('user_id, balance_clp, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      if (/wallet_accounts|PGRST204|schema cache/i.test(error.message || '')) {
        return { user_id: userId, balance_clp: 0, tables_missing: true };
      }
      throw error;
    }
    if (!data) return { user_id: userId, balance_clp: 0 };
    return mapAccountRow(data);
  }
  const rows = await repo.list('wallet_accounts', {});
  const row = rows.find((r) => r.user_id === userId);
  return mapAccountRow(row || { user_id: userId, balance_clp: 0 });
}

async function applyEntry(userId, { amount_clp, entry_type, match_id, note, meta }) {
  const amount = roundClp(amount_clp);
  if (!amount) {
    const e = new Error('Monto inválido');
    e.code = 'wallet_amount_zero';
    throw e;
  }
  if (!userId) {
    const e = new Error('Usuario requerido');
    e.status = 400;
    throw e;
  }

  if (supabase.isConfigured()) {
    const sb = supabase.getClient();
    const { data, error } = await sb.rpc('wallet_apply_entry', {
      p_user_id: userId,
      p_amount: amount,
      p_entry_type: entry_type,
      p_match_id: match_id || null,
      p_note: note || null,
      p_meta: meta || {},
    });
    if (error) {
      if (/wallet_insufficient_balance/i.test(error.message || '')) {
        const e = new Error('Saldo Cubik insuficiente');
        e.code = 'wallet_insufficient_balance';
        e.status = 402;
        throw e;
      }
      if (/wallet_apply_entry|wallet_accounts|PGRST202|42883/i.test(error.message || '')) {
        const e = new Error('Wallet no disponible — ejecuta migración 035 en Supabase');
        e.code = 'wallet_not_migrated';
        e.status = 503;
        throw e;
      }
      throw error;
    }
    const account = await getAccount(userId);
    return { ledger: mapLedgerRow(data), account };
  }

  const repo = require('./repository');
  const accounts = await repo.list('wallet_accounts', {});
  let account = accounts.find((r) => r.user_id === userId);
  if (!account) {
    account = await repo.insert('wallet_accounts', {
      user_id: userId,
      balance_clp: 0,
    });
  }
  const newBalance = roundClp(account.balance_clp + amount);
  if (newBalance < 0) {
    const e = new Error('Saldo Cubik insuficiente');
    e.code = 'wallet_insufficient_balance';
    e.status = 402;
    throw e;
  }
  account = await repo.update('wallet_accounts', account.id, { balance_clp: newBalance });

  const ledger = await repo.insert('wallet_ledger', {
    user_id: userId,
    amount_clp: amount,
    balance_after_clp: newBalance,
    entry_type,
    match_id: match_id || null,
    note: note || null,
    meta: meta || {},
  });
  return { ledger: mapLedgerRow(ledger), account: mapAccountRow(account) };
}

async function listLedger(userId, { limit = 30 } = {}) {
  const cap = Math.min(Math.max(Number(limit) || 30, 1), 100);
  if (supabase.isConfigured()) {
    const sb = supabase.getClient();
    const { data, error } = await sb
      .from('wallet_ledger')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(cap);
    if (error) {
      if (/wallet_ledger|PGRST204/i.test(error.message || '')) return [];
      throw error;
    }
    return (data || []).map(mapLedgerRow);
  }
  const rows = await repo.list('wallet_ledger', {});
  return rows
    .filter((r) => r.user_id === userId)
    .slice(0, cap)
    .map(mapLedgerRow);
}

async function sandboxTopUp(userId, amountClp) {
  const amount = roundClp(amountClp);
  if (amount < 1000) {
    const e = new Error('Recarga mínima $1.000 CLP');
    e.status = 400;
    throw e;
  }
  if (amount > SANDBOX_TOPUP_MAX_CLP) {
    const e = new Error(`Recarga máxima $${SANDBOX_TOPUP_MAX_CLP.toLocaleString('es-CL')} CLP`);
    e.status = 400;
    throw e;
  }
  const mode = paymentProviderMode();
  if (mode !== 'sandbox' && mode !== 'mercadopago') {
    const e = new Error('Recarga sandbox no disponible en este modo de pago');
    e.status = 403;
    throw e;
  }
  const entryType = mode === 'mercadopago' ? 'topup_mercadopago' : 'topup_sandbox';
  return applyEntry(userId, {
    amount_clp: amount,
    entry_type: entryType,
    note: mode === 'sandbox' ? 'Recarga Cubik Sandbox' : 'Recarga Mercado Pago',
  });
}

function ledgerLabel(entry) {
  const map = {
    topup_sandbox: 'Recarga sandbox',
    topup_mercadopago: 'Recarga Mercado Pago',
    escrow_hold: 'Retención en ruta',
    escrow_release: 'Pago flete recibido',
    escrow_refund: 'Devolución escrow',
  };
  return map[entry?.entry_type] || entry?.entry_type || 'Movimiento';
}

async function buildWalletSummary(repo, user) {
  if (!walletEnabled() || !user?.sub) {
    return { enabled: false };
  }
  const role = user.role === 'carrier' ? 'carrier' : 'shipper';
  const account = await getAccount(user.sub);
  const ledger = await listLedger(user.sub, { limit: 15 });

  const { filterMatchesForUser } = require('./access-scope');
  const { escrowAmounts } = require('./wallet-config');
  const { breakdownForMatch } = require('./payment-simulation');

  let matches = await repo.list('matches', {});
  matches = await filterMatchesForUser(matches, user);

  const activeEscrow = [];
  const completedPaid = [];
  let heldTotal = 0;
  let receivedTotal = 0;

  for (const m of matches) {
    if (m.wallet_payment_status === 'held') {
      const amt = escrowAmounts(m.agreed_price_clp);
      if (!amt) continue;
      heldTotal += role === 'shipper' ? amt.shipper_hold_clp : amt.carrier_payout_clp;
      activeEscrow.push({
        match_id: m.id,
        status_label: role === 'shipper' ? 'Retenido en ruta' : 'Pago retenido — se libera al completar',
        amount_clp: role === 'shipper' ? amt.shipper_hold_clp : amt.carrier_payout_clp,
        agreed_price_clp: amt.agreed_price_clp,
      });
    }
    if (m.wallet_payment_status === 'released' && m.status === 'completed') {
      const bd = breakdownForMatch(m, role);
      if (!bd) continue;
      receivedTotal += role === 'shipper' ? bd.total_clp : bd.net_clp;
      completedPaid.push({
        match_id: m.id,
        status_label: role === 'shipper' ? 'Pagado' : 'Acreditado en saldo',
        net_clp: role === 'shipper' ? bd.total_clp : bd.net_clp,
        completed_at: m.completed_at || m.wallet_settled_at,
      });
    }
  }

  completedPaid.sort(
    (a, b) => new Date(b.completed_at || 0) - new Date(a.completed_at || 0)
  );

  return {
    enabled: true,
    prod: true,
    role,
    balance_clp: account.balance_clp,
    wallet_label: role === 'shipper' ? 'Saldo Cubik (prueba)' : 'Saldo Cubik — cobros (prueba)',
    tables_missing: Boolean(account.tables_missing),
    active_escrow: activeEscrow,
    held_total_clp: heldTotal,
    completed_trips: completedPaid.slice(0, 8),
    received_total_clp: receivedTotal,
    ledger,
    ledger_labels: true,
    note:
      role === 'shipper'
        ? 'Saldo de prueba: recarga arriba sin cargo a tu banco. Al «En ruta» retenemos flete + 10%. Publicar exige 20% del presupuesto máximo en saldo.'
        : 'Al completar el viaje acreditamos tu neto (flete − 5%) en Cubik Saldo de prueba. Retiro a banco real: etapa posterior.',
    can_topup: paymentProviderMode() === 'sandbox' || paymentProviderMode() === 'mercadopago',
  };
}

module.exports = {
  getAccount,
  applyEntry,
  listLedger,
  sandboxTopUp,
  ledgerLabel,
  buildWalletSummary,
};
