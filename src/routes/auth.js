'use strict';

const express = require('express');
const { registerUser, loginUser, authMiddleware } = require('../lib/auth');
const { fetchKycStatus } = require('../lib/kyc-gate');
const { getUserPresence } = require('../lib/carrier-presence');
const supabase = require('../services/supabase');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { email, password, full_name, role, company_name, phone, admin_key } = req.body || {};
  if (!email?.trim() || !password || password.length < 6) {
    return res.status(400).json({ ok: false, error: 'Email y contraseña (mín. 6) requeridos' });
  }
  if (!full_name?.trim()) {
    return res.status(400).json({ ok: false, error: 'Nombre de contacto requerido' });
  }
  if (!company_name?.trim() && role !== 'admin') {
    return res.status(400).json({ ok: false, error: 'Nombre de empresa requerido' });
  }
  try {
    const result = await registerUser({
      email,
      password,
      full_name,
      role,
      company_name,
      phone,
      admin_key,
    });
    res.status(201).json({ ok: true, ...result });
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ ok: false, error: e.message || 'Error al registrar' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email?.trim() || !password) {
    return res.status(400).json({ ok: false, error: 'Email y contraseña requeridos' });
  }
  try {
    const result = await loginUser({ email, password });
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ ok: false, error: e.message || 'Error al iniciar sesión' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    let user = { ...req.user };
    if (supabase.isConfigured() && req.user?.sub) {
      user.kyc_status = await fetchKycStatus(req.user.sub);
      if (user.role === 'carrier') {
        const presence = await getUserPresence(req.user.sub);
        if (presence) Object.assign(user, presence);
      }
    }
    res.json({ ok: true, user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al leer perfil' });
  }
});

module.exports = router;
