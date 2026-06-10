/** Checklist de contraseña segura (estilo verificación en tiempo real). */
const PasswordStrengthUI = {
  RULES: [
    { key: 'hasLetter', label: 'Al menos una letra' },
    { key: 'hasUpper', label: 'Al menos una letra en mayúsculas' },
    { key: 'hasNumber', label: 'Al menos un número' },
    { key: 'minLength', label: 'Debería tener 8 caracteres como mínimo' },
  ],

  attach(input, options = {}) {
    if (!input || input.dataset.pwStrengthBound === '1') return null;
    if (typeof PasswordPolicy === 'undefined') return null;
    input.dataset.pwStrengthBound = '1';
    const showWhen = options.showWhen || (() => true);

    const box = document.createElement('div');
    box.className = 'pw-strength';
    box.hidden = true;
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    box.innerHTML = `
      <p class="pw-strength-lead">La contraseña debería cumplir con los siguientes requerimientos:</p>
      <ul class="pw-strength-list">
        ${this.RULES.map(
          (r) =>
            `<li class="pw-strength-item" data-rule="${r.key}">
              <span class="pw-strength-icon" aria-hidden="true"></span>
              <span>${r.label}</span>
            </li>`
        ).join('')}
      </ul>`;
    input.insertAdjacentElement('afterend', box);

    const items = box.querySelectorAll('[data-rule]');

    const refresh = () => {
      if (!showWhen()) {
        box.hidden = true;
        return;
      }
      const checks = PasswordPolicy.check(input.value);
      items.forEach((li) => {
        const rule = li.dataset.rule;
        const ok = Boolean(checks[rule]);
        li.classList.toggle('pw-strength-ok', ok);
        li.classList.toggle('pw-strength-fail', !ok);
        const icon = li.querySelector('.pw-strength-icon');
        if (icon) icon.textContent = ok ? '✓' : '✕';
      });
    };

    const show = () => {
      if (!showWhen()) return;
      box.hidden = false;
      refresh();
    };

    const hideIfEmpty = () => {
      if (!input.value.trim()) box.hidden = true;
    };

    input.addEventListener('focus', show);
    input.addEventListener('input', () => {
      if (!box.hidden || document.activeElement === input) show();
      else refresh();
    });
    input.addEventListener('blur', () => setTimeout(hideIfEmpty, 150));

    return { box, refresh, showWhen };
  },

  bindAll(selector, options) {
    document.querySelectorAll(selector).forEach((el) => this.attach(el, options));
  },
};

window.PasswordStrengthUI = PasswordStrengthUI;

document.addEventListener('DOMContentLoaded', () => {
  PasswordStrengthUI.bindAll('input[data-pw-strength]');
});
