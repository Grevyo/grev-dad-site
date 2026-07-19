import fs from 'node:fs';

function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (source.indexOf(before, index + before.length) >= 0) throw new Error(`Non-unique patch anchor: ${label}`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}

let browser = fs.readFileSync('public/dashboard.js', 'utf8');
browser = replaceOnce(
  browser,
  '  return Math.max(64, usableWidth / GRID_COLUMNS);',
  '  return Math.max(1, usableWidth / GRID_COLUMNS);',
  'square cell width clamp'
);
fs.writeFileSync('public/dashboard.js', browser);

let server = fs.readFileSync('src/dashboard.ts', 'utf8');
server = replaceOnce(
  server,
  'const GRID_COLUMNS = 8;\nconst MAX_GRID_Y = 199;',
  'const GRID_COLUMNS = 8;\nconst MAX_TILE_WIDTH = 6;\nconst MAX_GRID_Y = 199;',
  'maximum tile width constant'
);
server = replaceOnce(
  server,
  '  Array.from({ length: GRID_COLUMNS }, (_, widthIndex) => `${widthIndex + 1}x${heightIndex + 1}`)',
  '  Array.from({ length: MAX_TILE_WIDTH }, (_, widthIndex) => `${widthIndex + 1}x${heightIndex + 1}`)',
  'available tile dimensions'
);
server = replaceOnce(
  server,
  '    && tile.width >= 1 && tile.width <= GRID_COLUMNS && tile.height >= 1 && tile.height <= 4',
  '    && tile.width >= 1 && tile.width <= MAX_TILE_WIDTH && tile.height >= 1 && tile.height <= 4',
  'tile width validation'
);
fs.writeFileSync('src/dashboard.ts', server);

console.log('Eight-column position constraints and exact square metrics fixed.');
