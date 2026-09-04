#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
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
    this.database.exec('BEGIN');
    try {
      for (const statement of statements) results.push(await statement.run());
      this.database.exec('COMMIT');
      return results;
    } catch(error) { this.database.exec('ROLLBACK'); throw error; }
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

  sqlite.exec(`ALTER TABLE users ADD COLUMN created_at INTEGER NOT NULL DEFAULT 1;
    CREATE TABLE user_progression(user_id TEXT PRIMARY KEY,total_xp INTEGER,level INTEGER,updated_at INTEGER);
    CREATE TABLE xp_ledger(id TEXT PRIMARY KEY,user_id TEXT,xp_amount INTEGER,source_type TEXT,source_id TEXT,event_key TEXT UNIQUE,description TEXT,created_at INTEGER);
    CREATE TABLE platform_change_revision(id INTEGER PRIMARY KEY,revision INTEGER,changed_at INTEGER);
    INSERT INTO platform_change_revision VALUES(1,0,0);`);
  for (const migration of ['20260822_grev_home_progression_history.sql','20260822_grev_home_progression_trigger_fix.sql',
      '20260822_grev_home_history_content_identity.sql','20260904_grev_home_account_restore.sql']) {
    sqlite.exec(await readFile(new URL('../migrations/'+migration,import.meta.url),'utf8'));
  }

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

  const syncBundle = join(buildDirectory,'sync.mjs');
  await build({entryPoints:['src/grev-home-sync.ts'],bundle:true,platform:'node',format:'esm',outfile:syncBundle});
  const {handleGrevHomeSyncRequest} = await import(pathToFileURL(syncBundle).href);
  async function sync(token,seconds) {
    const response = await handleGrevHomeSyncRequest(new Request('https://grev.dad/api/grev-home/sync',{
      method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
      body:JSON.stringify({profileCreatedAt:100,progression:{totalXp:120,level:1,totalTrackedSeconds:seconds,completedSessions:seconds?1:0,uniqueApps:seconds?1:0},
        apps:seconds?[{appId:'pcsx2',appName:'PCSX2',totalSeconds:seconds,sessionCount:1,lastPlayedAt:current}]:[],sessions:[]})}),env);
    const value=await response.json();
    assert.equal(response.status,200,JSON.stringify(value));
    return value;
  }
  assert.equal((await sync(approved.accessToken,60)).grevHome.totalTrackedSeconds,60);
  assert.equal((await sync(approved.accessToken,60)).grevHome.totalTrackedSeconds,60,'Replay must not add totals');
  const secondStart = await readJson(await handleGrevHomeRequest(new Request('https://grev.dad/api/grev-home/link/start',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({grevId:'GNEWPCXYZ',username:'NewPC',displayName:'New PC',deviceName:'Second PC'})}),env));
  const secondApproval = await handleGrevHomeRequest(new Request('https://grev.dad/api/grev-home/link/approve',{
    method:'POST',headers:{...browserHeaders,Origin:'https://grev.dad','Content-Type':'application/json'},
    body:JSON.stringify({userCode:secondStart.userCode,decision:'approve'})}),env);
  assert.equal(secondApproval.status,200,'Existing account must accept a fresh local profile');
  const second = await readJson(await handleGrevHomeRequest(new Request(`https://grev.dad/api/grev-home/link/status?id=${secondStart.linkId}`,{
    headers:{Authorization:`Bearer ${secondStart.deviceCode}`}}),env));
  assert.equal(second.account.grevId,'GNEWPCXYZ');
  assert.equal(second.account.userId,approved.account.userId);
  assert.equal((await sync(second.accessToken,0)).grevHome.totalTrackedSeconds,60,'Empty reinstall must not erase totals');
  assert.equal((await sync(second.accessToken,120)).grevHome.totalTrackedSeconds,180,'Independent devices must accumulate');
  assert.equal((await sync(second.accessToken,60)).grevHome.totalTrackedSeconds,180,'Stale snapshots must not lower totals');
  const restored = await readJson(await handleGrevHomeSyncRequest(new Request('https://grev.dad/api/grev-home/account-data',{
    headers:{Authorization:`Bearer ${second.accessToken}`}}),env));
  assert.equal(restored.sources.length,2);
  assert.equal(restored.userId,userId);
  assert.equal(restored.sources[0].profileCreatedAt,100);
  const unauthorised=await handleGrevHomeSyncRequest(new Request('https://grev.dad/api/grev-home/account-data'),env);
  assert.equal(unauthorised.status,401);
  const rotateBundle=join(buildDirectory,'rotate.mjs');
  await build({entryPoints:['src/grev-home-token-lifecycle.ts'],bundle:true,platform:'node',format:'esm',outfile:rotateBundle});
  const {handleGrevHomeTokenLifecycleRequest}=await import(pathToFileURL(rotateBundle).href);
  const rotated=await readJson(await handleGrevHomeTokenLifecycleRequest(new Request('https://grev.dad/api/grev-home/token/rotate',{
    method:'POST',headers:{Authorization:`Bearer ${second.accessToken}`}}),env));
  const rotatedMe=await readJson(await handleGrevHomeRequest(new Request('https://grev.dad/api/grev-home/me',{
    headers:{Authorization:`Bearer ${rotated.accessToken}`}}),env));
  assert.equal(rotatedMe.account.grevId,'GNEWPCXYZ','Rotation must preserve the local profile mapping');
  await handleGrevHomeRequest(new Request('https://grev.dad/api/grev-home/token/revoke',{
    method:'POST',headers:{Authorization:`Bearer ${rotated.accessToken}`}}),env);
  for(const token of [second.accessToken,rotated.accessToken]) {
    const denied=await handleGrevHomeRequest(new Request('https://grev.dad/api/grev-home/me',{
      headers:{Authorization:`Bearer ${token}`}}),env);
    assert.equal(denied.status,401,'Unlink must revoke the rotated device credential family');
  }
  const firstStillLinked=await handleGrevHomeRequest(new Request('https://grev.dad/api/grev-home/me',{
    headers:{Authorization:`Bearer ${approved.accessToken}`}}),env);
  assert.equal(firstStillLinked.status,200,'Unlinking one PC must leave the other PC authorised');

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
  console.log('Grev Home contract passed: linking, multi-device identity, reinstall recovery, replay/stale sync, private restore, token rotation and device unlink.');
} finally {
  await rm(buildDirectory, { recursive: true, force: true });
}
