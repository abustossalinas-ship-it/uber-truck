'use strict';

const supabase = require('./supabase');
const jsonStore = require('../lib/store');

function useJson() {
  return !supabase.isConfigured();
}

function rowToApi(row) {
  if (!row) return null;
  return {
    ...row,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    read_at: row.read_at ? new Date(row.read_at).toISOString() : null,
  };
}

function readJsonComms() {
  const store = jsonStore.readStore();
  return {
    match_messages: store.match_messages || [],
    match_notifications: store.match_notifications || [],
  };
}

function writeJsonComms(data) {
  const store = jsonStore.readStore();
  store.match_messages = data.match_messages;
  store.match_notifications = data.match_notifications;
  const fs = require('fs');
  const path = require('path');
  const STORE_PATH = path.join(__dirname, '..', '..', 'data', 'store.json');
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

async function listMessages(matchId) {
  if (useJson()) {
    const { match_messages } = readJsonComms();
    return match_messages
      .filter((m) => m.match_id === matchId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map(rowToApi);
  }
  const sb = supabase.getClient();
  const { data, error } = await sb
    .from('match_messages')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToApi);
}

async function addMessage({ match_id, sender_role, body, preset_code }) {
  const row = {
    match_id,
    sender_role,
    body: body.trim(),
    preset_code: preset_code || null,
    created_at: new Date().toISOString(),
  };
  if (useJson()) {
    const store = readJsonComms();
    row.id = `msg-${require('crypto').randomUUID().slice(0, 8)}`;
    store.match_messages.push(row);
    writeJsonComms(store);
    return rowToApi(row);
  }
  const sb = supabase.getClient();
  const { data, error } = await sb.from('match_messages').insert(row).select().single();
  if (error) throw error;
  return rowToApi(data);
}

async function listNotifications(forRole) {
  if (useJson()) {
    const { match_notifications } = readJsonComms();
    return match_notifications
      .filter((n) => n.for_role === forRole)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map(rowToApi);
  }
  const sb = supabase.getClient();
  const { data, error } = await sb
    .from('match_notifications')
    .select('*')
    .eq('for_role', forRole)
    .order('created_at', { ascending: true })
    .limit(50);
  if (error) throw error;
  return (data || []).map(rowToApi);
}

async function updateNotification(id, patch) {
  if (useJson()) {
    const store = readJsonComms();
    const n = store.match_notifications.find((x) => x.id === id);
    if (!n) return null;
    if (patch.title != null) n.title = patch.title;
    if (patch.body != null) n.body = patch.body;
    writeJsonComms(store);
    return rowToApi(n);
  }
  const sb = supabase.getClient();
  const { data, error } = await sb
    .from('match_notifications')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return rowToApi(data);
}

/**
 * Una sola notificación de precio vigente por match: actualiza el monto si ya hay una sin leer.
 */
async function notifyPriceOffer({ match_id, for_role, carrier_name, amount_clp, is_update }) {
  const amount = Number(amount_clp);
  const title = is_update ? 'Oferta de precio actualizada' : 'Nueva oferta de precio';
  const body = `${carrier_name || 'Transportista'} ofrece $${amount.toLocaleString('es-CL')} CLP.`;

  const existing = await listNotifications(for_role);
  const unreadPrice = existing.filter(
    (n) => n.match_id === match_id && n.type === 'price_offer' && !n.read_at
  );

  if (unreadPrice.length > 0) {
    const sorted = [...unreadPrice].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
    const primary = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      await markNotificationRead(sorted[i].id);
    }
    return updateNotification(primary.id, { title, body });
  }

  return addNotification({
    match_id,
    for_role,
    type: 'price_offer',
    title,
    body,
  });
}

async function addNotification({ match_id, for_role, type, title, body }) {
  const existing = await listNotifications(for_role);
  const dup = existing.find(
    (n) =>
      !n.read_at &&
      n.match_id === match_id &&
      n.type === type &&
      n.title === title
  );
  if (dup) return dup;

  const row = {
    match_id,
    for_role,
    type,
    title,
    body,
    read_at: null,
    created_at: new Date().toISOString(),
  };
  if (useJson()) {
    const store = readJsonComms();
    row.id = `ntf-${require('crypto').randomUUID().slice(0, 8)}`;
    store.match_notifications.push(row);
    writeJsonComms(store);
    return rowToApi(row);
  }
  const sb = supabase.getClient();
  const { data, error } = await sb.from('match_notifications').insert(row).select().single();
  if (error) throw error;
  return rowToApi(data);
}

async function markNotificationRead(id) {
  if (useJson()) {
    const store = readJsonComms();
    const n = store.match_notifications.find((x) => x.id === id);
    if (n) n.read_at = new Date().toISOString();
    writeJsonComms(store);
    return rowToApi(n);
  }
  const sb = supabase.getClient();
  const { data, error } = await sb
    .from('match_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return rowToApi(data);
}

async function markAllReadForMatch(forRole, matchId) {
  const now = new Date().toISOString();
  if (useJson()) {
    const store = readJsonComms();
    let marked = 0;
    for (const n of store.match_notifications) {
      if (n.for_role === forRole && n.match_id === matchId && !n.read_at) {
        n.read_at = now;
        marked += 1;
      }
    }
    if (marked) writeJsonComms(store);
    return marked;
  }
  const sb = supabase.getClient();
  const { data, error } = await sb
    .from('match_notifications')
    .update({ read_at: now })
    .eq('for_role', forRole)
    .eq('match_id', matchId)
    .is('read_at', null)
    .select('id');
  if (error) throw error;
  return (data || []).length;
}

async function unreadCount(forRole) {
  const rows = await listNotifications(forRole);
  return rows.filter((n) => !n.read_at).length;
}

module.exports = {
  listMessages,
  addMessage,
  listNotifications,
  addNotification,
  updateNotification,
  notifyPriceOffer,
  markNotificationRead,
  markAllReadForMatch,
  unreadCount,
};
