import type { GrevHomeEnv } from './grev-home';

const encoder = new TextEncoder();
const API_VERSION = 1;

type DeviceContext = {
  linkId: string;
  grevId: string;
  userId: string;
};

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff',
      'Referrer-Policy':'same-origin',
      'X-Frame-Options':'DENY'
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

function cleanText(value: unknown, maximumLength: number): string {
  return String(value ?? '').trim().slice(0, maximumLength);
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (!(request.headers.get('Content-Type') ?? '').includes('application/json')) throw new Error('JSON_REQUIRED');
  const value: unknown = await request.json();
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_BODY');
  return value as Record<string, unknown>;
}

async function deviceContext(request: Request, env: GrevHomeEnv): Promise<DeviceContext | null> {
  const token = bearerToken(request);
  if (!token) return null;
  const current = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(`
    SELECT t.link_id,l.grev_id,l.user_id
    FROM grev_home_tokens t
    JOIN grev_home_links l ON l.id=t.link_id
    JOIN users u ON u.id=l.user_id
    WHERE t.token_hash=? AND t.revoked_at IS NULL AND t.expires_at>?
      AND l.revoked_at IS NULL AND u.status='active'
  `).bind(await sha256(token), current).first<{link_id:string;grev_id:string;user_id:string}>();
  return row ? { linkId:row.link_id, grevId:row.grev_id, userId:row.user_id } : null;
}

export async function handleGrevHomeLinkMetadataRequest(
  request: Request,
  env: GrevHomeEnv
): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (path !== '/api/grev-home/link/metadata') return null;
  if (request.method !== 'PUT') return json({ ok:false, message:'Method not allowed.' }, 405);

  const context = await deviceContext(request, env);
  if (!context) return json({ ok:false, message:'Grev Home link authentication required.' }, 401);

  const input = await readBody(request);
  const grevId = cleanText(input.grevId, 58);
  const localUsername = cleanText(input.localUsername, 50);
  const localDisplayName = cleanText(input.localDisplayName, 50);
  if (!grevId || grevId.toLowerCase() !== context.grevId.toLowerCase() || !localUsername || !localDisplayName) {
    return json({ ok:false, message:'The local Grev Home identity metadata is invalid.' }, 400);
  }

  const current = Math.floor(Date.now() / 1000);
  await env.DB.prepare(`
    UPDATE grev_home_links
       SET local_username=?,local_display_name=?,updated_at=?,last_seen_at=?
     WHERE id=? AND user_id=? AND grev_id=? COLLATE NOCASE AND revoked_at IS NULL
  `).bind(
    localUsername,
    localDisplayName,
    current,
    current,
    context.linkId,
    context.userId,
    context.grevId
  ).run();

  return json({
    ok:true,
    apiVersion:API_VERSION,
    link:{
      grevId:context.grevId,
      localUsername,
      localDisplayName
    }
  });
}
