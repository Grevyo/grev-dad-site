// Grev.dad ambient effects, loaded on every page (sign-in pages and the app):
//  - Animated background: the unlock screen's look behind every page — a slowly drifting grid,
//    a soft glow that follows the pointer, twinkling dots nudged aside by the pointer, and a vignette.
//  - Custom cursor: an arrow pointer in the site's colours that glows violet over anything clickable.
//    Text fields keep the normal text cursor.
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
.gd-cursor{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;opacity:0;transition:opacity .2s;will-change:transform}
.gd-cursor.show{opacity:1}
.gd-cursor.text{opacity:0!important}
.gd-cursor svg{display:block;width:22px;height:27px;overflow:visible;transform-origin:2px 2px;transition:transform .2s cubic-bezier(.34,1.56,.64,1),filter .2s;
  filter:drop-shadow(2px 2px 0 rgba(0,0,0,.85)) drop-shadow(0 0 6px rgba(125,147,255,.55))}
.gd-cursor .gd-fill-link{opacity:0;transition:opacity .2s}
.gd-cursor.link svg{transform:rotate(-10deg) scale(1.08);filter:drop-shadow(2px 2px 0 rgba(0,0,0,.85)) drop-shadow(0 0 10px rgba(194,125,255,.8))}
.gd-cursor.link .gd-fill-link{opacity:1}
.gd-cursor.down svg{transform:scale(.86)}
.gd-cursor.link.down svg{transform:rotate(-10deg) scale(.94)}
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
    // An arrow pointer in the site's colours. Its tip is the hotspot, so it clicks exactly where the
    // normal cursor would; it follows the mouse with no lag.
    const el = document.createElement('div');
    el.className = 'gd-cursor';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<svg viewBox="0 0 22 27" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gd-cur-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c9d3ff"/><stop offset=".55" stop-color="#7d93ff"/><stop offset="1" stop-color="#5a6fe0"/></linearGradient>
        <linearGradient id="gd-cur-b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0dcff"/><stop offset=".55" stop-color="#c27dff"/><stop offset="1" stop-color="#8a4fe0"/></linearGradient>
      </defs>
      <path d="M2 2 L2 21.5 L7.2 16.8 L10.6 24.6 L14 23.1 L10.7 15.4 L17.6 15.4 Z" fill="url(#gd-cur-a)" stroke="#06080c" stroke-width="1.6" stroke-linejoin="round"/>
      <path class="gd-fill-link" d="M2 2 L2 21.5 L7.2 16.8 L10.6 24.6 L14 23.1 L10.7 15.4 L17.6 15.4 Z" fill="url(#gd-cur-b)" stroke="#06080c" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M4.2 6.2 L4.2 15.5" stroke="rgba(255,255,255,.75)" stroke-width="1.2" stroke-linecap="round"/>
    </svg>`;
    const CLICKABLE = 'a[href],button,[role=button],[role=tab],[role=menuitem],[role=switch],select,summary,label,input[type=checkbox],input[type=radio],input[type=color],input[type=file],.tg-cell,.tg.editing .tg-tile,.gh-bar-slot,.gd-lock-button';
    const TEXT = 'input:not([type=checkbox]):not([type=radio]):not([type=color]):not([type=file]):not([type=range]),textarea,[contenteditable=true]';
    let on = false, frame = 0;

    // The SVG tip sits at (2,2), so shift by that to line the tip up with the real pointer.
    const place = () => { frame = 0; el.style.transform = `translate3d(${pointer.x - 2}px,${pointer.y - 2}px,0)`; };
    const onMove = (e) => {
      if (!on || e.pointerType === 'touch') return;
      const target = e.target instanceof Element ? e.target : null;
      const overText = Boolean(target?.closest(TEXT));
      el.classList.toggle('text', overText);
      el.classList.toggle('link', !overText && Boolean(target?.closest(CLICKABLE)));
      el.classList.add('show');
      if (!frame) frame = requestAnimationFrame(place);
    };
    const hide = () => el.classList.remove('show');
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('pointerdown', () => el.classList.add('down'));
    addEventListener('pointerup', () => el.classList.remove('down'));
    document.addEventListener('pointerleave', hide);
    addEventListener('blur', hide);

    const apply = (p) => {
      on = p.cursor && finePointer.matches;
      document.documentElement.classList.toggle('gd-cursor-on', on);
      if (on) { if (!el.isConnected) document.body.append(el); }
      else el.remove();
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
