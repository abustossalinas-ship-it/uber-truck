/** Mapa interactivo Google Maps — seguimiento en vivo tipo Uber */

const LiveMap = {
  _loadPromise: null,
  _apiKey: null,
  _instances: new Map(),
  _pollTimers: new Map(),

  async ensureReady() {
    if (window.google?.maps) return true;
    if (!this._loadPromise) {
      this._loadPromise = (async () => {
        const res = await fetch('/api/maps/js-config');
        const json = await res.json();
        if (!json.interactive || !json.apiKey) {
          throw new Error('Mapa interactivo no configurado (Maps JavaScript API)');
        }
        this._apiKey = json.apiKey;
        await new Promise((resolve, reject) => {
          const id = 'google-maps-js-sdk';
          if (document.getElementById(id)) {
            const wait = setInterval(() => {
              if (window.google?.maps) {
                clearInterval(wait);
                resolve();
              }
            }, 50);
            setTimeout(() => {
              clearInterval(wait);
              if (window.google?.maps) resolve();
              else reject(new Error('Timeout Google Maps'));
            }, 15000);
            return;
          }
          const cb = `__cubikMapsInit_${Date.now()}`;
          window[cb] = () => {
            delete window[cb];
            resolve();
          };
          const s = document.createElement('script');
          s.id = id;
          s.async = true;
          s.defer = true;
          s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(json.apiKey)}&v=weekly&callback=${cb}`;
          s.onerror = () => reject(new Error('No se pudo cargar Google Maps JS'));
          document.head.appendChild(s);
        });
      })();
    }
    await this._loadPromise;
    return true;
  },

  _containerKey(container) {
    return container.id || container.getAttribute('data-trip-map') || String(this._instances.size);
  },

  _circleIcon(color, scale = 10) {
    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: color,
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2,
      scale,
    };
  },

  _markerLabel(role) {
    if (role === 'origin') return '🏭';
    if (role === 'destination') return '📍';
    if (role === 'carrier') return '🚛';
    return '•';
  },

  _positionAgeMinutes(tracking) {
    const ts = tracking?.carrier_position?.updated_at;
    if (!ts) return null;
    return (Date.now() - new Date(ts).getTime()) / 60000;
  },

  _updateConnectivity(inst, tracking, pollFailed = false) {
    if (!inst.toolbar) return;
    let banner = inst.toolbar.querySelector('[data-live-map-stale]');
    if (!banner) {
      banner = document.createElement('p');
      banner.className = 'trip-map-stale muted';
      banner.dataset.liveMapStale = '1';
      inst.toolbar.insertBefore(banner, inst.toolbar.firstChild);
    }
    const age = this._positionAgeMinutes(tracking);
    const stale = pollFailed || (age != null && age > 15);
    if (stale) {
      banner.hidden = false;
      banner.removeAttribute('hidden');
      banner.textContent = pollFailed
        ? 'Sin conexión · mostrando la última posición guardada en el mapa'
        : `Sin señal GPS hace ${Math.round(age)} min · verifica ubicación «Permitir siempre»`;
    } else {
      banner.hidden = true;
      banner.setAttribute('hidden', '');
    }
    let help = inst.toolbar.querySelector('[data-live-map-help]');
    if (stale) {
      if (!help) {
        help = document.createElement('button');
        help.type = 'button';
        help.className = 'btn-secondary trip-map-help-btn';
        help.dataset.liveMapHelp = '1';
        help.textContent = 'Necesito ayuda';
        inst.toolbar.appendChild(help);
      }
      help.hidden = false;
      help.removeAttribute('hidden');
      help.onclick = () => {
        const title = tracking?.route?.destination?.label || 'Viaje en curso';
        if (typeof IncidentUI !== 'undefined') {
          IncidentUI.open(inst.matchId, title);
          IncidentUI.pickType('delay');
        } else {
          alert(
            'Reporta el problema desde Actividad → viaje en curso, o llama al embarcador con el botón Llamar.'
          );
        }
      };
    } else if (help) {
      help.hidden = true;
      help.setAttribute('hidden', '');
    }
  },

  _updateArrivalBanner(inst, tracking) {
    if (!inst.container) return;
    let banner = inst.container.querySelector('[data-trip-arrival-banner]');
    const role = typeof getActorRole === 'function' ? getActorRole() : 'shipper';
    const arrived = Boolean(tracking.arrived_at_destination_at || tracking.trip_phase === 'arrived');
    const approaching = Boolean(
      !arrived &&
        (tracking.approaching_destination ||
          (tracking.trip_phase === 'delivery' &&
            tracking.eta?.duration_min != null &&
            tracking.eta.duration_min <= 5))
    );

    if (!approaching && !arrived) {
      if (banner) banner.remove();
      return;
    }

    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'trip-arrival-banner';
      banner.dataset.tripArrivalBanner = '1';
      inst.container.insertBefore(banner, inst.container.firstChild);
    }

    banner.classList.toggle('trip-arrival-banner--approaching', approaching && !arrived);
    banner.classList.toggle('trip-arrival-banner--arrived', arrived);

    if (arrived) {
      banner.innerHTML = `
        <span class="trip-arrival-banner-icon" aria-hidden="true">📍</span>
        <div class="trip-arrival-banner-copy">
          <strong>${role === 'shipper' ? 'Transportista en destino' : 'Llegaste al destino'}</strong>
          <span>${role === 'shipper' ? 'El camión dejó de estar en ruta. Confirma cuando recibas la carga.' : 'Marca entregado cuando descargues la carga.'}</span>
        </div>`;
      return;
    }

    const etaText = tracking.eta?.duration_text || '~5 min';
    banner.innerHTML = `
      <span class="trip-arrival-banner-icon" aria-hidden="true">🚛</span>
      <div class="trip-arrival-banner-copy">
        <strong>${role === 'shipper' ? 'Transportista llegando al destino' : 'Llegando al destino'}</strong>
        <span>${role === 'shipper' ? `Se acerca · ETA ${etaText}` : `Faltan ${etaText} · al llegar, marca entregado`}</span>
      </div>`;
  },

  _ensureInstance(container, tracking) {
    const key = this._containerKey(container);
    let inst = this._instances.get(key);
    if (
      inst &&
      inst.container === container &&
      document.contains(container) &&
      inst.matchId === tracking.match_id &&
      inst.map
    ) {
      return inst;
    }

    if (inst) {
      this.stopPoll(key);
      if (inst.markers) Object.values(inst.markers).forEach((m) => m.setMap(null));
      if (inst.routePolyline) inst.routePolyline.setMap(null);
      if (inst.trailPolyline) inst.trailPolyline.setMap(null);
      this._instances.delete(key);
    }

    this.stopPoll(key);
    container.innerHTML = '';
    const toolbar = document.createElement('div');
    toolbar.className = 'trip-map-toolbar';
    toolbar.dataset.liveMapToolbar = '1';

    const etaEl = document.createElement('span');
    etaEl.className = 'trip-map-eta';
    etaEl.dataset.liveMapEta = '1';
    toolbar.appendChild(etaEl);

    const navBtn = document.createElement('button');
    navBtn.type = 'button';
    navBtn.className = 'btn-secondary trip-map-nav-btn';
    navBtn.textContent = 'Navegar';
    navBtn.hidden = true;
    navBtn.dataset.liveMapNav = '1';
    toolbar.appendChild(navBtn);

    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'btn-match-cta trip-map-action-btn';
    actionBtn.textContent = 'Marcar entregado';
    actionBtn.hidden = true;
    actionBtn.dataset.liveMapAction = '1';
    toolbar.appendChild(actionBtn);

    const mapEl = document.createElement('div');
    mapEl.className = 'trip-map-live';
    mapEl.setAttribute('role', 'img');
    mapEl.setAttribute('aria-label', 'Mapa del viaje en curso');

    const meta = document.createElement('p');
    meta.className = 'muted trip-map-meta';
    meta.dataset.liveMapMeta = '1';

    container.appendChild(toolbar);
    container.appendChild(mapEl);
    container.appendChild(meta);

    const center = tracking.route?.origin || tracking.carrier_position || { lat: -33.45, lng: -70.65 };
    const map = new google.maps.Map(mapEl, {
      center: { lat: center.lat, lng: center.lng },
      zoom: 12,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      gestureHandling: 'greedy',
    });

    inst = {
      key,
      container,
      matchId: tracking.match_id,
      map,
      mapEl,
      toolbar,
      etaEl,
      navBtn,
      actionBtn,
      meta,
      markers: {},
      routePolyline: null,
      trailPolyline: null,
      lastCarrier: null,
      followMode: true,
      lastTracking: null,
    };
    this._instances.set(key, inst);
    return inst;
  },

  _setMarker(inst, role, pos, color, scale) {
    if (pos?.lat == null || pos?.lng == null) {
      if (inst.markers[role]) {
        inst.markers[role].setMap(null);
        delete inst.markers[role];
      }
      return;
    }
    const latLng = { lat: pos.lat, lng: pos.lng };
    const label = this._markerLabel(role);
    if (!inst.markers[role]) {
      inst.markers[role] = new google.maps.Marker({
        map: inst.map,
        position: latLng,
        icon: this._circleIcon(color, scale),
        label: {
          text: label,
          fontSize: role === 'carrier' ? '15px' : '13px',
          fontWeight: '700',
        },
        title:
          role === 'origin'
            ? 'Embarcadero'
            : role === 'destination'
              ? 'Destino'
              : 'Transportista',
        zIndex: role === 'carrier' ? 3 : role === 'destination' ? 2 : 1,
      });
    } else if (role === 'carrier') {
      this._animateMarker(inst.markers[role], latLng, 1800);
    } else {
      inst.markers[role].setPosition(latLng);
    }
  },

  _animateMarker(marker, to, duration = 1800) {
    const start = marker.getPosition();
    if (!start) {
      marker.setPosition(to);
      return;
    }
    const sLat = start.lat();
    const sLng = start.lng();
    const dLat = to.lat - sLat;
    const dLng = to.lng - sLng;
    if (Math.abs(dLat) < 0.000005 && Math.abs(dLng) < 0.000005) return;
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      const ease = t * (2 - t);
      marker.setPosition({ lat: sLat + dLat * ease, lng: sLng + dLng * ease });
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },

  _smoothPanTo(inst, pos) {
    if (!pos?.lat || !inst.followMode) return;
    const map = inst.map;
    const start = map.getCenter();
    if (!start) {
      map.panTo(pos);
      return;
    }
    const sLat = start.lat();
    const sLng = start.lng();
    const dLat = pos.lat - sLat;
    const dLng = pos.lng - sLng;
    const t0 = performance.now();
    const duration = 1200;
    const step = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      const ease = t * (2 - t);
      map.setCenter({ lat: sLat + dLat * ease, lng: sLng + dLng * ease });
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    if (map.getZoom() < 13) map.setZoom(13);
  },

  _updateRouteLine(inst, tracking) {
    if (tracking.trip_phase === 'arrived' || tracking.arrived_at_destination_at || tracking.route_live === false) {
      if (inst.routePolyline) {
        inst.routePolyline.setMap(null);
        inst.routePolyline = null;
      }
      return;
    }
    const path = tracking.route?.driving_path;
    if (!path?.length) {
      const o = tracking.route?.origin;
      const d = tracking.route?.destination;
      if (!o?.lat || !d?.lat) {
        if (inst.routePolyline) {
          inst.routePolyline.setMap(null);
          inst.routePolyline = null;
        }
        return;
      }
      const fallback = [
        { lat: o.lat, lng: o.lng },
        { lat: d.lat, lng: d.lng },
      ];
      this._drawPolyline(inst, 'routePolyline', fallback, '#f26522', 0.45, 4);
      return;
    }
    this._drawPolyline(inst, 'routePolyline', path, '#f26522', 0.5, 4);
  },

  _updateTrailLine(inst, tracking) {
    const trail = tracking.location_trail || [];
    if (trail.length < 2) {
      if (inst.trailPolyline) {
        inst.trailPolyline.setMap(null);
        inst.trailPolyline = null;
      }
      return;
    }
    const path = trail.map((p) => ({ lat: p.lat, lng: p.lng }));
    this._drawPolyline(inst, 'trailPolyline', path, '#1a73e8', 0.95, 5);
  },

  _drawPolyline(inst, key, path, color, opacity, weight) {
    if (!inst[key]) {
      inst[key] = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: color,
        strokeOpacity: opacity,
        strokeWeight: weight,
        map: inst.map,
      });
    } else {
      inst[key].setPath(path);
    }
  },

  _fitBounds(inst, tracking) {
    const bounds = new google.maps.LatLngBounds();
    let n = 0;
    const add = (p) => {
      if (p?.lat != null && p?.lng != null) {
        bounds.extend({ lat: p.lat, lng: p.lng });
        n++;
      }
    };
    add(tracking.route?.origin);
    add(tracking.route?.destination);
    add(tracking.carrier_position);
    (tracking.location_trail || []).forEach(add);
    if (n >= 2) {
      inst.map.fitBounds(bounds, { top: 56, right: 48, bottom: 48, left: 48 });
    } else if (n === 1) {
      inst.map.setCenter(bounds.getCenter());
      inst.map.setZoom(13);
    }
  },

  _formatTime(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return '';
    }
  },

  _openNavUrl(href) {
    if (!href) return;
    if (window.Capacitor?.isNativePlatform?.()) {
      window.location.href = href;
      return;
    }
    window.open(href, '_blank', 'noopener,noreferrer');
  },

  openNavigationPicker(tracking) {
    const modal = document.getElementById('nav-picker-modal');
    if (!modal || !tracking?.navigation_url) return;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    modal.dataset.tracking = JSON.stringify({
      navigation_url: tracking.navigation_url,
      navigation_android_intent: tracking.navigation_android_intent,
      navigation_waze_url: tracking.navigation_waze_url,
      navigation_waze_intent: tracking.navigation_waze_intent,
    });
  },

  _bindNavButton(inst, tracking) {
    const url = tracking.navigation_url;
    if (!inst.navBtn) return;
    if (!url || tracking.trip_phase === 'arrived' || tracking.arrived_at_destination_at) {
      inst.navBtn.hidden = true;
      return;
    }
    inst.navBtn.hidden = false;
    inst.navBtn.onclick = () => this.openNavigationPicker(tracking);
  },

  _bindTripActionButton(inst, tracking) {
    const btn = inst.actionBtn;
    if (!btn) return;
    const role = typeof getActorRole === 'function' ? getActorRole() : null;
    const matchId = tracking.match_id;
    btn.hidden = true;
    btn.onclick = null;
    if (role !== 'carrier' || !matchId) return;

    if (tracking.status === 'accepted') {
      btn.hidden = false;
      btn.textContent = tracking.pickup_ready
        ? 'En embarcadero — retirar carga'
        : 'Carga retirada — en ruta';
      btn.onclick = () => {
        if (typeof window.runTripProgress === 'function') {
          window.runTripProgress(matchId, btn);
        }
      };
      return;
    }

    if (tracking.status === 'in_progress' && !tracking.carrier_marked_delivered_at) {
      btn.hidden = false;
      if (tracking.arrived_at_destination_at || tracking.trip_phase === 'arrived') {
        btn.textContent = 'Llegaste — marcar entregado';
      } else {
        btn.textContent = tracking.arrival_ready
          ? 'Llegaste — marcar entregado'
          : 'Marcar entregado en destino';
      }
      btn.onclick = () => {
        if (typeof window.openTripDelivery === 'function') {
          window.openTripDelivery(matchId, btn);
        }
      };
    }
  },

  _updateEta(inst, tracking) {
    if (!inst.etaEl) return;
    if (tracking.trip_phase === 'arrived' || tracking.arrived_at_destination_at) {
      inst.etaEl.hidden = true;
      inst.etaEl.textContent = '';
      return;
    }
    if (tracking.eta?.duration_text) {
      const prefix =
        tracking.trip_phase === 'pickup' || tracking.eta?.phase === 'pickup'
          ? 'Embarcadero'
          : 'Llegada';
      inst.etaEl.textContent = `${prefix} ~${tracking.eta.duration_text}`;
      inst.etaEl.hidden = false;
    } else {
      inst.etaEl.hidden = true;
      inst.etaEl.textContent = '';
    }
  },

  _updateMeta(inst, tracking) {
    if (!inst.meta) return;
    const t = this._formatTime(tracking.carrier_position?.updated_at);
    const trailN = (tracking.location_trail || []).length;
    if (tracking.carrier_position) {
      const phaseLabel =
        tracking.trip_phase === 'pickup'
          ? 'Ir a embarcadero'
          : tracking.trip_phase === 'arrived'
            ? 'En destino'
            : 'Camión en vivo';
      let line = `${phaseLabel}${t ? ` · ${t}` : ''}`;
      if (tracking.eta?.duration_text && tracking.trip_phase !== 'arrived') {
        line += ` · ETA ${tracking.eta.duration_text}`;
      }
      if (trailN > 1) line += ` · recorrido ${trailN} pts`;
      if (tracking.arrival_ready) {
        line += ' · GPS: cerca del destino';
      } else if (tracking.pickup_ready) {
        line += ' · GPS: en embarcadero';
      }
      inst.meta.textContent = line;
    } else if (tracking.trip_phase === 'pickup') {
      inst.meta.textContent =
        'Fase retiro: 🏭 embarcadero · 🚛 transportista. Activa GPS para ver tu posición en el mapa.';
    } else {
      inst.meta.textContent =
        '🏭 origen · 📍 destino · 🚛 camión. Línea azul = recorrido GPS del transportista.';
    }
  },

  startPoll(container, matchId, fetchTracking) {
    const key = this._containerKey(container);
    this.stopPoll(key);
    const tick = async () => {
      if (!document.contains(container) || container.hidden) return;
      const key = this._containerKey(container);
      const inst = this._instances.get(key);
      try {
        const tracking = await fetchTracking(matchId);
        if (tracking?.tracking_active) {
          await this.render(container, tracking, { pollFailed: false });
        }
      } catch (e) {
        console.warn('LiveMap poll', e);
        if (inst?.lastTracking) {
          await this.render(container, inst.lastTracking, { pollFailed: true });
        } else if (inst) {
          this._updateConnectivity(inst, inst.lastTracking, true);
        }
      }
    };
    const id = setInterval(tick, 8000);
    this._pollTimers.set(key, id);
  },

  stopPoll(key) {
    const id = this._pollTimers.get(key);
    if (id) {
      clearInterval(id);
      this._pollTimers.delete(key);
    }
  },

  async render(container, tracking, opts = {}) {
    if (!container || !tracking?.tracking_active) {
      this.destroy(container);
      return false;
    }
    try {
      await this.ensureReady();
    } catch (e) {
      console.warn('LiveMap fallback static', e);
      return false;
    }

    const inst = this._ensureInstance(container, tracking);
    inst.lastTracking = tracking;
    this._setMarker(inst, 'origin', tracking.route?.origin, '#22a06b', 9);
    this._setMarker(inst, 'destination', tracking.route?.destination, '#de350b', 9);
    this._setMarker(inst, 'carrier', tracking.carrier_position, '#f26522', 12);
    this._updateRouteLine(inst, tracking);
    this._updateTrailLine(inst, tracking);
    if (!inst.lastCarrier) this._fitBounds(inst, tracking);
    else if (tracking.carrier_position) this._smoothPanTo(inst, tracking.carrier_position);
    inst.lastCarrier = tracking.carrier_position
      ? { ...tracking.carrier_position }
      : inst.lastCarrier;
    this._updateEta(inst, tracking);
    this._updateMeta(inst, tracking);
    this._updateArrivalBanner(inst, tracking);
    this._updateConnectivity(inst, tracking, Boolean(opts.pollFailed));
    this._bindNavButton(inst, tracking);
    this._bindTripActionButton(inst, tracking);
    return true;
  },

  destroy(container) {
    if (!container) return;
    const key = this._containerKey(container);
    this.stopPoll(key);
    const inst = this._instances.get(key);
    if (inst && inst.container === container) {
      Object.values(inst.markers || {}).forEach((m) => m.setMap(null));
      if (inst.routePolyline) inst.routePolyline.setMap(null);
      if (inst.trailPolyline) inst.trailPolyline.setMap(null);
      this._instances.delete(key);
    }
    container.innerHTML = '';
    container.hidden = true;
  },
};

function bindNavPickerModal() {
  const modal = document.getElementById('nav-picker-modal');
  if (!modal || modal.dataset.bound === '1') return;
  modal.dataset.bound = '1';
  modal.querySelector('[data-nav-close]')?.addEventListener('click', () => {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
  });
  modal.querySelector('[data-nav-backdrop]')?.addEventListener('click', () => {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
  });
  modal.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-nav-app]');
    if (!btn) return;
    let tracking = {};
    try {
      tracking = JSON.parse(modal.dataset.tracking || '{}');
    } catch (_) {}
    const app = btn.dataset.navApp;
    const isNative = window.Capacitor?.isNativePlatform?.();
    if (app === 'google') {
      if (isNative && tracking.navigation_android_intent) {
        LiveMap._openNavUrl(tracking.navigation_android_intent);
      } else {
        LiveMap._openNavUrl(tracking.navigation_url);
      }
    } else if (app === 'waze') {
      LiveMap._openNavUrl(tracking.navigation_waze_url || tracking.navigation_waze_intent);
    }
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindNavPickerModal);
} else {
  bindNavPickerModal();
}

window.LiveMap = LiveMap;
