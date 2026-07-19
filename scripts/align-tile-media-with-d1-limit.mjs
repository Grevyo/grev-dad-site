import fs from 'node:fs';

const files = ['src/dashboard.ts', 'public/dashboard.js', 'public/dashboard.html'];
const replacements = new Map([
  ['const MAX_TILE_MEDIA_BYTES = 2 * 1024 * 1024;', 'const MAX_TILE_MEDIA_BYTES = 1_400_000;'],
  ['Maximum file size: 2 MB.', 'Maximum file size: 1.4 MB.'],
  ['Tile pictures and GIFs must be 2 MB or smaller.', 'Tile pictures and GIFs must be 1.4 MB or smaller.']
]);
for (const path of files) {
  let source = fs.readFileSync(path, 'utf8');
  let changed = false;
  for (const [before, after] of replacements) {
    if (source.includes(before)) {
      source = source.replaceAll(before, after);
      changed = true;
    }
  }
  if (changed) fs.writeFileSync(path, source);
}
console.log('Tile media cap aligned with D1 row limits.');
