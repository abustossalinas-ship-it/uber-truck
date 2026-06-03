'use strict';

const supabase = require('./supabase');

function isConfigured() {
  return Boolean(process.env.FCM_SERVER_KEY || process.env.FCM_LEGACY_SERVER_KEY);
}

async function sendToToken(token, { title, body, data = {} }) {
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
    return { ok: false, error: json.results?.[0]?.error || json.error || 'FCM error' };
  }
  return { ok: true, message_id: json.message_id || json.multicast_id };
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

module.exports = {
  isConfigured,
  sendPushToUser,
  upsertDeviceToken,
  pushForNotification,
};
