// Grev.dad lock screen for signed-out visitors (on / and /login, which both show the log-in form).
// Hold for 2 seconds to unlock: mouse or touch press, Space/Enter, or A on a controller (Gamepad API).
// Grev Home's in-app browser presses A as a single click, so a click that no pointer or key held
// (event.detail === 0) runs the same 2-second unlock by itself.
//
// The whole screen reacts to the hold: a particle field drifts at rest, then streams into the
// button, the grid zooms and brightens, the glow closes in and the screen trembles near the end.
// Lightning arcs reach in from the edges and a ring of light orbits and tightens round the button.
// Unlocking fires a flash, light rays, a shockwave and a particle burst, shatters the clock, splits
// the screen open and flies the logo into its place on the log-in panel, while the form builds in.
(() => {
  const HOLD_MS = 2000;
  const DRAIN_MS = 500;
  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const release = () => root.classList.remove('gd-lock-pending');

  // Coming back from the sign-up page you've already unlocked: just build the form in.
  let fromSignup = false;
  try { const ref = new URL(document.referrer); fromSignup = ref.origin === location.origin && ref.pathname === '/signup'; } catch {}
  if (fromSignup) {
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
    <div class="gd-rays" aria-hidden="true"></div>
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
  // The particles are decoration: if canvas drawing isn't available the lock still works without them.
  let ctx = null;
  try { ctx = canvas.getContext('2d'); } catch {}
  const COLORS = ['125,147,255', '169,183,255', '194,125,255', '69,209,255', '255,255,255'];
  let W = 0, H = 0, DPR = 1;
  const particles = [], sparks = [], arcs = [];
  const orbit = Array.from({ length: 48 }, (_, i) => ({ a: i / 48 * Math.PI * 2, r: Math.random() * .25 + .9, c: COLORS[i % COLORS.length] }));
  let spin = 0;
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
    if (ctx) {
      canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
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

  // A jagged bolt from a random point on the screen edge to the button.
  const bolt = (t) => {
    const side = Math.floor(Math.random() * 4);
    let x = side === 0 ? 0 : side === 1 ? W : Math.random() * W;
    let y = side === 2 ? 0 : side === 3 ? H : Math.random() * H;
    const pts = [[x, y]], steps = 12;
    for (let i = 1; i <= steps; i++) {
      const f = i / steps, jitter = (1 - f) * 38;
      pts.push([x + (t.x - x) * f + (Math.random() - .5) * jitter, y + (t.y - y) * f + (Math.random() - .5) * jitter]);
    }
    arcs.push({ pts, life: 1, c: COLORS[Math.floor(Math.random() * 4)] });
  };

  // The clock breaks into sparks that fly out from where its digits were.
  const shatter = (el, count) => {
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (let i = 0; i < count; i++) {
      const x = r.left + Math.random() * r.width, y = r.top + r.height * (.15 + Math.random() * .7);
      const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1, sp = Math.random() * 7 + 2;
      sparks.push({ x, y, px: x, py: y, vx: dx / d * sp + (Math.random() - .5) * 2, vy: dy / d * sp - Math.random() * 3,
        r: Math.random() * 2 + .8, c: COLORS[Math.floor(Math.random() * COLORS.length)], life: 1, decay: Math.random() * .014 + .01 });
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
    // The hold is timed in real time, so a slow device still unlocks after 2 seconds; only the
    // particle motion uses a capped step.
    const real = Math.min(250, now - last), dt = Math.min(48, real); last = now;
    if (!done) {
      progress = holders.size ? Math.min(1, progress + real / HOLD_MS) : Math.max(0, progress - real / DRAIN_MS);
      draw();
      if (progress >= 1) unlock();
    }

    if (!ctx) { requestAnimationFrame(frame); return; }
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
    // Lightning, more of it the longer you hold.
    if (!done && !reduceMotion && holders.size && Math.random() < p * p * .55) bolt(t);
    for (let i = arcs.length - 1; i >= 0; i--) {
      const arc = arcs[i];
      arc.life -= .11 * k;
      if (arc.life <= 0) { arcs.splice(i, 1); continue; }
      for (const [width, alpha] of [[6, .12], [2.4, .35], [1, .95]]) {
        ctx.strokeStyle = `rgba(${arc.c},${alpha * arc.life})`; ctx.lineWidth = width;
        ctx.beginPath(); arc.pts.forEach(([x, y], j) => j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
      }
    }
    // A ring of light orbiting the button, tightening and speeding up as the hold fills.
    if (p > 0 && !reduceMotion) {
      const r0 = button.getBoundingClientRect().width * .5;
      spin += (.01 + p * .12) * k;
      const radius = r0 * (2.4 - p * 1.2);
      for (const o of orbit) {
        const ang = o.a + spin * o.r, rr = radius * o.r;
        ctx.fillStyle = `rgba(${o.c},${Math.min(1, p * 1.4)})`;
        ctx.beginPath(); ctx.arc(t.x + Math.cos(ang) * rr, t.y + Math.sin(ang) * rr * .92, 1.2 + p * 2, 0, Math.PI * 2); ctx.fill();
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
  // The lock screen's logo flies to the log-in panel's logo and lands in its place.
  const flyLogo = (delay, duration) => {
    const from = $('.gd-lock-logo'), to = document.querySelector('.brand-panel img');
    if (!from || !to || reduceMotion || !from.animate) return;
    const a = from.getBoundingClientRect();
    const clone = from.cloneNode(true);
    clone.className = 'gd-logo-flight';
    Object.assign(clone.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` });
    to.classList.add('gd-logo-waiting');
    setTimeout(() => {
      document.body.append(clone);
      from.style.visibility = 'hidden';
      // Measured as the panel will sit once its rise has finished.
      const b = to.getBoundingClientRect(), scale = b.width / a.width;
      const dx = b.left - a.left, dy = b.top - a.top;
      const flight = clone.animate([
        { transform: 'translate(0,0) scale(1) rotate(0deg)', filter: 'drop-shadow(0 0 0 rgba(125,147,255,0))' },
        { transform: `translate(${dx * .35}px,${dy * .35 - 70}px) scale(${(1 + scale) / 2 * 1.25}) rotate(-6deg)`, filter: 'drop-shadow(0 0 40px rgba(169,183,255,1))', offset: .45 },
        { transform: `translate(${dx}px,${dy}px) scale(${scale}) rotate(0deg)`, filter: 'drop-shadow(0 0 14px rgba(125,147,255,.6))' }
      ], { duration, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' });
      flight.onfinish = () => { to.classList.remove('gd-logo-waiting'); to.classList.add('gd-logo-landed'); clone.remove(); };
    }, delay);
  };

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
    if (!reduceMotion && ctx) {
      exploding = true; burst(); arcs.length = 0;
      for (let i = 0; i < 6; i++) bolt(t);
      shatter(clock, 260); shatter(date, 60);
    }

    const at = reduceMotion ? { zoom: 60, split: 160, reveal: 160, done: 480 } : { zoom: 420, split: 980, reveal: 1080, done: 2300 };
    flyLogo(at.zoom - 60, at.reveal + 800 - at.zoom + 60);
    setTimeout(() => lock.classList.add('is-unlocking'), at.zoom);
    setTimeout(() => lock.classList.add('is-splitting'), at.split);
    setTimeout(() => {
      shell?.removeAttribute('inert'); shell?.removeAttribute('aria-hidden');
      root.classList.add('gd-reveal');
      window.dispatchEvent(new CustomEvent('grev-ambient-burst', { detail: { x: innerWidth / 2, y: innerHeight / 2 } }));
    }, at.reveal);
    setTimeout(() => {
      alive = false; removeEventListener('resize', resize); lock.remove();
      document.querySelector('#login-form input[name="identifier"]')?.focus({ preventScroll: true });
    }, at.done);
  }

  button.focus({ preventScroll: true });
  draw();
})();
