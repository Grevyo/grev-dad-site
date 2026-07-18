const GRID_COLUMNS = 6;
const TILE_COLOURS = new Set(['default','graphite','blue','cyan','green','amber','red','purple','pink']);
const dashboardState = {
  payload: null,
  workingTiles: [],
  search: '',
  category: 'all',
  draggingId: null,
  placementPreview: null,
  resizing: null,
  selectedId: null,
  editing: false
};

const dashboardElement = selector => document.querySelector(selector);

function isSingleColumnFallback() {
  return window.matchMedia?.('(max-width: 900px)').matches ?? false;
}

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
    height: Number(feature.height ?? feature.defaultHeight ?? 1),
    colour: TILE_COLOURS.has(feature.tileColour) ? feature.tileColour : 'default'
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

function gridMetrics() {
  const grid = dashboardElement('#dashboard-grid');
  if (!grid) return null;
  const rect = grid.getBoundingClientRect();
  const preferences = editorPreferences();
  const gap = Number(preferences.tileGap ?? 12);
  const margin = Number(preferences.outerMargin ?? 0);
  const rowHeight = gridRowHeight(preferences.density);
  const innerWidth = Math.max(1, rect.width - margin * 2);
  const cellWidth = Math.max(1, (innerWidth - gap * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
  return { grid, rect, gap, margin, rowHeight, cellWidth };
}

function pointerGridCell(event) {
  const metrics = gridMetrics();
  if (!metrics) return null;
  return {
    x: Math.max(0, Math.min(GRID_COLUMNS - 1, Math.floor((event.clientX - metrics.rect.left - metrics.margin) / (metrics.cellWidth + metrics.gap)))),
    y: Math.max(0, Math.floor((event.clientY - metrics.rect.top - metrics.margin) / (metrics.rowHeight + metrics.gap)))
  };
}

function clearPlacementPreview() {
  dashboardElement('.dashboard-placement-preview')?.remove();
  dashboardState.placementPreview = null;
}

function showPlacementPreview(candidate, valid, label) {
  const grid = dashboardElement('#dashboard-grid');
  if (!grid || !candidate) return;
  let preview = dashboardElement('.dashboard-placement-preview');
  if (!preview) {
    preview = document.createElement('div');
    preview.setAttribute('aria-hidden', 'true');
    grid.append(preview);
  }
  preview.className = `dashboard-placement-preview ${valid ? 'valid' : 'invalid'}`;
  preview.style.gridColumn = `${candidate.x + 1} / span ${candidate.width}`;
  preview.style.gridRow = `${candidate.y + 1} / span ${candidate.height}`;
  preview.dataset.label = label;
  dashboardState.placementPreview = { ...candidate, valid, label };
}

function nearestAllowedDimension(feature, tile, desiredWidth, desiredHeight) {
  const allowed = feature.allowedDimensions
    .map(value => ({ value, ...parseDimension(value) }))
    .filter(size => size.width && size.height && size.width <= GRID_COLUMNS - tile.x);
  allowed.sort((a, b) => {
    const aDistance = Math.abs(a.width - desiredWidth) + Math.abs(a.height - desiredHeight);
    const bDistance = Math.abs(b.width - desiredWidth) + Math.abs(b.height - desiredHeight);
    return aDistance - bDistance || Math.abs(a.width * a.height - desiredWidth * desiredHeight) - Math.abs(b.width * b.height - desiredWidth * desiredHeight);
  });
  return allowed[0] ?? null;
}

function tileElement(featureId) {
  return [...document.querySelectorAll('.dashboard-tile')].find(tile => tile.dataset.featureId === featureId) ?? null;
}

function updateResizePreview(event) {
  const resize = dashboardState.resizing;
  if (!resize || event.pointerId !== resize.pointerId) return;
  const tile = workingTile(resize.featureId);
  const feature = featureById(resize.featureId);
  const cell = pointerGridCell(event);
  if (!tile || !feature || !cell) return;

  const desiredWidth = Math.max(1, Math.min(GRID_COLUMNS - tile.x, cell.x - tile.x + 1));
  const desiredHeight = Math.max(1, cell.y - tile.y + 1);
  const dimension = nearestAllowedDimension(feature, tile, desiredWidth, desiredHeight);
  if (!dimension) return;

  const candidate = { ...tile, width: dimension.width, height: dimension.height };
  const valid = placementIsFree(candidate, resize.featureId);
  resize.currentCandidate = candidate;
  resize.valid = valid;
  if (valid) resize.lastValidCandidate = candidate;
  showPlacementPreview(candidate, valid, valid ? `RESIZE ${dimension.width}×${dimension.height}` : 'SIZE BLOCKED');

  const article = tileElement(resize.featureId);
  if (article) {
    article.classList.toggle('resize-blocked', !valid);
    if (valid) {
      article.style.gridColumn = `${candidate.x + 1} / span ${candidate.width}`;
      article.style.gridRow = `${candidate.y + 1} / span ${candidate.height}`;
      article.dataset.width = String(candidate.width);
      article.dataset.height = String(candidate.height);
    }
  }
  const size = dashboardElement('#dashboard-selected-dimension');
  if (valid && size && [...size.options].some(option => option.value === dimension.value)) size.value = dimension.value;
}

function finishTileResize(event) {
  const resize = dashboardState.resizing;
  if (!resize || (event.pointerId !== undefined && event.pointerId !== resize.pointerId)) return;
  const tile = workingTile(resize.featureId);
  const feature = featureById(resize.featureId);
  dashboardState.resizing = null;
  clearPlacementPreview();
  if (tile && resize.lastValidCandidate) {
    Object.assign(tile, resize.lastValidCandidate);
    editorMessage(`${feature?.name ?? 'Tile'} resized to ${tile.width}×${tile.height}.`, 'success');
  }
  renderEditor();
}

function beginTileResize(event, featureId) {
  if (isSingleColumnFallback()) return;
  const tile = workingTile(featureId);
  if (!tile) return;
  event.preventDefault();
  event.stopPropagation();
  dashboardState.selectedId = featureId;
  dashboardState.resizing = {
    featureId,
    pointerId: event.pointerId,
    currentCandidate: { ...tile },
    lastValidCandidate: { ...tile },
    valid: true
  };
  tileElement(featureId)?.classList.add('resizing');
  showPlacementPreview(tile, true, `RESIZE ${tile.width}×${tile.height}`);
  renderSelectedControls();

  const move = pointerEvent => updateResizePreview(pointerEvent);
  const removeListeners = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', cancel);
  };
  const end = pointerEvent => {
    removeListeners();
    finishTileResize(pointerEvent);
  };
  const cancel = pointerEvent => {
    if (!dashboardState.resizing || pointerEvent.pointerId !== dashboardState.resizing.pointerId) return;
    removeListeners();
    dashboardState.resizing = null;
    clearPlacementPreview();
    renderEditor();
    editorMessage('Resize cancelled. The tile returned to its previous size.');
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', cancel);
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

function tileSurface(feature, editing, className) {
  const route = tileRoute(feature);
  const element = document.createElement(!editing && route ? 'a' : 'div');
  element.className = `dashboard-tile-content ${className}`;
  if (!editing && route) {
    element.href = route;
    element.setAttribute('aria-label', `Open ${feature.name}`);
  }
  return element;
}

function createActionTileContent(feature, editing = false) {
  const content = tileSurface(feature, editing, 'dashboard-action-tile');
  const icon = document.createElement('span');
  icon.className = 'dashboard-action-icon';
  icon.textContent = feature.iconText;
  const title = document.createElement('strong');
  title.className = 'dashboard-action-title';
  title.textContent = feature.name;
  const arrow = document.createElement('span');
  arrow.className = 'dashboard-action-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '→';
  content.append(icon, title, arrow);
  return content;
}

function viewerInitials(viewer) {
  return String(viewer?.displayName ?? viewer?.username ?? 'GD')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase() || 'GD';
}

function createProfileTileContent(feature, editing = false) {
  const content = tileSurface(feature, editing, 'dashboard-content-tile dashboard-profile-tile');
  const viewer = dashboardState.payload?.viewer ?? {};
  const label = document.createElement('span');
  label.className = 'dashboard-content-label';
  label.textContent = 'YOUR PROFILE';
  const card = document.createElement('div');
  card.className = 'dashboard-profile-card';
  const avatar = document.createElement('span');
  avatar.className = 'dashboard-profile-avatar';
  avatar.textContent = viewerInitials(viewer);
  const identity = document.createElement('div');
  identity.className = 'dashboard-profile-identity';
  const name = document.createElement('strong');
  name.textContent = viewer.displayName ?? feature.name;
  const username = document.createElement('span');
  username.textContent = viewer.username ? `@${viewer.username}` : 'Profile';
  identity.append(name, username);
  const role = document.createElement('span');
  role.className = 'dashboard-profile-role';
  role.textContent = viewer.isOwner ? 'Owner' : viewer.isAdmin ? 'Administrator' : 'Member';
  card.append(avatar, identity, role);
  const action = document.createElement('span');
  action.className = 'dashboard-content-action';
  action.textContent = editing ? 'PROFILE CARD PREVIEW' : 'View profile →';
  content.append(label, card, action);
  return content;
}

function createNewsTileContent(feature, editing = false) {
  const content = tileSurface(feature, editing, 'dashboard-content-tile dashboard-news-tile');
  const heading = document.createElement('div');
  heading.className = 'dashboard-content-heading';
  const label = document.createElement('span');
  label.className = 'dashboard-content-label';
  label.textContent = 'LATEST GREV NEWS';
  const icon = document.createElement('span');
  icon.className = 'dashboard-content-icon';
  icon.textContent = feature.iconText;
  heading.append(label, icon);
  const headline = document.createElement('strong');
  headline.className = 'dashboard-news-headline';
  headline.textContent = 'No Grev News has been published yet.';
  const action = document.createElement('span');
  action.className = 'dashboard-content-action';
  action.textContent = editing ? 'NEWS FEED PREVIEW' : 'Open Grev News →';
  content.append(heading, headline, action);
  return content;
}

function createGenericContentTile(feature, preferences, editing = false) {
  const content = tileSurface(feature, editing, 'dashboard-content-tile dashboard-generic-content-tile');
  const heading = document.createElement('div');
  heading.className = 'dashboard-content-heading';
  const label = document.createElement('span');
  label.className = 'dashboard-content-label';
  label.textContent = feature.category;
  const icon = document.createElement('span');
  icon.className = 'dashboard-content-icon';
  icon.textContent = feature.iconText;
  heading.append(label, icon);
  const title = document.createElement('strong');
  title.className = 'dashboard-content-title';
  title.textContent = feature.name;
  content.append(heading, title);
  if (preferences.showDescriptions && feature.description) {
    const description = document.createElement('p');
    description.className = 'dashboard-content-description';
    description.textContent = feature.description;
    content.append(description);
  }
  const action = document.createElement('span');
  action.className = 'dashboard-content-action';
  action.textContent = editing ? 'INFORMATION TILE PREVIEW' : 'Open →';
  content.append(action);
  return content;
}

function createTileContent(feature, preferences, editing = false) {
  if (feature.presentation !== 'content') return createActionTileContent(feature, editing);
  if (feature.id === 'feature-profile') return createProfileTileContent(feature, editing);
  if (feature.id === 'feature-grev-news') return createNewsTileContent(feature, editing);
  return createGenericContentTile(feature, preferences, editing);
}

function createDashboardTile(feature, preferences, editing = false) {
  const article = document.createElement('article');
  article.className = `dashboard-tile${editing ? ' editing' : ''}${dashboardState.selectedId === feature.id ? ' selected' : ''}`;
  article.dataset.featureId = feature.id;
  article.dataset.width = String(feature.width);
  article.dataset.height = String(feature.height);
  article.dataset.colour = TILE_COLOURS.has(feature.colour ?? feature.tileColour) ? (feature.colour ?? feature.tileColour) : 'default';
  article.dataset.presentation = feature.presentation === 'content' ? 'content' : 'action';
  article.style.gridColumn = `${Number(feature.x) + 1} / span ${feature.width}`;
  article.style.gridRow = `${Number(feature.y) + 1} / span ${feature.height}`;

  if (editing) {
    const strip = document.createElement('div');
    strip.className = 'dashboard-tile-edit-strip';

    const select = document.createElement('button');
    select.type = 'button';
    select.className = 'dashboard-tile-select';
    select.textContent = 'SELECT';
    select.setAttribute('aria-label', `Select ${feature.name} tile for editing`);
    select.setAttribute('aria-pressed', String(dashboardState.selectedId === feature.id));
    select.addEventListener('click', () => selectTile(feature.id));

    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'dashboard-tile-move';
    handle.textContent = isSingleColumnFallback() ? 'MOVE ON DESKTOP' : 'DRAG TO MOVE';
    handle.title = isSingleColumnFallback() ? 'Open this editor on a wider screen to drag tiles' : `Drag ${feature.name} to another grid position`;
    handle.disabled = isSingleColumnFallback();
    handle.draggable = !isSingleColumnFallback();
    handle.addEventListener('click', () => selectTile(feature.id));
    handle.addEventListener('dragstart', event => {
      if (isSingleColumnFallback()) {
        event.preventDefault();
        return;
      }
      const tile = workingTile(feature.id);
      dashboardState.draggingId = feature.id;
      dashboardState.selectedId = feature.id;
      article.classList.add('dragging');
      event.dataTransfer?.setData('text/plain', feature.id);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
      if (tile) showPlacementPreview(tile, true, 'CURRENT POSITION');
      renderSelectedControls();
    });
    handle.addEventListener('dragend', () => {
      dashboardState.draggingId = null;
      article.classList.remove('dragging');
      clearPlacementPreview();
    });
    strip.append(select, handle);
    article.append(strip);

    const resize = document.createElement('button');
    resize.type = 'button';
    resize.className = 'dashboard-tile-resize';
    resize.textContent = '↘';
    resize.setAttribute('aria-label', `Drag to resize ${feature.name}`);
    resize.title = isSingleColumnFallback() ? 'Use the Size menu on narrow screens' : `Drag the corner to resize ${feature.name}`;
    resize.disabled = isSingleColumnFallback();
    resize.addEventListener('pointerdown', event => beginTileResize(event, feature.id));
    article.append(resize);
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
  let tiles = dashboardState.editing
    ? dashboardState.workingTiles.map(tile => {
        const feature = featureById(tile.featureId);
        return feature ? { ...feature, ...tile, id: feature.id, dimension: dimensionKey(tile.width, tile.height) } : null;
      }).filter(Boolean)
    : dashboardState.payload.pinnedTiles;
  if (dashboardState.editing && isSingleColumnFallback()) {
    tiles = [...tiles].sort((a, b) => a.y - b.y || a.x - b.x);
  }

  const rows = dashboardRows(tiles, dashboardState.editing ? 3 : 1);
  grid.className = `dashboard-tile-grid dashboard-grid ${preferences.density}${dashboardState.editing ? ' editing-grid' : ''}`;
  clearPlacementPreview();
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
  const colour = dashboardElement('#dashboard-selected-colour');
  if (colour) colour.value = TILE_COLOURS.has(tile.colour) ? tile.colour : 'default';
  document.querySelectorAll('[data-move-x][data-move-y]').forEach(button => {
    const horizontal = Number(button.dataset.moveX) !== 0;
    button.disabled = isSingleColumnFallback() && horizontal;
    button.title = button.disabled ? 'Horizontal placement requires a wider screen' : button.title;
  });
}

function addWorkingTile(feature) {
  if (workingTile(feature.id)) {
    selectTile(feature.id);
    return;
  }
  const dimension = parseDimension(feature.defaultDimension) ?? { width: 2, height: 1 };
  const placement = firstFreePlacement(dimension.width, dimension.height);
  dashboardState.workingTiles.push({ featureId: feature.id, ...placement, colour: 'default' });
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
  if (isSingleColumnFallback() && deltaX !== 0) {
    editorMessage('Horizontal tile placement is available on screens wider than 900px. Vertical order still follows the saved row coordinates.', 'error');
    return;
  }
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
    tiles.push({ featureId: feature.id, ...placement, colour: 'default' });
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
  const cell = pointerGridCell(event);
  if (!cell) return null;
  return { x: Math.max(0, Math.min(GRID_COLUMNS - tile.width, cell.x)), y: cell.y };
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
  editorMessage(isSingleColumnFallback()
    ? 'Single-column preview: select tiles, resize them, and change vertical order. Use a wider screen for exact column placement and dragging.'
    : 'Select a tile, drag its MOVE strip, or change its preset size. The dashboard updates immediately.');
  renderEditor();
  dashboardElement('#dashboard-editor-toolbar').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeEditor(saved = false) {
  clearPlacementPreview();
  dashboardState.draggingId = null;
  dashboardState.resizing = null;
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
  if (!dashboardState.editing || isSingleColumnFallback()) return;
  event.preventDefault();
  const featureId = dashboardState.draggingId ?? event.dataTransfer?.getData('text/plain');
  const tile = workingTile(featureId);
  if (!tile) return;
  const location = dropCoordinates(event, tile);
  if (!location) return;
  const candidate = { ...tile, ...location };
  const valid = placementIsFree(candidate, featureId);
  showPlacementPreview(candidate, valid, valid ? 'DROP HERE' : 'POSITION BLOCKED');
  if (event.dataTransfer) event.dataTransfer.dropEffect = valid ? 'move' : 'none';
});
dashboardGrid?.addEventListener('dragleave', event => {
  if (!dashboardState.draggingId) return;
  const rect = dashboardGrid.getBoundingClientRect();
  if (event.clientX <= rect.left || event.clientX >= rect.right || event.clientY <= rect.top || event.clientY >= rect.bottom) clearPlacementPreview();
});
dashboardGrid?.addEventListener('drop', event => {
  if (!dashboardState.editing || isSingleColumnFallback()) return;
  event.preventDefault();
  const featureId = dashboardState.draggingId ?? event.dataTransfer?.getData('text/plain');
  const tile = workingTile(featureId);
  if (!tile) return;
  const location = dropCoordinates(event, tile);
  if (!location) return;
  const candidate = { ...tile, ...location };
  const valid = placementIsFree(candidate, featureId);
  clearPlacementPreview();
  if (!valid) {
    editorMessage('That grid area is already occupied. The tile was not moved.', 'error');
    return;
  }
  Object.assign(tile, candidate);
  dashboardState.draggingId = null;
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
dashboardElement('#dashboard-selected-colour')?.addEventListener('change', event => {
  const tile = workingTile(dashboardState.selectedId);
  const colour = String(event.currentTarget.value);
  if (!tile || !TILE_COLOURS.has(colour)) return;
  tile.colour = colour;
  editorMessage(`${featureById(tile.featureId)?.name ?? 'Tile'} colour changed to ${event.currentTarget.selectedOptions[0]?.textContent ?? colour}.`, 'success');
  renderDashboardGrid();
  renderSelectedControls();
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
window.addEventListener('resize', () => {
  if (!dashboardState.editing) return;
  renderEditor();
  editorMessage(isSingleColumnFallback()
    ? 'Single-column preview: the visual order follows saved row and column coordinates. Exact horizontal placement requires a wider screen.'
    : 'Wide-grid editing restored. Drag tiles or move them one cell at a time.');
});

loadDashboardSystem();
