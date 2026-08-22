import type { GrevHomeEnv } from './grev-home';

const encoder = new TextEncoder();
const API_VERSION = 1;
const DEVICE_TOKEN_LIFETIME_SECONDS = 90 * 24 * 60 * 60;
const ROTATION_OVERLAP_SECONDS = 24 * 60 * 60;

type DeviceContext = {
  tokenId: string;
  linkId: string;
  deviceName: string;
};

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

function randomSecret(bytes = 32): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

async function getDeviceContext(request: Request, env: GrevHomeEnv): Promise<DeviceContext | null> {
  const token = bearerToken(request);
  if (!token) return null;
  const current = now();
  const row = await env.DB.prepare(`
    SELECT t.id AS token_id,t.link_id,t.device_name
    FROM grev_home_tokens t
    JOIN grev_home_links l ON l.id=t.link_id
    JOIN users u ON u.id=l.user_id
    WHERE t.token_hash=? AND t.revoked_at IS NULL AND t.expires_at>?
      AND l.revoked_at IS NULL AND u.status='active'
  `).bind(await sha256(token), current).first<{
    token_id:string;link_id:string;device_name:string;
  }>();
  return row ? { tokenId:row.token_id, linkId:row.link_id, deviceName:row.device_name } : null;
}

export async function handleGrevHomeTokenLifecycleRequest(
  request: Request,
  env: GrevHomeEnv
): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (path !== '/api/grev-home/token/rotate') return null;
  if (request.method !== 'POST') return json({ ok:false, message:'Method not allowed.' }, 405);

  const context = await getDeviceContext(request, env);
  if (!context) return json({ ok:false, message:'Grev Home link authentication required.' }, 401);

  const current = now();
  const accessToken = randomSecret();
  const tokenId = crypto.randomUUID();
  const tokenExpiresAt = current + DEVICE_TOKEN_LIFETIME_SECONDS;
  const previousTokenValidUntil = current + ROTATION_OVERLAP_SECONDS;

  // Do not revoke the previous credential immediately. If the HTTP response is lost, the client
  // keeps one day to retry using the old token instead of being forced through a manual relink.
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE grev_home_tokens
         SET expires_at=MIN(expires_at,?)
       WHERE id=? AND revoked_at IS NULL AND expires_at>?
    `).bind(previousTokenValidUntil, context.tokenId, current),
    env.DB.prepare(`
      INSERT INTO grev_home_tokens(id,link_id,link_request_id,token_hash,device_name,created_at,expires_at)
      VALUES(?,?,NULL,?,?,?,?)
    `).bind(
      tokenId,
      context.linkId,
      await sha256(accessToken),
      context.deviceName,
      current,
      tokenExpiresAt
    )
  ]);

  return json({
    ok:true,
    apiVersion:API_VERSION,
    accessToken,
    tokenType:'Bearer',
    tokenExpiresAt,
    previousTokenValidUntil
  }, 201);
}
