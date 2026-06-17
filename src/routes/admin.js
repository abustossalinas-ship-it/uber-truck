'use strict';

const express = require('express');
const supabase = require('../services/supabase');
const repo = require('../lib/repository');
const { authMiddleware } = require('../lib/auth');
const { normalizeOrgName } = require('../lib/ownership');
const { buildAdminDashboard, listAdminTrips } = require('../lib/admin-metrics');
const {
  ONBOARDING_SELECT,
  checklistProgress,
  validateOnboardingPatch,
} = require('../lib/carrier-onboarding');
const { syncUserDocumentCompliance } = require('../lib/kyc-gate');

const router = express.Router();

const USER_LIST_SELECT = `id, email, full_name, role, company_name, phone, kyc_status, created_at, ${ONBOARDING_SELECT}`;

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
      .select(USER_LIST_SELECT)
      .neq('role', 'admin')
      .order('created_at', { ascending: false });
    if (status !== 'all') q = q.eq('kyc_status', status);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data || []).map((u) => ({
      ...u,
      onboarding_progress:
        u.role === 'carrier' ? checklistProgress(u) : null,
    }));
    res.json({ ok: true, data: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al listar usuarios' });
  }
});

router.patch('/users/:id/onboarding', authMiddleware, requireAdmin, async (req, res) => {
  if (!supabase.isConfigured()) {
    return res.status(503).json({ ok: false, error: 'Requiere Supabase' });
  }
  const parsed = validateOnboardingPatch(req.body || {});
  if (parsed.error) {
    return res.status(400).json({ ok: false, error: parsed.error });
  }
  if (!Object.keys(parsed.patch).length) {
    return res.status(400).json({ ok: false, error: 'Sin cambios' });
  }
  try {
    const sb = supabase.getClient();
    const { data: existing, error: findErr } = await sb
      .from('users')
      .select('id, role')
      .eq('id', req.params.id)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!existing) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    if (existing.role !== 'carrier') {
      return res.status(400).json({ ok: false, error: 'Checklist C3a solo aplica a transportistas' });
    }
    const { data, error } = await sb
      .from('users')
      .update(parsed.patch)
      .eq('id', req.params.id)
      .select(USER_LIST_SELECT)
      .single();
    if (error) throw error;
    await syncUserDocumentCompliance(data.id, data);
    res.json({
      ok: true,
      data: { ...data, onboarding_progress: checklistProgress(data) },
      message: 'Checklist onboarding guardado.',
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al guardar checklist' });
  }
});

router.patch('/users/:id/kyc', authMiddleware, requireAdmin, async (req, res) => {
  if (!supabase.isConfigured()) {
    return res.status(503).json({ ok: false, error: 'Requiere Supabase' });
  }
  const nextStatus = req.body?.kyc_status;
  const force = req.body?.force === true;
  if (!['approved', 'rejected', 'pending'].includes(nextStatus)) {
    return res.status(400).json({
      ok: false,
      error: 'kyc_status debe ser approved, rejected o pending',
    });
  }
  try {
    const sb = supabase.getClient();
    const { data: existing, error: findErr } = await sb
      .from('users')
      .select(USER_LIST_SELECT)
      .eq('id', req.params.id)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!existing) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });

    if (nextStatus === 'approved' && existing.role === 'carrier' && !force) {
      const progress = checklistProgress(existing);
      if (progress && !progress.complete) {
        return res.status(409).json({
          ok: false,
          error: `Checklist C3a incompleto (${progress.done}/${progress.total}). Completa CI, licencia, SOAP, seguro, rubro, nivel y patentes — o reintenta con force: true.`,
          onboarding_progress: progress,
          code: 'onboarding_incomplete',
        });
      }
    }

    const { data, error } = await sb
      .from('users')
      .update({ kyc_status: nextStatus })
      .eq('id', req.params.id)
      .select(USER_LIST_SELECT)
      .single();
    if (error) throw error;
    res.json({
      ok: true,
      data: { ...data, onboarding_progress: checklistProgress(data) },
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

router.get('/dashboard', authMiddleware, requireAdmin, async (req, res) => {
  if (!supabase.isConfigured()) {
    return res.status(503).json({ ok: false, error: 'Requiere Supabase' });
  }
  try {
    const result = await buildAdminDashboard(repo, req.query);
    if (result.error) return res.status(400).json({ ok: false, error: result.error });
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al cargar panel operativo' });
  }
});

router.get('/trips', authMiddleware, requireAdmin, async (req, res) => {
  if (!supabase.isConfigured()) {
    return res.status(503).json({ ok: false, error: 'Requiere Supabase' });
  }
  try {
    const result = await listAdminTrips(repo, req.query);
    if (result.error) return res.status(400).json({ ok: false, error: result.error });
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al listar viajes' });
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
