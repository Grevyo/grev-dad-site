const GRID_COLUMNS = 6;
const dashboardState = {
  payload: null,
  workingTiles: [],
  search: '',
  category: 'all',
  draggingId: null,
  selectedId: null,
  editing: false
};

const dashboardElement = selector => document.querySelector(selector);

function dashboardMessage(text, type = '') {
  const target = dashboardElement('#dashboard-status');
  if (!target) return;
  target.textContent = text;
  target.className = `dashboard-status${type ? ` ${type}` : ''}`;
}

function editorMessage(text, type = '') {
  const target = dashboardElement('#dashboard-editor-message');
  if (!target) return;
  target.textContent = text;
  target.className = `dashboard-editor-message${type ? ` ${type}` : ''}`;
}

async function dashboardFetch(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? 'Dashboard request failed.');
  return payload;
}

function featureById(id) {
  return dashboardState.payload?.features.find(feature => feature.id === id) ?? null;
}

function workingTile(featureId) {
  return dashboardState.workingTiles.find(tile => tile.featureId === featureId) ?? null;
}

function tileRoute(feature) {
  return feature.route || (feature.featureType === 'workspace' ? `/feature/${feature.slug}` : '');
}

function dimensionKey(width, height) {
  return `${width}x${height}`;
}

function parseDimension(value) {
  const match = String(value ?? '').match(/^(\d+)x(\d+)$/);
  if (!match) return null;
  return { width: Number(match[1]), height: Number(match[2]) };
}

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function placementIsFree(candidate, ignoreFeatureId = null) {
  if (!Number.isInteger(candidate.x) || !Number.isInteger(candidate.y) || candidate.x < 0 || candidate.y < 0 || candidate.width < 1 || candidate.height < 1 || candidate.x + candidate.width > GRID_COLUMNS) return false;
  return !dashboardState.workingTiles.some(tile => tile.featureId !== ignoreFeatureId && overlaps(candidate, tile));
}

function firstFreePlacement(width, height, ignoreFeatureId = null, tiles = dashboardState.workingTiles) {
  for (let y = 0; y < 200; y += 1) {
    for (let x = 0; x <= GRID_COLUMNS - width; x += 1) {
      const candidate = { x, y, width, height };
      if (!tiles.some(tile => tile.featureId !== ignoreFeatureId && overlaps(candidate, tile))) return candidate;
    }
  }
  return { x: 0, y: 0, width, height };
}

function clonePinnedTiles() {
  return (dashboardState.payload?.pinnedTiles ?? []).map(feature => ({
    featureId: feature.id,
    x: Number(feature.x ?? 0),
    y: Number(feature.y ?? 0),
    width: Number(feature.width ?? feature.defaultWidth ?? 2),
    height: Number(feature.height ?? feature.defaultHeight ?? 1)
  }));
}

function dashboardRows(tiles, trailingRows = 1) {
  const occupied = tiles.reduce((maximum, tile) => Math.max(maximum, tile.y + tile.height), 0);
  return Math.max(4, occupied + trailingRows);
}

function preferenceValue(selector, fallback) {
  const value = Number(dashboardElement(selector)?.value);
  return Number.isFinite(value) ? value : fallback;
}

function gridRowHeight(density) {
  return density === 'compact' ? 92 : 116;
}

function editorPreferences() {
  return {
    density: dashboardElement('#dashboard-density')?.value ?? 'comfortable',
    showDescriptions: dashboardElement('#dashboard-show-descriptions')?.checked !== false,
    tileGap: preferenceValue('#dashboard-tile-gap', 12),
    outerMargin: preferenceValue('#dashboard-outer-margin', 0)
  };
}

function currentPreferences() {
  if (dashboardState.editing) return editorPreferences();
  return dashboardState.payload?.preferences ?? { density: 'comfortable', showDescriptions: true, tileGap: 12, outerMargin: 0 };
}

function applyGridSurface(element, preferences, rows) {
  const gap = Number(preferences.tileGap ?? 12);
  const margin = Number(preferences.outerMargin ?? 0);
  const density = preferences.density ?? 'comfortable';
  element.style.setProperty('--dashboard-gap', `${gap}px`);
  element.style.setProperty('--dashboard-margin', `${margin}px`);
  element.style.setProperty('--tile-row-height', `${gridRowHeight(density)}px`);
  element.style.gridTemplateColumns = `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`;
  element.style.gridTemplateRows = `repeat(${rows}, var(--tile-row-height))`;
}

function createTileContent(feature, preferences, editing = false) {
  const content = document.createElement('div');
  content.className = 'dashboard-tile-content';

  const head = document.createElement('div');
  head.className = 'dashboard-tile-head';
  const meta = document.createElement('div');
  meta.className = 'dashboard-tile-title-block';
  const category = document.createElement('span');
  category.className = 'dashboard-tile-meta';
  category.textContent = `${feature.category} · ${feature.width}×${feature.height}`;
  const title = document.createElement('h2');
  title.textContent = feature.name;
  meta.append(category, title);
  const icon = document.createElement('span');
  icon.className = 'dashboard-tile-icon';
  icon.textContent = feature.iconText;
  head.append(meta, icon);

  const body = document.createElement('div');
  body.className = 'dashboard-tile-body';
  if (preferences.showDescriptions) {
    const description = document.createElement('p');
    description.textContent = feature.description;
    body.append(description);
  }

  const footer = document.createElement('div');
  footer.className = 'dashboard-tile-footer';
  const access = document.createElement('span');
  access.className = 'dashboard-access-label';
  access.textContent = feature.accessGroups.length ? feature.accessGroups.join(' · ') : feature.audience === 'all' ? 'All members' : feature.audience;
  footer.append(access);

  const route = tileRoute(feature);
  if (route) {
    if (editing) {
      const previewAction = document.createElement('span');
      previewAction.className = 'dashboard-feature-action dashboard-feature-action-preview';
      previewAction.textContent = 'Open';
      footer.append(previewAction);
    } else {
      const link = document.createElement('a');
      link.className = 'dashboard-feature-action';
      link.href = route;
      link.textContent = 'Open';
      footer.append(link);
    }
  }

  content.append(head, body, footer);
  return content;
}

function createDashboardTile(feature, preferences, editing = false) {
  const article = document.createElement('article');
  article.className = `dashboard-tile${editing ? ' editing' : ''}${dashboardState.selectedId === feature.id ? ' selected' : ''}`;
  article.dataset.featureId = feature.id;
  article.dataset.width = String(feature.width);
  article.dataset.height = String(feature.height);
  article.style.gridColumn = `${Number(feature.x) + 1} / span ${feature.width}`;
  article.style.gridRow = `${Number(feature.y) + 1} / span ${feature.height}`;

  if (editing) {
    article.tabIndex = 0;
    article.setAttribute('aria-label', `${feature.name}, ${feature.width} by ${feature.height} tile`);
    article.addEventListener('click', event => {
      if (event.target.closest('.dashboard-tile-move')) return;
      selectTile(feature.id);
    });
    article.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectTile(feature.id);
      }
    });

    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'dashboard-tile-move';
    handle.textContent = 'MOVE';
    handle.title = `Drag ${feature.name}`;
    handle.draggable = true;
    handle.addEventListener('click', event => {
      event.stopPropagation();
      selectTile(feature.id);
    });
    handle.addEventListener('dragstart', event => {
      dashboardState.draggingId = feature.id;
      dashboardState.selectedId = feature.id;
      article.classList.add('dragging');
      event.dataTransfer?.setData('text/plain', feature.id);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
      renderSelectedControls();
    });
    handle.addEventListener('dragend', () => {
      dashboardState.draggingId = null;
      article.classList.remove('dragging');
    });
    article.append(handle);
  }

  article.append(createTileContent(feature, preferences, editing));
  return article;
}

function addGridCells(grid, rows) {
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < GRID_COLUMNS; x += 1) {
      const cell = document.createElement('span');
      cell.className = 'dashboard-grid-cell';
      cell.style.gridColumn = String(x + 1);
      cell.style.gridRow = String(y + 1);
      grid.append(cell);
    }
  }
}

function renderDashboardGrid() {
  const grid = dashboardElement('#dashboard-grid');
  const empty = dashboardElement('#dashboard-empty');
  if (!grid || !dashboardState.payload) return;

  const preferences = currentPreferences();
  const tiles = dashboardState.editing
    ? dashboardState.workingTiles.map(tile => {
        const feature = featureById(tile.featureId);
        return feature ? { ...feature, ...tile, id: feature.id, dimension: dimensionKey(tile.width, tile.height) } : null;
      }).filter(Boolean)
    : dashboardState.payload.pinnedTiles;

  const rows = dashboardRows(tiles, dashboardState.editing ? 3 : 1);
  grid.className = `dashboard-tile-grid dashboard-grid ${preferences.density}${dashboardState.editing ? ' editing-grid' : ''}`;
  grid.replaceChildren();
  applyGridSurface(grid, preferences, rows);
  if (dashboardState.editing) addGridCells(grid, rows);
  tiles.forEach(feature => grid.append(createDashboardTile(feature, preferences, dashboardState.editing)));

  empty.hidden = tiles.length > 0 || dashboardState.editing;
  const summary = dashboardElement('#dashboard-grid-summary');
  if (summary) summary.textContent = `${GRID_COLUMNS} columns × ${rows} visible rows`;

  if (dashboardState.editing) {
    dashboardMessage(`Editing live preview · ${tiles.length} tile${tiles.length === 1 ? '' : 's'} · changes not yet saved`, 'success');
  } else {
    dashboardMessage(`${tiles.length} pinned feature${tiles.length === 1 ? '' : 's'} · ${dashboardState.payload.features.length} available · ${GRID_COLUMNS}-column grid`, 'success');
  }
}

function selectTile(featureId) {
  if (!dashboardState.editing || !workingTile(featureId)) return;
  dashboardState.selectedId = featureId;
  renderSelectedControls();
  renderDashboardGrid();
}

function renderSelectedControls() {
  const controls = dashboardElement('#dashboard-selected-controls');
  const tile = workingTile(dashboardState.selectedId);
  const feature = tile ? featureById(tile.featureId) : null;
  if (!controls || !tile || !feature) {
    if (controls) controls.hidden = true;
    return;
  }

  controls.hidden = false;
  dashboardElement('#dashboard-selected-name').textContent = `${feature.name} · C${tile.x + 1} R${tile.y + 1}`;
  const size = dashboardElement('#dashboard-selected-dimension');
  size.replaceChildren();
  feature.allowedDimensions.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value.replace('x', ' × ');
    option.selected = dimensionKey(tile.width, tile.height) === value;
    size.append(option);
  });
}

function addWorkingTile(feature) {
  if (workingTile(feature.id)) {
    selectTile(feature.id);
    return;
  }
  const dimension = parseDimension(feature.defaultDimension) ?? { width: 2, height: 1 };
  const placement = firstFreePlacement(dimension.width, dimension.height);
  dashboardState.workingTiles.push({ featureId: feature.id, ...placement });
  dashboardState.selectedId = feature.id;
  editorMessage(`${feature.name} placed at column ${placement.x + 1}, row ${placement.y + 1}.`, 'success');
  renderEditor();
}

function removeWorkingTile(featureId) {
  const feature = featureById(featureId);
  dashboardState.workingTiles = dashboardState.workingTiles.filter(tile => tile.featureId !== featureId);
  dashboardState.selectedId = dashboardState.workingTiles[0]?.featureId ?? null;
  editorMessage(`${feature?.name ?? 'Tile'} removed from the working layout.`, 'success');
  renderEditor();
}

function moveWorkingTile(featureId, deltaX, deltaY) {
  const tile = workingTile(featureId);
  if (!tile) return;
  const candidate = { ...tile, x: tile.x + deltaX, y: tile.y + deltaY };
  if (!placementIsFree(candidate, featureId)) {
    editorMessage('That position is occupied or outside the six-column grid.', 'error');
    return;
  }
  Object.assign(tile, candidate);
  editorMessage(`Moved to column ${tile.x + 1}, row ${tile.y + 1}.`, 'success');
  renderSelectedControls();
  renderDashboardGrid();
}

function resizeWorkingTile(featureId, dimensionValue) {
  const tile = workingTile(featureId);
  const feature = featureById(featureId);
  const dimension = parseDimension(dimensionValue);
  if (!tile || !feature || !dimension || !feature.allowedDimensions.includes(dimensionValue)) return;
  const candidate = { ...tile, ...dimension };
  if (placementIsFree(candidate, featureId)) {
    Object.assign(tile, candidate);
    editorMessage(`${feature.name} resized to ${dimension.width}×${dimension.height}.`, 'success');
  } else {
    const placement = firstFreePlacement(dimension.width, dimension.height, featureId);
    Object.assign(tile, placement);
    editorMessage(`${feature.name} resized and moved to the first empty ${dimension.width}×${dimension.height} area.`, 'success');
  }
  renderSelectedControls();
  renderDashboardGrid();
}

function packWorkingTiles() {
  const ordered = [...dashboardState.workingTiles].sort((a, b) => a.y - b.y || a.x - b.x);
  const packed = [];
  ordered.forEach(tile => {
    const location = firstFreePlacement(tile.width, tile.height, tile.featureId, packed);
    packed.push({ ...tile, ...location });
  });
  dashboardState.workingTiles = packed;
  editorMessage('Tiles packed from the top-left. Save the dashboard to keep this arrangement.', 'success');
  renderEditor();
}

function loadDefaultWorkingTiles() {
  const defaults = (dashboardState.payload?.features ?? [])
    .filter(feature => feature.isDefault)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const tiles = [];
  defaults.forEach(feature => {
    const dimension = parseDimension(feature.defaultDimension) ?? { width: 2, height: 1 };
    const placement = firstFreePlacement(dimension.width, dimension.height, null, tiles);
    tiles.push({ featureId: feature.id, ...placement });
  });
  dashboardState.workingTiles = tiles;
  dashboardState.selectedId = tiles[0]?.featureId ?? null;
  dashboardElement('#dashboard-density').value = 'comfortable';
  dashboardElement('#dashboard-tile-gap').value = '12';
  dashboardElement('#dashboard-outer-margin').value = '0';
  dashboardElement('#dashboard-show-descriptions').checked = true;
  editorMessage('Default tiles loaded into the live preview. Press Save dashboard to store them.', 'success');
  renderEditor();
}

function dropCoordinates(event, tile) {
  const grid = dashboardElement('#dashboard-grid');
  if (!grid) return null;
  const rect = grid.getBoundingClientRect();
  const preferences = editorPreferences();
  const gap = Number(preferences.tileGap ?? 12);
  const margin = Number(preferences.outerMargin ?? 0);
  const rowHeight = gridRowHeight(preferences.density);
  const innerWidth = Math.max(1, rect.width - margin * 2);
  const cellWidth = (innerWidth - gap * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
  const localX = event.clientX - rect.left - margin;
  const localY = event.clientY - rect.top - margin;
  const x = Math.max(0, Math.min(GRID_COLUMNS - tile.width, Math.floor(localX / (cellWidth + gap))));
  const y = Math.max(0, Math.floor(localY / (rowHeight + gap)));
  return { x, y };
}

function renderCatalogueTools() {
  const categorySelect = dashboardElement('#dashboard-category-filter');
  if (!categorySelect || !dashboardState.payload) return;
  const current = dashboardState.category;
  const categories = [...new Set(dashboardState.payload.features.map(feature => feature.category))].sort();
  categorySelect.replaceChildren();
  const all = document.createElement('option');
  all.value = 'all';
  all.textContent = 'All categories';
  categorySelect.append(all);
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categorySelect.append(option);
  });
  categorySelect.value = categories.includes(current) ? current : 'all';
}

function renderCatalogue() {
  const catalogue = dashboardElement('#dashboard-catalogue');
  if (!catalogue || !dashboardState.payload) return;
  catalogue.replaceChildren();
  const search = dashboardState.search.toLowerCase();
  const features = dashboardState.payload.features.filter(feature => {
    const categoryMatch = dashboardState.category === 'all' || feature.category === dashboardState.category;
    const searchMatch = !search || `${feature.name} ${feature.description} ${feature.category}`.toLowerCase().includes(search);
    return categoryMatch && searchMatch;
  });

  features.forEach(feature => {
    const pinned = Boolean(workingTile(feature.id));
    const card = document.createElement('article');
    card.className = `dashboard-catalogue-card${pinned ? ' pinned' : ''}`;
    const marker = document.createElement('span');
    marker.className = 'dashboard-tile-meta';
    marker.textContent = `${feature.category} · default ${feature.defaultDimension.replace('x', '×')}`;
    const title = document.createElement('h4');
    title.textContent = feature.name;
    const description = document.createElement('p');
    description.textContent = feature.description;
    const sizes = document.createElement('small');
    sizes.className = 'dashboard-catalogue-sizes';
    sizes.textContent = `Sizes: ${feature.allowedDimensions.map(value => value.replace('x', '×')).join(', ')}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = pinned ? 'Select tile' : 'Place tile';
    button.addEventListener('click', () => pinned ? selectTile(feature.id) : addWorkingTile(feature));
    card.append(marker, title, description, sizes, button);
    catalogue.append(card);
  });

  if (!features.length) {
    const empty = document.createElement('p');
    empty.className = 'dashboard-catalogue-empty';
    empty.textContent = 'No available features match this filter.';
    catalogue.append(empty);
  }
}

function renderEditor() {
  renderDashboardGrid();
  renderSelectedControls();
  renderCatalogueTools();
  renderCatalogue();
}

function openEditor() {
  if (!dashboardState.payload || dashboardState.editing) return;
  dashboardState.editing = true;
  dashboardState.workingTiles = clonePinnedTiles();
  dashboardState.selectedId = dashboardState.workingTiles[0]?.featureId ?? null;
  dashboardState.search = '';
  dashboardState.category = 'all';

  dashboardElement('#dashboard-density').value = dashboardState.payload.preferences.density;
  dashboardElement('#dashboard-tile-gap').value = String(dashboardState.payload.preferences.tileGap);
  dashboardElement('#dashboard-outer-margin').value = String(dashboardState.payload.preferences.outerMargin);
  dashboardElement('#dashboard-show-descriptions').checked = dashboardState.payload.preferences.showDescriptions;
  dashboardElement('#dashboard-feature-search').value = '';

  dashboardElement('#dashboard-editor-toolbar').hidden = false;
  dashboardElement('#dashboard-editor-catalogue-panel').hidden = false;
  dashboardElement('#dashboard-grid-heading').hidden = false;
  dashboardElement('#customize-dashboard').hidden = true;
  dashboardElement('#dashboard-shell').classList.add('dashboard-editing');
  editorMessage('Select a tile, drag its MOVE strip, or change its preset size. The dashboard updates immediately.');
  renderEditor();
  dashboardElement('#dashboard-editor-toolbar').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeEditor(saved = false) {
  dashboardState.editing = false;
  dashboardState.workingTiles = [];
  dashboardState.selectedId = null;
  dashboardElement('#dashboard-editor-toolbar').hidden = true;
  dashboardElement('#dashboard-editor-catalogue-panel').hidden = true;
  dashboardElement('#dashboard-grid-heading').hidden = true;
  dashboardElement('#customize-dashboard').hidden = false;
  dashboardElement('#dashboard-shell').classList.remove('dashboard-editing');
  renderDashboardGrid();
  if (saved) dashboardMessage('Dashboard layout saved.', 'success');
}

async function saveDashboardLayout() {
  const preferences = editorPreferences();
  editorMessage('Saving dashboard…');
  try {
    dashboardState.payload = await dashboardFetch('/api/dashboard/layout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tiles: dashboardState.workingTiles, preferences })
    });
    closeEditor(true);
  } catch (error) {
    editorMessage(error.message, 'error');
  }
}

async function loadDashboardSystem() {
  if (!dashboardElement('#dashboard-grid')) return;
  try {
    const onboardingResponse = await fetch('/api/onboarding', { cache: 'no-store' });
    const onboarding = await onboardingResponse.json();
    if (!onboardingResponse.ok) throw new Error(onboarding.message ?? 'Unable to check account setup.');
    if (!onboarding.progress?.relationshipComplete || !onboarding.progress?.intentionsComplete) {
      dashboardMessage('Complete the account setup questions to unlock your dashboard features.');
      return;
    }
    dashboardState.payload = await dashboardFetch('/api/dashboard');
    renderDashboardGrid();
  } catch (error) {
    dashboardMessage(error.message, 'error');
  }
}

const dashboardGrid = dashboardElement('#dashboard-grid');
dashboardGrid?.addEventListener('dragover', event => {
  if (!dashboardState.editing) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
});
dashboardGrid?.addEventListener('drop', event => {
  if (!dashboardState.editing) return;
  event.preventDefault();
  const featureId = dashboardState.draggingId ?? event.dataTransfer?.getData('text/plain');
  const tile = workingTile(featureId);
  if (!tile) return;
  const location = dropCoordinates(event, tile);
  if (!location) return;
  const candidate = { ...tile, ...location };
  if (!placementIsFree(candidate, featureId)) {
    editorMessage('That grid area is already occupied. Drop the tile onto empty cells.', 'error');
    return;
  }
  Object.assign(tile, candidate);
  dashboardState.selectedId = featureId;
  editorMessage(`Moved to column ${tile.x + 1}, row ${tile.y + 1}. Blank cells were left in place.`, 'success');
  renderEditor();
});


dashboardElement('#customize-dashboard')?.addEventListener('click', openEditor);
dashboardElement('#dashboard-cancel-layout')?.addEventListener('click', () => closeEditor(false));
dashboardElement('#dashboard-save-layout')?.addEventListener('click', saveDashboardLayout);
dashboardElement('#dashboard-reset-layout')?.addEventListener('click', loadDefaultWorkingTiles);
dashboardElement('#dashboard-pack-layout')?.addEventListener('click', packWorkingTiles);
dashboardElement('#dashboard-remove-selected')?.addEventListener('click', () => {
  if (dashboardState.selectedId) removeWorkingTile(dashboardState.selectedId);
});
dashboardElement('#dashboard-selected-dimension')?.addEventListener('change', event => {
  if (dashboardState.selectedId) resizeWorkingTile(dashboardState.selectedId, event.currentTarget.value);
});
document.querySelectorAll('[data-move-x][data-move-y]').forEach(button => {
  button.addEventListener('click', () => {
    if (!dashboardState.selectedId) return;
    moveWorkingTile(dashboardState.selectedId, Number(button.dataset.moveX), Number(button.dataset.moveY));
  });
});
dashboardElement('#dashboard-feature-search')?.addEventListener('input', event => {
  dashboardState.search = event.currentTarget.value;
  renderCatalogue();
});
dashboardElement('#dashboard-category-filter')?.addEventListener('change', event => {
  dashboardState.category = event.currentTarget.value;
  renderCatalogue();
});
['#dashboard-density', '#dashboard-tile-gap', '#dashboard-outer-margin', '#dashboard-show-descriptions'].forEach(selector => {
  dashboardElement(selector)?.addEventListener('change', () => {
    if (dashboardState.editing) renderDashboardGrid();
  });
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && dashboardState.editing) closeEditor(false);
});

loadDashboardSystem();
