'use strict';

/** Detecta teléfonos chilenos y variantes comunes en texto libre. */
const PHONE_PATTERNS = [
  /(?:\+?56[\s.-]?)?(?:9[\s.-]?)?[9876][\s.-]?\d{4}[\s.-]?\d{4}/,
  /\b9\d{8}\b/,
  /\b\+569\d{8}\b/,
  /\b(?:whatsapp|wsp|wasap|w\.?a\.?)\b/i,
  /\bll[aá]mame\b/i,
  /\bmi\s+n[uú]mero\b/i,
];

function normalizeDigits(text) {
  return String(text || '').replace(/\D/g, '');
}

function textContainsPhone(text) {
  const raw = String(text || '');
  if (!raw.trim()) return false;
  if (PHONE_PATTERNS.some((re) => re.test(raw))) return true;
  const digits = normalizeDigits(raw);
  if (digits.length >= 9 && digits.length <= 13) {
    const tail = digits.slice(-9);
    if (/^[6789]\d{8}$/.test(tail)) return true;
  }
  return false;
}

function maskPhoneDisplay(phone) {
  const digits = normalizeDigits(phone);
  if (digits.length < 4) return '••••';
  const tail = digits.slice(-4);
  return `+56 9 •••• ${tail}`;
}

module.exports = { textContainsPhone, maskPhoneDisplay, normalizeDigits };
