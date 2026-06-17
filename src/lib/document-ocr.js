'use strict';

const sharp = require('sharp');
const { createWorker } = require('tesseract.js');
const { parseChileanDocument } = require('./chile-document-parser');

/** @type {Promise<import('tesseract.js').Worker>|null} */
let tesseractWorkerPromise = null;

function visionApiKey() {
  return String(process.env.GOOGLE_VISION_API_KEY || '').trim();
}

function hasVisionApiKey() {
  return Boolean(visionApiKey());
}

function isDocumentOcrEnabled() {
  if (String(process.env.WHATSAPP_DOC_OCR_ENABLED || 'true').toLowerCase() === 'false') {
    return false;
  }
  return true;
}

function ocrStatusPayload() {
  return {
    enabled: isDocumentOcrEnabled(),
    engine: hasVisionApiKey() ? 'vision+tesseract' : 'tesseract',
    vision_api_key_set: hasVisionApiKey(),
    note: hasVisionApiKey()
      ? null
      : 'Sin GOOGLE_VISION_API_KEY — OCR local Tesseract (GOOGLE_MAPS_API_KEY no sirve para Vision).',
  };
}

async function getTesseractWorker() {
  if (!tesseractWorkerPromise) {
    tesseractWorkerPromise = (async () => {
      const worker = await createWorker('spa');
      await worker.setParameters({
        tessedit_pageseg_mode: '1',
      });
      return worker;
    })();
  }
  return tesseractWorkerPromise;
}

/**
 * @param {Buffer} buffer
 * @param {number} [rotateDeg]
 */
async function prepareImageBuffer(buffer, rotateDeg = 0, cropTopFraction = null) {
  let img = sharp(buffer).rotate().normalize().sharpen();
  if (cropTopFraction != null && cropTopFraction > 0 && cropTopFraction < 1) {
    const meta = await sharp(buffer).metadata();
    const w = meta.width || 0;
    const h = meta.height || 0;
    if (w > 0 && h > 120) {
      img = sharp(buffer)
        .extract({ left: 0, top: 0, width: w, height: Math.max(120, Math.round(h * cropTopFraction)) })
        .normalize()
        .sharpen();
    }
  }
  if (rotateDeg) img = img.rotate(rotateDeg);
  return img.jpeg({ quality: 92 }).toBuffer();
}

function scoreOcrParse(parsed, text) {
  if (parsed?.ok) return 1000 + (parsed.confidence || 0);
  let score = Math.min(String(text || '').length, 400) / 4;
  if (parsed?.rut) score += 120;
  if (parsed?.expiresAt) score += 120;
  if (/CEDULA|LICENCIA|REGISTRO CIVIL|RUN/i.test(String(text || ''))) score += 60;
  return score;
}

/**
 * @param {Buffer} buffer
 * @returns {Promise<{ ok: boolean, text?: string, reason?: string, engine?: string, message?: string }>}
 */
async function extractTextWithTesseract(buffer) {
  if (!buffer?.length) return { ok: false, reason: 'empty_image' };
  try {
    const worker = await getTesseractWorker();
    const {
      data: { text },
    } = await worker.recognize(buffer);
    const cleaned = String(text || '').trim();
    if (!cleaned) return { ok: false, reason: 'no_text_detected', engine: 'tesseract' };
    return { ok: true, text: cleaned, engine: 'tesseract' };
  } catch (e) {
    return {
      ok: false,
      reason: 'tesseract_error',
      engine: 'tesseract',
      message: e.message || String(e),
    };
  }
}

/**
 * @param {Buffer} buffer
 * @returns {Promise<{ ok: boolean, text?: string, reason?: string, engine?: string, message?: string }>}
 */
async function extractTextWithVision(buffer) {
  const key = visionApiKey();
  if (!key) return { ok: false, reason: 'no_vision_key' };
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
    return {
      ok: false,
      reason: 'vision_error',
      engine: 'vision',
      message: json?.error?.message || `Vision API ${res.status}`,
    };
  }

  const text = json?.responses?.[0]?.fullTextAnnotation?.text || '';
  if (!String(text).trim()) {
    return { ok: false, reason: 'no_text_detected', engine: 'vision' };
  }
  return { ok: true, text: String(text), engine: 'vision' };
}

/**
 * @param {Buffer} buffer
 * @returns {Promise<{ ok: boolean, text?: string, reason?: string, engine?: string, message?: string }>}
 */
async function extractTextFromImage(buffer) {
  if (!buffer?.length) return { ok: false, reason: 'empty_image' };

  const prepared = await prepareImageBuffer(buffer, 0);
  if (hasVisionApiKey()) {
    const vision = await extractTextWithVision(prepared);
    if (vision.ok) return vision;
  }

  return extractTextWithTesseract(prepared);
}

/**
 * @param {Buffer} buffer
 * @param {{ hint?: string|null }} [opts]
 */
async function readChileanDocumentFromImage(buffer, opts = {}) {
  const rotations = [0, 90, 270];
  const cropFractions =
    opts.hint === 'license' ? [null, 0.55] : [null];
  /** @type {{ score: number, parsed: object, text: string, engine: string } | null} */
  let best = null;
  /** @type {{ reason?: string, message?: string } | null} */
  let lastFail = null;

  for (const crop of cropFractions) {
    for (const deg of rotations) {
      const prepared = await prepareImageBuffer(buffer, deg, crop);

      /** @type {Array<{ ok: boolean, text?: string, reason?: string, engine?: string, message?: string }>} */
      const attempts = [];
      if (hasVisionApiKey()) {
        attempts.push(await extractTextWithVision(prepared));
      }
      attempts.push(await extractTextWithTesseract(prepared));

      for (const ocr of attempts) {
        if (!ocr.ok) {
          lastFail = { reason: ocr.reason, message: ocr.message };
          continue;
        }
        const parsed = parseChileanDocument(ocr.text, opts);
        const score = scoreOcrParse(parsed, ocr.text) + (crop ? 5 : 0);
        if (!best || score > best.score) {
          best = {
            score,
            parsed: { ...parsed, ocrText: ocr.text },
            text: ocr.text,
            engine: ocr.engine || 'tesseract',
          };
        }
        if (parsed.ok) {
          return { ...parsed, ocrText: ocr.text, engine: ocr.engine || 'tesseract' };
        }
      }
    }
  }

  if (best?.parsed) {
    return {
      ...best.parsed,
      ocrText: best.text,
      engine: best.engine,
    };
  }

  return {
    ok: false,
    reason: lastFail?.reason || 'no_text_detected',
    message: lastFail?.message,
  };
}

module.exports = {
  isDocumentOcrEnabled,
  hasVisionApiKey,
  ocrStatusPayload,
  extractTextFromImage,
  extractTextWithTesseract,
  extractTextWithVision,
  readChileanDocumentFromImage,
};
