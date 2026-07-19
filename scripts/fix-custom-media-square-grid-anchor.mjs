import fs from 'node:fs';

const path = 'scripts/patch-custom-media-buttons-square-grid.mjs';
let source = fs.readFileSync(path, 'utf8');
const before = `  source = replaceOnce(
    source,
    "document.querySelectorAll('[data-move-x][data-move-y]').forEach(button => {",
    "let dashboardResizeTimer = null;\\nwindow.addEventListener('resize', () => {\\n  clearTimeout(dashboardResizeTimer);\\n  dashboardResizeTimer = setTimeout(() => {\\n    if (dashboardState.payload) renderDashboardGrid();\\n  }, 80);\\n});\\n\\ndocument.querySelectorAll('[data-move-x][data-move-y]').forEach(button => {",
    'square grid resize handling'
  );`;
const after = `  source = replaceOnce(
    source,
    "window.addEventListener('resize', () => {\\n  if (!dashboardState.editing) return;\\n  renderEditor();\\n  editorMessage(isSingleColumnFallback()\\n    ? 'Single-column preview: the visual order follows saved row and column coordinates. Exact horizontal placement requires a wider screen.'\\n    : 'Wide-grid editing restored. Drag tiles or move them one cell at a time.');\\n});",
    "window.addEventListener('resize', () => {\\n  if (!dashboardState.payload) return;\\n  if (!dashboardState.editing) {\\n    renderDashboardGrid();\\n    return;\\n  }\\n  renderEditor();\\n  editorMessage(isSingleColumnFallback()\\n    ? 'Single-column preview: the visual order follows saved row and column coordinates. Exact horizontal placement requires a wider screen.'\\n    : 'Wide-grid editing restored. Drag tiles or move them one cell at a time.');\\n});",
    'square grid resize handling'
  );`;
if (!source.includes(before)) throw new Error('Expected resize patch block was not found.');
source = source.replace(before, after);
fs.writeFileSync(path, source);
console.log('Square-grid resize patch anchor corrected.');
