const GRID_COLUMNS = 6;
const dashboardState = {
  payload: null,
  workingTiles: [],
  search: '',
  category: 'all',
  draggingId: null
};

const dashboardElement = selector => document.querySelector(selector);

function dashboardMessage(text, type = '') {
  const target = dashboardElement('#dashboard-status');
  if (!target) return;
  target.textContent = text;
  target.className = `dashboard-status${type ? ` ${type}` : ''}`;
}

function customizerMessage(text, type = '') {
  const target = dashboardElement('#dashboard-customizer-message');
  if (!target) return;
  target.textContent = text;
  target.className = `dashboard-customizer-message${type ? ` ${type}` : ''}`;
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

function gridRowHeight(density, editor = false) {
  if (editor) return density === 'compact' ? 76 : 94;
  return density === 'compact' ? 92 : 116;
}

function applyGridSurface(element, preferences, rows, editor = false) {
  const gap = Number(preferences.tileGap ?? 12);
  const margin = editor ? 0 : Number(preferences.outerMargin ?? 0);
  const density = preferences.density ?? 'comfortable';
  element.style.setProperty('--dashboard-gap', `${gap}px`);
  element.style.setProperty('--dashboard-margin', `${margin}px`);
  element.style.setProperty('--tile-row-height', `${gridRowHeight(density, editor)}px`);
  element.style.gridTemplateColumns = `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`;
  element.style.gridTemplateRows = `repeat(${rows}, var(--tile-row-height))`;
}

function createDashboardTile(feature, preferences) {
  const article = document.createElement('article');
  article.className = 'dashboard-tile';
  article.dataset.width = String(feature.width);
  article.dataset.height = String(feature.height);
  article.style.gridColumn = `${Number(feature.x) + 1} / span ${feature.width}`;
  article.style.gridRow = `${Number(feature.y) + 1} / span ${feature.height}`;

  const head = document.createElement('div');
  head.className = 'dashboard-tile-head';
  const meta = document.createElement('div');
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
  article.append(head);

  if (preferences.showDescriptions && (feature.width > 1 || feature.height > 1)) {
    const description = document.createElement('p');
    description.textContent = feature.description;
    article.append(description);
  }

  const footer = document.createElement('div');
  footer.className = 'dashboard-tile-footer';
  const access = document.createElement('span');
  access.className = 'dashboard-access-label';
  access.textContent = feature.accessGroups.length ? feature.accessGroups.join(' · ') : feature.audience === 'all' ? 'All members' : feature.audience;
  footer.append(access);

  const route = tileRoute(feature);
  if (route) {
    const link = document.createElement('a');
    link.className = 'dashboard-feature-action';
    link.href = route;
    link.textContent = 'Open';
    footer.append(link);
  }
  article.append(footer);
  return article;
}

function renderDashboard() {
  const grid = dashboardElement('#dashboard-grid');
  const empty = dashboardElement('#dashboard-empty');
  if (!grid || !dashboardState.payload) return;
  const { pinnedTiles, preferences } = dashboardState.payload;
  grid.className = `dashboard-tile-grid dashboard-grid ${preferences.density}`;
  grid.replaceChildren();
  applyGridSurface(grid, preferences, dashboardRows(pinnedTiles), false);
  pinnedTiles.forEach(feature => grid.append(createDashboardTile(feature, preferences)));
  empty.hidden = pinnedTiles.length > 0;
  dashboardMessage(`${pinnedTiles.length} pinned feature${pinnedTiles.length === 1 ? '' : 's'} · ${dashboardState.payload.features.length} available · ${GRID_COLUMNS}-column grid`, 'success');
}

function addWorkingTile(feature) {
  if (workingTile(feature.id)) return;
  const dimension = parseDimension(feature.defaultDimension) ?? { width: 2, height: 1 };
  const placement = firstFreePlacement(dimension.width, dimension.height);
  dashboardState.workingTiles.push({ featureId: feature.id, ...placement });
  customizerMessage(`${feature.name} placed at column ${placement.x + 1}, row ${placement.y + 1}.`, 'success');
  renderCustomizer();
}

function removeWorkingTile(featureId) {
  dashboardState.workingTiles = dashboardState.workingTiles.filter(tile => tile.featureId !== featureId);
  renderCustomizer();
}

function moveWorkingTile(featureId, deltaX, deltaY) {
  const tile = workingTile(featureId);
  if (!tile) return;
  const candidate = { ...tile, x: tile.x + deltaX, y: tile.y + deltaY };
  if (!placementIsFree(candidate, featureId)) {
    customizerMessage('That position is occupied or outside the six-column grid.', 'error');
    return;
  }
  Object.assign(tile, candidate);
  customizerMessage(`Moved to column ${tile.x + 1}, row ${tile.y + 1}.`, 'success');
  renderLayoutCanvas();
}

function resizeWorkingTile(featureId, dimensionValue) {
  const tile = workingTile(featureId);
  const feature = featureById(featureId);
  const dimension = parseDimension(dimensionValue);
  if (!tile || !feature || !dimension || !feature.allowedDimensions.includes(dimensionValue)) return;
  const candidate = { ...tile, ...dimension };
  if (placementIsFree(candidate, featureId)) {
    Object.assign(tile, candidate);
  } else {
    Object.assign(tile, firstFreePlacement(dimension.width, dimension.height, featureId), dimension);
    customizerMessage(`${feature.name} moved to the first empty area that fits ${dimension.width}×${dimension.height}.`, 'success');
  }
  renderLayoutCanvas();
}

function packWorkingTiles() {
  const ordered = [...dashboardState.workingTiles].sort((a, b) => a.y - b.y || a.x - b.x);
  const packed = [];
  ordered.forEach(tile => {
    const location = firstFreePlacement(tile.width, tile.height, tile.featureId, packed);
    packed.push({ ...tile, ...location });
  });
  dashboardState.workingTiles = packed;
  customizerMessage('Tiles packed from the top-left. Save the dashboard to keep this arrangement.', 'success');
  renderLayoutCanvas();
}

function editorPreferences() {
  return {
    density: dashboardElement('#dashboard-density')?.value ?? 'comfortable',
    showDescriptions: dashboardElement('#dashboard-show-descriptions')?.checked !== false,
    tileGap: preferenceValue('#dashboard-tile-gap', 12),
    outerMargin: preferenceValue('#dashboard-outer-margin', 0)
  };
}

function dropCoordinates(event, tile) {
  const canvas = dashboardElement('#dashboard-layout-canvas');
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const gap = preferenceValue('#dashboard-tile-gap', 12);
  const rowHeight = gridRowHeight(dashboardElement('#dashboard-density')?.value ?? 'comfortable', true);
  const cellWidth = (rect.width - gap * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
  const x = Math.max(0, Math.min(GRID_COLUMNS - tile.width, Math.floor((event.clientX - rect.left) / (cellWidth + gap))));
  const y = Math.max(0, Math.floor((event.clientY - rect.top) / (rowHeight + gap)));
  return { x, y };
}

function createEditorTile(tile) {
  const feature = featureById(tile.featureId);
  if (!feature) return null;
  const article = document.createElement('article');
  article.className = 'dashboard-editor-tile';
  article.dataset.featureId = feature.id;
  article.dataset.width = String(tile.width);
  article.dataset.height = String(tile.height);
  article.style.gridColumn = `${tile.x + 1} / span ${tile.width}`;
  article.style.gridRow = `${tile.y + 1} / span ${tile.height}`;

  const heading = document.createElement('div');
  heading.className = 'dashboard-editor-tile-heading';
  const identity = document.createElement('div');
  const meta = document.createElement('small');
  meta.textContent = `${tile.width}×${tile.height} · C${tile.x + 1} R${tile.y + 1}`;
  const name = document.createElement('strong');
  name.textContent = feature.name;
  identity.append(meta, name);
  const handle = document.createElement('button');
  handle.type = 'button';
  handle.className = 'dashboard-editor-move';
  handle.textContent = 'MOVE';
  handle.title = `Drag ${feature.name}`;
  handle.draggable = true;
  handle.addEventListener('dragstart', event => {
    dashboardState.draggingId = feature.id;
    article.classList.add('dragging');
    event.dataTransfer?.setData('text/plain', feature.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  });
  handle.addEventListener('dragend', () => {
    dashboardState.draggingId = null;
    article.classList.remove('dragging');
  });
  heading.append(identity, handle);

  const controls = document.createElement('div');
  controls.className = 'dashboard-editor-controls';
  const size = document.createElement('select');
  size.setAttribute('aria-label', `${feature.name} grid size`);
  feature.allowedDimensions.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value.replace('x', ' × ');
    option.selected = dimensionKey(tile.width, tile.height) === value;
    size.append(option);
  });
  size.addEventListener('change', () => resizeWorkingTile(feature.id, size.value));

  const arrows = document.createElement('div');
  arrows.className = 'dashboard-editor-arrows';
  [['←', -1, 0, 'Move left'], ['↑', 0, -1, 'Move up'], ['↓', 0, 1, 'Move down'], ['→', 1, 0, 'Move right']].forEach(([text, dx, dy, title]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.title = title;
    button.addEventListener('click', () => moveWorkingTile(feature.id, dx, dy));
    arrows.append(button);
  });
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'dashboard-editor-remove';
  remove.textContent = 'Remove';
  remove.addEventListener('click', () => removeWorkingTile(feature.id));
  controls.append(size, arrows, remove);
  article.append(heading, controls);
  return article;
}

function renderLayoutCanvas() {
  const canvas = dashboardElement('#dashboard-layout-canvas');
  if (!canvas) return;
  canvas.replaceChildren();
  const preferences = editorPreferences();
  const rows = dashboardRows(dashboardState.workingTiles, 4);
  canvas.className = `dashboard-layout-canvas ${preferences.density}`;
  applyGridSurface(canvas, preferences, rows, true);
  canvas.dataset.rows = String(rows);
  dashboardState.workingTiles.forEach(tile => {
    const element = createEditorTile(tile);
    if (element) canvas.append(element);
  });
  const summary = dashboardElement('#dashboard-grid-summary');
  if (summary) summary.textContent = `${GRID_COLUMNS} columns × ${rows} visible rows`;
  canvas.classList.toggle('empty', dashboardState.workingTiles.length === 0);
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
    button.textContent = pinned ? 'Remove tile' : 'Place tile';
    button.addEventListener('click', () => pinned ? removeWorkingTile(feature.id) : addWorkingTile(feature));
    card.append(marker, title, description, sizes, button);
    catalogue.append(card);
  });

  if (!features.length) {
    const empty = document.createElement('p');
    empty.className = 'dashboard-customizer-intro';
    empty.textContent = 'No available features match this filter.';
    catalogue.append(empty);
  }
}

function renderCustomizer() {
  renderLayoutCanvas();
  renderCatalogueTools();
  renderCatalogue();
}

function openCustomizer() {
  if (!dashboardState.payload) return;
  dashboardState.workingTiles = clonePinnedTiles();
  dashboardState.search = '';
  dashboardState.category = 'all';
  const search = dashboardElement('#dashboard-feature-search');
  if (search) search.value = '';
  dashboardElement('#dashboard-density').value = dashboardState.payload.preferences.density;
  dashboardElement('#dashboard-tile-gap').value = String(dashboardState.payload.preferences.tileGap);
  dashboardElement('#dashboard-outer-margin').value = String(dashboardState.payload.preferences.outerMargin);
  dashboardElement('#dashboard-show-descriptions').checked = dashboardState.payload.preferences.showDescriptions;
  const panel = dashboardElement('#dashboard-customizer');
  panel.hidden = false;
  document.body.classList.add('modal-open');
  customizerMessage('Drag tiles around the grid. Empty cells are preserved when saved.');
  renderCustomizer();
}

function closeCustomizer() {
  dashboardElement('#dashboard-customizer').hidden = true;
  document.body.classList.remove('modal-open');
}

async function saveDashboardLayout() {
  const preferences = editorPreferences();
  customizerMessage('Saving dashboard…');
  try {
    dashboardState.payload = await dashboardFetch('/api/dashboard/layout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tiles: dashboardState.workingTiles, preferences })
    });
    closeCustomizer();
    renderDashboard();
  } catch (error) {
    customizerMessage(error.message, 'error');
  }
}

async function resetDashboardLayout() {
  customizerMessage('Restoring default dashboard…');
  try {
    dashboardState.payload = await dashboardFetch('/api/dashboard/reset', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
    });
    dashboardState.workingTiles = clonePinnedTiles();
    dashboardElement('#dashboard-density').value = dashboardState.payload.preferences.density;
    dashboardElement('#dashboard-tile-gap').value = String(dashboardState.payload.preferences.tileGap);
    dashboardElement('#dashboard-outer-margin').value = String(dashboardState.payload.preferences.outerMargin);
    dashboardElement('#dashboard-show-descriptions').checked = dashboardState.payload.preferences.showDescriptions;
    renderCustomizer();
    renderDashboard();
    customizerMessage('Default dashboard restored.', 'success');
  } catch (error) {
    customizerMessage(error.message, 'error');
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
    renderDashboard();
  } catch (error) {
    dashboardMessage(error.message, 'error');
  }
}

const layoutCanvas = dashboardElement('#dashboard-layout-canvas');
layoutCanvas?.addEventListener('dragover', event => {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
});
layoutCanvas?.addEventListener('drop', event => {
  event.preventDefault();
  const featureId = dashboardState.draggingId ?? event.dataTransfer?.getData('text/plain');
  const tile = workingTile(featureId);
  if (!tile) return;
  const location = dropCoordinates(event, tile);
  if (!location) return;
  const candidate = { ...tile, ...location };
  if (!placementIsFree(candidate, featureId)) {
    customizerMessage('That grid area is already occupied. Drop the tile onto empty cells.', 'error');
    return;
  }
  Object.assign(tile, candidate);
  customizerMessage(`Moved to column ${tile.x + 1}, row ${tile.y + 1}. Blank cells were left in place.`, 'success');
  renderLayoutCanvas();
});

dashboardElement('#customize-dashboard')?.addEventListener('click', openCustomizer);
dashboardElement('#dashboard-customizer-close')?.addEventListener('click', closeCustomizer);
dashboardElement('#dashboard-save-layout')?.addEventListener('click', saveDashboardLayout);
dashboardElement('#dashboard-reset-layout')?.addEventListener('click', resetDashboardLayout);
dashboardElement('#dashboard-pack-layout')?.addEventListener('click', packWorkingTiles);
dashboardElement('#dashboard-feature-search')?.addEventListener('input', event => {
  dashboardState.search = event.currentTarget.value;
  renderCatalogue();
});
dashboardElement('#dashboard-category-filter')?.addEventListener('change', event => {
  dashboardState.category = event.currentTarget.value;
  renderCatalogue();
});
['#dashboard-density', '#dashboard-tile-gap'].forEach(selector => {
  dashboardElement(selector)?.addEventListener('change', renderLayoutCanvas);
});
dashboardElement('#dashboard-customizer')?.addEventListener('click', event => {
  if (event.target.id === 'dashboard-customizer') closeCustomizer();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !dashboardElement('#dashboard-customizer')?.hidden) closeCustomizer();
});

loadDashboardSystem();