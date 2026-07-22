(() => {
  const CARD_COLUMNS = 5;
  const CARD_ROWS = 6;
  const MOBILE_CARD_COLUMNS = 8;
  const CARD_SOURCE_WIDTH = 900;
  const CARD_SOURCE_HEIGHT = 600;
  const GRID_COLUMNS = 8;
  const MAX_TILE_WIDTH = 6;
  const MAX_TILE_HEIGHT = 4;
  const MAX_GRID_ROWS = 200;
  const repairedLayouts = new WeakSet();
  let gridObserver = null;

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
    const columnWidth = Math.max(1, (usableWidth - gap * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
    const mobile = matchMedia('(max-width:900px)').matches;
    const columnSpan = mobile ? MOBILE_CARD_COLUMNS : CARD_COLUMNS;
    const cardWidth = columnWidth * columnSpan + gap * (columnSpan - 1);
    const scale = cardWidth / CARD_SOURCE_WIDTH;
    const cardHeight = CARD_SOURCE_HEIGHT * scale;
    const rowHeight = Math.max(1, (cardHeight - gap * (CARD_ROWS - 1)) / CARD_ROWS);

    grid.style.setProperty('--tile-row-height', `${rowHeight}px`);
    slot.style.setProperty('--profile-card-canvas-scale', String(scale));
    slot.style.gridColumn = `1 / span ${columnSpan}`;
    slot.style.gridRow = `1 / span ${CARD_ROWS}`;
    slot.dataset.cardColumns = String(columnSpan);
    slot.dataset.cardRows = String(CARD_ROWS);
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

  function installGridRenderer() {
    if (typeof renderProfileGrid !== 'function' || renderProfileGrid.profileCanvasRenderer === true) return;
    const previous = renderProfileGrid;
    const integrated = function renderIntegratedProfileCanvas() {
      repairWorkingLayout();
      const slot = ensureCardSlot();
      previous();
      const grid = document.querySelector('#profile-grid');
      if (grid && slot) grid.prepend(slot);
      syncCanvasGeometry();
    };
    integrated.profileCanvasRenderer = true;
    renderProfileGrid = integrated;
  }

  function updateCanvasCopy() {
    const description = document.querySelector('#profile-grid-description');
    if (description && typeof profileState !== 'undefined') {
      description.textContent = profileState.editing
        ? 'The profile card is locked at the top left. Move and resize your other tiles around it.'
        : 'The locked profile card starts this canvas; personal tiles continue beside and below it.';
    }
    const badge = document.querySelector('.profile-grid-heading > strong');
    if (badge) badge.textContent = 'Card 5 × 6 · tiles flexible';
  }

  function initialise() {
    installPlacementGuard();
    installGridRenderer();
    ensureCardSlot();
    updateCanvasCopy();
    if (typeof profileState !== 'undefined' && profileState.working) renderProfileGrid();

    const grid = document.querySelector('#profile-grid');
    if (grid && typeof ResizeObserver === 'function' && !gridObserver) {
      gridObserver = new ResizeObserver(syncCanvasGeometry);
      gridObserver.observe(grid);
    }
    window.addEventListener('resize', syncCanvasGeometry, { passive: true });
    requestAnimationFrame(syncCanvasGeometry);
  }

  initialise();
  document.addEventListener('DOMContentLoaded', () => {
    installPlacementGuard();
    installGridRenderer();
    updateCanvasCopy();
    requestAnimationFrame(syncCanvasGeometry);
  }, { once: true });

  window.GrevProfileCanvas = {
    cardFootprint: lockedCardFootprint,
    overlapsLockedCard,
    repairWorkingLayout,
    syncCanvasGeometry
  };
})();