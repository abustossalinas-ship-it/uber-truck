'use strict';

const MIN_LENGTH = 8;

function checkPasswordStrength(password) {
  const pwd = String(password || '');
  return {
    minLength: pwd.length >= MIN_LENGTH,
    hasLetter: /[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(pwd),
    hasUpper: /[A-ZÁÉÍÓÚÑ]/.test(pwd),
    hasNumber: /\d/.test(pwd),
  };
}

function validatePassword(password) {
  const checks = checkPasswordStrength(password);
  if (!checks.minLength) {
    return { ok: false, error: 'La contraseña debe tener al menos 8 caracteres.', checks };
  }
  if (!checks.hasLetter) {
    return { ok: false, error: 'La contraseña debe incluir al menos una letra.', checks };
  }
  if (!checks.hasUpper) {
    return { ok: false, error: 'La contraseña debe incluir al menos una letra en mayúsculas.', checks };
  }
  if (!checks.hasNumber) {
    return { ok: false, error: 'La contraseña debe incluir al menos un número.', checks };
  }
  return { ok: true, checks };
}

module.exports = { checkPasswordStrength, validatePassword, MIN_LENGTH };
