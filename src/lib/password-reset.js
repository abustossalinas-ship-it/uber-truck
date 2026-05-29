'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const supabase = require('../services/supabase');

const TOKEN_TTL_MS = 60 * 60 * 1000;
const lastForgotByEmail = new Map();
const FORGOT_COOLDOWN_MS = 2 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function canRequestForgot(email) {
  const key = email.trim().toLowerCase();
  const prev = lastForgotByEmail.get(key);
  if (prev && Date.now() - prev < FORGOT_COOLDOWN_MS) return false;
  lastForgotByEmail.set(key, Date.now());
  return true;
}

async function findUserByEmail(email) {
  if (!supabase.isConfigured()) return null;
  const sb = supabase.getClient();
  const { data, error } = await sb
    .from('users')
    .select('id, email, full_name, password_hash')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function invalidatePendingTokens(userId) {
  const sb = supabase.getClient();
  await sb
    .from('password_reset_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('used_at', null);
}

async function createPasswordResetToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const token_hash = hashToken(token);
  const expires_at = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  await invalidatePendingTokens(userId);
  const sb = supabase.getClient();
  const { error } = await sb.from('password_reset_tokens').insert({
    user_id: userId,
    token_hash,
    expires_at,
  });
  if (error) throw error;
  return { token, expires_at };
}

async function verifyPasswordResetToken(token) {
  if (!token?.trim() || !supabase.isConfigured()) return null;
  const sb = supabase.getClient();
  const { data, error } = await sb
    .from('password_reset_tokens')
    .select('id, user_id, expires_at, used_at')
    .eq('token_hash', hashToken(token.trim()))
    .maybeSingle();
  if (error) throw error;
  if (!data || data.used_at) return null;
  if (new Date(data.expires_at) < new Date()) return null;
  return data;
}

async function resetPasswordWithToken(token, newPassword) {
  const row = await verifyPasswordResetToken(token);
  if (!row) {
    const e = new Error('Enlace inválido o expirado. Solicita uno nuevo.');
    e.status = 400;
    throw e;
  }
  if (!newPassword || newPassword.length < 6) {
    const e = new Error('La contraseña debe tener al menos 6 caracteres');
    e.status = 400;
    throw e;
  }
  const password_hash = await bcrypt.hash(newPassword, 10);
  const sb = supabase.getClient();
  const { error: userErr } = await sb
    .from('users')
    .update({ password_hash })
    .eq('id', row.user_id);
  if (userErr) throw userErr;
  const used_at = new Date().toISOString();
  await sb.from('password_reset_tokens').update({ used_at }).eq('id', row.id);
  await invalidatePendingTokens(row.user_id);
  const user = await sb
    .from('users')
    .select('id, email, full_name, role, company_name, phone, kyc_status')
    .eq('id', row.user_id)
    .maybeSingle();
  return user.data;
}

async function changePassword(userId, currentPassword, newPassword) {
  if (!newPassword || newPassword.length < 6) {
    const e = new Error('La nueva contraseña debe tener al menos 6 caracteres');
    e.status = 400;
    throw e;
  }
  const sb = supabase.getClient();
  const { data, error } = await sb
    .from('users')
    .select('password_hash')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.password_hash) {
    const e = new Error('Cuenta sin contraseña configurada');
    e.status = 400;
    throw e;
  }
  const ok = await bcrypt.compare(currentPassword, data.password_hash);
  if (!ok) {
    const e = new Error('Contraseña actual incorrecta');
    e.status = 401;
    throw e;
  }
  const password_hash = await bcrypt.hash(newPassword, 10);
  const { error: updErr } = await sb.from('users').update({ password_hash }).eq('id', userId);
  if (updErr) throw updErr;
}

module.exports = {
  canRequestForgot,
  findUserByEmail,
  createPasswordResetToken,
  verifyPasswordResetToken,
  resetPasswordWithToken,
  changePassword,
};
