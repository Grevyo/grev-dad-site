interface D1Result<T> { results: T[]; }
interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<unknown>;
}
interface D1Executor {
  prepare(query: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown[]>;
}
interface D1DatabaseSession extends D1Executor {
  getBookmark(): string | null;
}
interface D1Database extends D1Executor {
  withSession(constraint?: string): D1DatabaseSession;
}

export interface GrevHomeEnv {
  DB: D1Database;
  APP_ENV: 'development' | 'pbe' | 'production';
}

type BrowserUser = {
  id: string;
  username: string;
  displayName: string;
  isVerified: boolean;
  isOwner: boolean;
  isAdmin: boolean;
};

type DeviceContext = {
  tokenId: string;
  linkId: string;
  grevId: string;
  localUsername: string;
  localDisplayName: string;
  user: BrowserUser;
};

type LinkRequestRow = {
  id: string;
  grev_id: string;
  local_username: string;
  local_display_name: string;
  device_name: string;
  created_at: number;
  expires_at: number;
  approved_user_id: string | null;
  approved_at: number | null;
  denied_at: number | null;
};

type PresenceRow = {
  availability: string;
  status_text: string;
  activity_type: string;
  activity_text: string;
  expires_at: number | null;
  updated_at: number;
};

const COOKIE = 'grev_session';
const encoder = new TextEncoder();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GREV_ID_RE = /^G[A-HJ-NP-Z2-9]{4}[A-Za-z0-9_]{1,50}[A-HJ-NP-Z2-9]{3}$/;
const SAFE_APP_ID_RE = /^[A-Za-z0-9._-]{1,80}$/;
const USER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const API_VERSION = 1;
const LINK_REQUEST_LIFETIME_SECONDS = 10 * 60;
const DEVICE_TOKEN_LIFETIME_SECONDS = 90 * 24 * 60 * 60;
const PRESENCE_MIN_SECONDS = 60;
const PRESENCE_MAX_SECONDS = 10 * 60;

function primaryDatabase(env: GrevHomeEnv): D1Executor {
  // Link creation, approval and token issuance cross multiple HTTP requests. Route those
  // security-sensitive reads to the primary so every step sees the latest committed state even
  // when D1 read replication is enabled for the database.
  return env.DB.withSession('first-primary');
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function sha256(value: string): Promise<string> {
  return base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

function parseCookies(request: Request): Record<string, string> {
  return Object.fromEntries((request.headers.get('Cookie') ?? '')
    .split(';')
    .map(value => value.trim())
    .filter(Boolean)
    .map(value => {
      const index = value.indexOf('=');
      return index < 0 ? ['', ''] : [value.slice(0, index), decodeURIComponent(value.slice(index + 1))];
    })
    .filter(([key]) => key));
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    }
  });
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  return !origin || origin === new URL(request.url).origin;
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (!(request.headers.get('Content-Type') ?? '').includes('application/json')) throw new Error('JSON_REQUIRED');
  const value: unknown = await request.json();
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_BODY');
  return value as Record<string, unknown>;
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get('Authorization') ?? '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function randomSecret(bytes = 32): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

function randomUserCode(): string {
  const values = crypto.getRandomValues(new Uint8Array(8));
  const chars = Array.from(values, value => USER_CODE_ALPHABET[value % USER_CODE_ALPHABET.length]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
}

function normalizeUserCode(value: unknown): string {
  return String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^(.{4})(.{4})$/, '$1-$2');
}

function cleanText(value: unknown, maximumLength: number): string {
  return String(value ?? '').trim().slice(0, maximumLength);
}

function cleanMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(key)) continue;
    if (item === null || typeof item === 'boolean' || typeof item === 'number') result[key] = item;
    else if (typeof item === 'string') result[key] = item.slice(0, 500);
  }
  return result;
}

async function getBrowserUser(request: Request, env: GrevHomeEnv): Promise<BrowserUser | null> {
  const token = parseCookies(request)[COOKIE];
  if (!token) return null;
  const row = await env.DB.prepare(`
    SELECT u.id,u.username,u.display_name,u.is_verified,u.is_owner,
      CASE WHEN u.is_owner=1 OR EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role_id='role-admin') THEN 1 ELSE 0 END AS is_admin
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.status='active'
  `).bind(await sha256(token), now()).first<{id:string;username:string;display_name:string;is_verified:number;is_owner:number;is_admin:number}>();
  return row ? {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    isVerified: Boolean(row.is_verified),
    isOwner: Boolean(row.is_owner),
    isAdmin: Boolean(row.is_admin)
  } : null;
}

async function getDeviceContext(request: Request, env: GrevHomeEnv): Promise<DeviceContext | null> {
  const token = bearerToken(request);
  if (!token) return null;
  const current = now();
  const db = primaryDatabase(env);
  const row = await db.prepare(`
    SELECT t.id AS token_id,t.link_id,l.grev_id,l.local_username,l.local_display_name,
      u.id AS user_id,u.username,u.display_name,u.is_verified,u.is_owner,
      CASE WHEN u.is_owner=1 OR EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role_id='role-admin') THEN 1 ELSE 0 END AS is_admin
    FROM grev_home_tokens t
    JOIN grev_home_links l ON l.id=t.link_id
    JOIN users u ON u.id=l.user_id
    WHERE t.token_hash=? AND t.revoked_at IS NULL AND t.expires_at>?
      AND l.revoked_at IS NULL AND u.status='active'
  `).bind(await sha256(token), current).first<{
    token_id:string;link_id:string;grev_id:string;local_username:string;local_display_name:string;
    user_id:string;username:string;display_name:string;is_verified:number;is_owner:number;is_admin:number;
  }>();
  if (!row) return null;

  await db.batch([
    db.prepare(`UPDATE grev_home_tokens SET last_used_at=? WHERE id=?`).bind(current, row.token_id),
    db.prepare(`UPDATE grev_home_links SET last_seen_at=?,updated_at=? WHERE id=?`).bind(current, current, row.link_id)
  ]);

  return {
    tokenId: row.token_id,
    linkId: row.link_id,
    grevId: row.grev_id,
    localUsername: row.local_username,
    localDisplayName: row.local_display_name,
    user: {
      id: row.user_id,
      username: row.username,
      displayName: row.display_name,
      isVerified: Boolean(row.is_verified),
      isOwner: Boolean(row.is_owner),
      isAdmin: Boolean(row.is_admin)
    }
  };
}

function accountPayload(context: DeviceContext) {
  return {
    userId: context.user.id,
    username: context.user.username,
    displayName: context.user.displayName,
    isVerified: context.user.isVerified,
    grevId: context.grevId,
    localUsername: context.localUsername,
    localDisplayName: context.localDisplayName,
    linkId: context.linkId
  };
}

function presencePayload(row: PresenceRow | null) {
  if (!row || (row.expires_at !== null && row.expires_at <= now())) {
    return { availability:'offline', statusText:'', activityType:'none', activityText:'', expiresAt:null, updatedAt:null };
  }
  return {
    availability: row.availability,
    statusText: row.status_text,
    activityType: row.activity_type,
    activityText: row.activity_text,
    expiresAt: row.expires_at,
    updatedAt: row.updated_at
  };
}

async function readPresence(env: GrevHomeEnv, userId: string) {
  const row = await env.DB.prepare(`SELECT availability,status_text,activity_type,activity_text,expires_at,updated_at FROM user_presence WHERE user_id=?`)
    .bind(userId).first<PresenceRow>();
  return presencePayload(row);
}

async function linkStart(request: Request, env: GrevHomeEnv): Promise<Response> {
  const input = await readBody(request);
  const grevId = cleanText(input.grevId, 58);
  const localUsername = cleanText(input.username, 50);
  const localDisplayName = cleanText(input.displayName, 50);
  const deviceName = cleanText(input.deviceName, 100);
  if (!GREV_ID_RE.test(grevId) || !localUsername || !localDisplayName) {
    return json({ ok:false, message:'The local Grev Home identity is invalid.' }, 400);
  }

  const id = crypto.randomUUID();
  const deviceCode = randomSecret();
  const userCode = randomUserCode();
  const created = now();
  const expiresAt = created + LINK_REQUEST_LIFETIME_SECONDS;
  const db = primaryDatabase(env);

  await db.prepare(`DELETE FROM grev_home_link_requests WHERE expires_at<?`).bind(created - 3600).run();
  await db.prepare(`
    INSERT INTO grev_home_link_requests(id,device_code_hash,user_code,grev_id,local_username,local_display_name,device_name,created_at,expires_at)
    VALUES(?,?,?,?,?,?,?,?,?)
  `).bind(id, await sha256(deviceCode), userCode, grevId, localUsername, localDisplayName, deviceName, created, expiresAt).run();

  const url = new URL(request.url);
  const verificationUri = `${url.origin}/link-grev-home?code=${encodeURIComponent(userCode)}`;
  return json({
    ok:true,
    apiVersion:API_VERSION,
    linkId:id,
    deviceCode,
    userCode,
    verificationUri,
    expiresAt,
    intervalSeconds:3
  }, 201);
}

async function browserLinkRequest(request: Request, env: GrevHomeEnv): Promise<Response> {
  const user = await getBrowserUser(request, env);
  if (!user) return json({ ok:false, message:'Authentication required.' }, 401);
  const code = normalizeUserCode(new URL(request.url).searchParams.get('code'));
  const row = await primaryDatabase(env).prepare(`
    SELECT id,grev_id,local_username,local_display_name,device_name,created_at,expires_at,approved_user_id,approved_at,denied_at
    FROM grev_home_link_requests WHERE user_code=?
  `).bind(code).first<LinkRequestRow>();
  if (!row) return json({ ok:false, message:'That Grev Home link code was not found.' }, 404);
  if (row.expires_at <= now()) return json({ ok:false, status:'expired', message:'That Grev Home link code has expired.' }, 410);
  return json({
    ok:true,
    request:{
      id:row.id,
      grevId:row.grev_id,
      localUsername:row.local_username,
      localDisplayName:row.local_display_name,
      deviceName:row.device_name,
      createdAt:row.created_at,
      expiresAt:row.expires_at,
      status:row.denied_at ? 'denied' : row.approved_user_id ? 'approved' : 'pending',
      approvedByCurrentUser:row.approved_user_id === user.id
    }
  });
}

async function browserLinkDecision(request: Request, env: GrevHomeEnv): Promise<Response> {
  const user = await getBrowserUser(request, env);
  if (!user) return json({ ok:false, message:'Authentication required.' }, 401);
  if (!sameOrigin(request)) return json({ ok:false, message:'Origin rejected.' }, 403);

  const input = await readBody(request);
  const code = normalizeUserCode(input.userCode);
  const decision = String(input.decision ?? '').toLowerCase();
  if (!['approve','deny'].includes(decision)) return json({ ok:false, message:'Choose approve or deny.' }, 400);

  const db = primaryDatabase(env);
  const row = await db.prepare(`
    SELECT id,grev_id,local_username,local_display_name,device_name,created_at,expires_at,approved_user_id,approved_at,denied_at
    FROM grev_home_link_requests WHERE user_code=?
  `).bind(code).first<LinkRequestRow>();
  if (!row) return json({ ok:false, message:'That Grev Home link code was not found.' }, 404);
  const current = now();
  if (row.expires_at <= current) return json({ ok:false, status:'expired', message:'That Grev Home link code has expired.' }, 410);
  if (row.denied_at) return json({ ok:false, status:'denied', message:'That link request has already been denied.' }, 409);
  if (row.approved_user_id && row.approved_user_id !== user.id) return json({ ok:false, message:'That request has already been approved by another account.' }, 409);

  if (decision === 'deny') {
    await db.prepare(`UPDATE grev_home_link_requests SET denied_at=? WHERE id=? AND approved_user_id IS NULL`).bind(current, row.id).run();
    return json({ ok:true, status:'denied' });
  }

  const byUser = await db.prepare(`SELECT id,user_id,grev_id,revoked_at FROM grev_home_links WHERE user_id=?`).bind(user.id)
    .first<{id:string;user_id:string;grev_id:string;revoked_at:number|null}>();
  const byGrev = await db.prepare(`SELECT id,user_id,grev_id,revoked_at FROM grev_home_links WHERE grev_id=? COLLATE NOCASE`).bind(row.grev_id)
    .first<{id:string;user_id:string;grev_id:string;revoked_at:number|null}>();

  if (byUser && byUser.grev_id.toLowerCase() !== row.grev_id.toLowerCase()) {
    return json({ ok:false, message:`This grev.dad account is already linked to GrevID ${byUser.grev_id}.` }, 409);
  }
  if (byGrev && byGrev.user_id !== user.id) {
    return json({ ok:false, message:'That GrevID is already linked to another grev.dad account.' }, 409);
  }

  let linkId = byUser?.id ?? byGrev?.id ?? null;
  if (linkId) {
    await db.prepare(`
      UPDATE grev_home_links SET local_username=?,local_display_name=?,updated_at=?,revoked_at=NULL WHERE id=?
    `).bind(row.local_username, row.local_display_name, current, linkId).run();
  } else {
    linkId = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO grev_home_links(id,user_id,grev_id,local_username,local_display_name,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?)
    `).bind(linkId, user.id, row.grev_id, row.local_username, row.local_display_name, current, current).run();
  }

  await db.prepare(`
    UPDATE grev_home_link_requests SET approved_user_id=?,approved_at=?,denied_at=NULL WHERE id=?
  `).bind(user.id, current, row.id).run();

  return json({ ok:true, status:'approved', grevId:row.grev_id, account:{ userId:user.id, username:user.username, displayName:user.displayName } });
}

async function linkStatus(request: Request, env: GrevHomeEnv): Promise<Response> {
  const deviceCode = bearerToken(request);
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!deviceCode || !UUID_RE.test(id)) return json({ ok:false, message:'The link request credentials are invalid.' }, 401);

  const db = primaryDatabase(env);
  const row = await db.prepare(`
    SELECT id,grev_id,local_username,local_display_name,device_name,created_at,expires_at,approved_user_id,approved_at,denied_at
    FROM grev_home_link_requests WHERE id=? AND device_code_hash=?
  `).bind(id, await sha256(deviceCode)).first<LinkRequestRow>();
  if (!row) return json({ ok:false, message:'The link request was not found.' }, 404);
  const current = now();
  if (row.expires_at <= current) return json({ ok:true, status:'expired', expiresAt:row.expires_at });
  if (row.denied_at) return json({ ok:true, status:'denied', expiresAt:row.expires_at });
  if (!row.approved_user_id) return json({ ok:true, status:'pending', expiresAt:row.expires_at });

  const link = await db.prepare(`
    SELECT l.id,l.user_id,l.grev_id,l.local_username,l.local_display_name,u.username,u.display_name,u.is_verified,u.status
    FROM grev_home_links l JOIN users u ON u.id=l.user_id
    WHERE l.user_id=? AND l.grev_id=? COLLATE NOCASE AND l.revoked_at IS NULL
  `).bind(row.approved_user_id, row.grev_id).first<{
    id:string;user_id:string;grev_id:string;local_username:string;local_display_name:string;
    username:string;display_name:string;is_verified:number;status:string;
  }>();
  if (!link || link.status !== 'active') return json({ ok:true, status:'revoked', expiresAt:row.expires_at });

  // Poll completion is retry-safe without storing plaintext device credentials. Every successful
  // poll rotates any token previously issued from this one-time request, so a lost HTTP response
  // can simply poll again and receive a new credential while the lost one becomes invalid.
  const accessToken = randomSecret();
  const tokenId = crypto.randomUUID();
  const tokenExpiresAt = current + DEVICE_TOKEN_LIFETIME_SECONDS;
  await db.batch([
    db.prepare(`UPDATE grev_home_tokens SET revoked_at=? WHERE link_request_id=? AND revoked_at IS NULL`).bind(current, row.id),
    db.prepare(`
      INSERT INTO grev_home_tokens(id,link_id,link_request_id,token_hash,device_name,created_at,expires_at)
      VALUES(?,?,?,?,?,?,?)
    `).bind(tokenId, link.id, row.id, await sha256(accessToken), row.device_name, current, tokenExpiresAt),
    db.prepare(`UPDATE grev_home_link_requests SET last_token_issued_at=? WHERE id=?`).bind(current, row.id)
  ]);

  return json({
    ok:true,
    status:'approved',
    apiVersion:API_VERSION,
    accessToken,
    tokenType:'Bearer',
    tokenExpiresAt,
    account:{
      userId:link.user_id,
      username:link.username,
      displayName:link.display_name,
      isVerified:Boolean(link.is_verified),
      grevId:link.grev_id,
      localUsername:link.local_username,
      localDisplayName:link.local_display_name,
      linkId:link.id
    }
  });
}

async function deviceMe(request: Request, env: GrevHomeEnv): Promise<Response> {
  const context = await getDeviceContext(request, env);
  if (!context) return json({ ok:false, message:'Grev Home link authentication failed.' }, 401);
  return json({ ok:true, apiVersion:API_VERSION, account:accountPayload(context) });
}

async function revokeCurrentToken(request: Request, env: GrevHomeEnv): Promise<Response> {
  const context = await getDeviceContext(request, env);
  if (!context) return json({ ok:false, message:'Grev Home link authentication failed.' }, 401);
  await env.DB.prepare(`UPDATE grev_home_tokens SET revoked_at=? WHERE id=?`).bind(now(), context.tokenId).run();
  return json({ ok:true });
}

async function revokeLink(request: Request, env: GrevHomeEnv): Promise<Response> {
  const context = await getDeviceContext(request, env);
  if (!context) return json({ ok:false, message:'Grev Home link authentication failed.' }, 401);
  const current = now();
  await env.DB.batch([
    env.DB.prepare(`UPDATE grev_home_links SET revoked_at=?,updated_at=? WHERE id=?`).bind(current, current, context.linkId),
    env.DB.prepare(`UPDATE grev_home_tokens SET revoked_at=? WHERE link_id=? AND revoked_at IS NULL`).bind(current, context.linkId),
    env.DB.prepare(`UPDATE user_presence SET availability='offline',activity_type='none',activity_text='',expires_at=?,updated_at=? WHERE user_id=?`).bind(current, current, context.user.id)
  ]);
  return json({ ok:true });
}

async function devicePresence(request: Request, env: GrevHomeEnv, context: DeviceContext): Promise<Response> {
  if (request.method === 'GET') return json({ ok:true, presence:await readPresence(env, context.user.id) });
  const input = await readBody(request);
  const availability = String(input.availability ?? 'online');
  const activityType = String(input.activityType ?? 'none');
  if (!['online','away','busy','offline'].includes(availability) || !['none','playing','listening','watching','working'].includes(activityType)) {
    return json({ ok:false, message:'Choose a valid presence state.' }, 400);
  }
  const current = now();
  const requestedSeconds = Number(input.expiresInSeconds ?? 300);
  const lifetime = Math.max(PRESENCE_MIN_SECONDS, Math.min(PRESENCE_MAX_SECONDS, Number.isFinite(requestedSeconds) ? Math.floor(requestedSeconds) : 300));
  const expiresAt = current + lifetime;
  await env.DB.prepare(`
    INSERT INTO user_presence(user_id,availability,status_text,activity_type,activity_text,expires_at,updated_at)
    VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET
      availability=excluded.availability,status_text=excluded.status_text,activity_type=excluded.activity_type,
      activity_text=excluded.activity_text,expires_at=excluded.expires_at,updated_at=excluded.updated_at
  `).bind(
    context.user.id,
    availability,
    cleanText(input.statusText, 160),
    activityType,
    cleanText(input.activityText, 160),
    expiresAt,
    current
  ).run();
  return json({ ok:true, presence:await readPresence(env, context.user.id) });
}

async function friendList(env: GrevHomeEnv, context: DeviceContext): Promise<Response> {
  const userId = context.user.id;
  const rows = await env.DB.prepare(`
    SELECT u.id,u.username,u.display_name,u.is_verified,
      p.availability,p.status_text,p.activity_type,p.activity_text,p.expires_at,p.updated_at,
      f.created_at
    FROM grev_home_friendships f
    JOIN users u ON u.id=CASE WHEN f.user_low_id=? THEN f.user_high_id ELSE f.user_low_id END
    LEFT JOIN user_presence p ON p.user_id=u.id
    WHERE (f.user_low_id=? OR f.user_high_id=?) AND u.status='active'
      AND NOT EXISTS(
        SELECT 1 FROM profile_blocks b
        WHERE (b.owner_user_id=? AND b.blocked_user_id=u.id)
           OR (b.owner_user_id=u.id AND b.blocked_user_id=?)
      )
    ORDER BY u.display_name COLLATE NOCASE,u.username COLLATE NOCASE
  `).bind(userId, userId, userId, userId, userId).all<{
    id:string;username:string;display_name:string;is_verified:number;
    availability:string|null;status_text:string|null;activity_type:string|null;activity_text:string|null;
    expires_at:number|null;updated_at:number|null;created_at:number;
  }>();

  return json({
    ok:true,
    friends:rows.results.map(row => ({
      userId:row.id,
      username:row.username,
      displayName:row.display_name,
      isVerified:Boolean(row.is_verified),
      friendsSince:row.created_at,
      presence:presencePayload(row.availability ? {
        availability:row.availability,
        status_text:row.status_text ?? '',
        activity_type:row.activity_type ?? 'none',
        activity_text:row.activity_text ?? '',
        expires_at:row.expires_at,
        updated_at:row.updated_at ?? 0
      } : null)
    }))
  });
}

async function friendRequests(request: Request, env: GrevHomeEnv, context: DeviceContext): Promise<Response> {
  const userId = context.user.id;
  if (request.method === 'GET') {
    const rows = await env.DB.prepare(`
      SELECT r.id,r.sender_user_id,r.recipient_user_id,r.created_at,r.updated_at,
        su.username AS sender_username,su.display_name AS sender_display_name,
        ru.username AS recipient_username,ru.display_name AS recipient_display_name
      FROM grev_home_friend_requests r
      JOIN users su ON su.id=r.sender_user_id
      JOIN users ru ON ru.id=r.recipient_user_id
      WHERE r.status='pending' AND (r.sender_user_id=? OR r.recipient_user_id=?)
      ORDER BY r.created_at DESC
    `).bind(userId, userId).all<{
      id:string;sender_user_id:string;recipient_user_id:string;created_at:number;updated_at:number;
      sender_username:string;sender_display_name:string;recipient_username:string;recipient_display_name:string;
    }>();
    return json({
      ok:true,
      incoming:rows.results.filter(row => row.recipient_user_id === userId).map(row => ({
        id:row.id,createdAt:row.created_at,user:{userId:row.sender_user_id,username:row.sender_username,displayName:row.sender_display_name}
      })),
      outgoing:rows.results.filter(row => row.sender_user_id === userId).map(row => ({
        id:row.id,createdAt:row.created_at,user:{userId:row.recipient_user_id,username:row.recipient_username,displayName:row.recipient_display_name}
      }))
    });
  }

  const input = await readBody(request);
  const recipientId = String(input.userId ?? '');
  if (!UUID_RE.test(recipientId) || recipientId === userId) return json({ ok:false, message:'Choose another valid member.' }, 400);
  const target = await env.DB.prepare(`SELECT id,username,display_name FROM users WHERE id=? AND status='active'`).bind(recipientId)
    .first<{id:string;username:string;display_name:string}>();
  if (!target) return json({ ok:false, message:'That member is not available.' }, 404);

  const blocked = await env.DB.prepare(`SELECT 1 ok FROM profile_blocks WHERE (owner_user_id=? AND blocked_user_id=?) OR (owner_user_id=? AND blocked_user_id=?)`)
    .bind(userId, recipientId, recipientId, userId).first();
  if (blocked) return json({ ok:false, message:'A friend request cannot be created for this member.' }, 403);

  const [low, high] = userId < recipientId ? [userId, recipientId] : [recipientId, userId];
  const friendship = await env.DB.prepare(`SELECT 1 ok FROM grev_home_friendships WHERE user_low_id=? AND user_high_id=?`).bind(low, high).first();
  if (friendship) return json({ ok:false, message:'You are already friends.' }, 409);

  const existing = await env.DB.prepare(`
    SELECT id,sender_user_id,recipient_user_id FROM grev_home_friend_requests
    WHERE status='pending' AND ((sender_user_id=? AND recipient_user_id=?) OR (sender_user_id=? AND recipient_user_id=?))
    ORDER BY created_at DESC LIMIT 1
  `).bind(userId, recipientId, recipientId, userId).first<{id:string;sender_user_id:string;recipient_user_id:string}>();
  if (existing) {
    if (existing.sender_user_id === userId) return json({ ok:true, status:'pending', requestId:existing.id });
    return json({ ok:false, status:'incoming_pending', requestId:existing.id, message:'This member has already sent you a friend request.' }, 409);
  }

  const requestId = crypto.randomUUID();
  const created = now();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO grev_home_friend_requests(id,sender_user_id,recipient_user_id,status,created_at,updated_at) VALUES(?,?,?,'pending',?,?)`)
      .bind(requestId, userId, recipientId, created, created),
    env.DB.prepare(`INSERT INTO notifications(id,recipient_user_id,actor_user_id,notification_type,title,body,target_url,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)`)
      .bind(crypto.randomUUID(), recipientId, userId, 'friend.request', 'New friend request', `${context.user.displayName} sent you a friend request.`, '/members', JSON.stringify({ requestId }), created)
  ]);
  return json({ ok:true, status:'pending', requestId }, 201);
}

async function resolveFriendRequest(request: Request, env: GrevHomeEnv, context: DeviceContext, requestId: string, action: string): Promise<Response> {
  if (!UUID_RE.test(requestId)) return json({ ok:false, message:'Friend request not found.' }, 404);
  const row = await env.DB.prepare(`
    SELECT r.id,r.sender_user_id,r.recipient_user_id,r.status,u.username,u.display_name,u.status AS sender_status
    FROM grev_home_friend_requests r JOIN users u ON u.id=r.sender_user_id
    WHERE r.id=? AND r.recipient_user_id=?
  `).bind(requestId, context.user.id).first<{
    id:string;sender_user_id:string;recipient_user_id:string;status:string;username:string;display_name:string;sender_status:string;
  }>();
  if (!row || row.status !== 'pending') return json({ ok:false, message:'That friend request is no longer pending.' }, 404);
  const current = now();

  if (action === 'decline') {
    await env.DB.prepare(`UPDATE grev_home_friend_requests SET status='declined',resolved_at=?,updated_at=? WHERE id=? AND status='pending'`)
      .bind(current, current, requestId).run();
    return json({ ok:true, status:'declined' });
  }
  if (action !== 'accept') return json({ ok:false, message:'Choose accept or decline.' }, 400);
  if (row.sender_status !== 'active') return json({ ok:false, message:'That member is no longer available.' }, 409);

  const blocked = await env.DB.prepare(`SELECT 1 ok FROM profile_blocks WHERE (owner_user_id=? AND blocked_user_id=?) OR (owner_user_id=? AND blocked_user_id=?)`)
    .bind(context.user.id, row.sender_user_id, row.sender_user_id, context.user.id).first();
  if (blocked) return json({ ok:false, message:'This friend request cannot be accepted.' }, 403);

  const [low, high] = context.user.id < row.sender_user_id
    ? [context.user.id, row.sender_user_id]
    : [row.sender_user_id, context.user.id];
  await env.DB.batch([
    env.DB.prepare(`INSERT OR IGNORE INTO grev_home_friendships(user_low_id,user_high_id,created_by_request_id,created_at) VALUES(?,?,?,?)`)
      .bind(low, high, requestId, current),
    env.DB.prepare(`UPDATE grev_home_friend_requests SET status='accepted',resolved_at=?,updated_at=? WHERE id=? AND status='pending'`)
      .bind(current, current, requestId),
    env.DB.prepare(`UPDATE grev_home_friend_requests SET status='cancelled',resolved_at=?,updated_at=? WHERE status='pending' AND sender_user_id=? AND recipient_user_id=?`)
      .bind(current, current, context.user.id, row.sender_user_id),
    env.DB.prepare(`INSERT INTO notifications(id,recipient_user_id,actor_user_id,notification_type,title,body,target_url,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)`)
      .bind(crypto.randomUUID(), row.sender_user_id, context.user.id, 'friend.accepted', 'Friend request accepted', `${context.user.displayName} accepted your friend request.`, '/members', JSON.stringify({ requestId }), current)
  ]);
  return json({ ok:true, status:'accepted', friend:{ userId:row.sender_user_id, username:row.username, displayName:row.display_name } });
}

async function cancelFriendRequest(env: GrevHomeEnv, context: DeviceContext, requestId: string): Promise<Response> {
  if (!UUID_RE.test(requestId)) return json({ ok:false, message:'Friend request not found.' }, 404);
  const row = await env.DB.prepare(`SELECT id FROM grev_home_friend_requests WHERE id=? AND sender_user_id=? AND status='pending'`)
    .bind(requestId, context.user.id).first();
  if (!row) return json({ ok:false, message:'That outgoing friend request is no longer pending.' }, 404);
  const current = now();
  await env.DB.prepare(`UPDATE grev_home_friend_requests SET status='cancelled',resolved_at=?,updated_at=? WHERE id=?`)
    .bind(current, current, requestId).run();
  return json({ ok:true, status:'cancelled' });
}

async function removeFriend(env: GrevHomeEnv, context: DeviceContext, otherUserId: string): Promise<Response> {
  if (!UUID_RE.test(otherUserId) || otherUserId === context.user.id) return json({ ok:false, message:'Friend not found.' }, 404);
  const [low, high] = context.user.id < otherUserId ? [context.user.id, otherUserId] : [otherUserId, context.user.id];
  await env.DB.prepare(`DELETE FROM grev_home_friendships WHERE user_low_id=? AND user_high_id=?`).bind(low, high).run();
  return json({ ok:true });
}

async function searchMembers(request: Request, env: GrevHomeEnv, context: DeviceContext): Promise<Response> {
  const query = (new URL(request.url).searchParams.get('q') ?? '').trim().replace(/^@/, '').slice(0, 60);
  if (query.length < 2) return json({ ok:false, message:'Enter at least two characters.' }, 400);
  const like = `%${query.replace(/[^A-Za-z0-9_. -]/g, '')}%`;
  const userId = context.user.id;
  const rows = await env.DB.prepare(`
    SELECT u.id,u.username,u.display_name,u.is_verified,
      CASE WHEN f.user_low_id IS NULL THEN 0 ELSE 1 END AS is_friend,
      CASE WHEN outgoing.id IS NULL THEN 0 ELSE 1 END AS outgoing_pending,
      CASE WHEN incoming.id IS NULL THEN 0 ELSE 1 END AS incoming_pending
    FROM users u
    LEFT JOIN grev_home_friendships f
      ON f.user_low_id=MIN(?,u.id) AND f.user_high_id=MAX(?,u.id)
    LEFT JOIN grev_home_friend_requests outgoing
      ON outgoing.sender_user_id=? AND outgoing.recipient_user_id=u.id AND outgoing.status='pending'
    LEFT JOIN grev_home_friend_requests incoming
      ON incoming.sender_user_id=u.id AND incoming.recipient_user_id=? AND incoming.status='pending'
    WHERE u.status='active' AND u.id<>?
      AND (u.username LIKE ? COLLATE NOCASE OR u.display_name LIKE ? COLLATE NOCASE)
      AND NOT EXISTS(
        SELECT 1 FROM profile_blocks b
        WHERE (b.owner_user_id=? AND b.blocked_user_id=u.id)
           OR (b.owner_user_id=u.id AND b.blocked_user_id=?)
      )
    ORDER BY u.display_name COLLATE NOCASE LIMIT 30
  `).bind(userId, userId, userId, userId, userId, like, like, userId, userId).all<{
    id:string;username:string;display_name:string;is_verified:number;is_friend:number;outgoing_pending:number;incoming_pending:number;
  }>();
  return json({ ok:true, users:rows.results.map(row => ({
    userId:row.id,username:row.username,displayName:row.display_name,isVerified:Boolean(row.is_verified),
    isFriend:Boolean(row.is_friend),outgoingPending:Boolean(row.outgoing_pending),incomingPending:Boolean(row.incoming_pending)
  })) });
}

async function activity(request: Request, env: GrevHomeEnv, context: DeviceContext): Promise<Response> {
  if (request.method === 'GET') {
    const requested = Number(new URL(request.url).searchParams.get('limit') ?? 50);
    const limit = Math.max(1, Math.min(100, Number.isFinite(requested) ? Math.floor(requested) : 50));
    const userId = context.user.id;
    const rows = await env.DB.prepare(`
      SELECT e.id,e.user_id,e.event_type,e.app_id,e.app_name,e.detail,e.visibility,e.metadata_json,e.occurred_at,
        u.username,u.display_name
      FROM grev_home_activity_events e JOIN users u ON u.id=e.user_id
      WHERE (
        e.user_id=? OR (
          e.visibility='friends' AND EXISTS(
            SELECT 1 FROM grev_home_friendships f
            WHERE f.user_low_id=MIN(?,e.user_id) AND f.user_high_id=MAX(?,e.user_id)
          )
        )
      )
      AND NOT EXISTS(
        SELECT 1 FROM profile_blocks b
        WHERE (b.owner_user_id=? AND b.blocked_user_id=e.user_id)
           OR (b.owner_user_id=e.user_id AND b.blocked_user_id=?)
      )
      ORDER BY e.occurred_at DESC LIMIT ?
    `).bind(userId, userId, userId, userId, userId, limit).all<{
      id:string;user_id:string;event_type:string;app_id:string;app_name:string;detail:string;visibility:string;metadata_json:string;occurred_at:number;
      username:string;display_name:string;
    }>();
    return json({ ok:true, events:rows.results.map(row => ({
      id:row.id,user:{userId:row.user_id,username:row.username,displayName:row.display_name},type:row.event_type,
      appId:row.app_id,appName:row.app_name,detail:row.detail,visibility:row.visibility,
      metadata:(() => { try { return JSON.parse(row.metadata_json); } catch { return {}; } })(),occurredAt:row.occurred_at
    })) });
  }

  const input = await readBody(request);
  const eventType = String(input.type ?? '');
  const appId = cleanText(input.appId, 80);
  const appName = cleanText(input.appName, 120);
  const visibility = String(input.visibility ?? 'friends');
  if (!['app.started','app.stopped'].includes(eventType) || !SAFE_APP_ID_RE.test(appId) || !appName || !['friends','private'].includes(visibility)) {
    return json({ ok:false, message:'The Grev Home activity event is invalid.' }, 400);
  }
  const current = now();
  const id = crypto.randomUUID();
  const detail = cleanText(input.detail, 240);
  await env.DB.prepare(`
    INSERT INTO grev_home_activity_events(id,user_id,link_id,event_type,app_id,app_name,detail,visibility,metadata_json,occurred_at,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)
  `).bind(id, context.user.id, context.linkId, eventType, appId, appName, detail, visibility, JSON.stringify(cleanMetadata(input.metadata)), current, current).run();

  if (eventType === 'app.started') {
    await env.DB.prepare(`
      INSERT INTO user_presence(user_id,availability,status_text,activity_type,activity_text,expires_at,updated_at)
      VALUES(?,'online','','playing',?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET availability='online',activity_type='playing',activity_text=excluded.activity_text,expires_at=excluded.expires_at,updated_at=excluded.updated_at
    `).bind(context.user.id, appName, current + 300, current).run();
  } else {
    await env.DB.prepare(`
      INSERT INTO user_presence(user_id,availability,status_text,activity_type,activity_text,expires_at,updated_at)
      VALUES(?,'online','','none','',?,?)
      ON CONFLICT(user_id) DO UPDATE SET availability='online',activity_type='none',activity_text='',expires_at=excluded.expires_at,updated_at=excluded.updated_at
    `).bind(context.user.id, current + 120, current).run();
  }

  return json({ ok:true, id, occurredAt:current }, 201);
}

export async function handleGrevHomeRequest(request: Request, env: GrevHomeEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!path.startsWith('/api/grev-home/')) return null;

  if (path === '/api/grev-home/capabilities' && request.method === 'GET') {
    return json({
      ok:true,
      apiVersion:API_VERSION,
      linking:true,
      friends:true,
      presence:true,
      activity:true,
      environment:env.APP_ENV
    });
  }
  if (path === '/api/grev-home/link/start' && request.method === 'POST') return linkStart(request, env);
  if (path === '/api/grev-home/link/status' && request.method === 'GET') return linkStatus(request, env);
  if (path === '/api/grev-home/link/request' && request.method === 'GET') return browserLinkRequest(request, env);
  if (path === '/api/grev-home/link/approve' && request.method === 'POST') return browserLinkDecision(request, env);

  const context = await getDeviceContext(request, env);
  if (!context) return json({ ok:false, message:'Grev Home link authentication required.' }, 401);

  if (path === '/api/grev-home/me' && request.method === 'GET') return deviceMe(request, env);
  if (path === '/api/grev-home/token/revoke' && request.method === 'POST') return revokeCurrentToken(request, env);
  if (path === '/api/grev-home/link/revoke' && request.method === 'POST') return revokeLink(request, env);
  if (path === '/api/grev-home/presence' && ['GET','PUT'].includes(request.method)) return devicePresence(request, env, context);
  if (path === '/api/grev-home/friends' && request.method === 'GET') return friendList(env, context);
  if (path === '/api/grev-home/friend-requests' && ['GET','POST'].includes(request.method)) return friendRequests(request, env, context);
  if (path === '/api/grev-home/users' && request.method === 'GET') return searchMembers(request, env, context);
  if (path === '/api/grev-home/activity' && ['GET','POST'].includes(request.method)) return activity(request, env, context);

  const friendRequestAction = path.match(/^\/api\/grev-home\/friend-requests\/([0-9a-f-]{36})\/(accept|decline)$/i);
  if (friendRequestAction && request.method === 'POST') return resolveFriendRequest(request, env, context, friendRequestAction[1]!, friendRequestAction[2]!.toLowerCase());
  const friendRequestCancel = path.match(/^\/api\/grev-home\/friend-requests\/([0-9a-f-]{36})$/i);
  if (friendRequestCancel && request.method === 'DELETE') return cancelFriendRequest(env, context, friendRequestCancel[1]!);
  const friendRemove = path.match(/^\/api\/grev-home\/friends\/([0-9a-f-]{36})$/i);
  if (friendRemove && request.method === 'DELETE') return removeFriend(env, context, friendRemove[1]!);

  return json({ ok:false, message:'Unknown Grev Home API route.' }, 404);
}
