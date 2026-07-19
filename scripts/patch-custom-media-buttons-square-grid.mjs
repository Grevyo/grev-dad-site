import fs from 'node:fs';

function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (source.indexOf(before, index + before.length) >= 0) throw new Error(`Non-unique patch anchor: ${label}`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}

function replaceAllChecked(source, before, after, minimum, label) {
  const count = source.split(before).length - 1;
  if (count < minimum) throw new Error(`Expected at least ${minimum} occurrences for ${label}, found ${count}`);
  return source.split(before).join(after);
}

function patch(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (before === after) throw new Error(`No changes produced for ${path}`);
  fs.writeFileSync(path, after);
}

patch('public/dashboard.js', source => {
  source = replaceOnce(source, 'const GRID_COLUMNS = 6;', 'const GRID_COLUMNS = 8;', 'browser grid columns');
  source = replaceOnce(
    source,
    "const TILE_FONT_STACKS = {\n  system: 'Inter,Segoe UI,Arial,sans-serif',\n  display: 'Impact,Haettenschweiler,Arial Narrow Bold,sans-serif',\n  mono: 'Cascadia Code,Consolas,Monaco,monospace',\n  serif: 'Georgia,Times New Roman,serif',\n  rounded: 'Trebuchet MS,Arial Rounded MT Bold,Arial,sans-serif'\n};\nconst DEFAULT_TILE_APPEARANCE = Object.freeze({ backgroundType: 'solid', backgroundPrimary: '#11161d', backgroundSecondary: '#5268aa', backgroundAngle: 135, backgroundMedia: null, textColour: '#f4f7fb', fontFamily: 'system', borderColour: '#394657' });",
    "const TILE_FONT_STACKS = {\n  system: 'Inter,Segoe UI,Arial,sans-serif',\n  display: 'Impact,Haettenschweiler,Arial Narrow Bold,sans-serif',\n  mono: 'Cascadia Code,Consolas,Monaco,monospace',\n  serif: 'Georgia,Times New Roman,serif',\n  rounded: 'Trebuchet MS,Arial Rounded MT Bold,Arial,sans-serif'\n};\nconst TILE_CONTENT_MODES = new Set(['standard','media-button']);\nconst TILE_MEDIA_FITS = new Set(['cover','contain','stretch']);\nconst TILE_MEDIA_OVERLAYS = new Set(['none','dark','light']);\nconst DEFAULT_TILE_APPEARANCE = Object.freeze({ backgroundType: 'solid', backgroundPrimary: '#11161d', backgroundSecondary: '#5268aa', backgroundAngle: 135, backgroundMedia: null, textColour: '#f4f7fb', fontFamily: 'system', borderColour: '#394657', contentMode: 'standard', customTitle: null, customIcon: null, mediaFit: 'cover', mediaOverlay: 'dark' });",
    'browser appearance constants'
  );
  source = replaceOnce(
    source,
    "  const flatFields = ['backgroundType','backgroundPrimary','backgroundSecondary','backgroundAngle','backgroundMedia','textColour','fontFamily','borderColour'];",
    "  const flatFields = ['backgroundType','backgroundPrimary','backgroundSecondary','backgroundAngle','backgroundMedia','textColour','fontFamily','borderColour','contentMode','customTitle','customIcon','mediaFit','mediaOverlay'];",
    'flat appearance fields'
  );
  source = replaceOnce(
    source,
    "    fontFamily: Object.hasOwn(TILE_FONT_STACKS, appearance.fontFamily) ? appearance.fontFamily : DEFAULT_TILE_APPEARANCE.fontFamily,\n    borderColour: validHex(appearance.borderColour) ? appearance.borderColour.toLowerCase() : DEFAULT_TILE_APPEARANCE.borderColour\n  };",
    "    fontFamily: Object.hasOwn(TILE_FONT_STACKS, appearance.fontFamily) ? appearance.fontFamily : DEFAULT_TILE_APPEARANCE.fontFamily,\n    borderColour: validHex(appearance.borderColour) ? appearance.borderColour.toLowerCase() : DEFAULT_TILE_APPEARANCE.borderColour,\n    contentMode: TILE_CONTENT_MODES.has(appearance.contentMode) ? appearance.contentMode : DEFAULT_TILE_APPEARANCE.contentMode,\n    customTitle: typeof appearance.customTitle === 'string' && appearance.customTitle.trim() ? appearance.customTitle.trim().slice(0, 80) : null,\n    customIcon: typeof appearance.customIcon === 'string' && appearance.customIcon.trim() ? appearance.customIcon.trim().slice(0, 12) : null,\n    mediaFit: TILE_MEDIA_FITS.has(appearance.mediaFit) ? appearance.mediaFit : DEFAULT_TILE_APPEARANCE.mediaFit,\n    mediaOverlay: TILE_MEDIA_OVERLAYS.has(appearance.mediaOverlay) ? appearance.mediaOverlay : DEFAULT_TILE_APPEARANCE.mediaOverlay\n  };",
    'normalized custom content fields'
  );
  source = replaceOnce(
    source,
    "  article.dataset.backgroundType = appearance.backgroundType;\n  article.dataset.customAppearance = 'true';",
    "  article.dataset.backgroundType = appearance.backgroundType;\n  article.dataset.contentMode = appearance.contentMode;\n  article.dataset.mediaFit = appearance.mediaFit;\n  article.dataset.mediaOverlay = appearance.mediaOverlay;\n  article.dataset.customAppearance = 'true';",
    'appearance datasets'
  );
  source = replaceOnce(
    source,
    "  article.style.backgroundSize = 'cover';\n  article.style.backgroundPosition = 'center';",
    "  article.style.backgroundSize = appearance.mediaFit === 'stretch' ? '100% 100%' : appearance.mediaFit;\n  article.style.backgroundPosition = 'center';\n  article.style.setProperty('--tile-media-overlay', appearance.mediaOverlay === 'dark' ? 'rgba(0,0,0,.42)' : appearance.mediaOverlay === 'light' ? 'rgba(255,255,255,.24)' : 'transparent');",
    'media fit and overlay styling'
  );
  source = replaceOnce(
    source,
    "function gridRowHeight(density) {\n  return density === 'compact' ? 92 : 116;\n}\n\nfunction gridMetrics() {",
    "function squareGridCellSize(element, gap, margin) {\n  const measuredWidth = element.getBoundingClientRect().width || element.parentElement?.getBoundingClientRect().width || window.innerWidth;\n  const usableWidth = Math.max(1, measuredWidth - margin * 2 - gap * (GRID_COLUMNS - 1));\n  return Math.max(64, usableWidth / GRID_COLUMNS);\n}\n\nfunction gridMetrics() {",
    'square cell sizing helper'
  );
  source = replaceOnce(
    source,
    "  const rowHeight = gridRowHeight(preferences.density);\n  const innerWidth = Math.max(1, rect.width - margin * 2);\n  const cellWidth = Math.max(1, (innerWidth - gap * (GRID_COLUMNS - 1)) / GRID_COLUMNS);\n  return { grid, rect, gap, margin, rowHeight, cellWidth };",
    "  const cellWidth = squareGridCellSize(grid, gap, margin);\n  const rowHeight = cellWidth;\n  return { grid, rect, gap, margin, rowHeight, cellWidth };",
    'square grid metrics'
  );
  source = replaceOnce(
    source,
    "  const density = preferences.density ?? 'comfortable';\n  element.style.setProperty('--dashboard-gap', `${gap}px`);\n  element.style.setProperty('--dashboard-margin', `${margin}px`);\n  element.style.setProperty('--tile-row-height', `${gridRowHeight(density)}px`);\n  element.style.gridTemplateColumns = `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`;",
    "  element.style.setProperty('--dashboard-gap', `${gap}px`);\n  element.style.setProperty('--dashboard-margin', `${margin}px`);\n  element.style.gridTemplateColumns = `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`;\n  element.style.setProperty('--tile-row-height', `${squareGridCellSize(element, gap, margin)}px`);",
    'apply square grid rows'
  );
  source = replaceOnce(
    source,
    "function createTileContent(feature, preferences, editing = false) {\n  if (feature.presentation !== 'content') return createActionTileContent(feature, editing);",
    "function createCustomMediaButtonContent(feature, editing = false) {\n  const appearance = normalizedTileAppearance(feature);\n  const content = tileSurface(feature, editing, 'dashboard-media-button-tile');\n  if (appearance.customIcon) {\n    const icon = document.createElement('span');\n    icon.className = 'dashboard-media-button-icon';\n    icon.textContent = appearance.customIcon;\n    content.append(icon);\n  }\n  if (appearance.customTitle) {\n    const title = document.createElement('strong');\n    title.className = 'dashboard-media-button-title';\n    title.textContent = appearance.customTitle;\n    content.append(title);\n  }\n  if (!appearance.backgroundMedia && editing) {\n    const placeholder = document.createElement('span');\n    placeholder.className = 'dashboard-media-button-placeholder';\n    placeholder.textContent = 'UPLOAD A PICTURE OR GIF';\n    content.append(placeholder);\n  }\n  return content;\n}\n\nfunction createTileContent(feature, preferences, editing = false) {\n  if (normalizedTileAppearance(feature).contentMode === 'media-button') return createCustomMediaButtonContent(feature, editing);\n  if (feature.presentation !== 'content') return createActionTileContent(feature, editing);",
    'custom media tile renderer'
  );
  source = replaceOnce(
    source,
    "  article.dataset.presentation = feature.presentation === 'content' ? 'content' : 'action';",
    "  article.dataset.presentation = feature.presentation === 'content' ? 'content' : 'action';\n  article.dataset.contentMode = normalizedTileAppearance(feature).contentMode;",
    'tile content-mode dataset'
  );
  source = replaceOnce(
    source,
    "  renderAppearanceControls(tile);",
    "  renderAppearanceControls(tile);",
    'selected controls anchor'
  );
  source = replaceOnce(
    source,
    "function setAppearanceModeVisibility(type) {",
    "function setCustomContentVisibility(mode) {\n  const controls = dashboardElement('#dashboard-custom-content-controls');\n  if (controls) controls.hidden = mode !== 'media-button';\n}\n\nfunction setAppearanceModeVisibility(type) {",
    'custom content visibility'
  );
  source = replaceOnce(
    source,
    "  const type = dashboardElement('#dashboard-background-type');\n  if (type) type.value = appearance.backgroundType;\n  setAppearanceModeVisibility(appearance.backgroundType);",
    "  const contentMode = dashboardElement('#dashboard-content-mode');\n  const customTitle = dashboardElement('#dashboard-custom-title');\n  const customIcon = dashboardElement('#dashboard-custom-icon');\n  const mediaFit = dashboardElement('#dashboard-media-fit');\n  const mediaOverlay = dashboardElement('#dashboard-media-overlay');\n  if (contentMode) contentMode.value = appearance.contentMode;\n  if (customTitle) customTitle.value = appearance.customTitle ?? '';\n  if (customIcon) customIcon.value = appearance.customIcon ?? '';\n  if (mediaFit) mediaFit.value = appearance.mediaFit;\n  if (mediaOverlay) mediaOverlay.value = appearance.mediaOverlay;\n  setCustomContentVisibility(appearance.contentMode);\n  const type = dashboardElement('#dashboard-background-type');\n  if (type) type.value = appearance.backgroundType;\n  setAppearanceModeVisibility(appearance.backgroundType);",
    'render custom content controls'
  );
  source = replaceOnce(
    source,
    "    editorMessage('That position is occupied or outside the six-column grid.', 'error');",
    "    editorMessage('That position is occupied or outside the eight-column grid.', 'error');",
    'eight column movement error'
  );
  source = replaceOnce(
    source,
    "dashboardElement('#dashboard-background-type')?.addEventListener('change', event => {",
    "dashboardElement('#dashboard-content-mode')?.addEventListener('change', event => {\n  const tile = workingTile(dashboardState.selectedId);\n  const value = String(event.currentTarget.value);\n  if (!tile || !TILE_CONTENT_MODES.has(value)) return;\n  tile.contentMode = value;\n  if (value === 'media-button') tile.backgroundType = 'media';\n  refreshAppearancePreview(tile, value === 'media-button' ? 'Custom media button selected. Upload a picture or GIF before saving.' : 'Standard tile content restored.');\n});\n[['#dashboard-custom-title','customTitle',80],['#dashboard-custom-icon','customIcon',12]].forEach(([selector, field, maximum]) => {\n  dashboardElement(selector)?.addEventListener('input', event => {\n    const tile = workingTile(dashboardState.selectedId);\n    if (!tile) return;\n    const value = String(event.currentTarget.value).slice(0, Number(maximum)).trim();\n    tile[field] = value || null;\n    refreshAppearancePreview(tile);\n  });\n});\n[['#dashboard-media-fit','mediaFit',TILE_MEDIA_FITS],['#dashboard-media-overlay','mediaOverlay',TILE_MEDIA_OVERLAYS]].forEach(([selector, field, allowed]) => {\n  dashboardElement(selector)?.addEventListener('change', event => {\n    const tile = workingTile(dashboardState.selectedId);\n    const value = String(event.currentTarget.value);\n    if (!tile || !allowed.has(value)) return;\n    tile[field] = value;\n    refreshAppearancePreview(tile);\n  });\n});\ndashboardElement('#dashboard-background-type')?.addEventListener('change', event => {",
    'custom content event handlers'
  );
  source = replaceOnce(
    source,
    "window.addEventListener('resize', () => {\n  if (!dashboardState.editing) return;\n  renderEditor();\n  editorMessage(isSingleColumnFallback()\n    ? 'Single-column preview: the visual order follows saved row and column coordinates. Exact horizontal placement requires a wider screen.'\n    : 'Wide-grid editing restored. Drag tiles or move them one cell at a time.');\n});",
    "window.addEventListener('resize', () => {\n  if (!dashboardState.payload) return;\n  if (!dashboardState.editing) {\n    renderDashboardGrid();\n    return;\n  }\n  renderEditor();\n  editorMessage(isSingleColumnFallback()\n    ? 'Single-column preview: the visual order follows saved row and column coordinates. Exact horizontal placement requires a wider screen.'\n    : 'Wide-grid editing restored. Drag tiles or move them one cell at a time.');\n});",
    'square grid resize handling'
  );
  return source;
});

patch('public/dashboard.html', source => {
  source = replaceAllChecked(source, 'six-column grid', 'eight-column square grid', 1, 'hero grid wording');
  source = replaceOnce(source, '<strong id="dashboard-grid-summary">6 columns</strong>', '<strong id="dashboard-grid-summary">8 square columns</strong>', 'grid summary');
  source = replaceOnce(
    source,
    '<section class="dashboard-tile-settings-section" aria-labelledby="dashboard-appearance-settings-title">',
    '<section class="dashboard-tile-settings-section" aria-labelledby="dashboard-content-settings-title">\n<div class="dashboard-tile-settings-section-heading"><h3 id="dashboard-content-settings-title">Tile content</h3><span>Standard or fully custom</span></div>\n<label>Content mode<select id="dashboard-content-mode"><option value="standard">Standard feature tile</option><option value="media-button">Custom media button</option></select></label>\n<div id="dashboard-custom-content-controls" class="dashboard-custom-content-controls" hidden>\n<p>Custom media mode removes the built-in tile content. The whole tile becomes the uploaded picture or GIF with only the optional title and icon below.</p>\n<label>Custom title <span class="optional">optional</span><input id="dashboard-custom-title" type="text" maxlength="80" placeholder="Leave empty for no title"></label>\n<label>Custom icon <span class="optional">optional</span><input id="dashboard-custom-icon" type="text" maxlength="12" placeholder="Emoji or short icon text"></label>\n<div class="dashboard-custom-media-options"><label>Picture fit<select id="dashboard-media-fit"><option value="cover">Fill tile (cover)</option><option value="contain">Show whole picture (contain)</option><option value="stretch">Stretch to tile</option></select></label><label>Text overlay<select id="dashboard-media-overlay"><option value="dark">Dark overlay</option><option value="light">Light overlay</option><option value="none">No overlay</option></select></label></div>\n</div>\n</section>\n<section class="dashboard-tile-settings-section" aria-labelledby="dashboard-appearance-settings-title">',
    'custom media content settings'
  );
  source = replaceOnce(source, '<strong>Picture or GIF background</strong>', '<strong>Picture or GIF</strong>', 'media heading');
  source = replaceOnce(source, 'Open Tile settings for colours, gradients, pictures, fonts and borders.', 'Open Tile settings for standard content or a fully custom picture/GIF button.', 'grid heading help');
  return source;
});

patch('public/dashboard.css', source => {
  source = replaceOnce(
    source,
    '.dashboard-tile-grid{\n  --dashboard-gap:12px;--dashboard-margin:0px;--tile-row-height:116px;',
    '.dashboard-tile-grid{\n  --dashboard-gap:12px;--dashboard-margin:0px;--tile-row-height:100px;',
    'square grid default row'
  );
  source = replaceOnce(
    source,
    '.dashboard-tile-content{display:grid;',
    '.dashboard-tile-content{position:relative;z-index:2;display:grid;',
    'tile content stacking'
  );
  source += `\n/* Custom media buttons remove normal feature content while keeping the complete tile clickable. */\n.dashboard-tile[data-content-mode="media-button"]::before{display:none}\n.dashboard-tile[data-content-mode="media-button"]::after{content:"";position:absolute;inset:0;z-index:1;background:var(--tile-media-overlay,rgba(0,0,0,.42));pointer-events:none}\n.dashboard-media-button-tile{position:relative;z-index:2;display:flex;min-width:0;min-height:0;width:100%;height:100%;flex-direction:column;justify-content:flex-end;align-items:flex-start;gap:8px;padding:16px;color:var(--tile-custom-text,#fff);text-decoration:none;box-sizing:border-box}\n.dashboard-media-button-icon{display:grid;place-items:center;min-width:42px;min-height:42px;padding:8px;border:1px solid currentColor;background:rgba(0,0,0,.28);font-size:clamp(1rem,4cqw,2rem);font-weight:950;line-height:1}\n.dashboard-media-button-title{max-width:100%;font-size:clamp(1rem,5cqw,2.25rem);line-height:1.02;overflow-wrap:anywhere;text-shadow:0 2px 12px rgba(0,0,0,.75)}\n.dashboard-media-button-placeholder{margin:auto;align-self:center;padding:8px 10px;border:1px dashed currentColor;background:rgba(0,0,0,.45);font-size:.68rem;font-weight:950;letter-spacing:.08em;text-align:center}\n.dashboard-tile[data-content-mode="media-button"][data-media-overlay="light"] .dashboard-media-button-title{color:#090b0f;text-shadow:0 1px 8px rgba(255,255,255,.7)}\n.dashboard-tile[data-content-mode="media-button"][data-media-fit="contain"]{background-repeat:no-repeat}\n.dashboard-custom-content-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:12px;border:1px solid var(--line);background:#0b0f14}\n.dashboard-custom-content-controls>p{grid-column:1/-1;margin:0;color:var(--muted);font-size:.82rem;line-height:1.45}\n.dashboard-custom-media-options{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}\n@media(max-width:760px){.dashboard-custom-content-controls,.dashboard-custom-media-options{grid-template-columns:1fr}}\n`;
  return source;
});

patch('src/dashboard.ts', source => {
  source = replaceOnce(source, "type TileFontFamily = 'system' | 'display' | 'mono' | 'serif' | 'rounded';", "type TileFontFamily = 'system' | 'display' | 'mono' | 'serif' | 'rounded';\ntype TileContentMode = 'standard' | 'media-button';\ntype TileMediaFit = 'cover' | 'contain' | 'stretch';\ntype TileMediaOverlay = 'none' | 'dark' | 'light';", 'server custom content types');
  source = replaceOnce(
    source,
    "  fontFamily: TileFontFamily;\n  borderColour: string;\n};",
    "  fontFamily: TileFontFamily;\n  borderColour: string;\n  contentMode: TileContentMode;\n  customTitle: string | null;\n  customIcon: string | null;\n  mediaFit: TileMediaFit;\n  mediaOverlay: TileMediaOverlay;\n};",
    'server appearance fields'
  );
  source = replaceOnce(
    source,
    "  border_colour: string | null;\n  matched_groups: string;",
    "  border_colour: string | null;\n  content_mode: string | null;\n  custom_title: string | null;\n  custom_icon: string | null;\n  media_fit: string | null;\n  media_overlay: string | null;\n  matched_groups: string;",
    'feature row custom columns'
  );
  source = replaceOnce(source, 'const GRID_COLUMNS = 6;', 'const GRID_COLUMNS = 8;', 'server grid columns');
  source = replaceOnce(
    source,
    "const VALID_FONT_FAMILIES = new Set<TileFontFamily>(['system','display','mono','serif','rounded']);",
    "const VALID_FONT_FAMILIES = new Set<TileFontFamily>(['system','display','mono','serif','rounded']);\nconst VALID_CONTENT_MODES = new Set<TileContentMode>(['standard','media-button']);\nconst VALID_MEDIA_FITS = new Set<TileMediaFit>(['cover','contain','stretch']);\nconst VALID_MEDIA_OVERLAYS = new Set<TileMediaOverlay>(['none','dark','light']);",
    'server custom content validators'
  );
  source = replaceOnce(
    source,
    "  fontFamily: 'system',\n  borderColour: '#394657'\n};",
    "  fontFamily: 'system',\n  borderColour: '#394657',\n  contentMode: 'standard',\n  customTitle: null,\n  customIcon: null,\n  mediaFit: 'cover',\n  mediaOverlay: 'dark'\n};",
    'server default custom content'
  );
  source = replaceOnce(
    source,
    "  const borderColour = String(item.borderColour ?? defaults.borderColour).toLowerCase();\n  if (!VALID_BACKGROUND_TYPES.has(backgroundType)",
    "  const borderColour = String(item.borderColour ?? defaults.borderColour).toLowerCase();\n  const contentMode = String(item.contentMode ?? defaults.contentMode) as TileContentMode;\n  const customTitleRaw = item.customTitle === null || item.customTitle === undefined || item.customTitle === '' ? null : item.customTitle;\n  const customIconRaw = item.customIcon === null || item.customIcon === undefined || item.customIcon === '' ? null : item.customIcon;\n  if (customTitleRaw !== null && typeof customTitleRaw !== 'string') return null;\n  if (customIconRaw !== null && typeof customIconRaw !== 'string') return null;\n  const customTitle = typeof customTitleRaw === 'string' && customTitleRaw.trim() ? customTitleRaw.trim() : null;\n  const customIcon = typeof customIconRaw === 'string' && customIconRaw.trim() ? customIconRaw.trim() : null;\n  const mediaFit = String(item.mediaFit ?? defaults.mediaFit) as TileMediaFit;\n  const mediaOverlay = String(item.mediaOverlay ?? defaults.mediaOverlay) as TileMediaOverlay;\n  if ((customTitle?.length ?? 0) > 80 || (customIcon?.length ?? 0) > 12) return null;\n  if (!VALID_CONTENT_MODES.has(contentMode) || !VALID_MEDIA_FITS.has(mediaFit) || !VALID_MEDIA_OVERLAYS.has(mediaOverlay)) return null;\n  if (!VALID_BACKGROUND_TYPES.has(backgroundType)",
    'server custom content parsing'
  );
  source = replaceOnce(
    source,
    "  if (backgroundType === 'media' && !backgroundMediaValue) return null;\n  return { backgroundType, backgroundPrimary, backgroundSecondary, backgroundAngle, backgroundMedia: backgroundMediaValue, textColour, fontFamily, borderColour };",
    "  if (backgroundType === 'media' && !backgroundMediaValue) return null;\n  if (contentMode === 'media-button' && (backgroundType !== 'media' || !backgroundMediaValue)) return null;\n  return { backgroundType, backgroundPrimary, backgroundSecondary, backgroundAngle, backgroundMedia: backgroundMediaValue, textColour, fontFamily, borderColour, contentMode, customTitle, customIcon, mediaFit, mediaOverlay };",
    'server custom content validation return'
  );
  source = replaceOnce(
    source,
    "    borderColour: HEX_COLOUR.test(String(row.border_colour ?? '')) ? String(row.border_colour).toLowerCase() : DEFAULT_TILE_APPEARANCE.borderColour\n  };",
    "    borderColour: HEX_COLOUR.test(String(row.border_colour ?? '')) ? String(row.border_colour).toLowerCase() : DEFAULT_TILE_APPEARANCE.borderColour,\n    contentMode: VALID_CONTENT_MODES.has(String(row.content_mode ?? '') as TileContentMode) ? String(row.content_mode) as TileContentMode : DEFAULT_TILE_APPEARANCE.contentMode,\n    customTitle: typeof row.custom_title === 'string' && row.custom_title.trim() ? row.custom_title.trim() : null,\n    customIcon: typeof row.custom_icon === 'string' && row.custom_icon.trim() ? row.custom_icon.trim() : null,\n    mediaFit: VALID_MEDIA_FITS.has(String(row.media_fit ?? '') as TileMediaFit) ? String(row.media_fit) as TileMediaFit : DEFAULT_TILE_APPEARANCE.mediaFit,\n    mediaOverlay: VALID_MEDIA_OVERLAYS.has(String(row.media_overlay ?? '') as TileMediaOverlay) ? String(row.media_overlay) as TileMediaOverlay : DEFAULT_TILE_APPEARANCE.mediaOverlay\n  };",
    'hydrate custom content fields'
  );
  source = replaceOnce(
    source,
    "t.border_colour,\n       COALESCE((",
    "       t.border_colour,\n       t.content_mode,\n       t.custom_title,\n       t.custom_icon,\n       t.media_fit,\n       t.media_overlay,\n       COALESCE((",
    'accessible feature custom columns'
  );
  source = replaceAllChecked(
    source,
    "NULL AS font_family,NULL AS border_colour,'' AS matched_groups",
    "NULL AS font_family,NULL AS border_colour,NULL AS content_mode,NULL AS custom_title,NULL AS custom_icon,NULL AS media_fit,NULL AS media_overlay,'' AS matched_groups",
    2,
    'null custom column aliases'
  );
  source = replaceOnce(
    source,
    "INSERT INTO user_dashboard_tiles(user_id,feature_id,position,size,grid_x,grid_y,tile_width,tile_height,tile_colour,background_type,background_primary,background_secondary,background_angle,background_media,text_colour,font_family,border_colour,pinned_at,updated_at)\n       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    "INSERT INTO user_dashboard_tiles(user_id,feature_id,position,size,grid_x,grid_y,tile_width,tile_height,tile_colour,background_type,background_primary,background_secondary,background_angle,background_media,text_colour,font_family,border_colour,content_mode,custom_title,custom_icon,media_fit,media_overlay,pinned_at,updated_at)\n       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    'save custom content columns'
  );
  source = replaceOnce(
    source,
    "tile.backgroundMedia, tile.textColour, tile.fontFamily, tile.borderColour, now, now));",
    "tile.backgroundMedia, tile.textColour, tile.fontFamily, tile.borderColour, tile.contentMode, tile.customTitle, tile.customIcon, tile.mediaFit, tile.mediaOverlay, now, now));",
    'bind custom content values'
  );
  source = replaceOnce(
    source,
    "hasBackgroundMedia: Boolean(tile.backgroundMedia), textColour: tile.textColour, fontFamily: tile.fontFamily, borderColour: tile.borderColour",
    "hasBackgroundMedia: Boolean(tile.backgroundMedia), textColour: tile.textColour, fontFamily: tile.fontFamily, borderColour: tile.borderColour, contentMode: tile.contentMode, hasCustomTitle: Boolean(tile.customTitle), hasCustomIcon: Boolean(tile.customIcon), mediaFit: tile.mediaFit, mediaOverlay: tile.mediaOverlay",
    'audit custom content metadata'
  );
  return source;
});

console.log('Custom media buttons and eight-column square grid patch applied.');
