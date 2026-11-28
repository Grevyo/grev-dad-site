// grev.dad v2 website API: the Grev Home companion site. Session-cookie authenticated, same-origin
// for writes. Profiles, friends and messages reuse the exact code Grev Home's own API uses, so the
// website and the console always agree; Home tiles use the same tile format as profile tiles.
import { friendCodeFor, sessionUser, type GrevHomeEnv } from './grev-home';
import { buildProfileDocument, handleProfileExtrasFor, resolveOwnerWidgets, type UnifiedProfileEnv } from './profile-unified';
import { identityPatchFromInput, writeCanonicalIdentity, readCanonicalIdentity, type IdentityDatabase } from './profile-identity';
import { saveProfileTilesForSync, tileFromInput, overlaps, MAX_TILES } from './profile';
import { isProfileWidget, widgetFromRow, MAX_WIDGET_ITEMS, MIN_WIDGET_ITEMS } from './profile-widgets';
import { json } from './shared/http-security';

export type SiteEnv = UnifiedProfileEnv & { GREV_HOME_SAVES?: unknown };
type User = NonNullable<Awaited<ReturnType<typeof sessionUser>>>;
type Tile = NonNullable<ReturnType<typeof tileFromInput>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CARD_COLUMNS = 4;
const CARD_ROWS = 6;
/** Widgets only the Home page offers (the profile widgets are available there too). */
export const HOME_WIDGETS = ['friends-online', 'grev-home', 'cloud-saves', 'consoles', 'clock'] as const;
type HomeWidget = typeof HOME_WIDGETS[number];
const HOME_WIDGET_SET = new Set<string>(HOME_WIDGETS);

const nowSeconds = () => Math.floor(Date.now() / 1000);

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  return !origin || origin === new URL(request.url).origin;
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  if (!(request.headers.get('Content-Type') ?? '').includes('application/json')) return null;
  try {
    const value: unknown = await request.json();
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch { return null; }
}

// --- session summary ---------------------------------------------------------------------------

async function sessionSummary(env: SiteEnv, user: User) {
  const [identity, requests, unread, link] = await Promise.all([
    readCanonicalIdentity(env.DB as unknown as IdentityDatabase, user.id, null),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM grev_home_friend_requests WHERE recipient_user_id=? AND status='pending'`)
      .bind(user.id).first<{ count: number }>(),
    env.DB.prepare(`SELECT COALESCE(SUM((SELECT COUNT(*) FROM chat_messages m WHERE m.room_id=r.id AND m.sender_user_id<>?
        AND m.deleted_at IS NULL AND m.created_at>COALESCE(a.last_read_at,0))),0) AS count
      FROM chat_rooms r JOIN chat_members a ON a.room_id=r.id AND a.user_id=? WHERE r.room_type='direct'`)
      .bind(user.id, user.id).first<{ count: number }>(),
    env.DB.prepare(`SELECT id,last_seen_at FROM grev_home_links WHERE user_id=? AND revoked_at IS NULL`)
      .bind(user.id).first<{ id: string; last_seen_at: number | null }>()
  ]);
  return {
    user: { ...user, avatarMedia: identity.avatarMedia ?? null, headline: identity.headline ?? null },
    friendCode: await friendCodeFor(env as unknown as GrevHomeEnv, user.id),
    counts: { friendRequests: Number(requests?.count ?? 0), unreadMessages: Number(unread?.count ?? 0) },
    grevHome: { linked: Boolean(link), lastSeenAt: link?.last_seen_at ?? null }
  };
}

// --- profile -----------------------------------------------------------------------------------

/** Tiles plus the profile card's 4×6 block: neither may overlap, and the card must fit the grid. */
async function saveProfileLayout(env: SiteEnv, user: User, body: Record<string, unknown>): Promise<Response> {
  const cardX = Number(body.cardX), cardY = Number(body.cardY);
  if (!Number.isInteger(cardX) || !Number.isInteger(cardY) || cardX < 0 || cardY < 0 || cardX + CARD_COLUMNS > 8 || cardY > 194) {
    return json({ ok: false, message: 'The profile card must stay inside the grid.' }, 400);
  }
  if (!Array.isArray(body.tiles)) return json({ ok: false, message: 'Send the profile tiles.' }, 400);
  const card = { x: cardX, y: cardY, width: CARD_COLUMNS, height: CARD_ROWS };
  for (const raw of body.tiles) {
    const tile = tileFromInput(raw);
    if (tile && overlaps(tile, card as Tile)) return json({ ok: false, message: 'Tiles cannot overlap the profile card.' }, 400);
  }
  const saved = await saveProfileTilesForSync(env, user.id, body.tiles);
  if (!saved.ok) return json({ ok: false, message: saved.message }, 400);
  await env.DB.prepare(`INSERT INTO user_profile_canvas_positions(user_id,card_x,card_y,updated_at) VALUES(?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET card_x=excluded.card_x,card_y=excluded.card_y,updated_at=excluded.updated_at`)
    .bind(user.id, cardX, cardY, nowSeconds()).run();
  const profile = await buildProfileDocument(env, user.id, viewerOf(user), true);
  return json({ ok: true, profile });
}

const viewerOf = (user: User) => ({ id: user.id, isVerified: user.isVerified, isAdmin: user.isAdmin });

// --- Home tiles --------------------------------------------------------------------------------

type HomeTile = Omit<Tile, 'widget'> & { widget: string | null };

/** The profile tile parser, plus Home-only widget kinds (stored on text tiles like profile widgets). */
function homeTileFromInput(raw: unknown): HomeTile | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const kind = String(input.widget ?? '');
  if (!HOME_WIDGET_SET.has(kind)) return tileFromInput(raw);
  const tile = tileFromInput({ ...input, widget: null, widgetConfig: {}, tileType: 'text' });
  if (!tile) return null;
  const count = Number((input.widgetConfig as Record<string, unknown> | undefined)?.count);
  const widgetConfig = Number.isInteger(count) ? { count: Math.max(MIN_WIDGET_ITEMS, Math.min(MAX_WIDGET_ITEMS, count)) } : {};
  return { ...tile, widget: kind, widgetConfig };
}

type HomeRow = {
  tile_id: string; tile_type: string; grid_x: number; grid_y: number; tile_width: number; tile_height: number;
  title: string | null; body: string | null; link_label: string | null; link_url: string | null; stat_value: string | null;
  background_type: string; background_primary: string; background_secondary: string; background_angle: number;
  background_media: string | null; media_fit: string; media_overlay: string; text_colour: string; border_colour: string;
  font_family: string; widget: string | null; widget_config: string | null;
};

function homeTileFromRow(row: HomeRow) {
  let widget: string | null = null, widgetConfig: Record<string, unknown> = {};
  if (row.widget && HOME_WIDGET_SET.has(row.widget)) {
    widget = row.widget;
    try { const parsed = JSON.parse(row.widget_config ?? '{}'); if (parsed && typeof parsed === 'object') widgetConfig = parsed; } catch {}
  } else if (row.widget) {
    const parsed = widgetFromRow(row.widget, row.widget_config);
    widget = parsed.widget; widgetConfig = parsed.widgetConfig;
  }
  return {
    tileId: row.tile_id, tileType: row.tile_type, x: row.grid_x, y: row.grid_y, width: row.tile_width, height: row.tile_height,
    title: row.title, body: row.body, linkLabel: row.link_label, linkUrl: row.link_url, statValue: row.stat_value,
    backgroundType: row.background_type, backgroundPrimary: row.background_primary, backgroundSecondary: row.background_secondary,
    backgroundAngle: row.background_angle, backgroundMedia: row.background_media, mediaFit: row.media_fit,
    mediaOverlay: row.media_overlay, textColour: row.text_colour, borderColour: row.border_colour, fontFamily: row.font_family,
    widget, widgetConfig
  };
}

/** A new member's starting Home: what Grev Home is, who's online, and their own games and stats. */
function starterTiles(linked: boolean): Record<string, unknown>[] {
  const base = { tileType: 'text', title: null, body: null, linkLabel: null, linkUrl: null, statValue: null, backgroundType: 'solid',
    backgroundPrimary: '#11161d', backgroundSecondary: '#3157c9', backgroundAngle: 135, backgroundMedia: null, mediaFit: 'cover',
    mediaOverlay: 'dark', textColour: '#f4f7fb', borderColour: '#394657', fontFamily: 'system', widgetConfig: {} };
  const tile = (widget: string, x: number, y: number, width: number, height: number, title: string) =>
    ({ ...base, tileId: crypto.randomUUID(), widget, x, y, width, height, title });
  return linked
    ? [tile('friends-online', 0, 0, 3, 2, 'Friends online'), tile('recent-games', 3, 0, 5, 2, 'Recent games'),
       tile('stats', 0, 2, 3, 2, 'Your stats'), tile('cloud-saves', 3, 2, 3, 2, 'Cloud saves'), tile('consoles', 6, 2, 2, 2, 'Consoles')]
    : [tile('grev-home', 0, 0, 5, 2, 'Get Grev Home'), tile('friends-online', 5, 0, 3, 2, 'Friends online'),
       tile('stats', 0, 2, 3, 2, 'Your stats'), tile('best-friends', 3, 2, 5, 2, 'Best friends')];
}

async function readHomeTiles(env: SiteEnv, userId: string) {
  const rows = await env.DB.prepare(`SELECT tile_id,tile_type,grid_x,grid_y,tile_width,tile_height,title,body,link_label,link_url,stat_value,
      background_type,background_primary,background_secondary,background_angle,background_media,media_fit,media_overlay,
      text_colour,border_colour,font_family,widget,widget_config
    FROM user_home_tiles WHERE user_id=? ORDER BY grid_y,grid_x,position`).bind(userId).all<HomeRow>();
  return rows.results.map(homeTileFromRow);
}

async function writeHomeTiles(env: SiteEnv, userId: string, rawTiles: unknown): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!Array.isArray(rawTiles) || rawTiles.length > MAX_TILES) return { ok: false, message: `Home can have up to ${MAX_TILES} tiles.` };
  const tiles: HomeTile[] = [];
  const seen = new Set<string>();
  let mediaBytes = 0;
  for (const raw of rawTiles) {
    const tile = homeTileFromInput(raw);
    if (!tile || seen.has(tile.tileId)) return { ok: false, message: 'Home contains an invalid or duplicate tile.' };
    if (tiles.some(other => overlaps(other as Tile, tile as Tile))) return { ok: false, message: 'Tiles cannot overlap.' };
    if (tile.backgroundMedia) mediaBytes += tile.backgroundMedia.length * 0.75;
    if (mediaBytes > 8 * 1024 * 1024) return { ok: false, message: 'Home tile pictures may use up to 8 MB in total.' };
    seen.add(tile.tileId);
    tiles.push(tile);
  }
  const now = nowSeconds();
  const statements = [env.DB.prepare(`DELETE FROM user_home_tiles WHERE user_id=?`).bind(userId)];
  tiles.forEach((t, position) => statements.push(env.DB.prepare(`INSERT INTO user_home_tiles(
      user_id,tile_id,tile_type,position,grid_x,grid_y,tile_width,tile_height,title,body,link_label,link_url,stat_value,
      background_type,background_primary,background_secondary,background_angle,background_media,media_fit,media_overlay,
      text_colour,border_colour,font_family,widget,widget_config,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      userId, t.tileId, t.tileType, position, t.x, t.y, t.width, t.height, t.title, t.body, t.linkLabel, t.linkUrl, t.statValue,
      t.backgroundType, t.backgroundPrimary, t.backgroundSecondary, t.backgroundAngle, t.backgroundMedia, t.mediaFit, t.mediaOverlay,
      t.textColour, t.borderColour, t.fontFamily, t.widget, JSON.stringify(t.widgetConfig ?? {}), now)));
  statements.push(env.DB.prepare(`INSERT INTO user_home_state(user_id,initialized_at,updated_at) VALUES(?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET updated_at=excluded.updated_at`).bind(userId, now, now));
  await env.DB.batch(statements);
  return { ok: true };
}

/** Data for the Home-only widgets. */
async function resolveHomeWidgets(env: SiteEnv, user: User, tiles: ReturnType<typeof homeTileFromRow>[]) {
  const kinds = new Set(tiles.map(t => t.widget).filter((w): w is string => Boolean(w)));
  const out: Record<string, unknown> = {};
  const want = (k: HomeWidget) => kinds.has(k);
  const [friends, devices, saves] = await Promise.all([
    want('friends-online') ? env.DB.prepare(`SELECT u.id,u.display_name,u.username,p.availability,p.activity_type,p.activity_text,p.status_text,p.expires_at
        FROM grev_home_friendships f
        JOIN users u ON u.id=CASE WHEN f.user_low_id=? THEN f.user_high_id ELSE f.user_low_id END AND u.status='active'
        LEFT JOIN user_presence p ON p.user_id=u.id
        WHERE (f.user_low_id=? OR f.user_high_id=?)
        ORDER BY CASE WHEN p.expires_at>? AND p.availability<>'offline' THEN 0 ELSE 1 END,u.display_name LIMIT 24`)
      .bind(user.id, user.id, user.id, nowSeconds()).all<{ id: string; display_name: string; username: string; availability: string | null;
        activity_type: string | null; activity_text: string | null; status_text: string | null; expires_at: number | null }>() : null,
    want('consoles') ? env.DB.prepare(`SELECT t.id,t.device_name,t.last_used_at,l.grev_id,l.local_display_name FROM grev_home_tokens t
        JOIN grev_home_links l ON l.id=t.link_id WHERE l.user_id=? AND l.revoked_at IS NULL AND t.revoked_at IS NULL AND t.expires_at>?
        ORDER BY COALESCE(t.last_used_at,t.created_at) DESC LIMIT 6`).bind(user.id, nowSeconds())
      .all<{ id: string; device_name: string; last_used_at: number | null; grev_id: string; local_display_name: string }>() : null,
    want('cloud-saves') ? env.DB.prepare(`SELECT app_id,size_bytes,updated_at_ms FROM grev_home_cloud_saves WHERE user_id=? ORDER BY updated_at_ms DESC LIMIT 8`)
      .bind(user.id).all<{ app_id: string; size_bytes: number; updated_at_ms: number }>() : null
  ]);
  const now = nowSeconds();
  for (const tile of tiles) {
    switch (tile.widget) {
      case 'friends-online': {
        const items = (friends?.results ?? []).map(f => {
          const online = Boolean(f.expires_at && f.expires_at > now && f.availability && f.availability !== 'offline');
          return { userId: f.id, displayName: f.display_name, username: f.username, online,
            playing: online && f.activity_type === 'playing' ? f.activity_text : null, status: online ? f.status_text : null };
        });
        out[tile.tileId] = { widget: tile.widget, items, onlineCount: items.filter(i => i.online).length }; break;
      }
      case 'consoles':
        out[tile.tileId] = { widget: tile.widget, items: (devices?.results ?? []).map(d => ({ id: d.id, deviceName: d.device_name, lastUsedAt: d.last_used_at, profile: d.local_display_name })) }; break;
      case 'cloud-saves':
        out[tile.tileId] = { widget: tile.widget, available: Boolean(env.GREV_HOME_SAVES),
          items: (saves?.results ?? []).map(s => ({ appId: s.app_id, sizeBytes: s.size_bytes, updatedAt: Math.floor(s.updated_at_ms / 1000) })) }; break;
      case 'grev-home': out[tile.tileId] = { widget: tile.widget, downloadUrl: '/download/grev-home' }; break;
      case 'clock': out[tile.tileId] = { widget: tile.widget }; break;
    }
  }
  return out;
}

async function homePayload(env: SiteEnv, user: User) {
  let tiles = await readHomeTiles(env, user.id);
  if (!tiles.length) {
    const state = await env.DB.prepare(`SELECT 1 AS ok FROM user_home_state WHERE user_id=?`).bind(user.id).first();
    if (!state) {
      const link = await env.DB.prepare(`SELECT 1 AS ok FROM grev_home_links WHERE user_id=? AND revoked_at IS NULL`).bind(user.id).first();
      const written = await writeHomeTiles(env, user.id, starterTiles(Boolean(link)));
      if (written.ok) tiles = await readHomeTiles(env, user.id);
    }
  }
  const profileTiles = tiles.filter(t => isProfileWidget(t.widget)) as unknown as Parameters<typeof resolveOwnerWidgets>[2];
  const [profileWidgets, homeWidgets] = await Promise.all([
    resolveOwnerWidgets(env, user.id, profileTiles),
    resolveHomeWidgets(env, user, tiles)
  ]);
  return { tiles, widgets: { ...profileWidgets, ...homeWidgets } };
}

// --- cloud saves -------------------------------------------------------------------------------

async function listSaves(env: SiteEnv, user: User) {
  const rows = await env.DB.prepare(`SELECT app_id,size_bytes,source_grev_id,updated_at_ms FROM grev_home_cloud_saves WHERE user_id=? ORDER BY updated_at_ms DESC`)
    .bind(user.id).all<{ app_id: string; size_bytes: number; source_grev_id: string; updated_at_ms: number }>();
  return { available: Boolean(env.GREV_HOME_SAVES), saves: rows.results.map(r => ({ appId: r.app_id, sizeBytes: r.size_bytes, sourceGrevId: r.source_grev_id, updatedAt: Math.floor(r.updated_at_ms / 1000) })) };
}

// --- routing -----------------------------------------------------------------------------------

export async function handleSiteApiRequest(request: Request, env: SiteEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!path.startsWith('/api/v2/')) return null;
  if (request.method !== 'GET' && !sameOrigin(request)) return json({ ok: false, message: 'Origin rejected.' }, 403);
  const user = await sessionUser(request, env as unknown as GrevHomeEnv);
  if (!user) return json({ ok: false, message: 'Please log in again.' }, 401);

  if (path === '/api/v2/session' && request.method === 'GET') return json({ ok: true, ...await sessionSummary(env, user) });

  const profileMatch = path.match(/^\/api\/v2\/profiles\/([^/]+)$/);
  if (profileMatch && request.method === 'GET') {
    const target = profileMatch[1] === 'me' ? user.id : profileMatch[1]!.toLowerCase();
    if (!UUID.test(target)) {
      const byName = await env.DB.prepare(`SELECT id FROM users WHERE username=? COLLATE NOCASE AND status='active'`).bind(profileMatch[1]).first<{ id: string }>();
      if (!byName) return json({ ok: false, message: 'That profile could not be found.' }, 404);
      const profile = await buildProfileDocument(env, byName.id, viewerOf(user), true);
      return profile ? json({ ok: true, profile }) : json({ ok: false, message: 'That profile could not be found.' }, 404);
    }
    const profile = await buildProfileDocument(env, target, viewerOf(user), true);
    return profile ? json({ ok: true, profile }) : json({ ok: false, message: 'That profile could not be found.' }, 404);
  }
  if (path === '/api/v2/profile/identity' && request.method === 'PUT') {
    const body = await readBody(request);
    if (!body) return json({ ok: false, message: 'Send the profile details as JSON.' }, 400);
    const patch = identityPatchFromInput(body);
    if (typeof patch === 'string') return json({ ok: false, message: patch }, 400);
    const error = await writeCanonicalIdentity(env.DB as unknown as IdentityDatabase, user.id, patch, 'website');
    if (error) return json({ ok: false, message: error }, 413);
    return json({ ok: true, profile: await buildProfileDocument(env, user.id, viewerOf(user), true) });
  }
  if (path === '/api/v2/profile/layout' && request.method === 'PUT') {
    const body = await readBody(request);
    return body ? saveProfileLayout(env, user, body) : json({ ok: false, message: 'Send the layout as JSON.' }, 400);
  }
  const extras = path.match(/^\/api\/v2\/profile\/((?:favourites|best-friends|retroachievements)(?:\/.*)?)$/);
  if (extras) return await handleProfileExtrasFor(request, env, user.id, extras[1]!) ?? json({ ok: false, message: 'Not found.' }, 404);

  if (path === '/api/v2/home' && request.method === 'GET') return json({ ok: true, ...await homePayload(env, user) });
  if (path === '/api/v2/home' && request.method === 'PUT') {
    const body = await readBody(request);
    if (!body) return json({ ok: false, message: 'Send the tiles as JSON.' }, 400);
    const written = await writeHomeTiles(env, user.id, body.tiles);
    if (!written.ok) return json({ ok: false, message: written.message }, 400);
    return json({ ok: true, ...await homePayload(env, user) });
  }

  if (path === '/api/v2/saves' && request.method === 'GET') return json({ ok: true, ...await listSaves(env, user) });

  return json({ ok: false, message: 'Not found.' }, 404);
}
