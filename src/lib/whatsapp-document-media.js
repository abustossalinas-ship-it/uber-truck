'use strict';

const whatsappCloud = require('../services/whatsapp-cloud');
const { readChileanDocumentFromImage, isDocumentOcrEnabled } = require('./document-ocr');
const { applyWhatsappDocumentExtract, formatClDate, parseIsoDate } = require('./carrier-documents');
const {
  ocrDocumentApplied,
  ocrDocumentFailed,
  ocrNeedIdentity,
} = require('./whatsapp-copy');

/**
 * Procesa imagen/documento recibido por WhatsApp: OCR + persistencia en users.
 * @param {{ from: string, mediaId: string, caption?: string, text?: string }} msg
 * @param {{ linkedUser?: object|null, uploadTarget?: string|null }} session
 */
async function processWhatsappDocumentMedia(msg, session = {}) {
  if (!msg?.mediaId) return { ok: false, reason: 'no_media' };
  if (!isDocumentOcrEnabled()) return { ok: false, reason: 'ocr_disabled' };

  const linkedUser = session.linkedUser;
  if (!linkedUser?.id) {
    await whatsappCloud.sendText(msg.from, ocrNeedIdentity());
    return { ok: false, reason: 'no_linked_user' };
  }
  const hint = session.uploadTarget || null;
  const caption = String(msg.caption || msg.text || '').toLowerCase();
  let effectiveHint = hint;
  if (!effectiveHint) {
    if (/\b(ci|c[eé]dula|carnet)\b/.test(caption)) effectiveHint = 'ci';
    else if (/\blicencia\b/.test(caption)) effectiveHint = 'license';
  }

  let buffer;
  try {
    const downloaded = await whatsappCloud.downloadMedia(msg.mediaId);
    buffer = downloaded.buffer;
  } catch (e) {
    console.error('[whatsapp-ocr] download failed', msg.from, e.message || e);
    await whatsappCloud.sendText(
      msg.from,
      ocrDocumentFailed({ reason: 'download_failed' })
    );
    return { ok: false, reason: 'download_failed' };
  }

  let readResult;
  try {
    readResult = await readChileanDocumentFromImage(buffer, { hint: effectiveHint });
  } catch (e) {
    console.error('[whatsapp-ocr] ocr failed', msg.from, e.message || e);
    await whatsappCloud.sendText(
      msg.from,
      ocrDocumentFailed({ reason: e.code === 'PGRST204' ? 'db_error' : 'tesseract_error' })
    );
    return { ok: false, reason: 'ocr_failed' };
  }

  if (!readResult.ok) {
    await whatsappCloud.sendText(
      msg.from,
      ocrDocumentFailed({
        reason: readResult.reason,
        docType: readResult.docType,
        hint: effectiveHint,
      })
    );
    return readResult;
  }

  let applied;
  try {
    applied = await applyWhatsappDocumentExtract(linkedUser.id, readResult);
  } catch (e) {
    console.error('[whatsapp-ocr] apply failed', linkedUser.id, e.message || e);
    await whatsappCloud.sendText(msg.from, ocrDocumentFailed({ reason: 'db_error' }));
    return { ok: false, reason: 'db_error' };
  }

  if (!applied.ok) {
    await whatsappCloud.sendText(
      msg.from,
      ocrDocumentFailed({
        reason: applied.reason,
        expectedRut: applied.expectedRut,
        foundRut: applied.foundRut,
        foundName: applied.foundName,
        expectedName: applied.expectedName,
        docType: readResult.docType,
      })
    );
    return applied;
  }

  session.linkedUser = { ...linkedUser, ...applied.patch };

  const expiryLabel = formatClDate(parseIsoDate(readResult.expiresAt));
  await whatsappCloud.sendText(
    msg.from,
    ocrDocumentApplied({
      docType: readResult.docType,
      rut: applied.patch.national_rut || linkedUser.national_rut,
      expiresAt: expiryLabel,
      fullName: readResult.fullName,
      licenseClass: readResult.licenseClass,
      compliance: applied.compliance,
    })
  );

  return applied;
}

module.exports = {
  processWhatsappDocumentMedia,
  isDocumentOcrEnabled,
};
