'use strict';

const crypto = require('crypto');

function graphVersion() {
  return process.env.WHATSAPP_GRAPH_VERSION || 'v21.0';
}

function config() {
  const accessToken = String(process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const verifyToken = String(process.env.WHATSAPP_VERIFY_TOKEN || '').trim();
  const appSecret = String(process.env.WHATSAPP_APP_SECRET || '').trim();
  const enabled = String(process.env.WHATSAPP_CLOUD_ENABLED || '').toLowerCase() === 'true';
  return {
    enabled,
    configured: Boolean(accessToken && phoneNumberId),
    accessToken,
    phoneNumberId,
    verifyToken,
    appSecret,
    graphVersion: graphVersion(),
    webhookPath: '/api/whatsapp/webhook',
  };
}

function isConfigured() {
  const c = config();
  return c.enabled && c.configured;
}

function statusPayload() {
  const c = config();
  return {
    enabled: c.enabled,
    configured: c.configured,
    active: isConfigured(),
    phone_number_id_set: Boolean(c.phoneNumberId),
    verify_token_set: Boolean(c.verifyToken),
    app_secret_set: Boolean(c.appSecret),
    webhook: c.webhookPath,
    graph_version: c.graphVersion,
  };
}

function verifyWebhookSignature(rawBody, signatureHeader) {
  const { appSecret } = config();
  if (!appSecret) return true;
  if (!signatureHeader || !rawBody) return false;
  const expected =
    'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signatureHeader)));
  } catch {
    return false;
  }
}

/**
 * @param {unknown} body
 * @returns {Array<{ from: string, text: string, messageId: string, phoneNumberId: string|null }>}
 */
function parseWebhookMessages(body) {
  const out = [];
  if (!body || typeof body !== 'object') return out;
  if (body.object !== 'whatsapp_business_account') return out;

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;
      if (!value) continue;
      const phoneNumberId = value.metadata?.phone_number_id || null;
      for (const msg of value.messages || []) {
        if (msg.type === 'text' && msg.text?.body) {
          out.push({
            from: String(msg.from || ''),
            text: String(msg.text.body || ''),
            messageId: String(msg.id || ''),
            phoneNumberId: phoneNumberId ? String(phoneNumberId) : null,
            mediaType: null,
            mediaId: null,
            caption: '',
          });
          continue;
        }
        if (msg.type === 'image' && msg.image?.id) {
          out.push({
            from: String(msg.from || ''),
            text: String(msg.image.caption || '').trim(),
            messageId: String(msg.id || ''),
            phoneNumberId: phoneNumberId ? String(phoneNumberId) : null,
            mediaType: 'image',
            mediaId: String(msg.image.id),
            caption: String(msg.image.caption || '').trim(),
          });
          continue;
        }
        if (msg.type === 'document' && msg.document?.id) {
          out.push({
            from: String(msg.from || ''),
            text: String(msg.document.caption || msg.document.filename || '').trim(),
            messageId: String(msg.id || ''),
            phoneNumberId: phoneNumberId ? String(phoneNumberId) : null,
            mediaType: 'document',
            mediaId: String(msg.document.id),
            caption: String(msg.document.caption || msg.document.filename || '').trim(),
          });
        }
      }
    }
  }
  return out;
}

async function sendText(to, text) {
  const c = config();
  if (!c.configured) {
    throw new Error('WhatsApp Cloud API no configurada');
  }
  const digits = String(to || '').replace(/\D/g, '');
  const url = `https://graph.facebook.com/${c.graphVersion}/${c.phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${c.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: digits,
      type: 'text',
      text: { preview_url: false, body: String(text).slice(0, 4096) },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.error?.message || `WhatsApp API ${res.status}`);
    err.statusCode = res.status;
    err.details = json;
    throw err;
  }
  return json;
}

/**
 * Descarga binario de media recibida por webhook (imagen o PDF).
 * @param {string} mediaId
 * @returns {Promise<{ buffer: Buffer, mimeType: string|null }>}
 */
async function downloadMedia(mediaId) {
  const c = config();
  if (!c.configured) {
    throw new Error('WhatsApp Cloud API no configurada');
  }
  const metaUrl = `https://graph.facebook.com/${c.graphVersion}/${encodeURIComponent(String(mediaId))}`;
  const metaRes = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${c.accessToken}` },
  });
  const meta = await metaRes.json().catch(() => ({}));
  if (!metaRes.ok || !meta?.url) {
    const err = new Error(meta?.error?.message || `WhatsApp media meta ${metaRes.status}`);
    err.statusCode = metaRes.status;
    err.details = meta;
    throw err;
  }

  const fileRes = await fetch(String(meta.url), {
    headers: { Authorization: `Bearer ${c.accessToken}` },
  });
  if (!fileRes.ok) {
    const err = new Error(`WhatsApp media download ${fileRes.status}`);
    err.statusCode = fileRes.status;
    throw err;
  }
  const arrayBuffer = await fileRes.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: meta.mime_type ? String(meta.mime_type) : null,
  };
}

module.exports = {
  config,
  isConfigured,
  statusPayload,
  verifyWebhookSignature,
  parseWebhookMessages,
  sendText,
  downloadMedia,
};
