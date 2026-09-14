(() => {
  const doc = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    doc.classList.add('reduced-motion');
    return;
  }

  const pointerFine = window.matchMedia('(pointer: fine)').matches;
  const body = document.body;

  // Feature / product boxes: alternate left <-> right as they enter viewport
  const slideGroups = [
    '.feature-grid',
    '.product-grid',
    '.feature-links',
    '.blog-grid'
  ];

  const revealNodes = [];
  const seen = new Set();

  slideGroups.forEach((groupSelector) => {
    document.querySelectorAll(groupSelector).forEach((group) => {
      [...group.children].forEach((node, index) => {
        if (seen.has(node)) return;
        seen.add(node);
        node.classList.add('motion-reveal');
        node.classList.add(index % 2 === 0 ? 'motion-enter-left' : 'motion-enter-right');
        node.style.setProperty('--reveal-delay', `${Math.min(index, 5) * 70}ms`);
        revealNodes.push(node);
      });
    });
  });

  // Showcase rows: copy from one side, media from the other
  document.querySelectorAll('.showcase').forEach((showcase, index) => {
    if (seen.has(showcase)) return;
    seen.add(showcase);
    showcase.classList.add('motion-reveal');
    showcase.classList.add(index % 2 === 0 ? 'motion-enter-left' : 'motion-enter-right');
    showcase.style.setProperty('--reveal-delay', '0ms');
    revealNodes.push(showcase);
  });

  const reveal = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        reveal.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
  );
  revealNodes.forEach((node) => reveal.observe(node));

  const heroPhoto = document.querySelector('.hero__visual--photo img');
  if (heroPhoto && pointerFine) {
    const hero = heroPhoto.closest('.hero');
    let raf = 0;
    let targetX = 0;
    let targetY = 0;
    const apply = () => {
      raf = 0;
      heroPhoto.style.setProperty('--hero-tilt-x', `${targetX}deg`);
      heroPhoto.style.setProperty('--hero-tilt-y', `${targetY}deg`);
    };
    hero.addEventListener('mousemove', (event) => {
      const rect = hero.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      targetY = Math.max(-3, Math.min(3, px * 6));
      targetX = Math.max(-3, Math.min(3, py * -6));
      if (!raf) raf = requestAnimationFrame(apply);
    });
    hero.addEventListener('mouseleave', () => {
      targetX = 0;
      targetY = 0;
      if (!raf) raf = requestAnimationFrame(apply);
    });
  }

  if (pointerFine) {
    const canvas = document.createElement('canvas');
    canvas.className = 'mouse-tail';
    body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const hexToRgb = (hex) => {
      const match = String(hex || '').trim().match(/^#?([0-9a-f]{6})$/i);
      if (!match) return [0, 133, 255];
      const value = parseInt(match[1], 16);
      return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
    };

    let c1 = [0, 133, 255];
    let c2 = [0, 196, 154];
    const readColors = () => {
      const css = getComputedStyle(doc);
      c1 = hexToRgb(css.getPropertyValue('--primary')) || [0, 133, 255];
      c2 = hexToRgb(css.getPropertyValue('--secondary')) || [0, 196, 154];
    };
    readColors();

    const mix = (p) => [
      Math.round(c1[0] + (c2[0] - c1[0]) * p),
      Math.round(c1[1] + (c2[1] - c1[1]) * p),
      Math.round(c1[2] + (c2[2] - c1[2]) * p)
    ];

    const TRAIL_MS = 620;
    const MAX_W = 9;
    const STEP_PX = 2.5;
    const pts = [];
    let have = false;
    let raf = null;
    let shown = false;
    let lastMove = 0;

    const addTrailPoint = (x, y, t) => {
      const last = pts[pts.length - 1];
      if (last) {
        const dx = x - last.x;
        const dy = y - last.y;
        const dist = Math.hypot(dx, dy);
        if (dist > STEP_PX) {
          const n = Math.ceil(dist / STEP_PX);
          for (let i = 1; i < n; i += 1) {
            const f = i / n;
            pts.push({ x: last.x + dx * f, y: last.y + dy * f, t: last.t + (t - last.t) * f });
          }
        } else if (dist < 0.4) {
          return;
        }
      }
      pts.push({ x, y, t });
      while (pts.length > 240) pts.shift();
    };

    const livePts = (now) => {
      while (pts.length && now - pts[0].t > TRAIL_MS) pts.shift();
      return pts;
    };

    const draw = () => {
      const now = performance.now();
      if (now - lastMove > 80) have = false;
      const live = livePts(now);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      if (live.length > 1) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 1; i < live.length; i += 1) {
          const a = live[i - 1];
          const b = live[i];
          const p = i / (live.length - 1);
          const age = 1 - (now - b.t) / TRAIL_MS;
          if (age <= 0) continue;
          const w = Math.max(1.5, MAX_W * p * age);
          const c = mix(p);
          ctx.lineWidth = w;
          ctx.strokeStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${0.72 * age})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      if (live.length || have) {
        raf = requestAnimationFrame(draw);
      } else {
        raf = null;
      }
    };

    const wake = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };

    const clearTrail = () => {
      if (pts.length) {
        pts.length = 0;
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }
      have = false;
      if (shown) {
        shown = false;
        canvas.classList.remove('is-visible');
      }
    };

    window.addEventListener(
      'pointermove',
      (event) => {
        lastMove = performance.now();
        have = true;
        addTrailPoint(event.clientX, event.clientY, lastMove);
        if (!shown) {
          shown = true;
          canvas.classList.add('is-visible');
          readColors();
        }
        wake();
      },
      { passive: true }
    );

    document.addEventListener('mouseleave', clearTrail);
    window.addEventListener('blur', clearTrail);
  }
})();

/* Feature tornado — separate IIFE so it cannot break cursor / reveal motion */
(() => {
  const tornado = document.querySelector('.feature-tornado');
  if (!tornado) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const desktop = window.matchMedia('(min-width: 901px)').matches;
  if (reduce || !desktop) {
    tornado.classList.add('is-ready');
    return;
  }

  const track = tornado.querySelector('.feature-tornado__track');
  const stage = tornado.querySelector('#tornado-stage');
  const label = tornado.querySelector('#tornado-active-label');
  const cards = stage ? [...stage.querySelectorAll('[data-tornado-card]')] : [];
  if (!track || !cards.length) return;

  const n = cards.length;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let raf = 0;
  let focusIdx = -1;

  const paint = () => {
    raf = 0;
    const total = Math.max(1, track.offsetHeight - window.innerHeight);
    const top = track.getBoundingClientRect().top;
    const p = clamp(-top / total, 0, 1);
    /* Focus slides 0 → n-1; nearby cards stay in a ring, not piled on center */
    const focus = p * (n - 1);
    const idx = Math.round(focus);

    cards.forEach((card, i) => {
      const d = i - focus;
      const abs = Math.abs(d);
      const angle = d * 0.95 + focus * 0.4;
      const radius = abs < 0.08 ? 0 : 48 + Math.min(abs, 2.6) * 88;
      const x = Math.sin(angle) * radius;
      const y = Math.cos(angle) * radius * 0.42;
      const z = -abs * 55;
      const rotY = d * 28;
      const rotZ = d * 6;
      const scale = clamp(1.02 - abs * 0.2, 0.48, 1.02);
      const opacity = clamp(1.05 - abs * 0.38, 0, 1);

      card.style.opacity = String(opacity);
      card.style.zIndex = String(Math.round(30 - abs * 10 + i));
      card.style.transform =
        `translate3d(calc(-50% + ${x.toFixed(1)}px), calc(-50% + ${y.toFixed(1)}px), ${z.toFixed(1)}px)` +
        ` rotateY(${rotY.toFixed(1)}deg) rotateZ(${rotZ.toFixed(1)}deg) scale(${scale.toFixed(3)})`;
      card.classList.toggle('is-focus', i === idx);
      /* Side cards still clickable when reasonably visible */
      card.style.pointerEvents = opacity > 0.45 ? 'auto' : 'none';
    });

    if (idx !== focusIdx) {
      focusIdx = idx;
      if (label) label.textContent = cards[idx].getAttribute('data-label') || '';
    }
  };

  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(paint);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  paint();
  tornado.classList.add('is-ready');
})();
