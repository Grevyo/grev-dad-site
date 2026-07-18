import fs from 'node:fs';

function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Missing patch anchor: ${label}`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}

function replaceRegex(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`Missing patch pattern: ${label}`);
  return source.replace(pattern, replacement);
}

let server = fs.readFileSync('src/dashboard.ts', 'utf8');
server = replaceOnce(server,
  "type DashboardDensity = 'comfortable' | 'compact';\ntype Dimension = { width: number; height: number };\ntype TilePlacement = Dimension & { featureId: string; x: number; y: number };",
  "type DashboardDensity = 'comfortable' | 'compact';\ntype TileColour = 'default' | 'graphite' | 'blue' | 'cyan' | 'green' | 'amber' | 'red' | 'purple' | 'pink';\ntype Dimension = { width: number; height: number };\ntype TilePlacement = Dimension & { featureId: string; x: number; y: number; colour?: TileColour };",
  'dashboard types');
server = replaceOnce(server,
  "  tile_height: number | null;\n  matched_groups: string;",
  "  tile_height: number | null;\n  tile_colour: string | null;\n  matched_groups: string;",
  'feature row colour');
server = replaceOnce(server,
  "const ALL_DIMENSIONS = Array.from({ length: 3 }, (_, heightIndex) =>\n  Array.from({ length: GRID_COLUMNS }, (_, widthIndex) => `${widthIndex + 1}x${heightIndex + 1}`)\n).flat();\nconst VALID_DIMENSIONS = new Set(ALL_DIMENSIONS);",
  "const ALL_DIMENSIONS = Array.from({ length: 4 }, (_, heightIndex) =>\n  Array.from({ length: GRID_COLUMNS }, (_, widthIndex) => `${widthIndex + 1}x${heightIndex + 1}`)\n).flat();\nconst VALID_DIMENSIONS = new Set(ALL_DIMENSIONS);\nconst VALID_TILE_COLOURS = new Set<TileColour>(['default','graphite','blue','cyan','green','amber','red','purple','pink']);",
  'dimension and colour constants');
server = replaceOnce(server,
  "    && tile.width >= 1 && tile.width <= GRID_COLUMNS && tile.height >= 1 && tile.height <= 3",
  "    && tile.width >= 1 && tile.width <= GRID_COLUMNS && tile.height >= 1 && tile.height <= 4",
  'maximum tile height');
server = replaceOnce(server,
  "  const width = row.tile_width ?? row.default_width;\n  const height = row.tile_height ?? row.default_height;\n  return {",
  "  const width = row.tile_width ?? row.default_width;\n  const height = row.tile_height ?? row.default_height;\n  const colourValue = String(row.tile_colour ?? 'default') as TileColour;\n  const tileColour = VALID_TILE_COLOURS.has(colourValue) ? colourValue : 'default';\n  return {",
  'feature colour normalization');
server = replaceOnce(server,
  "    dimension: dimensionKey(width, height),\n    accessGroups:",
  "    dimension: dimensionKey(width, height),\n    tileColour,\n    accessGroups:",
  'feature payload colour');
server = replaceOnce(server,
  "      t.tile_width,\n      t.tile_height,",
  "      t.tile_width,\n      t.tile_height,\n      t.tile_colour,",
  'accessible feature colour select');
server = replaceOnce(server,
  "SELECT f.*,NULL AS position,NULL AS grid_x,NULL AS grid_y,NULL AS tile_width,NULL AS tile_height,'' AS matched_groups",
  "SELECT f.*,NULL AS position,NULL AS grid_x,NULL AS grid_y,NULL AS tile_width,NULL AS tile_height,NULL AS tile_colour,'' AS matched_groups",
  'default feature colour select');
server = replaceOnce(server,
  "    const height = Math.max(1, Math.min(3, feature.default_height));",
  "    const height = Math.max(1, Math.min(4, feature.default_height));",
  'default placement height');
server = replaceOnce(server,
  "INSERT OR IGNORE INTO user_dashboard_tiles(user_id,feature_id,position,size,grid_x,grid_y,tile_width,tile_height,pinned_at,updated_at)\n      VALUES(?,?,?,?,?,?,?,?,?,?)\n    `).bind(user.id, tile.featureId, position, legacySizeForDimension(tile.width, tile.height), tile.x, tile.y, tile.width, tile.height, now, now)",
  "INSERT OR IGNORE INTO user_dashboard_tiles(user_id,feature_id,position,size,grid_x,grid_y,tile_width,tile_height,tile_colour,pinned_at,updated_at)\n      VALUES(?,?,?,?,?,?,?,?,?,?,?)\n    `).bind(user.id, tile.featureId, position, legacySizeForDimension(tile.width, tile.height), tile.x, tile.y, tile.width, tile.height, 'default', now, now)",
  'default tile colour insert');
server = replaceOnce(server,
  "      height: Number(item.height)\n    };\n    if (!feature || seen.has(featureId) || !validPlacement(tile))",
  "      height: Number(item.height),\n      colour: String(item.colour ?? 'default') as TileColour\n    };\n    if (!VALID_TILE_COLOURS.has(tile.colour ?? 'default')) return secureJson({ ok: false, message: 'Choose a valid tile colour.' }, { status: 400 });\n    if (!feature || seen.has(featureId) || !validPlacement(tile))",
  'layout colour parsing');
server = replaceOnce(server,
  "INSERT INTO user_dashboard_tiles(user_id,feature_id,position,size,grid_x,grid_y,tile_width,tile_height,pinned_at,updated_at)\n      VALUES(?,?,?,?,?,?,?,?,?,?)\n    `).bind(user.id, tile.featureId, position, legacySizeForDimension(tile.width, tile.height), tile.x, tile.y, tile.width, tile.height, now, now)",
  "INSERT INTO user_dashboard_tiles(user_id,feature_id,position,size,grid_x,grid_y,tile_width,tile_height,tile_colour,pinned_at,updated_at)\n      VALUES(?,?,?,?,?,?,?,?,?,?,?)\n    `).bind(user.id, tile.featureId, position, legacySizeForDimension(tile.width, tile.height), tile.x, tile.y, tile.width, tile.height, tile.colour ?? 'default', now, now)",
  'saved tile colour insert');
server = replaceOnce(server,
  "JSON.stringify({ tiles: tiles.map(tile => ({ featureId: tile.featureId, x: tile.x, y: tile.y, width: tile.width, height: tile.height })), density, showDescriptions, tileGap, outerMargin })",
  "JSON.stringify({ tiles: tiles.map(tile => ({ featureId: tile.featureId, x: tile.x, y: tile.y, width: tile.width, height: tile.height, colour: tile.colour ?? 'default' })), density, showDescriptions, tileGap, outerMargin })",
  'audit tile colour');
server = replaceOnce(server,
  "SELECT f.*,NULL AS position,NULL AS grid_x,NULL AS grid_y,NULL AS tile_width,NULL AS tile_height,'' AS matched_groups FROM dashboard_features f",
  "SELECT f.*,NULL AS position,NULL AS grid_x,NULL AS grid_y,NULL AS tile_width,NULL AS tile_height,NULL AS tile_colour,'' AS matched_groups FROM dashboard_features f",
  'admin catalogue colour select');
fs.writeFileSync('src/dashboard.ts', server);

let html = fs.readFileSync('public/dashboard.html', 'utf8');
html = replaceOnce(html,
  '<label>Size<select id="dashboard-selected-dimension"></select></label>\n<div class="dashboard-selected-arrows"',
  '<label>Size<select id="dashboard-selected-dimension"></select></label>\n<label>Colour<select id="dashboard-selected-colour"><option value="default">Default charcoal</option><option value="graphite">Graphite</option><option value="blue">Blue</option><option value="cyan">Cyan</option><option value="green">Green</option><option value="amber">Amber</option><option value="red">Red</option><option value="purple">Purple</option><option value="pink">Pink</option></select></label>\n<div class="dashboard-selected-arrows"',
  'member colour selector');
fs.writeFileSync('public/dashboard.html', html);

let client = fs.readFileSync('public/dashboard.js', 'utf8');
client = replaceOnce(client,
  'const GRID_COLUMNS = 6;\nconst dashboardState = {',
  "const GRID_COLUMNS = 6;\nconst TILE_COLOURS = new Set(['default','graphite','blue','cyan','green','amber','red','purple','pink']);\nconst dashboardState = {",
  'client colour constants');
client = replaceOnce(client,
  "    height: Number(feature.height ?? feature.defaultHeight ?? 1)\n  }));",
  "    height: Number(feature.height ?? feature.defaultHeight ?? 1),\n    colour: TILE_COLOURS.has(feature.tileColour) ? feature.tileColour : 'default'\n  }));",
  'clone pinned colour');
client = replaceOnce(client,
  "  article.dataset.height = String(feature.height);\n  article.style.gridColumn",
  "  article.dataset.height = String(feature.height);\n  article.dataset.colour = TILE_COLOURS.has(feature.colour ?? feature.tileColour) ? (feature.colour ?? feature.tileColour) : 'default';\n  article.style.gridColumn",
  'tile colour data attribute');
client = replaceOnce(client,
  "  feature.allowedDimensions.forEach(value => {\n    const option = document.createElement('option');\n    option.value = value;\n    option.textContent = value.replace('x', ' × ');\n    option.selected = dimensionKey(tile.width, tile.height) === value;\n    size.append(option);\n  });\n  document.querySelectorAll('[data-move-x][data-move-y]')",
  "  feature.allowedDimensions.forEach(value => {\n    const option = document.createElement('option');\n    option.value = value;\n    option.textContent = value.replace('x', ' × ');\n    option.selected = dimensionKey(tile.width, tile.height) === value;\n    size.append(option);\n  });\n  const colour = dashboardElement('#dashboard-selected-colour');\n  if (colour) colour.value = TILE_COLOURS.has(tile.colour) ? tile.colour : 'default';\n  document.querySelectorAll('[data-move-x][data-move-y]')",
  'selected colour control');
client = replaceOnce(client,
  "  dashboardState.workingTiles.push({ featureId: feature.id, ...placement });",
  "  dashboardState.workingTiles.push({ featureId: feature.id, ...placement, colour: 'default' });",
  'new tile default colour');
client = replaceOnce(client,
  "    tiles.push({ featureId: feature.id, ...placement });",
  "    tiles.push({ featureId: feature.id, ...placement, colour: 'default' });",
  'default layout colour');
client = replaceOnce(client,
  "dashboardElement('#dashboard-selected-dimension')?.addEventListener('change', event => {\n  if (dashboardState.selectedId) resizeWorkingTile(dashboardState.selectedId, event.currentTarget.value);\n});\ndocument.querySelectorAll('[data-move-x][data-move-y]')",
  "dashboardElement('#dashboard-selected-dimension')?.addEventListener('change', event => {\n  if (dashboardState.selectedId) resizeWorkingTile(dashboardState.selectedId, event.currentTarget.value);\n});\ndashboardElement('#dashboard-selected-colour')?.addEventListener('change', event => {\n  const tile = workingTile(dashboardState.selectedId);\n  const colour = String(event.currentTarget.value);\n  if (!tile || !TILE_COLOURS.has(colour)) return;\n  tile.colour = colour;\n  editorMessage(`${featureById(tile.featureId)?.name ?? 'Tile'} colour changed to ${event.currentTarget.selectedOptions[0]?.textContent ?? colour}.`, 'success');\n  renderDashboardGrid();\n  renderSelectedControls();\n});\ndocument.querySelectorAll('[data-move-x][data-move-y]')",
  'colour change listener');
fs.writeFileSync('public/dashboard.js', client);

let css = fs.readFileSync('public/dashboard.css', 'utf8');
css = replaceOnce(css,
  'container-type:size;container-name:dashboard-tile;position:relative;z-index:2;display:flex;min-width:0;min-height:0;height:100%;flex-direction:column;border:1px solid var(--line);background:var(--panel);overflow:hidden',
  'container-type:size;container-name:dashboard-tile;--tile-bg:var(--panel);--tile-bg-hover:var(--panel-2);--tile-border:var(--line);--tile-border-strong:var(--line-strong);--tile-accent:var(--accent);position:relative;z-index:2;display:flex;min-width:0;min-height:0;height:100%;flex-direction:column;border:1px solid var(--tile-border);background:var(--tile-bg);overflow:hidden',
  'tile palette variables');
css = replaceOnce(css,
  '.dashboard-tile::before{content:"";position:absolute;z-index:3;top:-1px;left:-1px;width:54px;height:4px;background:var(--accent)}\n.dashboard-tile:hover{border-color:var(--line-strong);background:var(--panel-2)}',
  '.dashboard-tile::before{content:"";position:absolute;z-index:3;top:-1px;left:-1px;width:54px;height:4px;background:var(--tile-accent)}\n.dashboard-tile:hover{border-color:var(--tile-border-strong);background:var(--tile-bg-hover)}\n.dashboard-tile[data-colour="graphite"]{--tile-bg:#171b22;--tile-bg-hover:#1e242d;--tile-border:#3e4856;--tile-border-strong:#687789;--tile-accent:#9aa8b8}\n.dashboard-tile[data-colour="blue"]{--tile-bg:#101a2a;--tile-bg-hover:#14233a;--tile-border:#365987;--tile-border-strong:#5c82b8;--tile-accent:#6ea8ff}\n.dashboard-tile[data-colour="cyan"]{--tile-bg:#0e2023;--tile-bg-hover:#123035;--tile-border:#2f6c73;--tile-border-strong:#4e9ca5;--tile-accent:#60d9e6}\n.dashboard-tile[data-colour="green"]{--tile-bg:#112319;--tile-bg-hover:#172e21;--tile-border:#376c4b;--tile-border-strong:#58936c;--tile-accent:#6edb91}\n.dashboard-tile[data-colour="amber"]{--tile-bg:#2a2010;--tile-bg-hover:#382b14;--tile-border:#7b5b26;--tile-border-strong:#aa813d;--tile-accent:#f1b94d}\n.dashboard-tile[data-colour="red"]{--tile-bg:#291417;--tile-bg-hover:#381a1f;--tile-border:#793842;--tile-border-strong:#a95461;--tile-accent:#ff7080}\n.dashboard-tile[data-colour="purple"]{--tile-bg:#21172f;--tile-bg-hover:#2d1e40;--tile-border:#60457f;--tile-border-strong:#8765aa;--tile-accent:#ba8cff}\n.dashboard-tile[data-colour="pink"]{--tile-bg:#2b1624;--tile-bg-hover:#391d30;--tile-border:#7c3b65;--tile-border-strong:#a9588a;--tile-accent:#ff84ca}',
  'tile palette styles');
fs.writeFileSync('public/dashboard.css', css);

let adminHtml = fs.readFileSync('public/admin-dashboard.html', 'utf8');
adminHtml = replaceRegex(adminHtml,
  /<option value="6x1">6 × 1<\/option><option value="6x2">6 × 2<\/option><option value="6x3">6 × 3<\/option>/,
  '<option value="6x1">6 × 1</option><option value="6x2">6 × 2</option><option value="6x3">6 × 3</option><option value="6x4">6 × 4</option>',
  'admin default 6x4');
adminHtml = replaceRegex(adminHtml,
  /<option value="1x1">1 × 1<\/option><option value="1x2">1 × 2<\/option><option value="1x3">1 × 3<\/option>/,
  '<option value="1x1">1 × 1</option><option value="1x2">1 × 2</option><option value="1x3">1 × 3</option><option value="1x4">1 × 4</option>',
  'admin default 1x4');
adminHtml = replaceRegex(adminHtml,
  /<option value="2x1" selected>2 × 1<\/option><option value="2x2">2 × 2<\/option><option value="2x3">2 × 3<\/option>/,
  '<option value="2x1" selected>2 × 1</option><option value="2x2">2 × 2</option><option value="2x3">2 × 3</option><option value="2x4">2 × 4</option>',
  'admin default 2x4');
adminHtml = replaceRegex(adminHtml,
  /<option value="3x1">3 × 1<\/option><option value="3x2">3 × 2<\/option><option value="3x3">3 × 3<\/option>/,
  '<option value="3x1">3 × 1</option><option value="3x2">3 × 2</option><option value="3x3">3 × 3</option><option value="3x4">3 × 4</option>',
  'admin default 3x4');
adminHtml = replaceRegex(adminHtml,
  /<option value="4x1">4 × 1<\/option><option value="4x2">4 × 2<\/option><option value="4x3">4 × 3<\/option>/,
  '<option value="4x1">4 × 1</option><option value="4x2">4 × 2</option><option value="4x3">4 × 3</option><option value="4x4">4 × 4</option>',
  'admin default 4x4');
adminHtml = replaceRegex(adminHtml,
  /<option value="5x1">5 × 1<\/option><option value="5x2">5 × 2<\/option><option value="5x3">5 × 3<\/option>/,
  '<option value="5x1">5 × 1</option><option value="5x2">5 × 2</option><option value="5x3">5 × 3</option><option value="5x4">5 × 4</option>',
  'admin default 5x4');
adminHtml = replaceOnce(adminHtml,
  '<label><input type="checkbox" value="6x1"> 6 × 1</label><label><input type="checkbox" value="6x2"> 6 × 2</label><label><input type="checkbox" value="6x3"> 6 × 3</label>',
  '<label><input type="checkbox" value="6x1"> 6 × 1</label><label><input type="checkbox" value="6x2"> 6 × 2</label><label><input type="checkbox" value="6x3"> 6 × 3</label><label><input type="checkbox" value="6x4"> 6 × 4</label>',
  'admin allowed 6x4');
adminHtml = replaceOnce(adminHtml,
  '<label><input type="checkbox" value="1x1" checked> 1 × 1</label><label><input type="checkbox" value="1x2" checked> 1 × 2</label><label><input type="checkbox" value="1x3"> 1 × 3</label>',
  '<label><input type="checkbox" value="1x1" checked> 1 × 1</label><label><input type="checkbox" value="1x2" checked> 1 × 2</label><label><input type="checkbox" value="1x3"> 1 × 3</label><label><input type="checkbox" value="1x4"> 1 × 4</label>',
  'admin allowed 1x4');
adminHtml = replaceOnce(adminHtml,
  '<label><input type="checkbox" value="2x1" checked> 2 × 1</label><label><input type="checkbox" value="2x2" checked> 2 × 2</label><label><input type="checkbox" value="2x3"> 2 × 3</label>',
  '<label><input type="checkbox" value="2x1" checked> 2 × 1</label><label><input type="checkbox" value="2x2" checked> 2 × 2</label><label><input type="checkbox" value="2x3"> 2 × 3</label><label><input type="checkbox" value="2x4"> 2 × 4</label>',
  'admin allowed 2x4');
adminHtml = replaceOnce(adminHtml,
  '<label><input type="checkbox" value="3x1" checked> 3 × 1</label><label><input type="checkbox" value="3x2" checked> 3 × 2</label><label><input type="checkbox" value="3x3"> 3 × 3</label>',
  '<label><input type="checkbox" value="3x1" checked> 3 × 1</label><label><input type="checkbox" value="3x2" checked> 3 × 2</label><label><input type="checkbox" value="3x3"> 3 × 3</label><label><input type="checkbox" value="3x4"> 3 × 4</label>',
  'admin allowed 3x4');
adminHtml = replaceOnce(adminHtml,
  '<label><input type="checkbox" value="4x1" checked> 4 × 1</label><label><input type="checkbox" value="4x2" checked> 4 × 2</label><label><input type="checkbox" value="4x3"> 4 × 3</label>',
  '<label><input type="checkbox" value="4x1" checked> 4 × 1</label><label><input type="checkbox" value="4x2" checked> 4 × 2</label><label><input type="checkbox" value="4x3"> 4 × 3</label><label><input type="checkbox" value="4x4"> 4 × 4</label>',
  'admin allowed 4x4');
adminHtml = replaceOnce(adminHtml,
  '<label><input type="checkbox" value="5x1"> 5 × 1</label><label><input type="checkbox" value="5x2"> 5 × 2</label><label><input type="checkbox" value="5x3"> 5 × 3</label>',
  '<label><input type="checkbox" value="5x1"> 5 × 1</label><label><input type="checkbox" value="5x2"> 5 × 2</label><label><input type="checkbox" value="5x3"> 5 × 3</label><label><input type="checkbox" value="5x4"> 5 × 4</label>',
  'admin allowed 5x4');
fs.writeFileSync('public/admin-dashboard.html', adminHtml);
