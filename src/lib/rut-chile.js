'use strict';

/** Normaliza RUT chileno a cuerpo + DV (acepta puntos, comas y guión como en documentos impresos). */
function normalizeRut(input) {
  const raw = String(input || '')
    .trim()
    .toUpperCase()
    .replace(/[.\s,]/g, '')
    .replace(/-/g, '');
  if (raw.length < 2) return null;
  const dv = raw.slice(-1);
  const body = raw.slice(0, -1).replace(/^0+/, '') || '0';
  if (!/^\d+$/.test(body)) return null;
  if (!/^[0-9K]$/.test(dv)) return null;
  return { body, dv, formatted: `${body}-${dv}` };
}

function rutCheckDigit(body) {
  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i -= 1) {
    sum += Number(body[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const mod = 11 - (sum % 11);
  if (mod === 11) return '0';
  if (mod === 10) return 'K';
  return String(mod);
}

function validateRut(input) {
  const n = normalizeRut(input);
  if (!n) return { ok: false, error: 'RUT inválido' };
  if (n.body.length < 7 || n.body.length > 8) {
    return { ok: false, error: 'RUT inválido' };
  }
  const expected = rutCheckDigit(n.body);
  if (expected !== n.dv) return { ok: false, error: 'RUT inválido (dígito verificador)' };
  return { ok: true, rut: n.formatted, body: n.body, dv: n.dv };
}

module.exports = { normalizeRut, validateRut, rutCheckDigit };
