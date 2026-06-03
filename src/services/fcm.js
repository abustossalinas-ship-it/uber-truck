'use strict';

const jwt = require('jsonwebtoken');
const supabase = require('./supabase');

let cachedV1Token = null;
let cachedV1Exp = 0;

function fcmMode() {
  if (process.env.FCM_SERVICE_ACCOUNT_JSON) return 'v1';
  if (process.env.FCM_SERVER_KEY || process.env.FCM_LEGACY_SERVER_KEY) return 'legacy';
  return 'off';
}

function isConfigured() {
  return fcmMode() !== 'off';
}

function parseServiceAccount() {
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    return JSON.parse(text);
  } catch (e) {
    console.error('FCM_SERVICE_ACCOUNT_JSON inválido', e.message);
    return null;
  }
}

async function getV1AccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedV1Token && cachedV1Exp - 60 > now) return cachedV1Token;
  const sa = parseServiceAccount();
  if (!sa?.client_email || !sa?.private_key) return null;

  const assertion = jwt.sign(
    {
      iss: sa.client_email,
      sub: sa.client_email,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
    },
    sa.private_key,
    { algorithm: 'RS256' }
  );

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    console.error('FCM OAuth error', json.error || res.status);
    return null;
  }
  cachedV1Token = json.access_token;
  cachedV1Exp = now + Number(json.expires_in || 3600);
  return cachedV1Token;
}

async function sendToTokenV1(token, { title, body, data = {} }) {
  const sa = parseServiceAccount();
  if (!sa?.project_id) return { ok: false, error: 'FCM project_id missing' };
  const access = await getV1AccessToken();
  if (!access) return { ok: false, error: 'FCM OAuth failed' };

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data: Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, v == null ? '' : String(v)])
          ),
          android: { priority: 'HIGH' },
        },
      }),
    }
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: json.error?.message || 'FCM v1 error' };
  }
  return { ok: true, message_id: json.name };
}

async function sendToTokenLegacy(token, { title, body, data = {} }) {
  const key = process.env.FCM_SERVER_KEY || process.env.FCM_LEGACY_SERVER_KEY;
  if (!key || !token) return { ok: false, skipped: true };

  const res = await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: {
      Authorization: `key=${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: token,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, v == null ? '' : String(v)])
      ),
      priority: 'high',
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.failure) {
    return { ok: false, error: json.results?.[0]?.error || json.error || 'FCM legacy error' };
  }
  return { ok: true, message_id: json.message_id || json.multicast_id };
}

async function sendToToken(token, payload) {
  if (!token) return { ok: false, skipped: true };
  const mode = fcmMode();
  if (mode === 'v1') return sendToTokenV1(token, payload);
  if (mode === 'legacy') return sendToTokenLegacy(token, payload);
  return { ok: false, skipped: true, reason: 'not_configured' };
}

async function listTokensForUser(userId) {
  if (!userId || !supabase.isConfigured()) return [];
  const sb = supabase.getClient();
  const { data, error } = await sb.from('device_tokens').select('token').eq('user_id', userId);
  if (error) {
    if (error.message?.includes('device_tokens')) return [];
    throw error;
  }
  return (data || []).map((r) => r.token);
}

async function countTokensForUser(userId) {
  const tokens = await listTokensForUser(userId);
  return tokens.length;
}

async function sendPushToUser(userId, payload) {
  if (!isConfigured() || !userId) return { ok: false, skipped: true };
  const tokens = await listTokensForUser(userId);
  if (!tokens.length) return { ok: false, skipped: true, reason: 'no_tokens' };
  const results = [];
  for (const token of tokens) {
    results.push(await sendToToken(token, payload));
  }
  return { ok: results.some((r) => r.ok), results };
}

async function upsertDeviceToken(userId, token, platform = 'android') {
  if (!supabase.isConfigured()) {
    throw Object.assign(new Error('Push requiere Supabase'), { status: 503 });
  }
  const sb = supabase.getClient();
  const now = new Date().toISOString();
  const { data: existing } = await sb
    .from('device_tokens')
    .select('id')
    .eq('user_id', userId)
    .eq('token', token)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await sb
      .from('device_tokens')
      .update({ updated_at: now, platform })
      .eq('id', existing.id)
      .select('id, platform, updated_at')
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await sb
    .from('device_tokens')
    .insert({ user_id: userId, token, platform, created_at: now, updated_at: now })
    .select('id, platform, created_at')
    .single();
  if (error) throw error;
  return data;
}

async function resolveUserIdForMatchRole(repo, matchId, forRole) {
  if (!matchId || !forRole) return null;
  const match = await repo.getById('matches', matchId);
  if (!match) return null;
  const load = match.load_request_id ? await repo.getById('load_requests', match.load_request_id) : null;
  const offer = match.capacity_offer_id
    ? await repo.getById('capacity_offers', match.capacity_offer_id)
    : null;
  if (forRole === 'shipper') return load?.shipper_user_id || null;
  if (forRole === 'carrier') return offer?.carrier_user_id || null;
  return null;
}

async function pushForNotification(repo, notification) {
  if (!notification?.for_role || !notification?.match_id) return;
  const userId = await resolveUserIdForMatchRole(repo, notification.match_id, notification.for_role);
  if (!userId) return;
  await sendPushToUser(userId, {
    title: notification.title || 'Cubik',
    body: notification.body || 'Nueva actividad en tu viaje',
    data: {
      match_id: notification.match_id,
      type: notification.type || 'general',
    },
  }).catch((e) => console.error('FCM push', e.message));
}

function statusPayload() {
  return {
    configured: isConfigured(),
    mode: fcmMode(),
    project_id: parseServiceAccount()?.project_id || null,
  };
}

module.exports = {
  fcmMode,
  isConfigured,
  statusPayload,
  sendPushToUser,
  sendToToken,
  upsertDeviceToken,
  countTokensForUser,
  pushForNotification,
};
