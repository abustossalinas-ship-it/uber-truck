/** Mapa interactivo Google Maps — seguimiento en vivo tipo Uber */

const LiveMap = {
  _loadPromise: null,
  _apiKey: null,
  _instances: new Map(),

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

  _ensureInstance(container, tracking) {
    const key = this._containerKey(container);
    let inst = this._instances.get(key);
    if (inst && inst.matchId === tracking.match_id && inst.map) return inst;

    container.innerHTML = '';
    const mapEl = document.createElement('div');
    mapEl.className = 'trip-map-live';
    mapEl.setAttribute('role', 'img');
    mapEl.setAttribute('aria-label', 'Mapa del viaje en curso');
    container.appendChild(mapEl);

    const meta = document.createElement('p');
    meta.className = 'muted trip-map-meta';
    meta.dataset.liveMapMeta = '1';
    container.appendChild(meta);

    const center = tracking.route?.origin || tracking.carrier_position || { lat: -33.45, lng: -70.65 };
    const map = new google.maps.Map(mapEl, {
      center: { lat: center.lat, lng: center.lng },
      zoom: 11,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      gestureHandling: 'greedy',
    });

    inst = {
      key,
      matchId: tracking.match_id,
      map,
      mapEl,
      meta,
      markers: {},
      polyline: null,
      lastCarrier: null,
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
    if (!inst.markers[role]) {
      inst.markers[role] = new google.maps.Marker({
        map: inst.map,
        position: latLng,
        icon: this._circleIcon(color, scale),
        zIndex: role === 'carrier' ? 3 : role === 'destination' ? 2 : 1,
        title: role === 'carrier' ? 'Transportista' : role === 'destination' ? 'Destino' : 'Origen',
      });
    } else {
      if (role === 'carrier') this._animateMarker(inst.markers[role], latLng);
      else inst.markers[role].setPosition(latLng);
    }
  },

  _animateMarker(marker, to, duration = 900) {
    const start = marker.getPosition();
    if (!start) {
      marker.setPosition(to);
      return;
    }
    const sLat = start.lat();
    const sLng = start.lng();
    const dLat = to.lat - sLat;
    const dLng = to.lng - sLng;
    if (Math.abs(dLat) < 0.00001 && Math.abs(dLng) < 0.00001) return;
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      const ease = t * (2 - t);
      marker.setPosition({ lat: sLat + dLat * ease, lng: sLng + dLng * ease });
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },

  _updateRouteLine(inst, tracking) {
    const o = tracking.route?.origin;
    const d = tracking.route?.destination;
    if (!o?.lat || !d?.lat) {
      if (inst.polyline) {
        inst.polyline.setMap(null);
        inst.polyline = null;
      }
      return;
    }
    const path = [
      { lat: o.lat, lng: o.lng },
      { lat: d.lat, lng: d.lng },
    ];
    if (!inst.polyline) {
      inst.polyline = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: '#f26522',
        strokeOpacity: 0.85,
        strokeWeight: 4,
        map: inst.map,
      });
    } else {
      inst.polyline.setPath(path);
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
    if (n >= 2) {
      inst.map.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });
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

  _updateMeta(inst, tracking) {
    if (!inst.meta) return;
    const t = this._formatTime(tracking.carrier_position?.updated_at);
    if (tracking.carrier_position) {
      inst.meta.textContent = `Camión en mapa (naranja)${t ? ` · ${t}` : ''} · mapa interactivo`;
    } else {
      inst.meta.textContent =
        'Origen (verde) y destino (rojo). El camión aparece cuando el transportista comparte GPS.';
    }
  },

  async render(container, tracking) {
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
    this._setMarker(inst, 'origin', tracking.route?.origin, '#22a06b', 9);
    this._setMarker(inst, 'destination', tracking.route?.destination, '#de350b', 9);
    this._setMarker(inst, 'carrier', tracking.carrier_position, '#f26522', 11);
    this._updateRouteLine(inst, tracking);
    if (!inst.lastCarrier) this._fitBounds(inst, tracking);
    else if (tracking.carrier_position) {
      inst.map.panTo({ lat: tracking.carrier_position.lat, lng: tracking.carrier_position.lng });
    }
    inst.lastCarrier = tracking.carrier_position
      ? { ...tracking.carrier_position }
      : inst.lastCarrier;
    this._updateMeta(inst, tracking);
    return true;
  },

  destroy(container) {
    if (!container) return;
    const key = this._containerKey(container);
    const inst = this._instances.get(key);
    if (inst) {
      Object.values(inst.markers).forEach((m) => m.setMap(null));
      if (inst.polyline) inst.polyline.setMap(null);
      this._instances.delete(key);
    }
    container.innerHTML = '';
    container.hidden = true;
  },
};

window.LiveMap = LiveMap;
