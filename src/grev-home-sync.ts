interface D1Result<T> { results: T[]; }
interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<unknown>;
}
interface D1Database {
  prepare(query: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown[]>;
}

export interface GrevHomeSyncEnv {
  DB: D1Database;
  APP_ENV: 'development' | 'pbe' | 'production';
}

type DeviceContext = {
  tokenId: string;
  linkId: string;
  grevId: string;
  userId: string;
};

type SessionInput = {
  sessionId: string;
  sequence: number;
  appId: string;
  appName: string;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
  outcome: 'exited'|'failed';
  failureMessage: string | null;
  visibility: 'friends'|'private';
};

type ProgressionInput = {
  totalXp: number;
  level: number;
  totalTrackedSeconds: number;
  completedSessions: number;
  uniqueApps: number;
};

const encoder = new TextEncoder();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_APP_ID_RE = /^[A-Za-z0-9._-]{1,80}$/;
const MAX_SESSION_BATCH = 100;
const MAX_SESSION_SECONDS = 31 * 24 * 60 * 60;
const API_VERSION = 1;

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function sha256(value: string): Promise<string> {
  return base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get('Authorization') ?? '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff',
      'Referrer-Policy':'same-origin',
      'X-Frame-Options':'DENY',
      'Permissions-Policy':'camera=(), microphone=(), geolocation=()'
    }
  });
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (!(request.headers.get('Content-Type') ?? '').includes('application/json')) throw new Error('JSON_REQUIRED');
  const value: unknown = await request.json();
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_BODY');
  return value as Record<string, unknown>;
}

function now(): number { return Math.floor(Date.now() / 1000); }

function cleanText(value: unknown, maximumLength: number): string {
  return String(value ?? '').trim().slice(0, maximumLength);
}

function safeInteger(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number | null {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= minimum && number <= maximum ? number : null;
}

async function getDeviceContext(request: Request, env: GrevHomeSyncEnv): Promise<DeviceContext | null> {
  const token = bearerToken(request);
  if (!token) return null;
  const current = now();
  const row = await env.DB.prepare(`
    SELECT t.id AS token_id,t.link_id,l.grev_id,l.user_id
    FROM grev_home_tokens t
    JOIN grev_home_links l ON l.id=t.link_id
    JOIN users u ON u.id=l.user_id
    WHERE t.token_hash=? AND t.revoked_at IS NULL AND t.expires_at>?
      AND l.revoked_at IS NULL AND u.status='active'
  `).bind(await sha256(token), current).first<{
    token_id:string;link_id:string;grev_id:string;user_id:string;
  }>();
  if (!row) return null;

  await env.DB.batch([
    env.DB.prepare(`UPDATE grev_home_tokens SET last_used_at=? WHERE id=?`).bind(current, row.token_id),
    env.DB.prepare(`UPDATE grev_home_links SET last_seen_at=?,updated_at=? WHERE id=?`).bind(current, current, row.link_id)
  ]);

  return { tokenId:row.token_id, linkId:row.link_id, grevId:row.grev_id, userId:row.user_id };
}

function parseProgression(value: unknown): ProgressionInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const totalXp = safeInteger(input.totalXp);
  const level = safeInteger(input.level, 1, 999);
  const totalTrackedSeconds = safeInteger(input.totalTrackedSeconds);
  const completedSessions = safeInteger(input.completedSessions, 0, 10_000_000);
  const uniqueApps = safeInteger(input.uniqueApps, 0, 100_000);
  if (totalXp === null || level === null || totalTrackedSeconds === null || completedSessions === null || uniqueApps === null) return null;
  return { totalXp, level, totalTrackedSeconds, completedSessions, uniqueApps };
}

function parseSession(value: unknown): SessionInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const sessionId = cleanText(input.sessionId, 36);
  const sequence = safeInteger(input.sequence, 1);
  const appId = cleanText(input.appId, 80);
  const appName = cleanText(input.appName, 120);
  const startedAt = safeInteger(input.startedAt, 1);
  const endedAt = safeInteger(input.endedAt, 1);
  const durationSeconds = safeInteger(input.durationSeconds, 0, MAX_SESSION_SECONDS);
  const outcome = String(input.outcome ?? '').toLowerCase();
  const visibility = String(input.visibility ?? 'friends').toLowerCase();
  const failureMessage = input.failureMessage === null || input.failureMessage === undefined
    ? null
    : cleanText(input.failureMessage, 500);

  if (!UUID_RE.test(sessionId) || sequence === null || !SAFE_APP_ID_RE.test(appId) || !appName ||
      startedAt === null || endedAt === null || endedAt < startedAt || durationSeconds === null ||
      !['exited','failed'].includes(outcome) || !['friends','private'].includes(visibility)) {
    return null;
  }

  // Duration is recorded by Grev Home and may differ by a second because of rounding, but it
  // should remain close to the supplied timestamps. Reject obviously malformed history rows.
  const elapsed = endedAt - startedAt;
  if (Math.abs(elapsed - durationSeconds) > 5) return null;

  return {
    sessionId,
    sequence,
    appId,
    appName,
    startedAt,
    endedAt,
    durationSeconds,
    outcome: outcome as 'exited'|'failed',
    failureMessage,
    visibility: visibility as 'friends'|'private'
  };
}

async function syncProfile(request: Request, env: GrevHomeSyncEnv, context: DeviceContext): Promise<Response> {
  const input = await readBody(request);
  const progression = parseProgression(input.progression);
  const rawSessions = Array.isArray(input.sessions) ? input.sessions : [];
  if (!progression) return json({ ok:false, message:'The Grev Home progression snapshot is invalid.' }, 400);
  if (rawSessions.length > MAX_SESSION_BATCH) return json({ ok:false, message:`Upload at most ${MAX_SESSION_BATCH} sessions per sync batch.` }, 400);

  const sessions: SessionInput[] = [];
  for (const raw of rawSessions) {
    const parsed = parseSession(raw);
    if (!parsed) return json({ ok:false, message:'One or more Grev Home history records are invalid.' }, 400);
    sessions.push(parsed);
  }

  sessions.sort((left, right) => left.sequence - right.sequence);
  const current = now();
  const statements: D1Statement[] = [
    env.DB.prepare(`INSERT OR IGNORE INTO user_progression(user_id,total_xp,level,updated_at) VALUES(?,0,1,?)`)
      .bind(context.userId, current)
  ];

  for (const session of sessions) {
    statements.push(env.DB.prepare(`
      INSERT OR IGNORE INTO grev_home_session_history(
        link_id,session_id,user_id,app_id,app_name,started_at,ended_at,duration_seconds,outcome,
        failure_message,client_sequence,visibility,created_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      context.linkId,
      session.sessionId,
      context.userId,
      session.appId,
      session.appName,
      session.startedAt,
      session.endedAt,
      session.durationSeconds,
      session.outcome,
      session.failureMessage,
      session.sequence,
      session.visibility,
      current
    ));
  }

  statements.push(env.DB.prepare(`
    INSERT INTO grev_home_progression_state(
      grev_id,link_id,user_id,home_total_xp,home_level,total_tracked_seconds,completed_sessions,unique_apps,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?)
    ON CONFLICT(grev_id) DO UPDATE SET
      link_id=excluded.link_id,
      user_id=excluded.user_id,
      home_level=CASE WHEN excluded.home_total_xp>=grev_home_progression_state.home_total_xp THEN excluded.home_level ELSE grev_home_progression_state.home_level END,
      total_tracked_seconds=MAX(grev_home_progression_state.total_tracked_seconds,excluded.total_tracked_seconds),
      completed_sessions=MAX(grev_home_progression_state.completed_sessions,excluded.completed_sessions),
      unique_apps=MAX(grev_home_progression_state.unique_apps,excluded.unique_apps),
      home_total_xp=MAX(grev_home_progression_state.home_total_xp,excluded.home_total_xp),
      updated_at=excluded.updated_at
  `).bind(
    context.grevId,
    context.linkId,
    context.userId,
    progression.totalXp,
    progression.level,
    progression.totalTrackedSeconds,
    progression.completedSessions,
    progression.uniqueApps,
    current
  ));

  await env.DB.batch(statements);

  const [home, combined] = await Promise.all([
    env.DB.prepare(`SELECT home_total_xp,home_level,total_tracked_seconds,completed_sessions,unique_apps,updated_at FROM grev_home_progression_state WHERE grev_id=? COLLATE NOCASE`)
      .bind(context.grevId).first<{home_total_xp:number;home_level:number;total_tracked_seconds:number;completed_sessions:number;unique_apps:number;updated_at:number}>(),
    env.DB.prepare(`SELECT total_xp,level,updated_at FROM user_progression WHERE user_id=?`)
      .bind(context.userId).first<{total_xp:number;level:number;updated_at:number}>()
  ]);

  return json({
    ok:true,
    apiVersion:API_VERSION,
    acceptedThroughSequence:sessions.length ? Math.max(...sessions.map(session => session.sequence)) : null,
    grevHome:{
      totalXp:Number(home?.home_total_xp ?? 0),
      level:Number(home?.home_level ?? 1),
      totalTrackedSeconds:Number(home?.total_tracked_seconds ?? 0),
      completedSessions:Number(home?.completed_sessions ?? 0),
      uniqueApps:Number(home?.unique_apps ?? 0),
      updatedAt:home?.updated_at ?? null
    },
    grevDad:{
      totalXp:Number(combined?.total_xp ?? 0),
      level:Number(combined?.level ?? 1),
      updatedAt:combined?.updated_at ?? null
    }
  });
}

async function history(request: Request, env: GrevHomeSyncEnv, context: DeviceContext): Promise<Response> {
  const requested = Number(new URL(request.url).searchParams.get('limit') ?? 100);
  const limit = Math.max(1, Math.min(250, Number.isFinite(requested) ? Math.floor(requested) : 100));
  const rows = await env.DB.prepare(`
    SELECT session_id,app_id,app_name,started_at,ended_at,duration_seconds,outcome,failure_message,client_sequence,visibility
    FROM grev_home_session_history
    WHERE user_id=?
    ORDER BY ended_at DESC,created_at DESC
    LIMIT ?
  `).bind(context.userId, limit).all<{
    session_id:string;app_id:string;app_name:string;started_at:number;ended_at:number;duration_seconds:number;
    outcome:string;failure_message:string|null;client_sequence:number;visibility:string;
  }>();
  return json({
    ok:true,
    sessions:rows.results.map(row => ({
      sessionId:row.session_id,
      appId:row.app_id,
      appName:row.app_name,
      startedAt:row.started_at,
      endedAt:row.ended_at,
      durationSeconds:row.duration_seconds,
      outcome:row.outcome,
      failureMessage:row.failure_message,
      sequence:row.client_sequence,
      visibility:row.visibility
    }))
  });
}

export async function handleGrevHomeSyncRequest(request: Request, env: GrevHomeSyncEnv): Promise<Response | null> {
  const path = new URL(request.url).pathname;

  if (path === '/api/grev-home/capabilities' && request.method === 'GET') {
    return json({
      ok:true,
      apiVersion:API_VERSION,
      linking:true,
      friends:true,
      presence:true,
      activity:true,
      sessionHistory:true,
      progressionSync:true,
      optional:true,
      environment:env.APP_ENV
    });
  }

  if (path !== '/api/grev-home/sync' && path !== '/api/grev-home/history') return null;
  const context = await getDeviceContext(request, env);
  if (!context) return json({ ok:false, message:'Grev Home link authentication required.' }, 401);

  if (path === '/api/grev-home/sync' && request.method === 'POST') return syncProfile(request, env, context);
  if (path === '/api/grev-home/history' && request.method === 'GET') return history(request, env, context);
  return json({ ok:false, message:'Method not allowed.' }, 405);
}
