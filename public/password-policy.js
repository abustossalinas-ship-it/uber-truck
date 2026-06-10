/** Reglas de contraseña segura — espejo de src/lib/password-policy.js */
const PasswordPolicy = {
  MIN_LENGTH: 8,

  check(password) {
    const pwd = String(password || '');
    return {
      minLength: pwd.length >= this.MIN_LENGTH,
      hasLetter: /[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(pwd),
      hasUpper: /[A-ZÁÉÍÓÚÑ]/.test(pwd),
      hasNumber: /\d/.test(pwd),
    };
  },

  validate(password) {
    const checks = this.check(password);
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
  },

  isStrong(password) {
    return this.validate(password).ok;
  },
};

window.PasswordPolicy = PasswordPolicy;
