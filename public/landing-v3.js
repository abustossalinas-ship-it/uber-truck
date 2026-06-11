(function () {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const reveals = document.querySelectorAll('.lv3-reveal');
  if (reveals.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-visible'));
  }

  if (!reducedMotion) {
    document.querySelectorAll('.lv3-motion-card, .lv3-map-motion img, .lv3-hero-bg').forEach((el) => {
      el.style.animationPlayState = 'running';
    });
  } else {
    document.documentElement.classList.add('lv3-reduced-motion');
  }

  if (!document.getElementById('lf-hero-product')) {
    document.querySelectorAll('.lv3-tabs').forEach((tablist) => {
      const tabs = tablist.querySelectorAll('.lv3-tab');
      tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
          tabs.forEach((t) => {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
          });
          tab.classList.add('active');
          tab.setAttribute('aria-selected', 'true');
        });
      });
    });
  }

  const loading = document.getElementById('lv3-loading');
  function hideLoading() {
    if (loading) loading.hidden = true;
  }
  function showLoading() {
    if (loading) loading.hidden = false;
  }
  hideLoading();
  window.addEventListener('pageshow', hideLoading);
  window.addEventListener('pagehide', hideLoading);
  window.addEventListener('popstate', hideLoading);
  window.addEventListener('focus', hideLoading);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') hideLoading();
  });
  document.querySelectorAll('a[href^="/app"]').forEach((link) => {
    link.addEventListener('click', () => {
      showLoading();
      window.setTimeout(hideLoading, 12000);
    });
  });
})();
