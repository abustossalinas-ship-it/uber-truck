'use strict';

const express = require('express');
const {
  registerUser,
  validateLoginCredentials,
  authMiddleware,
  fetchUserById,
  updateUserProfile,
} = require('../lib/auth');
const { resolveLoginAfterPassword, verifyNewDeviceOtp, createNewDeviceOtp } = require('../lib/auth-otp');
const {
  deviceSessionsEnabled,
  requestMeta,
  revokeSession,
  upsertSession,
  SESSION_TTL_DAYS,
} = require('../lib/device-session');
const { TRUCK_TYPES } = require('../lib/truck-capacity');
const { fetchKycStatus, assertCarrierLoginAllowed } = require('../lib/kyc-gate');
const { getUserPresence } = require('../lib/carrier-presence');
const {
  checklistProgress,
  deriveCarrierKycPhase,
  attachOnboardingToUser,
  buildCarrierDocumentProfile,
} = require('../lib/carrier-onboarding');
const { syncUserDocumentCompliance } = require('../lib/kyc-gate');
const {
  canRequestForgot,
  forgotCooldownRemainingMs,
  findUserByEmail,
  createPasswordResetToken,
  verifyPasswordResetToken,
  resetPasswordWithToken,
  changePassword,
} = require('../lib/password-reset');
const mail = require('../services/mail');
const supabase = require('../services/supabase');
const { validatePassword } = require('../lib/password-policy');
const { assertLoginIntentRole } = require('../lib/auth-intent');

const router = express.Router();

const FORGOT_OK_MESSAGE =
  'Si el email tiene cuenta, enviamos un enlace para restablecer la contraseña (revisa spam).';

router.post('/register', async (req, res) => {
  const { email, password, full_name, role, company_name, phone, admin_key } = req.body || {};
  if (!email?.trim() || !password) {
    return res.status(400).json({ ok: false, error: 'Email y contraseña requeridos' });
  }
  const policy = validatePassword(password);
  if (!policy.ok) {
    return res.status(400).json({ ok: false, error: policy.error });
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
    const meta = requestMeta(req, req.body || {});
    if (deviceSessionsEnabled() && meta.deviceHash) {
      await upsertSession(result.user.id, meta);
    }
    res.status(201).json({
      ok: true,
      ...result,
      session_expires_days: SESSION_TTL_DAYS,
    });
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
    const user = await validateLoginCredentials(email, password);
    assertLoginIntentRole(user, req.body || {});
    await assertCarrierLoginAllowed(user);
    const result = await resolveLoginAfterPassword(user, req, req.body || {});
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({
      ok: false,
      error: e.message || 'Error al iniciar sesión',
      code: e.code || undefined,
      actual_role: e.actual_role,
      wait_seconds: e.wait_seconds,
      docs_blocked: e.docs_blocked,
    });
  }
});

router.post('/otp/verify', async (req, res) => {
  const { otp_id, code, email, password } = req.body || {};
  if (!otp_id || !code?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ ok: false, error: 'Datos de verificación incompletos' });
  }
  try {
    const user = await validateLoginCredentials(email, password);
    assertLoginIntentRole(user, req.body || {});
    await assertCarrierLoginAllowed(user);
    const meta = requestMeta(req, req.body || {});
    const result = await verifyNewDeviceOtp({ otp_id, code, user, meta });
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('[auth] otp/verify', e);
    res.status(e.status || 500).json({
      ok: false,
      error: e.message || 'Error al verificar código',
      code: e.code,
      actual_role: e.actual_role,
      docs_blocked: e.docs_blocked,
    });
  }
});

router.post('/otp/resend', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email?.trim() || !password) {
    return res.status(400).json({ ok: false, error: 'Email y contraseña requeridos' });
  }
  try {
    const user = await validateLoginCredentials(email, password);
    assertLoginIntentRole(user, req.body || {});
    const meta = requestMeta(req, req.body || {});
    const otp = await createNewDeviceOtp(user, meta);
    res.json({ ok: true, ...otp });
  } catch (e) {
    res.status(e.status || 500).json({
      ok: false,
      error: e.message,
      code: e.code,
      actual_role: e.actual_role,
      wait_seconds: e.wait_seconds,
    });
  }
});

router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const meta = requestMeta(req, req.body || {});
    if (meta.deviceHash) {
      await revokeSession(req.user.sub, meta.deviceHash);
    }
    res.json({ ok: true, message: 'Sesión cerrada en este dispositivo.' });
  } catch (e) {
    console.error('[auth] logout', e);
    res.status(500).json({ ok: false, error: 'Error al cerrar sesión' });
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
    const waitMs = forgotCooldownRemainingMs(email);
    if (waitMs > 0) {
      const mins = Math.ceil(waitMs / 60000);
      return res.json({
        ok: true,
        throttled: true,
        wait_seconds: Math.ceil(waitMs / 1000),
        message: `Ya pediste un enlace hace poco. Revisa bandeja y spam; si no llegó, espera ${mins} min y vuelve a intentar.`,
      });
    }
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
      const payload = { ok: true, message: FORGOT_OK_MESSAGE, sent: true };
      if (mailResult.dev && process.env.NODE_ENV !== 'production') {
        payload.dev_reset_url = resetUrl;
      }
      return res.json(payload);
    }
    res.json({ ok: true, message: FORGOT_OK_MESSAGE, sent: false });
  } catch (e) {
    console.error('[auth] forgot-password', e);
    if (e.status === 503) {
      return res.status(503).json({ ok: false, error: e.message });
    }
    if (e.status === 502) {
      return res.status(502).json({
        ok: false,
        error:
          'No se pudo enviar el correo. Si usas onboarding@resend.dev, solo funciona con el email de tu cuenta Resend.',
        detail: e.message,
      });
    }
    return res.status(500).json({ ok: false, error: 'Error al procesar la solicitud. Intenta más tarde.' });
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
  const policy = validatePassword(password);
  if (!policy.ok) {
    return res.status(400).json({ ok: false, error: policy.error });
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
      let row = await fetchUserById(req.user.sub);
      if (row) {
        row = await attachOnboardingToUser(row);
        user = {
          id: row.id,
          sub: row.id,
          email: row.email,
          full_name: row.full_name,
          name: row.full_name,
          role: row.role,
          company_name: row.company_name,
          phone: row.phone,
          kyc_status: row.kyc_status || 'pending',
          is_available: Boolean(row.is_available),
          last_lat: row.last_lat ?? null,
          last_lng: row.last_lng ?? null,
          location_updated_at: row.location_updated_at || null,
          default_truck_type_id: row.default_truck_type_id || null,
        };
        if (user.role === 'carrier') {
          user.onboarding_progress = checklistProgress(row);
          const compliance = await syncUserDocumentCompliance(row.id, row);
          user.document_compliance = compliance;
          user.docs_compliance_status =
            compliance?.status || row.docs_compliance_status || 'unknown';
          user.kyc_phase = deriveCarrierKycPhase(
            user.kyc_status,
            user.onboarding_progress,
            user.docs_compliance_status
          );
          user.document_profile = buildCarrierDocumentProfile(row, compliance);
          user.national_rut = row.national_rut || null;
          user.doc_ci_expires_at = row.doc_ci_expires_at || null;
          user.doc_license_expires_at = row.doc_license_expires_at || null;
          user.doc_insurance_expires_at = row.doc_insurance_expires_at || null;
          user.doc_soap_expires_at = row.doc_soap_expires_at || null;
          user.carrier_rubro = row.carrier_rubro || null;
          user.insurance_level = row.insurance_level || null;
          user.onboarding_vehicle_plates = row.onboarding_vehicle_plates || null;
          user.carrier_fleet_type = row.carrier_fleet_type || null;
        }
      } else {
        user.kyc_status = await fetchKycStatus(req.user.sub);
      }
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

router.patch('/me', authMiddleware, async (req, res) => {
  if (!supabase.isConfigured()) {
    return res.status(503).json({ ok: false, error: 'Perfil requiere Supabase configurado' });
  }
  const body = req.body || {};
  if (body.default_truck_type_id !== undefined && body.default_truck_type_id !== null && body.default_truck_type_id !== '') {
    const ok = TRUCK_TYPES.some((t) => t.id === body.default_truck_type_id);
    if (!ok) {
      return res.status(400).json({ ok: false, error: 'Tipo de camión no válido' });
    }
    if (req.user.role !== 'carrier' && req.user.role !== 'admin') {
      return res.status(403).json({
        ok: false,
        error: 'Solo transportistas pueden guardar el camión habitual',
      });
    }
  }
  try {
    const row = await updateUserProfile(req.user.sub, {
      default_truck_type_id:
        body.default_truck_type_id === '' || body.default_truck_type_id == null
          ? null
          : body.default_truck_type_id,
    });
    const user = {
      id: row.id,
      sub: row.id,
      email: row.email,
      full_name: row.full_name,
      name: row.full_name,
      role: row.role,
      company_name: row.company_name,
      phone: row.phone,
      kyc_status: row.kyc_status || 'pending',
      is_available: Boolean(row.is_available),
      last_lat: row.last_lat ?? null,
      last_lng: row.last_lng ?? null,
      location_updated_at: row.location_updated_at || null,
      default_truck_type_id: row.default_truck_type_id || null,
    };
    res.json({ ok: true, user, message: 'Perfil actualizado' });
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ ok: false, error: e.message || 'Error al actualizar perfil' });
  }
});

module.exports = router;
