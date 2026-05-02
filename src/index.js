import { getStartingBalancePence } from "./lib/gambling.js";

const SESSION_COOKIE_NAME = "grevdad_session";
const SESSION_DAYS = 30;
let coreTablesReadyPromise = null;

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      console.error("Unhandled worker error:", error);
      return json({ success: false, error: "Internal server error" }, 500, request);
    }
  }
};

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const { pathname } = url;
  if (request.method === "OPTIONS") return handleOptions(request);

  if (pathname === "/api/setup" && request.method === "POST") return handleSetup(request, env);
  if (pathname === "/api/auth/register" && request.method === "POST") return handleRegister(request, env);
  if (pathname === "/api/auth/login" && request.method === "POST") return handleLogin(request, env);
  if (pathname === "/api/auth/logout" && request.method === "POST") return handleLogout(request, env);
  if (pathname === "/api/auth/me" && request.method === "GET") return handleMe(request, env);

  if (pathname === "/api/admin/users" && request.method === "GET") return handleAdminUsers(request, env);
  if (pathname === "/api/admin/user/update" && request.method === "POST") return handleAdminUpdateUser(request, env);
  if (pathname === "/api/admin/user/delete" && request.method === "POST") return handleAdminDeleteUser(request, env);

  if (pathname === "/api/casino/profile" && request.method === "GET") return handleBalanceProfile(request, env);
  if (pathname === "/api/casino/profile/balance" && request.method === "POST") return handleBalanceUpdate(request, env);

  if (env.ASSETS) return env.ASSETS.fetch(request);
  return json({ success: false, error: "Not found" }, 404, request);
}

async function handleSetup(request, env) { await ensureCoreTables(env); return json({ success: true }, 200, request); }

async function ensureCoreTables(env) { if (!coreTablesReadyPromise) coreTablesReadyPromise = ensureCoreTablesOnce(env); await coreTablesReadyPromise; }
async function ensureCoreTablesOnce(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, approved INTEGER NOT NULL DEFAULT 0, is_admin INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, session_token TEXT NOT NULL UNIQUE, user_id INTEGER NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL)`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS casino_profiles (user_id INTEGER PRIMARY KEY, display_name TEXT, grev_coin_balance INTEGER NOT NULL DEFAULT 50000, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, refreshed_at TEXT NOT NULL)`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS gambling_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)`).run();
}

async function handleRegister(request, env) {
  await ensureCoreTables(env);
  const body = await safeJson(request);
  const username = String(body?.username || "").trim();
  const password = String(body?.password || "");
  if (!username || !password) return json({ success: false, error: "username and password are required" }, 400, request);
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO users (username,password_hash,approved,is_admin,created_at) VALUES (?,?,?,?,?)`).bind(username, passwordHash, 1, 0, now).run();
  return json({ success: true }, 201, request);
}
async function handleLogin(request, env) {
  await ensureCoreTables(env);
  const body = await safeJson(request);
  const username = String(body?.username || "").trim();
  const password = String(body?.password || "");
  const user = await env.DB.prepare(`SELECT id,username,password_hash,is_admin,approved FROM users WHERE username=?`).bind(username).first();
  if (!user || !(await verifyPassword(password, user.password_hash))) return json({ success: false, error: "Invalid credentials" }, 401, request);
  const token = crypto.randomUUID() + crypto.randomUUID();
  const created = new Date();
  const expires = new Date(created.getTime() + SESSION_DAYS * 86400000);
  await env.DB.prepare(`INSERT INTO sessions (session_token,user_id,created_at,expires_at) VALUES (?,?,?,?)`).bind(token, user.id, created.toISOString(), expires.toISOString()).run();
  return json({ success: true, user: { id: user.id, username: user.username, is_admin: !!user.is_admin } }, 200, request, setSessionCookie(token, expires));
}
async function handleLogout(request, env) {
  const token = getSessionToken(request.headers.get("Cookie"));
  if (token) await env.DB.prepare(`DELETE FROM sessions WHERE session_token=?`).bind(token).run();
  return json({ success: true }, 200, request, `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
}
async function handleMe(request, env) { const user = await getSessionUser(request, env); if (!user) return json({ success: false, error: "Not authenticated" }, 401, request); return json({ success: true, user }, 200, request); }
async function handleAdminUsers(request, env) { const admin = await requireAdmin(request, env); if (!admin) return json({ success: false, error: "Forbidden" }, 403, request); const rows = await env.DB.prepare(`SELECT id,username,approved,is_admin,created_at FROM users ORDER BY id DESC`).all(); return json({ success: true, users: rows.results || [] }, 200, request); }
async function handleAdminUpdateUser(request, env) { const admin = await requireAdmin(request, env); if (!admin) return json({ success: false, error: "Forbidden" }, 403, request); const b = await safeJson(request); await env.DB.prepare(`UPDATE users SET approved=?, is_admin=? WHERE id=?`).bind(b.approved?1:0,b.is_admin?1:0,Number(b.user_id)).run(); return json({ success: true }, 200, request); }
async function handleAdminDeleteUser(request, env) { const admin = await requireAdmin(request, env); if (!admin) return json({ success: false, error: "Forbidden" }, 403, request); const b = await safeJson(request); await env.DB.prepare(`DELETE FROM users WHERE id=?`).bind(Number(b.user_id)).run(); return json({ success: true }, 200, request); }
async function handleBalanceProfile(request, env) { const user = await getSessionUser(request, env); if (!user) return json({ success: false, error: "Not authenticated" }, 401, request); const profile = await ensureCasinoProfile(env, user.id, user.username); return json({ success: true, profile }, 200, request); }
async function handleBalanceUpdate(request, env) { const user = await getSessionUser(request, env); if (!user) return json({ success: false, error: "Not authenticated" }, 401, request); const b = await safeJson(request); const balancePence = Math.max(0, Math.round(Number(b?.balance_coins || 0)*100)); const now = new Date().toISOString(); await env.DB.prepare(`UPDATE casino_profiles SET grev_coin_balance=?, updated_at=?, refreshed_at=? WHERE user_id=?`).bind(balancePence, now, now, user.id).run(); const profile = await ensureCasinoProfile(env, user.id, user.username); return json({ success: true, profile }, 200, request); }

async function ensureCasinoProfile(env, userId, username) { const now = new Date().toISOString(); const starting = await getStartingBalancePence(env); await env.DB.prepare(`INSERT OR IGNORE INTO casino_profiles (user_id,display_name,grev_coin_balance,created_at,updated_at,refreshed_at) VALUES (?,?,?,?,?,?)`).bind(userId, username, starting, now, now, now).run(); return await env.DB.prepare(`SELECT user_id,display_name,grev_coin_balance,created_at,updated_at,refreshed_at FROM casino_profiles WHERE user_id=?`).bind(userId).first(); }

async function requireAdmin(request, env) { const user = await getSessionUser(request, env); return user?.is_admin ? user : null; }
async function getSessionUser(request, env) { const token = getSessionToken(request.headers.get("Cookie")); if (!token) return null; const now = new Date().toISOString(); const row = await env.DB.prepare(`SELECT u.id,u.username,u.is_admin FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.session_token=? AND s.expires_at>?`).bind(token, now).first(); return row || null; }
function getSessionToken(cookieHeader = "") { const m = cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`)); return m?.[1] || null; }
function setSessionCookie(token, expiresAt) { return `${SESSION_COOKIE_NAME}=${token}; Path=/; Expires=${expiresAt.toUTCString()}; HttpOnly; SameSite=Lax`; }
async function hashPassword(password) { const salt = crypto.randomUUID().replaceAll("-", ""); const digest = await sha256(`${salt}:${password}`); return `${salt}:${digest}`; }
async function verifyPassword(password, stored) { const [salt, digest] = String(stored || "").split(":"); if (!salt || !digest) return false; return (await sha256(`${salt}:${password}`)) === digest; }
async function sha256(input) { const data = new TextEncoder().encode(input); const hash = await crypto.subtle.digest("SHA-256", data); return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join(""); }
async function safeJson(request){try{return await request.json();}catch{return {};}}
function json(body, status=200, request, setCookie){ const headers = {"content-type":"application/json; charset=utf-8", "access-control-allow-origin": request.headers.get("origin") || "*", "access-control-allow-credentials":"true"}; if(setCookie) headers["set-cookie"]=setCookie; return new Response(JSON.stringify(body), {status, headers}); }
function handleOptions(request){ return new Response(null,{status:204,headers:{"access-control-allow-origin":request.headers.get("origin")||"*","access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"content-type","access-control-allow-credentials":"true"}})}
