#!/usr/bin/env node
// Regression test for the profile tile grid contract (src/profile.ts): dimensions, per-type
// requirements, UUID format, colours and collision detection. This bundles and calls the REAL
// exported server functions (tileFromInput/validPlacement/overlaps + the grid constants) rather
// than a re-typed copy of the rules, so a change to the actual contract fails this test directly.
//
// This is the grev.dad side of the "two tile systems accidentally mixed together" regression the
// C# side hit once already (see GrevHome's docs/PROFILE_TILES.md) - Grev Home's
// ProfileTileGrid.Validate is meant to enforce the exact same rules this asserts against the real
// TS implementation. There is currently no way to run that C# code from here (no .NET toolchain in
// this environment - see tests/ProfileTiles in the Grev Home repo), so this only proves the
// grev.dad side is internally consistent; a human/CI run on Windows is still needed to prove the
// two sides genuinely agree.

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

async function main() {
  const workdir = await mkdtemp(join(tmpdir(), 'profile-tile-contract-'));
  const bundle = join(workdir, 'profile.mjs');
  try {
    await build({
      entryPoints: ['src/profile.ts'], bundle: true, platform: 'node', format: 'esm',
      target: 'node22', outfile: bundle, logLevel: 'silent'
    });
    const contract = await import(pathToFileURL(bundle).href);
    const { tileFromInput, validPlacement, overlaps, MAX_TILES, GRID_COLUMNS, MAX_TILE_WIDTH, MAX_GRID_Y, MAX_TILE_HEIGHT } = contract;

    assert.equal(GRID_COLUMNS, 8, 'grid must be 8 columns wide');
    assert.equal(MAX_TILE_WIDTH, 6, 'a tile must never be wider than 6 columns');
    assert.equal(MAX_TILE_HEIGHT, 4, 'a tile must never be taller than 4 rows');
    assert.equal(MAX_GRID_Y, 199, 'the grid must be 200 rows (0-199)');
    assert.equal(MAX_TILES, 40, 'a profile must allow at most 40 tiles');

    const baseTile = overrides => ({
      tileId: '11111111-1111-4111-8111-111111111111',
      tileType: 'text', x: 0, y: 0, width: 2, height: 1,
      title: 'Hello', body: null, linkLabel: null, linkUrl: null, statValue: null,
      backgroundType: 'solid', backgroundPrimary: '#11161d', backgroundSecondary: '#3157c9',
      backgroundAngle: 135, backgroundMedia: null, mediaFit: 'cover', mediaOverlay: 'dark',
      textColour: '#f4f7fb', borderColour: '#394657', fontFamily: 'system',
      ...overrides
    });

    // --- tileFromInput: identity and shape ---
    assert.ok(tileFromInput(baseTile({})), 'a well-formed text tile must be accepted');
    assert.equal(tileFromInput(baseTile({ tileId: 'not-a-uuid' })), null, 'a non-UUID tile ID must be rejected');
    assert.equal(tileFromInput(baseTile({ tileId: '11111111-1111-6111-8111-111111111111' })), null,
      'a UUID must be version 4 (the 3rd group must start with 1-5) to be accepted');
    assert.equal(tileFromInput(baseTile({ tileType: 'nonsense' })), null, 'an unknown tile type must be rejected');

    // --- grid bounds (the reported controller Y-limit bug lives here) ---
    assert.ok(tileFromInput(baseTile({ y: MAX_GRID_Y, height: 1 })), 'a 1-tall tile at y=199 must be accepted (the last valid row)');
    assert.equal(tileFromInput(baseTile({ y: MAX_GRID_Y + 1, height: 1 })), null, 'a tile at y=200 must be rejected - this is the bound the reported controller bug was missing client-side');
    assert.equal(tileFromInput(baseTile({ y: MAX_GRID_Y, height: 2 })), null, 'a 2-tall tile at y=199 would end at row 201 and must be rejected');
    assert.equal(tileFromInput(baseTile({ width: MAX_TILE_WIDTH + 1 })), null, 'a tile wider than 6 columns must be rejected');
    assert.equal(tileFromInput(baseTile({ x: GRID_COLUMNS - 1, width: 2 })), null, 'a tile that runs past column 8 must be rejected');
    assert.equal(tileFromInput(baseTile({ height: MAX_TILE_HEIGHT + 1 })), null, 'a tile taller than 4 rows must be rejected');

    // --- per-type requirements ---
    assert.equal(tileFromInput(baseTile({ tileType: 'link', linkUrl: null })), null, 'a link tile needs a URL');
    assert.equal(tileFromInput(baseTile({ tileType: 'link', linkUrl: 'javascript:alert(1)' })), null, 'a link tile must reject non-http(s) URLs');
    assert.equal(tileFromInput(baseTile({ tileType: 'link', linkUrl: 'ftp://example.com' })), null, 'a link tile must reject ftp URLs');
    assert.ok(tileFromInput(baseTile({ tileType: 'link', linkUrl: 'https://example.com' })), 'a link tile with a valid https URL must be accepted');
    assert.ok(tileFromInput(baseTile({ tileType: 'link', linkUrl: 'http://example.com' })), 'a link tile with a valid http URL must be accepted');

    assert.equal(tileFromInput(baseTile({ tileType: 'stat', statValue: null })), null, 'a stat tile needs a value');
    assert.ok(tileFromInput(baseTile({ tileType: 'stat', statValue: '100%' })), 'a stat tile with a value must be accepted');

    assert.equal(tileFromInput(baseTile({ tileType: 'media', backgroundMedia: null })), null, 'a media tile needs an uploaded picture');
    assert.ok(tileFromInput(baseTile({ tileType: 'media', backgroundType: 'media', backgroundMedia: TINY_PNG_DATA_URL })),
      'a media tile with a valid PNG data URL must be accepted');

    // --- colours / gradient angle ---
    assert.equal(tileFromInput(baseTile({ backgroundPrimary: 'red' })), null, 'a colour must be a #RRGGBB hex value, not a CSS name');
    assert.equal(tileFromInput(baseTile({ backgroundAngle: 361 })), null, 'a gradient angle must be 0-360');
    assert.equal(tileFromInput(baseTile({ backgroundAngle: -1 })), null, 'a negative gradient angle must be rejected');
    assert.ok(tileFromInput(baseTile({ backgroundAngle: 360 })), 'a gradient angle of exactly 360 must be accepted');

    // --- collision detection (overlaps) ---
    const left = { x: 0, y: 0, width: 2, height: 1 };
    const overlapping = { x: 1, y: 0, width: 2, height: 1 };
    const adjacent = { x: 2, y: 0, width: 2, height: 1 };
    assert.ok(overlaps(left, overlapping), 'two tiles sharing a column must be detected as overlapping');
    assert.ok(!overlaps(left, adjacent), 'two tiles that only touch edges must not be treated as overlapping');

    // --- validPlacement (the raw grid-bound check placement/compaction logic relies on) ---
    assert.ok(validPlacement({ x: 0, y: 0, width: MAX_TILE_WIDTH, height: MAX_TILE_HEIGHT, ...zeroExtras() }), 'a tile at the max width and height must be a valid placement');
    assert.ok(!validPlacement({ x: 0, y: 0, width: 9, height: 1, ...zeroExtras() }), 'a 9-wide tile must never be a valid placement');
    assert.ok(!validPlacement({ x: 0, y: 0, width: 1, height: 1.5, ...zeroExtras() }), 'a non-integer height must never be a valid placement');

    console.log('Profile tile contract passed: dimensions, UUIDs, per-type requirements, colours and collision detection all match src/profile.ts.');
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

function zeroExtras() {
  return {
    tileId: '11111111-1111-4111-8111-111111111111', tileType: 'text',
    title: null, body: null, linkLabel: null, linkUrl: null, statValue: null,
    backgroundType: 'solid', backgroundPrimary: '#000000', backgroundSecondary: '#000000',
    backgroundAngle: 0, backgroundMedia: null, mediaFit: 'cover', mediaOverlay: 'none',
    textColour: '#000000', borderColour: '#000000', fontFamily: 'system'
  };
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
