'use strict';

const express = require('express');
const { registerUser, loginUser, authMiddleware } = require('../lib/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { email, password, full_name, role, company_name } = req.body || {};
  if (!email?.trim() || !password || password.length < 6) {
    return res.status(400).json({ ok: false, error: 'Email y contraseña (mín. 6) requeridos' });
  }
  if (!full_name?.trim()) {
    return res.status(400).json({ ok: false, error: 'Nombre requerido' });
  }
  try {
    const result = await registerUser({ email, password, full_name, role, company_name });
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

router.get('/me', authMiddleware, (req, res) => {
  res.json({ ok: true, user: req.user });
});

module.exports = router;
