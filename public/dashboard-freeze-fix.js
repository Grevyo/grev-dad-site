(() => {
  if (window.GrevDashboardCustomizerStability?.version >= 2) return;
  if (typeof dashboardState === 'undefined' || typeof dashboardElement !== 'function' || typeof renderDashboardGrid !== 'function') return;

  const GRID_COLUMNS_SAFE = 8;
  const MAX_GRID_Y_SAFE = 199;
  const MAX_DECORATIVE_ROWS = 32;
  const COMPACT_AFTER_ROW = 80;
  let opening = false;

  const integer = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.trunc(number) : fallback;
  };
  const overlapsSafe = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

  function normaliseTile(tile) {
    const width = Math.max(1, Math.min(6, integer(tile.width, 2)));
    const height = Math.max(1, Math.min(4, integer(tile.height, 1)));
    return {
      ...tile,
      width,
      height,
      x: Math.max(0, Math.min(GRID_COLUMNS_SAFE - width, integer(tile.x, 0))),
      y: Math.max(0, Math.min(MAX_GRID_Y_SAFE, integer(tile.y, 0)))
    };
  }

  function layoutNeedsRepair(tiles) {
    if (tiles.some(tile => tile.y + tile.height > COMPACT_AFTER_ROW)) return true;
    return tiles.some((tile, index) => tiles.slice(0, index).some(other => overlapsSafe(tile, other)));
  }

  function compactTiles(tiles) {
    const packed = [];
    for (const source of tiles) {
      const tile = normaliseTile(source);
      let placement = null;
      for (let y = 0; y <= MAX_GRID_Y_SAFE && !placement; y += 1) {
        for (let x = 0; x <= GRID_COLUMNS_SAFE - tile.width; x += 1) {
          const candidate = { x, y, width: tile.width, height: tile.height };
          if (!packed.some(existing => overlapsSafe(candidate, existing))) {
            placement = candidate;
            break;
          }
        }
      }
      packed.push({ ...tile, ...(placement || { x: 0, y: Math.min(MAX_GRID_Y_SAFE, packed.length * tile.height) }) });
    }
    return packed;
  }

  function workingCopy() {
    const source = typeof clonePinnedTiles === 'function' ? clonePinnedTiles() : [];
    const normalised = source.slice(0, 60).map(normaliseTile);
    const repaired = layoutNeedsRepair(normalised);
    return { tiles: repaired ? compactTiles(normalised) : normalised, repaired };
  }

  function setValue(selector, value) {
    const element = dashboardElement(selector);
    if (element) element.value = String(value ?? '');
  }

  function setChecked(selector, value) {
    const element = dashboardElement(selector);
    if (element) element.checked = Boolean(value);
  }

  function suppressQueuedHistory(callback) {
    const nativeQueueMicrotask = window.queueMicrotask;
    window.queueMicrotask = () => {};
    try {
      return callback();
    } finally {
      window.queueMicrotask = nativeQueueMicrotask;
    }
  }

  const originalAddGridCells = typeof addGridCells === 'function' ? addGridCells : null;
  if (originalAddGridCells) {
    addGridCells = function stableDecorativeGridCells(grid, rows) {
      return originalAddGridCells(grid, Math.min(MAX_DECORATIVE_ROWS, Math.max(0, integer(rows, 0))));
    };
  }

  renderEditor = function stableDashboardEditorRender() {
    renderDashboardGrid();
    renderSelectedControls();
    const picker = document.querySelector('#dashboard-tile-picker-dialog');
    if (picker?.open) {
      renderCatalogueTools();
      renderCatalogue();
    }
  };

  openEditor = function stableDashboardEditorOpen() {
    if (opening || !dashboardState.payload || dashboardState.editing) return;
    opening = true;
    const toolbar = dashboardElement('#dashboard-editor-toolbar');
    const customize = dashboardElement('#customize-dashboard');
    try {
      const copy = workingCopy();
      dashboardState.editing = true;
      dashboardState.iconUploads?.clear?.();
      dashboardState.workingTiles = copy.tiles;
      dashboardState.selectedId = null;
      dashboardState.search = '';
      dashboardState.category = 'all';

      const preferences = dashboardState.payload.preferences || {};
      setValue('#dashboard-density', preferences.density || 'comfortable');
      setValue('#dashboard-tile-gap', Number.isFinite(Number(preferences.tileGap)) ? preferences.tileGap : 12);
      setValue('#dashboard-outer-margin', Number.isFinite(Number(preferences.outerMargin)) ? preferences.outerMargin : 0);
      setChecked('#dashboard-show-descriptions', preferences.showDescriptions !== false);
      setValue('#dashboard-feature-search', '');

      if (toolbar) toolbar.hidden = false;
      const cataloguePanel = dashboardElement('#dashboard-editor-catalogue-panel');
      if (cataloguePanel) cataloguePanel.hidden = true;
      const gridHeading = dashboardElement('#dashboard-grid-heading');
      if (gridHeading) gridHeading.hidden = false;
      if (customize) customize.hidden = true;
      dashboardElement('#dashboard-shell')?.classList.add('dashboard-editing');
      editorMessage('Opening the dashboard editor…');

      requestAnimationFrame(() => {
        try {
          suppressQueuedHistory(() => renderDashboardGrid());
          const controls = dashboardElement('#dashboard-selected-controls');
          if (controls) controls.hidden = true;
          editorMessage(copy.repaired
            ? 'The editor is ready. A stale grid position was compacted in this unsaved working copy to keep the page stable.'
            : 'The editor is ready. Choose Arrange tiles, Add a tile or Dashboard spacing.');
        } catch (error) {
          dashboardState.editing = false;
          dashboardState.workingTiles = [];
          if (toolbar) toolbar.hidden = true;
          if (customize) customize.hidden = false;
          dashboardElement('#dashboard-shell')?.classList.remove('dashboard-editing');
          dashboardMessage(`The dashboard editor could not open safely: ${error instanceof Error ? error.message : 'Unknown browser error'}`, 'error');
        } finally {
          opening = false;
        }
      });
    } catch (error) {
      dashboardState.editing = false;
      dashboardState.workingTiles = [];
      if (toolbar) toolbar.hidden = true;
      if (customize) customize.hidden = false;
      dashboardElement('#dashboard-shell')?.classList.remove('dashboard-editing');
      dashboardMessage(`The dashboard editor could not start: ${error instanceof Error ? error.message : 'Unknown browser error'}`, 'error');
      opening = false;
    }
  };

  function neutraliseSelfTrigger() {
    document.querySelector('#dashboard-layout-mode-label')?.remove();
  }

  function hideHeavyHistoryControls() {
    ['#dashboard-undo-layout', '#dashboard-redo-layout'].forEach(selector => {
      const control = dashboardElement(selector);
      if (control) control.hidden = true;
    });
  }

  const initialise = () => {
    neutraliseSelfTrigger();
    hideHeavyHistoryControls();
    const actions = dashboardElement('.dashboard-editor-actions');
    if (actions) new MutationObserver(hideHeavyHistoryControls).observe(actions, { childList: true, subtree: true });
  };

  window.GrevDashboardCustomizerStability = { version: 2, open: () => openEditor() };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialise, { once: true });
  else initialise();
})();