#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';

class TestStatement {
  #database;
  #query;
  #values = [];

  constructor(database, query) {
    this.#database = database;
    this.#query = query;
  }

  bind(...values) {
    this.#values = values;
    return this;
  }

  async first() {
    return this.#database.prepare(this.#query).get(...this.#values) ?? null;
  }

  async all() {
    return { results: this.#database.prepare(this.#query).all(...this.#values) };
  }

  async run() {
    return this.#database.prepare(this.#query).run(...this.#values);
  }
}

class TestDatabase {
  primarySessionCount = 0;

  constructor(database) {
    this.database = database;
  }

  prepare(query) {
    return new TestStatement(this.database, query);
  }

  async batch(statements) {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }

  withSession(constraint) {
    assert.equal(constraint, 'first-primary', 'Connection lifecycle must read the latest D1 state.');
    this.primarySessionCount += 1;
    return {
      prepare: query => this.prepare(query),
      batch: statements => this.batch(statements),
      getBookmark: () => null
    };
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('base64url');
}

async function readJson(response) {
  const payload = await response.json();
  assert.equal(typeof payload, 'object');
  return payload;
}

const buildDirectory = await mkdtemp(join(tmpdir(), 'grev-home-link-contract-'));
const bundlePath = join(buildDirectory, 'grev-home.mjs');

try {
  await build({
    entryPoints: ['src/grev-home.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    outfile: bundlePath,
    logLevel: 'silent'
  });

  const { handleGrevHomeRequest } = await import(pathToFileURL(bundlePath).href);
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      display_name TEXT NOT NULL,
      is_verified INTEGER NOT NULL DEFAULT 0,
      is_owner INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active'
    );
    CREATE TABLE sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      expires_at INTEGER NOT NULL,
      revoked_at INTEGER
    );
    CREATE TABLE user_roles (user_id TEXT NOT NULL, role_id TEXT NOT NULL);
    CREATE TABLE grev_home_link_requests (
      id TEXT PRIMARY KEY,
      device_code_hash TEXT NOT NULL UNIQUE,
      user_code TEXT NOT NULL COLLATE NOCASE UNIQUE,
      grev_id TEXT NOT NULL COLLATE NOCASE,
      local_username TEXT NOT NULL,
      local_display_name TEXT NOT NULL,
      device_name TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      approved_user_id TEXT REFERENCES users(id),
      approved_at INTEGER,
      denied_at INTEGER,
      last_token_issued_at INTEGER
    );
    CREATE TABLE grev_home_links (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
      grev_id TEXT NOT NULL COLLATE NOCASE UNIQUE,
      local_username TEXT NOT NULL,
      local_display_name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_seen_at INTEGER,
      revoked_at INTEGER
    );
    CREATE TABLE grev_home_tokens (
      id TEXT PRIMARY KEY,
      link_id TEXT NOT NULL REFERENCES grev_home_links(id),
      link_request_id TEXT REFERENCES grev_home_link_requests(id),
      token_hash TEXT NOT NULL UNIQUE,
      device_name TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      last_used_at INTEGER,
      expires_at INTEGER NOT NULL,
      revoked_at INTEGER
    );
    CREATE TABLE user_presence (
      user_id TEXT PRIMARY KEY,
      availability TEXT NOT NULL,
      status_text TEXT NOT NULL,
      activity_type TEXT NOT NULL,
      activity_text TEXT NOT NULL,
      expires_at INTEGER,
      updated_at INTEGER NOT NULL
    );
  `);

  const database = new TestDatabase(sqlite);
  const env = { DB: database, APP_ENV: 'production' };
  const userId = randomUUID();
  const browserToken = 'contract-browser-session';
  const current = Math.floor(Date.now() / 1000);
  sqlite.prepare(`INSERT INTO users(id,username,display_name,is_verified,is_owner,status) VALUES(?,?,?,?,?,?)`)
    .run(userId, 'ContractAdmin', 'Contract Admin', 1, 1, 'active');
  sqlite.prepare(`INSERT INTO sessions(token_hash,user_id,expires_at,revoked_at) VALUES(?,?,?,NULL)`)
    .run(sha256(browserToken), userId, current + 3600);

  const startResponse = await handleGrevHomeRequest(new Request('https://grev.dad/api/grev-home/link/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grevId: 'GABCDContractUserXYZ',
      username: 'ContractUser',
      displayName: 'Contract User',
      deviceName: 'Contract Test'
    })
  }), env);
  assert.equal(startResponse.status, 201);
  const start = await readJson(startResponse);
  assert.equal(start.ok, true);
  assert.match(start.linkId, /^[0-9a-f-]{36}$/i);
  assert.ok(start.deviceCode);
  assert.match(start.userCode, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);

  const wrongTokenResponse = await handleGrevHomeRequest(new Request(
    `https://grev.dad/api/grev-home/link/status?id=${encodeURIComponent(start.linkId)}`,
    { headers: { Authorization: 'Bearer wrong-device-code' } }
  ), env);
  assert.equal(wrongTokenResponse.status, 404);

  const pendingResponse = await handleGrevHomeRequest(new Request(
    `https://grev.dad/api/grev-home/link/status?id=${encodeURIComponent(start.linkId)}`,
    { headers: { Authorization: `Bearer ${start.deviceCode}` } }
  ), env);
  assert.equal(pendingResponse.status, 200);
  assert.equal((await readJson(pendingResponse)).status, 'pending');

  const browserHeaders = { Cookie: `grev_session=${browserToken}` };
  const requestResponse = await handleGrevHomeRequest(new Request(
    `https://grev.dad/api/grev-home/link/request?code=${encodeURIComponent(start.userCode)}`,
    { headers: browserHeaders }
  ), env);
  assert.equal(requestResponse.status, 200);
  assert.equal((await readJson(requestResponse)).request.status, 'pending');

  const approvalResponse = await handleGrevHomeRequest(new Request('https://grev.dad/api/grev-home/link/approve', {
    method: 'POST',
    headers: {
      ...browserHeaders,
      Origin: 'https://grev.dad',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ userCode: start.userCode, decision: 'approve' })
  }), env);
  assert.equal(approvalResponse.status, 200);
  assert.equal((await readJson(approvalResponse)).status, 'approved');

  const approvedResponse = await handleGrevHomeRequest(new Request(
    `https://grev.dad/api/grev-home/link/status?id=${encodeURIComponent(start.linkId)}`,
    { headers: { Authorization: `Bearer ${start.deviceCode}` } }
  ), env);
  assert.equal(approvedResponse.status, 200);
  const approved = await readJson(approvedResponse);
  assert.equal(approved.status, 'approved');
  assert.ok(approved.accessToken);
  assert.equal(approved.account.grevId, 'GABCDContractUserXYZ');
  assert.equal(approved.account.username, 'ContractAdmin');

  const meResponse = await handleGrevHomeRequest(new Request('https://grev.dad/api/grev-home/me', {
    headers: { Authorization: `Bearer ${approved.accessToken}` }
  }), env);
  assert.equal(meResponse.status, 200);
  assert.equal((await readJson(meResponse)).account.grevId, 'GABCDContractUserXYZ');

  const revokeResponse = await handleGrevHomeRequest(new Request('https://grev.dad/api/grev-home/link/revoke', {
    method: 'POST',
    headers: { Authorization: `Bearer ${approved.accessToken}` }
  }), env);
  assert.equal(revokeResponse.status, 200);

  const revokedMeResponse = await handleGrevHomeRequest(new Request('https://grev.dad/api/grev-home/me', {
    headers: { Authorization: `Bearer ${approved.accessToken}` }
  }), env);
  assert.equal(revokedMeResponse.status, 401);
  assert.ok(database.primarySessionCount >= 7);
  console.log('Grev Home link contract passed: start, pending, browser approval, token, me and revoke.');
} finally {
  await rm(buildDirectory, { recursive: true, force: true });
}
