#!/usr/bin/env node
// Regression test for the Grev Home <-> grev.dad profile tile sync endpoints
// (GET/PUT /api/grev-home/profile-tiles in src/grev-home-sync.ts), exercised the same way
// scripts/verify-grev-home-link-contract.mjs exercises the rest of the Grev Home API: bundle the
// real handler with esbuild and run it against an in-memory SQLite database standing in for D1.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';

class TestStatement {
  #database; #query; #values = [];
  constructor(database, query) { this.#database = database; this.#query = query; }
  bind(...values) { this.#values = values; return this; }
  async first() { return this.#database.prepare(this.#query).get(...this.#values) ?? null; }
  async all() { return { results: this.#database.prepare(this.#query).all(...this.#values) }; }
  async run() { return this.#database.prepare(this.#query).run(...this.#values); }
}

class TestDatabase {
  constructor(database) { this.database = database; }
  prepare(query) { return new TestStatement(this.database, query); }
  async batch(statements) {
    const results = [];
    this.database.exec('BEGIN');
    try {
      for (const statement of statements) results.push(await statement.run());
      this.database.exec('COMMIT');
      return results;
    } catch (error) { this.database.exec('ROLLBACK'); throw error; }
  }
}

function tokenHash(value) { return createHash('sha256').update(value).digest('base64url'); }

async function readJson(response) { return response.json(); }

async function main() {
  const workdir = await mkdtemp(join(tmpdir(), 'profile-tile-sync-'));
  const bundle = join(workdir, 'grev-home-sync.mjs');
  try {
    await build({
      entryPoints: ['src/grev-home-sync.ts'], bundle: true, platform: 'node', format: 'esm',
      target: 'node22', outfile: bundle, logLevel: 'silent'
    });
    const { handleGrevHomeSyncRequest } = await import(pathToFileURL(bundle).href);

    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT NOT NULL, display_name TEXT NOT NULL,
        is_verified INTEGER NOT NULL DEFAULT 0, is_owner INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active');
      CREATE TABLE grev_home_links (id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
        grev_id TEXT NOT NULL, local_username TEXT NOT NULL, local_display_name TEXT NOT NULL,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, last_seen_at INTEGER, revoked_at INTEGER);
      CREATE TABLE grev_home_tokens (id TEXT PRIMARY KEY, link_id TEXT NOT NULL REFERENCES grev_home_links(id),
        token_hash TEXT NOT NULL UNIQUE, device_name TEXT NOT NULL DEFAULT '', local_grev_id TEXT,
        created_at INTEGER NOT NULL, last_used_at INTEGER, expires_at INTEGER NOT NULL, revoked_at INTEGER);
      CREATE TABLE user_profile_tiles (user_id TEXT NOT NULL REFERENCES users(id), tile_id TEXT NOT NULL,
        tile_type TEXT NOT NULL, position INTEGER NOT NULL, grid_x INTEGER NOT NULL, grid_y INTEGER NOT NULL,
        tile_width INTEGER NOT NULL, tile_height INTEGER NOT NULL, title TEXT, body TEXT, link_label TEXT,
        link_url TEXT, stat_value TEXT, background_type TEXT NOT NULL DEFAULT 'solid',
        background_primary TEXT NOT NULL DEFAULT '#11161d', background_secondary TEXT NOT NULL DEFAULT '#3157c9',
        background_angle INTEGER NOT NULL DEFAULT 135, background_media TEXT, media_fit TEXT NOT NULL DEFAULT 'cover',
        media_overlay TEXT NOT NULL DEFAULT 'dark', text_colour TEXT NOT NULL DEFAULT '#f4f7fb',
        border_colour TEXT NOT NULL DEFAULT '#394657', font_family TEXT NOT NULL DEFAULT 'system',
        updated_at INTEGER NOT NULL, PRIMARY KEY(user_id, tile_id));
    `);

    const now = Math.floor(Date.now() / 1000);
    sqlite.prepare(`INSERT INTO users(id,username,display_name) VALUES(?,?,?)`).run('user-1', 'joe', 'Joe');
    sqlite.prepare(`INSERT INTO grev_home_links(id,user_id,grev_id,local_username,local_display_name,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?)`).run('link-1', 'user-1', 'GTESTLOCAL', 'joe', 'Joe', now, now);
    const rawToken = 'test-device-token';
    sqlite.prepare(`INSERT INTO grev_home_tokens(id,link_id,token_hash,local_grev_id,created_at,expires_at)
      VALUES(?,?,?,?,?,?)`).run('token-1', 'link-1', tokenHash(rawToken), 'GTESTLOCAL', now, now + 86400);

    const db = new TestDatabase(sqlite);
    const env = { DB: db, APP_ENV: 'development' };
    const authed = (method, body) => handleGrevHomeSyncRequest(new Request('https://grev.dad/api/grev-home/profile-tiles', {
      method,
      headers: { Authorization: `Bearer ${rawToken}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined
    }), env);

    // --- unauthenticated request must be rejected ---
    const unauthed = await handleGrevHomeSyncRequest(
      new Request('https://grev.dad/api/grev-home/profile-tiles', { method: 'GET' }), env);
    assert.equal(unauthed.status, 401, 'a request with no bearer token must be rejected');

    // --- GET with no saved tiles returns an empty layout, updatedAt 0 (fresh-install restore path) ---
    const empty = await readJson(await authed('GET'));
    assert.deepEqual(empty.tiles, [], 'a profile with no tiles must return an empty tile list');
    assert.equal(empty.updatedAt, 0, 'an empty layout must report updatedAt 0 so a fresh device always pulls the cloud layout');

    const tile = {
      tileId: '11111111-1111-4111-8111-111111111111', tileType: 'text', x: 0, y: 0, width: 2, height: 1,
      title: 'Hello', body: null, linkLabel: null, linkUrl: null, statValue: null,
      backgroundType: 'solid', backgroundPrimary: '#11161d', backgroundSecondary: '#3157c9',
      backgroundAngle: 135, backgroundMedia: null, mediaFit: 'cover', mediaOverlay: 'dark',
      textColour: '#f4f7fb', borderColour: '#394657', fontFamily: 'system'
    };

    // --- PUT saves and returns the layout with a fresh updatedAt ---
    const saved = await readJson(await authed('PUT', { tiles: [tile] }));
    assert.equal(saved.ok, true, 'a valid tile layout must be accepted');
    assert.equal(saved.tiles.length, 1, 'the saved layout must contain the submitted tile');
    assert.ok(saved.updatedAt > 0, 'a saved layout must report a real updatedAt timestamp');

    // --- GET reflects what PUT just saved ---
    const reloaded = await readJson(await authed('GET'));
    assert.equal(reloaded.tiles.length, 1, 'GET must reflect a layout PUT just saved');
    assert.equal(reloaded.tiles[0].tileId, tile.tileId, 'the round-tripped tile must keep its ID');
    assert.equal(reloaded.updatedAt, saved.updatedAt, 'GET and PUT must agree on the layout timestamp');

    // --- an invalid layout (overlapping tiles) must be rejected, not partially saved ---
    const overlapping = { ...tile, tileId: '22222222-2222-4222-8222-222222222222' };
    const rejected = await readJson(await authed('PUT', { tiles: [tile, overlapping] }));
    assert.equal(rejected.ok, false, 'an overlapping layout must be rejected');
    const stillOneTile = await readJson(await authed('GET'));
    assert.equal(stillOneTile.tiles.length, 1, 'a rejected PUT must not touch the previously saved layout');

    // --- the shared contract (40-tile cap etc.) is enforced on this path too, not just /api/profile ---
    const tooMany = Array.from({ length: 41 }, (_, index) => ({
      ...tile, tileId: `33333333-3333-4333-8333-${String(index).padStart(12, '0')}`, x: index % 8, y: index
    }));
    const overLimit = await readJson(await authed('PUT', { tiles: tooMany }));
    assert.equal(overLimit.ok, false, 'more than 40 tiles must be rejected on the sync path exactly as on /api/profile');

    console.log('Profile tile sync passed: auth, empty-layout restore signal, save/round-trip, and shared validation on the sync path.');
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
