import { type ProfileEnv } from './profile';

interface D1Result<T> { results: T[]; }

type Viewer = { id: string; isVerified: boolean; isAdmin: boolean };
type PrivacyRow = { key: string; visibility: 'all' | 'verified' | 'groups' | 'private'; group_id: string | null };

const COOKIE = 'grev_session';
const encoder = new TextEncoder();

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
    .filter(([key]) => Boolean(key)));
}

async function getViewer(request: Request, env: ProfileEnv): Promise<Viewer | null> {
  const token = parseCookies(request)[COOKIE];
  if (!token) return null;
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(`
    SELECT u.id,u.is_verified,
      CASE WHEN u.is_owner=1 OR EXISTS(
        SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role_id='role-admin'
      ) THEN 1 ELSE 0 END AS is_admin
    FROM sessions s
    JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.status='active'
  `).bind(await sha256(token), now).first<{ id: string; is_verified: number; is_admin: number }>();
  return row ? { id: row.id, isVerified: Boolean(row.is_verified), isAdmin: Boolean(row.is_admin) } : null;
}

function canView(row: PrivacyRow | undefined, isSelf: boolean, viewer: Viewer, groupIds: Set<string>): boolean {
  if (isSelf || viewer.isAdmin || !row || row.visibility === 'all') return true;
  if (row.visibility === 'private') return false;
  if (row.visibility === 'verified') return viewer.isVerified;
  return Boolean(row.group_id && groupIds.has(row.group_id));
}

function responseWithPayload(response: Response, payload: unknown): Response {
  const headers = new Headers(response.headers);
  headers.delete('Content-Length');
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(payload), { status: response.status, statusText: response.statusText, headers });
}

export async function applyProfilePrivacy(request: Request, env: ProfileEnv, response: Response): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (!response.ok || request.method !== 'GET' || !/^\/api\/profiles\/[^/]+$/.test(path)) return response;
  const viewer = await getViewer(request, env);
  if (!viewer) return response;

  let payload: { profile?: Record<string, unknown> };
  try {
    payload = await response.json() as { profile?: Record<string, unknown> };
  } catch {
    return response;
  }
  const profile = payload.profile;
  const profileId = typeof profile?.id === 'string' ? profile.id : null;
  if (!profile || !profileId) return responseWithPayload(response, payload);
  const isSelf = viewer.id === profileId;

  const [fieldRows, tileRows, groupRows] = await Promise.all([
    env.DB.prepare(`SELECT field_key AS key,visibility,group_id FROM user_profile_field_privacy WHERE user_id=?`)
      .bind(profileId).all<PrivacyRow>(),
    env.DB.prepare(`SELECT tile_id AS key,visibility,group_id FROM user_profile_tile_privacy WHERE user_id=?`)
      .bind(profileId).all<PrivacyRow>(),
    env.DB.prepare(`
      SELECT owner.group_id
      FROM group_memberships owner
      JOIN group_memberships viewer ON viewer.group_id=owner.group_id
      WHERE owner.user_id=? AND viewer.user_id=?
    `).bind(profileId, viewer.id).all<{ group_id: string }>()
  ]);
  const fields = new Map(fieldRows.results.map(row => [row.key, row]));
  const tiles = new Map(tileRows.results.map(row => [row.key, row]));
  const sharedGroups = new Set(groupRows.results.map(row => row.group_id));
  const card = profile.card && typeof profile.card === 'object' && !Array.isArray(profile.card)
    ? profile.card as Record<string, unknown>
    : null;
  const design = profile.design && typeof profile.design === 'object' && !Array.isArray(profile.design)
    ? profile.design as Record<string, unknown>
    : null;

  if (card) {
    if (!canView(fields.get('headline'), isSelf, viewer, sharedGroups)) { card.headline = null; if (design) design.showHeadline = false; }
    if (!canView(fields.get('bio'), isSelf, viewer, sharedGroups)) { card.bio = null; if (design) design.showBio = false; }
    if (!canView(fields.get('location'), isSelf, viewer, sharedGroups)) { card.location = null; if (design) design.showLocation = false; }
    if (!canView(fields.get('website'), isSelf, viewer, sharedGroups)) { card.websiteUrl = null; if (design) design.showWebsite = false; }
    if (!canView(fields.get('avatar'), isSelf, viewer, sharedGroups)) { card.avatarMedia = null; if (design) design.showAvatar = false; }
    if (!canView(fields.get('cover'), isSelf, viewer, sharedGroups)) { card.coverMedia = null; if (design) design.showCover = false; }
    if (!canView(fields.get('username'), isSelf, viewer, sharedGroups)) { card.showUsername = false; profile.username = null; }
    if (!canView(fields.get('status'), isSelf, viewer, sharedGroups)) {
      card.showStatus = false;
      profile.isVerified = null;
      profile.isOwner = null;
      profile.isAdmin = null;
    }
    if (!canView(fields.get('memberSince'), isSelf, viewer, sharedGroups)) { card.showMemberSince = false; profile.createdAt = null; }
  }

  if (Array.isArray(profile.tiles)) {
    profile.tiles = profile.tiles.filter(value => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
      const tileId = String((value as Record<string, unknown>).tileId ?? '');
      return canView(tiles.get(tileId), isSelf, viewer, sharedGroups);
    });
  }

  if (isSelf) {
    profile.privacy = {
      fields: Object.fromEntries(fieldRows.results.map(row => [row.key, { visibility: row.visibility, groupId: row.group_id }])),
      tiles: Object.fromEntries(tileRows.results.map(row => [row.key, { visibility: row.visibility, groupId: row.group_id }]))
    };
  }
  return responseWithPayload(response, payload);
}
