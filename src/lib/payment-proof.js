'use strict';

const MAX_BYTES = Number(process.env.PAYMENT_PROOF_MAX_BYTES) || 1_800_000;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/jpg']);

function normalizeMime(mime) {
  const m = (mime || '').toLowerCase().trim();
  if (m === 'image/jpg') return 'image/jpeg';
  return m;
}

function parseProofInput({ proof_base64, proof_mime }) {
  if (!proof_base64 || typeof proof_base64 !== 'string') {
    const e = new Error('Adjunta una captura de pantalla de la transferencia (imagen).');
    e.status = 400;
    throw e;
  }
  const mime = normalizeMime(proof_mime);
  if (!ALLOWED_MIME.has(mime)) {
    const e = new Error('Formato no válido. Usa JPG, PNG o WebP.');
    e.status = 400;
    throw e;
  }
  let raw = proof_base64.trim();
  const dataUrlMatch = /^data:([^;]+);base64,(.+)$/i.exec(raw);
  if (dataUrlMatch) {
    raw = dataUrlMatch[2];
    if (!proof_mime) return parseProofInput({ proof_base64: raw, proof_mime: dataUrlMatch[1] });
  }
  const buf = Buffer.from(raw, 'base64');
  if (!buf.length) {
    const e = new Error('La imagen del comprobante no se pudo leer.');
    e.status = 400;
    throw e;
  }
  if (buf.length > MAX_BYTES) {
    const e = new Error(
      `La imagen es muy pesada (máx. ${Math.round(MAX_BYTES / 1024 / 1024)} MB). Comprime o usa otra captura.`
    );
    e.status = 400;
    throw e;
  }
  return { mime, base64: raw, size: buf.length };
}

function proofViewPath(matchId) {
  return `/api/account/penalties/${matchId}/payment-proof`;
}

module.exports = {
  MAX_BYTES,
  parseProofInput,
  proofViewPath,
};
