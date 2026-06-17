'use strict';

const supabase = require('../services/supabase');
const { validateRut } = require('./rut-chile');

const DOC_EXPIRY_WARN_DAYS = Number(process.env.DOC_EXPIRY_WARN_DAYS || 30);

const TRACKED_DOCS = [
  { key: 'doc_ci_expires_at', label: 'Cédula de identidad', renewKey: 'ci' },
  { key: 'doc_license_expires_at', label: 'Licencia de conducir', renewKey: 'license' },
  { key: 'doc_insurance_expires_at', label: 'Seguro RC/carga', renewKey: 'insurance' },
  { key: 'doc_soap_expires_at', label: 'SOAP', renewKey: 'soap' },
];

const DOC_SELECT =
  'national_rut, doc_ci_expires_at, doc_license_expires_at, doc_insurance_expires_at, doc_soap_expires_at, docs_compliance_status, docs_compliance_checked_at';

function parseIsoDate(value) {
  if (!value) return null;
  const s = String(value).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDayUtc(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function daysUntil(date, from = startOfDayUtc()) {
  const ms = startOfDayUtc(date).getTime() - from.getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

function formatClDate(date) {
  if (!date) return '—';
  return date.toLocaleDateString('es-CL', { timeZone: 'UTC' });
}

/**
 * @param {object} user
 * @param {number} [warnDays]
 */
function evaluateDocumentCompliance(user, warnDays = DOC_EXPIRY_WARN_DAYS) {
  if (!user || user.role !== 'carrier') {
    return { status: 'unknown', expired: [], expiring: [], tracked: [], warnDays };
  }

  const today = startOfDayUtc();
  const tracked = TRACKED_DOCS.map((def) => {
    const date = parseIsoDate(user[def.key]);
    return {
      ...def,
      date,
      dateLabel: formatClDate(date),
      daysLeft: date ? daysUntil(date, today) : null,
    };
  }).filter((d) => d.date);

  if (!tracked.length) {
    return { status: 'unknown', expired: [], expiring: [], tracked: [], warnDays };
  }

  const expired = [];
  const expiring = [];
  for (const doc of tracked) {
    if (doc.daysLeft < 0) expired.push(doc);
    else if (doc.daysLeft <= warnDays) expiring.push(doc);
  }

  let status = 'valid';
  if (expired.length) status = 'expired';
  else if (expiring.length) status = 'expiring';

  return { status, expired, expiring, tracked, warnDays };
}

function docsBlockMessage(compliance) {
  if (!compliance?.expired?.length) {
    return 'Tienes documentación vencida. Actualiza por WhatsApp Cubik para volver a operar.';
  }
  const names = compliance.expired.map((d) => d.label).join(', ');
  return `Documentación vencida: ${names}. Tu cuenta está bloqueada hasta regularizar. Envía fotos actualizadas por WhatsApp Cubik (escribe *documentos*).`;
}

function validateDocDateField(value, fieldLabel) {
  if (value === undefined) return { ok: true };
  if (value === null || value === '') return { ok: true, value: null };
  const d = parseIsoDate(value);
  if (!d) return { ok: false, error: `${fieldLabel}: fecha inválida (AAAA-MM-DD)` };
  return { ok: true, value: String(value).trim().slice(0, 10) };
}

async function lookupCarrierIdentity(query) {
  if (!supabase.isConfigured()) return { found: false, reason: 'no_db' };
  const raw = String(query || '').trim();
  if (!raw) return { found: false, reason: 'empty' };

  const sb = supabase.getClient();
  const select =
    'id, email, full_name, role, company_name, phone, kyc_status, national_rut, doc_ci_expires_at, doc_license_expires_at, doc_insurance_expires_at, doc_soap_expires_at, docs_compliance_status, onboarding_doc_ci, onboarding_doc_license, onboarding_doc_soap, onboarding_doc_insurance, carrier_rubro, insurance_level, onboarding_vehicle_plates';

  if (raw.includes('@')) {
    const email = raw.toLowerCase();
    const { data, error } = await sb
      .from('users')
      .select(select)
      .eq('email', email)
      .maybeSingle();
    if (error) throw error;
    if (data?.role === 'carrier') return { found: true, user: data, matchedBy: 'email' };
    if (data) return { found: true, user: data, matchedBy: 'email', wrongRole: true };
    return { found: false, reason: 'not_found' };
  }

  const rutCheck = validateRut(raw);
  if (rutCheck.ok) {
    const { data, error } = await sb
      .from('users')
      .select(select)
      .eq('national_rut', rutCheck.rut)
      .maybeSingle();
    if (error) throw error;
    if (data?.role === 'carrier') return { found: true, user: data, matchedBy: 'rut' };
    if (data) return { found: true, user: data, matchedBy: 'rut', wrongRole: true };
    return { found: false, reason: 'not_found', rut: rutCheck.rut };
  }

  const name = raw.replace(/\s+/g, ' ').slice(0, 80);
  if (name.length >= 3) {
    const { data, error } = await sb
      .from('users')
      .select(select)
      .eq('role', 'carrier')
      .ilike('full_name', `%${name}%`)
      .limit(5);
    if (error) throw error;
    const rows = data || [];
    if (rows.length === 1) return { found: true, user: rows[0], matchedBy: 'name' };
    if (rows.length > 1) return { found: false, reason: 'ambiguous', count: rows.length };
  }

  return { found: false, reason: 'invalid_query' };
}

async function syncUserDocumentCompliance(userId, userRow) {
  if (!userId || !supabase.isConfigured()) return null;
  const sb = supabase.getClient();
  let user = userRow;
  if (!user) {
    const { data, error } = await sb
      .from('users')
      .select(`id, role, ${DOC_SELECT}`)
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    user = data;
  }
  if (!user || user.role !== 'carrier') return null;

  const compliance = evaluateDocumentCompliance(user);
  const now = new Date().toISOString();
  const { error: updErr } = await sb
    .from('users')
    .update({
      docs_compliance_status: compliance.status,
      docs_compliance_checked_at: now,
    })
    .eq('id', userId);
  if (updErr) throw updErr;

  await ensureDocumentNotifications(userId, compliance);
  return compliance;
}

async function ensureDocumentNotifications(userId, compliance) {
  if (!supabase.isConfigured()) return;
  const sb = supabase.getClient();

  if (compliance.status === 'expired' && compliance.expired.length) {
    const names = compliance.expired.map((d) => d.label).join(', ');
    await upsertUserNotification(sb, userId, {
      type: 'doc_expired',
      title: 'Documentación vencida — cuenta bloqueada',
      body: `${names} venció. Solo puedes actualizar documentos por WhatsApp Cubik hasta regularizar.`,
      priority: 'important',
    });
    return;
  }

  if (compliance.status === 'expiring' && compliance.expiring.length) {
    const lines = compliance.expiring
      .map((d) => `${d.label} (${d.dateLabel}, ${d.daysLeft} días)`)
      .join(' · ');
    await upsertUserNotification(sb, userId, {
      type: 'doc_expiring',
      title: 'Documentación por vencer',
      body: lines,
      priority: 'important',
    });
    return;
  }

  await clearOpenDocNotifications(sb, userId);
}

async function upsertUserNotification(sb, userId, { type, title, body, priority }) {
  const { data: existing } = await sb
    .from('user_notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('type', type)
    .is('read_at', null)
    .maybeSingle();

  if (existing?.id) {
    await sb
      .from('user_notifications')
      .update({ title, body, priority, created_at: new Date().toISOString() })
      .eq('id', existing.id);
    return;
  }

  await sb.from('user_notifications').insert({
    user_id: userId,
    type,
    title,
    body,
    priority,
  });
}

async function clearOpenDocNotifications(sb, userId) {
  await sb
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .in('type', ['doc_expiring', 'doc_expired'])
    .is('read_at', null);
}

async function listUserNotifications(userId, limit = 20) {
  if (!userId || !supabase.isConfigured()) return [];
  const sb = supabase.getClient();
  const { data, error } = await sb
    .from('user_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

module.exports = {
  DOC_EXPIRY_WARN_DAYS,
  DOC_SELECT,
  TRACKED_DOCS,
  parseIsoDate,
  evaluateDocumentCompliance,
  docsBlockMessage,
  validateDocDateField,
  lookupCarrierIdentity,
  syncUserDocumentCompliance,
  listUserNotifications,
  formatClDate,
};
