'use strict';

const crypto = require('crypto');
const supabase = require('../services/supabase');
const { signToken } = require('./auth');

const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 30);

function deviceSessionsEnabled() {
  return process.env.AUTH_DEVICE_SESSIONS !== 'false';
}

function hashDeviceId(deviceId) {
  const raw = String(deviceId || '').trim();
  if (!raw) return null;
  return crypto.createHash('sha256').update(`cubik:${raw}`).digest('hex');
}

function sessionExpiresAt(from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + SESSION_TTL_DAYS);
  return d.toISOString();
}

function isSessionActive(row) {
  if (!row || row.revoked_at) return false;
  return new Date(row.expires_at) > new Date();
}

function requestMeta(req, body = {}) {
  const ip =
    body.client_ip ||
    String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '')
      .split(',')[0]
      .trim() ||
    null;
  const country =
    req.headers['cf-ipcountry'] ||
    req.headers['x-vercel-ip-country'] ||
    body.country ||
    null;
  const surface =
    body.surface ||
    req.headers['x-cubik-surface'] ||
    req.headers.referer ||
    req.headers.host ||
    null;
  const userAgent = body.user_agent || req.headers['user-agent'] || null;
  const deviceId = body.device_id || req.headers['x-cubik-device-id'] || null;
  const deviceHash = hashDeviceId(deviceId);
  return { ip, country, surface, userAgent, deviceId, deviceHash };
}

function deviceTypeFromUa(ua) {
  const s = String(ua || '').toLowerCase();
  if (s.includes('android')) return 'Android';
  if (s.includes('iphone') || s.includes('ipad')) return 'iOS';
  if (s.includes('mobile')) return 'Móvil web';
  return 'Navegador web';
}

async function findActiveSession(userId, deviceHash) {
  if (!deviceHash || !supabase.isConfigured()) return null;
  const sb = supabase.getClient();
  const { data, error } = await sb
    .from('user_sessions')
    .select('id, user_id, device_hash, expires_at, revoked_at, last_seen_at')
    .eq('user_id', userId)
    .eq('device_hash', deviceHash)
    .maybeSingle();
  if (error) {
    if (error.code === '42P01') return null;
    throw error;
  }
  if (!isSessionActive(data)) return null;
  return data;
}

async function touchSession(sessionId) {
  const sb = supabase.getClient();
  const expires_at = sessionExpiresAt();
  await sb
    .from('user_sessions')
    .update({ last_seen_at: new Date().toISOString(), expires_at })
    .eq('id', sessionId);
}

async function upsertSession(userId, meta) {
  if (!meta.deviceHash || !supabase.isConfigured()) return null;
  const sb = supabase.getClient();
  const now = new Date().toISOString();
  const expires_at = sessionExpiresAt();
  const row = {
    user_id: userId,
    device_hash: meta.deviceHash,
    user_agent: meta.userAgent,
    ip: meta.ip,
    country: meta.country,
    surface: meta.surface,
    last_seen_at: now,
    expires_at,
    revoked_at: null,
  };
  const { data, error } = await sb
    .from('user_sessions')
    .upsert(row, { onConflict: 'user_id,device_hash' })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

async function revokeSession(userId, deviceHash) {
  if (!deviceHash || !supabase.isConfigured()) return;
  const sb = supabase.getClient();
  await sb
    .from('user_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('device_hash', deviceHash);
}

async function revokeAllUserSessions(userId) {
  if (!userId || !supabase.isConfigured()) return;
  const sb = supabase.getClient();
  const { error } = await sb
    .from('user_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('revoked_at', null);
  if (error && error.code !== '42P01') throw error;
}

function issueAuthPayload(user) {
  const formatted = {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    company_name: user.company_name,
    phone: user.phone,
    kyc_status: user.kyc_status || 'pending',
    is_available: Boolean(user.is_available),
    last_lat: user.last_lat ?? null,
    last_lng: user.last_lng ?? null,
    location_updated_at: user.location_updated_at || null,
    default_truck_type_id: user.default_truck_type_id || null,
  };
  return {
    user: formatted,
    token: signToken(formatted),
    session_expires_days: SESSION_TTL_DAYS,
  };
}

async function completeTrustedLogin(user, meta) {
  const session = await findActiveSession(user.id, meta.deviceHash);
  if (session) await touchSession(session.id);
  else await upsertSession(user.id, meta);
  return { ...issueAuthPayload(user), trusted_device: true };
}

module.exports = {
  SESSION_TTL_DAYS,
  deviceSessionsEnabled,
  hashDeviceId,
  sessionExpiresAt,
  isSessionActive,
  requestMeta,
  deviceTypeFromUa,
  findActiveSession,
  touchSession,
  upsertSession,
  revokeSession,
  revokeAllUserSessions,
  issueAuthPayload,
  completeTrustedLogin,
};
