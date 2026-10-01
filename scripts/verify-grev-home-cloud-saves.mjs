#!/usr/bin/env node

// Contract test for Grev Home cloud saves (src/grev-home-saves.ts) against the exact shape
// Grev Home's GrevDadSaveSyncService expects: X-Grev-Content-SHA256 on upload/download,
// X-Grev-Updated-At on HEAD/GET, and { ok, apiVersion, exists, sizeBytes, updatedAtUtc } JSON.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';

class TestStatement {
  constructor(database, query) { this.database = database; this.query = query; this.values = []; }
  bind(...values) { this.values = values; return this; }
  async first() { return this.database.prepare(this.query).get(...this.values) ?? null; }
  async all() { return { results: this.database.prepare(this.query).all(...this.values) }; }
  async run() { return this.database.prepare(this.query).run(...this.values); }
}

class TestDatabase {
  constructor(database) { this.database = database; }
  prepare(query) { return new TestStatement(this.database, query); }
  async batch(statements) {
    this.database.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.database.exec('COMMIT');
      return results;
    } catch (error) { this.database.exec('ROLLBACK'); throw error; }
  }
  withSession() { return { prepare: q => this.prepare(q), batch: s => this.batch(s), getBookmark: () => null }; }
}

// In-memory R2 stand-in that, like R2, refuses a put whose bytes do not match options.sha256.
class TestBucket {
  objects = new Map();
  async put(key, value, options = {}) {
    const bytes = value instanceof ReadableStream ? new Uint8Array(await new Response(value).arrayBuffer()) : new Uint8Array(value);
    if (options.sha256 && createHash('sha256').update(bytes).digest('hex') !== options.sha256.toLowerCase()) {
      throw new Error('BadDigest');
    }
    this.objects.set(key, bytes);
    return { key };
  }
  async get(key) {
    const bytes = this.objects.get(key);
    return bytes ? { body: new Response(bytes).body, size: bytes.byteLength } : null;
  }
  async delete(key) { for (const k of [key].flat()) this.objects.delete(k); }
}

const tokenHash = value => createHash('sha256').update(value).digest('base64url');
const hex = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();

const buildDirectory = await mkdtemp(join(tmpdir(), 'grev-home-cloud-saves-'));
try {
  for (const [entry, out] of [['src/grev-home-saves.ts', 'saves.mjs'], ['src/grev-home-capabilities.ts', 'capabilities.mjs']]) {
    await build({ entryPoints:[entry], bundle:true, platform:'node', format:'esm', target:'node22', outfile:join(buildDirectory, out), logLevel:'silent' });
  }
  const { handleGrevHomeSavesRequest } = await import(pathToFileURL(join(buildDirectory, 'saves.mjs')).href);
  const { handleGrevHomeCapabilitiesRequest } = await import(pathToFileURL(join(buildDirectory, 'capabilities.mjs')).href);

  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT NOT NULL, display_name TEXT NOT NULL,
      is_verified INTEGER NOT NULL DEFAULT 0, is_owner INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active');
    CREATE TABLE user_roles (user_id TEXT NOT NULL, role_id TEXT NOT NULL);
    CREATE TABLE grev_home_links (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, grev_id TEXT NOT NULL,
      local_username TEXT NOT NULL, local_display_name TEXT NOT NULL, revoked_at INTEGER, last_seen_at INTEGER, updated_at INTEGER);
    CREATE TABLE grev_home_tokens (id TEXT PRIMARY KEY, link_id TEXT NOT NULL, token_hash TEXT NOT NULL,
      local_grev_id TEXT, expires_at INTEGER NOT NULL, revoked_at INTEGER, last_used_at INTEGER);
    CREATE TABLE grev_home_profile_sources (grev_id TEXT PRIMARY KEY COLLATE NOCASE, user_id TEXT NOT NULL,
      local_username TEXT NOT NULL DEFAULT '', local_display_name TEXT NOT NULL DEFAULT '');
  `);
  sqlite.exec(await readFile('migrations/20261001_grev_home_cloud_saves.sql', 'utf8'));

  const far = Math.floor(Date.now() / 1000) + 86400;
  const seed = (userId, linkId, devices) => {
    sqlite.prepare(`INSERT INTO users(id,username,display_name) VALUES(?,?,?)`).run(userId, userId.slice(0, 4), 'User');
    sqlite.prepare(`INSERT INTO grev_home_links(id,user_id,grev_id,local_username,local_display_name) VALUES(?,?,?,?,?)`)
      .run(linkId, userId, devices[0].grevId, 'Grev', 'Grev');
    for (const device of devices) {
      sqlite.prepare(`INSERT INTO grev_home_profile_sources(grev_id,user_id) VALUES(?,?)`).run(device.grevId, userId);
      sqlite.prepare(`INSERT INTO grev_home_tokens(id,link_id,token_hash,local_grev_id,expires_at) VALUES(?,?,?,?,?)`)
        .run(crypto.randomUUID(), linkId, tokenHash(device.token), device.grevId, far);
    }
  };
  const alice = '10000000-0000-4000-8000-000000000001';
  const bob = '20000000-0000-4000-8000-000000000002';
  seed(alice, '30000000-0000-4000-8000-000000000003', [
    { grevId:'GABCDGrevXYZ', token:'alice-pc-1' },
    { grevId:'GHJKLGrevMNP', token:'alice-pc-2' }
  ]);
  seed(bob, '40000000-0000-4000-8000-000000000004', [{ grevId:'GQRSTBobUVW', token:'bob-pc' }]);

  const bucket = new TestBucket();
  const env = { DB:new TestDatabase(sqlite), APP_ENV:'development', GREV_HOME_SAVES:bucket };
  const url = app => `https://grev.test/api/grev-home/saves/${app}`;
  const send = (method, app, token, init = {}, environment = env) =>
    handleGrevHomeSavesRequest(new Request(url(app), {
      method,
      headers:{ ...(token ? { Authorization:`Bearer ${token}` } : {}), ...(init.headers ?? {}) },
      body:init.body,
      duplex:init.body ? 'half' : undefined
    }), environment);
  const upload = (token, bytes, hash = hex(bytes), extraHeaders = {}) => send('PUT', 'retroarch', token, {
    body:bytes,
    headers:{ 'Content-Type':'application/zip', 'Content-Length':String(bytes.byteLength), 'X-Grev-Content-SHA256':hash, ...extraHeaders }
  });

  // Routing and auth.
  assert.equal(await handleGrevHomeSavesRequest(new Request('https://grev.test/api/grev-home/friends'), env), null);
  assert.equal((await send('GET', 'retroarch', null)).status, 401, 'saves require a device token');
  assert.equal((await send('GET', 'bad%20id', 'alice-pc-1')).status, 400, 'unsafe app ids are rejected');
  assert.equal((await send('DELETE', 'retroarch', 'alice-pc-1')).status, 405);

  // Nothing uploaded yet: HEAD and GET are 404 (Grev Home reads that as "no cloud save").
  const missingHead = await send('HEAD', 'retroarch', 'alice-pc-1');
  assert.equal(missingHead.status, 404);
  assert.equal(await missingHead.text(), '');
  assert.equal((await send('GET', 'retroarch', 'alice-pc-1')).status, 404);

  // Upload validation never replaces anything.
  const first = new TextEncoder().encode('PK first save archive');
  assert.equal((await upload('alice-pc-1', first, 'nothex')).status, 400, 'hash header is required');
  assert.equal((await upload('alice-pc-1', first, hex(new Uint8Array([1])))).status, 400, 'checksum mismatch rejected');
  assert.equal((await upload('alice-pc-1', first, hex(first), { 'Content-Length':String(96 * 1024 * 1024) })).status, 413);
  assert.equal(bucket.objects.size, 0, 'rejected uploads leave no archive behind');
  assert.equal((await send('HEAD', 'retroarch', 'alice-pc-1')).status, 404);

  // A real upload.
  const put1 = await upload('alice-pc-1', first);
  assert.equal(put1.status, 200);
  const body1 = await put1.json();
  assert.deepEqual(Object.keys(body1).sort(), ['apiVersion', 'exists', 'ok', 'sizeBytes', 'updatedAtUtc']);
  assert.equal(body1.ok, true);
  assert.equal(body1.apiVersion, 1);
  assert.equal(body1.sizeBytes, first.byteLength);
  assert.ok(!Number.isNaN(Date.parse(body1.updatedAtUtc)), 'updatedAtUtc must be an ISO timestamp');

  // HEAD reports the same timestamp the upload returned, so the uploader sees "up to date".
  const head1 = await send('HEAD', 'retroarch', 'alice-pc-1');
  assert.equal(head1.status, 200);
  assert.equal(head1.headers.get('X-Grev-Updated-At'), body1.updatedAtUtc);
  assert.equal(head1.headers.get('X-Grev-Content-SHA256'), hex(first));
  assert.equal(await head1.text(), '');

  // Another device on the same account downloads the same bytes (saves follow the account).
  const get1 = await send('GET', 'RetroArch', 'alice-pc-2');
  assert.equal(get1.status, 200, 'app ids are case-insensitive');
  assert.equal(get1.headers.get('Content-Type'), 'application/zip');
  assert.equal(get1.headers.get('X-Grev-Content-SHA256'), hex(first));
  assert.deepEqual(new Uint8Array(await get1.arrayBuffer()), first);

  // A different account never sees it.
  assert.equal((await send('HEAD', 'retroarch', 'bob-pc')).status, 404, 'saves are scoped per account');

  // A newer upload from the second device replaces the first, with a strictly newer timestamp,
  // and the superseded archive is removed from storage.
  const second = new TextEncoder().encode('PK second save archive, longer');
  const body2 = await (await upload('alice-pc-2', second)).json();
  assert.ok(Date.parse(body2.updatedAtUtc) > Date.parse(body1.updatedAtUtc), 'timestamps strictly increase');
  assert.equal(bucket.objects.size, 1, 'old archive cleaned up');
  const get2 = await send('GET', 'retroarch', 'alice-pc-1');
  assert.deepEqual(new Uint8Array(await get2.arrayBuffer()), second);
  assert.equal(get2.headers.get('X-Grev-Updated-At'), body2.updatedAtUtc);

  // Revoked or expired tokens lose access immediately.
  sqlite.prepare(`UPDATE grev_home_tokens SET revoked_at=1 WHERE token_hash=?`).run(tokenHash('alice-pc-2'));
  assert.equal((await send('HEAD', 'retroarch', 'alice-pc-2')).status, 401);

  // Without an R2 binding the route answers 503 and capabilities says cloud saves are off.
  const bare = { DB:env.DB, APP_ENV:'development' };
  assert.equal((await send('HEAD', 'retroarch', 'alice-pc-1', {}, bare)).status, 503);
  const capabilityRequest = new Request('https://grev.test/api/grev-home/capabilities');
  const off = await (await handleGrevHomeCapabilitiesRequest(capabilityRequest, bare)).json();
  const on = await (await handleGrevHomeCapabilitiesRequest(capabilityRequest, env)).json();
  assert.equal(off.capabilities.cloudSaves, false);
  assert.equal(on.capabilities.cloudSaves, true);
  assert.equal(on.limits.cloudSaveMaxBytes, 95 * 1024 * 1024);

  console.log('Grev Home cloud saves passed: auth, account scoping, checksum, size limit, HEAD/GET/PUT headers, replacement and capability gating.');
} finally {
  await rm(buildDirectory, { recursive:true, force:true });
}
