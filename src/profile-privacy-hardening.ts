import { type ProfileEnv } from './profile';
import type { D1Result } from './shared/d1-types';
import { base64Url, sha256, parseCookies } from './shared/http-security';

export type PrivacyViewer = { id: string; isVerified: boolean; isAdmin: boolean };
type Viewer = PrivacyViewer;
export type PrivacyRow = { key: string; visibility: 'all' | 'verified' | 'groups' | 'private'; group_id: string | null };
type PrivacyDatabase = { prepare(query: string): { bind(...values: unknown[]): { all<T>(): Promise<{ results: T[] }> } } };

const COOKIE = 'grev_session';
const encoder = new TextEncoder();

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

export function canView(row: PrivacyRow | undefined, isSelf: boolean, viewer: Viewer, groupIds: Set<string>): boolean {
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

/**
 * The profile owner's field and tile visibility rules, resolved for one viewer. Shared by the
 * website profile response (applyProfilePrivacy below) and the Grev Home profile endpoints
 * (src/profile-unified.ts), so a field hidden on grev.dad is hidden in Grev Home too.
 */
export type ProfilePrivacy = {
  isSelf: boolean;
  canViewField(key: string): boolean;
  canViewTile(tileId: string): boolean;
  settings: { fields: Record<string, unknown>; tiles: Record<string, unknown> };
};

export async function loadProfilePrivacy(db: PrivacyDatabase, profileId: string, viewer: PrivacyViewer): Promise<ProfilePrivacy> {
  const isSelf = viewer.id === profileId;
  const [fieldRows, tileRows, groupRows] = await Promise.all([
    db.prepare(`SELECT field_key AS key,visibility,group_id FROM user_profile_field_privacy WHERE user_id=?`)
      .bind(profileId).all<PrivacyRow>(),
    db.prepare(`SELECT tile_id AS key,visibility,group_id FROM user_profile_tile_privacy WHERE user_id=?`)
      .bind(profileId).all<PrivacyRow>(),
    db.prepare(`
      SELECT owner.group_id
      FROM group_memberships owner
      JOIN group_memberships viewer ON viewer.group_id=owner.group_id
      WHERE owner.user_id=? AND viewer.user_id=?
    `).bind(profileId, viewer.id).all<{ group_id: string }>()
  ]);
  const fields = new Map(fieldRows.results.map(row => [row.key, row]));
  const tiles = new Map(tileRows.results.map(row => [row.key, row]));
  const sharedGroups = new Set(groupRows.results.map(row => row.group_id));
  return {
    isSelf,
    canViewField: key => canView(fields.get(key), isSelf, viewer, sharedGroups),
    canViewTile: tileId => canView(tiles.get(tileId), isSelf, viewer, sharedGroups),
    settings: {
      fields: Object.fromEntries(fieldRows.results.map(row => [row.key, { visibility: row.visibility, groupId: row.group_id }])),
      tiles: Object.fromEntries(tileRows.results.map(row => [row.key, { visibility: row.visibility, groupId: row.group_id }]))
    }
  };
}

/** Blanks every card field and drops every tile the viewer may not see, in place. */
export function applyPrivacyToProfile(profile: Record<string, unknown>, privacy: ProfilePrivacy): void {
  const card = profile.card && typeof profile.card === 'object' && !Array.isArray(profile.card)
    ? profile.card as Record<string, unknown>
    : null;
  const design = profile.design && typeof profile.design === 'object' && !Array.isArray(profile.design)
    ? profile.design as Record<string, unknown>
    : null;
  const can = privacy.canViewField;

  if (card) {
    if (!can('headline')) { card.headline = null; if (design) design.showHeadline = false; }
    if (!can('bio')) { card.bio = null; if (design) design.showBio = false; }
    if (!can('location')) { card.location = null; if (design) design.showLocation = false; }
    if (!can('website')) { card.websiteUrl = null; if (design) design.showWebsite = false; }
    if (!can('avatar')) { card.avatarMedia = null; if (design) design.showAvatar = false; }
    if (!can('cover')) { card.coverMedia = null; if (design) design.showCover = false; }
    if (!can('username')) { card.showUsername = false; profile.username = null; }
    if (!can('status')) {
      card.showStatus = false;
      profile.isVerified = null;
      profile.isOwner = null;
      profile.isAdmin = null;
    }
    if (!can('memberSince')) { card.showMemberSince = false; profile.createdAt = null; }
  }

  if (Array.isArray(profile.tiles)) {
    profile.tiles = profile.tiles.filter(value => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
      return privacy.canViewTile(String((value as Record<string, unknown>).tileId ?? ''));
    });
  }

  if (privacy.isSelf) profile.privacy = privacy.settings;
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
  applyPrivacyToProfile(profile, await loadProfilePrivacy(env.DB, profileId, viewer));
  return responseWithPayload(response, payload);
}
