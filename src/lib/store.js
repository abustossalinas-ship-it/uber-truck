'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

const EMPTY = {
  load_requests: [],
  capacity_offers: [],
  matches: [],
  match_messages: [],
  match_notifications: [],
};

const SEED = {
  load_requests: [
    {
      id: 'lr-demo-001',
      company_name: 'Distribuidora PYME (demo)',
      origin_city: 'San Bernardo',
      origin_region: 'RM',
      destination_city: 'Valparaíso',
      destination_region: 'V',
      volume_m3: 4,
      pallets: 2,
      cargo_type: 'Alimentos secos',
      urgency: 'urgent',
      needed_by: null,
      status: 'published',
      notes: 'Pedido extra del mes; evitar cotizar camión dedicado.',
      created_at: new Date().toISOString(),
    },
  ],
  capacity_offers: [
    {
      id: 'co-demo-001',
      carrier_name: 'Transportes Ruta Sur (demo)',
      origin_city: 'Santiago',
      origin_region: 'RM',
      destination_city: 'Valparaíso',
      destination_region: 'V',
      free_volume_m3: 8,
      max_weight_kg: 3500,
      cargo_types: 'Alimentos, retail',
      available_from: null,
      available_until: null,
      status: 'published',
      notes: 'Retorno con cubicación libre.',
      created_at: new Date().toISOString(),
    },
  ],
  matches: [],
};

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore() {
  ensureDir();
  if (!fs.existsSync(STORE_PATH)) {
    const initial = structuredClone(SEED);
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const data = JSON.parse(raw);
    return {
      load_requests: data.load_requests || [],
      capacity_offers: data.capacity_offers || [],
      matches: data.matches || [],
      match_messages: data.match_messages || [],
      match_notifications: data.match_notifications || [],
    };
  } catch {
    return structuredClone(EMPTY);
  }
}

function writeStore(data) {
  ensureDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function newId(prefix) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function list(collection, filters = {}) {
  const store = readStore();
  let rows = store[collection] || [];
  if (filters.region) {
    const r = filters.region.toUpperCase();
    rows = rows.filter(
      (row) =>
        (row.origin_region || '').toUpperCase() === r ||
        (row.destination_region || '').toUpperCase() === r
    );
  }
  if (filters.status) {
    rows = rows.filter((row) => row.status === filters.status);
  }
  return rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function getById(collection, id) {
  const store = readStore();
  return (store[collection] || []).find((row) => row.id === id) || null;
}

function insert(collection, row) {
  const store = readStore();
  const item = {
    ...row,
    id: row.id || newId(collection === 'load_requests' ? 'lr' : collection === 'capacity_offers' ? 'co' : 'mt'),
    created_at: row.created_at || new Date().toISOString(),
  };
  store[collection].push(item);
  writeStore(store);
  return item;
}

function update(collection, id, patch) {
  const store = readStore();
  const idx = (store[collection] || []).findIndex((row) => row.id === id);
  if (idx === -1) return null;
  store[collection][idx] = { ...store[collection][idx], ...patch, updated_at: new Date().toISOString() };
  writeStore(store);
  return store[collection][idx];
}

module.exports = {
  list,
  getById,
  insert,
  update,
  readStore,
};
