'use strict';

const express = require('express');
const { registerUser, loginUser, authMiddleware } = require('../lib/auth');
const { fetchKycStatus } = require('../lib/kyc-gate');
const { getUserPresence } = require('../lib/carrier-presence');
const {
  canRequestForgot,
  findUserByEmail,
  createPasswordResetToken,
  verifyPasswordResetToken,
  resetPasswordWithToken,
  changePassword,
} = require('../lib/password-reset');
const mail = require('../services/mail');
const supabase = require('../services/supabase');

const router = express.Router();

const FORGOT_OK_MESSAGE =
  'Si el email tiene cuenta, enviamos un enlace para restablecer la contraseña (revisa spam).';

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

router.post('/forgot-password', async (req, res) => {
  const email = req.body?.email?.trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ ok: false, error: 'Email requerido' });
  }
  if (!supabase.isConfigured()) {
    return res.status(503).json({ ok: false, error: 'Recuperación requiere Supabase configurado' });
  }
  try {
    if (!canRequestForgot(email)) {
      return res.json({ ok: true, message: FORGOT_OK_MESSAGE });
    }
    const user = await findUserByEmail(email);
    if (user?.password_hash) {
      const { token } = await createPasswordResetToken(user.id);
      const base = mail.publicAppUrl(`${req.protocol}://${req.get('host')}`);
      const resetUrl = `${base}/reset-password.html?token=${encodeURIComponent(token)}`;
      const mailResult = await mail.sendPasswordResetEmail({
        to: user.email,
        fullName: user.full_name,
        resetUrl,
      });
      const payload = { ok: true, message: FORGOT_OK_MESSAGE };
      if (mailResult.dev && process.env.NODE_ENV !== 'production') {
        payload.dev_reset_url = resetUrl;
      }
      return res.json(payload);
    }
    res.json({ ok: true, message: FORGOT_OK_MESSAGE });
  } catch (e) {
    console.error(e);
    if (e.status === 503) {
      return res.status(503).json({ ok: false, error: e.message });
    }
    res.json({ ok: true, message: FORGOT_OK_MESSAGE });
  }
});

router.get('/reset-password/verify', async (req, res) => {
  const token = req.query.token;
  if (!token) {
    return res.status(400).json({ ok: false, error: 'Token requerido' });
  }
  try {
    const row = await verifyPasswordResetToken(token);
    if (!row) {
      return res.status(400).json({ ok: false, error: 'Enlace inválido o expirado' });
    }
    res.json({ ok: true, valid: true, expires_at: row.expires_at });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al validar enlace' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body || {};
  if (!token?.trim() || !password) {
    return res.status(400).json({ ok: false, error: 'Token y contraseña requeridos' });
  }
  if (password.length < 6) {
    return res.status(400).json({ ok: false, error: 'La contraseña debe tener al menos 6 caracteres' });
  }
  try {
    await resetPasswordWithToken(token, password);
    res.json({
      ok: true,
      message: 'Contraseña actualizada. Ya puedes iniciar sesión con tu nueva clave.',
    });
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ ok: false, error: e.message || 'Error al restablecer' });
  }
});

router.post('/change-password', authMiddleware, async (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) {
    return res.status(400).json({
      ok: false,
      error: 'Contraseña actual y nueva son requeridas',
    });
  }
  try {
    await changePassword(req.user.sub, current_password, new_password);
    res.json({ ok: true, message: 'Contraseña actualizada correctamente.' });
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ ok: false, error: e.message || 'Error al cambiar contraseña' });
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
