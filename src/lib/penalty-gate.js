'use strict';

const repo = require('./repository');
const { buildPenaltySummary, PENALTY_DUE_DAYS } = require('./penalty-ledger');

function evaluateOperatingBlock(summary) {
  const totalOwed = Number(summary?.total_owed_clp) || 0;
  const overdueCount = Number(summary?.overdue_count) || 0;
  const dueDays = summary?.penalty_due_days || PENALTY_DUE_DAYS;
  const hasDebt = totalOwed > 0;
  const blocked = hasDebt && overdueCount > 0;

  let message = null;
  if (blocked) {
    message =
      `Tienes multas vencidas por $${totalOwed.toLocaleString('es-CL')} CLP. ` +
      `No puedes publicar, ofertar ni tomar nuevos viajes hasta regularizar. ` +
      `Abre «Ayuda / revisión» en Cuenta y multas o contacta al moderador.`;
  } else if (hasDebt) {
    message =
      `Tienes $${totalOwed.toLocaleString('es-CL')} CLP en multas sugeridas. ` +
      `Plazo de pago: ${dueDays} días desde la cancelación. Después del vencimiento se bloquean nuevas operaciones.`;
  }

  return {
    blocked,
    has_debt: hasDebt,
    total_owed_clp: totalOwed,
    overdue_count: overdueCount,
    penalty_due_days: dueDays,
    message,
  };
}

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

/** Permite apagar disponibilidad aunque haya multa vencida. */
async function requirePenaltyClearUnlessGoingOffline(req, res, next) {
  if (req.body?.is_available === false) return next();
  return requirePenaltyClear(req, res, next);
}

module.exports = {
  evaluateOperatingBlock,
  getOperatingStatus,
  requirePenaltyClear,
  requirePenaltyClearUnlessGoingOffline,
};
