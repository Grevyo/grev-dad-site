#!/usr/bin/env node
// The website's tile engine (public/app/tiles.js) must use the same grid rules as the server
// (src/profile.ts) and the same controller buttons as Grev Home's tile editor.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const server = await readFile('src/profile.ts', 'utf8');
const constant = (name) => Number(server.match(new RegExp(`export const ${name} = (\\d+);`))?.[1]);

const { GRID, blankTile } = await import(new URL('../public/app/tiles.js', import.meta.url));

assert.equal(GRID.columns, constant('GRID_COLUMNS'), 'grid columns match the server');
assert.equal(GRID.maxY, constant('MAX_GRID_Y'), 'maximum row matches the server');
assert.equal(GRID.maxW, constant('MAX_TILE_WIDTH'), 'maximum tile width matches the server');
assert.equal(GRID.maxH, constant('MAX_TILE_HEIGHT'), 'maximum tile height matches the server');
assert.equal(GRID.maxTiles, constant('MAX_TILES'), 'tile limit matches the server');
assert.deepEqual([GRID.cardW, GRID.cardH], [4, 6], 'profile card is 4×6, as in src/site-api.ts and Grev Home');

const tile = blankTile();
assert.match(tile.tileId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, 'new tiles get v4 UUIDs');
for (const key of ['tileType', 'x', 'y', 'width', 'height', 'backgroundType', 'backgroundPrimary', 'textColour', 'borderColour', 'fontFamily', 'mediaFit', 'mediaOverlay', 'widget', 'widgetConfig']) {
  assert.ok(key in tile, `new tiles include ${key}`);
}
assert.ok(tile.width >= 1 && tile.width <= GRID.maxW && tile.height >= 1 && tile.height <= GRID.maxH, 'default size is within limits');

// Controller mapping (standard gamepad layout) matches Grev Home: D-pad moves, A accept, B back,
// X resize, Y edit, View remove, LB/RB undo/redo, Menu save.
const engine = await readFile('public/app/tiles.js', 'utf8');
const pad = engine.match(/const PAD = (\{[^}]+\});/)?.[1];
assert.ok(pad, 'tiles.js declares its gamepad map');
const map = Function(`return ${pad}`)();
assert.deepEqual(map, { 12: 'up', 13: 'down', 14: 'left', 15: 'right', 0: 'accept', 1: 'back', 2: 'resize', 3: 'edit', 8: 'remove', 4: 'undo', 5: 'redo', 9: 'save' });

console.log('Tile engine passed: grid limits match the server, new tiles are valid, and controller buttons match Grev Home.');
