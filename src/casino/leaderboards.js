import { getCasesDb } from '../lib/cases-binding.js';

export const CASINO_LEADERBOARD_REFRESH_MS = 6 * 60 * 60 * 1000;
const LEADERBOARD_SCOPE_ALL = 'all-games';
const LEADERBOARD_SCOPE_GAME = 'game';

function isoNow() {
  return new Date().toISOString();
}

function toCoinAmount(pence) {
  const value = Number(pence || 0);
  return Number.isFinite(value) ? value / 100 : 0;
}

function getRefreshWindow(date = new Date()) {
  const ms = date.getTime();
  const next = Math.ceil(ms / CASINO_LEADERBOARD_REFRESH_MS) * CASINO_LEADERBOARD_REFRESH_MS;
  const refreshed = next === ms ? ms : next - CASINO_LEADERBOARD_REFRESH_MS;
  return {
    refreshedAt: new Date(refreshed).toISOString(),
    nextRefreshAt: new Date(next || (ms + CASINO_LEADERBOARD_REFRESH_MS)).toISOString()
  };
}

async function ensureLeaderboardTables(env) {
  const db = getCasesDb(env);
  if (!db) return null;

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS casino_game_earnings (
      game_slug TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      net_pence INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (game_slug, user_id)
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS casino_leaderboard_snapshots (
      scope_type TEXT NOT NULL,
      scope_slug TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      refreshed_at TEXT NOT NULL,
      next_refresh_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (scope_type, scope_slug)
    )
  `).run();

  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_casino_game_earnings_user ON casino_game_earnings (user_id, updated_at DESC)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_casino_game_earnings_game ON casino_game_earnings (game_slug, net_pence DESC)`).run();
  return db;
}

export async function recordCasinoGameEarning(env, gameSlug, userId, netPence, updatedAt = isoNow()) {
  const db = await ensureLeaderboardTables(env);
  if (!db) return;
  const slug = String(gameSlug || '').trim().toLowerCase();
  const numericUserId = Number(userId || 0);
  const delta = Math.round(Number(netPence || 0));
  if (!slug || !Number.isInteger(numericUserId) || numericUserId <= 0 || !Number.isInteger(delta) || delta === 0) return;

  await db.prepare(`
    INSERT INTO casino_game_earnings (game_slug, user_id, net_pence, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(game_slug, user_id) DO UPDATE SET
      net_pence = casino_game_earnings.net_pence + excluded.net_pence,
      updated_at = excluded.updated_at
  `).bind(slug, numericUserId, delta, updatedAt).run();
}

async function readCachedSnapshot(db, scopeType, scopeSlug, nowMs) {
  const row = await db.prepare(`
    SELECT payload_json, refreshed_at, next_refresh_at
    FROM casino_leaderboard_snapshots
    WHERE scope_type = ? AND scope_slug = ?
    LIMIT 1
  `).bind(scopeType, scopeSlug).first();
  if (!row) return null;
  const nextRefreshMs = Date.parse(row.next_refresh_at || '');
  if (Number.isFinite(nextRefreshMs) && nowMs < nextRefreshMs) {
    try {
      return JSON.parse(String(row.payload_json || '{}'));
    } catch {
      return null;
    }
  }
  return null;
}

async function writeSnapshot(db, scopeType, scopeSlug, payload, refreshedAt, nextRefreshAt) {
  await db.prepare(`
    INSERT INTO casino_leaderboard_snapshots (scope_type, scope_slug, payload_json, refreshed_at, next_refresh_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(scope_type, scope_slug) DO UPDATE SET
      payload_json = excluded.payload_json,
      refreshed_at = excluded.refreshed_at,
      next_refresh_at = excluded.next_refresh_at,
      updated_at = excluded.updated_at
  `).bind(scopeType, scopeSlug, JSON.stringify(payload), refreshedAt, nextRefreshAt, isoNow()).run();
}

function buildLeaderboardRows(rows) {
  return rows.map((row, index) => ({
    rank: index + 1,
    user_id: Number(row.user_id),
    username: row.username || `User ${row.user_id}`,
    net_pence: Number(row.net_pence || 0),
    net_coins: toCoinAmount(row.net_pence || 0),
    updated_at: row.updated_at || null
  }));
}

async function buildGameBoard(db, game) {
  const rows = await db.prepare(`
    SELECT e.user_id, e.net_pence, e.updated_at, u.username
    FROM casino_game_earnings e
    INNER JOIN users u ON u.id = e.user_id
    WHERE e.game_slug = ? AND u.approved = 1
    ORDER BY e.net_pence DESC, LOWER(u.username) ASC
    LIMIT 25
  `).bind(game.slug).all();
  return {
    slug: game.slug,
    title: game.title,
    summary: game.summary,
    badge: game.badge || '',
    entries: buildLeaderboardRows(rows.results || [])
  };
}

export async function getCasinoLeaderboards(env) {
  const db = await ensureLeaderboardTables(env);
  if (!db) return null;
  const now = new Date();
  const nowMs = now.getTime();
  const refreshWindow = getRefreshWindow(now);
  const cached = await readCachedSnapshot(db, LEADERBOARD_SCOPE_ALL, LEADERBOARD_SCOPE_ALL, nowMs);
  if (cached) return cached;

  const gameRows = await db.prepare(`
    SELECT slug, title, summary, badge
    FROM casino_games
    WHERE is_active = 1
    ORDER BY sort_order ASC, title ASC
  `).all();
  const games = (gameRows.results || []).map((row) => ({
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    badge: row.badge || ''
  }));

  const boards = [];
  for (const game of games) {
    const gameCache = await readCachedSnapshot(db, LEADERBOARD_SCOPE_GAME, game.slug, nowMs);
    if (gameCache) {
      boards.push(gameCache);
      continue;
    }
    const board = await buildGameBoard(db, game);
    boards.push(board);
    await writeSnapshot(db, LEADERBOARD_SCOPE_GAME, game.slug, board, refreshWindow.refreshedAt, refreshWindow.nextRefreshAt);
  }

  const overallRows = await db.prepare(`
    SELECT e.user_id, SUM(e.net_pence) AS net_pence, MAX(e.updated_at) AS updated_at, u.username
    FROM casino_game_earnings e
    INNER JOIN users u ON u.id = e.user_id
    WHERE u.approved = 1
    GROUP BY e.user_id, u.username
    ORDER BY SUM(e.net_pence) DESC, LOWER(u.username) ASC
    LIMIT 25
  `).all();

  const payload = {
    refreshed_at: refreshWindow.refreshedAt,
    next_refresh_at: refreshWindow.nextRefreshAt,
    refresh_interval_ms: CASINO_LEADERBOARD_REFRESH_MS,
    overall: {
      slug: LEADERBOARD_SCOPE_ALL,
      title: 'All Casino Games',
      summary: 'Combined Grev Coins earned across every casino game.',
      entries: buildLeaderboardRows(overallRows.results || [])
    },
    games: boards
  };

  await writeSnapshot(db, LEADERBOARD_SCOPE_ALL, LEADERBOARD_SCOPE_ALL, payload, refreshWindow.refreshedAt, refreshWindow.nextRefreshAt);
  return payload;
}
