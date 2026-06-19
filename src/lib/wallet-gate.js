'use strict';

const { getAccount } = require('./wallet');
const {
  walletEnabled,
  walletEnforced,
  publishReserveRequired,
} = require('./wallet-config');

function publishBlockMessage(requiredClp, balanceClp) {
  return (
    `Necesitas al menos $${requiredClp.toLocaleString('es-CL')} CLP en Cubik Saldo ` +
    `(20% del presupuesto máximo). Saldo actual: $${balanceClp.toLocaleString('es-CL')}. Recarga en Cuenta.`
  );
}

async function assertPublishWallet(user, budgetMaxClp) {
  if (!walletEnabled() || !walletEnforced()) return null;
  if (!user?.sub) return null;
  if (user.role !== 'shipper') return null;

  const required = publishReserveRequired(budgetMaxClp);
  if (!required) return null;

  const account = await getAccount(user.sub);
  if (account.tables_missing) {
    return 'Cubik Saldo no está listo — contacta soporte (migración wallet pendiente).';
  }
  if (account.balance_clp < required) {
    return publishBlockMessage(required, account.balance_clp);
  }
  return null;
}

async function requireWalletForPublish(req, res, next) {
  if (!walletEnabled() || !walletEnforced()) return next();
  if (!req.user?.sub || req.user.role === 'admin') return next();
  if (req.user.role !== 'shipper') return next();

  const budgetMax = req.body?.budget_max_clp;
  try {
    const msg = await assertPublishWallet(req.user, budgetMax);
    if (msg) {
      return res.status(403).json({
        ok: false,
        error: msg,
        wallet_required: true,
        wallet_balance_clp: (await getAccount(req.user.sub)).balance_clp,
        wallet_required_clp: publishReserveRequired(budgetMax),
      });
    }
    return next();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: 'No se pudo verificar Cubik Saldo' });
  }
}

module.exports = {
  publishBlockMessage,
  assertPublishWallet,
  requireWalletForPublish,
};
