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

const oldServerBlock = `  source = replaceOnce(
    source,
    "t.border_colour,\\n       COALESCE((",
    "       t.border_colour,\\n       t.content_mode,\\n       t.custom_title,\\n       t.custom_icon,\\n       t.media_fit,\\n       t.media_overlay,\\n       COALESCE((",
    'accessible feature custom columns'
  );`;
const newServerBlock = `  source = replaceOnce(
    source,
    "       COALESCE((\\n         SELECT GROUP_CONCAT",
    "       t.content_mode,\\n       t.custom_title,\\n       t.custom_icon,\\n       t.media_fit,\\n       t.media_overlay,\\n       COALESCE((\\n         SELECT GROUP_CONCAT",
    'accessible feature custom columns'
  );`;
if (source.includes(oldServerBlock)) {
  source = source.replace(oldServerBlock, newServerBlock);
  changed = true;
}

if (!changed && !source.includes(newServerBlock)) throw new Error('No custom media patch anchors were available to correct.');
fs.writeFileSync(path, source);
console.log('Custom media patch anchors corrected.');
