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
    const values = [];
    this.database.exec('BEGIN');
    try {
      for (const statement of statements) values.push(await statement.run());
      this.database.exec('COMMIT');
      return values;
    } catch (error) { this.database.exec('ROLLBACK'); throw error; }
  }
  withSession(constraint) {
    assert.equal(constraint, 'first-primary');
    return { prepare: query => this.prepare(query), batch: statements => this.batch(statements), getBookmark: () => null };
  }
}
const sha256 = value => createHash('sha256').update(value).digest('base64url');
const root = await mkdtemp(join(tmpdir(), 'grev-home-friend-profile-'));
try {
  const bundle = join(root, 'friend-profiles.mjs');
  await build({ entryPoints:['src/grev-home-friend-profiles.ts'], bundle:true, platform:'node', format:'esm', target:'node22', outfile:bundle, logLevel:'silent' });
  const { handleGrevHomeFriendProfiles } = await import(pathToFileURL(bundle).href);
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE users(id TEXT PRIMARY KEY,username TEXT,display_name TEXT,is_verified INTEGER,is_owner INTEGER,status TEXT);
    CREATE TABLE user_roles(user_id TEXT,role_id TEXT);
    CREATE TABLE grev_home_links(id TEXT PRIMARY KEY,user_id TEXT,grev_id TEXT,local_username TEXT,local_display_name TEXT,created_at INTEGER,updated_at INTEGER,last_seen_at INTEGER,revoked_at INTEGER);
    CREATE TABLE grev_home_tokens(id TEXT PRIMARY KEY,link_id TEXT,local_grev_id TEXT,token_hash TEXT,last_used_at INTEGER,expires_at INTEGER,revoked_at INTEGER);
    CREATE TABLE grev_home_profile_sources(grev_id TEXT PRIMARY KEY,user_id TEXT,local_username TEXT,local_display_name TEXT,total_seconds INTEGER,completed_sessions INTEGER);
    CREATE TABLE grev_home_friendships(user_low_id TEXT,user_high_id TEXT,created_at INTEGER);
    CREATE TABLE profile_blocks(owner_user_id TEXT,blocked_user_id TEXT);
    CREATE TABLE user_presence(user_id TEXT PRIMARY KEY,availability TEXT,status_text TEXT,activity_type TEXT,activity_text TEXT,expires_at INTEGER,updated_at INTEGER);
    CREATE TABLE grev_home_public_cards(user_id TEXT PRIMARY KEY,card_json TEXT,updated_at INTEGER);
    CREATE TABLE user_progression(user_id TEXT PRIMARY KEY,total_xp INTEGER,level INTEGER,updated_at INTEGER);
  `);

  const me = randomUUID();
  const friend = randomUUID();
  const link = randomUUID();
  const token = 'friend-profile-contract-token';
  const now = Math.floor(Date.now()/1000);
  sqlite.prepare(`INSERT INTO users VALUES(?,?,?,?,?,?)`).run(me,'Me','Me',0,0,'active');
  sqlite.prepare(`INSERT INTO users VALUES(?,?,?,?,?,?)`).run(friend,'Friend','Friend Name',1,0,'active');
  sqlite.prepare(`INSERT INTO grev_home_links VALUES(?,?,?,?,?,?,?,?,NULL)`).run(link,me,'GABCDMeXYZ','Me','Me',now,now,now);
  sqlite.prepare(`INSERT INTO grev_home_tokens VALUES(?,?,?,?,?,?,NULL)`).run(randomUUID(),link,'GABCDMeXYZ',sha256(token),now,now+3600);
  const [low, high] = me < friend ? [me, friend] : [friend, me];
  sqlite.prepare(`INSERT INTO grev_home_friendships VALUES(?,?,?)`).run(low,high,now-86400);
  sqlite.prepare(`INSERT INTO user_progression VALUES(?,?,?,?)`).run(friend,1250,3,now);
  sqlite.prepare(`INSERT INTO grev_home_public_cards VALUES(?,?,?)`).run(friend,JSON.stringify({theme:'ocean',frame:'glow',showPlaytime:true,showSessions:true}),now);
  sqlite.prepare(`INSERT INTO grev_home_profile_sources VALUES(?,?,?,?,?,?)`).run('GSOURCE1',friend,'Friend','Friend Name',3600,4);
  sqlite.prepare(`INSERT INTO grev_home_profile_sources VALUES(?,?,?,?,?,?)`).run('GSOURCE2',friend,'Friend','Friend Name',900,2);

  const response = await handleGrevHomeFriendProfiles(new Request('https://grev.dad/api/grev-home/friends', {
    headers:{Authorization:`Bearer ${token}`}
  }), {DB:new TestDatabase(sqlite),APP_ENV:'production'});
  assert.equal(response?.status,200);
  const payload = await response.json();
  assert.equal(payload.friends.length,1);
  assert.equal(payload.friends[0].userId,friend);
  assert.equal(payload.friends[0].totalTrackedSeconds,4500,'All linked Grev Home profile sources must contribute to friend play time');
  assert.equal(payload.friends[0].completedSessions,6,'All linked Grev Home profile sources must contribute to friend sessions');
  assert.equal(payload.friends[0].totalXp,1250);
  assert.equal(payload.friends[0].level,3);
  assert.equal(payload.friends[0].publicCard.showPlaytime,true);
  assert.equal(payload.friends[0].publicCard.showSessions,true);
  console.log('Grev Home friend profile projection passed: shared XP, play time and sessions are consistent.');
} finally {
  await rm(root,{recursive:true,force:true});
}
