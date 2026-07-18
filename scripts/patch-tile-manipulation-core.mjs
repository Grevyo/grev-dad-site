import fs from 'node:fs';

function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Missing patch anchor: ${label}`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}

let source = fs.readFileSync('public/dashboard.js', 'utf8');
source = replaceOnce(source,
`  draggingId: null,
  selectedId: null,
  editing: false`,
`  draggingId: null,
  placementPreview: null,
  resizing: null,
  selectedId: null,
  editing: false`,
'state');

source = replaceOnce(source,
`function gridRowHeight(density) {
  return density === 'compact' ? 92 : 116;
}
`,
`function gridRowHeight(density) {
  return density === 'compact' ? 92 : 116;
}

function gridMetrics() {
  const grid = dashboardElement('#dashboard-grid');
  if (!grid) return null;
  const rect = grid.getBoundingClientRect();
  const preferences = editorPreferences();
  const gap = Number(preferences.tileGap ?? 12);
  const margin = Number(preferences.outerMargin ?? 0);
  const rowHeight = gridRowHeight(preferences.density);
  const innerWidth = Math.max(1, rect.width - margin * 2);
  const cellWidth = Math.max(1, (innerWidth - gap * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
  return { grid, rect, gap, margin, rowHeight, cellWidth };
}

function pointerGridCell(event) {
  const metrics = gridMetrics();
  if (!metrics) return null;
  return {
    x: Math.max(0, Math.min(GRID_COLUMNS - 1, Math.floor((event.clientX - metrics.rect.left - metrics.margin) / (metrics.cellWidth + metrics.gap)))),
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
`,
'grid helpers');

fs.writeFileSync('public/dashboard.js', source);
