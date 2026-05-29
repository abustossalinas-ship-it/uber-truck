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
    if ('amount_clp' in patch) n.amount_clp = patch.amount_clp;
    if ('previous_amount_clp' in patch) n.previous_amount_clp = patch.previous_amount_clp;
    if ('previous_at' in patch) n.previous_at = patch.previous_at;
    writeJsonComms(store);
    return rowToApi(n);
  }
  const sb = supabase.getClient();
  const row = { ...patch };
  if (patch.previous_at === null) row.previous_at = null;
  const { data, error } = await sb
    .from('match_notifications')
    .update(row)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return rowToApi(data);
}

function formatOfferBody({ carrier_name, amount_clp, previous_amount_clp, is_update }) {
  const display = buildPriceOfferDisplay({
    carrier_name,
    amount_clp,
    previous_amount_clp,
    previous_at: null,
    offered_at: new Date().toISOString(),
    is_update,
  });
  return display.body;
}

/** Líneas estructuradas para UI (montos y fechas congelados por notificación). */
function buildPriceOfferDisplay({
  carrier_name,
  amount_clp,
  previous_amount_clp,
  previous_at,
  offered_at,
  is_update,
}) {
  const name = carrier_name || 'Transportista';
  const amount = amount_clp != null ? Number(amount_clp) : null;
  const prev = previous_amount_clp != null ? Number(previous_amount_clp) : null;
  const offeredAt = offered_at || null;
  const prevAt = previous_at || null;

  const offer_lines = [];
  if (is_update && prev != null && amount != null && prev !== amount) {
    if (prevAt) {
      offer_lines.push({
        label: 'Oferta anterior',
        amount_clp: prev,
        at: prevAt,
      });
    }
    offer_lines.push({
      label: 'Oferta nueva',
      amount_clp: amount,
      at: offeredAt,
    });
    const prevPart = prevAt
      ? `anterior $${prev.toLocaleString('es-CL')} (${formatOfferWhen(prevAt)})`
      : `anterior $${prev.toLocaleString('es-CL')}`;
    const newPart = offeredAt
      ? `nueva $${amount.toLocaleString('es-CL')} (${formatOfferWhen(offeredAt)})`
      : `nueva $${amount.toLocaleString('es-CL')}`;
    return {
      offer_lines,
      body: `${name} actualizó la oferta: ${prevPart} → ${newPart} CLP.`,
    };
  }
  if (amount != null) {
    offer_lines.push({
      label: 'Oferta',
      amount_clp: amount,
      at: offeredAt,
    });
  }
  const when = offeredAt ? ` (${formatOfferWhen(offeredAt)})` : '';
  return {
    offer_lines,
    body: amount != null ? `${name} ofrece $${amount.toLocaleString('es-CL')} CLP${when}.` : `${name} envió una oferta de precio.`,
  };
}

function formatOfferWhen(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function resolvePriceOfferFromEvents(n, match, events) {
  const list = events || [];
  const created = list.find((e) => e.event_type === 'match_created');
  const updates = list.filter((e) => e.event_type === 'carrier_offer_updated');
  const lastUpd = updates[updates.length - 1];

  let amount = n.amount_clp != null ? Number(n.amount_clp) : null;
  let previous = n.previous_amount_clp != null ? Number(n.previous_amount_clp) : null;
  let previous_at = n.previous_at || null;
  const offered_at = n.created_at;
  const isUpdate = n.title?.includes('actualizada') || previous != null;

  if (amount == null) {
    if (n.title?.includes('Nueva')) {
      amount =
        created?.payload?.carrier_offer_clp != null
          ? Number(created.payload.carrier_offer_clp)
          : lastUpd?.payload?.previous_offer_clp != null
            ? Number(lastUpd.payload.previous_offer_clp)
            : match?.carrier_offer_clp != null
              ? Number(match.carrier_offer_clp)
              : null;
    } else if (isUpdate) {
      amount =
        lastUpd?.payload?.carrier_offer_clp != null
          ? Number(lastUpd.payload.carrier_offer_clp)
          : match?.carrier_offer_clp != null
            ? Number(match.carrier_offer_clp)
            : null;
    } else {
      amount = match?.carrier_offer_clp != null ? Number(match.carrier_offer_clp) : null;
    }
  }

  if (previous == null && isUpdate) {
    previous =
      lastUpd?.payload?.previous_offer_clp != null
        ? Number(lastUpd.payload.previous_offer_clp)
        : null;
  }

  if (!previous_at && previous != null) {
    previous_at = created?.created_at || (updates[0] ? updates[0].created_at : null);
  }

  return {
    amount_clp: amount,
    previous_amount_clp: previous,
    previous_at,
    offered_at,
    is_update: isUpdate && previous != null && amount != null && previous !== amount,
  };
}

function enrichPriceOfferNotification(n, match, events, carrier_name) {
  const resolved = resolvePriceOfferFromEvents(n, match, events);
  const display = buildPriceOfferDisplay({
    carrier_name,
    amount_clp: resolved.amount_clp,
    previous_amount_clp: resolved.previous_amount_clp,
    previous_at: resolved.previous_at,
    offered_at: resolved.offered_at,
    is_update: resolved.is_update,
  });
  return {
    ...n,
    amount_clp: resolved.amount_clp,
    previous_amount_clp: resolved.previous_amount_clp,
    previous_at: resolved.previous_at,
    body: display.body,
    offer_lines: display.offer_lines,
  };
}

async function notifyPriceOffer({
  match_id,
  for_role,
  carrier_name,
  amount_clp,
  previous_amount_clp,
  is_update,
}) {
  const title = is_update ? 'Oferta de precio actualizada' : 'Nueva oferta de precio';
  const now = new Date().toISOString();

  const existing = (await listNotifications(for_role)).filter(
    (n) => n.match_id === match_id && n.type === 'price_offer'
  );

  let previous_at = null;
  if (is_update && previous_amount_clp != null) {
    const first = [...existing].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    )[0];
    previous_at = first?.created_at || null;
    const display = buildPriceOfferDisplay({
      carrier_name,
      amount_clp,
      previous_amount_clp,
      previous_at,
      offered_at: now,
      is_update: true,
    });
    return addNotification({
      match_id,
      for_role,
      type: 'price_offer',
      title,
      body: display.body,
      amount_clp,
      previous_amount_clp,
      previous_at,
    });
  }

  const unreadPrice = existing.filter((n) => !n.read_at);
  if (unreadPrice.length > 0) {
    const primary = unreadPrice.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    )[0];
    const body = formatOfferBody({
      carrier_name,
      amount_clp,
      previous_amount_clp: null,
      is_update: false,
    });
    return updateNotification(primary.id, {
      title,
      body,
      amount_clp,
      previous_amount_clp: null,
      previous_at: null,
    });
  }

  const body = formatOfferBody({
    carrier_name,
    amount_clp,
    previous_amount_clp: null,
    is_update: false,
  });
  return addNotification({
    match_id,
    for_role,
    type: 'price_offer',
    title,
    body,
    amount_clp,
    previous_at: null,
    previous_amount_clp: null,
  });
}

async function addNotification({
  match_id,
  for_role,
  type,
  title,
  body,
  amount_clp = null,
  previous_amount_clp = null,
  previous_at = null,
}) {
  const existing = await listNotifications(for_role);
  const dup = existing.find(
    (n) =>
      !n.read_at &&
      n.match_id === match_id &&
      n.type === type &&
      n.title === title &&
      type !== 'price_offer'
  );
  if (dup) return dup;

  const row = {
    match_id,
    for_role,
    type,
    title,
    body,
    amount_clp: amount_clp != null ? Number(amount_clp) : null,
    previous_amount_clp: previous_amount_clp != null ? Number(previous_amount_clp) : null,
    previous_at: previous_at || null,
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
  formatOfferBody,
  buildPriceOfferDisplay,
  enrichPriceOfferNotification,
  markNotificationRead,
  markAllReadForMatch,
  unreadCount,
};
