// Grev.dad ambient background: the drifting dots from the lock screen, behind every page.
// It is decoration only, so it stays out of the way: a fixed canvas under the page content,
// denser on the sign-in pages and quieter inside the site, nudged aside by the pointer,
// paused while the tab is hidden, and drawn once without motion for reduced-motion users.
(() => {
  if (window.__grevAmbient) return;
  window.__grevAmbient = true;

  const start = () => {
    const canvas = document.createElement('canvas');
    canvas.className = 'grev-ambient';
    canvas.setAttribute('aria-hidden', 'true');
    let ctx = null;
    try { ctx = canvas.getContext('2d'); } catch {}
    if (!ctx) return;
    document.body.prepend(canvas);

    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dense = document.body.classList.contains('auth-page');
    const COLORS = ['125,147,255', '169,183,255', '194,125,255', '69,209,255', '255,255,255'];
    const particles = [];
    const pointer = { x: -9999, y: -9999 };
    let W = 0, H = 0, DPR = 1, last = performance.now(), running = false, burstUntil = 0;

    const make = () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .22, vy: (Math.random() - .5) * .22 - .04,
      r: Math.random() * 1.5 + (dense ? .7 : .4),
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
      a: Math.min(1, (Math.random() * .45 + .2) * (dense ? 1.5 : .7)),
      tw: Math.random() * Math.PI * 2
    });

    const resize = () => {
      DPR = Math.min(2, window.devicePixelRatio || 1);
      W = innerWidth; H = innerHeight;
      canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const want = Math.min(dense ? 170 : 90, Math.round(W * H / (dense ? 7500 : 16000)));
      while (particles.length < want) particles.push(make());
      particles.length = want;
      if (reduceMotion) draw(0);
    };

    function draw(dt) {
      const k = dt / 16.7;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (const p of particles) {
        if (k) {
          // Drift, with a gentle push away from the pointer.
          const dx = p.x - pointer.x, dy = p.y - pointer.y, d2 = dx * dx + dy * dy;
          if (d2 < 14000) { const d = Math.sqrt(d2) || 1, f = (1 - d / 118) * .35; p.vx += dx / d * f * k; p.vy += dy / d * f * k; }
          p.vx += (Math.random() - .5) * .015; p.vy += (Math.random() - .5) * .015;
          p.vx *= .985; p.vy *= .985;
          const sp = Math.hypot(p.vx, p.vy);
          const cap = performance.now() < burstUntil ? 9 : 1.6;
          if (sp > cap) { p.vx *= cap / sp; p.vy *= cap / sp; }
          if (sp < .05) { p.vx += (Math.random() - .5) * .1; p.vy -= .03; }
          p.x += p.vx * k; p.y += p.vy * k; p.tw += .02 * k;
          if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
          if (p.y < -10) p.y = H + 10; else if (p.y > H + 10) p.y = -10;
        }
        const alpha = p.a * (.75 + Math.sin(p.tw) * .25);
        ctx.fillStyle = `rgba(${p.c},${alpha})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    const frame = (now) => {
      if (!running) return;
      const dt = Math.min(48, now - last); last = now;
      draw(dt);
      requestAnimationFrame(frame);
    };
    const play = () => {
      if (reduceMotion || running || document.hidden) return;
      running = true; last = performance.now(); requestAnimationFrame(frame);
    };

    resize();
    addEventListener('resize', resize);
    addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; }, { passive: true });
    document.addEventListener('pointerleave', () => { pointer.x = pointer.y = -9999; });
    // The lock screen asks for a burst when it opens: every dot is thrown out from that point and drifts back to rest.
    addEventListener('grev-ambient-burst', (e) => {
      if (reduceMotion) return;
      const bx = e.detail?.x ?? W / 2, by = e.detail?.y ?? H / 2;
      for (const p of particles) {
        const dx = p.x - bx, dy = p.y - by, d = Math.hypot(dx, dy) || 1, sp = 3 + Math.random() * 6;
        p.vx = dx / d * sp; p.vy = dy / d * sp;
      }
      burstUntil = performance.now() + 1600;
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) running = false; else play(); });
    play();
  };

  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
