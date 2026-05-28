'use strict';

const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

let client;

function isConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getClient() {
  if (!isConfigured()) return null;
  if (!client) {
    client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: ws },
    });
  }
  return client;
}

function rowToApi(row) {
  if (!row) return null;
  return {
    ...row,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

const MATCH_RATINGS_COLS_FULL =
  'id, match_id, rater_role, stars, comment, created_at, tags, tag_band';
const MATCH_RATINGS_COLS_BASE = 'id, match_id, rater_role, stars, comment, created_at';

async function listMatchRatings(filters = {}) {
  const sb = getClient();
  const run = (cols) => {
    let q = sb.from('match_ratings').select(cols).order('created_at', { ascending: false });
    if (filters.match_id) q = q.eq('match_id', filters.match_id);
    return q;
  };
  let { data, error } = await run(MATCH_RATINGS_COLS_FULL);
  if (error && /tags|tag_band|PGRST204|rater_user_id|schema cache/i.test(error.message || '')) {
    ({ data, error } = await run(MATCH_RATINGS_COLS_BASE));
  }
  if (error) throw error;
  return (data || []).map(rowToApi);
}

async function list(table, filters = {}) {
  if (table === 'match_ratings') return listMatchRatings(filters);
  const sb = getClient();
  const asc = table === 'trip_events';
  let q = sb.from(table).select('*').order('created_at', { ascending: asc });
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.shipper_user_id) q = q.eq('shipper_user_id', filters.shipper_user_id);
  if (filters.carrier_user_id) q = q.eq('carrier_user_id', filters.carrier_user_id);
  if (filters.match_id) q = q.eq('match_id', filters.match_id);
  if (filters.region) {
    const r = filters.region.toUpperCase();
    q = q.or(`origin_region.eq.${r},destination_region.eq.${r}`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(rowToApi);
}

async function getById(table, id) {
  const sb = getClient();
  const { data, error } = await sb.from(table).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return rowToApi(data);
}

async function findMatchPair(loadRequestId, capacityOfferId) {
  const sb = getClient();
  const { data, error } = await sb
    .from('matches')
    .select('*')
    .eq('load_request_id', loadRequestId)
    .eq('capacity_offer_id', capacityOfferId)
    .maybeSingle();
  if (error) throw error;
  return rowToApi(data);
}

async function insert(table, row) {
  const sb = getClient();
  const { data, error } = await sb.from(table).insert(row).select().single();
  if (error) throw error;
  return rowToApi(data);
}

async function update(table, id, patch) {
  const sb = getClient();
  const { data, error } = await sb.from(table).update(patch).eq('id', id).select().single();
  if (error) throw error;
  return rowToApi(data);
}

module.exports = {
  isConfigured,
  getClient,
  list,
  listMatchRatings,
  getById,
  findMatchPair,
  insert,
  update,
};
