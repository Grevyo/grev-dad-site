import fs from 'node:fs';

const path = 'src/dashboard.ts';
let source = fs.readFileSync(path, 'utf8');
function replaceOnce(before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (source.indexOf(before, index + before.length) >= 0) throw new Error(`Non-unique patch anchor: ${label}`);
  source = source.slice(0, index) + after + source.slice(index + before.length);
}

replaceOnce(
  "const IMAGE_DATA_URL = /^data:image\\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/]+={0,2}$/i;\nconst MAX_TILE_MEDIA_BYTES = 2 * 1024 * 1024;",
  "const IMAGE_DATA_URL = /^data:image\\/(png|jpeg|webp|gif);base64,([a-z0-9+/]+={0,2})$/i;\nconst MAX_TILE_MEDIA_BYTES = 2 * 1024 * 1024;\nconst MAX_LAYOUT_MEDIA_BYTES = 8 * 1024 * 1024;",
  'media constants'
);

replaceOnce(
`function dataUrlByteLength(value: string): number {
  const encoded = value.slice(value.indexOf(',') + 1);
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  return Math.floor(encoded.length * 3 / 4) - padding;
}

function tileAppearanceFromInput`,
`function dataUrlByteLength(value: string): number {
  const encoded = value.slice(value.indexOf(',') + 1);
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  return Math.floor(encoded.length * 3 / 4) - padding;
}

function validImageDataUrl(value: string): boolean {
  const match = value.match(IMAGE_DATA_URL);
  if (!match || dataUrlByteLength(value) > MAX_TILE_MEDIA_BYTES) return false;
  let binary = '';
  try {
    binary = atob(match[2].slice(0, 48));
  } catch {
    return false;
  }
  const bytes = Array.from(binary, character => character.charCodeAt(0));
  const mime = match[1].toLowerCase();
  if (mime === 'png') return bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10';
  if (mime === 'jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'gif') return binary.startsWith('GIF87a') || binary.startsWith('GIF89a');
  if (mime === 'webp') return binary.startsWith('RIFF') && binary.slice(8, 12) === 'WEBP';
  return false;
}

function tileAppearanceFromInput`,
  'image signature validation helper'
);

replaceOnce(
  "  if (backgroundMediaValue && (!IMAGE_DATA_URL.test(backgroundMediaValue) || dataUrlByteLength(backgroundMediaValue) > MAX_TILE_MEDIA_BYTES)) return null;",
  "  if (backgroundMediaValue && !validImageDataUrl(backgroundMediaValue)) return null;",
  'media validation use'
);

replaceOnce(
  "  const seen = new Set<string>();\n  const tiles: TilePlacement[] = [];",
  "  const seen = new Set<string>();\n  const tiles: TilePlacement[] = [];\n  let totalMediaBytes = 0;",
  'media total counter'
);

replaceOnce(
`    if (!appearance) return secureJson({ ok: false, message: 'Choose a valid tile background, text colour, font, border and media file.' }, { status: 400 });
    const tile: TilePlacement = {`,
`    if (!appearance) return secureJson({ ok: false, message: 'Choose a valid tile background, text colour, font, border and media file.' }, { status: 400 });
    if (appearance.backgroundMedia) {
      totalMediaBytes += dataUrlByteLength(appearance.backgroundMedia);
      if (totalMediaBytes > MAX_LAYOUT_MEDIA_BYTES) return secureJson({ ok: false, message: 'Tile pictures and GIFs may use up to 8 MB across one dashboard layout.' }, { status: 400 });
    }
    const tile: TilePlacement = {`,
  'layout media total enforcement'
);

fs.writeFileSync(path, source);
console.log('Tile media validation hardened.');
