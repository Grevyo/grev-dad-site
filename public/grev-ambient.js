// Grev.dad ambient effects, loaded on every page (sign-in pages and the app):
//  - Animated background: the unlock screen's look behind every page — a slowly drifting grid,
//    a soft glow that follows the pointer, twinkling dots nudged aside by the pointer, and a vignette.
//  - Custom cursor: an app-style square ring and dot that turn into a glowing diamond over anything
//    clickable. Text fields keep the normal text cursor.
//  - Cursor trail: a very faint scatter of the background's dots and streaks behind the pointer.
// Each can be turned off in Settings (stored per device). The cursor and trail only run with a mouse
// or trackpad; for prefers-reduced-motion the background is drawn still and the trail stays off.
(() => {
  if (window.__grevAmbient) return;
  window.__grevAmbient = true;

  const KEY = 'grevdad:effects';
  const DEFAULTS = { background: true, cursor: true, trail: true };
  const COLORS = ['125,147,255', '169,183,255', '194,125,255', '69,209,255', '255,255,255'];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

  const read = () => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; } };
  let prefs = read();
  const listeners = new Set();
  /** Used by the Settings page: GrevEffects.get(), GrevEffects.set('cursor', false). */
  window.GrevEffects = {
    get: () => ({ ...prefs }),
    set(key, value) {
      prefs = { ...prefs, [key]: Boolean(value) };
      try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch {}
      listeners.forEach(fn => fn(prefs));
    },
    supportsPointerEffects: () => finePointer.matches,
    reducedMotion: reduceMotion
  };
  // Keep other open tabs in step.
  addEventListener('storage', (e) => { if (e.key === KEY) { prefs = read(); listeners.forEach(fn => fn(prefs)); } });

  const pointer = { x: -9999, y: -9999, active: false };
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
  }, { passive: true });
  document.addEventListener('pointerleave', () => { pointer.active = false; pointer.x = pointer.y = -9999; });

  const style = document.createElement('style');
  style.textContent = `
.grev-ambient{position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none}
.gx-layer{position:fixed;inset:0;pointer-events:none}
.gx-grid{inset:-64px 0 0 0;z-index:-3;background:linear-gradient(90deg,rgba(125,147,255,.06) 1px,transparent 1px),linear-gradient(rgba(125,147,255,.06) 1px,transparent 1px);background-size:32px 32px;animation:gx-drift 18s linear infinite;will-change:transform}
@keyframes gx-drift{to{transform:translateY(64px)}}
.gx-glow{z-index:-2;background:radial-gradient(520px circle at var(--gx-x,50%) var(--gx-y,30%),rgba(125,147,255,.13),rgba(194,125,255,.05) 40%,transparent 70%);animation:gx-breathe 6s ease-in-out infinite}
@keyframes gx-breathe{50%{opacity:.6}}
.gx-vignette{z-index:-1;background:radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.55))}
html.gx-bg{background-image:radial-gradient(1100px 620px at 50% -12%,rgba(125,147,255,.12),transparent 62%),radial-gradient(800px 560px at 100% 105%,rgba(194,125,255,.07),transparent 60%)!important}
@media (prefers-reduced-motion:reduce){.gx-grid,.gx-glow{animation:none}}
.gd-cursor-on,.gd-cursor-on *{cursor:none!important}
.gd-cursor-on input:not([type=checkbox]):not([type=radio]):not([type=color]):not([type=file]):not([type=range]),.gd-cursor-on textarea,.gd-cursor-on [contenteditable=true]{cursor:text!important}
.gd-cursor{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;opacity:0;transition:opacity .2s}
.gd-cursor.show{opacity:1}
.gd-cursor-dot{width:6px;height:6px;margin:-3px 0 0 -3px;background:#a9b7ff;box-shadow:0 0 8px rgba(125,147,255,.9)}
.gd-cursor-ring{width:26px;height:26px;margin:-13px 0 0 -13px}
.gd-cursor-ring i{position:absolute;inset:0;border:1.5px solid rgba(125,147,255,.85);box-shadow:3px 3px 0 rgba(0,0,0,.8),0 0 14px rgba(125,147,255,.25);transition:transform .25s cubic-bezier(.34,1.56,.64,1),border-color .2s,background .2s,box-shadow .2s}
.gd-cursor-ring.link i{transform:rotate(45deg) scale(1.35);border-color:#c27dff;background:rgba(194,125,255,.08);box-shadow:0 0 18px rgba(194,125,255,.45)}
.gd-cursor-ring.down i{transform:scale(.7)}
.gd-cursor-ring.link.down i{transform:rotate(45deg) scale(1)}
.gd-cursor.text{opacity:0!important}
.grev-trail{position:fixed;inset:0;width:100%;height:100%;z-index:2147483646;pointer-events:none}`;
  document.head.append(style);

  const start = () => {
    background();
    cursor();
    trail();
  };

  // --- animated background -----------------------------------------------------------------------
  function background() {
    const canvas = document.createElement('canvas');
    canvas.className = 'grev-ambient';
    canvas.setAttribute('aria-hidden', 'true');
    let ctx = null;
    try { ctx = canvas.getContext('2d'); } catch {}
    const layers = ['gx-grid', 'gx-glow', 'gx-vignette'].map(name => { const el = document.createElement('div'); el.className = `gx-layer ${name}`; el.setAttribute('aria-hidden', 'true'); return el; });
    const authPage = document.body.classList.contains('auth-page');
    const particles = [];
    let W = 0, H = 0, DPR = 1, last = performance.now(), running = false, burstUntil = 0, enabled = false;
    const glow = { x: innerWidth / 2, y: innerHeight * .3 };

    const make = () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .22, vy: (Math.random() - .5) * .22 - .04,
      r: Math.random() * 1.5 + .6,
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
      a: Math.min(1, (Math.random() * .45 + .2) * (authPage ? 1.5 : 1.15)),
      tw: Math.random() * Math.PI * 2
    });

    const resize = () => {
      if (!ctx) return;
      DPR = Math.min(2, window.devicePixelRatio || 1);
      W = innerWidth; H = innerHeight;
      canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const want = Math.min(authPage ? 170 : 140, Math.round(W * H / (authPage ? 7500 : 9500)));
      while (particles.length < want) particles.push(make());
      particles.length = want;
      if (reduceMotion && enabled) draw(0);
    };

    function draw(dt) {
      const k = dt / 16.7;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (const p of particles) {
        if (k) {
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
      // The glow eases towards the pointer, like the lock screen's light following the hold button.
      if (k && pointer.active) {
        glow.x += (pointer.x - glow.x) * Math.min(1, .04 * k); glow.y += (pointer.y - glow.y) * Math.min(1, .04 * k);
        layers[1].style.setProperty('--gx-x', `${glow.x}px`); layers[1].style.setProperty('--gx-y', `${glow.y}px`);
      }
    }

    const frame = (now) => {
      if (!running) return;
      const dt = Math.min(48, now - last); last = now;
      draw(dt);
      requestAnimationFrame(frame);
    };
    const play = () => {
      if (!ctx || !enabled || reduceMotion || running || document.hidden) return;
      running = true; last = performance.now(); requestAnimationFrame(frame);
    };
    const apply = (p) => {
      enabled = p.background;
      document.documentElement.classList.toggle('gx-bg', enabled);
      if (enabled) {
        if (ctx && !canvas.isConnected) document.body.prepend(canvas);
        layers.forEach(el => { if (!el.isConnected) document.body.prepend(el); });
        resize(); play();
      } else {
        running = false;
        canvas.remove(); layers.forEach(el => el.remove());
      }
    };

    addEventListener('resize', resize);
    // The lock screen asks for a burst when it opens: every dot is thrown out from that point and drifts back to rest.
    addEventListener('grev-ambient-burst', (e) => {
      if (reduceMotion || !enabled) return;
      const bx = e.detail?.x ?? W / 2, by = e.detail?.y ?? H / 2;
      for (const p of particles) {
        const dx = p.x - bx, dy = p.y - by, d = Math.hypot(dx, dy) || 1, sp = 3 + Math.random() * 6;
        p.vx = dx / d * sp; p.vy = dy / d * sp;
      }
      burstUntil = performance.now() + 1600;
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) running = false; else play(); });
    listeners.add(apply);
    apply(prefs);
  }

  // --- custom cursor -----------------------------------------------------------------------------
  function cursor() {
    const dot = document.createElement('div'); dot.className = 'gd-cursor gd-cursor-dot';
    const ring = document.createElement('div'); ring.className = 'gd-cursor gd-cursor-ring'; ring.append(document.createElement('i'));
    [dot, ring].forEach(el => el.setAttribute('aria-hidden', 'true'));
    const CLICKABLE = 'a[href],button,[role=button],[role=tab],[role=menuitem],select,summary,label,input[type=checkbox],input[type=radio],input[type=color],input[type=file],.tg-cell,.tg.editing .tg-tile,.gh-bar-slot';
    const TEXT = 'input:not([type=checkbox]):not([type=radio]):not([type=color]):not([type=file]):not([type=range]),textarea,[contenteditable=true]';
    const at = { x: -100, y: -100 };
    let on = false, frame = 0;

    const move = () => {
      frame = 0;
      if (!on) return;
      // The ring trails the dot slightly; it snaps for reduced motion.
      const ease = reduceMotion ? 1 : .38;
      at.x += (pointer.x - at.x) * ease; at.y += (pointer.y - at.y) * ease;
      dot.style.transform = `translate3d(${pointer.x}px,${pointer.y}px,0)`;
      ring.style.transform = `translate3d(${at.x}px,${at.y}px,0)`;
      if (Math.abs(pointer.x - at.x) > .3 || Math.abs(pointer.y - at.y) > .3) frame = requestAnimationFrame(move);
    };
    const onMove = (e) => {
      if (!on || e.pointerType === 'touch') return;
      if (at.x < -50) { at.x = e.clientX; at.y = e.clientY; }
      const target = e.target instanceof Element ? e.target : null;
      const overText = Boolean(target?.closest(TEXT));
      dot.classList.toggle('text', overText); ring.classList.toggle('text', overText);
      ring.classList.toggle('link', !overText && Boolean(target?.closest(CLICKABLE)));
      dot.classList.add('show'); ring.classList.add('show');
      if (!frame) frame = requestAnimationFrame(move);
    };
    const hide = () => { dot.classList.remove('show'); ring.classList.remove('show'); };
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('pointerdown', () => ring.classList.add('down'));
    addEventListener('pointerup', () => ring.classList.remove('down'));
    document.addEventListener('pointerleave', hide);
    addEventListener('blur', hide);

    const apply = (p) => {
      on = p.cursor && finePointer.matches;
      document.documentElement.classList.toggle('gd-cursor-on', on);
      if (on) { if (!dot.isConnected) document.body.append(ring, dot); }
      else { dot.remove(); ring.remove(); at.x = at.y = -100; }
    };
    listeners.add(apply);
    finePointer.addEventListener?.('change', () => apply(prefs));
    apply(prefs);
  }

  // --- cursor trail ------------------------------------------------------------------------------
  function trail() {
    const canvas = document.createElement('canvas');
    canvas.className = 'grev-trail';
    canvas.setAttribute('aria-hidden', 'true');
    let ctx = null;
    try { ctx = canvas.getContext('2d'); } catch {}
    if (!ctx) return;
    const bits = [];
    let W = 0, H = 0, DPR = 1, on = false, running = false, last = 0, lastX = null, lastY = null;

    const resize = () => {
      DPR = Math.min(2, window.devicePixelRatio || 1);
      W = innerWidth; H = innerHeight;
      canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    const frame = (now) => {
      const k = Math.min(48, now - last) / 16.7; last = now;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = bits.length - 1; i >= 0; i--) {
        const b = bits[i];
        b.px = b.x; b.py = b.y;
        b.x += b.vx * k; b.y += b.vy * k; b.vx *= .94; b.vy *= .94; b.vy -= .01 * k;
        b.life -= b.decay * k;
        if (b.life <= 0) { bits.splice(i, 1); continue; }
        const alpha = b.a * b.life;
        if (b.streak) {
          ctx.strokeStyle = `rgba(${b.c},${alpha})`; ctx.lineWidth = b.r;
          ctx.beginPath(); ctx.moveTo(b.px - b.vx * 3, b.py - b.vy * 3); ctx.lineTo(b.x, b.y); ctx.stroke();
        } else {
          ctx.fillStyle = `rgba(${b.c},${alpha})`;
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (.6 + b.life * .4), 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      if (bits.length) requestAnimationFrame(frame); else running = false;
    };
    const onMove = (e) => {
      if (!on || e.pointerType === 'touch') return;
      if (lastX === null) { lastX = e.clientX; lastY = e.clientY; return; }
      const dx = e.clientX - lastX, dy = e.clientY - lastY, dist = Math.hypot(dx, dy);
      if (dist < 7) return;
      // About one faint dot per 9px of travel, a few of them small streaks.
      const count = Math.min(5, Math.floor(dist / 9) || 1);
      for (let i = 0; i < count && bits.length < 90; i++) {
        const t = (i + Math.random()) / count;
        bits.push({ x: lastX + dx * t + (Math.random() - .5) * 6, y: lastY + dy * t + (Math.random() - .5) * 6,
          vx: -dx / dist * Math.random() * .6 + (Math.random() - .5) * .4, vy: -dy / dist * Math.random() * .6 + (Math.random() - .5) * .4,
          r: Math.random() * 1.3 + .5, c: COLORS[Math.floor(Math.random() * COLORS.length)], a: Math.random() * .2 + .12,
          life: 1, decay: Math.random() * .03 + .03, streak: Math.random() < .25 });
      }
      lastX = e.clientX; lastY = e.clientY;
      if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    };
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('resize', () => { if (on) resize(); });
    document.addEventListener('pointerleave', () => { lastX = lastY = null; });

    const apply = (p) => {
      on = p.trail && finePointer.matches && !reduceMotion;
      if (on) { if (!canvas.isConnected) { document.body.append(canvas); resize(); } }
      else { canvas.remove(); bits.length = 0; lastX = lastY = null; }
    };
    listeners.add(apply);
    finePointer.addEventListener?.('change', () => apply(prefs));
    apply(prefs);
  }

  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
