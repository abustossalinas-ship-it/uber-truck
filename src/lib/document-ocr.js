'use strict';

const { parseChileanDocument } = require('./chile-document-parser');

function isDocumentOcrEnabled() {
  if (String(process.env.WHATSAPP_DOC_OCR_ENABLED || 'true').toLowerCase() === 'false') {
    return false;
  }
  return Boolean(
    String(process.env.GOOGLE_VISION_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '').trim()
  );
}

function visionApiKey() {
  return String(process.env.GOOGLE_VISION_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '').trim();
}

/**
 * @param {Buffer} buffer
 * @returns {Promise<{ ok: boolean, text?: string, reason?: string }>}
 */
async function extractTextFromImage(buffer) {
  const key = visionApiKey();
  if (!key) return { ok: false, reason: 'no_api_key' };
  if (!buffer?.length) return { ok: false, reason: 'empty_image' };

  const url = `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        {
          image: { content: buffer.toString('base64') },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
          imageContext: { languageHints: ['es'] },
        },
      ],
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || `Vision API ${res.status}`;
    return { ok: false, reason: 'vision_error', message: msg };
  }

  const text = json?.responses?.[0]?.fullTextAnnotation?.text || '';
  if (!String(text).trim()) {
    return { ok: false, reason: 'no_text_detected' };
  }
  return { ok: true, text: String(text) };
}

/**
 * @param {Buffer} buffer
 * @param {{ hint?: string|null }} [opts]
 */
async function readChileanDocumentFromImage(buffer, opts = {}) {
  const ocr = await extractTextFromImage(buffer);
  if (!ocr.ok) return { ok: false, reason: ocr.reason, message: ocr.message };
  const parsed = parseChileanDocument(ocr.text, opts);
  return { ...parsed, ocrText: ocr.text };
}

module.exports = {
  isDocumentOcrEnabled,
  extractTextFromImage,
  readChileanDocumentFromImage,
};
