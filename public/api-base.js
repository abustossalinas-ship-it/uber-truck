/** Resuelve /api y /health hacia Railway cuando la UI se sirve desde Capacitor local. */
(function () {
  function apiOrigin() {
    try {
      return new URL(window.CUBIK_BRAND?.productionUrl || '').origin;
    } catch {
      return '';
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

  window.apiFetch = function apiFetch(path, options) {
    return fetch(resolveUrl(path), options);
  };

  const nativeFetch = window.fetch.bind(window);
  window.fetch = function patchedFetch(input, init) {
    if (typeof input === 'string') {
      if (input.startsWith('/api') || input.startsWith('/health')) {
        return nativeFetch(resolveUrl(input), init);
      }
    }
    return nativeFetch(input, init);
  };
})();
