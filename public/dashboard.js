const GRID_COLUMNS = 8;
const MOBILE_GRID_COLUMNS = 2;
const TILE_COLOURS = new Set(['default','graphite','blue','cyan','green','amber','red','purple','pink']);
const TILE_SOLIDS = [
  { name: 'Charcoal', value: '#11161d' }, { name: 'Graphite', value: '#171b22' }, { name: 'Midnight blue', value: '#101a2a' },
  { name: 'Deep cyan', value: '#0e2023' }, { name: 'Forest', value: '#112319' }, { name: 'Amber', value: '#2a2010' },
  { name: 'Crimson', value: '#291417' }, { name: 'Purple', value: '#21172f' }, { name: 'Pink', value: '#2b1624' }
];
const TILE_GRADIENTS = [
  { name: 'Ocean', primary: '#123c69', secondary: '#2b8a9e', angle: 135 },
  { name: 'Sunset', primary: '#9b2c2c', secondary: '#d97706', angle: 135 },
  { name: 'Aurora', primary: '#0f766e', secondary: '#7c3aed', angle: 125 },
  { name: 'Purple haze', primary: '#312e81', secondary: '#a855f7', angle: 145 },
  { name: 'Fire', primary: '#7f1d1d', secondary: '#f97316', angle: 115 },
  { name: 'Neon night', primary: '#0f172a', secondary: '#2563eb', angle: 160 },
  { name: 'Mono steel', primary: '#111827', secondary: '#64748b', angle: 135 },
  { name: 'Grev', primary: '#151a22', secondary: '#5268aa', angle: 135 }
];
const TILE_FONT_STACKS = {
  system: 'Inter,Segoe UI,Arial,sans-serif',
  display: 'Impact,Haettenschweiler,Arial Narrow Bold,sans-serif',
  mono: 'Cascadia Code,Consolas,Monaco,monospace',
  serif: 'Georgia,Times New Roman,serif',
  rounded: 'Trebuchet MS,Arial Rounded MT Bold,Arial,sans-serif'
};
const TILE_CONTENT_MODES = new Set(['standard','media-button']);
const TILE_ICON_MODES = new Set(['text','image']);
const TILE_MEDIA_FITS = new Set(['cover','contain','stretch']);
const TILE_MEDIA_OVERLAYS = new Set(['none','dark','light']);
const DEFAULT_TILE_APPEARANCE = Object.freeze({ backgroundType: 'solid', backgroundPrimary: '#11161d', backgroundSecondary: '#5268aa', backgroundAngle: 135, backgroundMedia: null, textColour: '#f4f7fb', fontFamily: 'system', borderColour: '#394657', contentMode: 'standard', customTitle: null, customIcon: null, mediaFit: 'cover', mediaOverlay: 'dark', iconMode: 'text', iconLabel: null, iconMedia: null, iconTextColour: '#090b0f', iconBackgroundColour: '#394657', iconBorderColour: '#667181', iconMediaFit: 'cover' });
const MAX_TILE_MEDIA_BYTES = 1_400_000;
const dashboardState = {
  payload: null,
  workingTiles: [],
  search: '',
  category: 'all',
  draggingId: null,
  dragOffset: null,
  placementPreview: null,
  resizing: null,
  selectedId: null,
  iconUploads: new Map(),
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

function cancelIconUpload(featureId) {
  if (featureId) dashboardState.iconUploads.delete(featureId);
}

function validHex(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value ?? ''));
}

function normalizedTileAppearance(source = {}) {
  const flatFields = ['backgroundType','backgroundPrimary','backgroundSecondary','backgroundAngle','backgroundMedia','textColour','fontFamily','borderColour','contentMode','customTitle','customIcon','mediaFit','mediaOverlay','iconMode','iconLabel','iconMedia','iconTextColour','iconBackgroundColour','iconBorderColour','iconMediaFit'];
  const hasFlatAppearance = flatFields.some(field => Object.prototype.hasOwnProperty.call(source, field));
  const appearance = hasFlatAppearance ? source : (source.appearance ?? source);
  return {
    backgroundType: ['solid','gradient','media'].includes(appearance.backgroundType) ? appearance.backgroundType : DEFAULT_TILE_APPEARANCE.backgroundType,
    backgroundPrimary: validHex(appearance.backgroundPrimary) ? appearance.backgroundPrimary.toLowerCase() : DEFAULT_TILE_APPEARANCE.backgroundPrimary,
    backgroundSecondary: validHex(appearance.backgroundSecondary) ? appearance.backgroundSecondary.toLowerCase() : DEFAULT_TILE_APPEARANCE.backgroundSecondary,
    backgroundAngle: Number.isInteger(Number(appearance.backgroundAngle)) ? Math.max(0, Math.min(360, Number(appearance.backgroundAngle))) : DEFAULT_TILE_APPEARANCE.backgroundAngle,
    backgroundMedia: typeof appearance.backgroundMedia === 'string' && appearance.backgroundMedia.startsWith('data:image/') ? appearance.backgroundMedia : null,
    textColour: validHex(appearance.textColour) ? appearance.textColour.toLowerCase() : DEFAULT_TILE_APPEARANCE.textColour,
    fontFamily: Object.hasOwn(TILE_FONT_STACKS, appearance.fontFamily) ? appearance.fontFamily : DEFAULT_TILE_APPEARANCE.fontFamily,
    borderColour: validHex(appearance.borderColour) ? appearance.borderColour.toLowerCase() : DEFAULT_TILE_APPEARANCE.borderColour,
    contentMode: TILE_CONTENT_MODES.has(appearance.contentMode) ? appearance.contentMode : DEFAULT_TILE_APPEARANCE.contentMode,
    customTitle: typeof appearance.customTitle === 'string' && appearance.customTitle.trim() ? appearance.customTitle.trim().slice(0, 80) : null,
    customIcon: typeof appearance.customIcon === 'string' && appearance.customIcon.trim() ? appearance.customIcon.trim().slice(0, 12) : null,
    mediaFit: TILE_MEDIA_FITS.has(appearance.mediaFit) ? appearance.mediaFit : DEFAULT_TILE_APPEARANCE.mediaFit,
    mediaOverlay: TILE_MEDIA_OVERLAYS.has(appearance.mediaOverlay) ? appearance.mediaOverlay : DEFAULT_TILE_APPEARANCE.mediaOverlay,
    iconMode: TILE_ICON_MODES.has(appearance.iconMode) ? appearance.iconMode : DEFAULT_TILE_APPEARANCE.iconMode,
    iconLabel: typeof appearance.iconLabel === 'string' && appearance.iconLabel.trim() ? appearance.iconLabel.trim().slice(0, 6) : null,
    iconMedia: typeof appearance.iconMedia === 'string' && appearance.iconMedia.startsWith('data:image/') ? appearance.iconMedia : null,
    iconTextColour: validHex(appearance.iconTextColour) ? appearance.iconTextColour.toLowerCase() : DEFAULT_TILE_APPEARANCE.iconTextColour,
    iconBackgroundColour: validHex(appearance.iconBackgroundColour) ? appearance.iconBackgroundColour.toLowerCase() : DEFAULT_TILE_APPEARANCE.iconBackgroundColour,
    iconBorderColour: validHex(appearance.iconBorderColour) ? appearance.iconBorderColour.toLowerCase() : DEFAULT_TILE_APPEARANCE.iconBorderColour,
    iconMediaFit: TILE_MEDIA_FITS.has(appearance.iconMediaFit) ? appearance.iconMediaFit : DEFAULT_TILE_APPEARANCE.iconMediaFit
  };
}

function applyTileAppearance(article, feature) {
  const appearance = normalizedTileAppearance(feature);
  article.dataset.backgroundType = appearance.backgroundType;
  article.dataset.contentMode = appearance.contentMode;
  article.dataset.mediaFit = appearance.mediaFit;
  article.dataset.mediaOverlay = appearance.mediaOverlay;
  article.dataset.customAppearance = 'true';
  article.style.setProperty('--tile-custom-text', appearance.textColour);
  article.style.setProperty('--tile-custom-border', appearance.borderColour);
  article.style.setProperty('--tile-custom-font', TILE_FONT_STACKS[appearance.fontFamily]);
  article.style.setProperty('--tile-accent', appearance.borderColour);
  article.style.setProperty('--tile-icon-text', appearance.iconTextColour);
  article.style.setProperty('--tile-icon-bg', appearance.iconBackgroundColour);
  article.style.setProperty('--tile-icon-border', appearance.iconBorderColour);
  article.style.setProperty('--tile-icon-fit', appearance.iconMediaFit === 'stretch' ? 'fill' : appearance.iconMediaFit);
  article.style.borderColor = appearance.borderColour;
  article.style.color = appearance.textColour;
  article.style.fontFamily = TILE_FONT_STACKS[appearance.fontFamily];
  article.style.backgroundSize = appearance.mediaFit === 'stretch' ? '100% 100%' : appearance.mediaFit;
  article.style.backgroundPosition = 'center';
  article.style.setProperty('--tile-media-overlay', appearance.mediaOverlay === 'dark' ? 'rgba(0,0,0,.42)' : appearance.mediaOverlay === 'light' ? 'rgba(255,255,255,.24)' : 'transparent');
  article.style.backgroundRepeat = 'no-repeat';
  if (appearance.backgroundType === 'gradient') {
    article.style.backgroundImage = 'linear-gradient(' + appearance.backgroundAngle + 'deg, ' + appearance.backgroundPrimary + ', ' + appearance.backgroundSecondary + ')';
    article.style.backgroundColor = appearance.backgroundPrimary;
  } else if (appearance.backgroundType === 'media' && appearance.backgroundMedia) {
    article.style.backgroundImage = 'url(' + JSON.stringify(appearance.backgroundMedia) + ')';
    article.style.backgroundColor = appearance.backgroundPrimary;
  } else {
    article.style.backgroundImage = 'none';
    article.style.backgroundColor = appearance.backgroundPrimary;
  }
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
    colour: TILE_COLOURS.has(feature.tileColour) ? feature.tileColour : 'default',
    ...normalizedTileAppearance(feature)
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

function activeGridColumns() {
  return isSingleColumnFallback() ? MOBILE_GRID_COLUMNS : GRID_COLUMNS;
}

function responsiveGridSpacing(preferences) {
  const rawGap = Number(preferences.tileGap ?? 12);
  const rawMargin = Number(preferences.outerMargin ?? 0);
  return isSingleColumnFallback()
    ? { gap: Math.min(12, rawGap), margin: Math.min(8, rawMargin) }
    : { gap: rawGap, margin: rawMargin };
}

function squareGridCellSize(element, gap, margin, columns = activeGridColumns()) {
  const measuredWidth = element.getBoundingClientRect().width || element.parentElement?.getBoundingClientRect().width || window.innerWidth;
  const usableWidth = Math.max(1, measuredWidth - margin * 2 - gap * (columns - 1));
  return Math.max(1, usableWidth / columns);
}

function mobileTileDimension(tile) {
  const sourceWidth = Math.max(1, Number(tile.width ?? 1));
  const sourceHeight = Math.max(1, Number(tile.height ?? 1));
  const width = sourceWidth === 1 ? 1 : MOBILE_GRID_COLUMNS;
  const height = Math.max(1, Math.min(4, Math.ceil(width * sourceHeight / sourceWidth)));
  return { width, height };
}

function packMobileTiles(tiles) {
  const packed = [];
  const occupied = [];
  const sorted = [...tiles].sort((a, b) => Number(a.y) - Number(b.y) || Number(a.x) - Number(b.x));
  let cursor = { x: 0, y: 0 };
  for (const tile of sorted) {
    const dimension = mobileTileDimension(tile);
    let location = null;
    for (let y = cursor.y; y < 400 && !location; y += 1) {
      const firstX = y === cursor.y ? cursor.x : 0;
      for (let x = firstX; x <= MOBILE_GRID_COLUMNS - dimension.width; x += 1) {
        const candidate = { x, y, ...dimension };
        if (!occupied.some(existing => overlaps(candidate, existing))) {
          location = candidate;
          break;
        }
      }
    }
    const placement = location ?? { x: 0, y: occupied.reduce((maximum, item) => Math.max(maximum, item.y + item.height), cursor.y), ...dimension };
    occupied.push(placement);
    packed.push({ ...tile, ...placement });
    const nextX = placement.x + placement.width;
    cursor = nextX >= MOBILE_GRID_COLUMNS
      ? { x: 0, y: placement.y + 1 }
      : { x: nextX, y: placement.y };
  }
  return packed;
}

function gridMetrics() {
  const grid = dashboardElement('#dashboard-grid');
  if (!grid) return null;
  const rect = grid.getBoundingClientRect();
  const preferences = editorPreferences();
  const { gap, margin } = responsiveGridSpacing(preferences);
  const columns = activeGridColumns();
  const cellWidth = squareGridCellSize(grid, gap, margin, columns);
  const rowHeight = cellWidth;
  return { grid, rect, gap, margin, columns, rowHeight, cellWidth };
}

function pointerGridCell(event) {
  const metrics = gridMetrics();
  if (!metrics) return null;
  return {
    x: Math.max(0, Math.min(metrics.columns - 1, Math.floor((event.clientX - metrics.rect.left - metrics.margin) / (metrics.cellWidth + metrics.gap)))),
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
  const { gap, margin } = responsiveGridSpacing(preferences);
  const columns = activeGridColumns();
  element.style.setProperty('--dashboard-gap', `${gap}px`);
  element.style.setProperty('--dashboard-margin', `${margin}px`);
  element.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
  element.style.setProperty('--tile-row-height', `${squareGridCellSize(element, gap, margin, columns)}px`);
  element.style.gridTemplateRows = rows > 0 ? `repeat(${rows}, var(--tile-row-height))` : 'none';
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

function standardIconFallback(feature) {
  return feature.id === 'feature-profile' ? viewerInitials(dashboardState.payload?.viewer) : feature.iconText;
}

function createStandardTileIcon(feature, className) {
  const appearance = normalizedTileAppearance(feature);
  const icon = document.createElement('span');
  icon.className = `${className} dashboard-standard-icon`;
  icon.dataset.iconMode = appearance.iconMode;
  icon.setAttribute('aria-hidden', 'true');
  if (appearance.iconMode === 'image' && appearance.iconMedia) {
    const image = document.createElement('img');
    image.src = appearance.iconMedia;
    image.alt = '';
    image.draggable = false;
    icon.append(image);
  } else {
    icon.textContent = appearance.iconLabel ?? standardIconFallback(feature);
  }
  return icon;
}

function createActionTileContent(feature, editing = false) {
  const content = tileSurface(feature, editing, 'dashboard-action-tile');
  const icon = createStandardTileIcon(feature, 'dashboard-action-icon');
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
  const avatar = createStandardTileIcon(feature, 'dashboard-profile-avatar');
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
  const icon = createStandardTileIcon(feature, 'dashboard-content-icon');
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
  const icon = createStandardTileIcon(feature, 'dashboard-content-icon');
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

function createCustomMediaButtonContent(feature, editing = false) {
  const appearance = normalizedTileAppearance(feature);
  const content = tileSurface(feature, editing, 'dashboard-media-button-tile');
  if (appearance.customIcon) {
    const icon = document.createElement('span');
    icon.className = 'dashboard-media-button-icon';
    icon.textContent = appearance.customIcon;
    content.append(icon);
  }
  if (appearance.customTitle) {
    const title = document.createElement('strong');
    title.className = 'dashboard-media-button-title';
    title.textContent = appearance.customTitle;
    content.append(title);
  }
  if (!appearance.backgroundMedia && editing) {
    const placeholder = document.createElement('span');
    placeholder.className = 'dashboard-media-button-placeholder';
    placeholder.textContent = 'UPLOAD A PICTURE OR GIF';
    content.append(placeholder);
  }
  return content;
}

function createTileContent(feature, preferences, editing = false) {
  if (normalizedTileAppearance(feature).contentMode === 'media-button') return createCustomMediaButtonContent(feature, editing);
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
  article.dataset.contentMode = normalizedTileAppearance(feature).contentMode;
  article.style.gridColumn = `${Number(feature.x) + 1} / span ${feature.width}`;
  article.style.gridRow = `${Number(feature.y) + 1} / span ${feature.height}`;
  applyTileAppearance(article, feature);

  if (editing) {
    const strip = document.createElement('div');
    strip.className = 'dashboard-tile-edit-strip';

    let blockTileDrag = false;
    const settings = document.createElement('button');
    settings.type = 'button';
    settings.className = 'dashboard-tile-settings';
    settings.textContent = 'TILE SETTINGS';
    settings.setAttribute('aria-label', `Open settings for ${feature.name}`);
    settings.addEventListener('pointerdown', event => {
      blockTileDrag = true;
      event.stopPropagation();
    });
    settings.addEventListener('pointerup', () => { blockTileDrag = false; });
    settings.addEventListener('pointercancel', () => { blockTileDrag = false; });
    settings.addEventListener('dragstart', event => event.preventDefault());
    settings.addEventListener('click', event => {
      blockTileDrag = false;
      event.stopPropagation();
      openTileSettings(feature.id);
    });
    strip.append(settings);
    article.append(strip);

    article.draggable = !isSingleColumnFallback();
    article.title = isSingleColumnFallback() ? 'Exact tile dragging requires a wider screen' : `Drag ${feature.name} to another grid position`;
    article.addEventListener('dragstart', event => {
      if (isSingleColumnFallback() || blockTileDrag || event.target.closest('button,select,input,a')) {
        blockTileDrag = false;
        event.preventDefault();
        return;
      }
      const tile = workingTile(feature.id);
      const metrics = gridMetrics();
      const rect = article.getBoundingClientRect();
      const localX = Math.max(0, Math.min(Math.max(0, rect.width - 1), Number(event.clientX || rect.left) - rect.left));
      const localY = Math.max(0, Math.min(Math.max(0, rect.height - 1), Number(event.clientY || rect.top) - rect.top));
      dashboardState.dragOffset = tile && metrics ? {
        x: Math.max(0, Math.min(tile.width - 1, Math.floor(localX / (metrics.cellWidth + metrics.gap)))),
        y: Math.max(0, Math.min(tile.height - 1, Math.floor(localY / (metrics.rowHeight + metrics.gap))))
      } : { x: 0, y: 0 };
      if (event.dataTransfer?.setDragImage) event.dataTransfer.setDragImage(article, localX, localY);
      dashboardState.draggingId = feature.id;
      dashboardState.selectedId = feature.id;
      article.classList.add('dragging');
      event.dataTransfer?.setData('text/plain', feature.id);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
      if (tile) showPlacementPreview(tile, true, 'CURRENT POSITION');
      renderSelectedControls();
    });
    article.addEventListener('dragend', () => {
      dashboardState.draggingId = null;
      dashboardState.dragOffset = null;
      article.classList.remove('dragging');
      clearPlacementPreview();
    });

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
  const columns = activeGridColumns();
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
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
  if (isSingleColumnFallback()) tiles = packMobileTiles(tiles);

  const rows = tiles.length || dashboardState.editing ? dashboardRows(tiles, dashboardState.editing ? 2 : 0) : 0;
  grid.className = `dashboard-tile-grid dashboard-grid ${preferences.density}${dashboardState.editing ? ' editing-grid' : ''}${!tiles.length && !dashboardState.editing ? ' empty-grid' : ''}`;
  clearPlacementPreview();
  grid.replaceChildren();
  applyGridSurface(grid, preferences, rows);
  if (dashboardState.editing) addGridCells(grid, rows);
  tiles.forEach(feature => grid.append(createDashboardTile(feature, preferences, dashboardState.editing)));

  empty.hidden = tiles.length > 0 || dashboardState.editing;
  const summary = dashboardElement('#dashboard-grid-summary');
  const columns = activeGridColumns();
  if (summary) summary.textContent = isSingleColumnFallback() ? `${columns}-column mobile grid × ${rows} rows` : `${columns} columns × ${rows} visible rows`;

  if (dashboardState.editing) {
    dashboardMessage(`Editing live preview · ${tiles.length} tile${tiles.length === 1 ? '' : 's'} · changes not yet saved`, 'success');
  } else {
    dashboardMessage(`${tiles.length} pinned feature${tiles.length === 1 ? '' : 's'} · ${dashboardState.payload.features.length} available · ${columns}-column ${isSingleColumnFallback() ? 'mobile ' : ''}grid`, 'success');
  }
}

function selectTile(featureId) {
  if (!dashboardState.editing || !workingTile(featureId)) return;
  dashboardState.selectedId = featureId;
  renderSelectedControls();
  renderDashboardGrid();
}

function openTileSettings(featureId) {
  selectTile(featureId);
  const dialog = dashboardElement('#dashboard-tile-settings-dialog');
  if (!dialog) return;
  if (!dialog.open) dialog.showModal();
}

function closeTileSettings() {
  const dialog = dashboardElement('#dashboard-tile-settings-dialog');
  if (dialog?.open) dialog.close();
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
  renderAppearanceControls(tile);
  document.querySelectorAll('[data-move-x][data-move-y]').forEach(button => {
    const horizontal = Number(button.dataset.moveX) !== 0;
    button.disabled = isSingleColumnFallback() && horizontal;
    button.title = button.disabled ? 'Horizontal placement requires a wider screen' : button.title;
  });
}

function setCustomContentVisibility(mode) {
  const controls = dashboardElement('#dashboard-custom-content-controls');
  const standardIcon = dashboardElement('#dashboard-standard-icon-controls');
  if (controls) controls.hidden = mode !== 'media-button';
  if (standardIcon) standardIcon.hidden = mode !== 'standard';
}

function setStandardIconVisibility(mode) {
  const label = dashboardElement('#dashboard-icon-label-control');
  const media = dashboardElement('#dashboard-icon-media-controls');
  if (label) label.hidden = mode !== 'text';
  if (media) media.hidden = mode !== 'image';
}

function setAppearanceModeVisibility(type) {
  const solid = dashboardElement('#dashboard-solid-controls');
  const gradient = dashboardElement('#dashboard-gradient-controls');
  const media = dashboardElement('#dashboard-media-controls');
  if (solid) solid.hidden = type !== 'solid';
  if (gradient) gradient.hidden = type !== 'gradient';
  if (media) media.hidden = type !== 'media';
}

function appearanceName(tile) {
  const appearance = normalizedTileAppearance(tile);
  if (appearance.backgroundType === 'media') return appearance.backgroundMedia ? 'Picture or animated GIF' : 'Picture or GIF not selected';
  if (appearance.backgroundType === 'gradient') {
    const preset = TILE_GRADIENTS.find(item => item.primary === appearance.backgroundPrimary && item.secondary === appearance.backgroundSecondary && item.angle === appearance.backgroundAngle);
    return 'Gradient · ' + (preset?.name ?? 'Custom');
  }
  const preset = TILE_SOLIDS.find(item => item.value === appearance.backgroundPrimary);
  return 'Solid · ' + (preset?.name ?? appearance.backgroundPrimary.toUpperCase());
}

function paletteButton(label, background, selected, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'dashboard-appearance-choice' + (selected ? ' selected' : '');
  button.setAttribute('aria-pressed', String(selected));
  const swatch = document.createElement('span');
  swatch.className = 'dashboard-appearance-swatch';
  swatch.style.background = background;
  const name = document.createElement('span');
  name.textContent = label;
  button.append(swatch, name);
  button.addEventListener('click', onClick);
  return button;
}

function refreshAppearancePreview(tile, message = '') {
  if (message) editorMessage(message, 'success');
  renderDashboardGrid();
  renderSelectedControls();
}

function renderAppearanceControls(tile) {
  const appearance = normalizedTileAppearance(tile);
  Object.assign(tile, appearance);
  const contentMode = dashboardElement('#dashboard-content-mode');
  const customTitle = dashboardElement('#dashboard-custom-title');
  const customIcon = dashboardElement('#dashboard-custom-icon');
  const mediaFit = dashboardElement('#dashboard-media-fit');
  const mediaOverlay = dashboardElement('#dashboard-media-overlay');
  const iconMode = dashboardElement('#dashboard-icon-mode');
  const iconLabel = dashboardElement('#dashboard-icon-label');
  const iconTextColour = dashboardElement('#dashboard-icon-text-colour');
  const iconBackgroundColour = dashboardElement('#dashboard-icon-background-colour');
  const iconBorderColour = dashboardElement('#dashboard-icon-border-colour');
  const iconMediaFit = dashboardElement('#dashboard-icon-media-fit');
  if (contentMode) contentMode.value = appearance.contentMode;
  if (customTitle) customTitle.value = appearance.customTitle ?? '';
  if (customIcon) customIcon.value = appearance.customIcon ?? '';
  if (mediaFit) mediaFit.value = appearance.mediaFit;
  if (mediaOverlay) mediaOverlay.value = appearance.mediaOverlay;
  if (iconMode) iconMode.value = appearance.iconMode;
  if (iconLabel) {
    iconLabel.value = appearance.iconLabel ?? '';
    const feature = featureById(tile.featureId);
    const fallback = feature ? standardIconFallback(feature) : '';
    iconLabel.placeholder = fallback ? `Use feature default (${fallback})` : 'Use feature default';
  }
  if (iconTextColour) iconTextColour.value = appearance.iconTextColour;
  if (iconBackgroundColour) iconBackgroundColour.value = appearance.iconBackgroundColour;
  if (iconBorderColour) iconBorderColour.value = appearance.iconBorderColour;
  if (iconMediaFit) iconMediaFit.value = appearance.iconMediaFit;
  setCustomContentVisibility(appearance.contentMode);
  setStandardIconVisibility(appearance.iconMode);
  const type = dashboardElement('#dashboard-background-type');
  if (type) type.value = appearance.backgroundType;
  setAppearanceModeVisibility(appearance.backgroundType);
  const primary = dashboardElement('#dashboard-background-primary');
  const gradientPrimary = dashboardElement('#dashboard-gradient-primary');
  const secondary = dashboardElement('#dashboard-background-secondary');
  const angle = dashboardElement('#dashboard-gradient-angle');
  const angleValue = dashboardElement('#dashboard-gradient-angle-value');
  const text = dashboardElement('#dashboard-text-colour');
  const font = dashboardElement('#dashboard-font-family');
  const border = dashboardElement('#dashboard-border-colour');
  if (primary) primary.value = appearance.backgroundPrimary;
  if (gradientPrimary) gradientPrimary.value = appearance.backgroundPrimary;
  if (secondary) secondary.value = appearance.backgroundSecondary;
  if (angle) angle.value = String(appearance.backgroundAngle);
  if (angleValue) angleValue.textContent = String(appearance.backgroundAngle) + '°';
  if (text) text.value = appearance.textColour;
  if (font) font.value = appearance.fontFamily;
  if (border) border.value = appearance.borderColour;
  const appearanceLabel = dashboardElement('#dashboard-appearance-name');
  if (appearanceLabel) appearanceLabel.textContent = appearanceName(tile);
  const mediaStatus = dashboardElement('#dashboard-media-status');
  if (mediaStatus) mediaStatus.textContent = appearance.backgroundMedia ? 'Picture or GIF selected and ready to save.' : 'No picture selected.';
  const removeMedia = dashboardElement('#dashboard-remove-media');
  if (removeMedia) removeMedia.disabled = !appearance.backgroundMedia;
  const iconMediaStatus = dashboardElement('#dashboard-icon-media-status');
  if (iconMediaStatus) iconMediaStatus.textContent = appearance.iconMedia ? 'Icon picture selected and ready to save.' : 'No icon picture selected.';
  const removeIconMedia = dashboardElement('#dashboard-remove-icon-media');
  if (removeIconMedia) removeIconMedia.disabled = !appearance.iconMedia;

  const solidPalette = dashboardElement('#dashboard-solid-palette');
  if (solidPalette) {
    solidPalette.replaceChildren(...TILE_SOLIDS.map(item => paletteButton(item.name, item.value, appearance.backgroundType === 'solid' && appearance.backgroundPrimary === item.value, () => {
      tile.backgroundType = 'solid';
      tile.backgroundPrimary = item.value;
      refreshAppearancePreview(tile, item.name + ' background selected.');
    })));
  }
  const gradientPalette = dashboardElement('#dashboard-gradient-palette');
  if (gradientPalette) {
    gradientPalette.replaceChildren(...TILE_GRADIENTS.map(item => paletteButton(item.name, 'linear-gradient(' + item.angle + 'deg,' + item.primary + ',' + item.secondary + ')', appearance.backgroundType === 'gradient' && appearance.backgroundPrimary === item.primary && appearance.backgroundSecondary === item.secondary && appearance.backgroundAngle === item.angle, () => {
      tile.backgroundType = 'gradient';
      tile.backgroundPrimary = item.primary;
      tile.backgroundSecondary = item.secondary;
      tile.backgroundAngle = item.angle;
      refreshAppearancePreview(tile, item.name + ' gradient selected.');
    })));
  }
}

function addWorkingTile(feature) {
  if (workingTile(feature.id)) {
    selectTile(feature.id);
    return;
  }
  const dimension = parseDimension(feature.defaultDimension) ?? { width: 2, height: 1 };
  const placement = firstFreePlacement(dimension.width, dimension.height);
  dashboardState.workingTiles.push({ featureId: feature.id, ...placement, colour: 'default', ...DEFAULT_TILE_APPEARANCE });
  dashboardState.selectedId = feature.id;
  editorMessage(`${feature.name} placed at column ${placement.x + 1}, row ${placement.y + 1}.`, 'success');
  renderEditor();
}

function removeWorkingTile(featureId) {
  const feature = featureById(featureId);
  cancelIconUpload(featureId);
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
    editorMessage('That position is occupied or outside the eight-column grid.', 'error');
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
    tiles.push({ featureId: feature.id, ...placement, colour: 'default', ...DEFAULT_TILE_APPEARANCE });
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
  const offset = dashboardState.dragOffset ?? { x: 0, y: 0 };
  return {
    x: Math.max(0, Math.min(GRID_COLUMNS - tile.width, cell.x - offset.x)),
    y: Math.max(0, cell.y - offset.y)
  };
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
    button.textContent = pinned ? 'Tile settings' : 'Place tile';
    button.addEventListener('click', () => pinned ? openTileSettings(feature.id) : addWorkingTile(feature));
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
  dashboardState.iconUploads.clear();
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
    ? 'Single-column preview: use Tile settings to resize and change vertical order. Use a wider screen for exact dragging.'
    : 'Grab any tile to move it, use Tile settings for exact controls, or drag its corner to resize.');
  renderEditor();
  dashboardElement('#dashboard-editor-toolbar').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeEditor(saved = false) {
  closeTileSettings();
  clearPlacementPreview();
  dashboardState.draggingId = null;
  dashboardState.dragOffset = null;
  dashboardState.resizing = null;
  dashboardState.iconUploads.clear();
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
  dashboardState.dragOffset = null;
  dashboardState.selectedId = featureId;
  editorMessage(`Moved to column ${tile.x + 1}, row ${tile.y + 1}. Blank cells were left in place.`, 'success');
  renderEditor();
});


dashboardElement('#customize-dashboard')?.addEventListener('click', openEditor);
dashboardElement('#dashboard-cancel-layout')?.addEventListener('click', () => closeEditor(false));
dashboardElement('#dashboard-save-layout')?.addEventListener('click', saveDashboardLayout);
dashboardElement('#dashboard-reset-layout')?.addEventListener('click', loadDefaultWorkingTiles);
dashboardElement('#dashboard-pack-layout')?.addEventListener('click', packWorkingTiles);
dashboardElement('#dashboard-close-tile-settings')?.addEventListener('click', closeTileSettings);
dashboardElement('#dashboard-tile-settings-dialog')?.addEventListener('click', event => {
  if (event.target === event.currentTarget) closeTileSettings();
});
dashboardElement('#dashboard-remove-selected')?.addEventListener('click', () => {
  if (dashboardState.selectedId) {
    removeWorkingTile(dashboardState.selectedId);
    closeTileSettings();
  }
});
dashboardElement('#dashboard-selected-dimension')?.addEventListener('change', event => {
  if (dashboardState.selectedId) resizeWorkingTile(dashboardState.selectedId, event.currentTarget.value);
});
dashboardElement('#dashboard-icon-mode')?.addEventListener('change', event => {
  const tile = workingTile(dashboardState.selectedId);
  const value = String(event.currentTarget.value);
  if (!tile || !TILE_ICON_MODES.has(value)) return;
  tile.iconMode = value;
  if (value === 'text') {
    cancelIconUpload(tile.featureId);
    tile.iconMedia = null;
    const input = dashboardElement('#dashboard-icon-media');
    if (input) input.value = '';
  }
  refreshAppearancePreview(tile, value === 'image' ? 'Picture icon selected. Upload a picture before saving.' : 'Letter icon selected. Any inactive icon picture was removed.');
});
dashboardElement('#dashboard-icon-label')?.addEventListener('input', event => {
  const tile = workingTile(dashboardState.selectedId);
  if (!tile) return;
  const value = String(event.currentTarget.value).slice(0, 6);
  tile.iconLabel = value.trim() || null;
  renderDashboardGrid();
});
dashboardElement('#dashboard-icon-media-fit')?.addEventListener('change', event => {
  const tile = workingTile(dashboardState.selectedId);
  const value = String(event.currentTarget.value);
  if (!tile || !TILE_MEDIA_FITS.has(value)) return;
  tile.iconMediaFit = value;
  refreshAppearancePreview(tile);
});
dashboardElement('#dashboard-content-mode')?.addEventListener('change', event => {
  const tile = workingTile(dashboardState.selectedId);
  const value = String(event.currentTarget.value);
  if (!tile || !TILE_CONTENT_MODES.has(value)) return;
  tile.contentMode = value;
  if (value === 'media-button') {
    cancelIconUpload(tile.featureId);
    tile.iconMode = 'text';
    tile.iconMedia = null;
    const iconInput = dashboardElement('#dashboard-icon-media');
    if (iconInput) iconInput.value = '';
    tile.backgroundType = 'media';
  } else if (tile.backgroundType === 'media' && !tile.backgroundMedia) {
    tile.backgroundType = 'solid';
  }
  refreshAppearancePreview(tile, value === 'media-button' ? 'Custom media button selected. Upload a picture or GIF before saving.' : 'Standard tile content restored.');
});
[['#dashboard-custom-title','customTitle',80],['#dashboard-custom-icon','customIcon',12]].forEach(([selector, field, maximum]) => {
  dashboardElement(selector)?.addEventListener('input', event => {
    const tile = workingTile(dashboardState.selectedId);
    if (!tile) return;
    const value = String(event.currentTarget.value).slice(0, Number(maximum));
    tile[field] = value || null;
    renderDashboardGrid();
  });
});
[['#dashboard-media-fit','mediaFit',TILE_MEDIA_FITS],['#dashboard-media-overlay','mediaOverlay',TILE_MEDIA_OVERLAYS]].forEach(([selector, field, allowed]) => {
  dashboardElement(selector)?.addEventListener('change', event => {
    const tile = workingTile(dashboardState.selectedId);
    const value = String(event.currentTarget.value);
    if (!tile || !allowed.has(value)) return;
    tile[field] = value;
    refreshAppearancePreview(tile);
  });
});
dashboardElement('#dashboard-background-type')?.addEventListener('change', event => {
  const tile = workingTile(dashboardState.selectedId);
  const value = String(event.currentTarget.value);
  if (!tile || !['solid','gradient','media'].includes(value)) return;
  tile.backgroundType = value;
  refreshAppearancePreview(tile, (event.currentTarget.selectedOptions[0]?.textContent ?? value) + ' selected.');
});
[['#dashboard-background-primary','backgroundPrimary'],['#dashboard-gradient-primary','backgroundPrimary'],['#dashboard-background-secondary','backgroundSecondary'],['#dashboard-text-colour','textColour'],['#dashboard-border-colour','borderColour'],['#dashboard-icon-text-colour','iconTextColour'],['#dashboard-icon-background-colour','iconBackgroundColour'],['#dashboard-icon-border-colour','iconBorderColour']].forEach(([selector, field]) => {
  dashboardElement(selector)?.addEventListener('input', event => {
    const tile = workingTile(dashboardState.selectedId);
    const value = String(event.currentTarget.value).toLowerCase();
    if (!tile || !validHex(value)) return;
    tile[field] = value;
    if (field === 'backgroundPrimary' && selector === '#dashboard-background-primary') tile.backgroundType = 'solid';
    if ((field === 'backgroundPrimary' && selector === '#dashboard-gradient-primary') || field === 'backgroundSecondary') tile.backgroundType = 'gradient';
    refreshAppearancePreview(tile);
  });
});
dashboardElement('#dashboard-gradient-angle')?.addEventListener('input', event => {
  const tile = workingTile(dashboardState.selectedId);
  if (!tile) return;
  tile.backgroundType = 'gradient';
  tile.backgroundAngle = Math.max(0, Math.min(360, Number(event.currentTarget.value)));
  refreshAppearancePreview(tile);
});
dashboardElement('#dashboard-font-family')?.addEventListener('change', event => {
  const tile = workingTile(dashboardState.selectedId);
  const value = String(event.currentTarget.value);
  if (!tile || !Object.hasOwn(TILE_FONT_STACKS, value)) return;
  tile.fontFamily = value;
  refreshAppearancePreview(tile, (event.currentTarget.selectedOptions[0]?.textContent ?? value) + ' font selected.');
});
dashboardElement('#dashboard-icon-media')?.addEventListener('change', event => {
  const tile = workingTile(dashboardState.selectedId);
  const file = event.currentTarget.files?.[0];
  if (!tile || !file) return;
  const allowed = new Set(['image/png','image/jpeg','image/webp','image/gif']);
  if (!allowed.has(file.type)) {
    event.currentTarget.value = '';
    editorMessage('Choose a PNG, JPEG, WebP or animated GIF for the icon.', 'error');
    return;
  }
  if (file.size > MAX_TILE_MEDIA_BYTES) {
    event.currentTarget.value = '';
    editorMessage('Icon pictures and GIFs must be 1.4 MB or smaller.', 'error');
    return;
  }
  const featureId = tile.featureId;
  const uploadToken = Symbol(file.name);
  dashboardState.iconUploads.set(featureId, uploadToken);
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    const currentTile = workingTile(featureId);
    if (typeof reader.result !== 'string'
      || !currentTile
      || dashboardState.iconUploads.get(featureId) !== uploadToken
      || currentTile.contentMode !== 'standard'
      || currentTile.iconMode !== 'image') return;
    dashboardState.iconUploads.delete(featureId);
    currentTile.iconMedia = reader.result;
    refreshAppearancePreview(currentTile, file.name + ' selected as the standard tile icon.');
  });
  reader.addEventListener('error', () => {
    if (dashboardState.iconUploads.get(featureId) === uploadToken) dashboardState.iconUploads.delete(featureId);
    editorMessage('The icon picture or GIF could not be read.', 'error');
  });
  reader.readAsDataURL(file);
});
dashboardElement('#dashboard-remove-icon-media')?.addEventListener('click', () => {
  const tile = workingTile(dashboardState.selectedId);
  if (!tile) return;
  cancelIconUpload(tile.featureId);
  tile.iconMedia = null;
  tile.iconMode = 'text';
  const input = dashboardElement('#dashboard-icon-media');
  if (input) input.value = '';
  refreshAppearancePreview(tile, 'Icon picture removed. The letter icon is active again.');
});
dashboardElement('#dashboard-reset-icon')?.addEventListener('click', () => {
  const tile = workingTile(dashboardState.selectedId);
  if (!tile) return;
  cancelIconUpload(tile.featureId);
  Object.assign(tile, {
    iconMode: DEFAULT_TILE_APPEARANCE.iconMode,
    iconLabel: DEFAULT_TILE_APPEARANCE.iconLabel,
    iconMedia: DEFAULT_TILE_APPEARANCE.iconMedia,
    iconTextColour: DEFAULT_TILE_APPEARANCE.iconTextColour,
    iconBackgroundColour: DEFAULT_TILE_APPEARANCE.iconBackgroundColour,
    iconBorderColour: DEFAULT_TILE_APPEARANCE.iconBorderColour,
    iconMediaFit: DEFAULT_TILE_APPEARANCE.iconMediaFit
  });
  const input = dashboardElement('#dashboard-icon-media');
  if (input) input.value = '';
  refreshAppearancePreview(tile, 'Standard tile icon reset.');
});
dashboardElement('#dashboard-background-media')?.addEventListener('change', event => {
  const tile = workingTile(dashboardState.selectedId);
  const file = event.currentTarget.files?.[0];
  if (!tile || !file) return;
  const allowed = new Set(['image/png','image/jpeg','image/webp','image/gif']);
  if (!allowed.has(file.type)) {
    event.currentTarget.value = '';
    editorMessage('Choose a PNG, JPEG, WebP or animated GIF.', 'error');
    return;
  }
  if (file.size > MAX_TILE_MEDIA_BYTES) {
    event.currentTarget.value = '';
    editorMessage('Tile pictures and GIFs must be 1.4 MB or smaller.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    if (typeof reader.result !== 'string') return;
    tile.backgroundType = 'media';
    tile.backgroundMedia = reader.result;
    refreshAppearancePreview(tile, file.name + ' selected as the tile background.');
  });
  reader.addEventListener('error', () => editorMessage('The picture or GIF could not be read.', 'error'));
  reader.readAsDataURL(file);
});
dashboardElement('#dashboard-remove-media')?.addEventListener('click', () => {
  const tile = workingTile(dashboardState.selectedId);
  if (!tile) return;
  tile.backgroundMedia = null;
  tile.backgroundType = 'solid';
  const input = dashboardElement('#dashboard-background-media');
  if (input) input.value = '';
  refreshAppearancePreview(tile, 'Tile picture removed.');
});
dashboardElement('#dashboard-reset-appearance')?.addEventListener('click', () => {
  const tile = workingTile(dashboardState.selectedId);
  if (!tile) return;
  Object.assign(tile, DEFAULT_TILE_APPEARANCE);
  const input = dashboardElement('#dashboard-background-media');
  const iconInput = dashboardElement('#dashboard-icon-media');
  if (input) input.value = '';
  if (iconInput) iconInput.value = '';
  refreshAppearancePreview(tile, 'Tile appearance reset.');
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
  if (event.key !== 'Escape' || !dashboardState.editing) return;
  if (dashboardElement('#dashboard-tile-settings-dialog')?.open) return;
  closeEditor(false);
});
window.addEventListener('resize', () => {
  if (!dashboardState.payload) return;
  if (!dashboardState.editing) {
    renderDashboardGrid();
    return;
  }
  renderEditor();
  editorMessage(isSingleColumnFallback()
    ? 'Single-column preview: the visual order follows saved row and column coordinates. Exact horizontal placement requires a wider screen.'
    : 'Wide-grid editing restored. Drag tiles or move them one cell at a time.');
});

loadDashboardSystem();
