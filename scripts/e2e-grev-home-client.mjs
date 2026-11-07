#!/usr/bin/env node

// End-to-end check of every Grev.dad call Grev Home makes, against a running worker.
// Requests use the exact paths, methods, headers and JSON shapes from Grev Home's
// src/GrevHome/Online services, and each response is checked for every field the matching
// C# record needs. Run it against a local worker:
//
//   npx wrangler d1 migrations apply grev-dad-dev --local
//   npx wrangler dev --local --port 8787 &
//   node scripts/e2e-grev-home-client.mjs http://127.0.0.1:8787
//
// It creates throwaway accounts, so never point it at production.

import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';

const base = String(process.argv[2] ?? 'http://127.0.0.1:8787').replace(/\/+$/, '');
if (/(^|\.)grev\.dad$/i.test(new URL(base).hostname)) {
  console.error('Refusing to run against a real grev.dad host; this test creates accounts.');
  process.exit(2);
}

const origin = new URL(base).origin;
const run = Date.now().toString(36);
const steps = [];
const step = name => steps.push(name);

async function call(method, path, { token, cookie, body, raw, headers = {} } = {}) {
  const init = { method, redirect:'manual', headers:{ ...headers } };
  if (token) init.headers.Authorization = `Bearer ${token}`;
  if (cookie) { init.headers.Cookie = cookie; init.headers.Origin = origin; }
  if (body !== undefined) { init.headers['Content-Type'] = 'application/json; charset=utf-8'; init.body = JSON.stringify(body); }
  if (raw !== undefined) { init.body = raw; init.duplex = 'half'; }
  const response = await fetch(`${base}/${path}`, init);
  const type = response.headers.get('Content-Type') ?? '';
  const payload = method === 'HEAD' ? null : type.includes('json') ? await response.json() : new Uint8Array(await response.arrayBuffer());
  return { status:response.status, headers:response.headers, payload };
}

function expectOk(result, label, status = [200, 201]) {
  assert.ok([status].flat().includes(result.status), `${label}: HTTP ${result.status} ${JSON.stringify(result.payload)}`);
  assert.equal(result.payload?.ok, true, `${label}: ok must be true`);
  return result.payload;
}

function hasFields(value, fields, label) {
  for (const field of fields) assert.ok(value && field in value && value[field] !== undefined, `${label} is missing ${field}`);
}

// GrevHome.Profiles.ProfileService: G + 4 + filesystem-safe username + 3 from this alphabet.
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const token = n => Array.from({ length:n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
const grevId = name => `G${token(4)}${name}${token(3)}`;

async function signup(username) {
  const response = await fetch(`${base}/api/auth/signup`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', Origin:origin },
    body:JSON.stringify({ username, displayName:username, password:'correct-horse-battery-staple' })
  });
  assert.equal(response.status, 201, `signup ${username}: ${await response.clone().text()}`);
  const cookie = (response.headers.get('Set-Cookie') ?? '').split(';')[0];
  assert.ok(cookie.startsWith('grev_session='), 'signup must set a session cookie');
  return cookie;
}

// GrevDadAccountService.BeginLinkAsync -> browser approval -> PollLinkAsync.
async function linkDevice(cookie, profile) {
  const start = expectOk(await call('POST', 'api/grev-home/link/start', {
    body:{ grevId:profile.grevId, username:profile.username, displayName:profile.displayName, deviceName:profile.device }
  }), 'link/start');
  hasFields(start, ['apiVersion', 'linkId', 'deviceCode', 'userCode', 'verificationUri', 'expiresAt', 'intervalSeconds'], 'LinkStartApiResponse');
  assert.equal(start.apiVersion, 1);
  assert.ok(new URL(start.verificationUri).pathname === '/link-grev-home');

  const pending = expectOk(await call('GET', `api/grev-home/link/status?id=${start.linkId}`, { token:start.deviceCode }), 'link/status pending');
  assert.equal(pending.status, 'pending');

  const page = await fetch(start.verificationUri.replace(/^https?:\/\/[^/]+/, base), { headers:{ Cookie:cookie }, redirect:'manual' });
  assert.equal(page.status, 200, 'the signed-in link page must render');
  const view = expectOk(await call('GET', `api/grev-home/link/request?code=${encodeURIComponent(start.userCode)}`, { cookie }), 'link/request');
  assert.equal(view.request.grevId, profile.grevId);
  expectOk(await call('POST', 'api/grev-home/link/approve', { cookie, body:{ userCode:start.userCode, decision:'approve' } }), 'link/approve');

  const approved = expectOk(await call('GET', `api/grev-home/link/status?id=${start.linkId}`, { token:start.deviceCode }), 'link/status approved');
  hasFields(approved, ['status', 'apiVersion', 'accessToken', 'tokenExpiresAt', 'account'], 'LinkStatusApiResponse');
  assert.equal(approved.status, 'approved');
  hasFields(approved.account, ['userId', 'username', 'displayName', 'isVerified', 'grevId', 'localUsername', 'localDisplayName', 'linkId', 'friendCode', 'publicCard'], 'GrevDadRemoteAccount');
  return { ...profile, accessToken:approved.accessToken, account:approved.account };
}

const aliceCookie = await signup(`alice_${run}`);
const bobCookie = await signup(`bob_${run}`);
step('website sign-up');

const alice = await linkDevice(aliceCookie, { grevId:grevId('Alice'), username:'Alice', displayName:'Alice', device:'ALICE-PC' });
const bob = await linkDevice(bobCookie, { grevId:grevId('Bob'), username:'Bob', displayName:'Bob', device:'BOB-PC' });
step('device link start, browser approval and token issue');

// GrevDadConnectionMaintenanceService.GetCapabilitiesAsync
const caps = expectOk(await call('GET', 'api/grev-home/capabilities'), 'capabilities');
hasFields(caps, ['apiVersion', 'optional', 'environment', 'capabilities', 'limits'], 'GrevDadCapabilitiesApiResponse');
assert.equal(caps.optional, true);
for (const flag of ['linking', 'deviceTokens', 'tokenRotation', 'linkMetadataSync', 'cloudSaves', 'profileTileSync', 'messaging']) {
  assert.equal(caps.capabilities[flag], true, `capability ${flag}`);
}
assert.ok(caps.limits.cloudSaveMaxBytes > 0);
step('capabilities');

// GrevDadAccountService.ValidateLinkedAccountAsync
const me = expectOk(await call('GET', 'api/grev-home/me', { token:alice.accessToken }), 'me');
hasFields(me.account, ['userId', 'grevId', 'linkId', 'friendCode', 'publicCard'], 'AccountApiResponse.account');
assert.equal(me.account.grevId, alice.grevId);
step('me');

// GrevDadConnectionMaintenanceService.ReconcileLocalIdentityAsync
expectOk(await call('PUT', 'api/grev-home/link/metadata', { token:alice.accessToken,
  body:{ grevId:alice.grevId, localUsername:'Alice', localDisplayName:'Alice R' } }), 'link/metadata');
step('link metadata');

// Presence, activity, public card
const presence = expectOk(await call('PUT', 'api/grev-home/presence', { token:alice.accessToken,
  body:{ availability:'online', activityType:'playing', activityText:'RetroArch', statusText:'', expiresInSeconds:300 } }), 'presence');
hasFields(presence.presence, ['availability', 'statusText', 'activityType', 'activityText', 'expiresAt', 'updatedAt'], 'PresenceApiPayload');
expectOk(await call('POST', 'api/grev-home/activity', { token:alice.accessToken,
  body:{ type:'app.started', appId:'retroarch', appName:'RetroArch', detail:'', visibility:'friends' } }), 'activity post');
const activity = expectOk(await call('GET', 'api/grev-home/activity?limit=50', { token:alice.accessToken }), 'activity get');
hasFields(activity.events[0], ['id', 'user', 'type', 'appId', 'appName', 'detail', 'visibility', 'occurredAt'], 'ActivityApiPayload');
const card = expectOk(await call('GET', 'api/grev-home/public-card', { token:alice.accessToken }), 'public-card get').card;
expectOk(await call('PUT', 'api/grev-home/public-card', { token:alice.accessToken, body:{ card:{ ...card, bio:'Hello' } } }), 'public-card put');
step('presence, activity and public card');

// Friends: code lookup, search, request, accept, list, remove later
const lookup = expectOk(await call('GET', `api/grev-home/friends/lookup?code=${encodeURIComponent(bob.account.friendCode)}`, { token:alice.accessToken }), 'friend code lookup');
hasFields(lookup.user, ['userId', 'username', 'displayName', 'isVerified', 'publicCard'], 'GrevDadFriendCodeResult');
const search = expectOk(await call('GET', `api/grev-home/users?q=${encodeURIComponent(`bob_${run}`)}`, { token:alice.accessToken }), 'member search');
hasFields(search.users[0], ['userId', 'username', 'displayName', 'isVerified', 'isFriend', 'outgoingPending', 'incomingPending'], 'GrevDadMemberSearchResult');
expectOk(await call('POST', 'api/grev-home/friend-requests', { token:alice.accessToken, body:{ userId:bob.account.userId } }), 'friend request');
const requests = expectOk(await call('GET', 'api/grev-home/friend-requests', { token:bob.accessToken }), 'friend requests');
hasFields(requests.incoming[0], ['id', 'createdAt', 'user'], 'FriendRequestApiPayload');
expectOk(await call('POST', `api/grev-home/friend-requests/${requests.incoming[0].id}/accept`, { token:bob.accessToken }), 'accept');
const friends = expectOk(await call('GET', 'api/grev-home/friends', { token:alice.accessToken }), 'friends').friends;
assert.equal(friends.length, 1);
hasFields(friends[0], ['userId', 'username', 'displayName', 'isVerified', 'friendsSince', 'presence', 'publicCard', 'totalXp', 'level', 'totalTrackedSeconds', 'completedSessions'], 'FriendApiPayload');
step('friend code, search, request, accept and list');

// Messaging (GrevDadAccountService messaging calls)
const messageId = randomUUID();
expectOk(await call('POST', `api/grev-home/messages/${bob.account.userId}`, { token:alice.accessToken, body:{ messageId, body:'hi bob' } }), 'send message');
const inbox = expectOk(await call('GET', 'api/grev-home/messages', { token:bob.accessToken }), 'inbox');
hasFields(inbox.conversations[0], ['roomId', 'userId', 'displayName', 'unread'], 'GrevDadConversation');
assert.equal(inbox.conversations[0].unread, 1);
const pageOfMessages = expectOk(await call('GET', `api/grev-home/messages/${alice.account.userId}`, { token:bob.accessToken }), 'message page');
hasFields(pageOfMessages.messages[0], ['id', 'senderUserId', 'body', 'createdAt', 'type'], 'GrevDadMessage');
expectOk(await call('POST', `api/grev-home/messages/${alice.account.userId}/read`, { token:bob.accessToken, body:{ messageId } }), 'mark read');
assert.equal(expectOk(await call('GET', 'api/grev-home/messages', { token:bob.accessToken }), 'inbox').conversations[0].unread, 0);
step('messaging');

// GrevDadProfileSyncService.SendBatchAsync then account-data restore
const now = Math.floor(Date.now() / 1000);
const sync = expectOk(await call('POST', 'api/grev-home/sync', { token:alice.accessToken, body:{
  statisticsRevision:2,
  progression:{ totalXp:120, level:1, totalTrackedSeconds:600, completedSessions:1, uniqueApps:1 },
  profileCreatedAt:now - 3600,
  apps:[{ appId:'retroarch', appName:'RetroArch', totalSeconds:600, sessionCount:1, lastPlayedAt:now - 60 }],
  sessions:[{ sessionId:randomUUID(), sequence:1, appId:'retroarch', appName:'RetroArch', contentId:null, contentName:null,
    startedAt:now - 700, endedAt:now - 100, durationSeconds:600, outcome:'exited', failureMessage:null, visibility:'friends' }]
} }), 'sync');
hasFields(sync, ['apiVersion', 'acceptedThroughSequence', 'grevHome', 'grevDad'], 'GrevDadSyncApiResponse');
assert.equal(sync.acceptedThroughSequence, 1);
const accountData = expectOk(await call('GET', 'api/grev-home/account-data', { token:alice.accessToken }), 'account-data');
hasFields(accountData, ['apiVersion', 'userId', 'username', 'displayName', 'accountCreatedAt', 'downloadedAt', 'sources', 'sharedProgression', 'achievements', 'cloudSaves'], 'GrevDadAccountData');
assert.equal(accountData.sources[0].apps[0].appId, 'retroarch');
step('progression sync and account-data restore');

// GrevDadProfileSyncService profile tiles
const tile = { tileId:randomUUID(), tileType:'text', x:0, y:0, width:2, height:1, title:'Hello', body:null, linkLabel:null,
  linkUrl:null, statValue:null, backgroundType:'solid', backgroundPrimary:'#11161d', backgroundSecondary:'#3157c9',
  backgroundAngle:135, backgroundMedia:null, mediaFit:'cover', mediaOverlay:'dark', textColour:'#f4f7fb',
  borderColour:'#394657', fontFamily:'system' };
expectOk(await call('PUT', 'api/grev-home/profile-tiles', { token:alice.accessToken, body:{ tiles:[tile] } }), 'tiles put');
const tiles = expectOk(await call('GET', 'api/grev-home/profile-tiles', { token:alice.accessToken }), 'tiles get');
assert.equal(tiles.tiles[0].tileId, tile.tileId);
step('profile tiles');

// Unified profile: widget tiles, identity, favourites and best friends, seen from Grev Home and
// grev.dad. Tiles sit right of the website's 4x6 profile card so the web editor accepts them too.
const widgetTile = (widget, y, widgetConfig = {}) => ({ ...tile, tileId:randomUUID(), x:4, y, width:4, height:2, title:widget, widget, widgetConfig });
const widgetTiles = [widgetTile('recent-games', 0, { count:3 }), widgetTile('best-friends', 2), widgetTile('favourite-games', 4), widgetTile('bio', 6)];
expectOk(await call('PUT', 'api/grev-home/profile-tiles', { token:alice.accessToken, body:{ tiles:widgetTiles } }), 'widget tiles put');
expectOk(await call('PUT', 'api/grev-home/profile/identity', { token:alice.accessToken, body:{ headline:'Retro fan', bio:'Hello from Grev Home' } }), 'identity');
expectOk(await call('POST', 'api/grev-home/profile/best-friends', { token:alice.accessToken, body:{ userId:bob.account.userId } }), 'best friend');
expectOk(await call('POST', 'api/grev-home/profile/favourites', { token:alice.accessToken, body:{ item:{ itemKey:'retroarch', title:'RetroArch', platform:'PC' } } }), 'favourite');
const own = expectOk(await call('GET', 'api/grev-home/profile', { token:alice.accessToken }), 'own profile').profile;
hasFields(own, ['id', 'relationship', 'card', 'tiles', 'preferences', 'widgets', 'publicCard', 'presence', 'grid'], 'GrevDadProfileDocument');
const ownWidget = kind => Object.values(own.widgets).find(value => value.widget === kind);
assert.equal(ownWidget('recent-games').items[0].appId, 'retroarch');
assert.equal(ownWidget('best-friends').items[0].userId, bob.account.userId);
assert.equal(ownWidget('favourite-games').items[0].title, 'RetroArch');
assert.equal(own.card.bio, 'Hello from Grev Home');
const asBob = expectOk(await call('GET', `api/grev-home/profiles/${alice.account.userId}`, { token:bob.accessToken }), 'friend profile').profile;
assert.equal(asBob.relationship, 'friend');
assert.equal(asBob.card.headline, 'Retro fan');
assert.equal(expectOk(await call('GET', 'api/grev-home/public-card', { token:alice.accessToken }), 'public card').card.bio, 'Hello from Grev Home');
// The website shows the same profile, and saving it from the web editor keeps the widgets.
const webProfile = expectOk(await call('GET', `api/profiles/${alice.account.userId}`, { cookie:aliceCookie }), 'web profile').profile;
assert.equal(webProfile.card.bio, 'Hello from Grev Home');
assert.equal(webProfile.tiles.find(item => item.widget === 'recent-games')?.widgetConfig.count, 3);
expectOk(await call('PUT', 'api/profile/tiles', { cookie:aliceCookie, body:{ tiles:webProfile.tiles, preferences:webProfile.preferences } }), 'web tile save');
const afterWebSave = expectOk(await call('GET', 'api/grev-home/profile-tiles', { token:alice.accessToken }), 'tiles after web save');
assert.deepEqual(afterWebSave.tiles.map(item => item.widget).sort(), ['best-friends', 'bio', 'favourite-games', 'recent-games']);
const webWidgets = expectOk(await call('GET', `api/profile/widgets/${alice.account.userId}`, { cookie:bobCookie }), 'web widgets');
assert.equal(webWidgets.relationship, 'friend');
assert.equal(Object.values(webWidgets.widgets).find(value => value.widget === 'recent-games').items[0].appId, 'retroarch');
step('unified profile: widgets, identity, favourites, best friends, web round-trip');

// GrevDadSaveSyncService: HEAD (none) -> PUT -> HEAD -> GET on a second device of the same account
assert.equal((await call('HEAD', 'api/grev-home/saves/retroarch', { token:alice.accessToken })).status, 404);
const archive = new TextEncoder().encode(`PK fake save ${run}`);
const sha = createHash('sha256').update(archive).digest('hex').toUpperCase();
const put = expectOk(await call('PUT', 'api/grev-home/saves/retroarch', { token:alice.accessToken, raw:archive,
  headers:{ 'Content-Type':'application/zip', 'X-Grev-Content-SHA256':sha } }), 'save upload');
hasFields(put, ['apiVersion', 'exists', 'sizeBytes', 'updatedAtUtc'], 'GrevDadSaveApiResponse');
const head = await call('HEAD', 'api/grev-home/saves/retroarch', { token:alice.accessToken });
assert.equal(head.status, 200);
assert.equal(head.headers.get('X-Grev-Updated-At'), put.updatedAtUtc);

const alice2 = await linkDevice(aliceCookie, { grevId:grevId('Alice'), username:'Alice', displayName:'Alice', device:'ALICE-LAPTOP' });
assert.equal(alice2.account.userId, alice.account.userId, 'a second device links to the same account');
const download = await call('GET', 'api/grev-home/saves/retroarch', { token:alice2.accessToken });
assert.equal(download.status, 200);
assert.equal(download.headers.get('X-Grev-Content-SHA256'), sha);
assert.deepEqual(download.payload, archive);
const restored = expectOk(await call('GET', 'api/grev-home/account-data', { token:alice2.accessToken }), 'account-data on new device');
assert.deepEqual(restored.cloudSaves.map(save => save.appId), ['retroarch'], 'a new device can see which cloud saves exist');
assert.equal((await call('HEAD', 'api/grev-home/saves/retroarch', { token:bob.accessToken })).status, 404, 'saves are per account');
step('cloud saves upload, conflict check and restore on a second device');

// GrevDadConnectionMaintenanceService.RotateCredentialAsync then GrevDadAccountService.UnlinkAsync
const rotated = expectOk(await call('POST', 'api/grev-home/token/rotate', { token:alice2.accessToken }), 'token rotate');
hasFields(rotated, ['apiVersion', 'accessToken', 'tokenExpiresAt', 'previousTokenValidUntil'], 'GrevDadRotateTokenApiResponse');
expectOk(await call('GET', 'api/grev-home/me', { token:rotated.accessToken }), 'me with rotated token');
expectOk(await call('POST', 'api/grev-home/token/revoke', { token:rotated.accessToken }), 'unlink this device');
assert.equal((await call('GET', 'api/grev-home/me', { token:rotated.accessToken })).status, 401, 'revoked token is refused');
expectOk(await call('GET', 'api/grev-home/me', { token:alice.accessToken }), 'other device stays linked');
step('token rotation and per-device unlink');

// Cleanup that also exercises the remaining friend route.
expectOk(await call('DELETE', `api/grev-home/friends/${bob.account.userId}`, { token:alice.accessToken }), 'remove friend');
step('remove friend');

for (const name of steps) console.log(`  ok  ${name}`);
console.log(`Grev Home <-> Grev.dad end-to-end passed against ${base}.`);
