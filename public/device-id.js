/** ID estable por navegador/APK — sesión Cubik 30 días en este dispositivo. */
function getCubikDeviceId() {
  try {
    let id = localStorage.getItem('cubik_device_id');
    if (!id) {
      id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : 'd-' + Date.now() + '-' + Math.random().toString(36).slice(2, 12);
      localStorage.setItem('cubik_device_id', id);
    }
    return id;
  } catch (_) {
    return 'ephemeral-' + Date.now();
  }
}

function getAuthDevicePayload() {
  return {
    device_id: getCubikDeviceId(),
    surface: (location.hostname || '') + (location.pathname || ''),
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  };
}

window.getCubikDeviceId = getCubikDeviceId;
window.getAuthDevicePayload = getAuthDevicePayload;
