import fs from 'node:fs';

function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Missing patch anchor: ${label}`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}

let source = fs.readFileSync('public/dashboard.js', 'utf8');
source = replaceOnce(source,
`function dropCoordinates(event, tile) {
  const grid = dashboardElement('#dashboard-grid');
  if (!grid) return null;
  const rect = grid.getBoundingClientRect();
  const preferences = editorPreferences();
  const gap = Number(preferences.tileGap ?? 12);
  const margin = Number(preferences.outerMargin ?? 0);
  const rowHeight = gridRowHeight(preferences.density);
  const innerWidth = Math.max(1, rect.width - margin * 2);
  const cellWidth = (innerWidth - gap * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
  const localX = event.clientX - rect.left - margin;
  const localY = event.clientY - rect.top - margin;
  const x = Math.max(0, Math.min(GRID_COLUMNS - tile.width, Math.floor(localX / (cellWidth + gap))));
  const y = Math.max(0, Math.floor(localY / (rowHeight + gap)));
  return { x, y };
}`,
`function dropCoordinates(event, tile) {
  const cell = pointerGridCell(event);
  if (!cell) return null;
  return { x: Math.max(0, Math.min(GRID_COLUMNS - tile.width, cell.x)), y: cell.y };
}`,
'drop coordinates');

const before = `const dashboardGrid = dashboardElement('#dashboard-grid');
dashboardGrid?.addEventListener('dragover', event => {
  if (!dashboardState.editing || isSingleColumnFallback()) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
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
  if (!placementIsFree(candidate, featureId)) {
    editorMessage('That grid area is already occupied. Drop the tile onto empty cells.', 'error');
    return;
  }
  Object.assign(tile, candidate);
  dashboardState.selectedId = featureId;
  editorMessage(\`Moved to column \${tile.x + 1}, row \${tile.y + 1}. Blank cells were left in place.\`, 'success');
  renderEditor();
});`;

const after = `const dashboardGrid = dashboardElement('#dashboard-grid');
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
  editorMessage(\`Moved to column \${tile.x + 1}, row \${tile.y + 1}. Blank cells were left in place.\`, 'success');
  renderEditor();
});`;

source = replaceOnce(source, before, after, 'drag events');
fs.writeFileSync('public/dashboard.js', source);
