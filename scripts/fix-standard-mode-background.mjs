import fs from 'node:fs';

const path = 'public/dashboard.js';
let source = fs.readFileSync(path, 'utf8');
const before = `  tile.contentMode = value;
  if (value === 'media-button') tile.backgroundType = 'media';
  refreshAppearancePreview(tile, value === 'media-button' ? 'Custom media button selected. Upload a picture or GIF before saving.' : 'Standard tile content restored.');`;
const after = `  tile.contentMode = value;
  if (value === 'media-button') {
    tile.backgroundType = 'media';
  } else if (tile.backgroundType === 'media' && !tile.backgroundMedia) {
    tile.backgroundType = 'solid';
  }
  refreshAppearancePreview(tile, value === 'media-button' ? 'Custom media button selected. Upload a picture or GIF before saving.' : 'Standard tile content restored.');`;
if (!source.includes(before)) throw new Error('Content-mode switch handler was not found.');
source = source.replace(before, after);
fs.writeFileSync(path, source);
console.log('Standard mode now restores a saveable solid background when no media exists.');
