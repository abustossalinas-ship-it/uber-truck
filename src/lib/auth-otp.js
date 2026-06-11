'use strict';

const crypto = require('crypto');
const supabase = require('../services/supabase');
const mail = require('../services/mail');
const {
  deviceSessionsEnabled,
  findActiveSession,
  completeTrustedLogin,
  upsertSession,
  issueAuthPayload,
  deviceTypeFromUa,
  requestMeta,
} = require('./device-session');

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const lastOtpByUser = new Map();

function hashOtp(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

function generateOtpCode() {
  return String(crypto.randomInt(0, 10000)).padStart(4, '0');
}

function otpCooldownRemainingMs(userId) {
  const prev = lastOtpByUser.get(userId);
  if (!prev) return 0;
  const left = OTP_RESEND_COOLDOWN_MS - (Date.now() - prev);
  return left > 0 ? left : 0;
}

async function invalidatePendingOtps(userId, purpose = 'new_device') {
  const sb = supabase.getClient();
  await sb
    .from('auth_otp_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('purpose', purpose)
    .is('used_at', null);
}

async function createNewDeviceOtp(user, meta) {
  if (!deviceSessionsEnabled() || !supabase.isConfigured()) {
    const err = new Error('Verificación por dispositivo no disponible');
    err.status = 503;
    throw err;
  }
  const waitMs = otpCooldownRemainingMs(user.id);
  if (waitMs > 0) {
    const err = new Error(`Espera ${Math.ceil(waitMs / 1000)} s antes de pedir otro código.`);
    err.status = 429;
    err.wait_seconds = Math.ceil(waitMs / 1000);
    throw err;
  }
  lastOtpByUser.set(user.id, Date.now());
  const code = generateOtpCode();
  await invalidatePendingOtps(user.id, 'new_device');
  const sb = supabase.getClient();
  const expires_at = new Date(Date.now() + OTP_TTL_MS).toISOString();
  const { data, error } = await sb
    .from('auth_otp_codes')
    .insert({
      user_id: user.id,
      purpose: 'new_device',
      channel: 'email',
      code_hash: hashOtp(code),
      device_hash: meta.deviceHash,
      ip: meta.ip,
      user_agent: meta.userAgent,
      surface: meta.surface,
      expires_at,
    })
    .select('id')
    .single();
  if (error) throw error;
  await mail.sendLoginOtpEmail({
    to: user.email,
    fullName: user.full_name,
    code,
  });
  return {
    otp_id: data.id,
    channel: 'email',
    expires_in_seconds: Math.floor(OTP_TTL_MS / 1000),
    message: `Enviamos un código de 4 dígitos a ${user.email}. Revisa bandeja y spam.`,
    dev_code: process.env.NODE_ENV !== 'production' ? code : undefined,
  };
}

async function verifyNewDeviceOtp({ otp_id, code, user, meta }) {
  if (!otp_id || !code?.trim()) {
    const err = new Error('Código requerido');
    err.status = 400;
    throw err;
  }
  const sb = supabase.getClient();
  const { data: row, error } = await sb
    .from('auth_otp_codes')
    .select('id, user_id, code_hash, device_hash, expires_at, used_at, purpose')
    .eq('id', otp_id)
    .maybeSingle();
  if (error) throw error;
  if (!row || row.user_id !== user.id || row.purpose !== 'new_device' || row.used_at) {
    const err = new Error('Código inválido o expirado');
    err.status = 401;
    throw err;
  }
  if (new Date(row.expires_at) < new Date()) {
    const err = new Error('Código expirado. Vuelve a iniciar sesión.');
    err.status = 401;
    throw err;
  }
  if (row.device_hash && meta.deviceHash && row.device_hash !== meta.deviceHash) {
    const err = new Error('Dispositivo no coincide con la verificación');
    err.status = 403;
    throw err;
  }
  if (hashOtp(code.trim()) !== row.code_hash) {
    const err = new Error('Código incorrecto');
    err.status = 401;
    err.code = 'wrong_otp';
    throw err;
  }
  await sb
    .from('auth_otp_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('id', row.id);
  await upsertSession(user.id, meta);
  const resetUrl = `${mail.publicAppUrl()}/reset-password.html`;
  mail
    .sendNewDeviceSignInEmail({
      to: user.email,
      fullName: user.full_name,
      resetUrl,
      signInAt: new Date(),
      country: meta.country || 'Chile',
      deviceType: deviceTypeFromUa(meta.userAgent),
      surface: meta.surface || 'Cubik',
      ip: meta.ip || '—',
    })
    .catch((e) => console.error('[auth-otp] new device mail', e));
  return { ...issueAuthPayload(user), new_device: true };
}

async function resolveLoginAfterPassword(user, req, body) {
  const meta = requestMeta(req, body);
  if (!deviceSessionsEnabled() || !meta.deviceHash) {
    return issueAuthPayload(user);
  }
  try {
    const session = await findActiveSession(user.id, meta.deviceHash);
    if (session) {
      return completeTrustedLogin(user, meta);
    }
    const otp = await createNewDeviceOtp(user, meta);
    return {
      need_otp: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
      ...otp,
    };
  } catch (e) {
    if (e.code === '42P01') {
      return issueAuthPayload(user);
    }
    throw e;
  }
}

module.exports = {
  hashOtp,
  generateOtpCode,
  otpCooldownRemainingMs,
  createNewDeviceOtp,
  verifyNewDeviceOtp,
  resolveLoginAfterPassword,
};
