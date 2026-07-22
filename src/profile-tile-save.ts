import { type ProfileEnv } from './profile';
import { handleProfileMediaRequest } from './profile-media';

const COOKIE = 'grev_session';
const encoder = new TextEncoder();

function secureJson(value: unknown, status = 200): Response {
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

function parseCookies(request: Request): Record<string, string> {
  return Object.fromEntries((request.headers.get('Cookie') ?? '')
    .split(';')
    .map(value => value.trim())
    .filter(Boolean)
    .map(value => {
      const index = value.indexOf('=');
      return index < 0 ? ['', ''] : [value.slice(0, index), decodeURIComponent(value.slice(index + 1))];
    })
    .filter(([key]) => Boolean(key)));
}

function b64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function sha256(value: string): Promise<string> {
  return b64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

async function currentUserId(request: Request, env: ProfileEnv): Promise<string | null> {
  const token = parseCookies(request)[COOKIE];
  if (!token) return null;
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(`
    SELECT u.id
    FROM sessions s
    JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.status='active'
  `).bind(await sha256(token), now).first<{ id: string }>();
  return row?.id ?? null;
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  return !origin || origin === new URL(request.url).origin;
}

function forwardedHeaders(request: Request): Headers {
  const headers = new Headers(request.headers);
  headers.delete('Content-Length');
  headers.set('Content-Type', 'application/json');
  return headers;
}

type ProfilePayload = {
  profile?: {
    card?: unknown;
  };
};

export async function handleProfileTileSaveRequest(request: Request, env: ProfileEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== '/api/profile/tiles' || request.method !== 'PUT') return null;
  if (!sameOrigin(request)) return secureJson({ ok: false, message: 'Origin rejected.' }, 403);

  const userId = await currentUserId(request, env);
  if (!userId) return secureJson({ ok: false, message: 'Authentication required.' }, 401);

  let incoming: Record<string, unknown>;
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_BODY');
    incoming = value as Record<string, unknown>;
  } catch {
    return secureJson({ ok: false, message: 'A valid JSON request body is required.' }, 400);
  }

  if (!Array.isArray(incoming.tiles) || !incoming.preferences || typeof incoming.preferences !== 'object' || Array.isArray(incoming.preferences)) {
    return secureJson({ ok: false, message: 'Choose a valid profile tile layout.' }, 400);
  }

  const currentUrl = new URL(`/api/profiles/${encodeURIComponent(userId)}`, request.url);
  const currentResponse = await handleProfileMediaRequest(new Request(currentUrl.toString(), {
    method: 'GET',
    headers: request.headers,
    redirect: request.redirect
  }), env);
  if (!currentResponse?.ok) return currentResponse ?? secureJson({ ok: false, message: 'The current profile could not be loaded.' }, 500);

  const currentPayload = await currentResponse.json() as ProfilePayload;
  if (!currentPayload.profile?.card) return secureJson({ ok: false, message: 'The current profile card could not be loaded.' }, 500);

  const saveBody = {
    card: currentPayload.profile.card,
    tiles: incoming.tiles,
    preferences: incoming.preferences
  };
  const saveUrl = new URL('/api/profile', request.url);
  const response = await handleProfileMediaRequest(new Request(saveUrl.toString(), {
    method: 'PUT',
    headers: forwardedHeaders(request),
    body: JSON.stringify(saveBody),
    redirect: request.redirect
  }), env);
  return response ?? secureJson({ ok: false, message: 'The profile tile save route is unavailable.' }, 500);
}
