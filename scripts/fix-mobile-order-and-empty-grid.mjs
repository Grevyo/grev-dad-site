import fs from 'node:fs';

function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (source.indexOf(before, index + before.length) >= 0) throw new Error(`Non-unique patch anchor: ${label}`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}

let js = fs.readFileSync('public/dashboard.js', 'utf8');
js = replaceOnce(
  js,
  `function packMobileTiles(tiles) {
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
}`,
  `function packMobileTiles(tiles) {
  const packed = [];
  const occupied = [];
  const sorted = [...tiles].sort((a, b) => Number(a.y) - Number(b.y) || Number(a.x) - Number(b.x));
  let cursor = { x: 0, y: 0 };
  for (const tile of sorted) {
    const dimension = mobileTileDimension(tile);
    let location = null;
    for (let y = cursor.y; y < 400 && !location; y += 1) {
      const firstX = y === cursor.y ? cursor.x : 0;
      for (let x = firstX; x <= MOBILE_GRID_COLUMNS - dimension.width; x += 1) {
        const candidate = { x, y, ...dimension };
        if (!occupied.some(existing => overlaps(candidate, existing))) {
          location = candidate;
          break;
        }
      }
    }
    const placement = location ?? { x: 0, y: occupied.reduce((maximum, item) => Math.max(maximum, item.y + item.height), cursor.y), ...dimension };
    occupied.push(placement);
    packed.push({ ...tile, ...placement });
    const nextX = placement.x + placement.width;
    cursor = nextX >= MOBILE_GRID_COLUMNS
      ? { x: 0, y: placement.y + 1 }
      : { x: nextX, y: placement.y };
  }
  return packed;
}`,
  'forward-only mobile packing'
);
js = replaceOnce(
  js,
  `  element.style.setProperty('--tile-row-height', \`${'${squareGridCellSize(element, gap, margin, columns)}'}px\`);
  element.style.gridTemplateRows = \`repeat(${'${rows}'}, var(--tile-row-height))\`;
}`,
  `  element.style.setProperty('--tile-row-height', \`${'${squareGridCellSize(element, gap, margin, columns)}'}px\`);
  element.style.gridTemplateRows = rows > 0 ? \`repeat(${'${rows}'}, var(--tile-row-height))\` : 'none';
}`,
  'zero-row grid surface'
);
js = replaceOnce(
  js,
  `  const rows = dashboardRows(tiles, dashboardState.editing ? 2 : 0);
  grid.className = \`dashboard-tile-grid dashboard-grid ${'${preferences.density}'}${'${dashboardState.editing ? \' editing-grid\' : \'\'}'}\`;`,
  `  const rows = tiles.length || dashboardState.editing ? dashboardRows(tiles, dashboardState.editing ? 2 : 0) : 0;
  grid.className = \`dashboard-tile-grid dashboard-grid ${'${preferences.density}'}${'${dashboardState.editing ? \' editing-grid\' : \'\'}'}${'${!tiles.length && !dashboardState.editing ? \' empty-grid\' : \'\'}'}\`;`,
  'empty grid row count and class'
);
fs.writeFileSync('public/dashboard.js', js);

let css = fs.readFileSync('public/dashboard.css', 'utf8');
const marker = `@media(max-width:900px){
  .dashboard-tile-grid{margin-top:16px}`;
const replacement = `@media(max-width:900px){
  .dashboard-tile-grid{margin-top:16px}
  .dashboard-tile-grid.empty-grid{min-height:0;margin-top:0;padding:0}`;
css = replaceOnce(css, marker, replacement, 'mobile empty grid styling');
fs.writeFileSync('public/dashboard.css', css);

console.log('Mobile order and empty-grid fixes applied.');
