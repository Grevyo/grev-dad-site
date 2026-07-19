import fs from 'node:fs';

function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (source.indexOf(before, index + before.length) >= 0) throw new Error(`Non-unique patch anchor: ${label}`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}

function patch(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (before === after) throw new Error(`No changes produced for ${path}`);
  fs.writeFileSync(path, after);
}

patch('src/dashboard.ts', source => {
  source = replaceOnce(source,
`type DashboardDensity = 'comfortable' | 'compact';
type TileColour = 'default' | 'graphite' | 'blue' | 'cyan' | 'green' | 'amber' | 'red' | 'purple' | 'pink';
type TilePresentation = 'action' | 'content';
type Dimension = { width: number; height: number };
type TilePlacement = Dimension & { featureId: string; x: number; y: number; colour?: TileColour };`,
`type DashboardDensity = 'comfortable' | 'compact';
type TileColour = 'default' | 'graphite' | 'blue' | 'cyan' | 'green' | 'amber' | 'red' | 'purple' | 'pink';
type TilePresentation = 'action' | 'content';
type TileBackgroundType = 'solid' | 'gradient' | 'media';
type TileFontFamily = 'system' | 'display' | 'mono' | 'serif' | 'rounded';
type Dimension = { width: number; height: number };
type TileAppearance = {
  backgroundType: TileBackgroundType;
  backgroundPrimary: string;
  backgroundSecondary: string;
  backgroundAngle: number;
  backgroundMedia: string | null;
  textColour: string;
  fontFamily: TileFontFamily;
  borderColour: string;
};
type TilePlacement = Dimension & TileAppearance & { featureId: string; x: number; y: number; colour?: TileColour };`,
    'dashboard appearance types');

  source = replaceOnce(source,
`  tile_colour: string | null;
  matched_groups: string;`,
`  tile_colour: string | null;
  background_type: string | null;
  background_primary: string | null;
  background_secondary: string | null;
  background_angle: number | null;
  background_media: string | null;
  text_colour: string | null;
  font_family: string | null;
  border_colour: string | null;
  matched_groups: string;`,
    'feature row appearance columns');

  source = replaceOnce(source,
`const VALID_TILE_COLOURS = new Set<TileColour>(['default','graphite','blue','cyan','green','amber','red','purple','pink']);`,
`const VALID_TILE_COLOURS = new Set<TileColour>(['default','graphite','blue','cyan','green','amber','red','purple','pink']);
const VALID_BACKGROUND_TYPES = new Set<TileBackgroundType>(['solid','gradient','media']);
const VALID_FONT_FAMILIES = new Set<TileFontFamily>(['system','display','mono','serif','rounded']);
const HEX_COLOUR = /^#[0-9a-f]{6}$/i;
const IMAGE_DATA_URL = /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/]+={0,2}$/i;
const MAX_TILE_MEDIA_BYTES = 2 * 1024 * 1024;
const DEFAULT_TILE_APPEARANCE: TileAppearance = {
  backgroundType: 'solid',
  backgroundPrimary: '#11161d',
  backgroundSecondary: '#5268aa',
  backgroundAngle: 135,
  backgroundMedia: null,
  textColour: '#f4f7fb',
  fontFamily: 'system',
  borderColour: '#394657'
};`,
    'appearance validation constants');

  source = replaceOnce(source,
`function legacySizeForDimension(width: number, height: number): LegacyDashboardSize {`,
`function dataUrlByteLength(value: string): number {
  const encoded = value.slice(value.indexOf(',') + 1);
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  return Math.floor(encoded.length * 3 / 4) - padding;
}

function tileAppearanceFromInput(item: Record<string, unknown>): TileAppearance | null {
  const backgroundType = String(item.backgroundType ?? DEFAULT_TILE_APPEARANCE.backgroundType) as TileBackgroundType;
  const backgroundPrimary = String(item.backgroundPrimary ?? DEFAULT_TILE_APPEARANCE.backgroundPrimary).toLowerCase();
  const backgroundSecondary = String(item.backgroundSecondary ?? DEFAULT_TILE_APPEARANCE.backgroundSecondary).toLowerCase();
  const backgroundAngle = Number(item.backgroundAngle ?? DEFAULT_TILE_APPEARANCE.backgroundAngle);
  const backgroundMediaValue = item.backgroundMedia === null || item.backgroundMedia === undefined || item.backgroundMedia === '' ? null : String(item.backgroundMedia);
  const textColour = String(item.textColour ?? DEFAULT_TILE_APPEARANCE.textColour).toLowerCase();
  const fontFamily = String(item.fontFamily ?? DEFAULT_TILE_APPEARANCE.fontFamily) as TileFontFamily;
  const borderColour = String(item.borderColour ?? DEFAULT_TILE_APPEARANCE.borderColour).toLowerCase();
  if (!VALID_BACKGROUND_TYPES.has(backgroundType) || !HEX_COLOUR.test(backgroundPrimary) || !HEX_COLOUR.test(backgroundSecondary) || !HEX_COLOUR.test(textColour) || !HEX_COLOUR.test(borderColour)) return null;
  if (!Number.isInteger(backgroundAngle) || backgroundAngle < 0 || backgroundAngle > 360 || !VALID_FONT_FAMILIES.has(fontFamily)) return null;
  if (backgroundMediaValue && (!IMAGE_DATA_URL.test(backgroundMediaValue) || dataUrlByteLength(backgroundMediaValue) > MAX_TILE_MEDIA_BYTES)) return null;
  if (backgroundType === 'media' && !backgroundMediaValue) return null;
  return { backgroundType, backgroundPrimary, backgroundSecondary, backgroundAngle, backgroundMedia: backgroundMediaValue, textColour, fontFamily, borderColour };
}

function legacySizeForDimension(width: number, height: number): LegacyDashboardSize {`,
    'appearance input helpers');

  source = replaceOnce(source,
`  const tileColour = VALID_TILE_COLOURS.has(colourValue) ? colourValue : 'default';
  return {`,
`  const tileColour = VALID_TILE_COLOURS.has(colourValue) ? colourValue : 'default';
  const backgroundTypeValue = String(row.background_type ?? DEFAULT_TILE_APPEARANCE.backgroundType) as TileBackgroundType;
  const fontFamilyValue = String(row.font_family ?? DEFAULT_TILE_APPEARANCE.fontFamily) as TileFontFamily;
  const backgroundType = VALID_BACKGROUND_TYPES.has(backgroundTypeValue) ? backgroundTypeValue : DEFAULT_TILE_APPEARANCE.backgroundType;
  const fontFamily = VALID_FONT_FAMILIES.has(fontFamilyValue) ? fontFamilyValue : DEFAULT_TILE_APPEARANCE.fontFamily;
  const appearance: TileAppearance = {
    backgroundType,
    backgroundPrimary: HEX_COLOUR.test(String(row.background_primary ?? '')) ? String(row.background_primary).toLowerCase() : DEFAULT_TILE_APPEARANCE.backgroundPrimary,
    backgroundSecondary: HEX_COLOUR.test(String(row.background_secondary ?? '')) ? String(row.background_secondary).toLowerCase() : DEFAULT_TILE_APPEARANCE.backgroundSecondary,
    backgroundAngle: Number.isInteger(row.background_angle) && Number(row.background_angle) >= 0 && Number(row.background_angle) <= 360 ? Number(row.background_angle) : DEFAULT_TILE_APPEARANCE.backgroundAngle,
    backgroundMedia: typeof row.background_media === 'string' && row.background_media ? row.background_media : null,
    textColour: HEX_COLOUR.test(String(row.text_colour ?? '')) ? String(row.text_colour).toLowerCase() : DEFAULT_TILE_APPEARANCE.textColour,
    fontFamily,
    borderColour: HEX_COLOUR.test(String(row.border_colour ?? '')) ? String(row.border_colour).toLowerCase() : DEFAULT_TILE_APPEARANCE.borderColour
  };
  return {`,
    'feature row appearance normalization');

  source = replaceOnce(source,
`    tileColour,
    accessGroups: row.matched_groups ? row.matched_groups.split(', ') : []`,
`    tileColour,
    ...appearance,
    appearance,
    accessGroups: row.matched_groups ? row.matched_groups.split(', ') : []`,
    'feature payload appearance');

  source = replaceOnce(source,
`      t.tile_colour,
      COALESCE((`,
`      t.tile_colour,
      t.background_type,
      t.background_primary,
      t.background_secondary,
      t.background_angle,
      t.background_media,
      t.text_colour,
      t.font_family,
      t.border_colour,
      COALESCE((`,
    'accessible feature query appearance');

  source = source.replaceAll(
`NULL AS position,NULL AS grid_x,NULL AS grid_y,NULL AS tile_width,NULL AS tile_height,NULL AS tile_colour,'' AS matched_groups`,
`NULL AS position,NULL AS grid_x,NULL AS grid_y,NULL AS tile_width,NULL AS tile_height,NULL AS tile_colour,NULL AS background_type,NULL AS background_primary,NULL AS background_secondary,NULL AS background_angle,NULL AS background_media,NULL AS text_colour,NULL AS font_family,NULL AS border_colour,'' AS matched_groups`
  );

  source = replaceOnce(source,
`    const tile: TilePlacement = {
      featureId,
      x: Number(item.x),
      y: Number(item.y),
      width: Number(item.width),
      height: Number(item.height),
      colour: String(item.colour ?? 'default') as TileColour
    };
    if (!VALID_TILE_COLOURS.has(tile.colour ?? 'default')) return secureJson({ ok: false, message: 'Choose a valid tile colour.' }, { status: 400 });`,
`    const appearance = tileAppearanceFromInput(item);
    if (!appearance) return secureJson({ ok: false, message: 'Choose a valid tile background, text colour, font, border and media file.' }, { status: 400 });
    const tile: TilePlacement = {
      featureId,
      x: Number(item.x),
      y: Number(item.y),
      width: Number(item.width),
      height: Number(item.height),
      colour: String(item.colour ?? 'default') as TileColour,
      ...appearance
    };
    if (!VALID_TILE_COLOURS.has(tile.colour ?? 'default')) return secureJson({ ok: false, message: 'Choose a valid legacy tile colour.' }, { status: 400 });`,
    'save layout appearance parsing');

  source = replaceOnce(source,
`      INSERT INTO user_dashboard_tiles(user_id,feature_id,position,size,grid_x,grid_y,tile_width,tile_height,tile_colour,pinned_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)
    \`).bind(user.id, tile.featureId, position, legacySizeForDimension(tile.width, tile.height), tile.x, tile.y, tile.width, tile.height, tile.colour ?? 'default', now, now));`,
`      INSERT INTO user_dashboard_tiles(user_id,feature_id,position,size,grid_x,grid_y,tile_width,tile_height,tile_colour,background_type,background_primary,background_secondary,background_angle,background_media,text_colour,font_family,border_colour,pinned_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    \`).bind(user.id, tile.featureId, position, legacySizeForDimension(tile.width, tile.height), tile.x, tile.y, tile.width, tile.height, tile.colour ?? 'default', tile.backgroundType, tile.backgroundPrimary, tile.backgroundSecondary, tile.backgroundAngle, tile.backgroundMedia, tile.textColour, tile.fontFamily, tile.borderColour, now, now));`,
    'save appearance insert');

  source = replaceOnce(source,
`JSON.stringify({ tiles: tiles.map(tile => ({ featureId: tile.featureId, x: tile.x, y: tile.y, width: tile.width, height: tile.height, colour: tile.colour ?? 'default' })), density, showDescriptions, tileGap, outerMargin })`,
`JSON.stringify({ tiles: tiles.map(tile => ({ featureId: tile.featureId, x: tile.x, y: tile.y, width: tile.width, height: tile.height, colour: tile.colour ?? 'default', backgroundType: tile.backgroundType, backgroundPrimary: tile.backgroundPrimary, backgroundSecondary: tile.backgroundSecondary, backgroundAngle: tile.backgroundAngle, hasBackgroundMedia: Boolean(tile.backgroundMedia), textColour: tile.textColour, fontFamily: tile.fontFamily, borderColour: tile.borderColour })), density, showDescriptions, tileGap, outerMargin })`,
    'appearance audit metadata');

  return source;
});

patch('public/dashboard.js', source => {
  source = replaceOnce(source,
`const GRID_COLUMNS = 6;
const TILE_COLOURS = new Set(['default','graphite','blue','cyan','green','amber','red','purple','pink']);`,
`const GRID_COLUMNS = 6;
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
const DEFAULT_TILE_APPEARANCE = Object.freeze({ backgroundType: 'solid', backgroundPrimary: '#11161d', backgroundSecondary: '#5268aa', backgroundAngle: 135, backgroundMedia: null, textColour: '#f4f7fb', fontFamily: 'system', borderColour: '#394657' });
const MAX_TILE_MEDIA_BYTES = 2 * 1024 * 1024;`,
    'browser appearance constants');

  source = replaceOnce(source,
`  draggingId: null,
  placementPreview: null,`,
`  draggingId: null,
  dragOffset: null,
  placementPreview: null,`,
    'drag offset state');

  source = replaceOnce(source,
`function tileRoute(feature) {`,
`function validHex(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value ?? ''));
}

function normalizedTileAppearance(source = {}) {
  const appearance = source.appearance ?? source;
  return {
    backgroundType: ['solid','gradient','media'].includes(appearance.backgroundType) ? appearance.backgroundType : DEFAULT_TILE_APPEARANCE.backgroundType,
    backgroundPrimary: validHex(appearance.backgroundPrimary) ? appearance.backgroundPrimary.toLowerCase() : DEFAULT_TILE_APPEARANCE.backgroundPrimary,
    backgroundSecondary: validHex(appearance.backgroundSecondary) ? appearance.backgroundSecondary.toLowerCase() : DEFAULT_TILE_APPEARANCE.backgroundSecondary,
    backgroundAngle: Number.isInteger(Number(appearance.backgroundAngle)) ? Math.max(0, Math.min(360, Number(appearance.backgroundAngle))) : DEFAULT_TILE_APPEARANCE.backgroundAngle,
    backgroundMedia: typeof appearance.backgroundMedia === 'string' && appearance.backgroundMedia.startsWith('data:image/') ? appearance.backgroundMedia : null,
    textColour: validHex(appearance.textColour) ? appearance.textColour.toLowerCase() : DEFAULT_TILE_APPEARANCE.textColour,
    fontFamily: Object.hasOwn(TILE_FONT_STACKS, appearance.fontFamily) ? appearance.fontFamily : DEFAULT_TILE_APPEARANCE.fontFamily,
    borderColour: validHex(appearance.borderColour) ? appearance.borderColour.toLowerCase() : DEFAULT_TILE_APPEARANCE.borderColour
  };
}

function applyTileAppearance(article, feature) {
  const appearance = normalizedTileAppearance(feature);
  article.dataset.backgroundType = appearance.backgroundType;
  article.dataset.customAppearance = 'true';
  article.style.setProperty('--tile-custom-text', appearance.textColour);
  article.style.setProperty('--tile-custom-border', appearance.borderColour);
  article.style.setProperty('--tile-custom-font', TILE_FONT_STACKS[appearance.fontFamily]);
  article.style.setProperty('--tile-accent', appearance.borderColour);
  article.style.borderColor = appearance.borderColour;
  article.style.color = appearance.textColour;
  article.style.fontFamily = TILE_FONT_STACKS[appearance.fontFamily];
  article.style.backgroundSize = 'cover';
  article.style.backgroundPosition = 'center';
  article.style.backgroundRepeat = 'no-repeat';
  if (appearance.backgroundType === 'gradient') {
    article.style.backgroundImage = `linear-gradient(${appearance.backgroundAngle}deg, ${appearance.backgroundPrimary}, ${appearance.backgroundSecondary})`;
    article.style.backgroundColor = appearance.backgroundPrimary;
  } else if (appearance.backgroundType === 'media' && appearance.backgroundMedia) {
    article.style.backgroundImage = `url(${JSON.stringify(appearance.backgroundMedia)})`;
    article.style.backgroundColor = appearance.backgroundPrimary;
  } else {
    article.style.backgroundImage = 'none';
    article.style.backgroundColor = appearance.backgroundPrimary;
  }
}

function tileRoute(feature) {`,
    'browser appearance helpers');

  source = replaceOnce(source,
`    height: Number(feature.height ?? feature.defaultHeight ?? 1),
    colour: TILE_COLOURS.has(feature.tileColour) ? feature.tileColour : 'default'
  }));`,
`    height: Number(feature.height ?? feature.defaultHeight ?? 1),
    colour: TILE_COLOURS.has(feature.tileColour) ? feature.tileColour : 'default',
    ...normalizedTileAppearance(feature)
  }));`,
    'clone tile appearance');

  source = replaceOnce(source,
`  article.style.gridColumn = \`${'${Number(feature.x) + 1}'} / span ${'${feature.width}'}\`;
  article.style.gridRow = \`${'${Number(feature.y) + 1}'} / span ${'${feature.height}'}\`;`,
`  article.style.gridColumn = \`${'${Number(feature.x) + 1}'} / span ${'${feature.width}'}\`;
  article.style.gridRow = \`${'${Number(feature.y) + 1}'} / span ${'${feature.height}'}\`;
  applyTileAppearance(article, feature);`,
    'apply tile appearance');

  source = replaceOnce(source,
`      const tile = workingTile(feature.id);
      dashboardState.draggingId = feature.id;`,
`      const tile = workingTile(feature.id);
      const metrics = gridMetrics();
      const rect = article.getBoundingClientRect();
      const localX = Math.max(0, Math.min(Math.max(0, rect.width - 1), Number(event.clientX || rect.left) - rect.left));
      const localY = Math.max(0, Math.min(Math.max(0, rect.height - 1), Number(event.clientY || rect.top) - rect.top));
      dashboardState.dragOffset = tile && metrics ? {
        x: Math.max(0, Math.min(tile.width - 1, Math.floor(localX / (metrics.cellWidth + metrics.gap)))),
        y: Math.max(0, Math.min(tile.height - 1, Math.floor(localY / (metrics.rowHeight + metrics.gap))))
      } : { x: 0, y: 0 };
      if (event.dataTransfer?.setDragImage) event.dataTransfer.setDragImage(article, localX, localY);
      dashboardState.draggingId = feature.id;`,
    'capture tile grab offset');

  source = replaceOnce(source,
`      dashboardState.draggingId = null;
      article.classList.remove('dragging');`,
`      dashboardState.draggingId = null;
      dashboardState.dragOffset = null;
      article.classList.remove('dragging');`,
    'clear drag offset on dragend');

  source = replaceOnce(source,
`  const colour = dashboardElement('#dashboard-selected-colour');
  if (colour) colour.value = TILE_COLOURS.has(tile.colour) ? tile.colour : 'default';`,
`  renderAppearanceControls(tile);`,
    'render appearance settings');

  source = replaceOnce(source,
`function addWorkingTile(feature) {`,
`function setAppearanceModeVisibility(type) {
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
    return `Gradient · ${preset?.name ?? 'Custom'}`;
  }
  const preset = TILE_SOLIDS.find(item => item.value === appearance.backgroundPrimary);
  return `Solid · ${preset?.name ?? appearance.backgroundPrimary.toUpperCase()}`;
}

function paletteButton(label, background, selected, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `dashboard-appearance-choice${selected ? ' selected' : ''}`;
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
  if (angleValue) angleValue.textContent = `${appearance.backgroundAngle}°`;
  if (text) text.value = appearance.textColour;
  if (font) font.value = appearance.fontFamily;
  if (border) border.value = appearance.borderColour;
  const appearanceLabel = dashboardElement('#dashboard-appearance-name');
  if (appearanceLabel) appearanceLabel.textContent = appearanceName(tile);
  const mediaStatus = dashboardElement('#dashboard-media-status');
  if (mediaStatus) mediaStatus.textContent = appearance.backgroundMedia ? 'Picture or GIF selected and ready to save.' : 'No picture selected.';
  const removeMedia = dashboardElement('#dashboard-remove-media');
  if (removeMedia) removeMedia.disabled = !appearance.backgroundMedia;

  const solidPalette = dashboardElement('#dashboard-solid-palette');
  if (solidPalette) {
    solidPalette.replaceChildren(...TILE_SOLIDS.map(item => paletteButton(item.name, item.value, appearance.backgroundType === 'solid' && appearance.backgroundPrimary === item.value, () => {
      tile.backgroundType = 'solid';
      tile.backgroundPrimary = item.value;
      refreshAppearancePreview(tile, `${item.name} background selected.`);
    })));
  }
  const gradientPalette = dashboardElement('#dashboard-gradient-palette');
  if (gradientPalette) {
    gradientPalette.replaceChildren(...TILE_GRADIENTS.map(item => paletteButton(item.name, `linear-gradient(${item.angle}deg,${item.primary},${item.secondary})`, appearance.backgroundType === 'gradient' && appearance.backgroundPrimary === item.primary && appearance.backgroundSecondary === item.secondary && appearance.backgroundAngle === item.angle, () => {
      tile.backgroundType = 'gradient';
      tile.backgroundPrimary = item.primary;
      tile.backgroundSecondary = item.secondary;
      tile.backgroundAngle = item.angle;
      refreshAppearancePreview(tile, `${item.name} gradient selected.`);
    })));
  }
}

function addWorkingTile(feature) {`,
    'appearance settings renderer');

  source = replaceOnce(source,
`  dashboardState.workingTiles.push({ featureId: feature.id, ...placement, colour: 'default' });`,
`  dashboardState.workingTiles.push({ featureId: feature.id, ...placement, colour: 'default', ...DEFAULT_TILE_APPEARANCE });`,
    'new tile appearance defaults');

  source = replaceOnce(source,
`    tiles.push({ featureId: feature.id, ...placement, colour: 'default' });`,
`    tiles.push({ featureId: feature.id, ...placement, colour: 'default', ...DEFAULT_TILE_APPEARANCE });`,
    'default layout appearance defaults');

  source = replaceOnce(source,
`function dropCoordinates(event, tile) {
  const cell = pointerGridCell(event);
  if (!cell) return null;
  return { x: Math.max(0, Math.min(GRID_COLUMNS - tile.width, cell.x)), y: cell.y };
}`, 
`function dropCoordinates(event, tile) {
  const cell = pointerGridCell(event);
  if (!cell) return null;
  const offset = dashboardState.dragOffset ?? { x: 0, y: 0 };
  return {
    x: Math.max(0, Math.min(GRID_COLUMNS - tile.width, cell.x - offset.x)),
    y: Math.max(0, cell.y - offset.y)
  };
}`,
    'drop coordinates with grab offset');

  source = replaceOnce(source,
`  dashboardState.draggingId = null;
  dashboardState.selectedId = featureId;`,
`  dashboardState.draggingId = null;
  dashboardState.dragOffset = null;
  dashboardState.selectedId = featureId;`,
    'clear drag offset on drop');

  source = replaceOnce(source,
`  dashboardState.draggingId = null;
  dashboardState.resizing = null;`,
`  dashboardState.draggingId = null;
  dashboardState.dragOffset = null;
  dashboardState.resizing = null;`,
    'clear drag offset on editor close');

  source = replaceOnce(source,
`dashboardElement('#dashboard-selected-colour')?.addEventListener('change', event => {
  const tile = workingTile(dashboardState.selectedId);
  const colour = String(event.currentTarget.value);
  if (!tile || !TILE_COLOURS.has(colour)) return;
  tile.colour = colour;
  editorMessage(\`${'${featureById(tile.featureId)?.name ?? \'Tile\'}'} colour changed to ${'${event.currentTarget.selectedOptions[0]?.textContent ?? colour}'}.\`, 'success');
  renderDashboardGrid();
  renderSelectedControls();
});`,
`dashboardElement('#dashboard-background-type')?.addEventListener('change', event => {
  const tile = workingTile(dashboardState.selectedId);
  const value = String(event.currentTarget.value);
  if (!tile || !['solid','gradient','media'].includes(value)) return;
  tile.backgroundType = value;
  refreshAppearancePreview(tile, `${event.currentTarget.selectedOptions[0]?.textContent ?? value} selected.`);
});
[['#dashboard-background-primary','backgroundPrimary'],['#dashboard-gradient-primary','backgroundPrimary'],['#dashboard-background-secondary','backgroundSecondary'],['#dashboard-text-colour','textColour'],['#dashboard-border-colour','borderColour']].forEach(([selector, field]) => {
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
  refreshAppearancePreview(tile, `${event.currentTarget.selectedOptions[0]?.textContent ?? value} font selected.`);
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
    editorMessage('Tile pictures and GIFs must be 2 MB or smaller.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    if (typeof reader.result !== 'string') return;
    tile.backgroundType = 'media';
    tile.backgroundMedia = reader.result;
    refreshAppearancePreview(tile, `${file.name} selected as the tile background.`);
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
  if (input) input.value = '';
  refreshAppearancePreview(tile, 'Tile appearance reset.');
});`,
    'appearance event handlers');

  return source;
});

patch('public/dashboard.css', source => {
  source += `

/* Per-user tile appearance editor */
.dashboard-tile[data-custom-appearance="true"]{color:var(--tile-custom-text);font-family:var(--tile-custom-font);border-color:var(--tile-custom-border)}
.dashboard-tile[data-custom-appearance="true"]:hover{border-color:var(--tile-custom-border)}
.dashboard-tile[data-custom-appearance="true"] .dashboard-tile-content,.dashboard-tile[data-custom-appearance="true"] .dashboard-action-title,.dashboard-tile[data-custom-appearance="true"] .dashboard-content-title,.dashboard-tile[data-custom-appearance="true"] .dashboard-news-headline,.dashboard-tile[data-custom-appearance="true"] .dashboard-profile-identity strong{color:inherit}
.dashboard-tile[data-custom-appearance="true"] .dashboard-content-label,.dashboard-tile[data-custom-appearance="true"] .dashboard-content-action,.dashboard-tile[data-custom-appearance="true"] .dashboard-profile-identity span,.dashboard-tile[data-custom-appearance="true"] .dashboard-content-description{color:color-mix(in srgb,var(--tile-custom-text) 76%,transparent)}
.dashboard-tile[data-custom-appearance="true"] .dashboard-action-icon,.dashboard-tile[data-custom-appearance="true"] .dashboard-content-icon,.dashboard-tile[data-custom-appearance="true"] .dashboard-profile-avatar{border-color:color-mix(in srgb,var(--tile-custom-border) 75%,white);background:color-mix(in srgb,var(--tile-custom-border) 35%,#f4f7fb);color:var(--tile-custom-text)}
.dashboard-tile[data-background-type="media"] .dashboard-tile-content{text-shadow:0 1px 3px rgba(0,0,0,.88)}
.dashboard-tile.editing{border-color:var(--tile-custom-border,var(--tile-border))}
.dashboard-tile-settings{font-family:Inter,Segoe UI,Arial,sans-serif!important}
.dashboard-tile-settings-dialog{width:min(820px,calc(100vw - 28px));max-height:calc(100vh - 32px);overflow:auto}
.dashboard-tile-settings-dialog .dashboard-selected-controls{display:grid;gap:16px;align-items:stretch}
.dashboard-tile-settings-section{display:grid;gap:12px;padding:16px;border:1px solid var(--line);background:#0e131a}
.dashboard-tile-settings-section-heading{display:flex;align-items:baseline;justify-content:space-between;gap:14px;padding-bottom:8px;border-bottom:1px solid var(--line)}
.dashboard-tile-settings-section-heading h3{margin:0;font-size:1.12rem}
.dashboard-tile-settings-section-heading span{color:var(--muted);font-size:.72rem;text-align:right}
.dashboard-layout-controls{display:flex;align-items:end;gap:12px;flex-wrap:wrap}
.dashboard-appearance-mode{display:grid;gap:10px;padding:12px;border:1px solid #303b49;background:#0a0e13}
.dashboard-appearance-palette{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
.dashboard-appearance-choice{display:grid!important;grid-template-columns:32px minmax(0,1fr)!important;align-items:center!important;gap:8px!important;min-height:43px!important;padding:5px 8px!important;text-align:left!important;border-color:#354253!important;background:#111720!important;transform:none!important;box-shadow:none!important}
.dashboard-appearance-choice.selected{border-color:#f4f7fb!important;box-shadow:inset 0 0 0 1px #f4f7fb!important}
.dashboard-appearance-swatch{width:30px;height:30px;border:1px solid rgba(255,255,255,.35)}
.dashboard-gradient-controls,.dashboard-appearance-finish{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;align-items:end}
.dashboard-colour-input{display:grid;grid-template-columns:minmax(0,1fr) 54px;align-items:center;gap:8px}
.dashboard-colour-input input[type="color"]{width:54px;height:38px;padding:2px;border:1px solid var(--line-strong);border-radius:0;background:#080b0f;cursor:pointer}
#dashboard-gradient-angle{width:100%}
.dashboard-media-upload{display:grid;gap:7px;padding:12px;border:1px dashed #536174;background:#10161e;cursor:pointer}
.dashboard-media-upload input{width:100%}
.dashboard-media-actions{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;color:var(--muted);font-size:.78rem}
.dashboard-media-actions button:disabled{opacity:.45;cursor:not-allowed}
.dashboard-appearance-finish{padding-top:4px}
.dashboard-appearance-finish button{align-self:end}
@media(max-width:720px){
  .dashboard-appearance-palette,.dashboard-gradient-controls,.dashboard-appearance-finish{grid-template-columns:1fr 1fr}
  .dashboard-tile-settings-section-heading{align-items:flex-start;flex-direction:column}
}
@media(max-width:480px){.dashboard-appearance-palette,.dashboard-gradient-controls,.dashboard-appearance-finish{grid-template-columns:1fr}}
`;
  return source;
});

console.log('Tile appearance and exact grab-offset patch applied.');
