import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE = "grevdad_session";
const SESSION_TTL_DAYS = 30;
const STARTING_BALANCE_CENTS = 10000;
const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/;

export default {
  async fetch(request, env) {
    try {
      await ensureSchema(env);
      return await routeRequest(request, env);
    } catch (error) {
      console.error("Unhandled error", error);
      return json({ ok: false, error: "Internal server error" }, 500);
    }
  }
};

async function routeRequest(request, env) {
  const url = new URL(request.url);
  const { pathname } = url;

  if (pathname === "/api/auth/register" && request.method === "POST") return handleRegister(request, env);
  if (pathname === "/api/auth/login" && request.method === "POST") return handleLogin(request, env);
  if (pathname === "/api/auth/logout" && request.method === "POST") return handleLogout(request, env);
  if (pathname === "/api/auth/me" && request.method === "GET") return handleMe(request, env);

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

function normalizeUsername(raw) {
  return String(raw || "").trim().toLowerCase();
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

  const token = randomBytes(32).toString("hex");
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

async function handleSetupAdmin(request, env) {
  const body = await safeJson(request);
  if (!env.ADMIN_SETUP_SECRET) return json({ ok: false, error: "ADMIN_SETUP_SECRET is not configured" }, 500);
  if (String(body.secret || "") !== env.ADMIN_SETUP_SECRET) return json({ ok: false, error: "Invalid setup secret" }, 403);

  const existing = await env.DB.prepare("SELECT id FROM users WHERE is_admin = 1 OR role = 'admin' LIMIT 1").first();
  if (existing) return json({ ok: false, error: "An admin already exists; setup is disabled" }, 409);

  const username = normalizeUsername(body.username);
  if (!username) return json({ ok: false, error: "username is required" }, 400);

  const result = await env.DB.prepare("UPDATE users SET is_admin = 1, role = 'admin' WHERE username = ?")
    .bind(username).run();
  if (!result.meta?.changes) return json({ ok: false, error: "User not found" }, 404);

  return json({ ok: true, message: "Admin setup completed", target: username }, 200);
}

async function handleAdminUsers(request, env) {
  const user = await requireAdmin(request, env);
  if (!user) return json({ ok: false, error: "Admin access required" }, 403);

  const users = await env.DB.prepare(
    "SELECT id, username, role, is_admin, created_at FROM users ORDER BY id ASC"
  ).all();

  return json({ ok: true, currentUser: sanitizeUser(user), users: users.results || [] }, 200);
}

async function handleDeployStatus(request, env) { return json({ ok: false, error: "Disabled for plain auth foundation phase" }, 404); }
async function handleRedeploy(request, env) { return json({ ok: false, error: "Disabled for plain auth foundation phase" }, 404); }
async function handlePurgeCache(request, env) { return json({ ok: false, error: "Disabled for plain auth foundation phase" }, 404); }
async function handleRefreshLiveSite(request, env) { return json({ ok: false, error: "Disabled for plain auth foundation phase" }, 404); }

async function currentUser(request, env) {
  const token = getSessionToken(request);
  if (!token) return null;
  return env.DB.prepare(`SELECT u.id, u.username, u.role, u.is_admin, b.balance_cents FROM sessions s JOIN users u ON u.id = s.user_id LEFT JOIN balances b ON b.user_id=u.id WHERE s.token=? AND s.expires_at>? LIMIT 1`).bind(hashToken(token), new Date().toISOString()).first();
}
async function requireAdmin(request, env) { const u = await currentUser(request, env); return u && (Number(u.is_admin) === 1 || u.role === "admin") ? u : null; }

async function ensureSchema(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', is_admin INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)").run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT NOT NULL UNIQUE, user_id INTEGER NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)").run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS balances (user_id INTEGER PRIMARY KEY, balance_cents INTEGER NOT NULL DEFAULT 10000, updated_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)").run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, amount_cents INTEGER NOT NULL, reason TEXT NOT NULL DEFAULT 'init', created_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)").run();
  await env.DB.prepare("INSERT INTO balances (user_id,balance_cents) SELECT id, ? FROM users WHERE id NOT IN (SELECT user_id FROM balances)").bind(STARTING_BALANCE_CENTS).run();
}

function hashPassword(password) { const salt = randomBytes(16).toString("hex"); return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`; }
function verifyPassword(password, stored) { const [salt, hash] = String(stored).split(":"); if (!salt || !hash) return false; return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(scryptSync(password, salt, 64).toString("hex"), "hex")); }
function hashToken(token) { return createHash("sha256").update(token).digest("hex"); }
function getSessionToken(request) { const match = (request.headers.get("Cookie") || "").match(new RegExp(`${SESSION_COOKIE}=([^;]+)`)); return match ? decodeURIComponent(match[1]) : null; }
function createSessionCookie(token) { return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${SESSION_TTL_DAYS * 86400}; SameSite=Lax; Secure`; }
function clearSessionCookie() { return `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Secure`; }
function sanitizeUser(user) { return { id: user.id, username: user.username, role: user.role, isAdmin: Number(user.is_admin) === 1 }; }
async function safeJson(request) { try { return await request.json(); } catch { return {}; } }
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8" } }); }
