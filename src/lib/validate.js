'use strict';

function requiredString(value, field, max = 200) {
  if (typeof value !== 'string' || !value.trim()) {
    return `${field} es obligatorio`;
  }
  if (value.trim().length > max) {
    return `${field} demasiado largo`;
  }
  return null;
}

function optionalNumber(value, field, { min = 0, max = 1e9 } = {}) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n) || n < min || n > max) {
    return `${field} inválido`;
  }
  return null;
}

function parseBody(fields) {
  const errors = [];
  for (const check of fields) {
    const err = check();
    if (err) errors.push(err);
  }
  return errors;
}

module.exports = { requiredString, optionalNumber, parseBody };
