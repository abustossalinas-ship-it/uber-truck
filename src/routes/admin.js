'use strict';

const express = require('express');
const supabase = require('../services/supabase');
const repo = require('../lib/repository');
const { authMiddleware } = require('../lib/auth');
const { normalizeOrgName } = require('../lib/ownership');

const router = express.Router();

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Solo administrador' });
  }
  next();
}

router.get('/users', authMiddleware, requireAdmin, async (req, res) => {
  if (!supabase.isConfigured()) {
    return res.status(503).json({ ok: false, error: 'Requiere Supabase' });
  }
  try {
    const status = req.query.status || 'pending';
    const sb = supabase.getClient();
    let q = sb
      .from('users')
      .select('id, email, full_name, role, company_name, phone, kyc_status, created_at')
      .neq('role', 'admin')
      .order('created_at', { ascending: false });
    if (status !== 'all') q = q.eq('kyc_status', status);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ ok: true, data: data || [] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al listar usuarios' });
  }
});

router.patch('/users/:id/kyc', authMiddleware, requireAdmin, async (req, res) => {
  if (!supabase.isConfigured()) {
    return res.status(503).json({ ok: false, error: 'Requiere Supabase' });
  }
  const nextStatus = req.body?.kyc_status;
  if (!['approved', 'rejected', 'pending'].includes(nextStatus)) {
    return res.status(400).json({
      ok: false,
      error: 'kyc_status debe ser approved, rejected o pending',
    });
  }
  try {
    const sb = supabase.getClient();
    const { data, error } = await sb
      .from('users')
      .update({ kyc_status: nextStatus })
      .eq('id', req.params.id)
      .select('id, email, full_name, role, company_name, kyc_status')
      .single();
    if (error) throw error;
    res.json({
      ok: true,
      data,
      message:
        nextStatus === 'approved'
          ? 'Cuenta aprobada. El usuario ya puede operar en el tablero.'
          : nextStatus === 'rejected'
            ? 'Cuenta rechazada.'
            : 'Cuenta marcada como pendiente.',
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al actualizar KYC' });
  }
});

/** Vincula cargas/ofertas sin dueño al usuario con el mismo nombre de empresa. */
router.post('/backfill-owners', authMiddleware, requireAdmin, async (req, res) => {
  if (!supabase.isConfigured()) {
    return res.status(503).json({ ok: false, error: 'Requiere Supabase' });
  }
  try {
    const users = await repo.list('users', {});
    const loads = await repo.list('load_requests', {});
    const offers = await repo.list('capacity_offers', {});
    let loadsLinked = 0;
    let offersLinked = 0;

    for (const u of users.filter((x) => x.role === 'shipper')) {
      const key = normalizeOrgName(u.company_name);
      if (!key) continue;
      for (const l of loads) {
        if (l.shipper_user_id || normalizeOrgName(l.company_name) !== key) continue;
        await repo.update('load_requests', l.id, { shipper_user_id: u.id });
        l.shipper_user_id = u.id;
        loadsLinked += 1;
      }
    }

    for (const u of users.filter((x) => x.role === 'carrier')) {
      const key = normalizeOrgName(u.company_name);
      if (!key) continue;
      for (const o of offers) {
        if (o.carrier_user_id || normalizeOrgName(o.carrier_name) !== key) continue;
        await repo.update('capacity_offers', o.id, { carrier_user_id: u.id });
        o.carrier_user_id = u.id;
        offersLinked += 1;
      }
    }

    res.json({
      ok: true,
      loads_linked: loadsLinked,
      offers_linked: offersLinked,
      message: `Vinculadas ${loadsLinked} cargas y ${offersLinked} ofertas a cuentas por nombre de empresa.`,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al vincular dueños' });
  }
});

module.exports = router;
