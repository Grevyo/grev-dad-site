import { handleProfileRequest, type ProfileEnv } from './profile';

type ProfileMediaSlot = 'avatar' | 'cover';
type ProfileMediaRow = { media_slot: ProfileMediaSlot; media_data: string };
type ProfilePayload = {
  profile?: {
    id?: unknown;
    username?: string | null;
    isSelf?: boolean;
    card?: {
      avatarMedia?: string | null;
      coverMedia?: string | null;
      showUsername?: boolean;
    };
  };
};

const COOKIE = 'grev_session';
const encoder = new TextEncoder();
const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp|gif);base64,([a-z0-9+/]+={0,2})$/i;
const MAX_MEDIA_BYTES = 1_400_000;
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

async function profileUserId(request: Request, env: ProfileEnv): Promise<string | null> {
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
  const encoded = value.slice(value.indexOf(',') + 1);
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  return Math.floor(encoded.length * 3 / 4) - padding;
}

function validImageDataUrl(value: string): boolean {
  const match = value.match(IMAGE_DATA_URL);
  if (!match || !match[1] || !match[2] || dataUrlByteLength(value) > MAX_MEDIA_BYTES) return false;

  let binary = '';
  try {
    binary = atob(match[2].slice(0, 48));
  } catch {
    return false;
  }

  const bytes = Array.from(binary, character => character.charCodeAt(0));
  const mime = match[1].toLowerCase();
  if (mime === 'png') return bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10';
  if (mime === 'jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'gif') return binary.startsWith('GIF87a') || binary.startsWith('GIF89a');
  if (mime === 'webp') return binary.startsWith('RIFF') && binary.slice(8, 12) === 'WEBP';
  return false;
}

function optionalMedia(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !validImageDataUrl(value)) return undefined;
  return value;
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

async function injectStoredCardMedia(response: Response, env: ProfileEnv): Promise<Response> {
  if (!response.ok) return response;
  const payload = await response.json() as ProfilePayload;
  const profileId = typeof payload.profile?.id === 'string' ? payload.profile.id : null;
  if (!profileId || !payload.profile?.card) return responseWithPayload(response, payload);

  const rows = await env.DB.prepare(`
    SELECT media_slot,media_data
    FROM user_profile_media
    WHERE user_id=?
  `).bind(profileId).all<ProfileMediaRow>();
  const media = new Map(rows.results.map(row => [row.media_slot, row.media_data]));
  payload.profile.card.avatarMedia = media.get('avatar') ?? payload.profile.card.avatarMedia ?? null;
  payload.profile.card.coverMedia = media.get('cover') ?? payload.profile.card.coverMedia ?? null;
  if (!payload.profile.isSelf && payload.profile.card.showUsername === false) payload.profile.username = null;
  return responseWithPayload(response, payload);
}

async function saveProfileWithSeparateCardMedia(request: Request, env: ProfileEnv): Promise<Response> {
  let data: Record<string, unknown>;
  try {
    const value: unknown = await request.clone().json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return handleProfileRequest(request, env) as Promise<Response>;
    }
    data = value as Record<string, unknown>;
  } catch {
    return handleProfileRequest(request, env) as Promise<Response>;
  }

  const rawCard = data.card;
  const card = rawCard && typeof rawCard === 'object' && !Array.isArray(rawCard)
    ? rawCard as Record<string, unknown>
    : null;
  if (!card) return handleProfileRequest(request, env) as Promise<Response>;

  const avatarMedia = optionalMedia(card.avatarMedia);
  const coverMedia = optionalMedia(card.coverMedia);
  if (avatarMedia === undefined || coverMedia === undefined) {
    return secureJson({ ok: false, message: 'Choose valid PNG, JPEG, WebP or animated GIF profile pictures no larger than 1.4 MB each.' }, 400);
  }

  let totalMediaBytes = 0;
  for (const media of [avatarMedia, coverMedia]) {
    if (media) totalMediaBytes += dataUrlByteLength(media);
  }

  if (Array.isArray(data.tiles)) {
    for (const tileValue of data.tiles) {
      if (!tileValue || typeof tileValue !== 'object' || Array.isArray(tileValue)) continue;
      const tileMedia = (tileValue as Record<string, unknown>).backgroundMedia;
      if (typeof tileMedia === 'string' && tileMedia) {
        if (!validImageDataUrl(tileMedia)) {
          return secureJson({ ok: false, message: 'Choose valid PNG, JPEG, WebP or animated GIF tile pictures no larger than 1.4 MB each.' }, 400);
        }
        totalMediaBytes += dataUrlByteLength(tileMedia);
      }
    }
  }

  if (Array.isArray(data.cardTiles)) {
    for (const tileValue of data.cardTiles) {
      if (!tileValue || typeof tileValue !== 'object' || Array.isArray(tileValue)) continue;
      const tile = tileValue as Record<string, unknown>;
      for (const mediaValue of [tile.backgroundMedia, tile.iconMedia]) {
        if (typeof mediaValue !== 'string' || !mediaValue) continue;
        if (!validImageDataUrl(mediaValue)) {
          return secureJson({ ok: false, message: 'Choose valid PNG, JPEG, WebP or animated GIF card-tile pictures no larger than 1.4 MB each.' }, 400);
        }
        totalMediaBytes += dataUrlByteLength(mediaValue);
      }
    }
  } else {
    const userId = await profileUserId(request, env);
    if (userId) {
      const rows = await env.DB.prepare(`
        SELECT media_data
        FROM user_profile_card_tile_media
        WHERE user_id=?
      `).bind(userId).all<{ media_data: string }>();
      totalMediaBytes += rows.results.reduce((total, row) => total + dataUrlByteLength(row.media_data), 0);
    }
  }

  if (totalMediaBytes > MAX_PROFILE_MEDIA_BYTES) {
    return secureJson({ ok: false, message: 'Profile pictures and all profile tile media may use up to 8 MB in total.' }, 400);
  }

  const forwardedBody = {
    ...data,
    card: {
      ...card,
      avatarMedia: null,
      coverMedia: null
    }
  };
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.delete('Content-Length');
  forwardedHeaders.set('Content-Type', 'application/json');
  const forwardedRequest = new Request(request.url, {
    method: request.method,
    headers: forwardedHeaders,
    body: JSON.stringify(forwardedBody),
    redirect: request.redirect
  });

  const response = await handleProfileRequest(forwardedRequest, env);
  if (!response || !response.ok) return response ?? secureJson({ ok: false, message: 'Profile route unavailable.' }, 404);

  const payload = await response.json() as ProfilePayload;
  const profileId = typeof payload.profile?.id === 'string' ? payload.profile.id : null;
  if (!profileId || !payload.profile?.card) return responseWithPayload(response, payload);

  const now = Math.floor(Date.now() / 1000);
  const statements = [env.DB.prepare(`DELETE FROM user_profile_media WHERE user_id=?`).bind(profileId)];
  if (avatarMedia) {
    statements.push(env.DB.prepare(`
      INSERT INTO user_profile_media(user_id,media_slot,media_data,updated_at)
      VALUES(?,'avatar',?,?)
    `).bind(profileId, avatarMedia, now));
  }
  if (coverMedia) {
    statements.push(env.DB.prepare(`
      INSERT INTO user_profile_media(user_id,media_slot,media_data,updated_at)
      VALUES(?,'cover',?,?)
    `).bind(profileId, coverMedia, now));
  }
  await env.DB.batch(statements);

  payload.profile.card.avatarMedia = avatarMedia;
  payload.profile.card.coverMedia = coverMedia;
  return responseWithPayload(response, payload);
}

export async function handleProfileMediaRequest(request: Request, env: ProfileEnv): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (path === '/api/profile' && request.method === 'PUT') {
    return saveProfileWithSeparateCardMedia(request, env);
  }
  if (/^\/api\/profiles\/[^/]+$/.test(path) && request.method === 'GET') {
    const response = await handleProfileRequest(request, env);
    return response ? injectStoredCardMedia(response, env) : null;
  }
  return null;
}
