// src/index.js

import { STARTING_BALANCE_PENCE } from "./cs2/constants.js";
import { getStartingBalancePence } from "./lib/gambling.js";
import { getCasesDb } from "./lib/cases-binding.js";
import { handleCasinoRequest } from "./casino/handlers.js";
import { recordCasinoGameEarning } from "./casino/leaderboards.js";

export default {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env, ctx);
    } catch (error) {
      console.error("Unhandled worker error:", error);
      return json(
        {
          success: false,
          error: error?.message || "Internal server error"
        },
        500,
        request
      );
    }
  }
};

const SESSION_COOKIE_NAME = "grevdad_session";
const SESSION_DAYS = 30;
const DEFAULT_USER_GROUP = "standard";
const GLOBAL_CHAT_MESSAGE_LIMIT = 100;
const CASINO_CHAT_MESSAGE_LIMIT = 100;
const FORUM_POST_LIMIT = 100;
const CASINO_PROFILE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FOOTER_METADATA_TTL_MS = 5 * 60 * 1000;
const GITHUB_REPO_FALLBACK = "Grevyo/grev-dad-site";
const ROULETTE_ROUND_INTERVAL_MS = 5 * 60 * 1000;
const CRASH_SPRINT_ROUND_INTERVAL_MS = 5 * 60 * 1000;
const DAILY_SPIN_REWARDS = [
  { coins: 100, weight: 25 },
  { coins: 250, weight: 25 },
  { coins: 500, weight: 25 },
  { coins: 1000, weight: 25 }
];
const ALLOWED_GROUPS = ["admin", "dev", "staff", "mod", "higher", "member", "standard"];
const MODERATION_GROUPS = new Set(["admin", "dev", "staff"]);
let coreTablesReadyPromise = null;

async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const { pathname } = url;

  if (request.method === "OPTIONS") {
    return handleOptions(request);
  }

  if (pathname === "/api/casino/profile" && request.method === "GET") {
    return await handleCasinoProfile(request, env);
  }

  if (pathname === "/api/casino/profile/balance" && request.method === "POST") {
    return await handleCasinoProfileBalanceUpdate(request, env);
  }

  if (pathname === "/api/site/meta" && request.method === "GET") {
    return await handleSiteMeta(request, env);
  }

  if (pathname === "/api/casino/daily-spin" && request.method === "POST") {
    return await handleCasinoDailySpin(request, env);
  }

  if (pathname === "/api/casino/classic-spin" && request.method === "POST") {
    return await handleCasinoClassicSpin(request, env);
  }

  if (pathname === "/api/casino/roulette/state" && request.method === "GET") {
    return await handleCasinoRouletteState(request, env);
  }

  if (pathname === "/api/casino/roulette/bet" && request.method === "POST") {
    return await handleCasinoRouletteBet(request, env);
  }

  if (pathname === "/api/casino/crash-sprint/state" && request.method === "GET") {
    return await handleCasinoCrashSprintState(request, env);
  }

  if (pathname === "/api/casino/crash-sprint/join" && request.method === "POST") {
    return await handleCasinoCrashSprintJoin(request, env);
  }

  if (pathname === "/api/casino/crash-sprint/cashout" && request.method === "POST") {
    return await handleCasinoCrashSprintCashout(request, env);
  }

  const casinoRouteResponse = await handleCasinoRequest(request, env, { json, requireGamblingAdmin, safeJson, isoNow, ensureCasinoProfile, formatCasinoProfile, getCasinoDailySpinState, toCoinAmount, getSessionUser });
  if (casinoRouteResponse) return casinoRouteResponse;

  if (isRetiredGamblingPath(pathname)) {
    return retiredGamblingResponse(request);
  }

  if (pathname === "/api/health" && request.method === "GET") {
    return json(
      {
        success: true,
        message: "grev.dad worker is running"
      },
      200,
      request
    );
  }

  if (pathname === "/api/hltv/overview" && request.method === "GET") {
    return await handleHltvOverview(request, env);
  }

  if (pathname === "/api/setup" && request.method === "POST") {
    return await handleSetup(env, request);
  }

  // Auth
  if (pathname === "/api/auth/register" && request.method === "POST") {
    return await handleRegister(request, env);
  }

  if (pathname === "/api/auth/login" && request.method === "POST") {
    return await handleLogin(request, env);
  }

  if (pathname === "/api/auth/logout" && request.method === "POST") {
    return await handleLogout(request, env);
  }

  if (pathname === "/api/auth/me" && request.method === "GET") {
    return await handleMe(request, env);
  }

  // Profile
  if (pathname === "/api/profile/me" && request.method === "GET") {
    return await handleProfileMe(request, env);
  }

  if (pathname === "/api/profile/update" && request.method === "POST") {
    return await handleProfileUpdate(request, env);
  }

  if (pathname === "/api/profile/view" && request.method === "GET") {
    return await handleProfileView(request, env);
  }

  // Members
  if (pathname === "/api/users/members" && request.method === "GET") {
    return await handleMembers(request, env);
  }

  if (pathname === "/api/presence" && request.method === "POST") {
    return json({ success: true, disabled: true }, 202, request);
  }

  // Global chat
  if (pathname === "/api/chat/global" && request.method === "GET") {
    return await handleGetGlobalChat(request, env);
  }

  if (pathname === "/api/chat/global" && request.method === "POST") {
    return await handlePostGlobalChat(request, env);
  }

  if (pathname === "/api/chat/casino" && request.method === "GET") {
    return await handleGetCasinoChat(request, env);
  }

  if (pathname === "/api/chat/casino" && request.method === "POST") {
    return await handlePostCasinoChat(request, env);
  }

  // Forum
  if (pathname === "/api/forum/posts" && request.method === "GET") {
    return await handleForumPosts(request, env);
  }

  if (pathname === "/api/forum/post" && request.method === "GET") {
    return await handleForumPost(request, env);
  }

  if (pathname === "/api/forum/comments" && request.method === "GET") {
    return await handleForumComments(request, env);
  }

  if (pathname === "/api/forum/create-post" && request.method === "POST") {
    return await handleForumCreatePost(request, env);
  }

  if (pathname === "/api/forum/create-comment" && request.method === "POST") {
    return await handleForumCreateComment(request, env);
  }

  if (pathname === "/api/forum/react" && request.method === "POST") {
    return await handleForumReact(request, env);
  }

  if (pathname === "/api/forum/remove-post" && request.method === "POST") {
    return await handleForumRemovePost(request, env);
  }


  // Admin
  if (pathname === "/api/admin/users" && request.method === "GET") {
    return await handleAdminUsers(request, env);
  }

  if (pathname === "/api/admin/user" && request.method === "GET") {
    return await handleAdminUser(request, env);
  }

  if (pathname === "/api/admin/user/update" && request.method === "POST") {
    return await handleAdminUpdateUser(request, env);
  }

  if (pathname === "/api/admin/user/delete" && request.method === "POST") {
    return await handleAdminDeleteUser(request, env);
  }

  if (pathname === "/api/admin/pending-users" && request.method === "GET") {
    return await handleAdminPendingUsers(request, env);
  }

  if (pathname === "/api/admin/casino/read-database" && request.method === "POST") {
    return await handleAdminReadCasinoDatabase(request, env);
  }

  // Future routes
  if (pathname === "/api/chat/private" && request.method === "GET") {
    return json(
      {
        success: true,
        messages: [],
        note: "Private chat route is ready for a later phase"
      },
      200,
      request
    );
  }

  if (pathname === "/api/chat/private" && request.method === "POST") {
    return json(
      {
        success: false,
        error: "Private chat sending will be added in a later phase"
      },
      501,
      request
    );
  }

  if (pathname.startsWith("/api/cases")) {
    return json(
      {
        success: false,
        error: "Unknown legacy cases route. Supported aliases: GET /api/cases and GET /api/cases/catalog."
      },
      404,
      request
    );
  }

  if (env.ASSETS) {
    return env.ASSETS.fetch(request);
  }

  return json(
    {
      success: false,
      error: "Not found"
    },
    404,
    request
  );
}

/* -------------------------------------------------------------------------- */
/*                               SETUP / SCHEMA                               */
/* -------------------------------------------------------------------------- */

async function handleSetup(env, request) {
  await ensureCoreTables(env);

  return json(
    {
      success: true,
      message: "Core database tables applied; gambling playground reset remains in effect"
    },
    200,
    request
  );
}

function isRetiredGamblingPath(pathname) {
  return pathname === "/api/gambling/profile"
    || pathname === "/api/gambling/event"
    || pathname.startsWith("/api/gambling/admin/")
    || pathname === "/api/cases"
    || pathname === "/api/cases/catalog"
    || pathname.startsWith("/api/admin/cases")
    || pathname.startsWith("/api/cs2")
    || pathname.startsWith("/api/ygo")
    || pathname.startsWith("/api/blackjack")
    || pathname.startsWith("/api/casino");
}

function retiredGamblingResponse(request) {
  return json(
    {
      success: false,
      error: "The gambling playground has been cleared out and is being rebuilt from scratch."
    },
    410,
    request
  );
}

async function ensureCoreTables(env) {
  if (!env.DB) {
    throw new Error("Missing DB binding");
  }

  if (!coreTablesReadyPromise) {
    coreTablesReadyPromise = ensureCoreTablesOnce(env).catch((error) => {
      coreTablesReadyPromise = null;
      throw error;
    });
  }

  await coreTablesReadyPromise;
}

async function ensureCoreTablesOnce(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      approved INTEGER NOT NULL DEFAULT 0,
      is_admin INTEGER NOT NULL DEFAULT 0,
      group_name TEXT NOT NULL DEFAULT 'standard',
      created_at TEXT NOT NULL,
      last_seen_at TEXT
    )
  `).run();

  await ensureColumn(env.DB, "users", "approved", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(env.DB, "users", "is_admin", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(env.DB, "users", "group_name", "TEXT NOT NULL DEFAULT 'standard'");
  await ensureColumn(env.DB, "users", "gambling_admin", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(env.DB, "users", "created_at", "TEXT");
  await ensureColumn(env.DB, "users", "last_seen_at", "TEXT");

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS gambling_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();
  await ensureColumn(env.DB, "gambling_settings", "value", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(env.DB, "gambling_settings", "updated_at", "TEXT NOT NULL DEFAULT ''");
  await env.DB.prepare(`INSERT OR IGNORE INTO gambling_settings (key, value, updated_at) VALUES ('starting_balance_pence', ?, ?)` ).bind(String(STARTING_BALANCE_PENCE), new Date().toISOString()).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS casino_profiles (
      user_id INTEGER PRIMARY KEY,
      display_name TEXT,
      grev_coin_balance INTEGER NOT NULL DEFAULT 50000,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      refreshed_at TEXT NOT NULL
    )
  `).run();

  await ensureColumn(env.DB, "casino_profiles", "display_name", "TEXT");
  await ensureColumn(env.DB, "casino_profiles", "grev_coin_balance", `INTEGER NOT NULL DEFAULT ${STARTING_BALANCE_PENCE}`);
  await ensureColumn(env.DB, "casino_profiles", "created_at", "TEXT");
  await ensureColumn(env.DB, "casino_profiles", "updated_at", "TEXT");
  await ensureColumn(env.DB, "casino_profiles", "refreshed_at", "TEXT");

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_token TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )
  `).run();

  await ensureColumn(env.DB, "sessions", "session_token", "TEXT");
  await ensureColumn(env.DB, "sessions", "user_id", "INTEGER");
  await ensureColumn(env.DB, "sessions", "created_at", "TEXT");
  await ensureColumn(env.DB, "sessions", "expires_at", "TEXT");

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id INTEGER PRIMARY KEY,
      bio TEXT,
      avatar_url TEXT
    )
  `).run();

  await ensureColumn(env.DB, "user_profiles", "bio", "TEXT");
  await ensureColumn(env.DB, "user_profiles", "avatar_url", "TEXT");
  await ensureColumn(env.DB, "user_profiles", "real_name", "TEXT");
  await ensureColumn(env.DB, "user_profiles", "motto", "TEXT");
  await ensureColumn(env.DB, "user_profiles", "media_1_url", "TEXT");
  await ensureColumn(env.DB, "user_profiles", "media_2_url", "TEXT");
  await ensureColumn(env.DB, "user_profiles", "media_3_url", "TEXT");
  await ensureColumn(env.DB, "user_profiles", "music_url", "TEXT");
  await ensureColumn(env.DB, "user_profiles", "profile_accent_color", "TEXT");
  await ensureColumn(env.DB, "user_profiles", "profile_accent_color_secondary", "TEXT");
  await ensureColumn(env.DB, "user_profiles", "avatar_initials", "TEXT");
  await ensureColumn(env.DB, "user_profiles", "avatar_style", "TEXT");
  await ensureColumn(env.DB, "user_profiles", "pronouns", "TEXT");
  await ensureColumn(env.DB, "user_profiles", "location", "TEXT");
  await ensureColumn(env.DB, "user_profiles", "favorite_game", "TEXT");
  await ensureColumn(env.DB, "user_profiles", "steam_url", "TEXT");
  await ensureColumn(env.DB, "user_profiles", "leetify_url", "TEXT");
  await ensureColumn(env.DB, "user_profiles", "refrag_url", "TEXT");

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS global_chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_user_id INTEGER NOT NULL,
      author_username TEXT NOT NULL,
      author_group TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS casino_chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_user_id INTEGER NOT NULL,
      author_username TEXT NOT NULL,
      author_group TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `).run();

  await ensureColumn(env.DB, "global_chat_messages", "author_user_id", "INTEGER");
  await ensureColumn(env.DB, "global_chat_messages", "author_username", "TEXT");
  await ensureColumn(env.DB, "global_chat_messages", "author_group", "TEXT");
  await ensureColumn(env.DB, "global_chat_messages", "message", "TEXT");
  await ensureColumn(env.DB, "global_chat_messages", "created_at", "TEXT");

  await ensureColumn(env.DB, "casino_chat_messages", "author_user_id", "INTEGER");
  await ensureColumn(env.DB, "casino_chat_messages", "author_username", "TEXT");
  await ensureColumn(env.DB, "casino_chat_messages", "author_group", "TEXT");
  await ensureColumn(env.DB, "casino_chat_messages", "message", "TEXT");
  await ensureColumn(env.DB, "casino_chat_messages", "created_at", "TEXT");

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS casino_roulette_bets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      round_id INTEGER NOT NULL,
      bet_type TEXT NOT NULL,
      bet_value TEXT,
      stake_pence INTEGER NOT NULL,
      payout_pence INTEGER NOT NULL DEFAULT 0,
      outcome_number INTEGER,
      created_at TEXT NOT NULL,
      resolved_at TEXT
    )
  `).run();

  await ensureColumn(env.DB, "casino_roulette_bets", "user_id", "INTEGER");
  await ensureColumn(env.DB, "casino_roulette_bets", "round_id", "INTEGER");
  await ensureColumn(env.DB, "casino_roulette_bets", "bet_type", "TEXT");
  await ensureColumn(env.DB, "casino_roulette_bets", "bet_value", "TEXT");
  await ensureColumn(env.DB, "casino_roulette_bets", "stake_pence", "INTEGER");
  await ensureColumn(env.DB, "casino_roulette_bets", "payout_pence", "INTEGER");
  await ensureColumn(env.DB, "casino_roulette_bets", "outcome_number", "INTEGER");
  await ensureColumn(env.DB, "casino_roulette_bets", "created_at", "TEXT");
  await ensureColumn(env.DB, "casino_roulette_bets", "resolved_at", "TEXT");

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS forum_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_user_id INTEGER NOT NULL,
      author_username TEXT NOT NULL,
      author_group TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      image_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();

  await ensureColumn(env.DB, "forum_posts", "author_user_id", "INTEGER");
  await ensureColumn(env.DB, "forum_posts", "author_username", "TEXT");
  await ensureColumn(env.DB, "forum_posts", "author_group", "TEXT");
  await ensureColumn(env.DB, "forum_posts", "title", "TEXT");
  await ensureColumn(env.DB, "forum_posts", "body", "TEXT");
  await ensureColumn(env.DB, "forum_posts", "image_url", "TEXT");
  await ensureColumn(env.DB, "forum_posts", "created_at", "TEXT");
  await ensureColumn(env.DB, "forum_posts", "updated_at", "TEXT");

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS forum_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      author_user_id INTEGER NOT NULL,
      author_username TEXT NOT NULL,
      author_group TEXT NOT NULL,
      comment TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `).run();

  await ensureColumn(env.DB, "forum_comments", "post_id", "INTEGER");
  await ensureColumn(env.DB, "forum_comments", "author_user_id", "INTEGER");
  await ensureColumn(env.DB, "forum_comments", "author_username", "TEXT");
  await ensureColumn(env.DB, "forum_comments", "author_group", "TEXT");
  await ensureColumn(env.DB, "forum_comments", "comment", "TEXT");
  await ensureColumn(env.DB, "forum_comments", "created_at", "TEXT");

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS forum_reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      reaction_type TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `).run();

  await ensureColumn(env.DB, "forum_reactions", "post_id", "INTEGER");
  await ensureColumn(env.DB, "forum_reactions", "user_id", "INTEGER");
  await ensureColumn(env.DB, "forum_reactions", "reaction_type", "TEXT");
  await ensureColumn(env.DB, "forum_reactions", "created_at", "TEXT");

  await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username)`).run();
  await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token ON sessions (session_token)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_users_group_name ON users (group_name)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_users_approved ON users (approved)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_global_chat_created_at ON global_chat_messages (created_at)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_casino_chat_created_at ON casino_chat_messages (created_at)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_casino_roulette_round ON casino_roulette_bets (round_id, resolved_at)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_casino_roulette_user_round ON casino_roulette_bets (user_id, round_id)`).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS casino_crash_sprint_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      round_id INTEGER NOT NULL,
      stake_pence INTEGER NOT NULL,
      cashout_multiplier INTEGER,
      payout_pence INTEGER NOT NULL DEFAULT 0,
      crash_multiplier INTEGER,
      created_at TEXT NOT NULL,
      resolved_at TEXT
    )
  `).run();

  await ensureColumn(env.DB, "casino_crash_sprint_entries", "user_id", "INTEGER");
  await ensureColumn(env.DB, "casino_crash_sprint_entries", "round_id", "INTEGER");
  await ensureColumn(env.DB, "casino_crash_sprint_entries", "stake_pence", "INTEGER");
  await ensureColumn(env.DB, "casino_crash_sprint_entries", "cashout_multiplier", "INTEGER");
  await ensureColumn(env.DB, "casino_crash_sprint_entries", "payout_pence", "INTEGER");
  await ensureColumn(env.DB, "casino_crash_sprint_entries", "crash_multiplier", "INTEGER");
  await ensureColumn(env.DB, "casino_crash_sprint_entries", "created_at", "TEXT");
  await ensureColumn(env.DB, "casino_crash_sprint_entries", "resolved_at", "TEXT");
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_casino_crash_sprint_round ON casino_crash_sprint_entries (round_id, resolved_at)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_casino_crash_sprint_user_round ON casino_crash_sprint_entries (user_id, round_id)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_forum_posts_created_at ON forum_posts (created_at)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_forum_comments_post_id ON forum_comments (post_id)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_forum_reactions_post_id ON forum_reactions (post_id)`).run();
  await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_forum_reactions_post_user ON forum_reactions (post_id, user_id)`).run();
}

async function ensureColumn(db, tableName, columnName, columnDefinition) {
  const result = await db.prepare(`PRAGMA table_info(${tableName})`).all();
  const cols = result.results || [];
  const exists = cols.some((col) => String(col.name).toLowerCase() === String(columnName).toLowerCase());

  if (!exists) {
    await db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`).run();
  }
}

async function ensureCasesWalletTables(env) {
  const db = getCasesDb(env);
  if (!db) return null;

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS case_profiles (
      user_id INTEGER PRIMARY KEY,
      display_name TEXT,
      balance INTEGER NOT NULL DEFAULT 50000,
      key_balance INTEGER NOT NULL DEFAULT 0,
      total_cases_opened INTEGER NOT NULL DEFAULT 0,
      total_spent INTEGER NOT NULL DEFAULT 0,
      total_inventory_value INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();

  await ensureColumn(db, "case_profiles", "display_name", "TEXT");
  await ensureColumn(db, "case_profiles", "balance", `INTEGER NOT NULL DEFAULT ${STARTING_BALANCE_PENCE}`);
  await ensureColumn(db, "case_profiles", "key_balance", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "case_profiles", "total_cases_opened", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "case_profiles", "total_spent", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "case_profiles", "total_inventory_value", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "case_profiles", "created_at", "TEXT");
  await ensureColumn(db, "case_profiles", "updated_at", "TEXT");

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS casino_daily_spins (
      user_id INTEGER PRIMARY KEY,
      last_free_spin_at TEXT,
      last_reward_pence INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    )
  `).run();

  await ensureColumn(db, "casino_daily_spins", "last_free_spin_at", "TEXT");
  await ensureColumn(db, "casino_daily_spins", "last_reward_pence", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "casino_daily_spins", "updated_at", "TEXT NOT NULL DEFAULT ''");

  return db;
}

function pickDailySpinRewardPence() {
  const totalWeight = DAILY_SPIN_REWARDS.reduce((sum, entry) => sum + Number(entry.weight || 0), 0);
  let roll = Math.random() * totalWeight;
  for (const entry of DAILY_SPIN_REWARDS) {
    roll -= Number(entry.weight || 0);
    if (roll <= 0) return Math.round(Number(entry.coins || 0) * 100);
  }
  return Math.round(Number(DAILY_SPIN_REWARDS[DAILY_SPIN_REWARDS.length - 1]?.coins || 0) * 100);
}

function getUtcDayKey(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function getNextDailySpinAt(lastFreeSpinAt) {
  const lastMs = lastFreeSpinAt ? Date.parse(lastFreeSpinAt) : NaN;
  if (!Number.isFinite(lastMs)) return null;
  const lastDate = new Date(lastMs);
  const nextUtcMidnight = Date.UTC(lastDate.getUTCFullYear(), lastDate.getUTCMonth(), lastDate.getUTCDate() + 1, 0, 0, 0, 0);
  return new Date(nextUtcMidnight).toISOString();
}

function canUseDailySpin(lastFreeSpinAt) {
  const lastDayKey = getUtcDayKey(lastFreeSpinAt);
  if (!lastDayKey) return true;
  return lastDayKey !== getUtcDayKey();
}

async function syncCasinoProfileFromCasesDb(env, userId, username, options = {}) {
  const { force = false } = options;
  await ensureCoreTables(env);
  const now = isoNow();
  await env.DB.prepare(`
    INSERT OR IGNORE INTO casino_profiles (user_id, display_name, grev_coin_balance, created_at, updated_at, refreshed_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(userId, username, await getStartingBalancePence(env), now, now, now).run();

  const cached = await env.DB.prepare(`
    SELECT user_id, display_name, grev_coin_balance, created_at, updated_at, refreshed_at
    FROM casino_profiles
    WHERE user_id = ?
    LIMIT 1
  `).bind(userId).first();

  const refreshedAtMs = cached?.refreshed_at ? Date.parse(cached.refreshed_at) : NaN;
  const shouldRefresh = force || !Number.isFinite(refreshedAtMs) || (Date.now() - refreshedAtMs) >= CASINO_PROFILE_CACHE_TTL_MS;
  const casesDb = await ensureCasesWalletTables(env);
  if (!casesDb) return cached;

  await casesDb.prepare(`
    INSERT OR IGNORE INTO case_profiles (user_id, display_name, balance, key_balance, total_cases_opened, total_spent, total_inventory_value, created_at, updated_at)
    VALUES (?, ?, ?, 0, 0, 0, 0, ?, ?)
  `).bind(userId, username, await getStartingBalancePence(env), now, now).run();

  await casesDb.prepare(`
    INSERT OR IGNORE INTO casino_daily_spins (user_id, last_free_spin_at, last_reward_pence, updated_at)
    VALUES (?, NULL, 0, ?)
  `).bind(userId, now).run();

  if (shouldRefresh) {
    const wallet = await casesDb.prepare(`
      SELECT user_id, display_name, balance, created_at, updated_at
      FROM case_profiles
      WHERE user_id = ?
      LIMIT 1
    `).bind(userId).first();

    await env.DB.prepare(`
      UPDATE casino_profiles
      SET display_name = ?, grev_coin_balance = ?, created_at = COALESCE(created_at, ?), updated_at = ?, refreshed_at = ?
      WHERE user_id = ?
    `).bind(
      wallet?.display_name || username,
      Number(wallet?.balance || 0),
      wallet?.created_at || now,
      wallet?.updated_at || now,
      now,
      userId
    ).run();
  } else {
    await env.DB.prepare(`UPDATE casino_profiles SET display_name = ? WHERE user_id = ?`).bind(username, userId).run();
  }

  return await env.DB.prepare(`
    SELECT user_id, display_name, grev_coin_balance, created_at, updated_at, refreshed_at
    FROM casino_profiles
    WHERE user_id = ?
    LIMIT 1
  `).bind(userId).first();
}

async function getCasinoDailySpinState(env, userId) {
  const db = await ensureCasesWalletTables(env);
  if (!db) return { available: false, next_available_at: null, last_free_spin_at: null, last_reward: 0 };
  const row = await db.prepare(`SELECT last_free_spin_at, last_reward_pence FROM casino_daily_spins WHERE user_id = ? LIMIT 1`).bind(userId).first();
  return {
    available: canUseDailySpin(row?.last_free_spin_at || null),
    next_available_at: getNextDailySpinAt(row?.last_free_spin_at || null),
    last_free_spin_at: row?.last_free_spin_at || null,
    last_reward: toCoinAmount(row?.last_reward_pence || 0)
  };
}

function toCoinAmount(pence) {
  const value = Number(pence || 0);
  return Number.isFinite(value) ? value / 100 : 0;
}

function formatCasinoProfile(row, fallbackUsername = "") {
  return {
    user_id: Number(row.user_id),
    display_name: row.display_name || fallbackUsername || "Player",
    grev_coin_balance_pence: Number(row.grev_coin_balance || 0),
    grev_coin_balance: toCoinAmount(row.grev_coin_balance || 0),
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    refreshed_at: row.refreshed_at || null,
    cache_ttl_ms: CASINO_PROFILE_CACHE_TTL_MS
  };
}

async function ensureCasinoProfile(env, userId, username, options = {}) {
  return await syncCasinoProfileFromCasesDb(env, userId, username, options);
}

async function handleCasinoProfile(request, env) {
  const session = await getSessionUser(request, env);
  if (!session) {
    return json({ success: false, error: "Not authenticated" }, 401, request);
  }

  const profile = await ensureCasinoProfile(env, session.id, session.username);
  const dailySpin = await getCasinoDailySpinState(env, session.id);

  return json({
    success: true,
    casino: {
      title: "Welcome to Grev.dad Casino",
      description: "Spin the free daily wheel, jump into blackjack or poker with your mates, chase classic slots, and keep your Grev Coin balance visible while you move around the casino.",
      currency_name: "Grev Coin",
      currency_code: "GC",
      starting_balance: toCoinAmount(await getStartingBalancePence(env)),
      wallet_sync_interval_hours: 6,
      daily_spin_rewards: DAILY_SPIN_REWARDS.map((entry) => ({
        coins: entry.coins,
        weight: entry.weight
      }))
    },
    profile: formatCasinoProfile(profile, session.username),
    daily_spin: dailySpin
  }, 200, request);
}

async function handleCasinoProfileBalanceUpdate(request, env) {
  const session = await getSessionUser(request, env);
  if (!session) return json({ success: false, error: "Not authenticated" }, 401, request);

  const casesDb = await ensureCasesWalletTables(env);
  if (!casesDb) return json({ success: false, error: "CASES-DB is not configured" }, 500, request);

  const body = await safeJson(request);
  const balanceCoins = Number(body?.balance_coins);
  if (!Number.isFinite(balanceCoins) || balanceCoins < 0) {
    return json({ success: false, error: "balance_coins must be a non-negative number" }, 400, request);
  }

  const balancePence = Math.round(balanceCoins * 100);
  const now = isoNow();
  await ensureCasinoProfile(env, session.id, session.username, { force: true });
  await casesDb.prepare(`UPDATE case_profiles SET balance = ?, updated_at = ? WHERE user_id = ?`).bind(balancePence, now, session.id).run();
  await env.DB.prepare(`UPDATE casino_profiles SET grev_coin_balance = ?, updated_at = ?, refreshed_at = ? WHERE user_id = ?`).bind(balancePence, now, now, session.id).run();
  const profile = await ensureCasinoProfile(env, session.id, session.username, { force: true });
  return json({ success: true, profile: formatCasinoProfile(profile, session.username) }, 200, request);
}

async function handleCasinoDailySpin(request, env) {
  const session = await getSessionUser(request, env);
  if (!session) {
    return json({ success: false, error: "Not authenticated" }, 401, request);
  }

  const casesDb = await ensureCasesWalletTables(env);
  if (!casesDb) {
    return json({ success: false, error: "CASES-DB is not configured" }, 500, request);
  }

  await ensureCasinoProfile(env, session.id, session.username, { force: true });

  const spinState = await casesDb.prepare(`
    SELECT last_free_spin_at, last_reward_pence
    FROM casino_daily_spins
    WHERE user_id = ?
    LIMIT 1
  `).bind(session.id).first();

  if (!canUseDailySpin(spinState?.last_free_spin_at || null)) {
    return json({
      success: false,
      error: "Daily spin already used.",
      daily_spin: {
        available: false,
        last_free_spin_at: spinState?.last_free_spin_at || null,
        next_available_at: getNextDailySpinAt(spinState?.last_free_spin_at || null),
        last_reward: toCoinAmount(spinState?.last_reward_pence || 0)
      }
    }, 429, request);
  }

  const rewardPence = pickDailySpinRewardPence();
  const now = isoNow();
  await casesDb.batch([
    casesDb.prepare(`UPDATE case_profiles SET balance = balance + ?, updated_at = ? WHERE user_id = ?`).bind(rewardPence, now, session.id),
    casesDb.prepare(`
      INSERT INTO casino_daily_spins (user_id, last_free_spin_at, last_reward_pence, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        last_free_spin_at = excluded.last_free_spin_at,
        last_reward_pence = excluded.last_reward_pence,
        updated_at = excluded.updated_at
    `).bind(session.id, now, rewardPence, now)
  ]);

  await recordCasinoGameEarning(env, "daily-spin", session.id, rewardPence, now);
  const profile = await ensureCasinoProfile(env, session.id, session.username, { force: true });
  return json({
    success: true,
    reward: {
      pence: rewardPence,
      coins: toCoinAmount(rewardPence)
    },
    profile: formatCasinoProfile(profile, session.username),
    daily_spin: await getCasinoDailySpinState(env, session.id)
  }, 200, request);
}

const CLASSIC_SPIN_SYMBOLS = ["🍋", "🍒", "🍇", "🍉", "🔔", "💎"];
const CLASSIC_SPIN_PAYOUTS = {
  "💎": { multiplier: 14, message: "Diamond line! The cabinet flashes with the big one." },
  "🔔": { multiplier: 10, message: "Bell line! Loud old-school payout." },
  "🍉": { multiplier: 8, message: "Watermelon line! Heavy juicy win." },
  "🍒": { multiplier: 6, message: "Cherry line! That one pays nicely." },
  "🍇": { multiplier: 5, message: "Grape line! A tidy fruity payout." },
  "🍋": { multiplier: 4, message: "Lemon line! Sharp little payout." }
};

function pickClassicSpinResult() {
  return Array.from({ length: 3 }, () => CLASSIC_SPIN_SYMBOLS[Math.floor(Math.random() * CLASSIC_SPIN_SYMBOLS.length)]);
}

function evaluateClassicSpin(result) {
  const firstSymbol = result[0];
  if (result.every((symbol) => symbol === firstSymbol) && CLASSIC_SPIN_PAYOUTS[firstSymbol]) {
    return CLASSIC_SPIN_PAYOUTS[firstSymbol];
  }

  const symbolCounts = result.reduce((counts, symbol) => {
    counts[symbol] = (counts[symbol] || 0) + 1;
    return counts;
  }, {});
  const hasPair = Object.values(symbolCounts).some((count) => count === 2);
  if (hasPair) {
    return { multiplier: 1, message: "Any pair returns your bet — the cabinet gives you another go for free." };
  }

  return { multiplier: 0, message: "No line win this time — give the lever another go." };
}

async function handleCasinoClassicSpin(request, env) {
  const session = await getSessionUser(request, env);
  if (!session) {
    return json({ success: false, error: "Not authenticated" }, 401, request);
  }

  const casesDb = await ensureCasesWalletTables(env);
  if (!casesDb) {
    return json({ success: false, error: "CASES-DB is not configured" }, 500, request);
  }

  const body = await safeJson(request);
  const betCoins = Math.round(Number(body?.bet_coins));
  if (!Number.isFinite(betCoins) || betCoins < 1) {
    return json({ success: false, error: "Bet must be at least 1 Grev Coin." }, 400, request);
  }

  const betPence = Math.round(betCoins * 100);
  await ensureCasinoProfile(env, session.id, session.username, { force: true });

  const profile = await casesDb.prepare(`
    SELECT balance
    FROM case_profiles
    WHERE user_id = ?
    LIMIT 1
  `).bind(session.id).first();

  const balancePence = Number(profile?.balance || 0);
  if (balancePence < betPence) {
    return json({ success: false, error: "Not enough Grev Coins for that spin." }, 400, request);
  }

  const result = pickClassicSpinResult();
  const outcome = evaluateClassicSpin(result);
  const winningsPence = Math.round(betPence * outcome.multiplier);
  const netChangePence = winningsPence - betPence;
  const now = isoNow();

  await casesDb.prepare(`
    UPDATE case_profiles
    SET balance = balance + ?, updated_at = ?
    WHERE user_id = ?
  `).bind(netChangePence, now, session.id).run();

  await recordCasinoGameEarning(env, "classic-fruity", session.id, netChangePence, now);
  const updatedProfile = await ensureCasinoProfile(env, session.id, session.username, { force: true });
  return json({
    success: true,
    result,
    outcome: {
      multiplier: outcome.multiplier,
      message: outcome.message,
      bet_coins: betCoins,
      winnings_coins: toCoinAmount(winningsPence),
      net_change_coins: toCoinAmount(netChangePence)
    },
    profile: formatCasinoProfile(updatedProfile, session.username)
  }, 200, request);
}



function getRouletteRoundId(date = Date.now()) {
  return Math.floor(Number(date) / ROULETTE_ROUND_INTERVAL_MS);
}

function getRouletteRoundStartMs(roundId) {
  return Number(roundId) * ROULETTE_ROUND_INTERVAL_MS;
}

function getRouletteRoundEndMs(roundId) {
  return getRouletteRoundStartMs(roundId + 1);
}

function getRouletteRoundNumber(roundId) {
  const seed = (Number(roundId) * 9301 + 49297) % 233280;
  return seed % 37;
}

function getRouletteDozen(number) {
  if (number >= 1 && number <= 12) return 1;
  if (number >= 13 && number <= 24) return 2;
  if (number >= 25 && number <= 36) return 3;
  return null;
}

function getRouletteColor(number) {
  if (number === 0) return "green";
  const redNumbers = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  return redNumbers.has(number) ? "red" : "black";
}

function parseRouletteNumbers(betValue) {
  const values = String(betValue || "")
    .split(/[^0-9]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => Number(part));
  if (!values.length) return null;
  if (values.some((value) => !Number.isInteger(value) || value < 0 || value > 36)) return null;
  const uniqueValues = [...new Set(values)];
  return uniqueValues;
}

function getRouletteBetLabel(betType, betValue) {
  if (betType === "dozen") return `Dozen ${betValue}`;
  if (["number", "split", "street", "corner", "basket", "line"].includes(betType)) {
    return `${betType}: ${betValue}`;
  }
  return betType;
}

function evaluateRouletteBet(number, betType, betValue, stakePence) {
  const numericValue = Number(betValue);
  if (betType === "red") return number !== 0 && getRouletteColor(number) === "red" ? stakePence * 2 : 0;
  if (betType === "black") return number !== 0 && getRouletteColor(number) === "black" ? stakePence * 2 : 0;
  if (betType === "even") return number !== 0 && number % 2 === 0 ? stakePence * 2 : 0;
  if (betType === "odd") return number % 2 === 1 ? stakePence * 2 : 0;
  if (betType === "dozen") return [1,2,3].includes(numericValue) && getRouletteDozen(number) === numericValue ? stakePence * 3 : 0;
  if (betType === "number") return Number.isInteger(numericValue) && numericValue >= 0 && numericValue <= 36 && number === numericValue ? stakePence * 36 : 0;

  const numberSets = {
    split: { size: 2, payout: 18 },
    street: { size: 3, payout: 12 },
    corner: { size: 4, payout: 9 },
    basket: { size: 5, payout: 7 },
    line: { size: 6, payout: 6 }
  };
  const setConfig = numberSets[betType];
  if (setConfig) {
    const numbers = parseRouletteNumbers(betValue);
    if (!numbers || numbers.length !== setConfig.size) return 0;
    return numbers.includes(number) ? stakePence * setConfig.payout : 0;
  }

  return 0;
}

function normaliseRouletteBet(body) {
  const allowedTypes = new Set(["red", "black", "even", "odd", "dozen", "number", "split", "street", "corner", "basket", "line"]);
  const betType = String(body?.bet_type || "").trim().toLowerCase();
  const stakeCoins = Number(body?.stake_coins);
  const allowedStakeCoins = new Set([5, 10, 25, 50]);
  if (!allowedTypes.has(betType)) return { error: "Choose a valid roulette bet type." };
  if (!allowedStakeCoins.has(stakeCoins)) return { error: "Stake must be 5, 10, 25, or 50 Grev Coins." };

  let betValue = null;
  if (betType === "dozen") {
    betValue = Number(body?.bet_value);
    if (![1,2,3].includes(betValue)) return { error: "Dozen bets must be 1, 2, or 3." };
  } else if (betType === "number") {
    betValue = Number(body?.bet_value);
    if (!Number.isInteger(betValue) || betValue < 0 || betValue > 36) return { error: "Single number bets must be from 0 to 36." };
  } else if (["split", "street", "corner", "basket", "line"].includes(betType)) {
    const expectedSizes = { split: 2, street: 3, corner: 4, basket: 5, line: 6 };
    const parsedNumbers = parseRouletteNumbers(body?.bet_value);
    if (!parsedNumbers || parsedNumbers.length !== expectedSizes[betType]) {
      return { error: `Enter exactly ${expectedSizes[betType]} unique numbers between 0 and 36 for this bet.` };
    }
    betValue = parsedNumbers.join(",");
  }

  return { betType, betValue: betValue == null ? null : String(betValue), stakeCoins, stakePence: Math.round(stakeCoins * 100) };
}

async function resolveRouletteBets(env, casesDb, roundId) {
  await ensureCoreTables(env);
  const rows = await env.DB.prepare(`
    SELECT id, user_id, round_id, bet_type, bet_value, stake_pence
    FROM casino_roulette_bets
    WHERE resolved_at IS NULL AND round_id <= ?
    ORDER BY id ASC
  `).bind(roundId).all();

  for (const row of (rows.results || [])) {
    const outcomeNumber = getRouletteRoundNumber(row.round_id);
    const payoutPence = evaluateRouletteBet(outcomeNumber, row.bet_type, row.bet_value, Number(row.stake_pence || 0));
    const resolvedAt = isoNow();
    if (payoutPence > 0) {
      await casesDb.prepare(`UPDATE case_profiles SET balance = balance + ?, updated_at = ? WHERE user_id = ?`).bind(payoutPence, resolvedAt, row.user_id).run();
    }
    await recordCasinoGameEarning(env, "roulette", row.user_id, payoutPence - Number(row.stake_pence || 0), resolvedAt);
    await env.DB.prepare(`
      UPDATE casino_roulette_bets
      SET payout_pence = ?, outcome_number = ?, resolved_at = ?
      WHERE id = ?
    `).bind(payoutPence, outcomeNumber, resolvedAt, row.id).run();
  }
}

function getCrashSprintRoundId(nowMs = Date.now()) {
  return Math.floor(Number(nowMs) / CRASH_SPRINT_ROUND_INTERVAL_MS);
}

function getCrashSprintRoundStartMs(roundId) {
  return Number(roundId) * CRASH_SPRINT_ROUND_INTERVAL_MS;
}

function getCrashSprintRoundCrashMultiplier(roundId) {
  const seed = (Number(roundId) * 48271 + 12820163) % 2147483647;
  return 135 + (seed % 461);
}

function getCrashSprintMultiplierAt(elapsedSeconds) {
  const elapsed = Math.max(0, Number(elapsedSeconds) || 0);
  return 1 + elapsed * 0.55 + elapsed * elapsed * 0.08;
}

function getCrashSprintCrashElapsedSeconds(roundId) {
  const target = getCrashSprintRoundCrashMultiplier(roundId) / 100;
  const delta = Math.max(0, target - 1);
  return (-0.55 + Math.sqrt((0.55 * 0.55) + (4 * 0.08 * delta))) / (2 * 0.08);
}

function getCrashSprintRoundState(roundId, nowMs = Date.now()) {
  const roundStartMs = getCrashSprintRoundStartMs(roundId);
  const roundEndMs = roundStartMs + CRASH_SPRINT_ROUND_INTERVAL_MS;
  const crashElapsedSeconds = getCrashSprintCrashElapsedSeconds(roundId);
  const crashAtMs = Math.min(roundEndMs, roundStartMs + Math.round(crashElapsedSeconds * 1000));
  const crashed = nowMs >= crashAtMs;
  const elapsedSeconds = Math.max(0, Math.min((Math.min(nowMs, crashAtMs) - roundStartMs) / 1000, crashElapsedSeconds));
  const joinRoundId = crashed ? roundId + 1 : roundId;
  const joinRoundStartMs = getCrashSprintRoundStartMs(joinRoundId);
  return {
    round_id: roundId,
    round_interval_ms: CRASH_SPRINT_ROUND_INTERVAL_MS,
    round_started_at: new Date(roundStartMs).toISOString(),
    round_ends_at: new Date(roundEndMs).toISOString(),
    crash_at: new Date(crashAtMs).toISOString(),
    crash_multiplier: getCrashSprintRoundCrashMultiplier(roundId) / 100,
    live_multiplier: crashed ? getCrashSprintRoundCrashMultiplier(roundId) / 100 : getCrashSprintMultiplierAt(elapsedSeconds),
    crashed,
    joinable_round_id: joinRoundId,
    joinable_round_starts_at: new Date(joinRoundStartMs).toISOString(),
    joinable_now: !crashed
  };
}

function normaliseCrashSprintStake(body) {
  const stakeCoins = Number(body?.stake_coins);
  if (![10, 25, 50, 100].includes(stakeCoins)) return { error: "Stake must be 10, 25, 50, or 100 Grev Coins." };
  return { stakeCoins, stakePence: Math.round(stakeCoins * 100) };
}

async function resolveCrashSprintEntries(env, casesDb, upToRoundId) {
  await ensureCoreTables(env);
  const rows = await env.DB.prepare(`
    SELECT id, user_id, round_id, stake_pence
    FROM casino_crash_sprint_entries
    WHERE resolved_at IS NULL AND round_id <= ?
    ORDER BY id ASC
  `).bind(upToRoundId).all();

  for (const row of (rows.results || [])) {
    const crashMultiplierInt = getCrashSprintRoundCrashMultiplier(row.round_id);
    const resolvedAt = isoNow();
    await recordCasinoGameEarning(env, "crash-sprint", row.user_id, -Number(row.stake_pence || 0), resolvedAt);
    await env.DB.prepare(`
      UPDATE casino_crash_sprint_entries
      SET payout_pence = 0, crash_multiplier = ?, resolved_at = ?
      WHERE id = ?
    `).bind(crashMultiplierInt, resolvedAt, row.id).run();
  }
}

async function handleCasinoCrashSprintState(request, env) {
  const session = await getSessionUser(request, env);
  if (!session) return json({ success: false, error: "Not authenticated" }, 401, request);
  const casesDb = await ensureCasesWalletTables(env);
  if (!casesDb) return json({ success: false, error: "CASES-DB is not configured" }, 500, request);
  await ensureCasinoProfile(env, session.id, session.username, { force: true });
  await ensureCoreTables(env);

  const nowMs = Date.now();
  const currentRoundId = getCrashSprintRoundId(nowMs);
  await resolveCrashSprintEntries(env, casesDb, currentRoundId - 1);

  const profile = await ensureCasinoProfile(env, session.id, session.username, { force: true });
  const table = getCrashSprintRoundState(currentRoundId, nowMs);
  if (table.crashed) await resolveCrashSprintEntries(env, casesDb, currentRoundId);
  const joined = await env.DB.prepare(`
    SELECT id, round_id, stake_pence, cashout_multiplier, payout_pence, crash_multiplier, created_at, resolved_at
    FROM casino_crash_sprint_entries
    WHERE user_id = ?
    ORDER BY id DESC
    LIMIT 10
  `).bind(session.id).all();
  const playerRoundId = Number(table.crashed ? table.joinable_round_id : currentRoundId);
  const players = await env.DB.prepare(`
    SELECT e.id, e.user_id, e.round_id, e.stake_pence, e.cashout_multiplier, e.payout_pence, e.crash_multiplier, e.created_at, e.resolved_at, u.username, p.avatar_url
    FROM casino_crash_sprint_entries e
    INNER JOIN users u ON u.id = e.user_id
    LEFT JOIN user_profiles p ON p.user_id = e.user_id
    WHERE e.round_id = ?
    ORDER BY e.created_at ASC, e.id ASC
    LIMIT 50
  `).bind(playerRoundId).all();

  return json({
    success: true,
    profile: formatCasinoProfile(profile, session.username),
    table,
    players: (players.results || []).map((row) => ({
      id: Number(row.id),
      user_id: Number(row.user_id),
      username: row.username || `User ${row.user_id}`,
      avatar_url: row.avatar_url || '',
      stake_coins: toCoinAmount(row.stake_pence),
      joined_at: row.created_at,
      status: row.resolved_at ? (Number(row.payout_pence || 0) > 0 ? 'cashed_out' : 'crashed') : 'live',
      payout_coins: toCoinAmount(row.payout_pence),
      cashout_multiplier: row.cashout_multiplier == null ? null : Number(row.cashout_multiplier) / 100
    })),
    entries: (joined.results || []).map((row) => ({
      id: Number(row.id),
      round_id: Number(row.round_id),
      stake_coins: toCoinAmount(row.stake_pence),
      payout_coins: toCoinAmount(row.payout_pence),
      cashout_multiplier: row.cashout_multiplier == null ? null : Number(row.cashout_multiplier) / 100,
      crash_multiplier: row.crash_multiplier == null ? null : Number(row.crash_multiplier) / 100,
      created_at: row.created_at,
      resolved_at: row.resolved_at
    }))
  }, 200, request);
}

async function handleCasinoCrashSprintJoin(request, env) {
  const session = await getSessionUser(request, env);
  if (!session) return json({ success: false, error: "Not authenticated" }, 401, request);
  const casesDb = await ensureCasesWalletTables(env);
  if (!casesDb) return json({ success: false, error: "CASES-DB is not configured" }, 500, request);
  await ensureCasinoProfile(env, session.id, session.username, { force: true });
  await ensureCoreTables(env);
  const parsed = normaliseCrashSprintStake(await safeJson(request));
  if (parsed.error) return json({ success: false, error: parsed.error }, 400, request);

  const nowMs = Date.now();
  const currentRoundId = getCrashSprintRoundId(nowMs);
  await resolveCrashSprintEntries(env, casesDb, currentRoundId - 1);
  const table = getCrashSprintRoundState(currentRoundId, nowMs);
  const joinRoundId = Number(table.joinable_round_id || currentRoundId);

  const existing = await env.DB.prepare(`SELECT id FROM casino_crash_sprint_entries WHERE user_id = ? AND round_id = ? AND resolved_at IS NULL LIMIT 1`).bind(session.id, joinRoundId).first();
  if (existing) return json({ success: false, error: "You already joined the live Crash Sprint round." }, 400, request);

  const profileRow = await casesDb.prepare(`SELECT balance FROM case_profiles WHERE user_id = ? LIMIT 1`).bind(session.id).first();
  const balancePence = Number(profileRow?.balance || 0);
  if (balancePence < parsed.stakePence) return json({ success: false, error: "Not enough Grev Coins for that Crash Sprint stake." }, 400, request);

  const now = isoNow();
  await casesDb.prepare(`UPDATE case_profiles SET balance = balance - ?, updated_at = ? WHERE user_id = ?`).bind(parsed.stakePence, now, session.id).run();
  await env.DB.prepare(`INSERT INTO casino_crash_sprint_entries (user_id, round_id, stake_pence, created_at) VALUES (?, ?, ?, ?)`).bind(session.id, joinRoundId, parsed.stakePence, now).run();
  const updatedProfile = await ensureCasinoProfile(env, session.id, session.username, { force: true });
  return json({ success: true, message: table.crashed ? `You joined Crash Sprint round ${joinRoundId}. It starts soon.` : "You joined the live Crash Sprint table.", table, joined_round_id: joinRoundId, profile: formatCasinoProfile(updatedProfile, session.username) }, 200, request);
}

async function handleCasinoCrashSprintCashout(request, env) {
  const session = await getSessionUser(request, env);
  if (!session) return json({ success: false, error: "Not authenticated" }, 401, request);
  const casesDb = await ensureCasesWalletTables(env);
  if (!casesDb) return json({ success: false, error: "CASES-DB is not configured" }, 500, request);
  await ensureCasinoProfile(env, session.id, session.username, { force: true });
  await ensureCoreTables(env);

  const nowMs = Date.now();
  const currentRoundId = getCrashSprintRoundId(nowMs);
  await resolveCrashSprintEntries(env, casesDb, currentRoundId - 1);
  const table = getCrashSprintRoundState(currentRoundId, nowMs);
  if (table.crashed) return json({ success: false, error: `Crash Sprint already crashed at ${table.crash_multiplier.toFixed(2)}×.` }, 400, request);

  const entry = await env.DB.prepare(`SELECT id, stake_pence FROM casino_crash_sprint_entries WHERE user_id = ? AND round_id = ? AND resolved_at IS NULL LIMIT 1`).bind(session.id, currentRoundId).first();
  if (!entry) return json({ success: false, error: "You do not have a live Crash Sprint run to cash out." }, 404, request);

  const cashoutMultiplierInt = Math.max(100, Math.round(table.live_multiplier * 100));
  const payoutPence = Math.round(Number(entry.stake_pence || 0) * (cashoutMultiplierInt / 100));
  const now = isoNow();
  await casesDb.prepare(`UPDATE case_profiles SET balance = balance + ?, updated_at = ? WHERE user_id = ?`).bind(payoutPence, now, session.id).run();
  await recordCasinoGameEarning(env, "crash-sprint", session.id, payoutPence - Number(entry.stake_pence || 0), now);
  await env.DB.prepare(`UPDATE casino_crash_sprint_entries SET cashout_multiplier = ?, payout_pence = ?, crash_multiplier = ?, resolved_at = ? WHERE id = ?`).bind(cashoutMultiplierInt, payoutPence, Math.round(table.crash_multiplier * 100), now, entry.id).run();

  const updatedProfile = await ensureCasinoProfile(env, session.id, session.username, { force: true });
  return json({ success: true, message: `Cashed out at ${(cashoutMultiplierInt / 100).toFixed(2)}×.`, payout_coins: toCoinAmount(payoutPence), profile: formatCasinoProfile(updatedProfile, session.username) }, 200, request);
}

async function handleCasinoRouletteState(request, env) {
  const session = await getSessionUser(request, env);
  if (!session) return json({ success: false, error: "Not authenticated" }, 401, request);
  const casesDb = await ensureCasesWalletTables(env);
  if (!casesDb) return json({ success: false, error: "CASES-DB is not configured" }, 500, request);
  await ensureCasinoProfile(env, session.id, session.username, { force: true });

  const nowMs = Date.now();
  const currentRoundId = getRouletteRoundId(nowMs);
  await resolveRouletteBets(env, casesDb, currentRoundId - 1);

  const profile = await ensureCasinoProfile(env, session.id, session.username, { force: true });
  const upcomingRoundId = currentRoundId + 1;
  const recentRoundResults = Array.from({ length: 10 }, (_, index) => {
    const roundId = currentRoundId - 1 - index;
    const number = getRouletteRoundNumber(roundId);
    return {
      round_id: roundId,
      number,
      color: getRouletteColor(number),
      dozen: getRouletteDozen(number)
    };
  }).filter((round) => round.round_id >= 0);
  const recentRows = await env.DB.prepare(`
    SELECT id, round_id, bet_type, bet_value, stake_pence, payout_pence, outcome_number, created_at, resolved_at
    FROM casino_roulette_bets
    WHERE user_id = ?
    ORDER BY id DESC
    LIMIT 20
  `).bind(session.id).all();
  const pendingBets = await env.DB.prepare(`
    SELECT
      b.id,
      b.round_id,
      b.bet_type,
      b.bet_value,
      b.stake_pence,
      b.created_at,
      u.username,
      p.avatar_url
    FROM casino_roulette_bets b
    INNER JOIN users u ON u.id = b.user_id
    LEFT JOIN user_profiles p ON p.user_id = b.user_id
    WHERE b.round_id = ? AND b.resolved_at IS NULL
    ORDER BY b.created_at ASC, b.id ASC
    LIMIT 50
  `).bind(upcomingRoundId).all();

  return json({
    success: true,
    profile: formatCasinoProfile(profile, session.username),
    table: {
      current_round_id: currentRoundId,
      round_interval_ms: ROULETTE_ROUND_INTERVAL_MS,
      current_round_started_at: new Date(getRouletteRoundStartMs(currentRoundId)).toISOString(),
      current_round_ends_at: new Date(getRouletteRoundEndMs(currentRoundId)).toISOString(),
      next_round_id: upcomingRoundId,
      next_round_starts_at: new Date(getRouletteRoundStartMs(upcomingRoundId)).toISOString(),
      previous_round: {
        round_id: currentRoundId - 1,
        number: getRouletteRoundNumber(currentRoundId - 1),
        color: getRouletteColor(getRouletteRoundNumber(currentRoundId - 1)),
        dozen: getRouletteDozen(getRouletteRoundNumber(currentRoundId - 1))
      }
    },
    recent_round_results: recentRoundResults,
    pending_bets: (pendingBets.results || []).map((row) => ({
      id: Number(row.id),
      round_id: Number(row.round_id),
      username: row.username || "Unknown",
      avatar_url: row.avatar_url || "",
      bet_type: row.bet_type,
      bet_value: row.bet_value,
      bet_label: getRouletteBetLabel(row.bet_type, row.bet_value),
      stake_coins: toCoinAmount(row.stake_pence),
      created_at: row.created_at
    })),
    bets: (recentRows.results || []).map((row) => ({
      id: Number(row.id),
      round_id: Number(row.round_id),
      bet_type: row.bet_type,
      bet_value: row.bet_value,
      bet_label: getRouletteBetLabel(row.bet_type, row.bet_value),
      stake_coins: toCoinAmount(row.stake_pence),
      payout_coins: toCoinAmount(row.payout_pence),
      outcome_number: row.outcome_number == null ? null : Number(row.outcome_number),
      created_at: row.created_at,
      resolved_at: row.resolved_at
    }))
  }, 200, request);
}

async function handleCasinoRouletteBet(request, env) {
  const session = await getSessionUser(request, env);
  if (!session) return json({ success: false, error: "Not authenticated" }, 401, request);
  const casesDb = await ensureCasesWalletTables(env);
  if (!casesDb) return json({ success: false, error: "CASES-DB is not configured" }, 500, request);
  await ensureCasinoProfile(env, session.id, session.username, { force: true });
  await ensureCoreTables(env);

  const parsed = normaliseRouletteBet(await safeJson(request));
  if (parsed.error) return json({ success: false, error: parsed.error }, 400, request);

  const nowMs = Date.now();
  const upcomingRoundId = getRouletteRoundId(nowMs) + 1;
  await resolveRouletteBets(env, casesDb, upcomingRoundId - 1);

  const profileRow = await casesDb.prepare(`SELECT balance FROM case_profiles WHERE user_id = ? LIMIT 1`).bind(session.id).first();
  const balancePence = Number(profileRow?.balance || 0);
  if (balancePence < parsed.stakePence) return json({ success: false, error: "Not enough Grev Coins for that roulette bet." }, 400, request);

  const now = isoNow();
  await casesDb.prepare(`UPDATE case_profiles SET balance = balance - ?, updated_at = ? WHERE user_id = ?`).bind(parsed.stakePence, now, session.id).run();
  await env.DB.prepare(`
    INSERT INTO casino_roulette_bets (user_id, round_id, bet_type, bet_value, stake_pence, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(session.id, upcomingRoundId, parsed.betType, parsed.betValue, parsed.stakePence, now).run();

  const updatedProfile = await ensureCasinoProfile(env, session.id, session.username, { force: true });
  return json({
    success: true,
    message: "Roulette bet placed for the next round.",
    round_id: upcomingRoundId,
    profile: formatCasinoProfile(updatedProfile, session.username)
  }, 200, request);
}

let footerMetaCache = null;
let footerMetaCacheExpiresAt = 0;

async function fetchLatestGithubMeta(env) {
  const repo = String(env.GITHUB_REPO || GITHUB_REPO_FALLBACK).trim();
  const response = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=1`, {
    headers: { "User-Agent": "grev-dad-site" }
  });
  if (!response.ok) throw new Error(`GitHub metadata request failed with ${response.status}`);
  const payload = await response.json().catch(() => []);
  const commit = Array.isArray(payload) ? payload[0] : null;
  const committedAt = commit?.commit?.committer?.date || null;
  return {
    provider: "github",
    repository: repo,
    branch: "main",
    committed_at: committedAt,
    commit_sha: commit?.sha || null,
    commit_message: commit?.commit?.message || null,
    commit_url: commit?.html_url || `https://github.com/${repo}/commits/main`
  };
}

async function getSiteMeta(env) {
  const now = Date.now();
  if (footerMetaCache && now < footerMetaCacheExpiresAt) return footerMetaCache;
  let source = "github";
  let latest = null;
  try {
    latest = await fetchLatestGithubMeta(env);
  } catch (error) {
    console.error("Failed to fetch GitHub metadata:", error);
    source = "snapshot";
    latest = {
      provider: "snapshot",
      repository: String(env.GITHUB_REPO || GITHUB_REPO_FALLBACK).trim(),
      branch: "main",
      committed_at: "2026-03-23T19:56:54+00:00",
      commit_sha: "6f43417710dbdf801f0b4a67de78ac68d024180d",
      commit_message: "Workspace snapshot metadata fallback",
      commit_url: null
    };
  }

  footerMetaCache = {
    success: true,
    source,
    updated_at: isoNow(),
    github: latest
  };
  footerMetaCacheExpiresAt = now + FOOTER_METADATA_TTL_MS;
  return footerMetaCache;
}

async function handleSiteMeta(request, env) {
  return json(await getSiteMeta(env), 200, request);
}

/* -------------------------------------------------------------------------- */
/*                                   AUTH                                     */
/* -------------------------------------------------------------------------- */

async function handleRegister(request, env) {
  await ensureCoreTables(env);

  const body = await safeJson(request);
  const username = cleanUsername(body?.username);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username || username.length < 3) {
    return json({ success: false, error: "Username must be at least 3 characters" }, 400, request);
  }

  if (username.includes("@")) {
    return json({ success: false, error: "Do not submit an email address!" }, 400, request);
  }

  if (username.length > 30) {
    return json({ success: false, error: "Username must be 30 characters or fewer" }, 400, request);
  }

  if (password.length < 6) {
    return json({ success: false, error: "Password must be at least 6 characters" }, 400, request);
  }

  const existingUser = await env.DB.prepare(
    `SELECT id FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1`
  ).bind(username).first();

  if (existingUser) {
    return json({ success: false, error: "Username already exists" }, 409, request);
  }

  const passwordHash = await hashPassword(password);
  const now = isoNow();

  const result = await env.DB.prepare(`
    INSERT INTO users (
      username,
      password_hash,
      approved,
      is_admin,
      group_name,
      gambling_admin,
      created_at,
      last_seen_at
    )
    VALUES (?, ?, 0, 0, ?, 0, ?, ?)
  `).bind(username, passwordHash, DEFAULT_USER_GROUP, now, now).run();

  const userId = result.meta?.last_row_id ?? null;

  if (userId) {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO user_profiles (
        user_id,
        bio,
        avatar_url,
        real_name,
        motto,
        media_1_url,
        media_2_url,
        media_3_url,
        music_url
      )
      VALUES (?, '', '', '', '', '', '', '', '')
    `).bind(userId).run();
  }

  return json({
    success: true,
    message: "Account created. You can log in right away, and member access will unlock once an admin approves you."
  }, 200, request);
}

async function handleLogin(request, env) {
  await ensureCoreTables(env);

  const body = await safeJson(request);
  const username = cleanUsername(body?.username);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username || !password) {
    return json({ success: false, error: "Username and password are required" }, 400, request);
  }

  const user = await env.DB.prepare(`
    SELECT id, username, password_hash, approved, is_admin, group_name, gambling_admin
    FROM users
    WHERE LOWER(username) = LOWER(?)
    LIMIT 1
  `).bind(username).first();

  if (!user) {
    return json({ success: false, error: "Invalid username or password" }, 401, request);
  }

  const passwordOk = await verifyPassword(password, user.password_hash);
  if (!passwordOk) {
    return json({ success: false, error: "Invalid username or password" }, 401, request);
  }

  const sessionToken = crypto.randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await env.DB.prepare(`
    INSERT INTO sessions (session_token, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).bind(sessionToken, user.id, now.toISOString(), expires.toISOString()).run();

  await env.DB.prepare(`
    UPDATE users
    SET last_seen_at = ?
    WHERE id = ?
  `).bind(now.toISOString(), user.id).run();

  const group = resolveUserGroupName(user.group_name, Boolean(user.approved), Boolean(user.is_admin));

  const response = json({
    success: true,
    message: Boolean(user.approved)
      ? "Login successful"
      : "Login successful. Your account is waiting for approval before member actions unlock.",
    user: {
      id: user.id,
      username: user.username,
      approved: Boolean(user.approved),
      is_admin: Boolean(user.is_admin),
      gambling_admin: Boolean(user.gambling_admin),
      can_manage_gambling: Boolean(user.gambling_admin),
      group,
      groups: buildUserGroups(group, Boolean(user.is_admin))
    }
  }, 200, request);

  response.headers.append("Set-Cookie", buildSessionCookie(sessionToken, expires));
  return response;
}

async function handleLogout(request, env) {
  await ensureCoreTables(env);

  const cookies = parseCookies(request.headers.get("Cookie") || "");
  const sessionToken = cookies[SESSION_COOKIE_NAME];

  if (sessionToken) {
    await env.DB.prepare(`DELETE FROM sessions WHERE session_token = ?`)
      .bind(sessionToken)
      .run();
  }

  const response = json({
    success: true,
    message: "Logged out"
  }, 200, request);

  response.headers.append("Set-Cookie", clearSessionCookie());
  return response;
}

async function handleMe(request, env) {
  await ensureCoreTables(env);

  const session = await getSessionUser(request, env);

  if (!session) {
    return json({ success: false, authenticated: false }, 401, request);
  }

  const group = resolveUserGroupName(session.group_name, Boolean(session.approved), Boolean(session.is_admin));

  return json({
    success: true,
    authenticated: true,
    user: {
      id: session.id,
      username: session.username,
      approved: Boolean(session.approved),
      is_admin: Boolean(session.is_admin),
      gambling_admin: Boolean(session.gambling_admin),
      can_manage_gambling: Boolean(session.gambling_admin),
      group,
      groups: buildUserGroups(group, Boolean(session.is_admin)),
      can_moderate_forum: canModerateForum(group, Boolean(session.is_admin)),
      bio: session.bio || "",
      avatar_url: session.avatar_url || "",
      last_seen_at: session.last_seen_at || null
    }
  }, 200, request);
}

/* -------------------------------------------------------------------------- */
/*                                  PROFILE                                   */
/* -------------------------------------------------------------------------- */

async function handleProfileMe(request, env) {
  await ensureCoreTables(env);

  const session = await getSessionUser(request, env);
  if (!session) {
    return json({ success: false, error: "Not authenticated" }, 401, request);
  }

  const row = await env.DB.prepare(`
    SELECT
      u.id,
      u.username,
      u.approved,
      u.is_admin,
      u.group_name,
      u.gambling_admin,
      u.created_at,
      u.last_seen_at,
      p.real_name,
      p.motto,
      p.bio,
      p.avatar_url,
      p.media_1_url,
      p.media_2_url,
      p.media_3_url,
      p.music_url,
      p.profile_accent_color,
      p.profile_accent_color_secondary,
      p.avatar_initials,
      p.avatar_style,
      p.pronouns,
      p.location,
      p.favorite_game,
      p.steam_url,
      p.leetify_url,
      p.refrag_url,
      c.grev_coin_balance
    FROM users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
    LEFT JOIN casino_profiles c ON c.user_id = u.id
    WHERE u.id = ?
    LIMIT 1
  `).bind(session.id).first();

  if (!row) {
    return json({ success: false, error: "Profile not found" }, 404, request);
  }

  return json({
    success: true,
    profile: formatProfileRow(row)
  }, 200, request);
}

async function handleProfileView(request, env) {
  await ensureCoreTables(env);

  const url = new URL(request.url);
  const userId = Number(url.searchParams.get("id") || "");

  let targetUserId = userId;

  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    const session = await getSessionUser(request, env);
    if (!session) {
      return json({ success: false, error: "A valid user id is required" }, 400, request);
    }
    targetUserId = session.id;
  }

  const row = await env.DB.prepare(`
    SELECT
      u.id,
      u.username,
      u.approved,
      u.is_admin,
      u.group_name,
      u.gambling_admin,
      u.created_at,
      u.last_seen_at,
      p.real_name,
      p.motto,
      p.bio,
      p.avatar_url,
      p.media_1_url,
      p.media_2_url,
      p.media_3_url,
      p.music_url,
      p.profile_accent_color,
      p.profile_accent_color_secondary,
      p.avatar_initials,
      p.avatar_style,
      p.pronouns,
      p.location,
      p.favorite_game,
      p.steam_url,
      p.leetify_url,
      p.refrag_url,
      c.grev_coin_balance
    FROM users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
    LEFT JOIN casino_profiles c ON c.user_id = u.id
    WHERE u.id = ? AND u.approved = 1
    LIMIT 1
  `).bind(targetUserId).first();

  if (!row) {
    return json({ success: false, error: "Profile not found" }, 404, request);
  }

  return json({
    success: true,
    profile: formatProfileRow(row)
  }, 200, request);
}

async function handleProfileUpdate(request, env) {
  await ensureCoreTables(env);

  const session = await getSessionUser(request, env);
  if (!session) {
    return json({ success: false, error: "Not authenticated" }, 401, request);
  }

  const body = await safeJson(request);

  const realName = cleanShortText(body?.real_name, 80);
  const motto = cleanShortText(body?.motto, 140);
  const bio = cleanLongText(body?.bio, 3000);
  const avatarUrl = cleanAvatarUrl(body?.avatar_url);
  const media1 = cleanUrl(body?.media_1_url, 1200);
  const media2 = cleanUrl(body?.media_2_url, 1200);
  const media3 = cleanUrl(body?.media_3_url, 1200);
  const musicUrl = cleanUrl(body?.music_url, 1200);
  const steamUrl = cleanUrl(body?.steam_url, 1200);
  const leetifyUrl = cleanUrl(body?.leetify_url, 1200);
  const refragUrl = cleanUrl(body?.refrag_url, 1200);
  const profileAccentColor = /^#[0-9a-fA-F]{6}$/.test(String(body?.profile_accent_color || "").trim()) ? String(body.profile_accent_color).trim() : "#1f2937";
  const profileAccentColorSecondary = /^#[0-9a-fA-F]{6}$/.test(String(body?.profile_accent_color_secondary || "").trim()) ? String(body.profile_accent_color_secondary).trim() : "#0f172a";
  const avatarInitials = cleanShortText(body?.avatar_initials, 3).toUpperCase();
  const avatarStyle = ["rounded", "circle", "diamond"].includes(String(body?.avatar_style || "").trim()) ? String(body.avatar_style).trim() : "rounded";
  const pronouns = cleanShortText(body?.pronouns, 50);
  const location = cleanShortText(body?.location, 120);
  const favoriteGame = cleanShortText(body?.favorite_game, 120);

  await env.DB.prepare(`
    INSERT OR IGNORE INTO user_profiles (
      user_id,
      bio,
      avatar_url,
      real_name,
      motto,
      media_1_url,
      media_2_url,
      media_3_url,
      music_url,
      profile_accent_color,
      profile_accent_color_secondary,
      avatar_initials,
      avatar_style,
      pronouns,
      location,
      favorite_game,
      steam_url,
      leetify_url,
      refrag_url
    )
    VALUES (?, '', '', '', '', '', '', '', '', '#1f2937', '#0f172a', '', 'rounded', '', '', '', '', '', '')
  `).bind(session.id).run();

  await env.DB.prepare(`
    UPDATE user_profiles
    SET
      real_name = ?,
      motto = ?,
      bio = ?,
      avatar_url = ?,
      media_1_url = ?,
      media_2_url = ?,
      media_3_url = ?,
      music_url = ?,
      profile_accent_color = ?,
      profile_accent_color_secondary = ?,
      avatar_initials = ?,
      avatar_style = ?,
      pronouns = ?,
      location = ?,
      favorite_game = ?,
      steam_url = ?,
      leetify_url = ?,
      refrag_url = ?
    WHERE user_id = ?
  `).bind(
    realName,
    motto,
    bio,
    avatarUrl,
    media1,
    media2,
    media3,
    musicUrl,
    profileAccentColor,
    profileAccentColorSecondary,
    avatarInitials,
    avatarStyle,
    pronouns,
    location,
    favoriteGame,
    steamUrl,
    leetifyUrl,
    refragUrl,
    session.id
  ).run();

  const row = await env.DB.prepare(`
    SELECT
      u.id,
      u.username,
      u.approved,
      u.is_admin,
      u.group_name,
      u.gambling_admin,
      u.created_at,
      u.last_seen_at,
      p.real_name,
      p.motto,
      p.bio,
      p.avatar_url,
      p.media_1_url,
      p.media_2_url,
      p.media_3_url,
      p.music_url,
      p.profile_accent_color,
      p.profile_accent_color_secondary,
      p.avatar_initials,
      p.avatar_style,
      p.pronouns,
      p.location,
      p.favorite_game,
      p.steam_url,
      p.leetify_url,
      p.refrag_url,
      c.grev_coin_balance
    FROM users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
    LEFT JOIN casino_profiles c ON c.user_id = u.id
    WHERE u.id = ?
    LIMIT 1
  `).bind(session.id).first();

  return json({
    success: true,
    message: "Profile updated",
    profile: formatProfileRow(row)
  }, 200, request);
}

function formatProfileRow(row) {
  const group = resolveUserGroupName(row.group_name, Boolean(row.approved), Boolean(row.is_admin));

  const media = [
    row.media_1_url || "",
    row.media_2_url || "",
    row.media_3_url || ""
  ].filter(Boolean);

  return {
    id: row.id,
    username: row.username,
    approved: Boolean(row.approved),
    is_admin: Boolean(row.is_admin),
    gambling_admin: Boolean(row.gambling_admin),
    can_manage_gambling: Boolean(row.gambling_admin),
    group,
    group_display: displayGroupName(group, Boolean(row.is_admin)),
    created_at: row.created_at || null,
    last_seen_at: row.last_seen_at || null,
    real_name: row.real_name || "",
    motto: row.motto || "",
    bio: row.bio || "",
    avatar_url: row.avatar_url || "",
    media_1_url: row.media_1_url || "",
    media_2_url: row.media_2_url || "",
    media_3_url: row.media_3_url || "",
    music_url: row.music_url || "",
    steam_url: row.steam_url || "",
    leetify_url: row.leetify_url || "",
    refrag_url: row.refrag_url || "",
    profile_accent_color: row.profile_accent_color || "#1f2937",
    profile_accent_color_secondary: row.profile_accent_color_secondary || "#0f172a",
    avatar_initials: row.avatar_initials || "",
    avatar_style: row.avatar_style || "rounded",
    pronouns: row.pronouns || "",
    location: row.location || "",
    favorite_game: row.favorite_game || "",
    casino_balance_pence: Number(row.grev_coin_balance || 0),
    casino_balance: toCoinAmount(row.grev_coin_balance || 0),
    media,
    current_activity: null
  };
}

/* -------------------------------------------------------------------------- */
/*                                   USERS                                    */
/* -------------------------------------------------------------------------- */

async function handleMembers(request, env) {
  await ensureCoreTables(env);

  const session = await getSessionUser(request, env);
  if (!session) {
    return json({ success: false, error: "Not authenticated" }, 401, request);
  }

  const rows = await env.DB.prepare(`
    SELECT
      u.id,
      u.username,
      u.is_admin,
      u.group_name,
      u.gambling_admin,
      u.last_seen_at,
      p.bio,
      p.avatar_url,
      p.real_name,
      p.motto,
      p.steam_url,
      p.leetify_url,
      p.refrag_url
    FROM users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
    WHERE u.approved = 1
    ORDER BY LOWER(u.username) ASC
  `).all();

  const members = [];

  for (const row of rows.results || []) {
    const group = resolveUserGroupName(row.group_name, Boolean(row.approved), Boolean(row.is_admin));

    members.push({
      id: row.id,
      username: row.username,
      is_admin: Boolean(row.is_admin),
      group,
      groups: buildUserGroups(group, Boolean(row.is_admin)),
      last_seen_at: row.last_seen_at || null,
      bio: row.bio || "",
      avatar_url: row.avatar_url || "",
      real_name: row.real_name || "",
      motto: row.motto || "",
      steam_url: row.steam_url || "",
      leetify_url: row.leetify_url || "",
      refrag_url: row.refrag_url || "",
      current_activity: null
    });
  }

  return json({ success: true, members }, 200, request);
}


/* -------------------------------------------------------------------------- */
/*                                GLOBAL CHAT                                 */
/* -------------------------------------------------------------------------- */


function getChatMessagesTable(scope) {
  return scope === "casino" ? "casino_chat_messages" : "global_chat_messages";
}

async function fetchChatMessages(env, scope, limit) {
  const tableName = getChatMessagesTable(scope);
  const rows = await env.DB.prepare(`
    SELECT m.id, m.author_user_id, m.author_username, m.author_group, m.message, m.created_at, p.avatar_url
    FROM ${tableName} m
    LEFT JOIN user_profiles p ON p.user_id = m.author_user_id
    ORDER BY m.id DESC
    LIMIT ?
  `).bind(limit).all();

  return (rows.results || []).reverse().map((row) => ({
    ...row,
    avatar_url: row.avatar_url || ""
  }));
}

async function postChatMessage(request, env, scope) {
  await ensureCoreTables(env);

  const session = await getSessionUser(request, env);
  if (!session) {
    return json({ success: false, error: "You must be logged in to send messages" }, 401, request);
  }

  const body = await safeJson(request);
  const message = cleanMessage(body?.message);

  if (!message) {
    return json({ success: false, error: "Message cannot be empty" }, 400, request);
  }

  const authorGroup = displayGroupName(
    normaliseGroupName(session.group_name, Boolean(session.is_admin)),
    Boolean(session.is_admin)
  );

  const now = isoNow();
  const tableName = getChatMessagesTable(scope);

  const result = await env.DB.prepare(`
    INSERT INTO ${tableName} (
      author_user_id,
      author_username,
      author_group,
      message,
      created_at
    )
    VALUES (?, ?, ?, ?, ?)
  `).bind(session.id, session.username, authorGroup, message, now).run();

  await env.DB.prepare(`
    UPDATE users
    SET last_seen_at = ?
    WHERE id = ?
  `).bind(now, session.id).run();

  const avatar = await env.DB.prepare(`SELECT avatar_url FROM user_profiles WHERE user_id = ? LIMIT 1`).bind(session.id).first();

  return json({
    success: true,
    message: "Message sent",
    chat_message: {
      id: result.meta?.last_row_id ?? null,
      author_user_id: session.id,
      author_username: session.username,
      author_group: authorGroup,
      avatar_url: avatar?.avatar_url || "",
      message,
      created_at: now
    }
  }, 200, request);
}

async function handleGetGlobalChat(request, env) {
  await ensureCoreTables(env);
  return json({ success: true, messages: await fetchChatMessages(env, "global", GLOBAL_CHAT_MESSAGE_LIMIT) }, 200, request);
}

async function handlePostGlobalChat(request, env) {
  return postChatMessage(request, env, "global");
}

async function handleGetCasinoChat(request, env) {
  await ensureCoreTables(env);
  return json({ success: true, messages: await fetchChatMessages(env, "casino", CASINO_CHAT_MESSAGE_LIMIT) }, 200, request);
}

async function handlePostCasinoChat(request, env) {
  return postChatMessage(request, env, "casino");
}

/* -------------------------------------------------------------------------- */
/*                                   FORUM                                    */
/* -------------------------------------------------------------------------- */

async function handleForumPosts(request, env) {
  await ensureCoreTables(env);

  const url = new URL(request.url);
  const search = (url.searchParams.get("search") || "").trim().toLowerCase();
  const session = await getSessionUser(request, env);

  const rows = await env.DB.prepare(`
    SELECT
      p.id,
      p.author_user_id,
      p.author_username,
      p.author_group,
      p.title,
      p.body,
      p.image_url,
      p.created_at,
      p.updated_at,
      COALESCE(c.comment_count, 0) AS comment_count,
      COALESCE(r.like_count, 0) AS like_count,
      COALESCE(r.dislike_count, 0) AS dislike_count
    FROM forum_posts p
    LEFT JOIN (
      SELECT post_id, COUNT(*) AS comment_count
      FROM forum_comments
      GROUP BY post_id
    ) c ON c.post_id = p.id
    LEFT JOIN (
      SELECT
        post_id,
        SUM(CASE WHEN reaction_type = 'like' THEN 1 ELSE 0 END) AS like_count,
        SUM(CASE WHEN reaction_type = 'dislike' THEN 1 ELSE 0 END) AS dislike_count
      FROM forum_reactions
      GROUP BY post_id
    ) r ON r.post_id = p.id
    ORDER BY p.id DESC
    LIMIT ?
  `).bind(FORUM_POST_LIMIT).all();

  let posts = rows.results || [];

  if (search) {
    posts = posts.filter((post) =>
      String(post.title || "").toLowerCase().includes(search) ||
      String(post.body || "").toLowerCase().includes(search) ||
      String(post.author_username || "").toLowerCase().includes(search)
    );
  }

  return json({
    success: true,
    posts: posts.map((post) => ({
      ...post,
      can_remove: session
        ? canModerateForum(
            normaliseGroupName(session.group_name, Boolean(session.is_admin)),
            Boolean(session.is_admin)
          )
        : false
    }))
  }, 200, request);
}

async function handleForumPost(request, env) {
  await ensureCoreTables(env);

  const url = new URL(request.url);
  const postId = Number(url.searchParams.get("id") || "");
  const session = await getSessionUser(request, env);

  if (!Number.isInteger(postId) || postId <= 0) {
    return json({ success: false, error: "A valid post id is required" }, 400, request);
  }

  const post = await env.DB.prepare(`
    SELECT
      p.id,
      p.author_user_id,
      p.author_username,
      p.author_group,
      p.title,
      p.body,
      p.image_url,
      p.created_at,
      p.updated_at,
      COALESCE(c.comment_count, 0) AS comment_count,
      COALESCE(r.like_count, 0) AS like_count,
      COALESCE(r.dislike_count, 0) AS dislike_count
    FROM forum_posts p
    LEFT JOIN (
      SELECT post_id, COUNT(*) AS comment_count
      FROM forum_comments
      GROUP BY post_id
    ) c ON c.post_id = p.id
    LEFT JOIN (
      SELECT
        post_id,
        SUM(CASE WHEN reaction_type = 'like' THEN 1 ELSE 0 END) AS like_count,
        SUM(CASE WHEN reaction_type = 'dislike' THEN 1 ELSE 0 END) AS dislike_count
      FROM forum_reactions
      GROUP BY post_id
    ) r ON r.post_id = p.id
    WHERE p.id = ?
    LIMIT 1
  `).bind(postId).first();

  if (!post) {
    return json({ success: false, error: "Post not found" }, 404, request);
  }

  let userReaction = null;
  let canRemove = false;

  if (session) {
    const reaction = await env.DB.prepare(`
      SELECT reaction_type
      FROM forum_reactions
      WHERE post_id = ? AND user_id = ?
      LIMIT 1
    `).bind(postId, session.id).first();

    userReaction = reaction?.reaction_type || null;

    canRemove = canModerateForum(
      normaliseGroupName(session.group_name, Boolean(session.is_admin)),
      Boolean(session.is_admin)
    );
  }

  return json({
    success: true,
    post: {
      ...post,
      user_reaction: userReaction,
      can_remove: canRemove
    }
  }, 200, request);
}

async function handleForumComments(request, env) {
  await ensureCoreTables(env);

  const url = new URL(request.url);
  const postId = Number(url.searchParams.get("post_id") || "");

  if (!Number.isInteger(postId) || postId <= 0) {
    return json({ success: false, error: "A valid post id is required" }, 400, request);
  }

  const rows = await env.DB.prepare(`
    SELECT
      id,
      post_id,
      author_user_id,
      author_username,
      author_group,
      comment,
      created_at
    FROM forum_comments
    WHERE post_id = ?
    ORDER BY id ASC
  `).bind(postId).all();

  return json({
    success: true,
    comments: rows.results || []
  }, 200, request);
}

async function handleForumCreatePost(request, env) {
  await ensureCoreTables(env);

  const session = await getApprovedUser(request, env);
  if (session instanceof Response) return session;

  const body = await safeJson(request);
  const title = cleanForumTitle(body?.title);
  const postBody = cleanForumBody(body?.body);
  const imageUrl = cleanUrl(body?.image_url, 1200);

  if (!title) {
    return json({ success: false, error: "Post title is required" }, 400, request);
  }

  if (!postBody) {
    return json({ success: false, error: "Post body is required" }, 400, request);
  }

  const authorGroup = displayGroupName(
    normaliseGroupName(session.group_name, Boolean(session.is_admin)),
    Boolean(session.is_admin)
  );

  const now = isoNow();

  const result = await env.DB.prepare(`
    INSERT INTO forum_posts (
      author_user_id,
      author_username,
      author_group,
      title,
      body,
      image_url,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(session.id, session.username, authorGroup, title, postBody, imageUrl, now, now).run();

  return json({
    success: true,
    message: "Post created",
    post_id: result.meta?.last_row_id ?? null
  }, 200, request);
}

async function handleForumCreateComment(request, env) {
  await ensureCoreTables(env);

  const session = await getApprovedUser(request, env);
  if (session instanceof Response) return session;

  const body = await safeJson(request);
  const postId = Number(body?.post_id);
  const comment = cleanForumComment(body?.comment);

  if (!Number.isInteger(postId) || postId <= 0) {
    return json({ success: false, error: "A valid post id is required" }, 400, request);
  }

  if (!comment) {
    return json({ success: false, error: "Comment cannot be empty" }, 400, request);
  }

  const post = await env.DB.prepare(`SELECT id FROM forum_posts WHERE id = ? LIMIT 1`)
    .bind(postId)
    .first();

  if (!post) {
    return json({ success: false, error: "Post not found" }, 404, request);
  }

  const authorGroup = displayGroupName(
    normaliseGroupName(session.group_name, Boolean(session.is_admin)),
    Boolean(session.is_admin)
  );

  const now = isoNow();

  await env.DB.prepare(`
    INSERT INTO forum_comments (
      post_id,
      author_user_id,
      author_username,
      author_group,
      comment,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(postId, session.id, session.username, authorGroup, comment, now).run();

  await env.DB.prepare(`
    UPDATE forum_posts
    SET updated_at = ?
    WHERE id = ?
  `).bind(now, postId).run();

  return json({
    success: true,
    message: "Comment added"
  }, 200, request);
}

async function handleForumReact(request, env) {
  await ensureCoreTables(env);

  const session = await getApprovedUser(request, env);
  if (session instanceof Response) return session;

  const body = await safeJson(request);
  const postId = Number(body?.post_id);
  const reactionType = normaliseReactionType(body?.reaction_type);

  if (!Number.isInteger(postId) || postId <= 0) {
    return json({ success: false, error: "A valid post id is required" }, 400, request);
  }

  if (!reactionType) {
    return json({ success: false, error: "Reaction must be like or dislike" }, 400, request);
  }

  const post = await env.DB.prepare(`SELECT id FROM forum_posts WHERE id = ? LIMIT 1`)
    .bind(postId)
    .first();

  if (!post) {
    return json({ success: false, error: "Post not found" }, 404, request);
  }

  const existing = await env.DB.prepare(`
    SELECT id, reaction_type
    FROM forum_reactions
    WHERE post_id = ? AND user_id = ?
    LIMIT 1
  `).bind(postId, session.id).first();

  const now = isoNow();

  if (!existing) {
    await env.DB.prepare(`
      INSERT INTO forum_reactions (post_id, user_id, reaction_type, created_at)
      VALUES (?, ?, ?, ?)
    `).bind(postId, session.id, reactionType, now).run();
  } else if (existing.reaction_type === reactionType) {
    await env.DB.prepare(`DELETE FROM forum_reactions WHERE id = ?`)
      .bind(existing.id)
      .run();
  } else {
    await env.DB.prepare(`
      UPDATE forum_reactions
      SET reaction_type = ?, created_at = ?
      WHERE id = ?
    `).bind(reactionType, now, existing.id).run();
  }

  return json({
    success: true,
    message: "Reaction updated"
  }, 200, request);
}

async function handleForumRemovePost(request, env) {
  await ensureCoreTables(env);

  const session = await getApprovedUser(request, env);
  if (session instanceof Response) return session;

  const group = resolveUserGroupName(session.group_name, Boolean(session.approved), Boolean(session.is_admin));
  if (!canModerateForum(group, Boolean(session.is_admin))) {
    return json({ success: false, error: "You do not have permission to remove posts" }, 403, request);
  }

  const body = await safeJson(request);
  const postId = Number(body?.post_id);

  if (!Number.isInteger(postId) || postId <= 0) {
    return json({ success: false, error: "A valid post id is required" }, 400, request);
  }

  const existing = await env.DB.prepare(`SELECT id FROM forum_posts WHERE id = ? LIMIT 1`)
    .bind(postId)
    .first();

  if (!existing) {
    return json({ success: false, error: "Post not found" }, 404, request);
  }

  await env.DB.prepare(`DELETE FROM forum_comments WHERE post_id = ?`).bind(postId).run();
  await env.DB.prepare(`DELETE FROM forum_reactions WHERE post_id = ?`).bind(postId).run();
  await env.DB.prepare(`DELETE FROM forum_posts WHERE id = ?`).bind(postId).run();

  return json({
    success: true,
    message: "Post removed"
  }, 200, request);
}

/* -------------------------------------------------------------------------- */
/*                                   ADMIN                                    */
/* -------------------------------------------------------------------------- */

async function attachCasinoAdminStats(env, users) {
  const list = Array.isArray(users) ? users : [];
  if (!list.length) return list;

  const ids = [...new Set(list.map((user) => Number(user.id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length) return list;

  const placeholders = ids.map(() => "?").join(",");
  const rows = await env.DB.prepare(`
    SELECT user_id, grev_coin_balance, refreshed_at
    FROM casino_profiles
    WHERE user_id IN (${placeholders})
  `).bind(...ids).all();

  const statsByUserId = new Map((rows.results || []).map((row) => [Number(row.user_id), {
    grev_coin_balance: toCoinAmount(row.grev_coin_balance || 0),
    grev_coin_balance_pence: Number(row.grev_coin_balance || 0),
    casino_refreshed_at: row.refreshed_at || null
  }]));

  return list.map((user) => ({
    ...user,
    grev_coin_balance: statsByUserId.get(Number(user.id))?.grev_coin_balance ?? null,
    grev_coin_balance_pence: statsByUserId.get(Number(user.id))?.grev_coin_balance_pence ?? null,
    casino_refreshed_at: statsByUserId.get(Number(user.id))?.casino_refreshed_at ?? null
  }));
}

async function handleAdminUsers(request, env) {
  await ensureCoreTables(env);

  const adminUser = await requireAdmin(request, env);
  if (adminUser instanceof Response) return adminUser;

  const url = new URL(request.url);
  const search = (url.searchParams.get("search") || "").trim().toLowerCase();

  const rows = await env.DB.prepare(`
    SELECT
      u.id,
      u.username,
      u.approved,
      u.is_admin,
      u.group_name,
      u.gambling_admin,
      u.created_at,
      u.last_seen_at,
      p.bio,
      p.avatar_url,
      p.real_name,
      p.motto,
      p.media_1_url,
      p.media_2_url,
      p.media_3_url,
      p.music_url,
      p.profile_accent_color,
      p.profile_accent_color_secondary,
      p.avatar_initials,
      p.avatar_style,
      p.pronouns,
      p.location,
      p.favorite_game,
      p.steam_url,
      p.leetify_url,
      p.refrag_url,
      c.grev_coin_balance
    FROM users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
    LEFT JOIN casino_profiles c ON c.user_id = u.id
    ORDER BY LOWER(u.username) ASC
  `).all();

  let users = (rows.results || []).map(formatAdminUserRow);
  users = await attachCasinoAdminStats(env, users);

  if (search) {
    users = users.filter((user) =>
      user.username.toLowerCase().includes(search) ||
      user.group.toLowerCase().includes(search)
    );
  }

  return json({
    success: true,
    users,
    available_groups: ALLOWED_GROUPS
  }, 200, request);
}

async function handleAdminUser(request, env) {
  await ensureCoreTables(env);

  const adminUser = await requireAdmin(request, env);
  if (adminUser instanceof Response) return adminUser;

  const url = new URL(request.url);
  const userId = Number(url.searchParams.get("id") || "");

  if (!Number.isInteger(userId) || userId <= 0) {
    return json({ success: false, error: "A valid user id is required" }, 400, request);
  }

  const row = await env.DB.prepare(`
    SELECT
      u.id,
      u.username,
      u.approved,
      u.is_admin,
      u.group_name,
      u.gambling_admin,
      u.created_at,
      u.last_seen_at,
      p.bio,
      p.avatar_url,
      p.real_name,
      p.motto,
      p.media_1_url,
      p.media_2_url,
      p.media_3_url,
      p.music_url,
      p.profile_accent_color,
      p.profile_accent_color_secondary,
      p.avatar_initials,
      p.avatar_style,
      p.pronouns,
      p.location,
      p.favorite_game,
      p.steam_url,
      p.leetify_url,
      p.refrag_url,
      c.grev_coin_balance
    FROM users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
    LEFT JOIN casino_profiles c ON c.user_id = u.id
    WHERE u.id = ?
    LIMIT 1
  `).bind(userId).first();

  if (!row) {
    return json({ success: false, error: "User not found" }, 404, request);
  }

  const [userWithStats] = await attachCasinoAdminStats(env, [formatAdminUserRow(row)]);

  return json({
    success: true,
    user: userWithStats,
    available_groups: ALLOWED_GROUPS
  }, 200, request);
}

async function handleAdminPendingUsers(request, env) {
  await ensureCoreTables(env);

  const adminUser = await requireAdmin(request, env);
  if (adminUser instanceof Response) return adminUser;

  const rows = await env.DB.prepare(`
    SELECT
      id,
      username,
      approved,
      is_admin,
      group_name,
      gambling_admin,
      created_at,
      last_seen_at
    FROM users
    WHERE approved = 0
    ORDER BY created_at ASC
  `).all();

  return json({
    success: true,
    users: await attachCasinoAdminStats(env, (rows.results || []).map(formatAdminUserRow))
  }, 200, request);
}

async function handleAdminReadCasinoDatabase(request, env) {
  await ensureCoreTables(env);

  const adminUser = await requireAdmin(request, env);
  if (adminUser instanceof Response) return adminUser;

  const body = await safeJson(request);
  const userId = Number(body?.user_id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return json({ success: false, error: "A valid user id is required" }, 400, request);
  }

  const existingUser = await env.DB.prepare(`SELECT id, username FROM users WHERE id = ? LIMIT 1`).bind(userId).first();
  if (!existingUser) {
    return json({ success: false, error: "User not found" }, 404, request);
  }

  const profile = await ensureCasinoProfile(env, userId, existingUser.username, { force: true });
  const dailySpin = await getCasinoDailySpinState(env, userId);

  return json({
    success: true,
    message: "Casino wallet reloaded from CASES-DB",
    profile: formatCasinoProfile(profile, existingUser.username),
    daily_spin: dailySpin
  }, 200, request);
}

async function handleAdminUpdateUser(request, env) {
  await ensureCoreTables(env);

  const adminUser = await requireAdmin(request, env);
  if (adminUser instanceof Response) return adminUser;

  const body = await safeJson(request);

  const userId = Number(body?.user_id);
  const approved = body?.approved;
  const isAdmin = body?.is_admin;
  const gamblingAdmin = body?.gambling_admin;
  const requestedGroup = sanitiseGroupName(body?.group_name);
  const gamblingBalanceDelta = Number(body?.gambling_balance_delta ?? body?.grev_coin_balance_delta ?? 0);
  const profileFields = {
    real_name: typeof body?.real_name === "string" ? body.real_name.trim().slice(0, 80) : "",
    motto: typeof body?.motto === "string" ? body.motto.trim().slice(0, 140) : "",
    bio: typeof body?.bio === "string" ? body.bio.trim().slice(0, 3000) : "",
    avatar_url: Object.prototype.hasOwnProperty.call(body || {}, "avatar_url") ? cleanAvatarUrl(body?.avatar_url) : null,
    media_1_url: cleanUrl(body?.media_1_url, 1200),
    media_2_url: cleanUrl(body?.media_2_url, 1200),
    media_3_url: cleanUrl(body?.media_3_url, 1200),
    music_url: cleanUrl(body?.music_url, 1200),
    steam_url: cleanUrl(body?.steam_url, 1200),
    leetify_url: cleanUrl(body?.leetify_url, 1200),
    refrag_url: cleanUrl(body?.refrag_url, 1200),
    profile_accent_color: /^#[0-9a-fA-F]{6}$/.test(String(body?.profile_accent_color || '').trim()) ? String(body.profile_accent_color).trim() : '#1f2937',
    profile_accent_color_secondary: /^#[0-9a-fA-F]{6}$/.test(String(body?.profile_accent_color_secondary || '').trim()) ? String(body.profile_accent_color_secondary).trim() : '#0f172a',
    avatar_initials: typeof body?.avatar_initials === "string" ? body.avatar_initials.trim().slice(0, 3).toUpperCase() : "",
    avatar_style: ["rounded", "circle", "diamond"].includes(String(body?.avatar_style || '').trim()) ? String(body.avatar_style).trim() : "rounded",
    pronouns: typeof body?.pronouns === "string" ? body.pronouns.trim().slice(0, 50) : "",
    location: typeof body?.location === "string" ? body.location.trim().slice(0, 120) : "",
    favorite_game: typeof body?.favorite_game === "string" ? body.favorite_game.trim().slice(0, 120) : ""
  };

  if (!Number.isInteger(userId) || userId <= 0) {
    return json({ success: false, error: "A valid user id is required" }, 400, request);
  }

  if (!requestedGroup) {
    return json({ success: false, error: "A valid group is required" }, 400, request);
  }

  const existingUser = await env.DB.prepare(`
    SELECT id, username, is_admin, group_name, gambling_admin
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(userId).first();

  if (!Number.isFinite(gamblingBalanceDelta) || !Number.isInteger(gamblingBalanceDelta)) {
    return json({ success: false, error: "gambling_balance_delta must be an integer amount in pence" }, 400, request);
  }

  if (!existingUser) {
    return json({ success: false, error: "User not found" }, 404, request);
  }

  if (existingUser.id === adminUser.id && approved === false) {
    return json({ success: false, error: "You cannot unapprove your own account" }, 400, request);
  }

  const nextIsAdmin = Boolean(isAdmin) || requestedGroup === "admin";
  const nextApproved = approved === undefined ? true : Boolean(approved);
  let nextGroup = requestedGroup === "admin" ? "admin" : requestedGroup;

  if (!nextIsAdmin && requestedGroup === "standard") {
    nextGroup = nextApproved ? "member" : "standard";
  }

  let nextBalance = null;
  if (gamblingBalanceDelta !== 0) {
    const profile = await ensureCasinoProfile(env, userId, existingUser.username, { force: true });
    const currentBalance = Number(profile?.grev_coin_balance || 0);
    nextBalance = currentBalance + gamblingBalanceDelta;

    if (nextBalance < 0) {
      return json({ success: false, error: "Balance update would make the gambling balance negative" }, 400, request);
    }
  }

  await env.DB.prepare(`
    UPDATE users
    SET approved = ?, is_admin = ?, group_name = ?, gambling_admin = ?
    WHERE id = ?
  `).bind(nextApproved ? 1 : 0, nextIsAdmin ? 1 : 0, nextGroup, Boolean(gamblingAdmin) ? 1 : 0, userId).run();

  await env.DB.prepare(`
    INSERT OR IGNORE INTO user_profiles (
      user_id, bio, avatar_url, real_name, motto, media_1_url, media_2_url, media_3_url, music_url, profile_accent_color, profile_accent_color_secondary, avatar_initials, avatar_style, pronouns, location, favorite_game, steam_url, leetify_url, refrag_url
    ) VALUES (?, '', '', '', '', '', '', '', '', '#1f2937', '#0f172a', '', 'rounded', '', '', '', '', '', '')
  `).bind(userId).run();

  await env.DB.prepare(`
    UPDATE user_profiles
    SET real_name = ?, motto = ?, bio = ?, avatar_url = COALESCE(?, avatar_url), media_1_url = ?, media_2_url = ?, media_3_url = ?, music_url = ?, profile_accent_color = ?, profile_accent_color_secondary = ?, avatar_initials = ?, avatar_style = ?, pronouns = ?, location = ?, favorite_game = ?, steam_url = ?, leetify_url = ?, refrag_url = ?
    WHERE user_id = ?
  `).bind(
    profileFields.real_name,
    profileFields.motto,
    profileFields.bio,
    profileFields.avatar_url,
    profileFields.media_1_url,
    profileFields.media_2_url,
    profileFields.media_3_url,
    profileFields.music_url,
    profileFields.profile_accent_color,
    profileFields.profile_accent_color_secondary,
    profileFields.avatar_initials,
    profileFields.avatar_style,
    profileFields.pronouns,
    profileFields.location,
    profileFields.favorite_game,
    profileFields.steam_url,
    profileFields.leetify_url,
    profileFields.refrag_url,
    userId
  ).run();

  let updatedBalance = null;
  if (nextBalance != null) {
    const casesDb = await ensureCasesWalletTables(env);
    const now = isoNow();
    if (casesDb) {
      await casesDb.prepare(`UPDATE case_profiles SET balance = ?, updated_at = ? WHERE user_id = ?`).bind(nextBalance, now, userId).run();
    }
    await env.DB.prepare(`
      UPDATE casino_profiles
      SET grev_coin_balance = ?, updated_at = ?, refreshed_at = ?
      WHERE user_id = ?
    `).bind(nextBalance, now, now, userId).run();

    updatedBalance = nextBalance;
  }

  const updatedRow = await env.DB.prepare(`
    SELECT
      u.id,
      u.username,
      u.approved,
      u.is_admin,
      u.group_name,
      u.gambling_admin,
      u.created_at,
      u.last_seen_at,
      p.bio,
      p.avatar_url,
      p.real_name,
      p.motto,
      p.media_1_url,
      p.media_2_url,
      p.media_3_url,
      p.music_url,
      p.profile_accent_color,
      p.profile_accent_color_secondary,
      p.avatar_initials,
      p.avatar_style,
      p.pronouns,
      p.location,
      p.favorite_game,
      p.steam_url,
      p.leetify_url,
      p.refrag_url,
      c.grev_coin_balance
    FROM users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
    LEFT JOIN casino_profiles c ON c.user_id = u.id
    WHERE u.id = ?
    LIMIT 1
  `).bind(userId).first();

  const [userWithStats] = await attachCasinoAdminStats(env, [formatAdminUserRow(updatedRow)]);

  return json({
    success: true,
    message: updatedBalance == null ? "User updated successfully" : "User and gambling balance updated successfully",
    user: userWithStats,
    gambling_balance_delta: gamblingBalanceDelta,
    balance_after: updatedBalance
  }, 200, request);
}

async function requireAdmin(request, env) {
  const session = await getSessionUser(request, env);

  if (!session) {
    return json({ success: false, error: "Not authenticated" }, 401, request);
  }

  if (!Boolean(session.is_admin)) {
    return json({ success: false, error: "Admin access required" }, 403, request);
  }

  return session;
}

async function requireGamblingAdmin(request, env) {
  const session = await getSessionUser(request, env);

  if (!session) {
    return json({ success: false, error: "Not authenticated" }, 401, request);
  }

  if (!Boolean(session.gambling_admin) && !Boolean(session.is_admin)) {
    return json({ success: false, error: "Gambling admin access required" }, 403, request);
  }

  return session;
}

/* -------------------------------------------------------------------------- */
/*                                  SESSION                                   */
/* -------------------------------------------------------------------------- */

async function getSessionUser(request, env) {
  const cookies = parseCookies(request.headers.get("Cookie") || "");
  const sessionToken = cookies[SESSION_COOKIE_NAME];

  if (!sessionToken) {
    return null;
  }

  const row = await env.DB.prepare(`
    SELECT
      u.id,
      u.username,
      u.approved,
      u.is_admin,
      u.group_name,
      u.gambling_admin,
      u.last_seen_at,
      p.bio,
      p.avatar_url,
      s.session_token,
      s.expires_at
    FROM sessions s
    INNER JOIN users u ON u.id = s.user_id
    LEFT JOIN user_profiles p ON p.user_id = u.id
    WHERE s.session_token = ?
    LIMIT 1
  `).bind(sessionToken).first();

  if (!row) {
    return null;
  }

  const expiresAt = Date.parse(row.expires_at);
  if (Number.isNaN(expiresAt) || expiresAt < Date.now()) {
    await env.DB.prepare(`DELETE FROM sessions WHERE session_token = ?`)
      .bind(sessionToken)
      .run();
    return null;
  }

  return row;
}

async function getApprovedUser(request, env) {
  const session = await getSessionUser(request, env);

  if (!session) {
    return json({ success: false, error: "Not authenticated" }, 401, request);
  }

  if (!Boolean(session.approved)) {
    return json({ success: false, error: "Account is not approved" }, 403, request);
  }

  return session;
}

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

function json(data, status = 200, request = null) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(request)
    }
  });
}

function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(request),
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

function corsHeaders(request) {
  const origin = request?.headers?.get("Origin");
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Credentials": "true"
  };
}

async function safeJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader) {
  const out = {};
  const parts = cookieHeader.split(";");

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    out[key] = decodeURIComponent(value);
  }

  return out;
}

async function handleHltvOverview(request, env) {
  const startedAt = Date.now();
  await ensureCoreTables(env);

  const [newsRes, matchesRes, resultsRes, eventsRes, ukicMatchesRes, egwTeamsRes, liquipediaTeamsRes] = await Promise.allSettled([
    fetchTextPage("https://www.hltv.org/news"),
    fetchTextPage("https://www.hltv.org/matches"),
    fetchTextPage("https://www.hltv.org/results"),
    fetchTextPage("https://www.hltv.org/events"),
    fetchTextPage("https://ukicircuit.com/leagues/"),
    fetchTextPage("https://egamersworld.com/counterstrike/teams"),
    fetchTextPage("https://liquipedia.net/counterstrike/Portal:Teams")
  ]);

  const news = newsRes.status === "fulfilled" ? extractHltvLinks(newsRes.value, /^\/news\/\d+\//, 8) : [];
  const upcomingMatches = matchesRes.status === "fulfilled" ? extractUpcomingMatches(matchesRes.value, 8) : [];
  const latestResults = resultsRes.status === "fulfilled" ? extractHltvLinks(resultsRes.value, /^\/matches\/\d+\//, 8) : [];
  const bigEvents = eventsRes.status === "fulfilled"
    ? extractBigEvents(eventsRes.value, 8)
    : [];
  const featuredUkicLeagues = getFeaturedUkicLeagues();
  const ukicScrapedItems = ukicMatchesRes.status === "fulfilled"
    ? extractSourcedLinks(
      ukicMatchesRes.value,
      /\/(leagues|matches|events)\//,
      "https://ukicircuit.com",
      8,
      title => !/login|sign up|register|about|contact|cookie|privacy/i.test(title)
    )
    : [];
  const ukCsMainGames = await enrichUkicLeagueItems(
    mergeUniqueLinks(featuredUkicLeagues, ukicScrapedItems, 8)
  );
  const egamersworldTeams = egwTeamsRes.status === "fulfilled"
    ? extractEgwTeamLinks(egwTeamsRes.value, 12)
    : [];
  const liquipediaTeams = liquipediaTeamsRes.status === "fulfilled"
    ? extractLiquipediaTeams(liquipediaTeamsRes.value, 12)
    : [];
  const communityRankings = await buildCommunityProfileRankings(env, 20);
  const tier2Matches = filterTierTwoMatches(upcomingMatches, 8);

  const sourceStatus = {
    hltv: newsRes.status === "fulfilled" || matchesRes.status === "fulfilled" || resultsRes.status === "fulfilled" || eventsRes.status === "fulfilled",
    ukic: ukicMatchesRes.status === "fulfilled",
    egamersworld: egwTeamsRes.status === "fulfilled",
    liquipedia: liquipediaTeamsRes.status === "fulfilled"
  };

  const success = Object.values(sourceStatus).some(Boolean);
  return json(
    {
      success,
      source: "HLTV + UKIC + EGamersWorld + Liquipedia",
      source_status: sourceStatus,
      fetched_at: new Date().toISOString(),
      elapsed_ms: Date.now() - startedAt,
      sections: {
        community_rankings: communityRankings,
        news,
        big_events: bigEvents,
        uk_cs_main_games: ukCsMainGames,
        upcoming_matches: upcomingMatches,
        tier2_matches: tier2Matches,
        latest_results: latestResults,
        egamersworld_teams: egamersworldTeams.slice(0, 8),
        liquipedia_teams: liquipediaTeams.slice(0, 8)
      }
    },
    success ? 200 : 502,
    request
  );
}

async function fetchTextPage(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; grev-dad-site/1.0; +https://grev.dad)",
      accept: "text/html,application/xhtml+xml"
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  return await response.text();
}

function extractHltvLinks(html, hrefPattern, limit = 8) {
  return extractSourcedLinks(html, hrefPattern, "https://www.hltv.org", limit);
}

function extractUpcomingMatches(html, limit = 8) {
  if (!html || typeof html !== "string") return [];

  const matches = extractSourcedLinks(
    html,
    /^\/matches\/\d+\//,
    "https://www.hltv.org",
    limit * 3,
    (title) => / vs /i.test(title)
  );

  return matches.slice(0, limit).map((item) => ({
    ...item,
    teams: parseMatchTeams(item.title),
    logos: {
      team1: `https://ui-avatars.com/api/?name=${encodeURIComponent(parseMatchTeams(item.title).team1 || "TBD")}&background=0f172a&color=ffffff&size=64`,
      team2: `https://ui-avatars.com/api/?name=${encodeURIComponent(parseMatchTeams(item.title).team2 || "TBD")}&background=1e293b&color=ffffff&size=64`
    }
  }));
}

function parseMatchTeams(title) {
  const cleanTitle = String(title || "").replace(/\s+/g, " ").trim();
  const parts = cleanTitle.split(/\s+vs\.?\s+/i).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { team1: parts[0], team2: parts[1] };
  }
  return { team1: cleanTitle || "Team 1", team2: "Team 2" };
}

function extractBigEvents(html, limit = 8) {
  if (!html || typeof html !== "string") return [];
  const links = extractSourcedLinks(
    html,
    /^\/events\/\d+\//,
    "https://www.hltv.org",
    limit * 2,
    title => /major|iem|katowice|cologne|blast|pro league|pgl|championship|masters|global finals|world/i.test(title)
  );

  const unixDates = [...html.matchAll(/data-unix="(\d{10,13})"/g)].map((m) => Number(m[1]));

  return links.slice(0, limit).map((event, index) => ({
    ...event,
    start_date: toIsoFromUnix(unixDates[index * 2]),
    end_date: toIsoFromUnix(unixDates[(index * 2) + 1])
  }));
}

function toIsoFromUnix(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const ms = number > 1e12 ? number : number * 1000;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function extractEgwTeamLinks(html, limit = 12) {
  return extractSourcedLinks(
    html,
    /\/counterstrike\/team\/[^"?#]+/i,
    "https://egamersworld.com",
    limit,
    title => /^[a-z0-9 ._'&+-]{2,30}$/i.test(title) && !/counter[-\s]?strike|team ranking|matches|bet|news/i.test(title)
  );
}

function extractLiquipediaTeams(html, limit = 12) {
  return extractSourcedLinks(
    html,
    /\/counterstrike\/[^"?#]+/i,
    "https://liquipedia.net",
    limit,
    title => /^[a-z0-9 ._'&+-]{2,30}$/i.test(title) && !/counter[-\s]?strike|portal|results|tournaments|liquipedia/i.test(title)
  );
}

function extractSourcedLinks(html, hrefPattern, baseUrl, limit = 8, titleFilter = null) {
  if (!html || typeof html !== "string") return [];

  const linkRegex = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set();
  const items = [];
  let match;

  while ((match = linkRegex.exec(html)) && items.length < limit) {
    const rawHref = match[1] || "";
    if (!hrefPattern.test(rawHref)) continue;

    const href = rawHref.startsWith("http") ? rawHref : `${baseUrl}${rawHref}`;
    if (seen.has(href)) continue;

    const title = decodeHtmlEntities(stripHtml(match[2] || "")).replace(/\s+/g, " ").trim();
    if (!title || title.length < 5) continue;
    if (typeof titleFilter === "function" && !titleFilter(title)) continue;

    seen.add(href);
    items.push({ title, href });
  }

  return items;
}


function filterTierTwoMatches(matches, limit = 8) {
  if (!Array.isArray(matches)) return [];

  const tierOneKeywords = [
    "major",
    "iem",
    "katowice",
    "cologne",
    "blast",
    "pro league",
    "pgl",
    "world finals",
    "masters"
  ];

  const filtered = matches.filter(item => {
    const title = String(item?.title || "").toLowerCase();
    if (!title) return false;
    return !tierOneKeywords.some(keyword => title.includes(keyword));
  });

  return filtered.slice(0, limit);
}

function normaliseTeamName(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/&amp;/gi, "&")
    .replace(/[^a-z0-9&+\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function buildCommunityProfileRankings(env, limit = 20) {
  const rows = await env.DB.prepare(`
    SELECT
      u.id,
      u.username,
      p.steam_url,
      p.leetify_url,
      p.refrag_url,
      p.avatar_url,
      u.last_seen_at
    FROM users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
    WHERE u.approved = 1
  `).all();

  const linkedRows = (rows.results || []).filter((row) => hasAnyCounterStrikeProfile(row));
  const rankings = await Promise.all(linkedRows.map(async (row) => {
    const linkedAccounts = [
      row.steam_url,
      row.leetify_url,
      row.refrag_url
    ].filter(Boolean);

    const profileInsights = await collectProfileInsights({
      steamUrl: row.steam_url,
      leetifyUrl: row.leetify_url,
      refragUrl: row.refrag_url
    });

    const insightScore = profileInsights.reduce((total, item) => total + Number(item.score || 0), 0);
    const score = (linkedAccounts.length * 100)
      + (row.last_seen_at ? 15 : 0)
      + (row.steam_url ? 25 : 0)
      + insightScore;

    return {
      title: row.username,
      href: `/profile.html?id=${encodeURIComponent(row.id)}`,
      avatar_url: row.avatar_url || "",
      score,
      linked_accounts: linkedAccounts.length,
      source_count: linkedAccounts.length,
      profile_insights: profileInsights,
      summary: profileInsights.map((item) => item.headline).filter(Boolean).slice(0, 2).join(" · ")
    };
  }));

  return rankings
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit)
    .map((item, index) => ({
      ...item,
      rank: index + 1
    }));
}

function hasAnyCounterStrikeProfile(row) {
  return Boolean(row?.steam_url || row?.leetify_url || row?.refrag_url);
}

async function collectProfileInsights({ steamUrl, leetifyUrl, refragUrl }) {
  const checks = [
    buildProfileCheck("Steam", steamUrl, /(steamcommunity\.com|store\.steampowered\.com)/i),
    buildProfileCheck("Leetify", leetifyUrl, /leetify\.com/i),
    buildProfileCheck("Refrag", refragUrl, /refrag\.gg/i)
  ].filter(Boolean);

  const results = await Promise.allSettled(checks.map(async (check) => {
    const html = await fetchTextPage(check.url);
    return parseProfileInsight(check.label, check.url, html);
  }));

  return results
    .filter((result) => result.status === "fulfilled" && result.value)
    .map((result) => result.value);
}

function buildProfileCheck(label, rawUrl, allowedDomainPattern) {
  const url = cleanUrl(rawUrl, 1200);
  if (!url || !allowedDomainPattern.test(url)) return null;
  return { label, url };
}

function parseProfileInsight(provider, href, html) {
  const title = decodeHtmlEntities(extractTitleFromHtml(html));
  const description = decodeHtmlEntities(extractMetaDescription(html));
  const rankHints = extractRankHints(`${title} ${description}`);
  const statsHints = extractStatHints(`${title} ${description}`);
  const headlineParts = [];
  if (rankHints.length) headlineParts.push(`Rank: ${rankHints.slice(0, 2).join(", ")}`);
  if (statsHints.length) headlineParts.push(statsHints[0]);
  if (!headlineParts.length && description) headlineParts.push(description.slice(0, 120));
  if (!headlineParts.length && title) headlineParts.push(title);

  const score = (rankHints.length * 18) + (statsHints.length * 10) + (title ? 6 : 0) + (description ? 4 : 0);
  return {
    provider,
    href,
    headline: `${provider}: ${headlineParts.join(" · ")}`.trim(),
    score
  };
}

function extractTitleFromHtml(html) {
  if (!html || typeof html !== "string") return "";
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripHtml(match[1]).replace(/\s+/g, " ").trim() : "";
}

function extractMetaDescription(html) {
  if (!html || typeof html !== "string") return "";
  const match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i);
  return match ? stripHtml(match[1]).replace(/\s+/g, " ").trim() : "";
}

function extractRankHints(text) {
  const source = String(text || "");
  const rankMatches = source.match(/(?:rank|rating|elo|faceit|premier|level)\s*[:#]?\s*([a-z0-9.+\- ]{1,24})/gi) || [];
  const cleaned = rankMatches
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return [...new Set(cleaned)].slice(0, 3);
}

function extractStatHints(text) {
  const source = String(text || "");
  const statMatches = source.match(/(?:win\s*rate|headshot|hs%|kd|k\/d|adr|clutch|entry|matches|rounds|rating)\s*[:#]?\s*[0-9]+(?:\.[0-9]+)?%?/gi) || [];
  const cleaned = statMatches
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return [...new Set(cleaned)].slice(0, 3);
}

async function enrichUkicLeagueItems(items) {
  const seeded = Array.isArray(items) ? items.slice(0, 8) : [];
  const results = await Promise.allSettled(seeded.map(async (item) => {
    const html = await fetchTextPage(item.href);
    const details = extractUkicCompetitionDetails(html);
    return {
      ...item,
      summary: details.summary,
      meta_lines: details.lines
    };
  }));

  return seeded.map((item, index) => (
    results[index]?.status === "fulfilled"
      ? results[index].value
      : item
  ));
}

function extractUkicCompetitionDetails(html) {
  const title = extractTitleFromHtml(html);
  const description = extractMetaDescription(html);
  const groupMentions = (html.match(/group\s+[a-z0-9]+/gi) || []).slice(0, 3);
  const standings = (html.match(/(?:#?\d+\s*[-–]\s*[a-z0-9 ._'&+-]{2,30}\s*[-–]\s*\d+\s*(?:pts|points))/gi) || []).slice(0, 3);
  const positionLines = standings.length
    ? standings.map((line) => line.replace(/\s+/g, " ").trim())
    : groupMentions.map((line) => line.replace(/\s+/g, " ").trim());

  const summary = description || title || "UKIC competition details";
  return {
    summary: summary.slice(0, 180),
    lines: positionLines
  };
}

function stripHtml(input) {
  return String(input || "").replace(/<[^>]*>/g, " ");
}

function decodeHtmlEntities(input) {
  return String(input || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function getFeaturedUkicLeagues() {
  return [
    {
      title: "UKIC Challengers Season 9 — Group Stage",
      href: "https://ukicircuit.com/leagues/38efbc98-ec65-46a7-af50-fabe2a0b149e"
    },
    {
      title: "UKIC Contenders Season 9 — Group Stage",
      href: "https://ukicircuit.com/leagues/39eb286a-10f2-40a9-ae1e-6cd1c03e551c"
    },
    {
      title: "UKIC Rising Season 9 — Group Stage",
      href: "https://ukicircuit.com/leagues/cea75113-fd46-4c49-8f66-df9add564f1b"
    }
  ];
}

function mergeUniqueLinks(primaryItems, secondaryItems, limit = 8) {
  const merged = [];
  const seen = new Set();

  for (const item of [...(primaryItems || []), ...(secondaryItems || [])]) {
    const href = String(item?.href || "").trim();
    if (!href || seen.has(href)) continue;
    seen.add(href);
    merged.push(item);
    if (merged.length >= limit) break;
  }

  return merged;
}

function buildSessionCookie(sessionToken, expires) {
  return [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Expires=${expires.toUTCString()}`
  ].join("; ");
}

function clearSessionCookie() {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT"
  ].join("; ");
}

function cleanUsername(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, 30);
}

function cleanMessage(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").trim().slice(0, 1000);
}

function cleanForumTitle(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, 140);
}

function cleanForumBody(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").trim().slice(0, 12000);
}

function cleanForumComment(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").trim().slice(0, 3000);
}

function cleanShortText(value, maxLen = 255) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}

function cleanLongText(value, maxLen = 3000) {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").trim().slice(0, maxLen);
}

function cleanUrl(value, maxLen = 1200) {
  if (typeof value !== "string") return "";
  const cleaned = value.trim().slice(0, maxLen);
  if (!cleaned) return "";
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  return "";
}

function cleanAvatarUrl(value) {
  return cleanUrl(value, 1200);
}

function normaliseReactionType(value) {
  if (typeof value !== "string") return "";
  const cleaned = value.trim().toLowerCase();
  return cleaned === "like" || cleaned === "dislike" ? cleaned : "";
}

function sanitiseGroupName(value) {
  if (typeof value !== "string") return "";
  const cleaned = value.trim().toLowerCase();
  return ALLOWED_GROUPS.includes(cleaned) ? cleaned : "";
}

function normaliseGroupName(groupName, isAdmin = false) {
  if (isAdmin) return "admin";
  const cleaned = sanitiseGroupName(groupName);
  return cleaned || DEFAULT_USER_GROUP;
}

function buildUserGroups(groupName, isAdmin = false) {
  const groups = new Set();
  if (groupName) groups.add(groupName);
  if (isAdmin) groups.add("admin");
  return [...groups];
}

async function handleAdminDeleteUser(request, env) {
  await ensureCoreTables(env);

  const adminUser = await requireAdmin(request, env);
  if (adminUser instanceof Response) return adminUser;

  const body = await safeJson(request);
  const userId = Number(body?.user_id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return json({ success: false, error: "A valid user id is required" }, 400, request);
  }

  if (userId === adminUser.id) {
    return json({ success: false, error: "You cannot delete your own account" }, 400, request);
  }

  const existingUser = await env.DB.prepare(`
    SELECT id, username
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(userId).first();

  if (!existingUser) {
    return json({ success: false, error: "User not found" }, 404, request);
  }

  await env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(userId).run();
  await env.DB.prepare(`DELETE FROM forum_reactions WHERE user_id = ?`).bind(userId).run();
  await env.DB.prepare(`DELETE FROM forum_comments WHERE author_user_id = ?`).bind(userId).run();
  await env.DB.prepare(`DELETE FROM forum_comments WHERE post_id IN (SELECT id FROM forum_posts WHERE author_user_id = ? )`).bind(userId).run();
  await env.DB.prepare(`DELETE FROM forum_reactions WHERE post_id IN (SELECT id FROM forum_posts WHERE author_user_id = ? )`).bind(userId).run();
  await env.DB.prepare(`DELETE FROM forum_posts WHERE author_user_id = ?`).bind(userId).run();
  await env.DB.prepare(`DELETE FROM global_chat_messages WHERE author_user_id = ?`).bind(userId).run();
  await env.DB.prepare(`DELETE FROM user_profiles WHERE user_id = ?`).bind(userId).run();
  await env.DB.prepare(`DELETE FROM users WHERE id = ?`).bind(userId).run();

  try {
    await env.DB.prepare(`DELETE FROM casino_profiles WHERE user_id = ?`).bind(userId).run();
  } catch (error) {
    console.error("Failed to fully clean casino data during account deletion:", error);
  }

  return json({
    success: true,
    message: `Deleted account ${existingUser.username}.`
  }, 200, request);
}

function resolveUserGroupName(groupName, approved = false, isAdmin = false) {
  if (isAdmin) return "admin";
  if (approved && sanitiseGroupName(groupName) === "standard") return "member";
  return normaliseGroupName(groupName, isAdmin);
}

function displayGroupName(groupName, isAdmin = false, approved = false) {
  const finalGroup = resolveUserGroupName(groupName, approved, isAdmin);
  if (finalGroup === "admin") return "Admin";
  if (finalGroup === "dev") return "Dev";
  if (finalGroup === "staff") return "Staff";
  if (finalGroup === "mod") return "Mod";
  if (finalGroup === "higher") return "Higher";
  if (finalGroup === "member") return "Member";
  return "Standard";
}

function canModerateForum(groupName, isAdmin = false) {
  if (isAdmin) return true;
  return MODERATION_GROUPS.has(normaliseGroupName(groupName, isAdmin));
}

function formatAdminUserRow(row) {
  const group = resolveUserGroupName(row.group_name, Boolean(row.approved), Boolean(row.is_admin));
  return {
    id: row.id,
    username: row.username,
    approved: Boolean(row.approved),
    is_admin: Boolean(row.is_admin),
    gambling_admin: Boolean(row.gambling_admin),
    can_manage_gambling: Boolean(row.gambling_admin),
    group,
    groups: buildUserGroups(group, Boolean(row.is_admin)),
    created_at: row.created_at || null,
    last_seen_at: row.last_seen_at || null,
    bio: row.bio || "",
    avatar_url: row.avatar_url || "",
    real_name: row.real_name || "",
    motto: row.motto || "",
    media_1_url: row.media_1_url || "",
    media_2_url: row.media_2_url || "",
    media_3_url: row.media_3_url || "",
    music_url: row.music_url || "",
    steam_url: row.steam_url || "",
    leetify_url: row.leetify_url || "",
    refrag_url: row.refrag_url || "",
    profile_accent_color: row.profile_accent_color || "#1f2937"
  };
}

function isoNow() {
  return new Date().toISOString();
}

async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bufferToHex(digest);
}

async function verifyPassword(password, storedHash) {
  const calculated = await hashPassword(password);
  return calculated === storedHash;
}

function bufferToHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
