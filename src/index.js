const SESSION_COOKIE = 'session_token';
const SESSION_DAYS = 7;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/auth/register' && request.method === 'POST') {
      return handleRegister(request, env);
    }
    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      return handleLogin(request, env);
    }
    if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
      return handleLogout(request, env);
    }
    if (url.pathname === '/api/auth/me' && request.method === 'GET') {
      return handleMe(request, env);
    }
    if (url.pathname === '/api/debug/db' && request.method === 'GET') {
      return handleDebugDb(env);
    }
    if (url.pathname === '/api/setup/status' && request.method === 'GET') {
      return handleSetupStatus(env);
    }
    if (url.pathname === '/api/setup/schema' && request.method === 'POST') {
      return handleSetupSchema(request, env);
    }

    if (url.pathname === '/api/admin/refresh/status' && request.method === 'GET') {
      return handleRefreshStatus(request, env);
    }
    if (url.pathname === '/api/admin/refresh/purge-cache' && request.method === 'POST') {
      return handlePurgeCache(request, env);
    }
    if (url.pathname === '/api/admin/refresh/redeploy' && request.method === 'POST') {
      return handleRedeploy(request, env);
    }
    if (url.pathname === '/api/admin/refresh/all' && request.method === 'POST') {
      return handleRefreshAll(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleRegister(request, env) {
  try {
    const body = await readJsonBody(request);
    const username = (body?.username ?? '').trim();
    const password = body?.password ?? '';

    if (!username || !password) {
      return json({ ok: false, error: 'Username and password are required' }, 400);
    }

    const db = getDatabase(env);
    const schema = await getSchemaStatus(db);
    if (!schema.allPresent) {
      return json({ ok: false, error: 'Database schema is missing. Run setup or apply D1 migrations.' }, 503);
    }

    const existing = await db
      .prepare('SELECT id FROM users WHERE username = ?')
      .bind(username)
      .first();

    if (existing) {
      return json({ ok: false, error: 'Username is already taken' }, 409);
    }

    const passwordHash = await hashPassword(password);
    const result = await db
      .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
      .bind(username, passwordHash)
      .run();

    const userId = result.meta.last_row_id;

    await initializeBalanceIfExists(db, userId);

    const user = await db
      .prepare('SELECT id, username, role, is_admin FROM users WHERE id = ?')
      .bind(userId)
      .first();

    return json({ ok: true, user }, 201);
  } catch (error) {
    return json({ ok: false, error: friendlyError(error) }, 500);
  }
}

async function handleLogin(request, env) {
  try {
    const body = await readJsonBody(request);
    const username = (body?.username ?? '').trim();
    const password = body?.password ?? '';

    if (!username || !password) {
      return json({ ok: false, error: 'Username and password are required' }, 400);
    }

    const db = getDatabase(env);
    const schema = await getSchemaStatus(db);
    if (!schema.allPresent) {
      return json({ ok: false, error: 'Database schema is missing. Run setup or apply D1 migrations.' }, 503);
    }

    const user = await db
      .prepare('SELECT id, username, role, is_admin, password_hash FROM users WHERE username = ?')
      .bind(username)
      .first();

    if (!user) {
      return json({ ok: false, error: 'Invalid username or password' }, 401);
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return json({ ok: false, error: 'Invalid username or password' }, 401);
    }

    const { token, expiresAt } = makeSessionToken();
    await db
      .prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
      .bind(token, user.id, expiresAt)
      .run();

    const safeUser = {
      id: user.id,
      username: user.username,
      role: user.role,
      is_admin: user.is_admin,
    };

    return withSessionCookie(json({ ok: true, user: safeUser }), token, expiresAt);
  } catch (error) {
    return json({ ok: false, error: friendlyError(error) }, 500);
  }
}

async function handleLogout(request, env) {
  try {
    const token = getSessionToken(request);
    if (token) {
      const db = getDatabase(env);
      await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    }

    const response = json({ ok: true });
    response.headers.append('Set-Cookie', clearSessionCookie());
    return response;
  } catch (error) {
    return json({ ok: false, error: friendlyError(error) }, 500);
  }
}

async function handleMe(request, env) {
  try {
    const token = getSessionToken(request);
    if (!token) {
      return json({ ok: false, user: null, error: 'Not logged in' }, 401);
    }

    const db = getDatabase(env);

    const record = await db
      .prepare(
        `SELECT u.id, u.username, u.role, u.is_admin
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token = ? AND s.expires_at > datetime('now')`
      )
      .bind(token)
      .first();

    if (!record) {
      return json({ ok: false, user: null, error: 'Not logged in' }, 401);
    }

    return json({ ok: true, user: record });
  } catch (error) {
    return json({ ok: false, error: friendlyError(error) }, 500);
  }
}

async function handleRefreshStatus(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth) return auth;

  return json({
    ok: true,
    configured: getRefreshConfig(env),
  });
}

async function handlePurgeCache(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth) return auth;

  const purge = await purgeCache(env);
  return json(purge, purge.ok ? 200 : 500);
}

async function handleRedeploy(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth) return auth;

  const redeploy = await triggerRedeploy(env);
  return json(redeploy, redeploy.ok ? 200 : 500);
}

async function handleRefreshAll(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth) return auth;

  const purge = await purgeCache(env);
  const redeploy = env.CLOUDFLARE_DEPLOY_HOOK_URL ? await triggerRedeploy(env) : { ok: false, error: 'Cloudflare deploy hook is not configured' };

  return json({
    ok: purge.ok && (redeploy.ok || !env.CLOUDFLARE_DEPLOY_HOOK_URL),
    purge,
    redeploy,
  }, purge.ok ? 200 : 500);
}

function getRefreshConfig(env) {
  return {
    cloudflareApiToken: Boolean(env.CLOUDFLARE_API_TOKEN),
    cloudflareZoneId: Boolean(env.CLOUDFLARE_ZONE_ID),
    cloudflareDeployHookUrl: Boolean(env.CLOUDFLARE_DEPLOY_HOOK_URL),
  };
}

async function purgeCache(env) {
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ZONE_ID) {
    return { ok: false, error: 'Cloudflare cache purge is not configured' };
  }

  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/purge_cache`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ purge_everything: true }),
    });

    const text = await response.text();
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }

    if (!response.ok || !body?.success) {
      return {
        ok: false,
        error: 'Cloudflare cache purge failed',
        status: response.status,
        details: sanitizeCloudflareErrors(body?.errors),
      };
    }

    return { ok: true, status: response.status };
  } catch (error) {
    return { ok: false, error: `Cloudflare cache purge request failed: ${friendlyError(error)}` };
  }
}

async function triggerRedeploy(env) {
  if (!env.CLOUDFLARE_DEPLOY_HOOK_URL) {
    return { ok: false, error: 'Cloudflare deploy hook is not configured' };
  }

  try {
    const response = await fetch(env.CLOUDFLARE_DEPLOY_HOOK_URL, { method: 'POST' });
    const text = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        error: 'Cloudflare deploy hook failed',
        status: response.status,
        details: text ? text.slice(0, 300) : 'No response body',
      };
    }

    return { ok: true, status: response.status };
  } catch (error) {
    return { ok: false, error: `Cloudflare deploy hook request failed: ${friendlyError(error)}` };
  }
}

function sanitizeCloudflareErrors(errors) {
  if (!Array.isArray(errors) || errors.length === 0) {
    return 'Unknown Cloudflare API error';
  }
  return errors.map((item) => `${item?.code ?? 'unknown'}: ${item?.message ?? 'Unknown error'}`).join('; ');
}

async function requireAdmin(request, env) {
  const token = getSessionToken(request);
  if (!token) {
    return json({ ok: false, error: 'Not logged in' }, 401);
  }

  const db = getDatabase(env);

  const user = await db
    .prepare(
      `SELECT u.id, u.is_admin
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > datetime('now')`
    )
    .bind(token)
    .first();

  if (!user) {
    return json({ ok: false, error: 'Not logged in' }, 401);
  }

  if (!user.is_admin) {
    return json({ ok: false, error: 'Admin access required' }, 403);
  }

  return null;
}


function getDatabase(env) {
  if (!env || !env.DB) {
    throw new Error('Database binding DB is not configured');
  }
  return env.DB;
}

function handleDebugDb(env) {
  try {
    getDatabase(env);
    return json({ ok: true, hasDb: true });
  } catch (error) {
    return json({ ok: false, hasDb: false, error: friendlyError(error) }, 500);
  }
}

async function handleSetupStatus(env) {
  try {
    const db = getDatabase(env);
    const schema = await getSchemaStatus(db);
    return json({
      ok: true,
      hasDb: true,
      tables: schema.tables,
    });
  } catch (error) {
    return json({ ok: false, hasDb: false, error: friendlyError(error) }, 500);
  }
}

async function handleSetupSchema(request, env) {
  try {
    const expectedSecret = env.ADMIN_SETUP_SECRET;
    if (!expectedSecret) {
      return json({ ok: false, error: 'Schema setup is not configured' }, 500);
    }

    const body = await readJsonBody(request);
    if (!body?.secret || body.secret !== expectedSecret) {
      return json({ ok: false, error: 'Forbidden' }, 403);
    }

    const db = getDatabase(env);
    await createSchemaTables(db);
    return json({ ok: true, message: 'Schema created' });
  } catch (error) {
    return json({ ok: false, error: friendlyError(error) }, 500);
  }
}

async function readJsonBody(request) {
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON body');
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function makeSessionToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  return { token, expiresAt };
}

function withSessionCookie(response, token, expiresAt) {
  response.headers.append(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Expires=${new Date(expiresAt).toUTCString()}`
  );
  return response;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`;
}

function getSessionToken(request) {
  const header = request.headers.get('Cookie') || '';
  const parts = header.split(';').map((p) => p.trim());
  for (const part of parts) {
    if (part.startsWith(`${SESSION_COOKIE}=`)) {
      return part.slice(SESSION_COOKIE.length + 1);
    }
  }
  return null;
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const hash = new Uint8Array(bits);
  return `pbkdf2$120000$${toBase64(salt)}$${toBase64(hash)}`;
}

async function verifyPassword(password, stored) {
  const [algo, roundsStr, saltB64, hashB64] = (stored || '').split('$');
  if (algo !== 'pbkdf2') return false;
  const rounds = Number(roundsStr);
  if (!Number.isFinite(rounds) || rounds < 1) return false;

  const salt = fromBase64(saltB64);
  const expected = fromBase64(hashB64);

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: rounds, hash: 'SHA-256' },
    keyMaterial,
    expected.length * 8
  );
  return timingSafeEqual(expected, new Uint8Array(bits));
}

function toBase64(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64) {
  const bin = atob(b64 || '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function initializeBalanceIfExists(db, userId) {
  const table = await db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='balances'")
    .first();

  if (table) {
    await db
      .prepare('INSERT INTO balances (user_id, balance_cents) VALUES (?, ?)')
      .bind(userId, 10000)
      .run();
  }
}

async function getSchemaStatus(db) {
  const required = ['users', 'sessions', 'balances', 'ledger'];
  const rows = await db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('users', 'sessions', 'balances', 'ledger')")
    .all();
  const found = new Set((rows?.results || []).map((row) => row.name));
  const tables = Object.fromEntries(required.map((name) => [name, found.has(name)]));
  return { tables, allPresent: required.every((name) => tables[name]) };
}

async function createSchemaTables(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS balances (
    user_id INTEGER PRIMARY KEY,
    balance_cents INTEGER NOT NULL DEFAULT 10000,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount_cents INTEGER NOT NULL,
    reason TEXT NOT NULL DEFAULT 'init',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();
}

function friendlyError(error) {
  return error instanceof Error ? error.message : 'Unexpected error';
}
