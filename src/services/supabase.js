'use strict';

const { createClient } = require('@supabase/supabase-js');

let client;

function isConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getClient() {
  if (!isConfigured()) return null;
  if (!client) {
    client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
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

async function list(table, filters = {}) {
  const sb = getClient();
  let q = sb.from(table).select('*').order('created_at', { ascending: false });
  if (filters.status) q = q.eq('status', filters.status);
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
  getById,
  insert,
  update,
};
