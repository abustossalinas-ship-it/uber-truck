'use strict';

const repo = require('./repository');
const { buildPenaltySummary, evaluateOperatingBlock } = require('./penalty-ledger');

async function getOperatingStatus(user) {
  if (!user?.sub) {
    return { blocked: false, has_debt: false, total_owed_clp: 0, overdue_count: 0 };
  }
  if (user.role === 'admin') {
    return { blocked: false, has_debt: false, total_owed_clp: 0, overdue_count: 0, role: 'admin' };
  }
  const role = user.role === 'carrier' ? 'carrier' : 'shipper';
  const summary = await buildPenaltySummary(repo, role);
  const status = evaluateOperatingBlock(summary);
  return { ...status, role };
}

async function requirePenaltyClear(req, res, next) {
  if (!req.user?.sub) return next();
  if (req.user.role === 'admin') return next();
  try {
    const status = await getOperatingStatus(req.user);
    req.penalty_operating = status;
    if (!status.blocked) return next();
    return res.status(403).json({
      ok: false,
      error: status.message,
      penalty_block: true,
      operating_status: status,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: 'No se pudo verificar multas pendientes' });
  }
}

module.exports = {
  evaluateOperatingBlock,
  getOperatingStatus,
  requirePenaltyClear,
};
