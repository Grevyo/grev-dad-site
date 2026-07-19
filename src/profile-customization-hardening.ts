import { type ProfileEnv } from './profile';
import { handleProfileCardTilesRequest } from './profile-card-tiles';
import { handleProfileCustomizationRequest } from './profile-customization';

type ProfilePayload = {
  profile?: {
    id?: unknown;
    cardTiles?: unknown[];
    design?: { avatarSize?: number };
  };
};

const COOKIE = 'grev_session';
const encoder = new TextEncoder();
const MAX_PROFILE_MEDIA_BYTES = 8 * 1024 * 1024;

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

function responseWithPayload(response: Response, payload: unknown): Response {
  const headers = new Headers(response.headers);
  headers.delete('Content-Length');
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(payload), {
    status: response.status,
    statusText: response.statusText,
    headers
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

function dataUrlByteLength(value: string): number {
  const comma = value.indexOf(',');
  if (comma < 0) return 0;
  const encoded = value.slice(comma + 1);
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor(encoded.length * 3 / 4) - padding);
}

function mediaBytes(value: unknown): number {
  return typeof value === 'string' && value ? dataUrlByteLength(value) : 0;
}

async function storedPageMediaBytes(env: ProfileEnv, userId: string): Promise<number> {
  const row = await env.DB.prepare(`
    SELECT media_data
    FROM user_profile_design_media
    WHERE user_id=? AND media_slot='page_background'
  `).bind(userId).first<{ media_data: string }>();
  return row?.media_data ? dataUrlByteLength(row.media_data) : 0;
}

async function completeMediaBytesWithoutDesign(body: Record<string, unknown>, env: ProfileEnv, userId: string): Promise<number> {
  let total = await storedPageMediaBytes(env, userId);
  const card = body.card && typeof body.card === 'object' && !Array.isArray(body.card)
    ? body.card as Record<string, unknown>
    : null;
  if (card) total += mediaBytes(card.avatarMedia) + mediaBytes(card.coverMedia);

  if (Array.isArray(body.tiles)) {
    for (const value of body.tiles) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
      total += mediaBytes((value as Record<string, unknown>).backgroundMedia);
    }
  }

  if (Array.isArray(body.cardTiles)) {
    for (const value of body.cardTiles) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
      const tile = value as Record<string, unknown>;
      total += mediaBytes(tile.backgroundMedia) + mediaBytes(tile.iconMedia);
    }
  } else {
    const rows = await env.DB.prepare(`
      SELECT media_data
      FROM user_profile_card_tile_media
      WHERE user_id=?
    `).bind(userId).all<{ media_data: string }>();
    total += rows.results.reduce((sum, row) => sum + dataUrlByteLength(row.media_data), 0);
  }
  return total;
}

async function storedCardTiles(request: Request, env: ProfileEnv, userId: string): Promise<unknown[] | null> {
  const headers = new Headers(request.headers);
  headers.delete('Content-Length');
  headers.delete('Content-Type');
  const url = new URL(`/api/profiles/${encodeURIComponent(userId)}`, request.url);
  const response = await handleProfileCardTilesRequest(new Request(url.toString(), {
    method: 'GET',
    headers,
    redirect: request.redirect
  }), env);
  if (!response?.ok) return null;
  const payload = await response.json() as ProfilePayload;
  return Array.isArray(payload.profile?.cardTiles) ? payload.profile.cardTiles : null;
}

export async function handleProfileCustomizationHardeningRequest(request: Request, env: ProfileEnv): Promise<Response | null> {
  const path = new URL(request.url).pathname;

  if (path === '/api/profile-card-tiles' && request.method === 'PUT') {
    const userId = await currentUserId(request, env);
    if (!userId) return null;
    let body: Record<string, unknown>;
    try {
      const value: unknown = await request.clone().json();
      body = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
    } catch {
      return null;
    }
    const total = await completeMediaBytesWithoutDesign({ cardTiles: body.tiles }, env, userId);
    if (total > MAX_PROFILE_MEDIA_BYTES) {
      return secureJson({ ok: false, message: 'Profile pictures, page background and all profile tile media may use up to 8 MB in total.' }, 400);
    }
    return null;
  }

  if (path !== '/api/profile' || request.method !== 'PUT') {
    return handleProfileCustomizationRequest(request, env);
  }

  let body: Record<string, unknown>;
  try {
    const value: unknown = await request.clone().json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return handleProfileCustomizationRequest(request, env);
    }
    body = value as Record<string, unknown>;
  } catch {
    return handleProfileCustomizationRequest(request, env);
  }

  const rawDesign = body.design;
  const hasDesign = rawDesign && typeof rawDesign === 'object' && !Array.isArray(rawDesign);
  const userId = await currentUserId(request, env);

  if (!hasDesign) {
    if (userId) {
      const total = await completeMediaBytesWithoutDesign(body, env, userId);
      if (total > MAX_PROFILE_MEDIA_BYTES) {
        return secureJson({ ok: false, message: 'Profile pictures, page background and all profile tile media may use up to 8 MB in total.' }, 400);
      }
    }
    return handleProfileCustomizationRequest(request, env);
  }

  if (!userId) return handleProfileCustomizationRequest(request, env);
  if (!Object.prototype.hasOwnProperty.call(body, 'cardTiles')) {
    const cardTiles = await storedCardTiles(request, env, userId);
    if (!cardTiles) return secureJson({ ok: false, message: 'The existing profile-card tiles could not be loaded for this save.' }, 500);
    body = { ...body, cardTiles };
  }

  const design = rawDesign as Record<string, unknown>;
  const usesDefaultAvatarSize = Number(design.avatarSize) === 132;
  if (usesDefaultAvatarSize) {
    body = { ...body, design: { ...design, avatarSize: 120 } };
  }

  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.delete('Content-Length');
  forwardedHeaders.set('Content-Type', 'application/json');
  const forwardedRequest = new Request(request.url, {
    method: request.method,
    headers: forwardedHeaders,
    body: JSON.stringify(body),
    redirect: request.redirect
  });

  const response = await handleProfileCustomizationRequest(forwardedRequest, env);
  if (!response || !response.ok || !usesDefaultAvatarSize) return response;
  const payload = await response.json() as ProfilePayload;
  const profileId = typeof payload.profile?.id === 'string' ? payload.profile.id : null;
  if (!profileId) return responseWithPayload(response, payload);

  await env.DB.prepare(`UPDATE user_profile_design SET avatar_size=132 WHERE user_id=?`).bind(profileId).run();
  if (payload.profile?.design) payload.profile.design.avatarSize = 132;
  return responseWithPayload(response, payload);
}
