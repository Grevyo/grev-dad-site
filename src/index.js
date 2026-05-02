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

    const existing = await env.PROFILE_DB
      .prepare('SELECT id FROM users WHERE username = ?')
      .bind(username)
      .first();

    if (existing) {
      return json({ ok: false, error: 'Username is already taken' }, 409);
    }

    const passwordHash = await hashPassword(password);
    const result = await env.PROFILE_DB
      .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
      .bind(username, passwordHash)
      .run();

    const userId = result.meta.last_row_id;

    await initializeBalanceIfExists(env, userId);

    const user = await env.PROFILE_DB
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

    const user = await env.PROFILE_DB
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
    await env.PROFILE_DB
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
      await env.PROFILE_DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
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

    const record = await env.PROFILE_DB
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

async function initializeBalanceIfExists(env, userId) {
  const table = await env.PROFILE_DB
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='balances'")
    .first();

  if (table) {
    await env.PROFILE_DB
      .prepare('INSERT INTO balances (user_id, balance) VALUES (?, ?)')
      .bind(userId, 0)
      .run();
  }
}

function friendlyError(error) {
  return error instanceof Error ? error.message : 'Unexpected server error';
}
