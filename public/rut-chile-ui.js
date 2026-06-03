/** Validación y formato RUT chileno (misma lógica que src/lib/rut-chile.js). */
const RutChileUI = {
  normalize(input) {
    const raw = String(input || '')
      .trim()
      .toUpperCase()
      .replace(/\./g, '')
      .replace(/-/g, '')
      .replace(/\s/g, '');
    if (raw.length < 2) return null;
    const dv = raw.slice(-1);
    const body = raw.slice(0, -1).replace(/^0+/, '') || '0';
    if (!/^\d+$/.test(body)) return null;
    if (!/^[0-9K]$/.test(dv)) return null;
    return { body, dv, formatted: `${body}-${dv}` };
  },

  checkDigit(body) {
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
  },

  validate(input) {
    const n = this.normalize(input);
    if (!n) return { ok: false, error: 'RUT inválido' };
    if (n.body.length < 7 || n.body.length > 8) {
      return { ok: false, error: 'RUT inválido' };
    }
    if (this.checkDigit(n.body) !== n.dv) {
      return { ok: false, error: 'RUT inválido (dígito verificador)' };
    }
    return { ok: true, rut: n.formatted, display: this.formatDisplay(n.body, n.dv) };
  },

  formatDisplay(body, dv) {
    const rev = body.split('').reverse();
    const parts = [];
    for (let i = 0; i < rev.length; i += 3) {
      parts.push(rev.slice(i, i + 3).reverse().join(''));
    }
    return `${parts.reverse().join('.')}-${dv}`;
  },

  formatInputValue(input) {
    const v = this.validate(input.value);
    if (v.ok) input.value = v.display;
  },

  showError(input, message) {
    const id = input.id ? `${input.id}-error` : null;
    let el = id ? document.getElementById(id) : input.nextElementSibling;
    if (!el || !el.classList?.contains('field-error')) {
      el = document.createElement('p');
      el.className = 'field-error auth-error';
      el.id = id || undefined;
      input.insertAdjacentElement('afterend', el);
    }
    if (message) {
      el.textContent = message;
      el.hidden = false;
    } else {
      el.textContent = '';
      el.hidden = true;
    }
  },

  bindInput(input) {
    if (!input || input.dataset.rutBound === '1') return;
    input.dataset.rutBound = '1';
    input.setAttribute('inputmode', 'text');
    input.setAttribute('autocomplete', 'off');
    input.addEventListener('blur', () => {
      const v = this.validate(input.value);
      if (v.ok) {
        input.value = v.display;
        this.showError(input, '');
      }
    });
    input.addEventListener('input', () => {
      if (input.value.trim()) this.showError(input, '');
    });
  },
};

document.addEventListener('DOMContentLoaded', () => {
  RutChileUI.bindInput(document.getElementById('bank-rut'));
  RutChileUI.bindInput(document.getElementById('card-holder-rut'));
});
