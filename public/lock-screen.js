// Grev.dad lock screen for signed-out visitors (on / and /login).
// Hold for 2 seconds to unlock: mouse or touch press, Space/Enter, or A on a controller (Gamepad API).
// Grev Home's in-app browser presses A as a single click, so a click that no pointer or key held
// (event.detail === 0) runs the same 2-second unlock by itself.
//
// The whole screen reacts to the hold: a particle field drifts at rest, then streams into the
// button, the grid zooms and brightens, the glow closes in and the screen trembles near the end.
// Unlocking fires a flash, a shockwave and a particle burst, then the screen splits open.
(() => {
  const HOLD_MS = 2000;
  const DRAIN_MS = 500;
  const HANDOFF_KEY = 'grevdad:unlocked-at';
  const root = document.documentElement;
  const onLanding = location.pathname === '/';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const release = () => root.classList.remove('gd-lock-pending');

  // Unlocking on the landing page continues straight to /login; don't lock that page again.
  let handoff = 0;
  try { handoff = Number(sessionStorage.getItem(HANDOFF_KEY)) || 0; sessionStorage.removeItem(HANDOFF_KEY); } catch {}
  if (!onLanding && Date.now() - handoff < 15000) {
    release();
    root.classList.add('gd-reveal');
    document.querySelector('#login-form input[name="identifier"]')?.focus({ preventScroll: true });
    return;
  }

  const lock = document.createElement('div');
  lock.className = 'gd-lock';
  lock.setAttribute('role', 'dialog');
  lock.setAttribute('aria-modal', 'true');
  lock.setAttribute('aria-label', 'Grev.dad lock screen');
  lock.innerHTML = `
    <div class="gd-shutter top" aria-hidden="true"><div class="gd-grid"></div></div>
    <div class="gd-shutter bottom" aria-hidden="true"><div class="gd-grid"></div></div>
    <canvas class="gd-field" aria-hidden="true"></canvas>
    <div class="gd-glow" aria-hidden="true"></div>
    <div class="gd-vignette" aria-hidden="true"></div>
    <div class="gd-seam" aria-hidden="true"></div>
    <div class="gd-flash" aria-hidden="true"></div>
    <div class="gd-shock" aria-hidden="true"></div>
    <div class="gd-lock-inner">
      <img class="gd-lock-logo" src="/grev-dad-logo-full.png" alt="Grev.dad">
      <p class="gd-clock" aria-hidden="true"></p>
      <p class="gd-date"></p>
      <button type="button" class="gd-hold" aria-describedby="gd-hint">
        <span class="gd-ring" aria-hidden="true"></span><span class="gd-ring two" aria-hidden="true"></span>
        <span class="gd-fill" aria-hidden="true"></span>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="gd-trace" d="M0 0H100V100H0Z"/></svg>
        <span class="gd-hold-body">
          <svg class="gd-lock-icon" viewBox="0 0 48 48" aria-hidden="true">
            <path class="shackle" d="M15 22v-6a9 9 0 0 1 18 0v6" fill="none" stroke="currentColor" stroke-width="4"/>
            <rect x="9" y="22" width="30" height="22" fill="currentColor"/>
            <rect x="22" y="29" width="4" height="8" fill="var(--bg,#080a0d)"/>
          </svg>
          <span class="gd-hold-label">Hold to unlock</span>
          <span class="gd-hold-count" aria-hidden="true"></span>
        </span>
      </button>
      <p class="gd-hint" id="gd-hint">Hold for 2 seconds: <kbd class="gd-a">A</kbd> on a controller, <kbd>Space</kbd> on a keyboard, or press and hold.</p>
      <p class="gd-pad-status" aria-live="polite"></p>
    </div>`;
  document.body.append(lock);
  release();

  const shell = document.querySelector('.auth-shell');
  shell?.setAttribute('inert', '');
  shell?.setAttribute('aria-hidden', 'true');

  const $ = (s) => lock.querySelector(s);
  const button = $('.gd-hold'), trace = $('.gd-trace'), fill = $('.gd-fill'), count = $('.gd-hold-count');
  const label = $('.gd-hold-label'), padStatus = $('.gd-pad-status'), clock = $('.gd-clock'), date = $('.gd-date');
  const canvas = $('.gd-field');

  const tick = () => {
    const now = new Date();
    clock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    date.textContent = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
  };
  tick();
  const clockTimer = setInterval(tick, 1000);

  // ---- Particle field ------------------------------------------------------------------------
  const ctx = canvas.getContext('2d');
  const COLORS = ['125,147,255', '169,183,255', '194,125,255', '69,209,255', '255,255,255'];
  let W = 0, H = 0, DPR = 1;
  const particles = [], sparks = [];
  const target = () => {
    const r = button.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  const spawn = (atEdge) => {
    let x = Math.random() * W, y = Math.random() * H;
    if (atEdge) {
      const side = Math.floor(Math.random() * 4);
      x = side === 0 ? -10 : side === 1 ? W + 10 : Math.random() * W;
      y = side === 2 ? -10 : side === 3 ? H + 10 : Math.random() * H;
    }
    return { x, y, px: x, py: y, vx: (Math.random() - .5) * .25, vy: (Math.random() - .5) * .25 - .06,
      r: Math.random() * 1.6 + .4, c: COLORS[Math.floor(Math.random() * COLORS.length)], a: Math.random() * .5 + .25 };
  };
  const resize = () => {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const want = Math.min(170, Math.round(W * H / 9000));
    while (particles.length < want) particles.push(spawn(false));
    particles.length = want;
    const t = target();
    lock.style.setProperty('--bx', `${t.x}px`); lock.style.setProperty('--by', `${t.y}px`);
  };
  resize();
  addEventListener('resize', resize);

  const burst = () => {
    const t = target();
    for (let i = 0; i < 220; i++) {
      const ang = Math.random() * Math.PI * 2, sp = Math.random() * 14 + 3;
      sparks.push({ x: t.x, y: t.y, px: t.x, py: t.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        r: Math.random() * 2.2 + .6, c: COLORS[Math.floor(Math.random() * COLORS.length)], life: 1, decay: Math.random() * .012 + .008 });
    }
    // Everything already on screen gets thrown outward too.
    for (const p of particles) {
      const dx = p.x - t.x, dy = p.y - t.y, d = Math.hypot(dx, dy) || 1;
      p.vx = dx / d * (8 + Math.random() * 10); p.vy = dy / d * (8 + Math.random() * 10);
    }
  };

  // ---- Hold state -----------------------------------------------------------------------------
  const holders = new Set();
  let progress = 0, last = performance.now(), done = false, alive = true, exploding = false;

  const setHolder = (name, on) => {
    if (done) return;
    on ? holders.add(name) : holders.delete(name);
    lock.classList.toggle('is-holding', holders.size > 0);
    button.classList.toggle('is-holding', holders.size > 0);
  };

  const draw = () => {
    trace.style.strokeDasharray = `${progress * 400} 400`;
    trace.style.opacity = progress > 0 ? '1' : '0';
    fill.style.height = `${progress * 100}%`;
    lock.style.setProperty('--p', progress.toFixed(4));
    const left = ((1 - progress) * HOLD_MS / 1000).toFixed(1);
    count.textContent = holders.size && progress < 1 ? `${left}s` : '';
    label.textContent = progress >= 1 ? 'Unlocked' : holders.size ? (progress > .7 ? 'Almost…' : 'Keep holding') : 'Hold to unlock';
  };

  const frame = (now) => {
    if (!alive) return;
    const dt = Math.min(48, now - last); last = now;
    if (!done) {
      progress = holders.size ? Math.min(1, progress + dt / HOLD_MS) : Math.max(0, progress - dt / DRAIN_MS);
      draw();
      if (progress >= 1) unlock();
    }

    const k = dt / 16.7, p = done ? 0 : progress, t = target();
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    const pull = reduceMotion ? 0 : p * p * 1.4;
    for (const q of particles) {
      q.px = q.x; q.py = q.y;
      if (exploding) {
        q.vx *= .965; q.vy *= .965;
      } else if (pull > 0) {
        const dx = t.x - q.x, dy = t.y - q.y, d = Math.hypot(dx, dy) || 1;
        q.vx += dx / d * pull * k; q.vy += dy / d * pull * k;
        q.vx *= .94; q.vy *= .94;
        if (d < 26) Object.assign(q, spawn(true));
      } else {
        q.vx += (Math.random() - .5) * .02; q.vy += (Math.random() - .5) * .02;
        q.vx = Math.max(-.4, Math.min(.4, q.vx)); q.vy = Math.max(-.4, Math.min(.4, q.vy));
      }
      if (!reduceMotion) { q.x += q.vx * k; q.y += q.vy * k; }
      if (!exploding && (q.x < -20 || q.x > W + 20 || q.y < -20 || q.y > H + 20)) Object.assign(q, spawn(true));
      const sp = Math.hypot(q.vx, q.vy);
      const alpha = Math.min(1, q.a + p * .6);
      if (sp > 1.2) {
        ctx.strokeStyle = `rgba(${q.c},${alpha})`; ctx.lineWidth = q.r;
        ctx.beginPath(); ctx.moveTo(q.px - q.vx * 2, q.py - q.vy * 2); ctx.lineTo(q.x, q.y); ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(${q.c},${alpha})`;
        ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (1 + p), 0, Math.PI * 2); ctx.fill();
      }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.px = s.x; s.py = s.y; s.vx *= .955; s.vy *= .955; s.vy += .06 * k;
      s.x += s.vx * k; s.y += s.vy * k; s.life -= s.decay * k;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      ctx.strokeStyle = `rgba(${s.c},${s.life})`; ctx.lineWidth = s.r;
      ctx.beginPath(); ctx.moveTo(s.px - s.vx, s.py - s.vy); ctx.lineTo(s.x, s.y); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // ---- Inputs ---------------------------------------------------------------------------------
  button.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; e.preventDefault(); button.setPointerCapture?.(e.pointerId); setHolder('pointer', true); });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, () => setHolder('pointer', false));
  button.addEventListener('contextmenu', (e) => e.preventDefault());

  document.addEventListener('keydown', (e) => {
    if (done || !(e.code === 'Space' || e.key === 'Enter')) return;
    e.preventDefault(); if (!e.repeat) setHolder('key', true);
  });
  let lastKeyUp = -Infinity;
  document.addEventListener('keyup', (e) => { if (e.code === 'Space' || e.key === 'Enter') { lastKeyUp = performance.now(); setHolder('key', false); } });
  window.addEventListener('blur', () => { setHolder('key', false); setHolder('pointer', false); });

  // A click nothing is holding (Grev Home's controller browsing, assistive tech) runs the hold by itself.
  button.addEventListener('click', (e) => {
    if (e.detail !== 0 || holders.has('key') || holders.has('pointer') || performance.now() - lastKeyUp < 250) return;
    setHolder('auto', true);
    padStatus.textContent = 'Unlocking…';
  });

  // Controller: A (standard button 0) held on any connected pad.
  let padFrame = 0;
  const pollPads = () => {
    if (done) return;
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    setHolder('pad', pads.some((pad) => pad.buttons[0]?.pressed));
    padFrame = requestAnimationFrame(pollPads);
  };
  window.addEventListener('gamepadconnected', () => {
    padStatus.textContent = 'Controller connected. Hold A to unlock.';
    if (!padFrame) padFrame = requestAnimationFrame(pollPads);
  });
  if (navigator.getGamepads && [...navigator.getGamepads()].some(Boolean)) padFrame = requestAnimationFrame(pollPads);

  const rumble = () => {
    try { navigator.vibrate?.([30, 40, 80]); } catch {}
    try {
      for (const pad of navigator.getGamepads?.() || []) pad?.vibrationActuator?.playEffect?.('dual-rumble', { duration: 260, strongMagnitude: 1, weakMagnitude: 1 });
    } catch {}
  };

  // ---- Unlock sequence ------------------------------------------------------------------------
  function unlock() {
    if (done) return;
    done = true; holders.clear(); progress = 1; draw();
    cancelAnimationFrame(padFrame); clearInterval(clockTimer);
    rumble();
    const t = target();
    lock.style.setProperty('--bx', `${t.x}px`); lock.style.setProperty('--by', `${t.y}px`);
    lock.classList.remove('is-holding');
    lock.classList.add('is-open', 'is-bursting');
    padStatus.textContent = 'Unlocked';
    if (!reduceMotion) { exploding = true; burst(); }

    const at = reduceMotion ? { zoom: 60, split: 160, reveal: 160, done: 480 } : { zoom: 420, split: 980, reveal: 1080, done: 1950 };
    setTimeout(() => lock.classList.add('is-unlocking'), at.zoom);
    if (onLanding) {
      setTimeout(() => {
        try { sessionStorage.setItem(HANDOFF_KEY, String(Date.now())); } catch {}
        lock.classList.add('is-splitting');
        setTimeout(() => location.assign('/login'), reduceMotion ? 200 : 520);
      }, at.split);
      return;
    }
    setTimeout(() => lock.classList.add('is-splitting'), at.split);
    setTimeout(() => {
      shell?.removeAttribute('inert'); shell?.removeAttribute('aria-hidden');
      root.classList.add('gd-reveal');
    }, at.reveal);
    setTimeout(() => {
      alive = false; removeEventListener('resize', resize); lock.remove();
      document.querySelector('#login-form input[name="identifier"]')?.focus({ preventScroll: true });
    }, at.done);
  }

  button.focus({ preventScroll: true });
  draw();
})();
