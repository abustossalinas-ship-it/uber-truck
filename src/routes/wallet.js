'use strict';

const express = require('express');
const { authMiddleware } = require('../lib/auth');
const {
  getAccount,
  listLedger,
  sandboxTopUp,
  ledgerLabel,
  buildWalletSummary,
} = require('../lib/wallet');
const { walletConfig, walletEnabled } = require('../lib/wallet-config');
const repo = require('../lib/repository');

const router = express.Router();

router.get('/config', (_req, res) => {
  res.json({ ok: true, ...walletConfig() });
});

router.get('/summary', authMiddleware, async (req, res) => {
  try {
    if (!walletEnabled()) {
      return res.json({ ok: true, enabled: false });
    }
    const summary = await buildWalletSummary(repo, req.user);
    res.json({ ok: true, ...summary });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'No se pudo cargar Cubik Saldo' });
  }
});

router.get('/balance', authMiddleware, async (req, res) => {
  try {
    const account = await getAccount(req.user.sub);
    res.json({ ok: true, balance_clp: account.balance_clp, account });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'No se pudo leer saldo' });
  }
});

router.get('/ledger', authMiddleware, async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 30;
    const rows = await listLedger(req.user.sub, { limit });
    res.json({
      ok: true,
      data: rows.map((r) => ({ ...r, label: ledgerLabel(r) })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'No se pudo cargar movimientos' });
  }
});

router.post('/topup', authMiddleware, async (req, res) => {
  try {
    if (!walletEnabled()) {
      return res.status(403).json({ ok: false, error: 'Cubik Saldo prod no está activo' });
    }
    const amount = Number(req.body?.amount_clp);
    const result = await sandboxTopUp(req.user.sub, amount);
    res.json({
      ok: true,
      message: `Recarga de $${amount.toLocaleString('es-CL')} CLP acreditada`,
      balance_clp: result.account.balance_clp,
      ledger: result.ledger,
    });
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ ok: false, error: e.message || 'Error al recargar' });
  }
});

module.exports = router;
