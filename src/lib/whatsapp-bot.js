'use strict';

const {
  WELCOME,
  MENU,
  HUMAN,
  FAQ,
  GENERIC,
  ONBOARDING_DOCS,
  DOCS_ROLE_PICK,
  identityPrompt,
  identityNotFound,
  identityAmbiguous,
  identityWrongRole,
  carrierPendingDocsMessage,
  carrierApprovedDocsMessage,
  carrierExpiredDocsMessage,
  docRenewInstruction,
  mediaReceivedAck,
  mediaReceivedNeedIdentity,
} = require('./whatsapp-copy');
const { evaluateDocumentCompliance } = require('./carrier-documents');
const { isDocumentOcrEnabled } = require('./document-ocr');

const HUMAN_RE =
  /\b(humano|persona|ejecutivo|agente|soporte|hablar con|quiero hablar|atenci[oó]n)\b/i;
const ESCALATE_RE =
  /\b(robo|daño|dañado|faltante|disputa|bloquead|no puedo entrar|reclamo|demanda)\b/i;
const PRICE_RE = /\b(precio|cu[aá]nto sale|costo|tarifa|comisi[oó]n)\b/i;
const REGISTER_RE = /\b(registro|registr|cuenta|crear cuenta|inscrib)\b/i;
const DEMO_RE = /\b(demo|agendar|reuni[oó]n|presentaci[oó]n)\b/i;
const TECH_RE = /\b(error|bug|no carga|pantalla|olvid[eé]|contraseña|password)\b/i;
const DOCS_MENU_RE =
  /\b(documentos|documentaci[oó]n|papeles|validar cuenta|enviar foto)\b/i;
const DOCS_RE = DOCS_MENU_RE;
const RESET_RE =
  /\b(volver|inicio|reiniciar|cerrar|cancelar|empezar de nuevo|salir|menu documentos)\b/i;
const RENEW_CI_RE = /\b(ci|c[eé]dula|carnet)\b/i;
const RENEW_LICENSE_RE = /\blicencia\b/i;
const RENEW_INSURANCE_RE = /\b(seguro|p[oó]liza|rc)\b/i;
const RENEW_SOAP_RE = /\bsoap\b/i;

const DOCS_INTENT_HINT = `Para *documentos* responde *soy transportista*, envía tu *RUT* / *email*, o escribe *volver* para reiniciar.`;

/** @typedef {{ role: 'shipper'|'carrier'|null, welcomed: boolean, awaitingHuman: boolean, docsIntent: boolean, awaitingIdentity: boolean, linkedUser: object|null, uploadTarget: string|null, receivedMediaCount: number, updatedAt: number }} Session */

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
  if (/\bsoy\s+tr[a-z]*ns?portista\b/.test(t)) return 'carrier';
  if (/\btransportista\b/.test(t) && !/\bempresa\b/.test(t)) return 'carrier';
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

function resetSession(session) {
  session.role = null;
  session.welcomed = false;
  session.awaitingHuman = false;
  session.docsIntent = false;
  session.awaitingIdentity = false;
  session.linkedUser = null;
  session.uploadTarget = null;
  session.receivedMediaCount = 0;
}

function restartDocumentFlow(session) {
  session.awaitingHuman = false;
  session.awaitingIdentity = false;
  session.linkedUser = null;
  session.uploadTarget = null;
  session.receivedMediaCount = 0;
  session.docsIntent = true;
  session.welcomed = false;
  session.role = null;
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
      docsIntent: false,
      awaitingIdentity: false,
      linkedUser: null,
      uploadTarget: null,
      receivedMediaCount: 0,
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
  if (/^[1-6]$/.test(t)) return t;
  const emoji = t.match(/^([1-6])\s*️⃣\s*$/u);
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

function startCarrierIdentityFlow(session) {
  session.role = 'carrier';
  session.awaitingIdentity = true;
  session.docsIntent = false;
  session.welcomed = true;
}

async function runIdentityLookup(body, session, lookup) {
  const result = await lookup(body);
  session.awaitingIdentity = false;
  if (!result.found) {
    if (result.reason === 'ambiguous') {
      session.awaitingIdentity = true;
      return [identityAmbiguous(result.count)];
    }
    session.awaitingIdentity = true;
    return [identityNotFound()];
  }
  if (result.wrongRole) {
    return [identityWrongRole()];
  }
  session.linkedUser = result.user;
  session.role = 'carrier';
  return repliesForLinkedCarrier(result.user);
}

function repliesForLinkedCarrier(user) {
  const compliance = evaluateDocumentCompliance(user);
  if (compliance.status === 'expired') {
    return [carrierExpiredDocsMessage(user, compliance)];
  }
  if (user.kyc_status === 'approved') {
    return [carrierApprovedDocsMessage(user, compliance)];
  }
  if (user.kyc_status === 'rejected') {
    return [
      `Tu cuenta (${user.email}) fue *rechazada*. Escribe *humano* si crees que es un error.`,
    ];
  }
  return [carrierPendingDocsMessage(user)];
}

function parseRenewalKind(lower) {
  const t = normalizeDocText(lower);
  if (RENEW_CI_RE.test(t)) return 'ci';
  if (RENEW_LICENSE_RE.test(t)) return 'license';
  if (RENEW_INSURANCE_RE.test(t)) return 'insurance';
  if (RENEW_SOAP_RE.test(t)) return 'soap';
  return null;
}

function normalizeDocText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/actuali\s*,\s*ar/gi, 'actualizar')
    .replace(/\s+/g, ' ')
    .trim();
}

function repliesForDocRenewal(session, kind) {
  session.uploadTarget = kind;
  session.role = 'carrier';
  session.welcomed = true;
  session.docsIntent = false;
  session.awaitingIdentity = false;
  return [docRenewInstruction(kind)];
}

function uploadLabel(kind) {
  if (kind === 'ci') return 'cédula (CI)';
  if (kind === 'license') return 'licencia de conducir';
  if (kind === 'insurance') return 'póliza de seguro';
  if (kind === 'soap') return 'SOAP';
  return 'documento';
}

function inDocumentUploadContext(session) {
  return Boolean(
    session.linkedUser ||
      session.awaitingIdentity ||
      session.docsIntent ||
      session.uploadTarget ||
      session.role === 'carrier'
  );
}

function buildMediaReplies(inbound, session) {
  const caption = String(inbound.caption || inbound.text || '').toLowerCase();
  const kindFromCaption = parseRenewalKind(caption);
  if (kindFromCaption) session.uploadTarget = kindFromCaption;

  if (!inDocumentUploadContext(session)) {
    return [mediaReceivedNeedIdentity()];
  }

  session.receivedMediaCount = (session.receivedMediaCount || 0) + 1;
  const kind = session.uploadTarget || kindFromCaption;
  return [
    mediaReceivedAck({
      label: uploadLabel(kind),
      count: session.receivedMediaCount,
      uploadTarget: kind,
      ocrPending: Boolean(session.linkedUser && isDocumentOcrEnabled()),
    }),
  ];
}

/**
 * @param {string} text
 * @param {Session} session
 * @param {{ lookupCarrierIdentity?: (q: string) => Promise<object> }} [deps]
 * @returns {Promise<string[]>}
 */
async function buildReplies(text, session, deps = {}) {
  const lookup = deps.lookupCarrierIdentity || null;
  const body = String(text || '').trim();
  const lower = normalizeDocText(body);
  const replies = [];
  const detectedRole = detectRoleFromText(body);

  if (RESET_RE.test(lower)) {
    restartDocumentFlow(session);
    replies.push(DOCS_ROLE_PICK);
    return replies;
  }

  if (ESCALATE_RE.test(lower) || HUMAN_RE.test(lower)) {
    session.awaitingHuman = true;
    session.awaitingIdentity = false;
    replies.push(HUMAN[roleOf(session)]);
    return replies;
  }

  if (session.awaitingHuman) {
    replies.push(
      'Gracias. Un agente de Cubik revisará tu mensaje en horario hábil (Chile). Mientras tanto puedes usar getcubik.cl/app'
    );
    return replies;
  }

  if (session.linkedUser) {
    const renew = parseRenewalKind(lower);
    if (renew) {
      return repliesForDocRenewal(session, renew);
    }
    if (/\bactualiz(ar|a)\b/i.test(lower)) {
      return repliesForLinkedCarrier(session.linkedUser);
    }
  }

  if (DOCS_MENU_RE.test(lower)) {
    if (session.linkedUser) {
      session.role = 'carrier';
      session.docsIntent = false;
      session.awaitingIdentity = false;
      session.welcomed = true;
      return repliesForLinkedCarrier(session.linkedUser);
    }
    const preferCarrier = detectedRole === 'carrier' || session.role === 'carrier';
    restartDocumentFlow(session);
    if (preferCarrier && lookup) {
      startCarrierIdentityFlow(session);
      replies.push(identityPrompt());
      return replies;
    }
    replies.push(DOCS_ROLE_PICK);
    return replies;
  }

  if (detectedRole === 'carrier' && (session.docsIntent || !session.welcomed || session.role === 'shipper')) {
    session.role = 'carrier';
    if (lookup) {
      startCarrierIdentityFlow(session);
      replies.push(identityPrompt());
      return replies;
    }
  }

  if (session.awaitingIdentity && lookup) {
    try {
      return await runIdentityLookup(body, session, lookup);
    } catch (_e) {
      replies.push('No pudimos validar tu cuenta ahora. Intenta de nuevo o escribe *humano*.');
      return replies;
    }
  }

  if (!session.linkedUser && parseRenewalKind(lower)) {
    session.uploadTarget = parseRenewalKind(lower);
    session.role = session.role || 'carrier';
    if (lookup) {
      startCarrierIdentityFlow(session);
      replies.push(
        docRenewInstruction(session.uploadTarget),
        'Antes de enviar la foto, confirma tu cuenta con *RUT* o *email* de la app.'
      );
      return replies;
    }
    replies.push(docRenewInstruction(session.uploadTarget));
    return replies;
  }

  if (!session.welcomed) {
    if (session.docsIntent) {
      if (detectedRole === 'shipper') {
        session.role = 'shipper';
        session.welcomed = true;
        session.docsIntent = false;
        replies.push(ONBOARDING_DOCS.shipper);
        return replies;
      }
      if (detectedRole === 'carrier') {
        session.role = 'carrier';
        if (lookup) {
          startCarrierIdentityFlow(session);
          replies.push(identityPrompt());
          return replies;
        }
      }
      if (lookup && body.length >= 3) {
        session.role = 'carrier';
        session.awaitingIdentity = true;
        session.welcomed = true;
        try {
          return await runIdentityLookup(body, session, lookup);
        } catch (_e) {
          replies.push('No pudimos validar tu cuenta ahora. Intenta de nuevo o escribe *volver*.');
          return replies;
        }
      }
      replies.push(DOCS_INTENT_HINT, DOCS_ROLE_PICK);
      return replies;
    }

    if (detectedRole) session.role = detectedRole;
    const role = session.role || detectedRole || 'shipper';
    session.role = role;
    session.welcomed = true;
    replies.push(WELCOME[role], MENU[role]);
    return replies;
  }

  if (detectedRole === 'carrier' && session.role !== 'carrier') {
    session.role = 'carrier';
    if (lookup) {
      startCarrierIdentityFlow(session);
      replies.push(identityPrompt());
      return replies;
    }
  }

  const menuChoice = parseMenuChoice(body);
  if (menuChoice) {
    if (menuChoice === '6' && roleOf(session) === 'carrier' && lookup) {
      startCarrierIdentityFlow(session);
      replies.push(identityPrompt());
      return replies;
    }
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
    if (roleOf(session) === 'carrier' && lookup) {
      startCarrierIdentityFlow(session);
      replies.push(identityPrompt());
      return replies;
    }
    if (roleOf(session) === 'carrier') {
      replies.push(ONBOARDING_DOCS.carrier);
      return replies;
    }
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
    'No estoy seguro de entender. Elige una opción del menú (1–6), escribe *documentos* / *volver*, o *humano* para un ejecutivo.',
    MENU[roleOf(session)]
  );
  return replies;
}

/**
 * @param {{ from: string, text: string, messageId?: string }} inbound
 * @param {{ lookupCarrierIdentity?: (q: string) => Promise<object> }} [deps]
 */
async function handleInbound(inbound, deps = {}) {
  if (isDuplicateMessageId(inbound.messageId)) {
    return { replies: [], session: getSession(inbound.from), skipped: true };
  }
  const session = getSession(inbound.from);
  const replies = inbound.mediaType
    ? buildMediaReplies(inbound, session)
    : await buildReplies(inbound.text, session, deps);
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
  buildReplies,
  buildMediaReplies,
  resetSession,
  restartDocumentFlow,
  parseRenewalKind,
  normalizeDocText,
};
