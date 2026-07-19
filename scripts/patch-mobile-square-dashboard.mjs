import fs from 'node:fs';

function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (source.indexOf(before, index + before.length) >= 0) throw new Error(`Non-unique patch anchor: ${label}`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}

let js = fs.readFileSync('public/dashboard.js', 'utf8');
js = replaceOnce(js, 'const GRID_COLUMNS = 8;', 'const GRID_COLUMNS = 8;\nconst MOBILE_GRID_COLUMNS = 2;', 'mobile column constant');
js = replaceOnce(
  js,
  `function squareGridCellSize(element, gap, margin) {
  const measuredWidth = element.getBoundingClientRect().width || element.parentElement?.getBoundingClientRect().width || window.innerWidth;
  const usableWidth = Math.max(1, measuredWidth - margin * 2 - gap * (GRID_COLUMNS - 1));
  return Math.max(1, usableWidth / GRID_COLUMNS);
}

function gridMetrics() {`,
  `function activeGridColumns() {
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
  for (const tile of sorted) {
    const dimension = mobileTileDimension(tile);
    let location = null;
    for (let y = 0; y < 400 && !location; y += 1) {
      for (let x = 0; x <= MOBILE_GRID_COLUMNS - dimension.width; x += 1) {
        const candidate = { x, y, ...dimension };
        if (!occupied.some(existing => overlaps(candidate, existing))) {
          location = candidate;
          break;
        }
      }
    }
    const placement = location ?? { x: 0, y: occupied.reduce((maximum, item) => Math.max(maximum, item.y + item.height), 0), ...dimension };
    occupied.push(placement);
    packed.push({ ...tile, ...placement });
  }
  return packed;
}

function gridMetrics() {`,
  'responsive square grid helpers'
);
js = replaceOnce(
  js,
  `  const preferences = editorPreferences();
  const gap = Number(preferences.tileGap ?? 12);
  const margin = Number(preferences.outerMargin ?? 0);
  const cellWidth = squareGridCellSize(grid, gap, margin);
  const rowHeight = cellWidth;
  return { grid, rect, gap, margin, rowHeight, cellWidth };`,
  `  const preferences = editorPreferences();
  const { gap, margin } = responsiveGridSpacing(preferences);
  const columns = activeGridColumns();
  const cellWidth = squareGridCellSize(grid, gap, margin, columns);
  const rowHeight = cellWidth;
  return { grid, rect, gap, margin, columns, rowHeight, cellWidth };`,
  'responsive grid metrics'
);
js = replaceOnce(
  js,
  `    x: Math.max(0, Math.min(GRID_COLUMNS - 1, Math.floor((event.clientX - metrics.rect.left - metrics.margin) / (metrics.cellWidth + metrics.gap)))),`,
  `    x: Math.max(0, Math.min(metrics.columns - 1, Math.floor((event.clientX - metrics.rect.left - metrics.margin) / (metrics.cellWidth + metrics.gap)))),`,
  'responsive pointer clamp'
);
js = replaceOnce(
  js,
  `function applyGridSurface(element, preferences, rows) {
  const gap = Number(preferences.tileGap ?? 12);
  const margin = Number(preferences.outerMargin ?? 0);
  element.style.setProperty('--dashboard-gap', \`${gap}px\`);
  element.style.setProperty('--dashboard-margin', \`${margin}px\`);
  element.style.gridTemplateColumns = \`repeat(${GRID_COLUMNS}, minmax(0, 1fr))\`;
  element.style.setProperty('--tile-row-height', \`${squareGridCellSize(element, gap, margin)}px\`);
  element.style.gridTemplateRows = \`repeat(${rows}, var(--tile-row-height))\`;
}`,
  `function applyGridSurface(element, preferences, rows) {
  const { gap, margin } = responsiveGridSpacing(preferences);
  const columns = activeGridColumns();
  element.style.setProperty('--dashboard-gap', \`${gap}px\`);
  element.style.setProperty('--dashboard-margin', \`${margin}px\`);
  element.style.gridTemplateColumns = \`repeat(${columns}, minmax(0, 1fr))\`;
  element.style.setProperty('--tile-row-height', \`${squareGridCellSize(element, gap, margin, columns)}px\`);
  element.style.gridTemplateRows = \`repeat(${rows}, var(--tile-row-height))\`;
}`,
  'responsive grid surface'
);
js = replaceOnce(
  js,
  `function addGridCells(grid, rows) {
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < GRID_COLUMNS; x += 1) {`,
  `function addGridCells(grid, rows) {
  const columns = activeGridColumns();
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {`,
  'responsive editor cells'
);
js = replaceOnce(
  js,
  `  if (dashboardState.editing && isSingleColumnFallback()) {
    tiles = [...tiles].sort((a, b) => a.y - b.y || a.x - b.x);
  }

  const rows = dashboardRows(tiles, dashboardState.editing ? 3 : 1);`,
  `  if (isSingleColumnFallback()) tiles = packMobileTiles(tiles);

  const rows = dashboardRows(tiles, dashboardState.editing ? 2 : 0);`,
  'mobile packing'
);
js = replaceOnce(
  js,
  `  if (summary) summary.textContent = \`${GRID_COLUMNS} columns × ${rows} visible rows\`;

  if (dashboardState.editing) {
    dashboardMessage(\`Editing live preview · ${tiles.length} tile${tiles.length === 1 ? '' : 's'} · changes not yet saved\`, 'success');
  } else {
    dashboardMessage(\`${tiles.length} pinned feature${tiles.length === 1 ? '' : 's'} · ${dashboardState.payload.features.length} available · ${GRID_COLUMNS}-column grid\`, 'success');
  }`,
  `  const columns = activeGridColumns();
  if (summary) summary.textContent = isSingleColumnFallback() ? \`${columns}-column mobile grid × ${rows} rows\` : \`${columns} columns × ${rows} visible rows\`;

  if (dashboardState.editing) {
    dashboardMessage(\`Editing live preview · ${tiles.length} tile${tiles.length === 1 ? '' : 's'} · changes not yet saved\`, 'success');
  } else {
    dashboardMessage(\`${tiles.length} pinned feature${tiles.length === 1 ? '' : 's'} · ${dashboardState.payload.features.length} available · ${columns}-column ${isSingleColumnFallback() ? 'mobile ' : ''}grid\`, 'success');
  }`,
  'responsive grid summary'
);
fs.writeFileSync('public/dashboard.js', js);

let css = fs.readFileSync('public/dashboard.css', 'utf8');
css = replaceOnce(
  css,
  `@media(max-width:900px){
  .dashboard-tile-grid{display:grid!important;grid-template-columns:1fr!important;grid-template-rows:none!important;padding:var(--dashboard-margin)}
  .dashboard-tile,.dashboard-grid-cell{grid-column:1/-1!important;grid-row:auto!important;min-height:170px}
  .dashboard-grid-cell{display:none}
  .dashboard-tile-edit-strip{grid-template-columns:1fr}
  .dashboard-tile-move,.dashboard-tile-resize{display:none}
  .dashboard-tile[data-height="1"] .dashboard-tile-body{display:block}
  .dashboard-tile[data-width="1"] .dashboard-tile-content{padding:16px}
  .dashboard-tile[data-width="1"] .dashboard-tile-icon{width:42px;height:42px}
  .dashboard-tile[data-width="1"] h2{font-size:1.35rem}
  .dashboard-tile[data-width="1"][data-height="1"] .dashboard-access-label{display:inline}
  .dashboard-editor-settings{grid-template-columns:repeat(2,minmax(0,1fr))}
  .dashboard-editor-topline{flex-direction:column}
}`,
  `@media(max-width:900px){
  .dashboard-tile-grid{display:grid!important;padding:var(--dashboard-margin)}
  .dashboard-grid-cell{display:none}
  .dashboard-tile{min-height:0}
  .dashboard-tile-edit-strip{grid-template-columns:1fr}
  .dashboard-tile-move,.dashboard-tile-resize{display:none}
  .dashboard-tile[data-height="1"] .dashboard-tile-body{display:none}
  .dashboard-tile[data-width="1"] .dashboard-tile-content{padding:12px}
  .dashboard-tile[data-width="1"] .dashboard-tile-icon{width:32px;height:32px}
  .dashboard-tile[data-width="1"] h2{font-size:1rem}
  .dashboard-tile[data-width="1"][data-height="1"] .dashboard-access-label{display:none}
  .dashboard-editor-settings{grid-template-columns:repeat(2,minmax(0,1fr))}
  .dashboard-editor-topline{flex-direction:column}
}`,
  'remove legacy single-column fallback'
);
css = replaceOnce(
  css,
  `@media(max-width:900px){
  .dashboard-action-tile{min-height:168px}
  .dashboard-tile[data-presentation="action"][data-width="1"] .dashboard-action-tile{grid-template-columns:auto minmax(0,1fr) auto;grid-template-rows:1fr;justify-items:stretch;text-align:left;padding:18px}
  .dashboard-tile[data-presentation="action"][data-width="1"] .dashboard-action-arrow{display:inline}
  .dashboard-content-tile{min-height:168px}
}`,
  `@media(max-width:900px){
  .dashboard-action-tile,.dashboard-content-tile{min-height:0}
}`,
  'remove forced mobile rectangle content'
);
css += `
/* Mobile keeps the square-cell system instead of flattening tiles into full-width rectangles. */
@media(max-width:900px){
  .dashboard-tile-grid{margin-top:16px}
  .dashboard-media-button-tile{padding:12px}
  .dashboard-media-button-icon{min-width:34px;min-height:34px;padding:6px}
  .dashboard-media-button-title{font-size:clamp(.9rem,8cqw,1.55rem)}
}
@media(max-width:420px){
  .dashboard-shell{width:calc(100% - 12px)}
  .dashboard-tile-grid{--dashboard-gap:8px}
}
`;
fs.writeFileSync('public/dashboard.css', css);

console.log('Mobile dashboard now uses a responsive two-column square grid.');
