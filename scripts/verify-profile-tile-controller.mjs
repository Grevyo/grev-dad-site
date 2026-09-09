#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile('public/profile-tile-controller.js', 'utf8');
const messages = [];
let idCounter = 1;

const profileState = { editing: true, working: { tiles: [] }, selectedId: null };
const PROFILE_COLUMNS = 8;
const PROFILE_MAX_WIDTH = 6;
const PROFILE_MAX_HEIGHT = 4;
const PROFILE_MAX_GRID_Y = 199;
const PROFILE_MAX_TILES = 40;

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function validProfilePlacement(candidate, ignoreId = null) {
  if (candidate.x < 0 || candidate.y < 0 || candidate.y > PROFILE_MAX_GRID_Y ||
      candidate.width < 1 || candidate.width > PROFILE_MAX_WIDTH ||
      candidate.height < 1 || candidate.height > PROFILE_MAX_HEIGHT ||
      candidate.x + candidate.width > PROFILE_COLUMNS ||
      candidate.y + candidate.height > PROFILE_MAX_GRID_Y + 1) return false;
  return !profileState.working.tiles.some(tile => tile.tileId !== ignoreId && overlaps(candidate, tile));
}

function firstFree(width, height) {
  for (let y = 0; y <= PROFILE_MAX_GRID_Y; y += 1) {
    for (let x = 0; x <= PROFILE_COLUMNS - width; x += 1) {
      const candidate = { x, y, width, height };
      if (validProfilePlacement(candidate)) return candidate;
    }
  }
  throw new Error('fixture grid unexpectedly full');
}

function profileTileDefaults(type) {
  const [width, height] = { text: [3, 2], link: [2, 1], media: [3, 2], stat: [2, 1] }[type];
  return {
    tileId: `11111111-1111-4111-8111-${String(idCounter++).padStart(12, '0')}`,
    tileType: type,
    ...firstFree(width, height),
    title: type === 'text' ? 'About me' : type === 'link' ? 'My link' : type === 'stat' ? 'Stat' : null,
    body: type === 'text' ? 'Write something about yourself.' : null,
    linkLabel: type === 'link' ? 'Open link' : null,
    linkUrl: null,
    statValue: type === 'stat' ? '100%' : null,
    backgroundType: type === 'media' ? 'media' : 'solid',
    backgroundPrimary: '#11161d', backgroundSecondary: '#3157c9', backgroundAngle: 135,
    backgroundMedia: null, mediaFit: 'cover', mediaOverlay: 'dark', textColour: '#f4f7fb',
    borderColour: '#394657', fontFamily: 'system'
  };
}

class HTMLElement {}
const context = {
  window: {},
  document: { querySelector: () => null, addEventListener: () => {} },
  navigator: {},
  HTMLElement,
  profileState,
  PROFILE_COLUMNS,
  PROFILE_MAX_WIDTH,
  PROFILE_MAX_HEIGHT,
  PROFILE_MAX_GRID_Y,
  PROFILE_MAX_TILES,
  validProfilePlacement,
  profileTileDefaults,
  renderProfileGrid: () => {},
  profileEditorMessage: (text, type = '') => messages.push({ text, type }),
  requestAnimationFrame: () => 0,
  console
};

vm.runInNewContext(source, context, { filename: 'profile-tile-controller.js' });
const controller = context.window.GrevProfileTileController;
assert.ok(controller, 'controller module must expose GrevProfileTileController');
assert.deepEqual(Array.from(controller.addKinds), ['text', 'link', 'media', 'stat']);

controller.handleAction('right');
controller.handleAction('right');
controller.handleAction('down');
assert.equal(controller.state.cursorX, 2);
assert.equal(controller.state.cursorY, 1);

assert.equal(controller.handleAction('accept'), true, 'Accept on an empty cell must be consumed');
assert.equal(controller.state.mode, 'adding', 'Accept on an empty cell must open the add picker');
assert.match(messages.at(-1).text, /Add tile: Text/);

controller.handleAction('right');
assert.match(messages.at(-1).text, /Add tile: Link/);
controller.handleAction('accept');
assert.equal(profileState.working.tiles.length, 1, 'confirming the picker must create one tile');
assert.equal(profileState.working.tiles[0].tileType, 'link');
assert.equal(profileState.working.tiles[0].x, 2, 'new tile should use the cursor column when it fits');
assert.equal(profileState.working.tiles[0].y, 1, 'new tile should use the cursor row when it fits');
assert.equal(controller.state.mode, 'holding', 'new tile should immediately enter holding mode');
assert.equal(profileState.selectedId, profileState.working.tiles[0].tileId);

controller.handleAction('back');
assert.equal(controller.state.mode, 'browsing', 'Back after adding/moving returns to browsing');

controller.state.cursorX = 0;
controller.state.cursorY = 10;
profileState.working.tiles = Array.from({ length: PROFILE_MAX_TILES }, (_, index) => ({
  tileId: `22222222-2222-4222-8222-${String(index + 1).padStart(12, '0')}`,
  tileType: 'text', x: 7, y: index, width: 1, height: 1
}));
messages.length = 0;
controller.handleAction('accept');
assert.equal(controller.state.mode, 'browsing', 'the 41st tile must not open the add picker');
assert.match(messages.at(-1).text, /up to 40 tiles/);
assert.equal(messages.at(-1).type, 'error');

console.log('Profile tile controller passed: empty-cell add picker, placement and 40-tile limit are controller-safe.');
