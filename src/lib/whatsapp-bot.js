'use strict';

const { WELCOME, MENU, HUMAN, FAQ, GENERIC } = require('./whatsapp-copy');

const HUMAN_RE =
  /\b(humano|persona|ejecutivo|agente|soporte|hablar con|quiero hablar|atenci[oó]n)\b/i;
const ESCALATE_RE =
  /\b(robo|daño|dañado|faltante|disputa|bloquead|no puedo entrar|reclamo|demanda)\b/i;
const PRICE_RE = /\b(precio|cu[aá]nto sale|costo|tarifa|comisi[oó]n)\b/i;
const REGISTER_RE = /\b(registro|registr|cuenta|crear cuenta|inscrib)\b/i;
const DEMO_RE = /\b(demo|agendar|reuni[oó]n|presentaci[oó]n)\b/i;
const TECH_RE = /\b(error|bug|no carga|pantalla|olvid[eé]|contraseña|password)\b/i;

/** @typedef {{ role: 'shipper'|'carrier'|null, welcomed: boolean, awaitingHuman: boolean, updatedAt: number }} Session */

/** @type {Map<string, Session>} */
const sessions = new Map();

/** @type {Map<string, number>} */
const seenMessageIds = new Map();

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEDUPE_TTL_MS = 24 * 60 * 60 * 1000;

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('56')) return digits.slice(2);
  return digits;
}

function detectRoleFromText(text) {
  const t = String(text || '').toLowerCase();
  if (/\bsoy\s+empresa\b|encontrar transportistas|publicar cargas|mover tu carga/.test(t)) {
    return 'shipper';
  }
  if (/\bsoy\s+transportista\b/.test(t)) return 'carrier';
  if (
    /\btransportistas?\b|\bcamion\b|\bcamión\b|\bflota\b|\bruta\b|ofertar|viajes vac|rentabilidad/.test(
      t
    ) ||
    /oportunidades de carga|cargas disponibles|emparejar viajes/.test(t)
  ) {
    return 'carrier';
  }
  if (/empresa|embarcador|env[ií]os|log[ií]stica/.test(t)) return 'shipper';
  return null;
}

function roleOf(session) {
  return session.role === 'carrier' ? 'carrier' : 'shipper';
}

function getSession(phone) {
  const key = normalizePhone(phone);
  const existing = sessions.get(key);
  if (existing && Date.now() - existing.updatedAt > SESSION_TTL_MS) {
    sessions.delete(key);
  }
  if (!sessions.has(key)) {
    sessions.set(key, {
      role: null,
      welcomed: false,
      awaitingHuman: false,
      updatedAt: Date.now(),
    });
  }
  const session = sessions.get(key);
  session.updatedAt = Date.now();
  return session;
}

function pruneDedupe() {
  const now = Date.now();
  for (const [id, ts] of seenMessageIds) {
    if (now - ts > DEDUPE_TTL_MS) seenMessageIds.delete(id);
  }
}

function isDuplicateMessageId(id) {
  if (!id) return false;
  pruneDedupe();
  if (seenMessageIds.has(id)) return true;
  seenMessageIds.set(id, Date.now());
  return false;
}

function parseMenuChoice(body) {
  const t = String(body || '').trim();
  if (/^[1-5]$/.test(t)) return t;
  const emoji = t.match(/^([1-5])\s*️⃣\s*$/u);
  if (emoji) return emoji[1];
  return null;
}

function pickFaq(session, token) {
  const role = roleOf(session);
  const map = FAQ[role];
  const key = String(token || '').trim();
  if (map[key]) return map[key];
  return null;
}

/**
 * @param {string} text
 * @param {Session} session
 * @returns {string[]}
 */
function buildReplies(text, session) {
  const body = String(text || '').trim();
  const lower = body.toLowerCase();
  const replies = [];

  if (!session.role) {
    const detected = detectRoleFromText(body);
    if (detected) session.role = detected;
  }

  if (ESCALATE_RE.test(lower) || HUMAN_RE.test(lower)) {
    session.awaitingHuman = true;
    replies.push(HUMAN[roleOf(session)]);
    return replies;
  }

  if (session.awaitingHuman) {
    replies.push(
      'Gracias. Un agente de Cubik revisará tu mensaje en horario hábil (Chile). Mientras tanto puedes usar getcubik.cl/app'
    );
    return replies;
  }

  if (!session.welcomed) {
    const role = session.role || detectRoleFromText(body) || 'shipper';
    session.role = role;
    session.welcomed = true;
    replies.push(WELCOME[role], MENU[role]);
    return replies;
  }

  const menuChoice = parseMenuChoice(body);
  if (menuChoice) {
    const ans = pickFaq(session, menuChoice);
    if (ans) {
      replies.push(ans, MENU[roleOf(session)]);
      return replies;
    }
  }

  if (PRICE_RE.test(lower)) {
    replies.push(GENERIC.price);
    return replies;
  }
  if (REGISTER_RE.test(lower)) {
    replies.push(GENERIC.register);
    return replies;
  }
  if (DEMO_RE.test(lower)) {
    replies.push(GENERIC.demo);
    return replies;
  }
  if (TECH_RE.test(lower)) {
    replies.push(GENERIC.tech);
    return replies;
  }

  if (/^(hola|buenas|buenos|hi|hello)\b/i.test(lower) || lower === 'menu' || lower === 'menú') {
    replies.push(MENU[roleOf(session)]);
    return replies;
  }

  if (ESCALATE_RE.test(lower)) {
    replies.push(GENERIC.escalate);
    return replies;
  }

  replies.push(
    'No estoy seguro de entender. Elige una opción del menú (1–5) o escribe *humano* para un ejecutivo.',
    MENU[roleOf(session)]
  );
  return replies;
}

/**
 * @param {{ from: string, text: string, messageId?: string }} inbound
 * @returns {{ replies: string[], session: Session, skipped: boolean }}
 */
function handleInbound(inbound) {
  if (isDuplicateMessageId(inbound.messageId)) {
    return { replies: [], session: getSession(inbound.from), skipped: true };
  }
  const session = getSession(inbound.from);
  const replies = buildReplies(inbound.text, session);
  return { replies, session, skipped: false };
}

function resetSessionsForTests() {
  sessions.clear();
  seenMessageIds.clear();
}

module.exports = {
  handleInbound,
  detectRoleFromText,
  getSession,
  resetSessionsForTests,
  normalizePhone,
};
