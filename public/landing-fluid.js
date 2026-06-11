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
    document.querySelectorAll('[data-count]').forEach((el) => {
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

  function initHeroParallax() {
    const wrap = document.getElementById('lf-hero-product-wrap');
    const hero = document.querySelector('.lv3-hero');
    if (!wrap || !hero || reduced) return;
    window.addEventListener('scroll', () => {
      const rect = hero.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -rect.top / rect.height));
      wrap.style.transform = `translate3d(0, ${p * 28}px, 0) scale(${1 - p * 0.04})`;
    }, { passive: true });
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
        if (Math.random() > 0.55) {
          current += Math.random() > 0.82 ? 2 : 1;
          el.textContent = prefix + current + suffix;
          el.classList.add('lf-kpi-tick');
          window.setTimeout(() => el.classList.remove('lf-kpi-tick'), 280);
        }
      }, 2400 + Math.random() * 1800);
    });
  }

  function initHeroRoute() {
    const hero = document.querySelector('.lv3-hero.has-fluid');
    if (!hero || hero.querySelector('.lf-hero-route')) return;
    const route = document.createElement('div');
    route.className = 'lf-hero-route';
    route.setAttribute('aria-hidden', 'true');
    route.innerHTML = `
      <span class="lf-route-city">Santiago</span>
      <span class="lf-route-track">
        <span class="lf-route-glow"></span>
        <span class="lf-route-truck" aria-hidden="true">🚚</span>
      </span>
      <span class="lf-route-city">Antofagasta</span>`;
    hero.appendChild(route);
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
  initHeroParallax();
  initHeroParticles();
  initHeroRoute();
  initLiveKpis();
  initTabs();
})();
