// One profile, two front ends. This module serves the grev.dad profile (identity, tile layout,
// preferences) as a single document Grev Home can render, and resolves live widget tiles (recent
// games, game activity, most played, favourites, best friends, bio, stats, achievements,
// RetroAchievements) for whoever is looking at it.
//
// Routes (device Bearer token, see getDeviceContext):
//   GET    /api/grev-home/profile                     own profile document
//   GET    /api/grev-home/profiles/{userId}           a friend's profile document (friends only)
//   PUT    /api/grev-home/profile/identity            partial identity update
//   GET/PUT/POST/DELETE /api/grev-home/profile/favourites
//   GET/PUT/POST/DELETE /api/grev-home/profile/best-friends
//   GET/PUT/POST/DELETE /api/grev-home/profile/retroachievements
// Routes (grev.dad browser session):
//   GET    /api/profile/widgets/{userId}               resolved widget data for the profile page
//   GET/PUT/POST/DELETE /api/profile/favourites, /best-friends, /retroachievements
//
// Who sees what: the owner sees everything. Friends (grev_home_friendships) see session-history
// widgets (recent games, game activity, most played) for sessions shared with friends. Other
// signed-in members see the rest but not session history. Anyone blocked in either direction sees
// nothing. Field and tile privacy from the grev.dad editor applies on top of all of that.

import { getDeviceContext, cleanPublicCard, presencePayload, type GrevHomeEnv } from './grev-home';
import { getProfileTilesForSync, GRID_COLUMNS, MAX_GRID_Y, MAX_TILE_WIDTH, MAX_TILE_HEIGHT } from './profile';
import { loadProfilePrivacy, applyPrivacyToProfile, type PrivacyViewer } from './profile-privacy-hardening';
import { identityPatchFromInput, readCanonicalIdentity, writeCanonicalIdentity, type IdentityDatabase } from './profile-identity';
import { PROFILE_WIDGETS, widgetCount, type ProfileWidget, type WidgetConfig } from './profile-widgets';
import { json, parseCookies, sha256 } from './shared/http-security';

export type UnifiedProfileEnv = GrevHomeEnv & { RETROACHIEVEMENTS_API_KEY?: string };

type Db = UnifiedProfileEnv['DB'];
type Viewer = PrivacyViewer;
export type Relationship = 'self' | 'friend' | 'member';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COOKIE = 'grev_session';
export const MAX_FAVOURITES = 50;
export const MAX_BEST_FRIENDS = 12;
const RA_USERNAME = /^[A-Za-z0-9_]{2,32}$/;
const RA_CACHE_SECONDS = 30 * 60;
const RA_ERROR_RETRY_SECONDS = 5 * 60;
const RA_MEDIA = 'https://media.retroachievements.org';
const SESSION_WIDGETS = new Set<ProfileWidget>(['recent-games', 'game-activity', 'most-played']);

const nowSeconds = () => Math.floor(Date.now() / 1000);

// --- relationships -----------------------------------------------------------------------------

async function relationshipBetween(db: Db, ownerId: string, viewerId: string): Promise<Relationship | 'blocked'> {
  if (ownerId === viewerId) return 'self';
  const row = await db.prepare(`
    SELECT
      EXISTS(SELECT 1 FROM profile_blocks WHERE (owner_user_id=? AND blocked_user_id=?) OR (owner_user_id=? AND blocked_user_id=?)) AS blocked,
      EXISTS(SELECT 1 FROM grev_home_friendships WHERE user_low_id=MIN(?,?) AND user_high_id=MAX(?,?)) AS friend
  `).bind(ownerId, viewerId, viewerId, ownerId, ownerId, viewerId, ownerId, viewerId).first<{ blocked: number; friend: number }>();
  if (row?.blocked) return 'blocked';
  return row?.friend ? 'friend' : 'member';
}

// --- widget resolvers --------------------------------------------------------------------------

type Ctx = { env: UnifiedProfileEnv; ownerId: string; relationship: Relationship; viewer: Viewer; publicCard: Record<string, unknown> };

async function recentGames(ctx: Ctx, count: number) {
  const rows = await ctx.env.DB.prepare(`
    SELECT h.app_id,MAX(h.app_name) AS app_name,COALESCE(c.content_id,'') AS content_id,MAX(c.content_name) AS content_name,
      MAX(h.ended_at) AS last_played_at,SUM(h.duration_seconds) AS total_seconds,COUNT(*) AS sessions
    FROM grev_home_session_history h
    LEFT JOIN grev_home_session_content c ON c.link_id=h.link_id AND c.session_id=h.session_id
    WHERE h.user_id=? AND (?=1 OR h.visibility='friends')
    GROUP BY h.app_id,COALESCE(c.content_id,'')
    ORDER BY last_played_at DESC LIMIT ?
  `).bind(ctx.ownerId, ctx.relationship === 'self' ? 1 : 0, count).all<GameRow>();
  return { items: rows.results.map(gameItem) };
}

async function mostPlayed(ctx: Ctx, count: number) {
  const rows = await ctx.env.DB.prepare(`
    SELECT h.app_id,MAX(h.app_name) AS app_name,COALESCE(c.content_id,'') AS content_id,MAX(c.content_name) AS content_name,
      MAX(h.ended_at) AS last_played_at,SUM(h.duration_seconds) AS total_seconds,COUNT(*) AS sessions
    FROM grev_home_session_history h
    LEFT JOIN grev_home_session_content c ON c.link_id=h.link_id AND c.session_id=h.session_id
    WHERE h.user_id=? AND (?=1 OR h.visibility='friends')
    GROUP BY h.app_id,COALESCE(c.content_id,'')
    ORDER BY total_seconds DESC LIMIT ?
  `).bind(ctx.ownerId, ctx.relationship === 'self' ? 1 : 0, count).all<GameRow>();
  return { items: rows.results.map(gameItem) };
}

type GameRow = {
  app_id: string; app_name: string; content_id: string; content_name: string | null;
  last_played_at: number; total_seconds: number; sessions: number;
};

function gameItem(row: GameRow) {
  return {
    appId: row.app_id,
    appName: row.app_name,
    contentId: row.content_id || null,
    title: row.content_name || row.app_name,
    lastPlayedAt: Number(row.last_played_at),
    totalSeconds: Math.max(0, Number(row.total_seconds)),
    sessions: Number(row.sessions)
  };
}

async function gameActivity(ctx: Ctx, count: number) {
  const [presence, rows] = await Promise.all([
    ctx.env.DB.prepare(`SELECT availability,status_text,activity_type,activity_text,expires_at,updated_at FROM user_presence WHERE user_id=?`)
      .bind(ctx.ownerId).first<{ availability: string; status_text: string; activity_type: string; activity_text: string; expires_at: number | null; updated_at: number }>(),
    ctx.env.DB.prepare(`
      SELECT h.app_id,h.app_name,c.content_id,c.content_name,h.started_at,h.ended_at,h.duration_seconds
      FROM grev_home_session_history h
      LEFT JOIN grev_home_session_content c ON c.link_id=h.link_id AND c.session_id=h.session_id
      WHERE h.user_id=? AND h.outcome='exited' AND (?=1 OR h.visibility='friends')
      ORDER BY h.ended_at DESC LIMIT ?
    `).bind(ctx.ownerId, ctx.relationship === 'self' ? 1 : 0, count).all<{
      app_id: string; app_name: string; content_id: string | null; content_name: string | null;
      started_at: number; ended_at: number; duration_seconds: number;
    }>()
  ]);
  const live = presencePayload(presence);
  return {
    nowPlaying: live.activityType === 'playing' && live.activityText ? { title: live.activityText, since: live.updatedAt } : null,
    availability: ctx.publicCard.showStatus === false && ctx.relationship !== 'self' ? null : live.availability,
    sessions: rows.results.map(row => ({
      appId: row.app_id,
      appName: row.app_name,
      contentId: row.content_id,
      title: row.content_name || row.app_name,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      durationSeconds: row.duration_seconds
    }))
  };
}

export async function readFavourites(db: Db, userId: string, limit = MAX_FAVOURITES) {
  const rows = await db.prepare(`
    SELECT item_key,title,platform,app_id,content_id,added_at FROM user_favourite_games
    WHERE user_id=? ORDER BY position,added_at LIMIT ?
  `).bind(userId, limit).all<{ item_key: string; title: string; platform: string; app_id: string; content_id: string; added_at: number }>();
  return rows.results.map(row => ({
    itemKey: row.item_key, title: row.title, platform: row.platform,
    appId: row.app_id || null, contentId: row.content_id || null, addedAt: row.added_at
  }));
}

/**
 * Best friends who are still friends and active. Anyone with a block between them and the owner
 * or the viewer is left out, so the widget never reveals someone the viewer cannot otherwise see.
 */
export async function readBestFriends(db: Db, userId: string, viewerId: string, limit = MAX_BEST_FRIENDS) {
  const rows = await db.prepare(`
    SELECT u.id,u.username,u.display_name,u.is_verified,b.position,
      p.availability,p.status_text,p.activity_type,p.activity_text,p.expires_at,p.updated_at,
      (SELECT m.media_data FROM user_profile_media m WHERE m.user_id=u.id AND m.media_slot='avatar') AS avatar_media,
      (SELECT fp.visibility FROM user_profile_field_privacy fp WHERE fp.user_id=u.id AND fp.field_key='avatar') AS avatar_visibility
    FROM user_best_friends b
    JOIN users u ON u.id=b.friend_user_id AND u.status='active'
    LEFT JOIN user_presence p ON p.user_id=u.id
    WHERE b.user_id=?
      AND EXISTS(SELECT 1 FROM grev_home_friendships f WHERE f.user_low_id=MIN(b.user_id,u.id) AND f.user_high_id=MAX(b.user_id,u.id))
      AND NOT EXISTS(SELECT 1 FROM profile_blocks x WHERE x.owner_user_id IN (?,?,u.id) AND x.blocked_user_id IN (?,?,u.id) AND x.owner_user_id<>x.blocked_user_id
        AND u.id IN (x.owner_user_id,x.blocked_user_id))
    ORDER BY b.position,b.added_at LIMIT ?
  `).bind(userId, userId, viewerId, userId, viewerId, limit).all<{
    id: string; username: string; display_name: string; is_verified: number; position: number;
    availability: string | null; status_text: string | null; activity_type: string | null; activity_text: string | null;
    expires_at: number | null; updated_at: number | null; avatar_media: string | null; avatar_visibility: string | null;
  }>();
  return rows.results.map(row => {
    const presence = presencePayload(row.availability ? {
      availability: row.availability, status_text: row.status_text ?? '', activity_type: row.activity_type ?? 'none',
      activity_text: row.activity_text ?? '', expires_at: row.expires_at, updated_at: row.updated_at ?? 0
    } : null);
    return {
      userId: row.id,
      username: row.username,
      displayName: row.display_name,
      isVerified: Boolean(row.is_verified),
      // Only an avatar its owner shows to everyone; a restricted one would need a per-friend
      // privacy lookup for a thumbnail.
      avatarMedia: !row.avatar_visibility || row.avatar_visibility === 'all' || row.id === viewerId ? row.avatar_media : null,
      availability: presence.availability,
      activityText: presence.activityType === 'playing' ? presence.activityText : ''
    };
  });
}

async function stats(ctx: Ctx) {
  const row = await ctx.env.DB.prepare(`
    SELECT COALESCE((SELECT total_xp FROM user_progression WHERE user_id=?),0) AS total_xp,
      COALESCE((SELECT SUM(total_seconds) FROM grev_home_profile_sources WHERE user_id=?),0) AS total_seconds,
      COALESCE((SELECT SUM(completed_sessions) FROM grev_home_profile_sources WHERE user_id=?),0) AS completed_sessions,
      COALESCE((SELECT COUNT(DISTINCT app_id) FROM grev_home_session_history WHERE user_id=?),0) AS unique_apps,
      COALESCE((SELECT COUNT(*) FROM user_achievements WHERE user_id=?),0) AS achievements,
      (SELECT created_at FROM users WHERE id=?) AS member_since
  `).bind(ctx.ownerId, ctx.ownerId, ctx.ownerId, ctx.ownerId, ctx.ownerId, ctx.ownerId).first<{
    total_xp: number; total_seconds: number; completed_sessions: number; unique_apps: number; achievements: number; member_since: number;
  }>();
  const self = ctx.relationship === 'self';
  const show = (key: string) => self || ctx.publicCard[key] !== false;
  const xp = Number(row?.total_xp ?? 0);
  return {
    level: show('showLevel') ? Math.floor(xp / 500) + 1 : null,
    totalXp: show('showXp') ? xp : null,
    totalTrackedSeconds: show('showPlaytime') ? Number(row?.total_seconds ?? 0) : null,
    completedSessions: show('showSessions') ? Number(row?.completed_sessions ?? 0) : null,
    uniqueApps: Number(row?.unique_apps ?? 0),
    achievements: Number(row?.achievements ?? 0),
    memberSince: row?.member_since ?? null
  };
}

async function achievements(ctx: Ctx, count: number) {
  const [rows, total] = await Promise.all([
    ctx.env.DB.prepare(`
      SELECT d.id,d.name,d.description,d.image_url,d.category,ua.awarded_at
      FROM user_achievements ua JOIN achievement_definitions d ON d.id=ua.achievement_id
      WHERE ua.user_id=? ORDER BY ua.awarded_at DESC LIMIT ?
    `).bind(ctx.ownerId, count).all<{ id: string; name: string; description: string; image_url: string; category: string; awarded_at: number }>(),
    ctx.env.DB.prepare(`SELECT COUNT(*) AS earned,(SELECT COUNT(*) FROM achievement_definitions WHERE is_active=1) AS available FROM user_achievements WHERE user_id=?`)
      .bind(ctx.ownerId).first<{ earned: number; available: number }>()
  ]);
  return {
    earned: Number(total?.earned ?? 0),
    available: Number(total?.available ?? 0),
    items: rows.results.map(row => ({
      id: row.id, name: row.name, description: row.description, imageUrl: row.image_url || null,
      category: row.category, awardedAt: row.awarded_at
    }))
  };
}

// --- RetroAchievements -------------------------------------------------------------------------
//
// The site holds one RetroAchievements Web API key (secret RETROACHIEVEMENTS_API_KEY); people only
// tell us their RA username. Summaries are cached for 30 minutes so a busy profile costs one RA
// request per half hour, and only the fields the widget shows are kept. The key is never stored
// with the summary or sent to clients.

type RaSummary = {
  username: string;
  profileUrl: string;
  avatarUrl: string | null;
  motto: string | null;
  totalPoints: number;
  totalTruePoints: number;
  totalSoftcorePoints: number;
  rank: number | null;
  totalRanked: number | null;
  richPresence: string | null;
  lastGame: { gameId: number; title: string; console: string; iconUrl: string | null } | null;
  recentlyPlayed: { gameId: number; title: string; console: string; iconUrl: string | null; boxArtUrl: string | null; lastPlayed: string | null; achieved: number; total: number }[];
  recentAchievements: { id: number; title: string; description: string; points: number; gameId: number; gameTitle: string; badgeUrl: string | null; awardedAt: string | null; hardcore: boolean }[];
};

const raMedia = (path: unknown) => typeof path === 'string' && path.startsWith('/') ? `${RA_MEDIA}${path}` : null;
const num = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const str = (value: unknown, max = 200) => typeof value === 'string' ? value.slice(0, max) : '';

/** Keeps the parts of API_GetUserSummary the widget shows. Defensive: RA fields can be absent. */
export function sanitiseRaSummary(username: string, raw: Record<string, unknown>): RaSummary {
  const awarded = raw.Awarded && typeof raw.Awarded === 'object' ? raw.Awarded as Record<string, Record<string, unknown>> : {};
  const played = Array.isArray(raw.RecentlyPlayed) ? raw.RecentlyPlayed : raw.RecentlyPlayed && typeof raw.RecentlyPlayed === 'object' ? [raw.RecentlyPlayed] : [];
  const recent: RaSummary['recentAchievements'] = [];
  const byGame = raw.RecentAchievements && typeof raw.RecentAchievements === 'object' ? raw.RecentAchievements as Record<string, unknown> : {};
  for (const game of Object.values(byGame)) {
    if (!game || typeof game !== 'object') continue;
    for (const item of Object.values(game as Record<string, unknown>)) {
      if (!item || typeof item !== 'object') continue;
      const achievement = item as Record<string, unknown>;
      if (String(achievement.IsAwarded ?? '1') === '0') continue;
      recent.push({
        id: num(achievement.ID),
        title: str(achievement.Title, 120),
        description: str(achievement.Description, 300),
        points: num(achievement.Points),
        gameId: num(achievement.GameID),
        gameTitle: str(achievement.GameTitle, 160),
        badgeUrl: achievement.BadgeName ? `${RA_MEDIA}/Badge/${encodeURIComponent(String(achievement.BadgeName))}.png` : null,
        awardedAt: str(achievement.DateAwarded, 40) || null,
        hardcore: num(achievement.HardcoreAchieved) === 1
      });
    }
  }
  recent.sort((a, b) => (b.awardedAt ?? '').localeCompare(a.awardedAt ?? ''));
  const lastGame = raw.LastGame && typeof raw.LastGame === 'object' ? raw.LastGame as Record<string, unknown> : null;
  const name = str(raw.User, 40) || username;
  return {
    username: name,
    profileUrl: `https://retroachievements.org/user/${encodeURIComponent(name)}`,
    avatarUrl: raMedia(raw.UserPic),
    motto: str(raw.Motto, 120) || null,
    totalPoints: num(raw.TotalPoints),
    totalTruePoints: num(raw.TotalTruePoints),
    totalSoftcorePoints: num(raw.TotalSoftcorePoints),
    rank: raw.Rank == null ? null : num(raw.Rank),
    totalRanked: raw.TotalRanked == null ? null : num(raw.TotalRanked),
    richPresence: str(raw.RichPresenceMsg, 200) || null,
    lastGame: lastGame ? { gameId: num(lastGame.ID), title: str(lastGame.Title, 160), console: str(lastGame.ConsoleName, 60), iconUrl: raMedia(lastGame.ImageIcon) } : null,
    recentlyPlayed: played.slice(0, 12).filter(item => item && typeof item === 'object').map(item => {
      const game = item as Record<string, unknown>;
      const progress = awarded[String(game.GameID)] ?? {};
      return {
        gameId: num(game.GameID),
        title: str(game.Title, 160),
        console: str(game.ConsoleName, 60),
        iconUrl: raMedia(game.ImageIcon),
        boxArtUrl: raMedia(game.ImageBoxArt),
        lastPlayed: str(game.LastPlayed, 40) || null,
        achieved: num(progress.NumAchieved),
        total: num(progress.NumPossibleAchievements ?? game.AchievementsTotal)
      };
    }),
    recentAchievements: recent.slice(0, 12)
  };
}

type RaRow = { ra_username: string; summary_json: string | null; fetched_at: number | null; last_error: string | null };

async function fetchRaSummary(env: UnifiedProfileEnv, username: string): Promise<{ summary: RaSummary } | { error: string; notFound?: boolean }> {
  if (!env.RETROACHIEVEMENTS_API_KEY) return { error: 'RetroAchievements is not configured on this server yet.' };
  const url = new URL('https://retroachievements.org/API/API_GetUserSummary.php');
  url.searchParams.set('u', username);
  url.searchParams.set('g', '12');
  url.searchParams.set('a', '12');
  url.searchParams.set('y', env.RETROACHIEVEMENTS_API_KEY);
  try {
    const response = await fetch(url.toString(), { headers: { Accept: 'application/json', 'User-Agent': 'grev.dad profile widgets' }, signal: AbortSignal.timeout(8000) });
    if (response.status === 404) return { error: 'That RetroAchievements user was not found.', notFound: true };
    if (!response.ok) return { error: `RetroAchievements answered ${response.status}.` };
    const raw = await response.json() as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !('User' in raw || 'TotalPoints' in raw)) {
      return { error: 'That RetroAchievements user was not found.', notFound: true };
    }
    return { summary: sanitiseRaSummary(username, raw as Record<string, unknown>) };
  } catch {
    return { error: 'RetroAchievements could not be reached.' };
  }
}

/** Cached summary, refreshed when stale. Never throws; a failed refresh keeps the last summary. */
async function readRetroAchievements(env: UnifiedProfileEnv, userId: string, forceRefresh = false) {
  const row = await env.DB.prepare(`SELECT ra_username,summary_json,fetched_at,last_error FROM user_retroachievements WHERE user_id=?`)
    .bind(userId).first<RaRow>();
  if (!row) return { linked: false as const, configured: Boolean(env.RETROACHIEVEMENTS_API_KEY) };
  let summary: RaSummary | null = null;
  try { summary = row.summary_json ? JSON.parse(row.summary_json) as RaSummary : null; } catch { summary = null; }
  let fetchedAt = row.fetched_at;
  let lastError = row.last_error;
  const age = nowSeconds() - (fetchedAt ?? 0);
  const due = forceRefresh || !fetchedAt || age >= (lastError && !summary ? RA_ERROR_RETRY_SECONDS : RA_CACHE_SECONDS);
  if (due && env.RETROACHIEVEMENTS_API_KEY) {
    const result = await fetchRaSummary(env, row.ra_username);
    fetchedAt = nowSeconds();
    if ('summary' in result) { summary = result.summary; lastError = null; }
    else lastError = result.error;
    await env.DB.prepare(`UPDATE user_retroachievements SET summary_json=?,fetched_at=?,last_error=? WHERE user_id=?`)
      .bind(summary ? JSON.stringify(summary) : null, fetchedAt, lastError, userId).run();
  }
  return {
    linked: true as const,
    configured: Boolean(env.RETROACHIEVEMENTS_API_KEY),
    username: row.ra_username,
    summary,
    fetchedAt,
    error: lastError
  };
}

async function retroAchievementsWidget(ctx: Ctx, count: number) {
  const state = await readRetroAchievements(ctx.env, ctx.ownerId);
  if (!state.linked) return { linked: false };
  const summary = state.summary;
  return {
    linked: true,
    username: state.username,
    error: ctx.relationship === 'self' ? state.error : null,
    summary: summary ? {
      ...summary,
      recentlyPlayed: summary.recentlyPlayed.slice(0, count),
      recentAchievements: summary.recentAchievements.slice(0, count)
    } : null
  };
}

// --- resolving every widget tile on a profile --------------------------------------------------

type TileLike = { tileId: string; widget: ProfileWidget | null; widgetConfig: WidgetConfig };

export async function resolveWidgets(ctx: Ctx, tiles: TileLike[], card: { headline: string | null; bio: string | null }) {
  const widgets: Record<string, unknown> = {};
  await Promise.all(tiles.filter(tile => tile.widget).map(async tile => {
    const widget = tile.widget!;
    const count = widgetCount(widget, tile.widgetConfig);
    if (SESSION_WIDGETS.has(widget) && ctx.relationship === 'member') {
      widgets[tile.tileId] = { widget, hidden: true, reason: 'friends-only' };
      return;
    }
    let data: unknown;
    switch (widget) {
      case 'recent-games': data = await recentGames(ctx, count); break;
      case 'most-played': data = await mostPlayed(ctx, count); break;
      case 'game-activity': data = await gameActivity(ctx, count); break;
      case 'favourite-games': data = { items: await readFavourites(ctx.env.DB, ctx.ownerId, count) }; break;
      case 'best-friends': data = { items: await readBestFriends(ctx.env.DB, ctx.ownerId, ctx.viewer.id, count) }; break;
      case 'bio': data = { headline: card.headline, bio: card.bio }; break;
      case 'stats': data = await stats(ctx); break;
      case 'achievements': data = await achievements(ctx, count); break;
      case 'retroachievements': data = await retroAchievementsWidget(ctx, count); break;
    }
    widgets[tile.tileId] = { widget, ...(data as Record<string, unknown>) };
  }));
  return widgets;
}

async function readPublicCardOptions(db: Db, userId: string): Promise<Record<string, unknown>> {
  const row = await db.prepare(`SELECT card_json FROM grev_home_public_cards WHERE user_id=?`).bind(userId).first<{ card_json: string }>();
  try { return cleanPublicCard(row?.card_json ? JSON.parse(row.card_json) : {}); } catch { return cleanPublicCard({}); }
}

/**
 * The whole profile as `viewer` may see it: identity, tiles with resolved widgets, preferences,
 * presence and card options. null when the profile does not exist or a block hides it.
 */
export async function buildProfileDocument(env: UnifiedProfileEnv, ownerId: string, viewer: Viewer, allowMembers: boolean) {
  if (!UUID.test(ownerId)) return null;
  const relationship = await relationshipBetween(env.DB, ownerId, viewer.id);
  if (relationship === 'blocked' || (relationship === 'member' && !allowMembers)) return null;
  const user = await env.DB.prepare(`
    SELECT u.id,u.username,u.display_name,u.is_verified,u.created_at,
      p.background_primary,p.background_secondary,p.background_angle,p.text_colour,p.border_colour,
      p.show_username,p.show_status,p.show_member_since,
      pr.density,pr.tile_gap,pr.outer_margin,cp.card_x,cp.card_y,
      COALESCE(up.total_xp,0) AS total_xp,
      (SELECT friend_code FROM grev_home_friend_codes WHERE user_id=u.id) AS friend_code,
      EXISTS(SELECT 1 FROM user_best_friends WHERE user_id=? AND friend_user_id=u.id) AS is_best_friend
    FROM users u
    LEFT JOIN user_profiles p ON p.user_id=u.id
    LEFT JOIN user_profile_preferences pr ON pr.user_id=u.id
    LEFT JOIN user_profile_canvas_positions cp ON cp.user_id=u.id
    LEFT JOIN user_progression up ON up.user_id=u.id
    WHERE u.id=? AND u.status='active'
  `).bind(viewer.id, ownerId).first<{
    id: string; username: string; display_name: string; is_verified: number; created_at: number;
    background_primary: string | null; background_secondary: string | null; background_angle: number | null;
    text_colour: string | null; border_colour: string | null; show_username: number | null; show_status: number | null;
    show_member_since: number | null; density: string | null; tile_gap: number | null; outer_margin: number | null;
    card_x: number | null; card_y: number | null; total_xp: number; friend_code: string | null; is_best_friend: number;
  }>();
  if (!user) return null;

  const [identity, tiles, presenceRow, publicCard, privacy] = await Promise.all([
    readCanonicalIdentity(env.DB as unknown as IdentityDatabase, ownerId, null),
    getProfileTilesForSync(env as unknown as Parameters<typeof getProfileTilesForSync>[0], ownerId),
    env.DB.prepare(`SELECT availability,status_text,activity_type,activity_text,expires_at,updated_at FROM user_presence WHERE user_id=?`)
      .bind(ownerId).first<{ availability: string; status_text: string; activity_type: string; activity_text: string; expires_at: number | null; updated_at: number }>(),
    readPublicCardOptions(env.DB, ownerId),
    loadProfilePrivacy(env.DB, ownerId, viewer)
  ]);

  const profile: Record<string, unknown> = {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    isVerified: Boolean(user.is_verified),
    createdAt: user.created_at,
    relationship,
    isSelf: relationship === 'self',
    isBestFriend: Boolean(user.is_best_friend),
    friendCode: relationship === 'self' ? user.friend_code : null,
    totalXp: Number(user.total_xp),
    level: Math.floor(Number(user.total_xp) / 500) + 1,
    presence: publicCard.showStatus === false && relationship !== 'self' ? null : presencePayload(presenceRow),
    publicCard: { ...publicCard, bio: undefined, avatarMedia: undefined, coverMedia: undefined },
    card: {
      displayName: user.display_name,
      ...identity,
      backgroundPrimary: user.background_primary ?? '#11161d',
      backgroundSecondary: user.background_secondary ?? '#3157c9',
      backgroundAngle: user.background_angle ?? 135,
      textColour: user.text_colour ?? '#f4f7fb',
      borderColour: user.border_colour ?? '#526074',
      showUsername: user.show_username !== 0,
      showStatus: user.show_status !== 0,
      showMemberSince: user.show_member_since !== 0
    },
    tiles: tiles.tiles,
    tilesUpdatedAt: tiles.updatedAt,
    preferences: {
      density: user.density ?? 'comfortable',
      tileGap: user.tile_gap ?? 12,
      outerMargin: user.outer_margin ?? 0,
      cardX: user.card_x ?? 0,
      cardY: user.card_y ?? 0
    },
    grid: { columns: GRID_COLUMNS, maxY: MAX_GRID_Y, maxTileWidth: MAX_TILE_WIDTH, maxTileHeight: MAX_TILE_HEIGHT, cardColumns: 4, cardRows: 6 },
    widgetKinds: PROFILE_WIDGETS
  };
  applyPrivacyToProfile(profile, privacy);
  const card = profile.card as { headline: string | null; bio: string | null };
  profile.widgets = await resolveWidgets(
    { env, ownerId, relationship, viewer, publicCard },
    profile.tiles as TileLike[],
    card
  );
  return profile;
}

// --- favourites, best friends, RetroAchievements management (shared by both front ends) -------

async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (!(request.headers.get('Content-Type') ?? '').includes('application/json')) throw new Error('JSON_REQUIRED');
  const value: unknown = await request.json();
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_BODY');
  return value as Record<string, unknown>;
}

type Favourite = { itemKey: string; title: string; platform: string; appId: string; contentId: string };

function favouriteFromInput(value: unknown): Favourite | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const itemKey = String(input.itemKey ?? '').trim();
  const title = String(input.title ?? '').trim();
  if (!/^[A-Za-z0-9:._\-/]{1,160}$/.test(itemKey) || !title || title.length > 160) return null;
  return {
    itemKey,
    title,
    platform: String(input.platform ?? '').trim().slice(0, 60),
    appId: String(input.appId ?? '').trim().slice(0, 80),
    contentId: String(input.contentId ?? '').trim().slice(0, 160)
  };
}

async function handleFavourites(request: Request, env: UnifiedProfileEnv, userId: string, itemKey: string | null): Promise<Response> {
  const db = env.DB;
  if (request.method === 'GET') return json({ ok: true, items: await readFavourites(db, userId) });
  const now = nowSeconds();
  if (request.method === 'DELETE') {
    const key = itemKey ?? new URL(request.url).searchParams.get('itemKey') ?? '';
    await db.prepare(`DELETE FROM user_favourite_games WHERE user_id=? AND item_key=?`).bind(userId, key).run();
    return json({ ok: true, items: await readFavourites(db, userId) });
  }
  const body = await readBody(request);
  if (request.method === 'POST') {
    const item = favouriteFromInput(body.item ?? body);
    if (!item) return json({ ok: false, message: 'Choose a game to favourite.' }, 400);
    const count = await db.prepare(`SELECT COUNT(*) AS n,COALESCE(MAX(position),-1) AS last FROM user_favourite_games WHERE user_id=?`)
      .bind(userId).first<{ n: number; last: number }>();
    const exists = await db.prepare(`SELECT 1 AS found FROM user_favourite_games WHERE user_id=? AND item_key=?`).bind(userId, item.itemKey).first();
    if (!exists && Number(count?.n ?? 0) >= MAX_FAVOURITES) return json({ ok: false, message: `You can favourite up to ${MAX_FAVOURITES} games.` }, 400);
    await db.prepare(`
      INSERT INTO user_favourite_games(user_id,item_key,title,platform,app_id,content_id,position,added_at) VALUES(?,?,?,?,?,?,?,?)
      ON CONFLICT(user_id,item_key) DO UPDATE SET title=excluded.title,platform=excluded.platform,app_id=excluded.app_id,content_id=excluded.content_id
    `).bind(userId, item.itemKey, item.title, item.platform, item.appId, item.contentId, Number(count?.last ?? -1) + 1, now).run();
    return json({ ok: true, items: await readFavourites(db, userId) });
  }
  if (request.method === 'PUT') {
    if (!Array.isArray(body.items) || body.items.length > MAX_FAVOURITES) return json({ ok: false, message: `You can favourite up to ${MAX_FAVOURITES} games.` }, 400);
    const items: Favourite[] = [];
    for (const value of body.items) {
      const item = favouriteFromInput(value);
      if (!item || items.some(existing => existing.itemKey === item.itemKey)) return json({ ok: false, message: 'The favourites list contains an invalid or duplicate game.' }, 400);
      items.push(item);
    }
    await db.batch([
      db.prepare(`DELETE FROM user_favourite_games WHERE user_id=?`).bind(userId),
      ...items.map((item, position) => db.prepare(`
        INSERT INTO user_favourite_games(user_id,item_key,title,platform,app_id,content_id,position,added_at) VALUES(?,?,?,?,?,?,?,?)
      `).bind(userId, item.itemKey, item.title, item.platform, item.appId, item.contentId, position, now))
    ]);
    return json({ ok: true, items: await readFavourites(db, userId) });
  }
  return json({ ok: false, message: 'Method not allowed.' }, 405);
}

async function areFriends(db: Db, a: string, b: string): Promise<boolean> {
  const row = await db.prepare(`
    SELECT 1 AS found FROM grev_home_friendships WHERE user_low_id=MIN(?,?) AND user_high_id=MAX(?,?)
      AND NOT EXISTS(SELECT 1 FROM profile_blocks WHERE (owner_user_id=? AND blocked_user_id=?) OR (owner_user_id=? AND blocked_user_id=?))
  `).bind(a, b, a, b, a, b, b, a).first();
  return Boolean(row);
}

async function handleBestFriends(request: Request, env: UnifiedProfileEnv, userId: string, friendId: string | null): Promise<Response> {
  const db = env.DB;
  const list = async () => json({ ok: true, items: await readBestFriends(db, userId, userId) });
  if (request.method === 'GET') return list();
  if (request.method === 'DELETE') {
    const id = friendId ?? new URL(request.url).searchParams.get('userId') ?? '';
    await db.prepare(`DELETE FROM user_best_friends WHERE user_id=? AND friend_user_id=?`).bind(userId, id).run();
    return list();
  }
  const body = await readBody(request);
  const now = nowSeconds();
  if (request.method === 'POST') {
    const id = String(body.userId ?? '');
    if (!UUID.test(id) || id === userId || !await areFriends(db, userId, id)) return json({ ok: false, message: 'Only friends can be best friends.' }, 400);
    const count = await db.prepare(`SELECT COUNT(*) AS n,COALESCE(MAX(position),-1) AS last FROM user_best_friends WHERE user_id=?`)
      .bind(userId).first<{ n: number; last: number }>();
    const exists = await db.prepare(`SELECT 1 AS found FROM user_best_friends WHERE user_id=? AND friend_user_id=?`).bind(userId, id).first();
    if (!exists && Number(count?.n ?? 0) >= MAX_BEST_FRIENDS) return json({ ok: false, message: `You can pick up to ${MAX_BEST_FRIENDS} best friends.` }, 400);
    if (!exists) {
      await db.prepare(`INSERT INTO user_best_friends(user_id,friend_user_id,position,added_at) VALUES(?,?,?,?)`)
        .bind(userId, id, Number(count?.last ?? -1) + 1, now).run();
    }
    return list();
  }
  if (request.method === 'PUT') {
    const ids = Array.isArray(body.userIds) ? body.userIds.map(String) : null;
    if (!ids || ids.length > MAX_BEST_FRIENDS || new Set(ids).size !== ids.length) {
      return json({ ok: false, message: `Pick up to ${MAX_BEST_FRIENDS} different best friends.` }, 400);
    }
    for (const id of ids) {
      if (!UUID.test(id) || id === userId || !await areFriends(db, userId, id)) return json({ ok: false, message: 'Only friends can be best friends.' }, 400);
    }
    await db.batch([
      db.prepare(`DELETE FROM user_best_friends WHERE user_id=?`).bind(userId),
      ...ids.map((id, position) => db.prepare(`INSERT INTO user_best_friends(user_id,friend_user_id,position,added_at) VALUES(?,?,?,?)`).bind(userId, id, position, now))
    ]);
    return list();
  }
  return json({ ok: false, message: 'Method not allowed.' }, 405);
}

async function handleRetroAchievements(request: Request, env: UnifiedProfileEnv, userId: string): Promise<Response> {
  const db = env.DB;
  if (request.method === 'GET') return json({ ok: true, retroAchievements: await readRetroAchievements(env, userId) });
  if (request.method === 'DELETE') {
    await db.prepare(`DELETE FROM user_retroachievements WHERE user_id=?`).bind(userId).run();
    return json({ ok: true, retroAchievements: await readRetroAchievements(env, userId) });
  }
  if (request.method === 'POST') {
    // Manual refresh, still limited so a held button cannot hammer RetroAchievements.
    const row = await db.prepare(`SELECT fetched_at FROM user_retroachievements WHERE user_id=?`).bind(userId).first<{ fetched_at: number | null }>();
    const recent = row?.fetched_at && nowSeconds() - row.fetched_at < 60;
    return json({ ok: true, retroAchievements: await readRetroAchievements(env, userId, !recent) });
  }
  if (request.method === 'PUT') {
    const body = await readBody(request);
    const username = String(body.username ?? '').trim();
    if (!RA_USERNAME.test(username)) return json({ ok: false, message: 'Enter your RetroAchievements username (letters, numbers and underscores).' }, 400);
    let summary: RaSummary | null = null;
    let error: string | null = null;
    let fetchedAt: number | null = null;
    if (env.RETROACHIEVEMENTS_API_KEY) {
      const result = await fetchRaSummary(env, username);
      if ('notFound' in result && result.notFound) return json({ ok: false, message: result.error }, 404);
      fetchedAt = nowSeconds();
      if ('summary' in result) summary = result.summary; else error = result.error;
    }
    const now = nowSeconds();
    await db.prepare(`
      INSERT INTO user_retroachievements(user_id,ra_username,summary_json,fetched_at,last_error,updated_at) VALUES(?,?,?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET ra_username=excluded.ra_username,summary_json=excluded.summary_json,
        fetched_at=excluded.fetched_at,last_error=excluded.last_error,updated_at=excluded.updated_at
    `).bind(userId, summary?.username ?? username, summary ? JSON.stringify(summary) : null, fetchedAt, error, now).run();
    return json({ ok: true, retroAchievements: await readRetroAchievements(env, userId) });
  }
  return json({ ok: false, message: 'Method not allowed.' }, 405);
}

/** /favourites, /best-friends and /retroachievements, after the caller has authenticated. */
async function handleProfileExtras(request: Request, env: UnifiedProfileEnv, userId: string, rest: string): Promise<Response | null> {
  const favourite = rest.match(/^favourites(?:\/(.+))?$/);
  if (favourite) return handleFavourites(request, env, userId, favourite[1] ? decodeURIComponent(favourite[1]) : null);
  const best = rest.match(/^best-friends(?:\/([0-9a-f-]{36}))?$/i);
  if (best) return handleBestFriends(request, env, userId, best[1] ?? null);
  if (rest === 'retroachievements') return handleRetroAchievements(request, env, userId);
  return null;
}

// --- routing -----------------------------------------------------------------------------------

export async function handleGrevHomeProfileRequest(request: Request, env: UnifiedProfileEnv): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (path !== '/api/grev-home/profile' && !path.startsWith('/api/grev-home/profile/') && !path.startsWith('/api/grev-home/profiles/')) return null;
  const context = await getDeviceContext(request, env);
  if (!context) return json({ ok: false, message: 'Grev Home link authentication required.' }, 401);
  const viewer: Viewer = { id: context.user.id, isVerified: context.user.isVerified, isAdmin: context.user.isAdmin };

  if (path === '/api/grev-home/profile' && request.method === 'GET') {
    return json({ ok: true, profile: await buildProfileDocument(env, viewer.id, viewer, true) });
  }
  const other = path.match(/^\/api\/grev-home\/profiles\/([0-9a-f-]{36})$/i);
  if (other && request.method === 'GET') {
    // Grev Home shows full profiles of friends only, matching who it can see elsewhere.
    const profile = await buildProfileDocument(env, other[1]!.toLowerCase(), viewer, false);
    return profile ? json({ ok: true, profile }) : json({ ok: false, message: 'Profile not found.' }, 404);
  }
  if (path === '/api/grev-home/profile/identity' && request.method === 'PUT') {
    const body = await readBody(request);
    const patch = identityPatchFromInput(body);
    if (typeof patch === 'string') return json({ ok: false, message: patch }, 400);
    const error = await writeCanonicalIdentity(env.DB as unknown as IdentityDatabase, viewer.id, patch, 'grev-home');
    if (error) return json({ ok: false, message: error }, 413);
    return json({ ok: true, profile: await buildProfileDocument(env, viewer.id, viewer, true) });
  }
  const extras = path.match(/^\/api\/grev-home\/profile\/(.+)$/);
  if (extras) {
    const response = await handleProfileExtras(request, env, viewer.id, extras[1]!);
    if (response) return response;
  }
  return json({ ok: false, message: 'Unknown Grev Home profile route.' }, 404);
}

async function sessionViewer(request: Request, env: UnifiedProfileEnv): Promise<Viewer | null> {
  const token = parseCookies(request)[COOKIE];
  if (!token) return null;
  const row = await env.DB.prepare(`
    SELECT u.id,u.is_verified,
      CASE WHEN u.is_owner=1 OR EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role_id='role-admin') THEN 1 ELSE 0 END AS is_admin
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.status='active'
  `).bind(await sha256(token), nowSeconds()).first<{ id: string; is_verified: number; is_admin: number }>();
  return row ? { id: row.id, isVerified: Boolean(row.is_verified), isAdmin: Boolean(row.is_admin) } : null;
}

export async function handleWebProfileWidgetsRequest(request: Request, env: UnifiedProfileEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const widgets = url.pathname.match(/^\/api\/profile\/widgets\/([0-9a-f-]{36})$/i);
  const extras = url.pathname.match(/^\/api\/profile\/((?:favourites|best-friends|retroachievements)(?:\/.*)?)$/);
  if (!widgets && !extras) return null;
  if (request.method !== 'GET') {
    const origin = request.headers.get('Origin');
    if (origin && origin !== url.origin) return json({ ok: false, message: 'Origin rejected.' }, 403);
  }
  const viewer = await sessionViewer(request, env);
  if (!viewer) return json({ ok: false, message: 'Authentication required.' }, 401);
  if (widgets && request.method === 'GET') {
    const profile = await buildProfileDocument(env, widgets[1]!.toLowerCase(), viewer, true);
    if (!profile) return json({ ok: false, message: 'Profile not found.' }, 404);
    return json({ ok: true, relationship: profile.relationship, widgets: profile.widgets, widgetKinds: PROFILE_WIDGETS });
  }
  if (extras) return await handleProfileExtras(request, env, viewer.id, extras[1]!) ?? json({ ok: false, message: 'Not found.' }, 404);
  return json({ ok: false, message: 'Method not allowed.' }, 405);
}
