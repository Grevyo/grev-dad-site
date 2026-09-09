// Controller-first (and keyboard-first) editing for the profile tile grid, alongside the
// existing mouse drag in profile.js. Mirrors ProfileTileGridEditor.cs in Grev Home cell for cell:
// the same Browsing/Holding/Resizing modes, driven by the same five actions (up/down/left/right,
// accept, back), so a gamepad or the keyboard moves a tile the same way here as it does in Grev
// Home's own profile editor. Reuses profile.js's own grid rules (PROFILE_COLUMNS, validProfilePlacement,
// tileOverlaps) rather than redefining them, so "valid layout" stays defined in exactly one place.
(() => {
  const state = {
    mode: 'browsing', // 'browsing' | 'holding' | 'resizing'
    cursorX: 0,
    cursorY: 0,
    activeTileId: null,
    origin: null
  };

  function active() {
    return typeof profileState !== 'undefined' && profileState.editing && Array.isArray(profileState.working?.tiles);
  }

  function tileAt(x, y) {
    return profileState.working.tiles.find(tile => x >= tile.x && x < tile.x + tile.width && y >= tile.y && y < tile.y + tile.height) ?? null;
  }

  function clampCursor() {
    state.cursorX = Math.max(0, Math.min(PROFILE_COLUMNS - 1, state.cursorX));
    // PROFILE_MAX_GRID_Y (profile.js) is the same row limit the server enforces (MAX_GRID_Y in
    // src/profile.ts) - the cursor must never be able to wander past what a save would accept.
    state.cursorY = Math.max(0, Math.min(PROFILE_MAX_GRID_Y, state.cursorY));
  }

  function delta(action) {
    switch (action) {
      case 'up': return [0, -1];
      case 'down': return [0, 1];
      case 'left': return [-1, 0];
      case 'right': return [1, 0];
      default: return [0, 0];
    }
  }

  function activeTile() {
    return state.activeTileId ? profileState.working.tiles.find(tile => tile.tileId === state.activeTileId) ?? null : null;
  }

  function exitToBrowsing() {
    state.mode = 'browsing';
    state.activeTileId = null;
    state.origin = null;
  }

  function handleBrowsing(action) {
    if (['up', 'down', 'left', 'right'].includes(action)) {
      const [dx, dy] = delta(action);
      state.cursorX += dx;
      state.cursorY += dy;
      clampCursor();
      return true;
    }
    if (action === 'accept') {
      const tile = tileAt(state.cursorX, state.cursorY);
      if (!tile) return false; // empty cell: let the "add a tile" catalogue handle it
      state.mode = 'holding';
      state.activeTileId = tile.tileId;
      state.origin = { x: tile.x, y: tile.y, width: tile.width, height: tile.height };
      profileState.selectedId = tile.tileId;
      return true;
    }
    return false;
  }

  function handleHolding(action) {
    const tile = activeTile();
    if (!tile) { exitToBrowsing(); return false; }
    if (['up', 'down', 'left', 'right'].includes(action)) {
      const [dx, dy] = delta(action);
      const candidate = { ...tile, x: tile.x + dx, y: tile.y + dy };
      if (validProfilePlacement(candidate, tile.tileId)) {
        Object.assign(tile, { x: candidate.x, y: candidate.y });
        state.cursorX = candidate.x;
        state.cursorY = candidate.y;
      }
      return true;
    }
    if (action === 'accept') { exitToBrowsing(); return true; }
    if (action === 'back') {
      Object.assign(tile, state.origin);
      exitToBrowsing();
      return true;
    }
    if (action === 'resize') { state.mode = 'resizing'; return true; }
    return false;
  }

  function handleResizing(action) {
    const tile = activeTile();
    if (!tile) { exitToBrowsing(); return false; }
    const resizeDelta = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[action];
    if (resizeDelta) {
      const [dw, dh] = resizeDelta;
      const width = Math.max(1, Math.min(PROFILE_MAX_WIDTH, tile.width + dw));
      const height = Math.max(1, Math.min(PROFILE_MAX_HEIGHT, tile.height + dh));
      const candidate = { ...tile, width, height };
      if (validProfilePlacement(candidate, tile.tileId)) Object.assign(tile, { width, height });
      return true;
    }
    if (action === 'accept') { exitToBrowsing(); return true; }
    if (action === 'back') {
      Object.assign(tile, state.origin);
      exitToBrowsing();
      return true;
    }
    return false;
  }

  function handleAction(action) {
    if (!active()) return false;
    const consumed = state.mode === 'browsing' ? handleBrowsing(action)
      : state.mode === 'holding' ? handleHolding(action)
      : handleResizing(action);
    if (consumed) {
      renderProfileGrid();
      renderCursor();
      profileEditorMessage(hint());
    }
    return consumed;
  }

  function hint() {
    if (state.mode === 'holding') return 'Move the tile with the D-Pad or arrow keys. Accept/Enter drops it, Back/Escape cancels, X/R resizes.';
    if (state.mode === 'resizing') return 'Resize with the D-Pad or arrow keys. Accept/Enter confirms, Back/Escape reverts.';
    return 'Move the cursor with the D-Pad or arrow keys. Accept/Enter picks a tile up.';
  }

  function renderCursor() {
    document.querySelector('.profile-grid-cursor')?.remove();
    if (!active()) return;
    const grid = document.querySelector('#profile-grid');
    if (!grid) return;
    const tile = state.mode === 'browsing' ? null : activeTile();
    const box = tile ?? { x: state.cursorX, y: state.cursorY, width: 1, height: 1 };
    const cursor = document.createElement('div');
    cursor.className = `profile-grid-cursor${state.mode !== 'browsing' ? ' profile-grid-cursor-active' : ''}`;
    cursor.style.gridColumn = `${box.x + 1} / span ${box.width}`;
    cursor.style.gridRow = `${box.y + 1} / span ${box.height}`;
    grid.append(cursor);
  }

  const KEY_ACTIONS = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    Enter: 'accept', ' ': 'accept', Escape: 'back', r: 'resize', R: 'resize'
  };

  // Enter/Space must still activate whatever the browser would normally activate (a focused
  // button, link or other control) - only steal them for the grid cursor when focus is on
  // something inert (the tile grid itself, or nothing in particular).
  const NATIVE_ACTIVATION_TARGETS = 'input,textarea,select,button,a,[contenteditable="true"],[role="button"],[tabindex]';

  function onKeydown(event) {
    if (!active()) return;
    if (event.target instanceof HTMLElement && event.target.closest(NATIVE_ACTIVATION_TARGETS)) return;
    const action = KEY_ACTIONS[event.key];
    if (!action) return;
    if (handleAction(action)) event.preventDefault();
  }

  // Gamepad API: no "keydown" event exists for a gamepad, so this polls each animation frame and
  // edge-detects button transitions itself (a still-held button must not repeat-fire every frame).
  // Only the lowest-indexed connected pad drives editing - merging every connected controller's
  // input into one stream would let a second player's pad also move a first player's tiles.
  const GAMEPAD_BUTTON_ACTIONS = { 12: 'up', 13: 'down', 14: 'left', 15: 'right', 0: 'accept', 1: 'back', 2: 'resize' };
  let previouslyPressed = new Set();
  let pollHandle = null;

  function pollGamepads() {
    pollHandle = requestAnimationFrame(pollGamepads);
    if (!active()) { previouslyPressed = new Set(); return; }
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = Array.from(pads).find(candidate => candidate);
    const pressedNow = new Set();
    if (pad) {
      const axisX = pad.axes[0] ?? 0;
      const axisY = pad.axes[1] ?? 0;
      const AXIS_THRESHOLD = 0.5;
      if (axisX < -AXIS_THRESHOLD) pressedNow.add('axis-left'); else if (axisX > AXIS_THRESHOLD) pressedNow.add('axis-right');
      if (axisY < -AXIS_THRESHOLD) pressedNow.add('axis-up'); else if (axisY > AXIS_THRESHOLD) pressedNow.add('axis-down');
      pad.buttons.forEach((button, index) => {
        if (button?.pressed && GAMEPAD_BUTTON_ACTIONS[index]) pressedNow.add(`button-${index}`);
      });
    }
    const AXIS_ACTIONS = { 'axis-up': 'up', 'axis-down': 'down', 'axis-left': 'left', 'axis-right': 'right' };
    for (const key of pressedNow) {
      if (previouslyPressed.has(key)) continue; // only fire on the transition into "pressed"
      const action = key.startsWith('button-') ? GAMEPAD_BUTTON_ACTIONS[key.slice('button-'.length)] : AXIS_ACTIONS[key];
      if (action) handleAction(action);
    }
    previouslyPressed = pressedNow;
  }

  document.addEventListener('keydown', onKeydown);
  const originalRenderProfileGrid = typeof renderProfileGrid === 'function' ? renderProfileGrid : null;
  if (originalRenderProfileGrid) {
    renderProfileGrid = function tileControllerRenderProfileGrid(...args) {
      const result = originalRenderProfileGrid.apply(this, args);
      renderCursor();
      return result;
    };
  }
  if (typeof navigator.getGamepads === 'function') pollHandle = requestAnimationFrame(pollGamepads);

  window.GrevProfileTileController = { handleAction, state };
})();
