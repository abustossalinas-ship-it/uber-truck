/** Términos de confianza — vista in-app y URLs resueltas en Capacitor. */

const LEGAL_TERMS_PATH = '/docs/Terminos-Confianza-Carga-Uber-Truck.html';

function termsDocUrl() {
  return typeof apiUrl === 'function' ? apiUrl(LEGAL_TERMS_PATH) : LEGAL_TERMS_PATH;
}

function openTermsModal() {
  const modal = document.getElementById('terms-modal');
  const frame = document.getElementById('terms-modal-frame');
  if (!modal || !frame) {
    window.open(termsDocUrl(), '_blank', 'noopener');
    return;
  }
  frame.src = termsDocUrl();
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
}

function closeTermsModal() {
  const modal = document.getElementById('terms-modal');
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
}

function patchDocLinks() {
  document.querySelectorAll('a[href^="/docs/"]').forEach((a) => {
    const href = a.getAttribute('href');
    if (href && typeof apiUrl === 'function') a.href = apiUrl(href);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  patchDocLinks();

  document.querySelectorAll('[data-open-terms]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openTermsModal();
    });
  });

  document.querySelectorAll('[data-close-terms]').forEach((el) => {
    el.addEventListener('click', closeTermsModal);
  });
});
