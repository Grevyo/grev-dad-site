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
  sourceGrevId: string;
  userId: string;
};

type SessionInput = {
  sessionId: string;
  sequence: number;
  appId: string;
  appName: string;
  contentId: string | null;
  contentName: string | null;
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
const SAFE_CONTENT_ID_RE = /^[A-Za-z0-9._:+-]{1,160}$/;
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

function optionalText(value: unknown, maximumLength: number): string | null {
  if (value === null || value === undefined) return null;
  const cleaned = cleanText(value, maximumLength);
  return cleaned || null;
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
    SELECT t.id AS token_id,t.link_id,l.grev_id,l.user_id,COALESCE(t.local_grev_id,l.grev_id) AS source_grev_id
    FROM grev_home_tokens t
    JOIN grev_home_links l ON l.id=t.link_id
    JOIN users u ON u.id=l.user_id
    WHERE t.token_hash=? AND t.revoked_at IS NULL AND t.expires_at>?
      AND l.revoked_at IS NULL AND u.status='active'
  `).bind(await sha256(token), current).first<{
    token_id:string;link_id:string;grev_id:string;user_id:string;source_grev_id:string;
  }>();
  if (!row) return null;

  await env.DB.batch([
    env.DB.prepare(`UPDATE grev_home_tokens SET last_used_at=? WHERE id=?`).bind(current, row.token_id),
    env.DB.prepare(`UPDATE grev_home_links SET last_seen_at=?,updated_at=? WHERE id=?`).bind(current, current, row.link_id)
  ]);

  return { tokenId:row.token_id, linkId:row.link_id, grevId:row.grev_id, sourceGrevId:row.source_grev_id, userId:row.user_id };
}

type AppStat = { appId:string; appName:string; totalSeconds:number; sessionCount:number; lastPlayedAt:number };

function parseApps(value:unknown): AppStat[] | null {
  if (!Array.isArray(value) || value.length > 10000) return null;
  const ids = new Set<string>();
  const apps:AppStat[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const id = cleanText(item.appId,80);
    const seconds = safeInteger(item.totalSeconds,0,Number.MAX_SAFE_INTEGER / 10000);
    const count = safeInteger(item.sessionCount,0,10000000);
    const played = safeInteger(item.lastPlayedAt,1,now()+300);
    const name = cleanText(item.appName,120);
    if (!SAFE_APP_ID_RE.test(id) || ids.has(id.toLowerCase()) || !name || seconds===null || count===null || played===null) return null;
    ids.add(id.toLowerCase());
    apps.push({appId:id,appName:name,totalSeconds:seconds,sessionCount:count,lastPlayedAt:played});
  }
  return apps;
}

function homeLevel(xp:number):number {
  let level=1;
  while (level<999 && xp>=250+(level-1)*150) { xp-=250+(level-1)*150; level++; }
  return level;
}

async function accountData(env:GrevHomeSyncEnv, context:DeviceContext):Promise<Response> {
  const user = await env.DB.prepare(`SELECT id,username,display_name,created_at FROM users WHERE id=?`)
    .bind(context.userId).first<{id:string;username:string;display_name:string;created_at:number}>();
  const sources = await env.DB.prepare(`SELECT grev_id,profile_created_at,total_seconds,completed_sessions,unique_apps,apps_json,updated_at
    FROM grev_home_profile_sources WHERE user_id=? ORDER BY grev_id`)
    .bind(context.userId).all<{grev_id:string;profile_created_at:number|null;total_seconds:number;completed_sessions:number;unique_apps:number;apps_json:string;updated_at:number}>();
  return json({ok:true,apiVersion:API_VERSION,userId:context.userId,username:user?.username,displayName:user?.display_name,
    accountCreatedAt:user?.created_at,downloadedAt:now(),
    sources:sources.results.map(s=>({grevId:s.grev_id,profileCreatedAt:s.profile_created_at,totalSeconds:s.total_seconds,
      completedSessions:s.completed_sessions,uniqueApps:s.unique_apps,apps:JSON.parse(s.apps_json),updatedAt:s.updated_at}))});
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
  const contentId = optionalText(input.contentId, 160);
  const contentName = optionalText(input.contentName, 200);
  const startedAt = safeInteger(input.startedAt, 1);
  const endedAt = safeInteger(input.endedAt, 1);
  const durationSeconds = safeInteger(input.durationSeconds, 0, MAX_SESSION_SECONDS);
  const outcome = String(input.outcome ?? '').toLowerCase();
  const visibility = String(input.visibility ?? 'friends').toLowerCase();
  const failureMessage = input.failureMessage === null || input.failureMessage === undefined
    ? null
    : cleanText(input.failureMessage, 500);

  if (!UUID_RE.test(sessionId) || sequence === null || !SAFE_APP_ID_RE.test(appId) || !appName ||
      (contentId !== null && !SAFE_CONTENT_ID_RE.test(contentId)) ||
      startedAt === null || endedAt === null || endedAt < startedAt || durationSeconds === null ||
      !['exited','failed'].includes(outcome) || !['friends','private'].includes(visibility)) {
    return null;
  }

  const elapsed = endedAt - startedAt;
  if (Math.abs(elapsed - durationSeconds) > 5) return null;

  return {
    sessionId,
    sequence,
    appId,
    appName,
    contentId,
    contentName,
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
  const apps = input.apps === undefined ? undefined : parseApps(input.apps);
  const profileCreatedAt = input.profileCreatedAt === undefined ? null : safeInteger(input.profileCreatedAt,1,now()+300);
  if (apps === null || (input.profileCreatedAt !== undefined && profileCreatedAt === null)) return json({ok:false,message:'Invalid account statistics.'},400);
  const rawSessions = Array.isArray(input.sessions) ? input.sessions : [];
  if (!progression) return json({ ok:false, message:'The Grev Home progression snapshot is invalid.' }, 400);
  if (apps && (apps.reduce((n,a)=>n+a.totalSeconds,0)!==progression.totalTrackedSeconds ||
    apps.reduce((n,a)=>n+a.sessionCount,0)!==progression.completedSessions || apps.length!==progression.uniqueApps))
    return json({ok:false,message:'App statistics do not match the local totals.'},400);
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

    if (session.contentId !== null || session.contentName !== null) {
      statements.push(env.DB.prepare(`
        INSERT OR IGNORE INTO grev_home_session_content(link_id,session_id,content_id,content_name,created_at)
        VALUES(?,?,?,?,?)
      `).bind(context.linkId, session.sessionId, session.contentId, session.contentName, current));
    }
  }

  // Snapshots contain this installation's local data only, never downloaded totals.
  // Older clients still update their own source's high-water marks.
  statements.push(env.DB.prepare(`
    INSERT INTO grev_home_profile_sources(grev_id,user_id,profile_created_at,total_seconds,completed_sessions,unique_apps,apps_json,updated_at)
    VALUES(?,?,?,?,?,?,?,?)
    ON CONFLICT(grev_id) DO UPDATE SET
      profile_created_at=CASE WHEN excluded.profile_created_at IS NULL THEN profile_created_at
        WHEN profile_created_at IS NULL THEN excluded.profile_created_at ELSE MIN(profile_created_at,excluded.profile_created_at) END,
      apps_json=CASE WHEN excluded.total_seconds>=total_seconds AND excluded.completed_sessions>=completed_sessions AND ?=1
        THEN excluded.apps_json ELSE apps_json END,
      total_seconds=MAX(total_seconds,excluded.total_seconds),
      completed_sessions=MAX(completed_sessions,excluded.completed_sessions),
      unique_apps=MAX(unique_apps,excluded.unique_apps),updated_at=excluded.updated_at
    WHERE user_id=excluded.user_id
  `).bind(context.sourceGrevId,context.userId,profileCreatedAt,progression.totalTrackedSeconds,
    progression.completedSessions,progression.uniqueApps,JSON.stringify(apps ?? []),current,apps ? 1 : 0));

  statements.push(env.DB.prepare(`
    INSERT INTO grev_home_progression_state(
      grev_id,link_id,user_id,home_total_xp,home_level,total_tracked_seconds,completed_sessions,unique_apps,updated_at
    ) SELECT ?,?,?,CAST(total_seconds/60 AS INTEGER)+completed_sessions*20+unique_apps*100,
      1,total_seconds,completed_sessions,unique_apps,?
      FROM (SELECT SUM(total_seconds) AS total_seconds,SUM(completed_sessions) AS completed_sessions,
        MAX(MAX(unique_apps),(SELECT COUNT(DISTINCT lower(json_extract(value,'$.appId')))
          FROM grev_home_profile_sources,json_each(apps_json) WHERE user_id=?)) AS unique_apps
        FROM grev_home_profile_sources WHERE user_id=?) WHERE total_seconds IS NOT NULL
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
    current,
    context.userId,
    context.userId
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
      level:homeLevel(Number(home?.home_total_xp ?? 0)),
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
    SELECT h.session_id,h.app_id,h.app_name,c.content_id,c.content_name,h.started_at,h.ended_at,h.duration_seconds,
           h.outcome,h.failure_message,h.client_sequence,h.visibility
    FROM grev_home_session_history h
    LEFT JOIN grev_home_session_content c ON c.link_id=h.link_id AND c.session_id=h.session_id
    WHERE h.user_id=?
    ORDER BY h.ended_at DESC,h.created_at DESC
    LIMIT ?
  `).bind(context.userId, limit).all<{
    session_id:string;app_id:string;app_name:string;content_id:string|null;content_name:string|null;
    started_at:number;ended_at:number;duration_seconds:number;outcome:string;failure_message:string|null;
    client_sequence:number;visibility:string;
  }>();
  return json({
    ok:true,
    sessions:rows.results.map(row => ({
      sessionId:row.session_id,
      appId:row.app_id,
      appName:row.app_name,
      contentId:row.content_id,
      contentName:row.content_name,
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

  if (path !== '/api/grev-home/sync' && path !== '/api/grev-home/history' && path !== '/api/grev-home/account-data') return null;
  const context = await getDeviceContext(request, env);
  if (!context) return json({ ok:false, message:'Grev Home link authentication required.' }, 401);
  if (path === '/api/grev-home/account-data' && request.method === 'GET') return accountData(env,context);

  if (path === '/api/grev-home/sync' && request.method === 'POST') return syncProfile(request, env, context);
  if (path === '/api/grev-home/history' && request.method === 'GET') return history(request, env, context);
  return json({ ok:false, message:'Method not allowed.' }, 405);
}
