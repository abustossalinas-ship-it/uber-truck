'use strict';

const repo = require('./repository');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_DIGITS_MIN = 9;

function normalizeRole(raw) {
  const r = String(raw || '')
    .toLowerCase()
    .trim();
  if (r === 'carrier' || r === 'transportista') return 'carrier';
  if (r === 'shipper' || r === 'empresa' || r === 'embarcador') return 'shipper';
  return null;
}

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('56')) return digits.slice(2);
  if (digits.length === 9 && digits.startsWith('9')) return digits;
  return digits;
}

function normalizeTools(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((t) => String(t).trim()).filter(Boolean).slice(0, 12);
  }
  return String(raw)
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function validatePayload(body) {
  const role = normalizeRole(body?.role);
  if (!role) return { error: 'Rol inválido (carrier o shipper).' };

  const full_name = String(body?.full_name || '').trim();
  const email = String(body?.email || '')
    .trim()
    .toLowerCase();
  const company_name = String(body?.company_name || '').trim();
  const phone = normalizePhone(body?.phone);
  const team_size_raw = body?.team_size;
  const team_size =
    team_size_raw === '' || team_size_raw == null ? null : Number.parseInt(String(team_size_raw), 10);
  const monthly_volume = String(body?.monthly_volume || '').trim();
  const source_page = String(body?.source_page || '').trim().slice(0, 200) || null;

  if (full_name.length < 2) return { error: 'Ingresa tu nombre.' };
  if (!EMAIL_RE.test(email)) return { error: 'Correo inválido.' };
  if (company_name.length < 2) return { error: 'Ingresa el nombre de tu empresa o flota.' };
  if (phone.length < PHONE_DIGITS_MIN) return { error: 'WhatsApp inválido (mínimo 9 dígitos).' };
  if (team_size != null && (!Number.isFinite(team_size) || team_size < 1 || team_size > 500000)) {
    return { error: 'Tamaño de equipo inválido.' };
  }
  if (monthly_volume.length < 1) return { error: 'Indica tu volumen mensual aproximado.' };

  return {
    row: {
      role,
      source_page,
      full_name,
      email,
      company_name,
      phone: `+56${phone}`,
      team_size,
      monthly_volume,
      current_tools: normalizeTools(body?.current_tools),
      status: 'new',
    },
  };
}

async function createProspecto(body) {
  const parsed = validatePayload(body);
  if (parsed.error) {
    const err = new Error(parsed.error);
    err.statusCode = 400;
    throw err;
  }
  return repo.insert('prospectos', parsed.row);
}

const { WELCOME: WHATSAPP_MESSAGES } = require('./whatsapp-copy');

const DEFAULT_WHATSAPP_E164 = '56971419384';

/** E.164 digits only — no fuerza +56 si ya trae código de país (ej. Meta test +1). */
function normalizeWhatsAppE164(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('56') && digits.length >= 11) return digits;
  if (digits.startsWith('1') && digits.length === 11) return digits;
  if (digits.length === 9 && digits.startsWith('9')) return `56${digits}`;
  if (digits.length === 10) return `1${digits}`;
  return digits;
}

async function listProspectos(filters = {}) {
  return repo.list('prospectos', filters);
}

function whatsappConfig() {
  const e164 = normalizeWhatsAppE164(
    process.env.CUBIK_WHATSAPP_E164 || process.env.CUBIK_WHATSAPP_NUMBER || DEFAULT_WHATSAPP_E164
  );
  const cloudEnabled = String(process.env.WHATSAPP_CLOUD_ENABLED || '').toLowerCase() === 'true';
  return {
    configured: Boolean(e164),
    e164,
    messages: WHATSAPP_MESSAGES,
    bot: cloudEnabled,
  };
}

function buildWhatsAppUrl(role, e164) {
  const cfg = whatsappConfig();
  const digits = String(e164 || cfg.e164).replace(/\D/g, '');
  if (!digits) return null;
  const msg = cfg.messages[normalizeRole(role) || 'shipper'] || cfg.messages.shipper;
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
}

module.exports = {
  validatePayload,
  createProspecto,
  listProspectos,
  whatsappConfig,
  buildWhatsAppUrl,
  normalizeRole,
};
