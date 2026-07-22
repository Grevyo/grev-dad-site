(() => {
  const CARD_COLUMNS = 4;
  const CARD_ROWS = 6;
  const CARD_SOURCE_WIDTH = 900;
  const CARD_SOURCE_HEIGHT = 600;
  const GRID_COLUMNS = 8;
  const MAX_TILE_WIDTH = 6;
  const MAX_TILE_HEIGHT = 4;
  const MAX_GRID_ROWS = 200;
  const repairedLayouts = new WeakSet();
  let gridObserver = null;
  let lastGeometry = '';
  let tileMode = false;
  let tileRoutingInstalled = false;

  function overlaps(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  function lockedCardFootprint() {
    return { x: 0, y: 0, width: CARD_COLUMNS, height: CARD_ROWS };
  }

  function overlapsLockedCard(candidate) {
    return overlaps(candidate, lockedCardFootprint());
  }

  function validAgainstPlaced(candidate, placed, ignoreId = null) {
    if (
      !Number.isInteger(candidate.x) || !Number.isInteger(candidate.y) ||
      !Number.isInteger(candidate.width) || !Number.isInteger(candidate.height) ||
      candidate.x < 0 || candidate.y < 0 || candidate.y > MAX_GRID_ROWS - 1 ||
      candidate.width < 1 || candidate.width > MAX_TILE_WIDTH ||
      candidate.height < 1 || candidate.height > MAX_TILE_HEIGHT ||
      candidate.x + candidate.width > GRID_COLUMNS ||
      candidate.y + candidate.height > MAX_GRID_ROWS ||
      overlapsLockedCard(candidate)
    ) return false;
    return !placed.some(tile => tile.tileId !== ignoreId && overlaps(candidate, tile));
  }

  function firstFreePlacement(width, height, placed, ignoreId = null) {
    for (let y = 0; y <= MAX_GRID_ROWS - height; y += 1) {
      for (let x = 0; x <= GRID_COLUMNS - width; x += 1) {
        const candidate = { x, y, width, height };
        if (validAgainstPlaced(candidate, placed, ignoreId)) return candidate;
      }
    }
    return { x: 0, y: Math.max(CARD_ROWS, MAX_GRID_ROWS - height), width, height };
  }

  function repairWorkingLayout() {
    const working = typeof profileState !== 'undefined' ? profileState.working : null;
    if (!working || repairedLayouts.has(working) || !Array.isArray(working.tiles)) return;

    const placed = [];
    for (const tile of working.tiles) {
      tile.width = Math.min(MAX_TILE_WIDTH, Math.max(1, Number.parseInt(tile.width, 10) || 1));
      tile.height = Math.min(MAX_TILE_HEIGHT, Math.max(1, Number.parseInt(tile.height, 10) || 1));
      tile.x = Number.parseInt(tile.x, 10) || 0;
      tile.y = Number.parseInt(tile.y, 10) || 0;

      if (!validAgainstPlaced(tile, placed, tile.tileId)) {
        Object.assign(tile, firstFreePlacement(tile.width, tile.height, placed, tile.tileId));
      }
      placed.push(tile);
    }
    repairedLayouts.add(working);
  }

  function ensureCardSlot() {
    const grid = document.querySelector('#profile-grid');
    const card = document.querySelector('#profile-card');
    if (!grid || !card) return null;

    let slot = document.querySelector('#profile-card-grid-slot');
    if (!slot) {
      slot = document.createElement('section');
      slot.id = 'profile-card-grid-slot';
      slot.className = 'profile-card-grid-slot';
      slot.setAttribute('aria-label', 'Locked profile card tile');
    }
    if (card.parentElement !== slot) slot.append(card);
    if (slot.parentElement !== grid) grid.prepend(slot);
    return slot;
  }

  function syncCanvasGeometry() {
    const grid = document.querySelector('#profile-grid');
    const slot = ensureCardSlot();
    if (!grid || !slot) return;

    const styles = getComputedStyle(grid);
    const rect = grid.getBoundingClientRect();
    const gap = Number.parseFloat(styles.columnGap) || 0;
    const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
    const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
    const usableWidth = Math.max(1, rect.width - paddingLeft - paddingRight);
    const mobile = matchMedia('(max-width:900px)').matches;
    const rowHeight = Number.parseFloat(styles.getPropertyValue('--tile-row-height')) || 100;

    let scale;
    let geometry;
    if (mobile) {
      scale = Math.min(1, usableWidth / CARD_SOURCE_WIDTH);
      const cardHeight = CARD_SOURCE_HEIGHT * scale;
      geometry = ['mobile', gap.toFixed(3), scale.toFixed(6), cardHeight.toFixed(3)].join(':');
      if (geometry === lastGeometry) return;
      lastGeometry = geometry;
      slot.style.gridColumn = '1 / -1';
      slot.style.gridRow = 'auto';
      slot.style.height = `${cardHeight}px`;
      slot.dataset.cardColumns = 'full';
      slot.dataset.cardRows = 'auto';
    } else {
      const columnWidth = Math.max(1, (usableWidth - gap * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
      const slotWidth = columnWidth * CARD_COLUMNS + gap * (CARD_COLUMNS - 1);
      const slotHeight = rowHeight * CARD_ROWS + gap * (CARD_ROWS - 1);
      scale = Math.min(1, slotWidth / CARD_SOURCE_WIDTH, slotHeight / CARD_SOURCE_HEIGHT);
      geometry = ['desktop', gap.toFixed(3), rowHeight.toFixed(3), scale.toFixed(6)].join(':');
      if (geometry === lastGeometry) return;
      lastGeometry = geometry;
      slot.style.gridColumn = `1 / span ${CARD_COLUMNS}`;
      slot.style.gridRow = `1 / span ${CARD_ROWS}`;
      slot.style.height = '';
      slot.dataset.cardColumns = String(CARD_COLUMNS);
      slot.dataset.cardRows = String(CARD_ROWS);
    }

    slot.style.setProperty('--profile-card-canvas-scale', String(scale));
  }

  function installPlacementGuard() {
    if (typeof validProfilePlacement !== 'function' || validProfilePlacement.profileCardObstacle === true) return;
    const previous = validProfilePlacement;
    const guarded = function profileCanvasValidPlacement(candidate, ignoreId = null) {
      if (overlapsLockedCard(candidate)) return false;
      return previous(candidate, ignoreId);
    };
    guarded.profileCardObstacle = true;
    validProfilePlacement = guarded;
  }

  function updateCanvasCopy() {
    const description = document.querySelector('#profile-grid-description');
    if (description && typeof profileState !== 'undefined') {
      description.textContent = profileState.editing
        ? 'Drag and resize your tiles around the locked profile card.'
        : 'The locked profile card starts this canvas; personal tiles continue beside and below it.';
    }
    const badge = document.querySelector('.profile-grid-heading > strong');
    if (badge) badge.textContent = 'Card 4 × 6 · tiles flexible';
    const emptyText = document.querySelector('#profile-empty p');
    if (emptyText) emptyText.textContent = 'This member has not added any personal tiles beside or below their profile card.';
  }

  function installGridRenderer() {
    if (typeof renderProfileGrid !== 'function' || renderProfileGrid.profileCanvasRenderer === true) return;
    const previous = renderProfileGrid;
    const integrated = function renderIntegratedProfileCanvas() {
      repairWorkingLayout();
      const slot = ensureCardSlot();
      previous();
      const grid = document.querySelector('#profile-grid');
      if (grid && slot) grid.prepend(slot);
      updateCanvasCopy();
      queueMicrotask(updateCanvasCopy);
      lastGeometry = '';
      syncCanvasGeometry();
    };
    integrated.profileCanvasRenderer = true;
    renderProfileGrid = integrated;
  }

  function closeUnifiedPanel() {
    const panel = document.querySelector('#profile-unified-editor');
    panel?.querySelectorAll('dialog[open]').forEach(dialog => dialog.removeAttribute('open'));
    if (panel?.open) panel.close();
    else panel?.removeAttribute('open');
    document.body.classList.remove('profile-unified-editing', 'profile-unified-previewing', 'profile-mobile-editor-scroll-locked');
    if (tileMode) queueMicrotask(mountTileMessage);
  }

  function tileToolbar() {
    let toolbar = document.querySelector('#profile-tile-customizer-toolbar');
    if (toolbar) return toolbar;
    toolbar = document.createElement('section');
    toolbar.id = 'profile-tile-customizer-toolbar';
    toolbar.className = 'profile-tile-customizer-toolbar';
    toolbar.hidden = true;
    toolbar.innerHTML = `
      <div class="profile-tile-customizer-copy">
        <p class="eyebrow">Tile customizer</p>
        <h2>Arrange your profile tiles</h2>
        <p>Drag tiles to move them, use the bottom-right handle to resize, or open Tile settings for content and styling.</p>
      </div>
      <div class="profile-tile-customizer-actions">
        <button type="button" data-profile-tile-picker-toggle>Add tile</button>
        <button type="button" data-profile-tile-pack>Pack tiles</button>
        <button type="button" data-profile-tile-cancel>Cancel</button>
        <button type="button" class="primary" data-profile-tile-save>Save tiles</button>
      </div>
      <div class="profile-tile-customizer-picker" data-profile-tile-picker hidden>
        <button type="button" data-profile-canvas-add="text"><strong>Text</strong><span>Notes, an introduction or longer profile copy.</span></button>
        <button type="button" data-profile-canvas-add="link"><strong>Link</strong><span>A clickable shortcut to a website or page.</span></button>
        <button type="button" data-profile-canvas-add="media"><strong>Picture / GIF</strong><span>A visual tile using an uploaded image.</span></button>
        <button type="button" data-profile-canvas-add="stat"><strong>Stat</strong><span>A large value with a label and explanation.</span></button>
      </div>
      <div class="profile-tile-customizer-message" data-profile-tile-message-slot></div>`;
    const message = document.querySelector('#profile-message');
    if (message) message.insertAdjacentElement('afterend', toolbar);
    else document.querySelector('.profile-shell')?.prepend(toolbar);

    const picker = toolbar.querySelector('[data-profile-tile-picker]');
    toolbar.querySelector('[data-profile-tile-picker-toggle]')?.addEventListener('click', () => {
      picker.hidden = !picker.hidden;
    });
    toolbar.querySelector('[data-profile-tile-pack]')?.addEventListener('click', () => {
      if (typeof packProfileTiles === 'function') packProfileTiles();
    });
    toolbar.querySelector('[data-profile-tile-cancel]')?.addEventListener('click', () => {
      if (typeof leaveProfileEditor === 'function') leaveProfileEditor(false);
    });
    toolbar.querySelector('[data-profile-tile-save]')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        if (typeof saveProfile === 'function') await saveProfile();
      } finally {
        if (typeof profileState !== 'undefined' && profileState.editing) button.disabled = false;
      }
    });
    toolbar.querySelectorAll('[data-profile-canvas-add]').forEach(button => {
      button.addEventListener('click', () => {
        if (typeof profileTileDefaults !== 'function' || typeof profileState === 'undefined' || !profileState.working) return;
        const type = button.dataset.profileCanvasAdd;
        const tile = profileTileDefaults(type);
        profileState.working.tiles.push(tile);
        profileState.selectedId = tile.tileId;
        renderProfileGrid();
        picker.hidden = true;
        if (typeof profileEditorMessage === 'function') profileEditorMessage(`${type === 'media' ? 'Picture / GIF' : type} tile added. Drag it into place or open Tile settings.`);
      });
    });
    return toolbar;
  }

  function mountTileMessage() {
    const message = document.querySelector('#profile-editor-message');
    const slot = tileToolbar().querySelector('[data-profile-tile-message-slot]');
    if (message && slot && message.parentElement !== slot) slot.append(message);
  }

  function restoreUnifiedMessage() {
    const message = document.querySelector('#profile-editor-message');
    const slot = document.querySelector('#profile-unified-editor [data-unified-message-slot]');
    if (message && slot && message.parentElement !== slot) slot.append(message);
  }

  function syncTileModeUi() {
    const customize = document.querySelector('#profile-customize-tiles');
    const toolbar = tileToolbar();
    const isSelf = Boolean(typeof profileState !== 'undefined' && profileState.profile?.isSelf);
    const editing = Boolean(typeof profileState !== 'undefined' && profileState.editing);
    if (customize) customize.hidden = !isSelf || editing;
    toolbar.hidden = !tileMode;
  }

  function finishTileMode() {
    tileMode = false;
    document.body.classList.remove('profile-tile-customizing');
    const picker = document.querySelector('[data-profile-tile-picker]');
    if (picker) picker.hidden = true;
    closeUnifiedPanel();
    restoreUnifiedMessage();
    syncTileModeUi();
  }

  function installLeaveHook() {
    if (typeof leaveProfileEditor !== 'function' || leaveProfileEditor.profileTileModeHook === true) return;
    const previous = leaveProfileEditor;
    const wrapped = function leaveProfileEditorWithTileMode(saved = false) {
      const result = previous(saved);
      if (tileMode) finishTileMode();
      return result;
    };
    wrapped.profileTileModeHook = true;
    leaveProfileEditor = wrapped;
  }

  function installProfileRendererHook() {
    if (typeof renderProfile !== 'function' || renderProfile.profileCanvasUiHook === true) return;
    const previous = renderProfile;
    const wrapped = function renderProfileWithCanvasUi() {
      const result = previous();
      syncTileModeUi();
      return result;
    };
    wrapped.profileCanvasUiHook = true;
    renderProfile = wrapped;
  }

  function enterTileMode() {
    if (typeof profileState === 'undefined' || !profileState.profile?.isSelf || !profileState.working) return;
    tileMode = true;
    document.body.classList.add('profile-tile-customizing');
    tileToolbar();
    mountTileMessage();
    if (!profileState.editing && typeof enterProfileEditor === 'function') enterProfileEditor();
    queueMicrotask(closeUnifiedPanel);
    requestAnimationFrame(() => {
      closeUnifiedPanel();
      mountTileMessage();
      syncTileModeUi();
      updateCanvasCopy();
      document.querySelector('#profile-grid')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      if (typeof profileEditorMessage === 'function') profileEditorMessage('Tile mode is active. Drag, resize, add or pack tiles, then save.');
    });
  }

  function installTileModeRouting() {
    if (tileRoutingInstalled) return;
    tileRoutingInstalled = true;
    const customize = document.querySelector('#profile-customize-tiles');
    if (customize) customize.addEventListener('click', enterTileMode);

    document.addEventListener('click', event => {
      if (!tileMode) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest('[data-unified-close]')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeUnifiedPanel();
    }, true);

    window.addEventListener('keydown', event => {
      const panel = document.querySelector('#profile-unified-editor');
      if (!tileMode || !panel?.open || event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeUnifiedPanel();
    }, true);

    window.addEventListener('pointerup', event => {
      const panel = document.querySelector('#profile-unified-editor');
      if (!tileMode || !panel?.open || event.target !== panel) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeUnifiedPanel();
    }, true);
  }

  function initialise() {
    installPlacementGuard();
    installGridRenderer();
    installLeaveHook();
    installProfileRendererHook();
    installTileModeRouting();
    ensureCardSlot();
    tileToolbar();
    updateCanvasCopy();
    syncTileModeUi();
    if (typeof profileState !== 'undefined' && profileState.working) renderProfileGrid();

    const editButton = document.querySelector('#profile-edit');
    if (editButton) new MutationObserver(syncTileModeUi).observe(editButton, { attributes: true, attributeFilter: ['hidden'] });
    const grid = document.querySelector('#profile-grid');
    if (grid && typeof ResizeObserver === 'function' && !gridObserver) {
      gridObserver = new ResizeObserver(() => {
        lastGeometry = '';
        syncCanvasGeometry();
      });
      gridObserver.observe(grid);
    }
    window.addEventListener('resize', () => {
      lastGeometry = '';
      syncCanvasGeometry();
    }, { passive: true });
    requestAnimationFrame(syncCanvasGeometry);
  }

  window.GrevProfileCanvas = {
    cardFootprint: lockedCardFootprint,
    overlapsLockedCard,
    repairWorkingLayout,
    syncCanvasGeometry,
    enterTileMode
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialise, { once: true });
  else initialise();
})();