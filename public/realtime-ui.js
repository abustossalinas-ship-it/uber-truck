/** SSE — actualizaciones de viaje en tiempo real */

let activeStream = null;
let activeStreamMatchId = null;

function stopMatchRealtime() {
  if (activeStream) {
    activeStream.close();
    activeStream = null;
    activeStreamMatchId = null;
  }
}

function startMatchRealtime(matchId, onEvent) {
  stopMatchRealtime();
  if (!matchId || typeof Auth === 'undefined' || !Auth.token) return;
  activeStreamMatchId = matchId;
  const url = `/api/realtime/matches/${encodeURIComponent(matchId)}/stream?access_token=${encodeURIComponent(Auth.token)}`;
  const es = new EventSource(url);
  activeStream = es;
  es.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data);
      if (typeof onEvent === 'function') onEvent(data);
    } catch (err) {
      console.error('realtime parse', err);
    }
  };
  es.onerror = () => {
    stopMatchRealtime();
  };
}

function syncBoardRealtime(matches) {
  const active = (matches || []).find((m) => ['accepted', 'in_progress', 'proposed'].includes(m.status));
  if (!active) {
    stopMatchRealtime();
    return;
  }
  if (activeStreamMatchId === active.id) return;
  startMatchRealtime(active.id, (payload) => {
    if (payload.type === 'status' || payload.type === 'trip_event') {
      if (typeof refreshBoard === 'function') refreshBoard();
      if (typeof Comms !== 'undefined') Comms.refreshBell?.();
      const evType = payload.event?.event_type;
      if (
        payload.type === 'trip_event' &&
        ['location_update', 'approaching_destination', 'arrived_at_destination', 'arrival_at_destination'].includes(
          evType
        ) &&
        typeof refreshActiveTripMap === 'function'
      ) {
        refreshActiveTripMap(active.id);
      }
    }
  });
}

window.stopMatchRealtime = stopMatchRealtime;
window.startMatchRealtime = startMatchRealtime;
window.syncBoardRealtime = syncBoardRealtime;
