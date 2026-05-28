'use strict';

const express = require('express');
const supabase = require('../services/supabase');
const { authMiddleware } = require('../lib/auth');

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

module.exports = router;
