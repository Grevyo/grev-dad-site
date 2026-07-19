import fs from 'node:fs';

const path = 'scripts/patch-custom-media-buttons-square-grid.mjs';
let source = fs.readFileSync(path, 'utf8');
let changed = false;

const resizeBefore = `  source = replaceOnce(
    source,
    "document.querySelectorAll('[data-move-x][data-move-y]').forEach(button => {",
    "let dashboardResizeTimer = null;\\nwindow.addEventListener('resize', () => {\\n  clearTimeout(dashboardResizeTimer);\\n  dashboardResizeTimer = setTimeout(() => {\\n    if (dashboardState.payload) renderDashboardGrid();\\n  }, 80);\\n});\\n\\ndocument.querySelectorAll('[data-move-x][data-move-y]').forEach(button => {",
    'square grid resize handling'
  );`;
const resizeAfter = `  source = replaceOnce(
    source,
    "window.addEventListener('resize', () => {\\n  if (!dashboardState.editing) return;\\n  renderEditor();\\n  editorMessage(isSingleColumnFallback()\\n    ? 'Single-column preview: the visual order follows saved row and column coordinates. Exact horizontal placement requires a wider screen.'\\n    : 'Wide-grid editing restored. Drag tiles or move them one cell at a time.');\\n});",
    "window.addEventListener('resize', () => {\\n  if (!dashboardState.payload) return;\\n  if (!dashboardState.editing) {\\n    renderDashboardGrid();\\n    return;\\n  }\\n  renderEditor();\\n  editorMessage(isSingleColumnFallback()\\n    ? 'Single-column preview: the visual order follows saved row and column coordinates. Exact horizontal placement requires a wider screen.'\\n    : 'Wide-grid editing restored. Drag tiles or move them one cell at a time.');\\n});",
    'square grid resize handling'
  );`;
if (source.includes(resizeBefore)) {
  source = source.replace(resizeBefore, resizeAfter);
  changed = true;
}

const oldExactServerBlock = `  source = replaceOnce(
    source,
    "       COALESCE((\\n         SELECT GROUP_CONCAT",
    "       t.content_mode,\\n       t.custom_title,\\n       t.custom_icon,\\n       t.media_fit,\\n       t.media_overlay,\\n       COALESCE((\\n         SELECT GROUP_CONCAT",
    'accessible feature custom columns'
  );`;
const regexServerBlock = `  {\n    const accessibleColumnsPattern = /(\\n\\s*t\\.border_colour,\\n)(\\s*COALESCE\\(\\()/;\n    if (!accessibleColumnsPattern.test(source)) throw new Error('Missing accessible feature custom column insertion point.');\n    source = source.replace(accessibleColumnsPattern, '$1       t.content_mode,\\n       t.custom_title,\\n       t.custom_icon,\\n       t.media_fit,\\n       t.media_overlay,\\n$2');\n  }`;
if (source.includes(oldExactServerBlock)) {
  source = source.replace(oldExactServerBlock, regexServerBlock);
  changed = true;
}

const oldSaveBlock = `  source = replaceOnce(
    source,
    "INSERT INTO user_dashboard_tiles(user_id,feature_id,position,size,grid_x,grid_y,tile_width,tile_height,tile_colour,background_type,background_primary,background_secondary,background_angle,background_media,text_colour,font_family,border_colour,pinned_at,updated_at)\\n       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    "INSERT INTO user_dashboard_tiles(user_id,feature_id,position,size,grid_x,grid_y,tile_width,tile_height,tile_colour,background_type,background_primary,background_secondary,background_angle,background_media,text_colour,font_family,border_colour,content_mode,custom_title,custom_icon,media_fit,media_overlay,pinned_at,updated_at)\\n       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    'save custom content columns'
  );`;
const regexSaveBlock = `  {\n    const saveInsertPattern = /(INSERT INTO user_dashboard_tiles\\([^\\n]*border_colour),pinned_at,updated_at\\)(\\n\\s*)VALUES\\(\\?,\\?,\\?,\\?,\\?,\\?,\\?,\\?,\\?,\\?,\\?,\\?,\\?,\\?,\\?,\\?,\\?,\\?,\\?\\)/;\n    if (!saveInsertPattern.test(source)) throw new Error('Missing dashboard tile insert statement.');\n    source = source.replace(saveInsertPattern, '$1,content_mode,custom_title,custom_icon,media_fit,media_overlay,pinned_at,updated_at)$2VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');\n  }`;
if (source.includes(oldSaveBlock)) {
  source = source.replace(oldSaveBlock, regexSaveBlock);
  changed = true;
}

if (!changed && !source.includes('accessibleColumnsPattern') && !source.includes('saveInsertPattern')) throw new Error('No custom media patch anchors were available to correct.');
fs.writeFileSync(path, source);
console.log('Custom media patch anchors corrected.');
