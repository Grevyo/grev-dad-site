import fs from 'node:fs';

function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Missing patch anchor: ${label}`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}

let source = fs.readFileSync('public/dashboard.js', 'utf8');
source = replaceOnce(source,
`function editorPreferences() {`,
`function updateResizePreview(event) {
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
  showPlacementPreview(candidate, valid, valid ? \`RESIZE \${dimension.width}×\${dimension.height}\` : 'SIZE BLOCKED');

  const article = tileElement(resize.featureId);
  if (article) {
    article.classList.toggle('resize-blocked', !valid);
    if (valid) {
      article.style.gridColumn = \`\${candidate.x + 1} / span \${candidate.width}\`;
      article.style.gridRow = \`\${candidate.y + 1} / span \${candidate.height}\`;
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
    editorMessage(\`\${feature?.name ?? 'Tile'} resized to \${tile.width}×\${tile.height}.\`, 'success');
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
  showPlacementPreview(tile, true, \`RESIZE \${tile.width}×\${tile.height}\`);
  renderSelectedControls();

  const move = pointerEvent => updateResizePreview(pointerEvent);
  const end = pointerEvent => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
    finishTileResize(pointerEvent);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
}

function editorPreferences() {`,
'resize functions');

fs.writeFileSync('public/dashboard.js', source);
