(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('lf-smooth');

  const CHILE_ROUTE = [
    [0.22, 0.88], [0.28, 0.72], [0.32, 0.58], [0.38, 0.48],
    [0.44, 0.38], [0.52, 0.28], [0.62, 0.18], [0.72, 0.12],
  ];

  const TOWER_ROUTE = [
    [0.18, 0.82], [0.24, 0.68], [0.3, 0.55], [0.38, 0.42],
    [0.48, 0.3], [0.58, 0.22], [0.68, 0.16], [0.78, 0.12],
  ];

  function themeColors() {
    const body = getComputedStyle(document.body);
    const root = getComputedStyle(document.documentElement);
    const pick = (name) => (body.getPropertyValue(name) || root.getPropertyValue(name)).trim();
    return {
      accent: pick('--cubik-teal') || '#06b6d4',
      ink: pick('--cubik-ink') || '#0f172a',
      petrol: pick('--cubik-petrol') || '#164e63',
      navyDark: pick('--cubik-navy-dark') || '#0a1628',
      orange: pick('--cubik-teal-light') || '#22d3ee',
    };
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function routePoint(route, t, w, h) {
    const seg = (route.length - 1) * t;
    const i = Math.min(route.length - 2, Math.floor(seg));
    const f = seg - i;
    const a = route[i];
    const b = route[i + 1];
    return { x: lerp(a[0], b[0], f) * w, y: lerp(a[1], b[1], f) * h };
  }

  function drawMapFrame(ctx, w, h, route, progress, opts) {
    const { large = false } = opts || {};
    const colors = themeColors();
    ctx.clearRect(0, 0, w, h);

    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, colors.navyDark);
    bg.addColorStop(1, colors.petrol);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = colors.petrol + '59';
    ctx.beginPath();
    ctx.moveTo(w * 0.35, h * 0.08);
    ctx.bezierCurveTo(w * 0.55, h * 0.1, w * 0.62, h * 0.35, w * 0.58, h * 0.55);
    ctx.bezierCurveTo(w * 0.52, h * 0.78, w * 0.28, h * 0.92, w * 0.2, h * 0.88);
    ctx.bezierCurveTo(w * 0.12, h * 0.7, w * 0.18, h * 0.35, w * 0.35, h * 0.08);
    ctx.fill();

    ctx.strokeStyle = colors.accent + '14';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    ctx.save();
    ctx.strokeStyle = colors.accent + '73';
    ctx.lineWidth = large ? 5 : 3;
    ctx.shadowColor = colors.accent;
    ctx.shadowBlur = large ? 18 : 10;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -progress * 40;
    ctx.beginPath();
    route.forEach((p, i) => {
      const x = p[0] * w;
      const y = p[1] * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();

    const truck = routePoint(route, progress % 1, w, h);
    const angle = (() => {
      const t2 = (progress + 0.02) % 1;
      const p2 = routePoint(route, t2, w, h);
      return Math.atan2(p2.y - truck.y, p2.x - truck.x);
    })();

    ctx.save();
    ctx.translate(truck.x, truck.y);
    ctx.rotate(angle);
    ctx.shadowColor = colors.accent;
    ctx.shadowBlur = 14;
    ctx.fillStyle = colors.accent;
    ctx.fillRect(-14, -6, 20, 10);
    ctx.fillStyle = colors.ink;
    ctx.fillRect(2, -4, 9, 7);
    ctx.beginPath();
    ctx.arc(-8, 6, 3, 0, Math.PI * 2);
    ctx.arc(8, 6, 3, 0, Math.PI * 2);
    ctx.fillStyle = colors.ink;
    ctx.fill();
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    [[route[0], colors.accent], [route[route.length - 1], colors.orange]].forEach(([p, color]) => {
      const pulse = 0.6 + Math.sin(progress * Math.PI * 2) * 0.4;
      ctx.beginPath();
      ctx.arc(p[0] * w, p[1] * h, (large ? 8 : 5) * pulse, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.35;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(p[0] * w, p[1] * h, large ? 4 : 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });
  }

  function mountCanvasMap(canvas, route, large) {
    if (!canvas) return () => {};
    const ctx = canvas.getContext('2d');
    let raf = 0;
    let start = 0;
    let visible = true;

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) loop(performance.now());
    }, { threshold: 0.15 });
    io.observe(canvas);

    function loop(ts) {
      if (!visible || reduced) {
        raf = 0;
        return;
      }
      if (!start) start = ts;
      const t = ((ts - start) / (large ? 14000 : 9000)) % 1;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width * dpr));
      const h = Math.max(1, Math.floor((rect.width * (large ? 0.55 : 0.42)) * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      drawMapFrame(ctx, w, h, route, t, { large });
      raf = requestAnimationFrame(loop);
    }

    if (!reduced) raf = requestAnimationFrame(loop);
    else {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientWidth * 0.42 * dpr);
      drawMapFrame(ctx, canvas.width, canvas.height, route, 0.35, { large });
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
    };
  }

  function initCounters() {
    document.querySelectorAll('[data-count]:not(.lf-kpi-val)').forEach((el) => {
      const target = Number(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      const prefix = el.dataset.prefix || '';
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        if (reduced) {
          el.textContent = prefix + target + suffix;
          return;
        }
        const dur = 1200;
        const t0 = performance.now();
        function tick(now) {
          const p = Math.min(1, (now - t0) / dur);
          const val = Math.round(target * (1 - Math.pow(1 - p, 3)));
          el.textContent = prefix + val + suffix;
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      }, { threshold: 0.4 });
      io.observe(el);
    });
  }

  function initLoadList() {
    const list = document.getElementById('lf-loads');
    if (!list) return;
    const items = list.querySelectorAll('li');
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      items.forEach((li, i) => {
        setTimeout(() => li.classList.add('is-in'), reduced ? 0 : i * 180);
      });
      io.disconnect();
    }, { threshold: 0.3 });
    io.observe(list);
  }

  function initScrollSections() {
    document.querySelectorAll('.lf-scroll-section').forEach((el) => {
      const io = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) {
          el.classList.add('is-in');
          io.unobserve(el);
        }
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
      io.observe(el);
    });
  }

  const HERO_CINE_SRC = {
    'lv3-home': '/brand/landing/hero-home-truck-dark.png',
    'lv3-shipper': '/brand/landing/mockup-hero-bg.jpg',
    'lv3-carrier': '/brand/landing/hero-truck-night.jpg',
  };

  const HERO_VIDEO_SRC = {
    'lv3-carrier': '/brand/landing/hero-carrier-cine.mp4',
  };

  function pageRole() {
    return ['lv3-home', 'lv3-shipper', 'lv3-carrier'].find((c) => document.body.classList.contains(c)) || 'lv3-home';
  }

  function initCinematicCanvas(hero, media, src, role) {
    let canvas = document.getElementById('lf-hero-cine');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'lf-hero-cine';
      canvas.className = 'lf-hero-cine-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      media.insertBefore(canvas, media.firstChild);
    }

    hero.classList.add('has-cine');
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    const ctx = canvas.getContext('2d');
    let raf = 0;
    let start = 0;
    const isNight = role === 'lv3-carrier';

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
    }

    function draw(ts) {
      if (!start) start = ts;
      const t = (ts - start) / 1000;
      const w = canvas.width;
      const h = canvas.height;
      if (!w || !h || !img.complete) {
        raf = requestAnimationFrame(draw);
        return;
      }

      const panX = Math.sin(t * 0.12) * 0.018 + Math.cos(t * 0.07) * 0.012;
      const panY = Math.cos(t * 0.1) * 0.014;
      const zoom = 1.06 + Math.sin(t * 0.08) * 0.035;
      const iw = img.width;
      const ih = img.height;
      const scale = Math.max(w / iw, h / ih) * zoom;
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (w - dw) / 2 + panX * w;
      const dy = (h - dh) / 2 + panY * h;

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, dx, dy, dw, dh);

      const vignette = ctx.createRadialGradient(w * 0.5, h * 0.45, w * 0.15, w * 0.5, h * 0.5, w * 0.72);
      vignette.addColorStop(0, 'rgba(15, 23, 42, 0)');
      vignette.addColorStop(1, 'rgba(15, 23, 42, 0.55)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);

      const roadY = h * 0.78;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
      ctx.fillRect(0, roadY, w, h - roadY);

      const accent = themeColors().accent;
      for (let i = 0; i < 6; i += 1) {
        const lane = ((t * (isNight ? 140 : 95) + i * 0.17) % 1) * w;
        ctx.strokeStyle = accent + (isNight ? '55' : '33');
        ctx.lineWidth = 2 * (window.devicePixelRatio || 1);
        ctx.beginPath();
        ctx.moveTo(lane, roadY + h * 0.04);
        ctx.lineTo(lane + w * 0.08, roadY + h * 0.04);
        ctx.stroke();
      }

      if (isNight) {
        for (let i = 0; i < 5; i += 1) {
          const bx = (0.15 + i * 0.18 + Math.sin(t * 0.5 + i) * 0.02) * w;
          const by = (0.35 + Math.cos(t * 0.3 + i) * 0.04) * h;
          const glow = ctx.createRadialGradient(bx, by, 0, bx, by, w * 0.12);
          glow.addColorStop(0, accent + '44');
          glow.addColorStop(1, accent + '00');
          ctx.fillStyle = glow;
          ctx.fillRect(bx - w * 0.12, by - w * 0.12, w * 0.24, w * 0.24);
        }
      }

      raf = requestAnimationFrame(draw);
    }

    img.onload = () => {
      resize();
      if (!reduced) raf = requestAnimationFrame(draw);
      else {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
    };
    img.onerror = () => hero.classList.remove('has-cine');
    window.addEventListener('resize', resize);
    resize();
  }

  function mountBgVideo(media, hero, videoSrc, poster, startCanvas) {
    const video = document.createElement('video');
    video.className = 'lf-hero-video';
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute('aria-hidden', 'true');
    video.poster = poster;
    const source = document.createElement('source');
    source.src = videoSrc;
    source.type = 'video/mp4';
    video.appendChild(source);
    media.insertBefore(video, media.firstChild);
    hero.classList.add('has-video');
    video.addEventListener('error', () => {
      video.remove();
      hero.classList.remove('has-video');
      startCanvas();
    });
    video.play().catch(startCanvas);
  }

  function initHeroVideo() {
    const hero = document.querySelector('.lv3-hero.has-fluid');
    const media = hero?.querySelector('.lf-hero-media');
    if (!hero || !media) return;

    const role = pageRole();
    const poster = HERO_CINE_SRC[role];
    const videoSrc = HERO_VIDEO_SRC[role];

    function startCanvas() {
      if (!reduced) initCinematicCanvas(hero, media, poster, role);
    }

    if (reduced) return;

    if (role === 'lv3-shipper') {
      startCanvas();
      return;
    }

    if (!videoSrc) {
      startCanvas();
      return;
    }

    fetch(videoSrc, { method: 'HEAD' })
      .then((res) => {
        if (!res.ok) throw new Error('no video');
        mountBgVideo(media, hero, videoSrc, poster, startCanvas);
      })
      .catch(startCanvas);
  }

  function initShipperProductVideo() {
    if (!document.body.classList.contains('lv3-shipper') || reduced) return;
    const video = document.querySelector('.lf-tablet-video');
    if (video) video.play().catch(() => {});
  }

  function initHomeHeroVideo() {
    if (!document.body.classList.contains('lv3-home') || reduced) return;
    const video = document.querySelector('.lf-hero-home-video');
    if (video) video.play().catch(() => {});
  }

  function initHomeTruckMotion() {
    if (!document.body.classList.contains('lv3-home') || reduced) return;
    const canvas = document.getElementById('lf-home-truck-motion');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const streaks = Array.from({ length: 14 }, () => ({
      y: 0.55 + Math.random() * 0.35,
      x: Math.random(),
      len: 0.06 + Math.random() * 0.14,
      speed: 0.35 + Math.random() * 0.55,
    }));
    const nodes = Array.from({ length: 10 }, () => ({
      x: 0.1 + Math.random() * 0.85,
      y: 0.08 + Math.random() * 0.42,
      pulse: Math.random() * Math.PI * 2,
    }));
    let raf = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
    }

    function draw(ts) {
      const colors = themeColors();
      const w = canvas.width;
      const h = canvas.height;
      if (!w || !h) {
        raf = requestAnimationFrame(draw);
        return;
      }
      ctx.clearRect(0, 0, w, h);
      const t = (ts || 0) / 1000;

      nodes.forEach((n, i) => {
        nodes.slice(i + 1, i + 3).forEach((m) => {
          ctx.strokeStyle = colors.accent + '18';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(n.x * w, n.y * h);
          ctx.lineTo(m.x * w, m.y * h);
          ctx.stroke();
        });
      });

      nodes.forEach((n) => {
        const pulse = 0.5 + Math.sin(t * 1.8 + n.pulse) * 0.35;
        ctx.beginPath();
        ctx.arc(n.x * w, n.y * h, 3 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = colors.accent + '44';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(n.x * w, n.y * h, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = colors.accent;
        ctx.fill();
      });

      streaks.forEach((s) => {
        s.x += s.speed * 0.004;
        if (s.x > 1.3) s.x = -0.25;
        const x = s.x * w;
        const y = s.y * h;
        const grad = ctx.createLinearGradient(x, y, x + s.len * w, y);
        grad.addColorStop(0, colors.accent + '00');
        grad.addColorStop(0.45, colors.accent + '55');
        grad.addColorStop(1, colors.accent + '00');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + s.len * w, y);
        ctx.stroke();
      });

      raf = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(draw);
  }

  function initCarrierPhoneVideo() {
    if (!document.body.classList.contains('lv3-carrier') || reduced) return;
    const video = document.querySelector('.lf-phone-video');
    if (!video) return;
    video.play().catch(() => {});
  }

  function initDepthLayers() {
    const hero = document.querySelector('.lv3-hero.has-fluid');
    if (!hero || hero.querySelector('.lf-hero-vignette')) return;
    const vignette = document.createElement('div');
    vignette.className = 'lf-hero-vignette';
    vignette.setAttribute('aria-hidden', 'true');
    const inner = hero.querySelector('.lv3-hero-inner');
    if (inner) hero.insertBefore(vignette, inner);
  }

  function initCarrierTruckGlow() {
    if (!document.body.classList.contains('lv3-carrier')) return;
    const hero = document.querySelector('.lv3-hero.has-fluid');
    if (!hero || hero.querySelector('.lf-hero-truck-glow')) return;
    const glow = document.createElement('div');
    glow.className = 'lf-hero-truck-glow';
    glow.setAttribute('aria-hidden', 'true');
    hero.appendChild(glow);
  }

  function initFloatingCards() {
    const hero = document.querySelector('.lv3-hero.has-fluid');
    if (!hero || reduced || hero.querySelector('.lf-float-card')) return;

    const sets = {
      'lv3-home': [
        { l: 'Viajes activos', v: '127', live: true },
        { l: 'En tránsito', v: '43', live: true },
      ],
      'lv3-shipper': [
        { l: 'Ofertas hoy', v: '28', live: true },
        { l: 'Envíos activos', v: '124', live: true },
      ],
      'lv3-carrier': [
        { l: 'Ganancias hoy', v: '$184.200', live: true },
        { l: 'Cargas en tu ruta', v: '12', live: true },
        { l: 'Ruta activa', v: 'Santiago → Iquique', live: false },
      ],
    };

    (sets[pageRole()] || sets['lv3-home']).forEach((card, i) => {
      const el = document.createElement('div');
      el.className = `lf-float-card lf-float-card--${i + 1}`;
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML = `<span class="lf-float-card-label">${card.l}</span><strong class="lf-float-card-val"${card.live ? ' data-live="1"' : ''}>${card.v}</strong>`;
      hero.appendChild(el);
    });
  }

  function initDashboardLive() {
    if (reduced) return;

    const etaRow = document.querySelector('.lf-live-trip-row:last-child em');
    if (etaRow && /h/.test(etaRow.textContent)) {
      let mins = 5 * 60 + 12;
      window.setInterval(() => {
        mins = Math.max(0, mins - 1);
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        etaRow.textContent = `${h}h ${String(m).padStart(2, '0')}m`;
        etaRow.classList.add('lf-kpi-tick');
        window.setTimeout(() => etaRow.classList.remove('lf-kpi-tick'), 280);
      }, 9000);
    }

    const list = document.getElementById('lf-loads');
    if (list) {
      const cycle = ['En tránsito', 'Asignado', 'Entregado', 'Nuevo'];
      window.setInterval(() => {
        const li = list.querySelector('li');
        const em = li?.querySelector('em');
        if (!em) return;
        const idx = Math.max(0, cycle.indexOf(em.textContent));
        em.textContent = cycle[(idx + 1) % cycle.length];
        li.classList.add('lf-load-flash');
        window.setTimeout(() => li.classList.remove('lf-load-flash'), 420);
      }, 3200);
    }

    document.querySelectorAll('.lf-mini-chart span').forEach((bar, i) => {
      window.setInterval(() => {
        bar.style.height = `${38 + Math.random() * 48}%`;
      }, 2600 + i * 350);
    });

    document.querySelectorAll('.lf-float-card-val[data-live]').forEach((el) => {
      const raw = el.textContent.trim();
      if (raw.startsWith('$')) {
        let val = Number(raw.replace(/[^\d]/g, '')) || 184200;
        window.setInterval(() => {
          if (Math.random() > 0.45) {
            val += Math.floor(Math.random() * 12000) + 3000;
            el.textContent = `$${val.toLocaleString('es-CL')}`;
            el.classList.add('lf-kpi-tick');
            window.setTimeout(() => el.classList.remove('lf-kpi-tick'), 280);
          }
        }, 4200);
        return;
      }
      const num = Number(raw.replace(/[^\d]/g, ''));
      if (!Number.isFinite(num)) return;
      let current = num;
      window.setInterval(() => {
        if (Math.random() > 0.4) {
          current += 1;
          el.textContent = String(current);
          el.classList.add('lf-kpi-tick');
          window.setTimeout(() => el.classList.remove('lf-kpi-tick'), 280);
        }
      }, 2800 + Math.random() * 1200);
    });
  }

  function initMetricsLive() {
    if (reduced) return;
    document.querySelectorAll('.lv3-hero-metrics strong').forEach((el) => {
      const raw = el.textContent.trim();
      const plus = raw.startsWith('+');
      const pct = raw.endsWith('%');
      const digits = raw.replace(/[^\d]/g, '');
      const base = Number(digits);
      if (!Number.isFinite(base) || pct) return;
      let current = base;
      window.setInterval(() => {
        if (Math.random() > 0.55) return;
        current += Math.floor(Math.random() * 2) + 1;
        el.textContent = plus ? `+${current.toLocaleString('es-CL')}` : String(current);
        el.classList.add('lf-kpi-tick');
        window.setTimeout(() => el.classList.remove('lf-kpi-tick'), 280);
      }, 5200);
    });
  }

  function initHeroParticles() {
    const canvas = document.getElementById('lf-hero-particles');
    if (!canvas || reduced) return;
    const ctx = canvas.getContext('2d');
    const nodes = Array.from({ length: 28 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 1.2 + Math.random() * 2.2,
      pulse: Math.random() * Math.PI * 2,
    }));
    const streaks = Array.from({ length: 36 }, () => ({
      x: Math.random(),
      y: Math.random(),
      len: 0.04 + Math.random() * 0.12,
      speed: 0.12 + Math.random() * 0.28,
    }));
    let raf = 0;

    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
    }

    function draw(ts) {
      const colors = themeColors();
      const accent = colors.accent;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      nodes.forEach((n, i) => {
        nodes.slice(i + 1, i + 4).forEach((m) => {
          const dx = (n.x - m.x) * w;
          const dy = (n.y - m.y) * h;
          if (Math.hypot(dx, dy) > w * 0.22) return;
          ctx.strokeStyle = accent + '18';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(n.x * w, n.y * h);
          ctx.lineTo(m.x * w, m.y * h);
          ctx.stroke();
        });
      });

      streaks.forEach((s) => {
        s.x += s.speed * 0.002;
        if (s.x > 1.2) s.x = -0.2;
        const x = s.x * w;
        const y = s.y * h;
        const grad = ctx.createLinearGradient(x, y, x + s.len * w, y);
        grad.addColorStop(0, accent + '00');
        grad.addColorStop(0.5, accent + '66');
        grad.addColorStop(1, accent + '00');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + s.len * w, y);
        ctx.stroke();
      });

      const t = (ts || 0) / 1000;
      nodes.forEach((n) => {
        const pulse = 0.45 + Math.sin(t * 1.6 + n.pulse) * 0.35;
        ctx.beginPath();
        ctx.arc(n.x * w, n.y * h, n.r * pulse * 2, 0, Math.PI * 2);
        ctx.fillStyle = accent + '33';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(n.x * w, n.y * h, n.r, 0, Math.PI * 2);
        ctx.fillStyle = accent;
        ctx.fill();
      });

      raf = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(draw);
  }

  function initLiveKpis() {
    document.querySelectorAll('.lf-kpi-val[data-count]').forEach((el) => {
      const base = Number(el.dataset.count);
      if (!Number.isFinite(base)) return;
      const suffix = el.dataset.suffix || '';
      const prefix = el.dataset.prefix || '';
      if (reduced) {
        el.textContent = prefix + base + suffix;
        return;
      }
      let current = base;
      el.textContent = prefix + current + suffix;
      window.setInterval(() => {
        if (Math.random() > 0.35) {
          current += Math.random() > 0.75 ? 2 : 1;
          el.textContent = prefix + current + suffix;
          el.classList.add('lf-kpi-tick');
          window.setTimeout(() => el.classList.remove('lf-kpi-tick'), 280);
        }
      }, 1100 + Math.random() * 900);
    });
  }

  function buildRouteMarkup(dest) {
    return `
      <span class="lf-route-city"><span class="lf-route-dot" aria-hidden="true"></span>Santiago</span>
      <span class="lf-route-track">
        <span class="lf-route-line"></span>
        <span class="lf-route-glow"></span>
        <span class="lf-route-truck" aria-hidden="true">🚚</span>
      </span>
      <span class="lf-route-city">${dest}<span class="lf-route-dot lf-route-dot--end" aria-hidden="true"></span></span>`;
  }

  function initHeroRoute() {
    const hero = document.querySelector('.lv3-hero.has-fluid');
    if (!hero || hero.querySelector('.lf-hero-route--live')) return;
    const role = pageRole();
    const dest = role === 'lv3-carrier' ? 'Iquique' : 'Antofagasta';
    const route = document.createElement('div');
    route.className = 'lf-hero-route lf-hero-route--live';
    route.setAttribute('aria-hidden', 'true');
    route.innerHTML = buildRouteMarkup(dest);
    hero.appendChild(route);

    if (role === 'lv3-home') {
      const copy = hero.querySelector('.lv3-hero-copy');
      const h1 = copy?.querySelector('h1');
      if (copy && h1 && !copy.querySelector('.lf-hero-route--copy')) {
        const copyRoute = document.createElement('div');
        copyRoute.className = 'lf-hero-route lf-hero-route--copy';
        copyRoute.setAttribute('aria-hidden', 'true');
        copyRoute.innerHTML = buildRouteMarkup(dest);
        h1.insertAdjacentElement('afterend', copyRoute);
      }
    }
  }

  function initTabs() {
    document.querySelectorAll('.lv3-tabs').forEach((tablist) => {
      const panel = tablist.parentElement?.querySelector('.lv3-tab-panel');
      if (!panel) return;
      const tabs = tablist.querySelectorAll('.lv3-tab');
      const contents = {
        'App Android': panel.innerHTML,
        'Web móvil': '<h3>Gestiona desde el navegador móvil</h3><ul class="lv3-checklist lv3-checklist-dark"><li><span class="lv3-check">✓</span>Login y ofertas desde cualquier dispositivo</li><li><span class="lv3-check">✓</span>Mapa y estados en tiempo real</li><li><span class="lv3-check">✓</span>Sin instalar apps adicionales</li></ul>',
        'Carga spot': '<h3>Cargas puntuales en tu ruta</h3><ul class="lv3-checklist lv3-checklist-dark"><li><span class="lv3-check">✓</span>Publica capacidad disponible hoy</li><li><span class="lv3-check">✓</span>Recibe sugerencias por corredor</li><li><span class="lv3-check">✓</span>Cierra precio en CLP al instante</li></ul>',
        'Rutas recurrentes': '<h3>Rutas planificadas con volumen estable</h3><ul class="lv3-checklist lv3-checklist-dark"><li><span class="lv3-check">✓</span>Emparejamiento recurrente RM ↔ V</li><li><span class="lv3-check">✓</span>Menos tiempo buscando carga</li><li><span class="lv3-check">✓</span>Historial y reputación por viaje</li></ul>',
      };
      tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
          tabs.forEach((t) => {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
          });
          tab.classList.add('active');
          tab.setAttribute('aria-selected', 'true');
          panel.classList.add('is-fading');
          setTimeout(() => {
            panel.innerHTML = contents[tab.textContent.trim()] || contents['App Android'];
            panel.classList.remove('is-fading');
          }, reduced ? 0 : 200);
        });
      });
    });
  }

  mountCanvasMap(document.getElementById('lf-dash-map'), CHILE_ROUTE, false);
  mountCanvasMap(document.getElementById('lf-tower-canvas'), TOWER_ROUTE, true);
  initCounters();
  initLoadList();
  initScrollSections();
  initDepthLayers();
  initHeroVideo();
  initShipperProductVideo();
  initHomeHeroVideo();
  initHomeTruckMotion();
  initCarrierPhoneVideo();
  initCarrierTruckGlow();
  initFloatingCards();
  initHeroParticles();
  initHeroRoute();
  initLiveKpis();
  initDashboardLive();
  initMetricsLive();
  initTabs();
})();
