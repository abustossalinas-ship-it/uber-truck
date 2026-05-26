'use strict';

const jsonStore = require('./store');
const supabase = require('../services/supabase');

function backend() {
  return supabase.isConfigured() ? 'supabase' : 'json';
}

async function list(collection, filters = {}) {
  if (backend() === 'supabase') {
    return supabase.list(collection, filters);
  }
  return jsonStore.list(collection, filters);
}

async function getById(collection, id) {
  if (backend() === 'supabase') {
    return supabase.getById(collection, id);
  }
  return jsonStore.getById(collection, id);
}

async function insert(collection, row) {
  if (backend() === 'supabase') {
    const { id: _id, created_at: _c, updated_at: _u, ...payload } = row;
    return supabase.insert(collection, payload);
  }
  return jsonStore.insert(collection, row);
}

async function update(collection, id, patch) {
  if (backend() === 'supabase') {
    const { created_at: _c, ...payload } = patch;
    return supabase.update(collection, id, payload);
  }
  return jsonStore.update(collection, id, patch);
}

async function findMatchPair(loadRequestId, capacityOfferId) {
  if (backend() === 'supabase') {
    return supabase.findMatchPair(loadRequestId, capacityOfferId);
  }
  const rows = await jsonStore.list('matches', {});
  return (
    rows.find(
      (m) => m.load_request_id === loadRequestId && m.capacity_offer_id === capacityOfferId
    ) || null
  );
}

module.exports = {
  backend,
  list,
  getById,
  findMatchPair,
  insert,
  update,
};
