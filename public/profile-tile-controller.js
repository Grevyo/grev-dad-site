// Controller-first (and keyboard-first) editing for the profile tile grid, alongside the
// existing mouse drag in profile.js. Mirrors ProfileTileGridEditor.cs in Grev Home cell for cell:
// the same Browsing/Holding/Resizing modes plus an empty-cell add picker, driven by the same
// directional/accept/back actions. Reuses profile.js's own grid rules and profileTileDefaults so
// controller-created tiles can never drift from the mouse/touch catalogue's defaults.
(() => {
  const ADD_KINDS = ['text', 'link', 'media', 'stat'];
  const state = {
    mode: 'browsing', // 'browsing' | 'adding' | 'holding' | 'resizing'
    cursorX: 0,
    cursorY: 0,
    activeTileId: null,
    origin: null,
    addKindIndex: 0,
    messageOverride: null
  };

  function active() {
    return typeof profileState !== 'undefined' && profileState.editing && Array.isArray(profileState.working?.tiles);
  }

  function tileAt(x, y) {
    return profileState.working.tiles.find(tile => x >= tile.x && x < tile.x + tile.width && y >= tile.y && y < tile.y + tile.height) ?? null;
  }

  function clampCursor() {
    state.cursorX = Math.max(0, Math.min(PROFILE_COLUMNS - 1, state.cursorX));
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

  function setMessageOverride(text, type = '') {
    state.messageOverride = { text, type };
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
      if (!tile) {
        if (profileState.working.tiles.length >= PROFILE_MAX_TILES) {
          setMessageOverride(`A profile can have up to ${PROFILE_MAX_TILES} tiles.`, 'error');
          return true;
        }
        state.mode = 'adding';
        state.addKindIndex = 0;
        return true;
      }
      state.mode = 'holding';
      state.activeTileId = tile.tileId;
      state.origin = { x: tile.x, y: tile.y, width: tile.width, height: tile.height };
      profileState.selectedId = tile.tileId;
      return true;
    }
    return false;
  }

  function handleAdding(action) {
    if (action === 'left' || action === 'up') {
      state.addKindIndex = (state.addKindIndex + ADD_KINDS.length - 1) % ADD_KINDS.length;
      return true;
    }
    if (action === 'right' || action === 'down') {
      state.addKindIndex = (state.addKindIndex + 1) % ADD_KINDS.length;
      return true;
    }
    if (action === 'back') {
      exitToBrowsing();
      return true;
    }
    if (action !== 'accept') return false;

    if (profileState.working.tiles.length >= PROFILE_MAX_TILES) {
      setMessageOverride(`A profile can have up to ${PROFILE_MAX_TILES} tiles.`, 'error');
      exitToBrowsing();
      return true;
    }

    const type = ADD_KINDS[state.addKindIndex];
    const tile = profileTileDefaults(type);
    const atCursor = { ...tile, x: state.cursorX, y: state.cursorY };
    if (validProfilePlacement(atCursor)) Object.assign(tile, { x: state.cursorX, y: state.cursorY });

    profileState.working.tiles.push(tile);
    profileState.selectedId = tile.tileId;
    state.mode = 'holding';
    state.activeTileId = tile.tileId;
    state.origin = { x: tile.x, y: tile.y, width: tile.width, height: tile.height };
    state.cursorX = tile.x;
    state.cursorY = tile.y;
    return true;
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
    // Each action starts with a clean override slot. Handlers use it only for a deliberate
    // user-facing message (for example the 40-tile ceiling). That message must win over the normal
    // navigation hint for this action rather than flash and get immediately overwritten.
    state.messageOverride = null;
    const consumed = state.mode === 'browsing' ? handleBrowsing(action)
      : state.mode === 'adding' ? handleAdding(action)
      : state.mode === 'holding' ? handleHolding(action)
      : handleResizing(action);
    if (consumed) {
      const override = state.messageOverride;
      state.messageOverride = null;
      renderProfileGrid();
      renderCursor();
      if (override) profileEditorMessage(override.text, override.type);
      else profileEditorMessage(hint());
    }
    return consumed;
  }

  function formatKind(type) {
    if (type === 'media') return 'Picture / GIF';
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  function hint() {
    if (state.mode === 'adding') return `Add tile: ${formatKind(ADD_KINDS[state.addKindIndex])}. D-Pad/arrows change type, Accept/Enter adds it, Back/Escape cancels.`;
    if (state.mode === 'holding') return 'Move the tile with the D-Pad or arrow keys. Accept/Enter drops it, Back/Escape cancels, X/R resizes.';
    if (state.mode === 'resizing') return 'Resize with the D-Pad or arrow keys. Accept/Enter confirms, Back/Escape reverts.';
    return 'Move the cursor with the D-Pad or arrow keys. Accept/Enter picks a tile up or adds one on an empty cell.';
  }

  function renderCursor() {
    document.querySelector('.profile-grid-cursor')?.remove();
    if (!active()) return;
    const grid = document.querySelector('#profile-grid');
    if (!grid) return;
    const tile = state.mode === 'holding' || state.mode === 'resizing' ? activeTile() : null;
    const box = tile ?? { x: state.cursorX, y: state.cursorY, width: 1, height: 1 };
    const cursor = document.createElement('div');
    cursor.className = `profile-grid-cursor${tile ? ' profile-grid-cursor-active' : ''}${state.mode === 'adding' ? ' profile-grid-cursor-adding' : ''}`;
    cursor.style.gridColumn = `${box.x + 1} / span ${box.width}`;
    cursor.style.gridRow = `${box.y + 1} / span ${box.height}`;
    if (state.mode === 'adding') cursor.dataset.label = formatKind(ADD_KINDS[state.addKindIndex]);
    grid.append(cursor);
  }

  const KEY_ACTIONS = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    Enter: 'accept', ' ': 'accept', Escape: 'back', r: 'resize', R: 'resize'
  };

  const NATIVE_ACTIVATION_TARGETS = 'input,textarea,select,button,a,[contenteditable="true"],[role="button"],[tabindex]';

  function onKeydown(event) {
    if (!active()) return;
    if (event.target instanceof HTMLElement && event.target.closest(NATIVE_ACTIVATION_TARGETS)) return;
    const action = KEY_ACTIONS[event.key];
    if (!action) return;
    if (handleAction(action)) event.preventDefault();
  }

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
      if (previouslyPressed.has(key)) continue;
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

  window.GrevProfileTileController = { handleAction, state, addKinds: ADD_KINDS };
})();
