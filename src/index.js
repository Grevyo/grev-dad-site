import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE = "grevdad_session";
const SESSION_TTL_DAYS = 30;
const STARTING_BALANCE_CENTS = 10000;

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

async function handleRegister(request, env) {
  const body = await safeJson(request);
  const username = String(body.username || "").trim().toLowerCase();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!username || !email || password.length < 8) {
    return json({ ok: false, error: "username, email, and password (>=8 chars) are required" }, 400);
  }

  try {
    await env.DB.prepare(
      `INSERT INTO users (username, email, password_hash, role, is_admin, created_at)
       VALUES (?, ?, ?, 'user', 0, ?)`
    ).bind(username, email, hashPassword(password), new Date().toISOString()).run();
  } catch (error) {
    if (String(error.message).includes("UNIQUE")) {
      return json({ ok: false, error: "Username or email already exists" }, 409);
    }
    throw error;
  }

  return json({ ok: true, message: "Registered successfully", startingBalanceCents: STARTING_BALANCE_CENTS }, 201);
}

async function handleLogin(request, env) {
  const body = await safeJson(request);
  const identity = String(body.username || body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!identity || !password) return json({ ok: false, error: "Missing credentials" }, 400);

  const user = await env.DB.prepare(
    `SELECT id, username, email, password_hash, role, is_admin FROM users WHERE username = ? OR email = ? LIMIT 1`
  ).bind(identity, identity).first();

  if (!user || !verifyPassword(password, user.password_hash)) return json({ ok: false, error: "Invalid credentials" }, 401);

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

  const identity = String(body.username || body.email || "").trim().toLowerCase();
  if (!identity) return json({ ok: false, error: "username or email is required" }, 400);

  const result = await env.DB.prepare("UPDATE users SET is_admin = 1, role = 'admin' WHERE username = ? OR email = ?")
    .bind(identity, identity).run();
  if (!result.meta?.changes) return json({ ok: false, error: "User not found" }, 404);

  return json({ ok: true, message: "Admin setup completed", target: identity }, 200);
}

async function handleAdminUsers(request, env) {
  const user = await requireAdmin(request, env);
  if (!user) return json({ ok: false, error: "Admin access required" }, 403);

  const users = await env.DB.prepare(
    "SELECT id, username, email, role, is_admin, balance_cents, created_at FROM users ORDER BY id ASC"
  ).all();

  return json({ ok: true, currentUser: sanitizeUser(user), users: users.results || [] }, 200);
}

async function handleDeployStatus(request, env) {
  const actor = await requireAdmin(request, env);
  if (!actor) return json({ ok: false, error: "Admin access required" }, 403);

  return json({
    ok: true,
    commit: env.DEPLOY_COMMIT_SHA || env.CF_PAGES_COMMIT_SHA || null,
    branch: env.DEPLOY_BRANCH || env.CF_PAGES_BRANCH || null,
    hasDeployHook: Boolean(env.CLOUDFLARE_DEPLOY_HOOK_URL),
    hasApiToken: Boolean(env.CLOUDFLARE_API_TOKEN),
    hasZoneId: Boolean(env.CLOUDFLARE_ZONE_ID)
  }, 200);
}

async function handleRedeploy(request, env) {
  const actor = await requireAdmin(request, env);
  if (!actor) return json({ ok: false, error: "Admin access required" }, 403);
  return json(await performRedeploy(env), 200);
}

async function handlePurgeCache(request, env) {
  const actor = await requireAdmin(request, env);
  if (!actor) return json({ ok: false, error: "Admin access required" }, 403);
  return json(await performPurge(env), 200);
}

async function handleRefreshLiveSite(request, env) {
  const actor = await requireAdmin(request, env);
  if (!actor) return json({ ok: false, error: "Admin access required" }, 403);
  const redeploy = await performRedeploy(env);
  const purge = await performPurge(env);
  return json({ ok: redeploy.ok && purge.ok, redeploy, purge }, 200);
}

async function performRedeploy(env) { /* unchanged pattern */
  if (!env.CLOUDFLARE_DEPLOY_HOOK_URL) return { ok: false, error: "Missing CLOUDFLARE_DEPLOY_HOOK_URL" };
  try {
    const res = await fetch(env.CLOUDFLARE_DEPLOY_HOOK_URL, { method: "POST" });
    return { ok: res.ok, status: res.status, message: res.ok ? "Redeploy triggered" : "Redeploy trigger failed", responseText: (await res.text()).slice(0, 1000) };
  } catch (error) {
    return { ok: false, error: `Redeploy request failed: ${String(error.message || error)}` };
  }
}

async function performPurge(env) {
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ZONE_ID) return { ok: false, error: "Missing CLOUDFLARE_API_TOKEN and/or CLOUDFLARE_ZONE_ID" };
  const endpoint = `https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/purge_cache`;
  try {
    const res = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ purge_everything: true }) });
    return { ok: res.ok, status: res.status, cloudflare: await safeParseResponseJson(res) };
  } catch (error) {
    return { ok: false, error: `Purge request failed: ${String(error.message || error)}` };
  }
}

async function currentUser(request, env) {
  const token = getSessionToken(request);
  if (!token) return null;
  return env.DB.prepare(`SELECT u.id, u.username, u.email, u.role, u.is_admin, b.balance_cents FROM sessions s JOIN users u ON u.id = s.user_id LEFT JOIN balances b ON b.user_id=u.id WHERE s.token=? AND s.expires_at>? LIMIT 1`).bind(hashToken(token), new Date().toISOString()).first();
}
async function requireAdmin(request, env) { const u = await currentUser(request, env); return u && (Number(u.is_admin) === 1 || u.role === "admin") ? u : null; }

async function ensureSchema(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', is_admin INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)").run();
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
function sanitizeUser(user) { return { id: user.id, username: user.username, email: user.email, role: user.role, isAdmin: Number(user.is_admin) === 1 }; }
async function safeJson(request) { try { return await request.json(); } catch { return {}; } }
async function safeParseResponseJson(response) { const text = await response.text(); try { return text ? JSON.parse(text) : { raw: "" }; } catch { return { raw: text }; } }
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8" } }); }
