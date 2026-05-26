(function () {
  const share = document.getElementById('invite-share-url');
  const demoUrl = document.getElementById('demo-url');
  const origin = window.location.origin;
  if (share) {
    share.href = origin;
    share.textContent = origin.replace(/^https?:\/\//, '');
  }
  if (demoUrl) demoUrl.textContent = origin.replace(/^https?:\/\//, '');

  document.getElementById('btn-copy-invite-link')?.addEventListener('click', async () => {
    const url = origin;
    try {
      await navigator.clipboard.writeText(url);
      alert('Link copiado. Compártelo por WhatsApp o correo.');
    } catch {
      prompt('Copia este link:', url);
    }
  });

  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    const seedBtn = document.getElementById('btn-seed-demo');
    if (seedBtn) seedBtn.hidden = false;
  }
})();
