/** Resuelve /api y /health hacia Railway cuando la UI se sirve desde Capacitor local. */
(function () {
  const DEFAULT_ORIGIN = 'https://uber-truck-production.up.railway.app';

  function apiOrigin() {
    try {
      const raw = window.CUBIK_BRAND?.productionUrl || DEFAULT_ORIGIN;
      return new URL(raw).origin;
    } catch {
      return DEFAULT_ORIGIN;
    }
  }

  function resolveUrl(path) {
    if (!path || path.startsWith('http')) return path;
    const origin = apiOrigin();
    if (!origin || typeof location === 'undefined') return path;
    if (location.origin === origin) return path;
    return `${origin}${path}`;
  }

  window.apiUrl = resolveUrl;
  window.apiOrigin = apiOrigin;

  window.apiFetch = function apiFetch(path, options) {
    return fetch(resolveUrl(path), options);
  };

  const nativeFetch = window.fetch.bind(window);
  window.docUrl = function docUrl(path) {
    return resolveUrl(path);
  };

  window.fetch = function patchedFetch(input, init) {
    if (typeof input === 'string') {
      if (
        input.startsWith('/api') ||
        input.startsWith('/health') ||
        input.startsWith('/docs/')
      ) {
        return nativeFetch(resolveUrl(input), init);
      }
    }
    return nativeFetch(input, init);
  };
})();
