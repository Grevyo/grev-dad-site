// Grev.dad lock screen for signed-out visitors (on / and /login).
// Hold for 3 seconds to unlock: mouse or touch press, Space/Enter, or A on a controller (Gamepad API).
// Grev Home's in-app browser presses A as a single click, so a click that no pointer or key held
// (event.detail === 0) runs the same 3-second unlock by itself.
(() => {
  const HOLD_MS = 3000;
  const DRAIN_MS = 650;
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
    <div class="gd-shutter top" aria-hidden="true"></div>
    <div class="gd-shutter bottom" aria-hidden="true"></div>
    <div class="gd-seam" aria-hidden="true"></div>
    <div class="gd-lock-inner">
      <img class="gd-lock-logo" src="/grev-dad-logo-full.png" alt="Grev.dad">
      <p class="gd-clock" aria-hidden="true"></p>
      <p class="gd-date"></p>
      <button type="button" class="gd-hold" aria-describedby="gd-hint">
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
      <p class="gd-hint" id="gd-hint">Hold for 3 seconds: <kbd class="gd-a">A</kbd> on a controller, <kbd>Space</kbd> on a keyboard, or press and hold.</p>
      <p class="gd-pad-status" aria-live="polite"></p>
    </div>`;
  document.body.append(lock);
  release();

  const shell = document.querySelector('.auth-shell');
  shell?.setAttribute('inert', '');
  shell?.setAttribute('aria-hidden', 'true');

  const button = lock.querySelector('.gd-hold');
  const trace = lock.querySelector('.gd-trace');
  const fill = lock.querySelector('.gd-fill');
  const count = lock.querySelector('.gd-hold-count');
  const label = lock.querySelector('.gd-hold-label');
  const padStatus = lock.querySelector('.gd-pad-status');
  const clock = lock.querySelector('.gd-clock');
  const date = lock.querySelector('.gd-date');

  const tick = () => {
    const now = new Date();
    clock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    date.textContent = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
  };
  tick();
  const clockTimer = setInterval(tick, 1000);

  // Inputs currently holding the button. Unlock runs while any is held.
  const holders = new Set();
  let progress = 0, last = performance.now(), done = false, frame = 0;

  const setHolder = (name, on) => {
    if (done) return;
    on ? holders.add(name) : holders.delete(name);
    button.classList.toggle('is-holding', holders.size > 0);
    if (holders.size && !frame) { last = performance.now(); frame = requestAnimationFrame(step); }
  };

  const draw = () => {
    trace.style.strokeDasharray = `${progress * 400} 400`;
    trace.style.opacity = progress > 0 ? '1' : '0';
    fill.style.height = `${progress * 100}%`;
    const left = Math.ceil((1 - progress) * HOLD_MS / 1000);
    count.textContent = holders.size && progress < 1 ? `${left}…` : '';
    label.textContent = progress >= 1 ? 'Unlocked' : holders.size ? 'Keep holding' : 'Hold to unlock';
  };

  const step = (now) => {
    const dt = Math.min(64, now - last); last = now;
    progress = holders.size ? Math.min(1, progress + dt / HOLD_MS) : Math.max(0, progress - dt / DRAIN_MS);
    draw();
    if (progress >= 1) { frame = 0; unlock(); return; }
    frame = (holders.size || progress > 0) ? requestAnimationFrame(step) : 0;
  };

  // Pointer (mouse, pen, touch)
  button.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; e.preventDefault(); button.setPointerCapture?.(e.pointerId); setHolder('pointer', true); });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, () => setHolder('pointer', false));
  button.addEventListener('contextmenu', (e) => e.preventDefault());

  // Keyboard: Space or Enter, anywhere on the lock screen
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
  window.addEventListener('gamepadconnected', (e) => {
    padStatus.textContent = `Controller connected. Hold A to unlock.`;
    if (!padFrame) padFrame = requestAnimationFrame(pollPads);
  });
  if (navigator.getGamepads && [...navigator.getGamepads()].some(Boolean)) padFrame = requestAnimationFrame(pollPads);

  const rumble = () => {
    try { navigator.vibrate?.(40); } catch {}
    try {
      for (const pad of navigator.getGamepads?.() || []) pad?.vibrationActuator?.playEffect?.('dual-rumble', { duration: 160, strongMagnitude: .6, weakMagnitude: .8 });
    } catch {}
  };

  function unlock() {
    if (done) return;
    done = true; holders.clear(); draw();
    cancelAnimationFrame(padFrame); clearInterval(clockTimer);
    rumble();
    lock.classList.add('is-open');
    padStatus.textContent = 'Unlocked';
    const t = reduceMotion ? [60, 120, 420] : [260, 640, 1300];
    setTimeout(() => lock.classList.add('is-unlocking'), t[0]);
    if (onLanding) {
      setTimeout(() => {
        try { sessionStorage.setItem(HANDOFF_KEY, String(Date.now())); } catch {}
        lock.classList.add('is-splitting');
        setTimeout(() => location.assign('/login'), reduceMotion ? 200 : 420);
      }, t[1]);
      return;
    }
    setTimeout(() => {
      shell?.removeAttribute('inert'); shell?.removeAttribute('aria-hidden');
      root.classList.add('gd-reveal');
      lock.classList.add('is-splitting');
    }, t[1]);
    setTimeout(() => {
      lock.remove();
      document.querySelector('#login-form input[name="identifier"]')?.focus({ preventScroll: true });
    }, t[2]);
  }

  button.focus({ preventScroll: true });
  draw();
})();
