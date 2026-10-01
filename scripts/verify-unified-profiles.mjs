#!/usr/bin/env node

// Contract test for the unified grev.dad / Grev Home profile (src/profile-unified.ts,
// src/profile-identity.ts, src/profile-widgets.ts): widget tiles, who sees which widget, best
// friends, favourites, identity shared with the Grev Home public card, field privacy, and the
// RetroAchievements cache. Runs every real migration into an in-memory SQLite database.

import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';

class TestStatement {
  constructor(database, query) { this.database = database; this.query = query; this.values = []; }
  bind(...values) { this.values = values.map(value => value === undefined ? null : typeof value === 'boolean' ? Number(value) : value); return this; }
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
  withSession() { return this; }
}

const MIGRATION = '20261002_unified_profiles.sql';
async function migrate(database, { stopBefore } = {}) {
  for (const file of (await readdir('migrations')).filter(name => name.endsWith('.sql')).sort()) {
    if (stopBefore && file === stopBefore) break;
    database.exec(await readFile(join('migrations', file), 'utf8'));
  }
}

const hash = value => createHash('sha256').update(value).digest('base64url');
const PNG = 'data:image/png;base64,' + Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]).toString('base64');

const buildDirectory = await mkdtemp(join(tmpdir(), 'unified-profiles-'));
try {
  await build({
    stdin: {
      contents: `
        export * from './src/profile-unified';
        export * from './src/profile-widgets';
        export { handleGrevHomeRequest } from './src/grev-home';
        export { tileFromInput, saveProfileTilesForSync } from './src/profile';
      `,
      resolveDir: process.cwd(),
      loader: 'ts'
    },
    bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: join(buildDirectory, 'unified.mjs'), logLevel: 'silent'
  });
  const api = await import(pathToFileURL(join(buildDirectory, 'unified.mjs')).href);

  // --- migration: Grev Home card identity moves into the canonical profile -------------------
  {
    const sqlite = new DatabaseSync(':memory:');
    await migrate(sqlite, { stopBefore: MIGRATION });
    sqlite.exec(`
      INSERT INTO users(id,username,display_name,created_at,updated_at) VALUES('u1','one','One',1,1),('u2','two','Two',1,1);
      INSERT INTO user_profiles(user_id,bio,updated_at) VALUES('u2','Website bio',1);
      INSERT INTO user_profile_media(user_id,media_slot,media_data,updated_at) VALUES('u2','avatar','data:web',1);
    `);
    const card = bio => JSON.stringify({ theme: 'ember', bio, avatarMedia: 'data:home', coverMedia: 'data:cover' });
    sqlite.prepare(`INSERT INTO grev_home_public_cards(user_id,card_json,updated_at) VALUES(?,?,2),(?,?,2)`).run('u1', card('Home bio'), 'u2', card('Other'));
    sqlite.exec(await readFile(join('migrations', MIGRATION), 'utf8'));
    assert.equal(sqlite.prepare(`SELECT bio FROM user_profiles WHERE user_id='u1'`).get().bio, 'Home bio');
    assert.equal(sqlite.prepare(`SELECT bio FROM user_profiles WHERE user_id='u2'`).get().bio, 'Website bio', 'a website bio is never replaced');
    assert.equal(sqlite.prepare(`SELECT media_data FROM user_profile_media WHERE user_id='u1' AND media_slot='avatar'`).get().media_data, 'data:home');
    assert.equal(sqlite.prepare(`SELECT media_data FROM user_profile_media WHERE user_id='u2' AND media_slot='avatar'`).get().media_data, 'data:web', 'a website avatar is never replaced');
    assert.equal(sqlite.prepare(`SELECT media_data FROM user_profile_media WHERE user_id='u2' AND media_slot='cover'`).get().media_data, 'data:cover', 'an empty slot is filled');
    const left = JSON.parse(sqlite.prepare(`SELECT card_json FROM grev_home_public_cards WHERE user_id='u1'`).get().card_json);
    assert.deepEqual(left, { theme: 'ember' }, 'the card keeps only its display options');
  }

  // --- widget tile contract -------------------------------------------------------------------
  assert.deepEqual(api.widgetFromInput(null, null), { widget: null, widgetConfig: {} });
  assert.deepEqual(api.widgetFromInput('recent-games', { count: 4 }), { widget: 'recent-games', widgetConfig: { count: 4 } });
  assert.deepEqual(api.widgetFromInput('bio', { count: 4 }), { widget: 'bio', widgetConfig: {} }, 'count is ignored for non-list widgets');
  assert.equal(api.widgetFromInput('mystery', {}), undefined);
  assert.equal(api.widgetFromInput('recent-games', { count: 0 }), undefined);
  assert.equal(api.widgetFromInput('recent-games', { count: 13 }), undefined);
  assert.deepEqual(api.widgetFromRow('mystery', '{}'), { widget: null, widgetConfig: {} }, 'unknown stored widgets degrade to plain tiles');
  const tile = (x, y, extra = {}) => ({ tileId: randomUUID(), tileType: 'text', x, y, width: 2, height: 2, title: 'T', ...extra });
  assert.ok(api.tileFromInput(tile(4, 0, { widget: 'stats' })));
  assert.equal(api.tileFromInput(tile(4, 0, { tileType: 'link', linkUrl: 'https://grev.dad', widget: 'stats' })), null, 'widgets must be text tiles');

  // --- live database -------------------------------------------------------------------------
  const sqlite = new DatabaseSync(':memory:');
  await migrate(sqlite);
  const db = new TestDatabase(sqlite);
  const now = Math.floor(Date.now() / 1000);
  const [A, B, C, D] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  for (const [id, name] of [[A, 'alice'], [B, 'bob'], [C, 'carol'], [D, 'dave']]) {
    sqlite.prepare(`INSERT INTO users(id,username,display_name,created_at,updated_at,is_verified) VALUES(?,?,?,?,?,1)`).run(id, name, name.toUpperCase(), now, now);
  }
  const low = (a, b) => a < b ? [a, b] : [b, a];
  sqlite.prepare(`INSERT INTO grev_home_friendships(user_low_id,user_high_id,created_at) VALUES(?,?,?)`).run(...low(A, B), now);
  sqlite.prepare(`INSERT INTO grev_home_friendships(user_low_id,user_high_id,created_at) VALUES(?,?,?)`).run(...low(A, D), now);
  sqlite.prepare(`INSERT INTO profile_blocks(owner_user_id,blocked_user_id,created_at) VALUES(?,?,?)`).run(A, D, now);
  const tokens = {};
  for (const [id, name] of [[A, 'alice'], [B, 'bob']]) {
    const link = randomUUID();
    sqlite.prepare(`INSERT INTO grev_home_links(id,user_id,grev_id,local_username,local_display_name,created_at,updated_at) VALUES(?,?,?,?,?,?,?)`)
      .run(link, id, `GREV-${name}`, name, name, now, now);
    tokens[id] = `token-${name}`;
    sqlite.prepare(`INSERT INTO grev_home_tokens(id,link_id,token_hash,created_at,expires_at) VALUES(?,?,?,?,?)`)
      .run(randomUUID(), link, hash(tokens[id]), now, now + 3600);
    if (id === A) tokens.linkA = link;
  }
  for (const [id, cookie] of [[C, 'carol-session'], [D, 'dave-session'], [A, 'alice-session']]) {
    sqlite.prepare(`INSERT INTO sessions(id,user_id,token_hash,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?)`)
      .run(randomUUID(), id, hash(cookie), now, now, now + 3600);
  }
  const history = (session, app, name, visibility, ended, seconds) => sqlite.prepare(`
    INSERT INTO grev_home_session_history(link_id,session_id,user_id,app_id,app_name,started_at,ended_at,duration_seconds,outcome,client_sequence,visibility,created_at)
    VALUES(?,?,?,?,?,?,?,?,'exited',?,?,?)`).run(tokens.linkA, session, A, app, name, ended - seconds, ended, seconds, ended, visibility, now);
  history('s1', 'retroarch', 'RetroArch', 'friends', now - 300, 3600);
  history('s2', 'steam-1', 'Halo', 'friends', now - 200, 600);
  history('s3', 'secret', 'Private Game', 'private', now - 100, 60);
  sqlite.prepare(`INSERT INTO grev_home_session_content(link_id,session_id,content_id,content_name,created_at) VALUES(?,?,?,?,?)`)
    .run(tokens.linkA, 's1', 'snes:mario', 'Super Mario World', now);

  const widgetTiles = ['recent-games', 'game-activity', 'most-played', 'favourite-games', 'best-friends', 'bio', 'stats', 'achievements', 'retroachievements']
    .map((widget, index) => tile(4 + (index % 2) * 2, index * 2, { widget, widgetConfig: widget === 'recent-games' ? { count: 2 } : {} }));
  const saved = await api.saveProfileTilesForSync({ DB: db }, A, widgetTiles);
  assert.equal(saved.ok, true, saved.message);

  let raCalls = 0;
  globalThis.fetch = async url => {
    raCalls += 1;
    const parsed = new URL(url);
    assert.equal(parsed.pathname, '/API/API_GetUserSummary.php');
    if (parsed.searchParams.get('u') === 'nobody') return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({
      User: 'AliceRA', TotalPoints: 1234, TotalTruePoints: 2000, Rank: 42, TotalRanked: 9000, UserPic: '/UserPic/AliceRA.png',
      RichPresenceMsg: 'Exploring Hyrule', Motto: 'Hi',
      LastGame: { ID: 1, Title: 'Zelda', ConsoleName: 'SNES', ImageIcon: '/Images/1.png' },
      RecentlyPlayed: [{ GameID: 1, Title: 'Zelda', ConsoleName: 'SNES', ImageIcon: '/Images/1.png', ImageBoxArt: '/Images/2.png', LastPlayed: '2026-09-30 10:00:00', AchievementsTotal: 50 }],
      Awarded: { 1: { NumPossibleAchievements: 50, NumAchieved: 10 } },
      RecentAchievements: { 1: { 9: { ID: 9, GameID: 1, GameTitle: 'Zelda', Title: 'Sword', Description: 'Get it', Points: 5, BadgeName: '123', IsAwarded: '1', DateAwarded: '2026-09-30 10:00:00', HardcoreAchieved: 1 } } }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const env = { DB: db, APP_ENV: 'development', RETROACHIEVEMENTS_API_KEY: 'SECRET-KEY' };
  const device = (user, method, path, body) => api.handleGrevHomeProfileRequest(new Request(`https://grev.dad${path}`, {
    method, headers: { Authorization: `Bearer ${tokens[user]}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined
  }), env);
  const core = (user, method, path, body) => api.handleGrevHomeRequest(new Request(`https://grev.dad${path}`, {
    method, headers: { Authorization: `Bearer ${tokens[user]}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined
  }), env);
  const web = (cookie, method, path, body) => api.handleWebProfileWidgetsRequest(new Request(`https://grev.dad${path}`, {
    method, headers: { Cookie: `grev_session=${cookie}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined
  }), env);
  const read = async response => ({ status: response.status, body: await response.json() });
  const widgetOf = (profile, widget) => Object.values(profile.widgets).find(value => value.widget === widget);

  // RetroAchievements: an unknown user is refused; a real one is cached without the key.
  assert.equal((await read(await device(A, 'PUT', '/api/grev-home/profile/retroachievements', { username: 'nobody' }))).status, 404);
  assert.equal((await read(await device(A, 'PUT', '/api/grev-home/profile/retroachievements', { username: 'bad name!' }))).status, 400);
  const ra = await read(await device(A, 'PUT', '/api/grev-home/profile/retroachievements', { username: 'AliceRA' }));
  assert.equal(ra.status, 200);
  assert.equal(ra.body.retroAchievements.summary.totalPoints, 1234);
  assert.equal(ra.body.retroAchievements.summary.recentAchievements[0].badgeUrl, 'https://media.retroachievements.org/Badge/123.png');
  assert.equal(ra.body.retroAchievements.summary.recentlyPlayed[0].achieved, 10);
  assert.ok(!JSON.stringify(ra.body).includes('SECRET-KEY'));
  assert.ok(!sqlite.prepare(`SELECT summary_json FROM user_retroachievements`).get().summary_json.includes('SECRET-KEY'));
  const callsAfterLink = raCalls;

  // Favourites and best friends.
  assert.equal((await read(await device(A, 'POST', '/api/grev-home/profile/favourites', { item: { itemKey: 'snes:mario', title: 'Super Mario World', platform: 'SNES' } }))).status, 200);
  assert.equal((await read(await device(A, 'POST', '/api/grev-home/profile/favourites', { item: { itemKey: 'steam:halo', title: 'Halo', platform: 'PC' } }))).body.items.length, 2);
  assert.equal((await read(await device(A, 'POST', '/api/grev-home/profile/favourites', { item: { itemKey: 'snes:mario', title: 'Super Mario World', platform: 'SNES' } }))).body.items.length, 2, 'favouriting twice is idempotent');
  const reordered = await read(await device(A, 'PUT', '/api/grev-home/profile/favourites', { items: [{ itemKey: 'steam:halo', title: 'Halo' }, { itemKey: 'snes:mario', title: 'Super Mario World' }] }));
  assert.deepEqual(reordered.body.items.map(item => item.itemKey), ['steam:halo', 'snes:mario']);
  assert.equal((await read(await device(A, 'DELETE', '/api/grev-home/profile/favourites/steam%3Ahalo'))).body.items.length, 1);
  assert.equal((await read(await device(A, 'POST', '/api/grev-home/profile/best-friends', { userId: C }))).status, 400, 'non-friends cannot be best friends');
  assert.equal((await read(await device(A, 'POST', '/api/grev-home/profile/best-friends', { userId: B }))).body.items[0].userId, B);
  assert.equal((await read(await device(A, 'POST', '/api/grev-home/profile/best-friends', { userId: D }))).status, 400, 'a blocked friend cannot be a best friend');
  // A best friend who is later blocked drops out of the widget without being deleted.
  sqlite.prepare(`INSERT INTO user_best_friends(user_id,friend_user_id,position,added_at) VALUES(?,?,9,?)`).run(A, D, now);

  // Identity: one bio for grev.dad and Grev Home.
  assert.equal((await read(await device(A, 'PUT', '/api/grev-home/profile/identity', { bio: 'x'.repeat(801) }))).status, 400);
  const identity = await read(await device(A, 'PUT', '/api/grev-home/profile/identity', { headline: 'Retro fan', bio: 'L'.repeat(300), avatarMedia: PNG }));
  assert.equal(identity.status, 200);
  assert.equal(sqlite.prepare(`SELECT bio FROM user_profiles WHERE user_id=?`).get(A).bio, 'L'.repeat(300));
  assert.equal(sqlite.prepare(`SELECT media_data FROM user_profile_media WHERE user_id=? AND media_slot='avatar'`).get(A).media_data, PNG);
  let card = await read(await core(A, 'GET', '/api/grev-home/public-card'));
  assert.equal(card.body.card.bio, 'L'.repeat(300), 'the Grev Home card shows the grev.dad bio in full');
  assert.equal(card.body.card.avatarMedia, PNG);
  // An older Grev Home that caps bios at 160 characters must not shorten the bio when it saves.
  card = await read(await core(A, 'PUT', '/api/grev-home/public-card', { card: { ...card.body.card, bio: 'L'.repeat(160), theme: 'ember' } }));
  assert.equal(card.status, 200, JSON.stringify(card.body));
  assert.equal(sqlite.prepare(`SELECT bio FROM user_profiles WHERE user_id=?`).get(A).bio, 'L'.repeat(300));
  assert.equal(card.body.card.theme, 'ember');
  assert.ok(!JSON.parse(sqlite.prepare(`SELECT card_json FROM grev_home_public_cards WHERE user_id=?`).get(A).card_json).bio, 'the card no longer stores a copy of the bio');
  card = await read(await core(A, 'PUT', '/api/grev-home/public-card', { card: { ...card.body.card, bio: 'Edited in Grev Home' } }));
  assert.equal(sqlite.prepare(`SELECT bio FROM user_profiles WHERE user_id=?`).get(A).bio, 'Edited in Grev Home');
  // Grev Home now saves only card display options; that must leave the shared identity alone.
  const optionsOnly = await read(await core(A, 'PUT', '/api/grev-home/public-card', { card: { theme: 'aurora', frame: 'glow', statusMessage: 'Busy', headline: 'ignored' } }));
  assert.equal(optionsOnly.status, 200);
  assert.equal(optionsOnly.body.card.theme, 'aurora');
  assert.equal(optionsOnly.body.card.bio, 'Edited in Grev Home', 'saving card options keeps the bio');
  assert.equal(optionsOnly.body.card.avatarMedia, PNG, 'saving card options keeps the avatar');
  assert.equal(optionsOnly.body.card.headline, 'Retro fan', 'the headline is edited through the profile identity only');
  let friends = await read(await core(B, 'GET', '/api/grev-home/friends'));
  assert.equal(friends.body.friends.find(friend => friend.userId === A).publicCard.bio, 'Edited in Grev Home');

  // Own profile: everything, including private sessions.
  const own = (await read(await device(A, 'GET', '/api/grev-home/profile'))).body.profile;
  assert.equal(own.relationship, 'self');
  assert.equal(own.card.bio, 'Edited in Grev Home');
  assert.equal(own.tiles.length, 9);
  assert.equal(widgetOf(own, 'recent-games').items.length, 2, 'count limits the list');
  assert.equal(widgetOf(own, 'recent-games').items[0].title, 'Private Game');
  assert.equal(widgetOf(own, 'most-played').items[0].title, 'Super Mario World', 'content name beats the emulator name');
  assert.equal(widgetOf(own, 'favourite-games').items[0].title, 'Super Mario World');
  assert.equal(widgetOf(own, 'retroachievements').summary.username, 'AliceRA');
  assert.equal(raCalls, callsAfterLink, 'a fresh RetroAchievements summary is served from cache');
  assert.equal(widgetOf(own, 'stats').uniqueApps, 3);
  assert.equal(widgetOf(own, 'bio').bio, 'Edited in Grev Home');

  // A friend: session widgets without private sessions; blocked best friends are left out.
  const asFriend = (await read(await device(B, 'GET', `/api/grev-home/profiles/${A}`))).body.profile;
  assert.equal(asFriend.relationship, 'friend');
  assert.ok(!widgetOf(asFriend, 'recent-games').items.some(item => item.title === 'Private Game'));
  assert.ok(!widgetOf(asFriend, 'game-activity').sessions.some(item => item.title === 'Private Game'));
  assert.equal(asFriend.friendCode, null);
  assert.deepEqual(widgetOf(asFriend, 'best-friends').items.map(item => item.userId), [B]);
  assert.equal(asFriend.isBestFriend, false);
  // Grev Home only opens friends' full profiles.
  assert.equal((await device(B, 'GET', `/api/grev-home/profiles/${C}`)).status, 404);

  // A website member who is not a friend: no session history.
  const member = await read(await web('carol-session', 'GET', `/api/profile/widgets/${A}`));
  assert.equal(member.body.relationship, 'member');
  const memberWidgets = Object.values(member.body.widgets);
  assert.ok(memberWidgets.find(value => value.widget === 'recent-games').hidden);
  assert.ok(memberWidgets.find(value => value.widget === 'game-activity').hidden);
  assert.equal(memberWidgets.find(value => value.widget === 'favourite-games').items.length, 1);
  assert.equal(memberWidgets.find(value => value.widget === 'retroachievements').summary.totalPoints, 1234);
  // dave is blocked by A: never listed as a best friend, and cannot see A's profile at all.
  assert.deepEqual(memberWidgets.find(value => value.widget === 'best-friends').items.map(item => item.userId), [B]);
  assert.equal((await web('dave-session', 'GET', `/api/profile/widgets/${A}`)).status, 404);
  assert.equal((await web('nobody', 'GET', `/api/profile/widgets/${A}`)).status, 401);

  // Field and tile privacy from the grev.dad editor apply in Grev Home as well.
  sqlite.prepare(`INSERT INTO user_profile_field_privacy(user_id,field_key,visibility,updated_at) VALUES(?,?,?,?)`).run(A, 'bio', 'private', now);
  sqlite.prepare(`INSERT INTO user_profile_field_privacy(user_id,field_key,visibility,updated_at) VALUES(?,?,?,?)`).run(A, 'avatar', 'private', now);
  sqlite.prepare(`INSERT INTO user_profile_tile_privacy(user_id,tile_id,visibility,updated_at) VALUES(?,?,?,?)`).run(A, widgetTiles[6].tileId, 'private', now);
  const hidden = (await read(await device(B, 'GET', `/api/grev-home/profiles/${A}`))).body.profile;
  assert.equal(hidden.card.bio, null);
  assert.equal(hidden.card.avatarMedia, null);
  assert.equal(hidden.tiles.length, 8);
  assert.ok(!widgetOf(hidden, 'stats'), 'a private tile\'s widget is not resolved');
  assert.equal(widgetOf(hidden, 'bio').bio, null);
  friends = await read(await core(B, 'GET', '/api/grev-home/friends'));
  const fromList = friends.body.friends.find(friend => friend.userId === A).publicCard;
  assert.equal(fromList.bio, '');
  assert.equal(fromList.avatarMedia, null);
  const ownAgain = (await read(await device(A, 'GET', '/api/grev-home/profile'))).body.profile;
  assert.equal(ownAgain.card.bio, 'Edited in Grev Home', 'the owner always sees their own fields');
  assert.equal(ownAgain.privacy.fields.bio.visibility, 'private');

  // Unknown widgets in client input are rejected rather than stored.
  assert.equal((await api.saveProfileTilesForSync({ DB: db }, A, [tile(4, 0, { widget: 'nope' })])).ok, false);

  // Website management endpoints use the browser session and refuse other origins.
  assert.equal((await read(await web('alice-session', 'GET', '/api/profile/favourites'))).body.items.length, 1);
  const crossOrigin = await api.handleWebProfileWidgetsRequest(new Request('https://grev.dad/api/profile/favourites', {
    method: 'POST', headers: { Cookie: 'grev_session=alice-session', Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: '{}'
  }), env);
  assert.equal(crossOrigin.status, 403);

  // Without a server key, linking still records the username and says it is not configured.
  const noKey = { DB: db, APP_ENV: 'development' };
  const unconfigured = await api.handleGrevHomeProfileRequest(new Request('https://grev.dad/api/grev-home/profile/retroachievements', {
    method: 'PUT', headers: { Authorization: `Bearer ${tokens[B]}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'BobRA' })
  }), noKey);
  const unconfiguredBody = await unconfigured.json();
  assert.equal(unconfiguredBody.retroAchievements.linked, true);
  assert.equal(unconfiguredBody.retroAchievements.configured, false);
  assert.equal(unconfiguredBody.retroAchievements.summary, null);

  console.log('Unified profile contract verified.');
} finally {
  await rm(buildDirectory, { recursive: true, force: true });
}
