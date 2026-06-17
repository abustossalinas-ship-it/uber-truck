'use strict';

const { validateRut } = require('./rut-chile');

const MONTHS = {
  ENE: 0,
  ENERO: 0,
  FEB: 1,
  FEBRERO: 1,
  MAR: 2,
  MARZO: 2,
  ABR: 3,
  ABRIL: 3,
  MAY: 4,
  MAYO: 4,
  JUN: 5,
  JUNIO: 5,
  JUL: 6,
  JULIO: 6,
  AGO: 7,
  AGOSTO: 7,
  SEP: 8,
  SEPT: 8,
  SEPTIEMBRE: 8,
  OCT: 9,
  OCTUBRE: 9,
  NOV: 10,
  NOVIEMBRE: 10,
  DIC: 11,
  DICIEMBRE: 11,
};

const RUT_RE = /\b(\d{1,2}[.,]?\d{3}[.,]?\d{3}[\s-]*[\dkK])\b/gi;

function scrubRutOcrText(text) {
  return String(text || '')
    .toUpperCase()
    .replace(/[OØ]/g, '0')
    .replace(/(\d)[,.](\d{3})[,.](\d{3})/g, '$1.$2.$3')
    .replace(/(\d)\s+(\d{3})\s+(\d{3})/g, '$1.$2.$3');
}

function extractRutCandidates(text) {
  const scrubbed = scrubRutOcrText(text);
  const found = [];
  for (const match of scrubbed.matchAll(RUT_RE)) {
    const rut = validateRut(match[1]);
    if (rut.ok) found.push(rut.rut);
  }
  for (const match of scrubbed.matchAll(/\bRUN[\s:]*([\d.]{8,12}[\s-]*[\dK])\b/gi)) {
    const rut = validateRut(match[1]);
    if (rut.ok) found.push(rut.rut);
  }
  for (const match of scrubbed.matchAll(
    /N[°ºO*]?\s*(?:DE\s+)?LICENCIA[\s:]*([\d.,\s-]{8,18}[\dK])/gi
  )) {
    const rut = validateRut(match[1]);
    if (rut.ok) found.push(rut.rut);
  }
  for (const match of scrubbed.matchAll(/\b(\d{7,8}[\s-][\dK])\b/g)) {
    const rut = validateRut(match[1]);
    if (rut.ok) found.push(rut.rut);
  }
  return [...new Set(found)];
}

function normalizeOcrText(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .replace(/[|]/g, 'I')
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toIsoDate(year, monthIndex, day) {
  if (!year || monthIndex == null || !day) return null;
  if (year < 1990 || year > 2100) return null;
  if (day < 1 || day > 31 || monthIndex < 0 || monthIndex > 11) return null;
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

/**
 * @param {string} raw
 * @returns {string|null}
 */
function parseChileanDocDate(raw) {
  const s = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ');

  let m = s.match(/^(\d{1,2})[\s/-](\d{1,2})[\s/-](\d{4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const year = Number(m[3]);
    if (a > 31) return toIsoDate(year, b - 1, a);
    if (b > 12 && a <= 12) return toIsoDate(year, a - 1, b);
    return toIsoDate(year, b - 1, a);
  }

  m = s.match(/^(\d{1,2})\s+([A-ZÁÉÍÓÚÑ]+)\s+(\d{4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = MONTHS[m[2].normalize('NFD').replace(/[\u0300-\u036f]/g, '')];
    const year = Number(m[3]);
    return toIsoDate(year, month, day);
  }

  return null;
}

function scoreCi(text) {
  const t = text.toUpperCase();
  let score = 0;
  if (/CEDULA\s+DE\s+IDENTIDAD|CÉDULA\s+DE\s+IDENTIDAD/.test(t)) score += 4;
  if (/REGISTRO\s+CIVIL|SERVICIO\s+DE\s+REGISTRO\s+CIVIL/.test(t)) score += 3;
  if (/REPUBLICA\s+DE\s+CHILE|REPÚBLICA\s+DE\s+CHILE/.test(t)) score += 1;
  if (/FECHA\s+DE\s+VENCIMIENTO|FECHA\s+DE\s+NACIMIENTO/.test(t)) score += 2;
  if (/\bRUN\b/.test(t)) score += 2;
  if (/APELLIDOS|NOMBRES/.test(t)) score += 1;
  return score;
}

function scoreLicense(text) {
  const t = text.toUpperCase();
  let score = 0;
  if (/LICENCIA\s+DE\s+CONDUCTOR|LICENCIA\s+DE\s+CONDUCIR/.test(t)) score += 5;
  if (/REGISTRO\s+NACIONAL\s+DE\s+CONDUCTORES|\bR\.?N\.?C\.?\b/.test(t)) score += 4;
  if (/\bCLASE\s+[A-F]\b/.test(t)) score += 2;
  if (/FECHA\s+DE\s+VENCIMIENTO|FECHA\s+VENCIMIENTO/.test(t)) score += 1;
  if (/FECHA\s+(?:DE\s+)?CONTROL/.test(t)) score += 2;
  return score;
}

function normalizePersonName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function namesMatch(a, b) {
  const na = normalizePersonName(a);
  const nb = normalizePersonName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const ta = na.split(' ').filter(Boolean);
  const tb = nb.split(' ').filter(Boolean);
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  return short.length >= 2 && short.every((token) => long.includes(token));
}

/** En licencias chilenas la *fecha de control* es la de vencimiento (no confundir con último control). */
function extractLicenseExpiryDate(text) {
  const upper = String(text || '').toUpperCase();

  const explicit = upper.match(
    /FECHA\s+DE\s+CONTROL[\s:]*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4})/
  );
  if (explicit) {
    const iso = parseChileanDocDate(explicit[1]);
    if (iso) return iso;
  }

  for (const match of upper.matchAll(
    /FECHA\s+CONTROL[\s:]*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4})/g
  )) {
    const idx = match.index ?? 0;
    const before = upper.slice(Math.max(0, idx - 18), idx);
    if (/ULTIMO\s*$/.test(before)) continue;
    const iso = parseChileanDocDate(match[1]);
    if (iso) return iso;
  }

  const vencPatterns = [
    /FECHA\s+DE\s+VENCIMIENTO[\s:]*([0-9A-ZÁÉÍÓÚÑ.\s/-]{6,20})/i,
    /FECHA\s+VENCIMIENTO[\s:]*([0-9A-ZÁÉÍÓÚÑ.\s/-]{6,20})/i,
  ];
  for (const re of vencPatterns) {
    const m = upper.match(re);
    if (!m) continue;
    const iso = parseChileanDocDate(m[1]);
    if (iso) return iso;
  }

  const dated = [...upper.matchAll(/\b(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4})\b/g)]
    .map((m) => parseChileanDocDate(m[1]))
    .filter(Boolean);
  if (dated.length === 1) return dated[0];
  if (dated.length > 1) return dated.sort().pop();
  return null;
}

function classifyDocumentType(text, hint) {
  const normalizedHint =
    hint === 'ci' || hint === 'license' || hint === 'insurance' || hint === 'soap' ? hint : null;
  const ci = scoreCi(text);
  const license = scoreLicense(text);

  if (normalizedHint === 'insurance' || normalizedHint === 'soap') return normalizedHint;

  if (normalizedHint === 'ci') {
    if (ci >= 2 || license < 4) return 'ci';
  }
  if (normalizedHint === 'license') {
    if (license >= 2 || ci < 5) return 'license';
  }

  if (ci >= 4 && ci >= license + 2) return 'ci';
  if (license >= 4 && license > ci) return 'license';
  if (ci >= 3 && ci > license) return 'ci';
  if (license >= 3 && license > ci) return 'license';
  if (normalizedHint === 'ci' || normalizedHint === 'license') return normalizedHint;
  return null;
}

function extractExpiryDate(text, docType) {
  if (docType === 'license') return extractLicenseExpiryDate(text);

  const upper = String(text || '').toUpperCase();
  const patterns = [
    /FECHA\s+DE\s+VENCIMIENTO[\s:]*([0-9A-ZÁÉÍÓÚÑ.\s/-]{6,20})/i,
    /FECHA\s+VENCIMIENTO[\s:]*([0-9A-ZÁÉÍÓÚÑ.\s/-]{6,20})/i,
    /VENC(?:IMIENTO)?[\s:]*([0-9A-ZÁÉÍÓÚÑ.\s/-]{6,20})/i,
  ];

  for (const re of patterns) {
    const m = upper.match(re);
    if (!m) continue;
    const iso = parseChileanDocDate(m[1]);
    if (iso) return iso;
  }

  if (docType === 'ci') {
    const dates = [...upper.matchAll(/\b(\d{1,2}\s+[A-Z]{3,9}\s+\d{4})\b/g)].map((m) =>
      parseChileanDocDate(m[1])
    );
    const valid = dates.filter(Boolean);
    if (valid.length) return valid[valid.length - 1];
  }

  return null;
}

function extractName(text) {
  const upper = String(text || '').toUpperCase();
  const ap = upper.match(/APELLIDOS[\s:]*([A-ZÁÉÍÓÚÑ\s]{3,40})/);
  const nom = upper.match(/NOMBRES[\s:]*([A-ZÁÉÍÓÚÑ\s]{3,40})/);
  if (ap && nom) {
    const surname = ap[1].split(/\s{2,}|NOMBRES|NACIONALIDAD|SEXO|RUN/)[0].trim();
    const given = nom[1].split(/\s{2,}|NACIONALIDAD|SEXO|RUN|FECHA/)[0].trim();
    const full = `${given} ${surname}`.replace(/\s+/g, ' ').trim();
    if (full.length >= 5) return full;
  }
  return null;
}

function extractLicenseClass(text) {
  const m = String(text || '')
    .toUpperCase()
    .match(/\bCLASE\s+([A-F]{1,2})\b/);
  return m ? m[1] : null;
}

/**
 * @param {string} text OCR completo
 * @param {{ hint?: string|null }} [opts]
 */
function parseChileanDocument(text, opts = {}) {
  const normalized = normalizeOcrText(text);
  if (normalized.length < 20) {
    return { ok: false, reason: 'text_too_short' };
  }

  const docType = classifyDocumentType(normalized, opts.hint || null);
  if (!docType || docType === 'insurance' || docType === 'soap') {
    return { ok: false, reason: 'unknown_document', docType };
  }

  const ruts = extractRutCandidates(normalized);
  const expiresAt = extractExpiryDate(normalized, docType);
  const fullName = extractName(normalized);
  const licenseClass = docType === 'license' ? extractLicenseClass(normalized) : null;

  if (!expiresAt && docType !== 'insurance' && docType !== 'soap') {
    return {
      ok: false,
      reason: 'missing_expiry',
      docType,
      rut: ruts[0] || null,
      fullName,
      licenseClass,
      rawTextSample: normalized.slice(0, 240),
    };
  }

  if (!ruts.length && docType === 'ci') {
    return {
      ok: false,
      reason: 'missing_rut',
      docType,
      expiresAt,
      fullName,
      rawTextSample: normalized.slice(0, 240),
    };
  }

  return {
    ok: true,
    docType,
    rut: ruts[0] || null,
    expiresAt,
    fullName,
    licenseClass,
    confidence: docType === 'ci' ? scoreCi(normalized) : scoreLicense(normalized),
  };
}

module.exports = {
  normalizeOcrText,
  parseChileanDocDate,
  parseChileanDocument,
  classifyDocumentType,
  extractRutCandidates,
  extractLicenseExpiryDate,
  normalizePersonName,
  namesMatch,
  scoreCi,
  scoreLicense,
};
