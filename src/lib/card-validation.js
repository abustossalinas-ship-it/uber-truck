'use strict';

const crypto = require('crypto');

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function luhnCheck(pan) {
  const s = digitsOnly(pan);
  if (s.length < 13 || s.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = s.length - 1; i >= 0; i -= 1) {
    let n = Number(s[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function detectBrand(pan) {
  const s = digitsOnly(pan);
  if (/^4/.test(s)) return 'visa';
  if (/^5[1-5]/.test(s) || /^2[2-7]/.test(s)) return 'mastercard';
  if (/^3[47]/.test(s)) return 'amex';
  if (/^6011|^65/.test(s)) return 'discover';
  return 'card';
}

function last4(pan) {
  const s = digitsOnly(pan);
  return s.slice(-4);
}

function makeProviderToken(userId, pan, provider) {
  const secret = process.env.PAYMENT_TOKEN_SECRET || process.env.JWT_SECRET || 'cubik-dev';
  const hash = crypto
    .createHmac('sha256', secret)
    .update(`${provider}:${userId}:${digitsOnly(pan).slice(-8)}:${Date.now()}`)
    .digest('hex');
  return `${provider}_tok_${hash.slice(0, 40)}`;
}

function validateExpiry(expMonth, expYear) {
  const m = Number(expMonth);
  let y = Number(expYear);
  if (!m || m < 1 || m > 12) return { ok: false, error: 'Vencimiento inválido' };
  if (String(expYear).length <= 2) y = 2000 + y;
  if (y < 2020 || y > 2100) return { ok: false, error: 'Año de vencimiento inválido' };
  const now = new Date();
  const exp = new Date(y, m, 0, 23, 59, 59);
  if (exp < now) return { ok: false, error: 'Tarjeta vencida' };
  return { ok: true, exp_month: m, exp_year: y };
}

function validateCvv(cvv, brand) {
  const s = digitsOnly(cvv);
  const len = brand === 'amex' ? 4 : 3;
  if (s.length !== len) return { ok: false, error: 'CVV inválido' };
  return { ok: true };
}

module.exports = {
  digitsOnly,
  luhnCheck,
  detectBrand,
  last4,
  makeProviderToken,
  validateExpiry,
  validateCvv,
};
