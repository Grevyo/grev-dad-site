// src/index.js

import { STARTING_BALANCE_PENCE } from "./cs2/constants.js";
import { getQuickSellFeePercent } from "./cs2/quick-sell.js";
import { handleCs2Request } from "./cs2/handlers.js";
import { seedCs2CatalogIfEmpty } from "./cs2/seed.js";
import { ensureCs2Extensions } from "./cs2/schema.js";

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
const FORUM_POST_LIMIT = 100;
const ALLOWED_GROUPS = ["admin", "dev", "staff", "mod", "higher", "member", "standard"];
const MODERATION_GROUPS = new Set(["admin", "dev", "staff"]);
let coreTablesReadyPromise = null;

async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const { pathname } = url;

  if (request.method === "OPTIONS") {
    return handleOptions(request);
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

  // Global chat
  if (pathname === "/api/chat/global" && request.method === "GET") {
    return await handleGetGlobalChat(request, env);
  }

  if (pathname === "/api/chat/global" && request.method === "POST") {
    return await handlePostGlobalChat(request, env);
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

  // Gambling / Cases
  if (pathname === "/api/gambling/profile" && request.method === "GET") {
    return await handleGamblingProfile(request, env);
  }

  let cs2Request = request;
  if (pathname === "/api/cases" && request.method === "GET") {
    const aliasUrl = new URL(request.url);
    aliasUrl.pathname = "/api/cs2/cases";
    cs2Request = new Request(aliasUrl.toString(), request);
  } else if (pathname === "/api/cases/catalog" && request.method === "GET") {
    const aliasUrl = new URL(request.url);
    aliasUrl.pathname = "/api/cs2/catalog";
    cs2Request = new Request(aliasUrl.toString(), request);
  } else if (pathname === "/api/admin/cases" && request.method === "GET") {
    const aliasUrl = new URL(request.url);
    aliasUrl.pathname = "/api/cs2/admin/cases";
    cs2Request = new Request(aliasUrl.toString(), request);
  } else if (pathname === "/api/admin/cases/create" && request.method === "POST") {
    const aliasUrl = new URL(request.url);
    aliasUrl.pathname = "/api/cs2/admin/cases/create";
    cs2Request = new Request(aliasUrl.toString(), request);
  }

  if (pathname.startsWith("/api/cs2") || cs2Request !== request) {
    const cs2Response = await handleCs2Request(cs2Request, env, {
      json,
      getApprovedUser,
      requireAdmin,
      requireGamblingAdmin,
      isoNow,
      safeJson
    });
    if (cs2Response) return cs2Response;
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

  if (pathname === "/api/admin/pending-users" && request.method === "GET") {
    return await handleAdminPendingUsers(request, env);
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
  await ensureCasesTables(env);
  const cs2Seed = await seedCs2CatalogIfEmpty(env);

  return json(
    {
      success: true,
      message: "Core database tables and gambling tables applied",
      cs2_seed: cs2Seed
    },
    200,
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

  await ensureColumn(env.DB, "global_chat_messages", "author_user_id", "INTEGER");
  await ensureColumn(env.DB, "global_chat_messages", "author_username", "TEXT");
  await ensureColumn(env.DB, "global_chat_messages", "author_group", "TEXT");
  await ensureColumn(env.DB, "global_chat_messages", "message", "TEXT");
  await ensureColumn(env.DB, "global_chat_messages", "created_at", "TEXT");

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
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_forum_posts_created_at ON forum_posts (created_at)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_forum_comments_post_id ON forum_comments (post_id)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_forum_reactions_post_id ON forum_reactions (post_id)`).run();
  await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_forum_reactions_post_user ON forum_reactions (post_id, user_id)`).run();
}

async function ensureCasesTables(env) {
  if (!env.CASES_DB) {
    return;
  }

  await env.CASES_DB.prepare(`
    CREATE TABLE IF NOT EXISTS case_profiles (
      user_id INTEGER PRIMARY KEY,
      display_name TEXT,
      balance INTEGER NOT NULL DEFAULT 1000,
      total_cases_opened INTEGER NOT NULL DEFAULT 0,
      total_spent INTEGER NOT NULL DEFAULT 0,
      total_inventory_value INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();

  await ensureColumn(env.CASES_DB, "case_profiles", "display_name", "TEXT");
  await ensureColumn(env.CASES_DB, "case_profiles", "balance", "INTEGER NOT NULL DEFAULT 1000");
  await ensureColumn(env.CASES_DB, "case_profiles", "total_cases_opened", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(env.CASES_DB, "case_profiles", "total_spent", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(env.CASES_DB, "case_profiles", "total_inventory_value", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(env.CASES_DB, "case_profiles", "created_at", "TEXT");
  await ensureColumn(env.CASES_DB, "case_profiles", "updated_at", "TEXT");

  await env.CASES_DB.prepare(`
    CREATE TABLE IF NOT EXISTS case_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name TEXT NOT NULL,
      weapon_name TEXT,
      skin_name TEXT,
      rarity TEXT NOT NULL,
      wear TEXT,
      image_url TEXT,
      market_value INTEGER NOT NULL DEFAULT 0,
      color_hex TEXT,
      created_at TEXT NOT NULL
    )
  `).run();

  await env.CASES_DB.prepare(`
    CREATE TABLE IF NOT EXISTS case_definitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      image_url TEXT,
      price INTEGER NOT NULL DEFAULT 100,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )
  `).run();

  await env.CASES_DB.prepare(`
    CREATE TABLE IF NOT EXISTS case_drops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      drop_weight INTEGER NOT NULL DEFAULT 1
    )
  `).run();

  await env.CASES_DB.prepare(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      source_case_id INTEGER,
      acquired_at TEXT NOT NULL,
      locked INTEGER NOT NULL DEFAULT 0
    )
  `).run();

  await env.CASES_DB.prepare(`
    CREATE TABLE IF NOT EXISTS case_open_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      case_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      price_paid INTEGER NOT NULL,
      opened_at TEXT NOT NULL
    )
  `).run();

  await env.CASES_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_case_profiles_user_id ON case_profiles (user_id)`).run();
  await env.CASES_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_inventory_user_id ON inventory (user_id)`).run();
  await env.CASES_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_inventory_item_id ON inventory (item_id)`).run();
  await env.CASES_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_case_open_history_user_id ON case_open_history (user_id)`).run();
  await env.CASES_DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_case_definitions_slug ON case_definitions (slug)`).run();

  await ensureCs2Extensions(env.CASES_DB);
}

async function ensureColumn(db, tableName, columnName, columnDefinition) {
  const result = await db.prepare(`PRAGMA table_info(${tableName})`).all();
  const cols = result.results || [];
  const exists = cols.some((col) => String(col.name).toLowerCase() === String(columnName).toLowerCase());

  if (!exists) {
    await db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`).run();
  }
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
    message: "Registration submitted. Your account is awaiting approval."
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

  if (!Number(user.approved)) {
    return json({ success: false, error: "Your account is still awaiting approval" }, 403, request);
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

  const group = normaliseGroupName(user.group_name, Boolean(user.is_admin));

  const response = json({
    success: true,
    message: "Login successful",
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

  const group = normaliseGroupName(session.group_name, Boolean(session.is_admin));

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
      p.music_url
    FROM users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
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
      p.music_url
    FROM users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
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
  const avatarUrl = cleanUrl(body?.avatar_url, 1200);
  const media1 = cleanUrl(body?.media_1_url, 1200);
  const media2 = cleanUrl(body?.media_2_url, 1200);
  const media3 = cleanUrl(body?.media_3_url, 1200);
  const musicUrl = cleanUrl(body?.music_url, 1200);

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
      music_url = ?
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
      p.music_url
    FROM users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
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
  const group = normaliseGroupName(row.group_name, Boolean(row.is_admin));

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
    media
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
      p.motto
    FROM users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
    WHERE u.approved = 1
    ORDER BY LOWER(u.username) ASC
  `).all();

  const members = [];

  for (const row of rows.results || []) {
    const group = normaliseGroupName(row.group_name, Boolean(row.is_admin));

    let caseSummary = {
      case_money: 0,
      case_rarest_item_name: "",
      case_rarest_score: 0,
      case_most_expensive_item_name: "",
      case_inventory_value: 0
    };

    if (env.CASES_DB) {
      const profile = await env.CASES_DB.prepare(`
        SELECT balance, total_inventory_value
        FROM case_profiles
        WHERE user_id = ?
        LIMIT 1
      `).bind(row.id).first();

      caseSummary.case_money = Number(profile?.balance || 0);
      caseSummary.case_inventory_value = Number(profile?.total_inventory_value || 0);
    }

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
      ...caseSummary
    });
  }

  return json({ success: true, members }, 200, request);
}

/* -------------------------------------------------------------------------- */
/*                                GLOBAL CHAT                                 */
/* -------------------------------------------------------------------------- */

async function handleGetGlobalChat(request, env) {
  await ensureCoreTables(env);

  const rows = await env.DB.prepare(`
    SELECT id, author_user_id, author_username, author_group, message, created_at
    FROM global_chat_messages
    ORDER BY id DESC
    LIMIT ?
  `).bind(GLOBAL_CHAT_MESSAGE_LIMIT).all();

  return json({
    success: true,
    messages: (rows.results || []).reverse()
  }, 200, request);
}

async function handlePostGlobalChat(request, env) {
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

  const result = await env.DB.prepare(`
    INSERT INTO global_chat_messages (
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

  return json({
    success: true,
    message: "Message sent",
    chat_message: {
      id: result.meta?.last_row_id ?? null,
      author_user_id: session.id,
      author_username: session.username,
      author_group: authorGroup,
      message,
      created_at: now
    }
  }, 200, request);
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

  const group = normaliseGroupName(session.group_name, Boolean(session.is_admin));
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
/*                              GAMBLING / CASES                              */
/* -------------------------------------------------------------------------- */

async function handleGamblingProfile(request, env) {
  await ensureCoreTables(env);
  await ensureCasesTables(env);

  if (!env.CASES_DB) {
    return json({ success: false, error: "CASES_DB is not configured" }, 500, request);
  }

  const session = await getSessionUser(request, env);
  if (!session) {
    return json({ success: false, error: "Not authenticated" }, 401, request);
  }

  const now = isoNow();

  await env.CASES_DB.prepare(`
    INSERT OR IGNORE INTO case_profiles (
      user_id,
      display_name,
      balance,
      total_cases_opened,
      total_spent,
      total_inventory_value,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, 0, 0, 0, ?, ?)
  `).bind(session.id, session.username, STARTING_BALANCE_PENCE, now, now).run();

  const row = await env.CASES_DB.prepare(`
    SELECT
      user_id,
      display_name,
      balance,
      key_balance,
      total_cases_opened,
      total_spent,
      total_inventory_value,
      created_at,
      updated_at
    FROM case_profiles
    WHERE user_id = ?
    LIMIT 1
  `).bind(session.id).first();

  const quickSellFee = await getQuickSellFeePercent(env);

  return json({
    success: true,
    profile: {
      user_id: row.user_id,
      username: session.username,
      display_name: row.display_name || session.username,
      balance: Number(row.balance || 0),
      key_balance: Number(row.key_balance ?? 0),
      total_cases_opened: Number(row.total_cases_opened || 0),
      total_spent: Number(row.total_spent || 0),
      total_inventory_value: Number(row.total_inventory_value || 0),
      quick_sell_fee_percent: quickSellFee,
      created_at: row.created_at || now,
      updated_at: row.updated_at || now
    }
  }, 200, request);
}


async function attachCaseAdminStats(env, users) {
  const list = Array.isArray(users) ? users : [];
  if (!env.CASES_DB || !list.length) return list;

  const ids = [...new Set(list.map((user) => Number(user.id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length) return list;

  const placeholders = ids.map(() => "?").join(",");
  const rows = await env.CASES_DB.prepare(`
    SELECT user_id, balance, key_balance, total_cases_opened, total_inventory_value
    FROM case_profiles
    WHERE user_id IN (${placeholders})
  `).bind(...ids).all();

  const statsByUserId = new Map();
  for (const row of rows.results || []) {
    statsByUserId.set(Number(row.user_id), {
      case_balance: Number(row.balance || 0),
      key_balance: Number(row.key_balance || 0),
      total_cases_opened: Number(row.total_cases_opened || 0),
      case_inventory_value: Number(row.total_inventory_value || 0)
    });
  }

  return list.map((user) => ({
    ...user,
    case_balance: statsByUserId.get(Number(user.id))?.case_balance ?? 0,
    key_balance: statsByUserId.get(Number(user.id))?.key_balance ?? 0,
    total_cases_opened: statsByUserId.get(Number(user.id))?.total_cases_opened ?? 0,
    case_inventory_value: statsByUserId.get(Number(user.id))?.case_inventory_value ?? 0
  }));
}

async function ensureAdminCaseProfile(env, userId, username) {
  if (!env.CASES_DB) return null;
  const now = isoNow();
  await env.CASES_DB.prepare(`
    INSERT OR IGNORE INTO case_profiles (
      user_id,
      display_name,
      balance,
      total_cases_opened,
      total_spent,
      total_inventory_value,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, 0, 0, 0, ?, ?)
  `).bind(userId, username, STARTING_BALANCE_PENCE, now, now).run();

  return env.CASES_DB.prepare(`
    SELECT user_id, balance, key_balance, total_cases_opened, total_inventory_value
    FROM case_profiles
    WHERE user_id = ?
    LIMIT 1
  `).bind(userId).first();
}

/* -------------------------------------------------------------------------- */
/*                                   ADMIN                                    */
/* -------------------------------------------------------------------------- */

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
      p.avatar_url
    FROM users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
    ORDER BY LOWER(u.username) ASC
  `).all();

  let users = (rows.results || []).map(formatAdminUserRow);
  users = await attachCaseAdminStats(env, users);

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
      p.avatar_url
    FROM users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
    WHERE u.id = ?
    LIMIT 1
  `).bind(userId).first();

  if (!row) {
    return json({ success: false, error: "User not found" }, 404, request);
  }

  const [userWithStats] = await attachCaseAdminStats(env, [formatAdminUserRow(row)]);

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
    users: await attachCaseAdminStats(env, (rows.results || []).map(formatAdminUserRow))
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
  const gamblingBalanceDelta = Number(body?.gambling_balance_delta ?? body?.case_balance_delta ?? 0);

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
  const nextGroup = requestedGroup === "admin" ? "admin" : requestedGroup;

  let nextBalance = null;
  if (gamblingBalanceDelta !== 0) {
    if (!env.CASES_DB) {
      return json({ success: false, error: "CASES_DB is not configured" }, 500, request);
    }

    const profile = await ensureAdminCaseProfile(env, userId, existingUser.username);
    const currentBalance = Number(profile?.balance || 0);
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

  let updatedBalance = null;
  if (nextBalance != null) {
    await env.CASES_DB.prepare(`
      UPDATE case_profiles
      SET balance = ?, updated_at = ?
      WHERE user_id = ?
    `).bind(nextBalance, isoNow(), userId).run();

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
      p.avatar_url
    FROM users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
    WHERE u.id = ?
    LIMIT 1
  `).bind(userId).first();

  const [userWithStats] = await attachCaseAdminStats(env, [formatAdminUserRow(updatedRow)]);

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

  if (!Boolean(session.gambling_admin)) {
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
  return value.trim().replace(/\s+/g, " ").slice(0, 32);
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

function displayGroupName(groupName, isAdmin = false) {
  const finalGroup = normaliseGroupName(groupName, isAdmin);
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
  const group = normaliseGroupName(row.group_name, Boolean(row.is_admin));
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
    avatar_url: row.avatar_url || ""
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
