import { SESSION_TTL_DAYS, clearSessionCookie, createSessionCookie, getSessionToken } from "./lib/cookies.js";
import { createSessionToken, hashPassword, hashToken, normalizeUsername, sanitizeUser, verifyPassword } from "./lib/auth.js";
import { currentUser } from "./lib/sessions.js";
import { requireAdmin } from "./lib/guards.js";
import { json, safeJson } from "./lib/response.js";
import { dispatchCoreRoute } from "./routes/core.js";

const STARTING_BALANCE_CENTS = 10000;
const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/;

export default {
  async fetch(request, env, ctx) {
    try {
      await ensureSchema(env);
      return await routeRequest(request, env, ctx);
    } catch (error) {
      console.error("Unhandled error", error);
      return json({ ok: false, error: "Internal server error" }, 500);
    }
  }
};

async function routeRequest(request, env, ctx) {
  const coreRouteResponse = await dispatchCoreRoute(request, env, ctx, {
    handleRegister,
    handleLogin,
    handleLogout,
    handleMe
  });
  if (coreRouteResponse) return coreRouteResponse;

  const url = new URL(request.url);
  const { pathname } = url;

  if (pathname === "/api/setup/admin" && request.method === "POST") return handleSetupAdmin(request, env);
  if (pathname === "/api/admin/users" && request.method === "GET") return handleAdminUsers(request, env);
  if (pathname === "/api/admin/deploy/status" && request.method === "GET") return handleDeployStatus(request, env);
  if (pathname === "/api/admin/deploy/redeploy" && request.method === "POST") return handleRedeploy(request, env);
  if (pathname === "/api/admin/deploy/purge-cache" && request.method === "POST") return handlePurgeCache(request, env);
  if (pathname === "/api/admin/deploy/refresh-live-site" && request.method === "POST") return handleRefreshLiveSite(request, env);

  if (pathname === "/api/balance" && request.method === "GET") return handleBalance(request, env);

  if (env.ASSETS) return env.ASSETS.fetch(request);
  return json({ ok: false, error: "Not found" }, 404);
}

function validateUsername(username) {
  return USERNAME_PATTERN.test(username);
}

async function handleRegister(request, env) {
  const body = await safeJson(request);
  const username = normalizeUsername(body.username);
  const password = String(body.password || "");

  if (!validateUsername(username)) {
    return json({ ok: false, error: "Username must be 3-32 chars: lowercase letters, numbers, underscore" }, 400);
  }
  if (password.length < 8) {
    return json({ ok: false, error: "Password must be at least 8 characters" }, 400);
  }

  try {
    const userResult = await env.DB.prepare(
      `INSERT INTO users (username, password_hash, role, is_admin, created_at)
       VALUES (?, ?, 'user', 0, ?)`
    ).bind(username, hashPassword(password), new Date().toISOString()).run();

    const userId = userResult.meta?.last_row_id;
    if (userId) {
      await env.DB.prepare(
        "INSERT OR IGNORE INTO balances (user_id, balance_cents, updated_at) VALUES (?, ?, ?)"
      ).bind(userId, STARTING_BALANCE_CENTS, new Date().toISOString()).run();
    }
  } catch (error) {
    if (String(error.message || "").includes("UNIQUE")) {
      return json({ ok: false, error: "Username already exists" }, 409);
    }
    throw error;
  }

  return json({ ok: true, message: "Registered successfully" }, 201);
}

async function handleLogin(request, env) {
  const body = await safeJson(request);
  const username = normalizeUsername(body.username);
  const password = String(body.password || "");

  if (!username || !password) return json({ ok: false, error: "Missing credentials" }, 400);

  const user = await env.DB.prepare(
    `SELECT id, username, password_hash, role, is_admin FROM users WHERE username = ? LIMIT 1`
  ).bind(username).first();

  if (!user || !verifyPassword(password, user.password_hash)) {
    return json({ ok: false, error: "Invalid credentials" }, 401);
  }

  const token = createSessionToken();
  await env.DB.prepare("INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(hashToken(token), user.id, new Date(Date.now() + SESSION_TTL_DAYS * 86400000).toISOString(), new Date().toISOString()).run();

  const response = json({ ok: true, user: sanitizeUser(user) }, 200);
  response.headers.append("Set-Cookie", createSessionCookie(token));
  return response;
}

async function handleLogout(request, env) {
  const token = getSessionToken(request);
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(hashToken(token)).run();
  const response = json({ ok: true, message: "Logged out" }, 200);
  response.headers.append("Set-Cookie", clearSessionCookie());
  return response;
}

async function handleMe(request, env) {
  const user = await currentUser(request, env);
  return json({ ok: true, authenticated: Boolean(user), user: user ? sanitizeUser(user) : null }, 200);
}

async function handleBalance(request, env) {
  const user = await currentUser(request, env);
  if (!user) return json({ ok: false, error: "Unauthorized" }, 401);
  return json({ ok: true, balanceCents: Number(user.balance_cents || 0) }, 200);
}

async function handleSetupAdmin(request, env) { const body = await safeJson(request); if (!env.ADMIN_SETUP_SECRET) return json({ ok: false, error: "ADMIN_SETUP_SECRET is not configured" }, 500); if (String(body.secret || "") !== env.ADMIN_SETUP_SECRET) return json({ ok: false, error: "Invalid setup secret" }, 403); const existing = await env.DB.prepare("SELECT id FROM users WHERE is_admin = 1 OR role = 'admin' LIMIT 1").first(); if (existing) return json({ ok: false, error: "An admin already exists; setup is disabled" }, 409); const username = normalizeUsername(body.username); if (!username) return json({ ok: false, error: "username is required" }, 400); const result = await env.DB.prepare("UPDATE users SET is_admin = 1, role = 'admin' WHERE username = ?").bind(username).run(); if (!result.meta?.changes) return json({ ok: false, error: "User not found" }, 404); return json({ ok: true, message: "Admin setup completed", target: username }, 200); }
async function handleAdminUsers(request, env) { const user = await requireAdmin(request, env); if (!user) return json({ ok: false, error: "Admin access required" }, 403); const users = await env.DB.prepare("SELECT id, username, role, is_admin, created_at FROM users ORDER BY id ASC").all(); return json({ ok: true, currentUser: sanitizeUser(user), users: users.results || [] }, 200); }
async function handleDeployStatus(request, env) { return json({ ok: false, error: "Disabled for plain auth foundation phase" }, 404); }
async function handleRedeploy(request, env) { return json({ ok: false, error: "Disabled for plain auth foundation phase" }, 404); }
async function handlePurgeCache(request, env) { return json({ ok: false, error: "Disabled for plain auth foundation phase" }, 404); }
async function handleRefreshLiveSite(request, env) { return json({ ok: false, error: "Disabled for plain auth foundation phase" }, 404); }

async function ensureSchema(env) { await migrateLegacyUserSchema(env); await env.DB.prepare("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', is_admin INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)").run(); await env.DB.prepare("CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT NOT NULL UNIQUE, user_id INTEGER NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)").run(); await env.DB.prepare("CREATE TABLE IF NOT EXISTS balances (user_id INTEGER PRIMARY KEY, balance_cents INTEGER NOT NULL DEFAULT 10000, updated_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)").run(); await env.DB.prepare("CREATE TABLE IF NOT EXISTS ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, amount_cents INTEGER NOT NULL, reason TEXT NOT NULL DEFAULT 'init', created_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)").run(); await env.DB.prepare("INSERT INTO balances (user_id,balance_cents) SELECT id, ? FROM users WHERE id NOT IN (SELECT user_id FROM balances)").bind(STARTING_BALANCE_CENTS).run(); }
async function migrateLegacyUserSchema(env) { const usersTable = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users' LIMIT 1").first(); if (!usersTable) return; const tableInfo = await env.DB.prepare("PRAGMA table_info(users)").all(); const columns = tableInfo.results || []; const hasEmail = columns.some((col) => col.name === "email"); const hasUsername = columns.some((col) => col.name === "username"); const hasPasswordHash = columns.some((col) => col.name === "password_hash"); const emailColumn = columns.find((col) => col.name === "email"); const requiresMigration = !hasUsername || !hasPasswordHash || (hasEmail && Number(emailColumn.notnull) === 1); if (!requiresMigration) return; await env.DB.prepare("DROP TABLE IF EXISTS users_new").run(); await env.DB.prepare("CREATE TABLE users_new (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', is_admin INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now'))) ").run(); await env.DB.prepare(`INSERT INTO users_new (id, username, password_hash, role, is_admin, created_at) SELECT id, username, password_hash, COALESCE(role, 'user'), COALESCE(is_admin, 0), COALESCE(created_at, datetime('now')) FROM users WHERE username IS NOT NULL AND password_hash IS NOT NULL`).run(); await env.DB.prepare("DROP TABLE users").run(); await env.DB.prepare("ALTER TABLE users_new RENAME TO users").run(); }
