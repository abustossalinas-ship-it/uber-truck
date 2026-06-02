/** Registro service worker + banner instalar PWA (Cubik) */
(function registerCubikPwa() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });

  let deferredPrompt = null;
  const banner = document.getElementById('pwa-install-banner');
  const btn = document.getElementById('pwa-install-btn');
  const dismiss = document.getElementById('pwa-install-dismiss');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (banner) banner.hidden = false;
  });

  btn?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (banner) banner.hidden = true;
  });

  dismiss?.addEventListener('click', () => {
    if (banner) banner.hidden = true;
  });
})();
