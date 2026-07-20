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

export interface ExperienceEnv {
  DB: D1Database;
  APP_ENV: 'development' | 'pbe' | 'production';
}

type ExperienceUser = {
  id: string;
  username: string;
  displayName: string;
  isVerified: boolean;
  isOwner: boolean;
  isAdmin: boolean;
};

type GroupRow = { id: string; name: string; description: string | null };
type PageRow = {
  id: string;
  owner_user_id: string | null;
  group_id: string | null;
  group_name: string | null;
  name: string;
  slug: string;
  layout_json: string;
  created_by: string;
  updated_at: number;
};
type Visibility = 'all' | 'verified' | 'groups' | 'private';

const COOKIE = 'grev_session';
const encoder = new TextEncoder();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE_ID_RE = /^page-[0-9a-f-]{36}$/i;
const VALID_VISIBILITIES = new Set<Visibility>(['all', 'verified', 'groups', 'private']);
const PROFILE_FIELDS = new Set(['headline','bio','location','website','avatar','cover','username','status','memberSince']);
const REACTIONS = new Set(['wave','heart','fire','clap']);
const MAX_LAYOUT_BYTES = 1_000_000;
const MAX_PAGE_TILES = 60;

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

async function getUser(request: Request, env: ExperienceEnv): Promise<ExperienceUser | null> {
  const token = parseCookies(request)[COOKIE];
  if (!token) return null;
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(`
    SELECT u.id,u.username,u.display_name,u.is_verified,u.is_owner,
      CASE WHEN u.is_owner=1 OR EXISTS(
        SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role_id='role-admin'
      ) THEN 1 ELSE 0 END AS is_admin
    FROM sessions s
    JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.status='active'
  `).bind(await sha256(token), now).first<{
    id: string;
    username: string;
    display_name: string;
    is_verified: number;
    is_owner: number;
    is_admin: number;
  }>();
  return row ? {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    isVerified: Boolean(row.is_verified),
    isOwner: Boolean(row.is_owner),
    isAdmin: Boolean(row.is_admin)
  } : null;
}

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

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  return !origin || origin === new URL(request.url).origin;
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (!(request.headers.get('Content-Type') ?? '').includes('application/json')) throw new Error('JSON_REQUIRED');
  const body: unknown = await request.json();
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('INVALID_BODY');
  return body as Record<string, unknown>;
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'page';
}

function parseLayout(value: string): { tiles: unknown[]; preferences: Record<string, unknown> } {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return {
      tiles: Array.isArray(parsed.tiles) ? parsed.tiles : [],
      preferences: parsed.preferences && typeof parsed.preferences === 'object' && !Array.isArray(parsed.preferences)
        ? parsed.preferences as Record<string, unknown>
        : {}
    };
  } catch {
    return { tiles: [], preferences: {} };
  }
}

function normalizedLayout(value: unknown): { layout: string; parsed: { tiles: Record<string, unknown>[]; preferences: Record<string, unknown> } } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (!Array.isArray(input.tiles) || input.tiles.length > MAX_PAGE_TILES) return null;
  const tiles: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  const allowedTileFields = new Set([
    'colour','contentMode','customTitle','customIcon','mediaFit','mediaOverlay',
    'iconMode','iconLabel','iconMedia','iconTextColour','iconBackgroundColour','iconBorderColour','iconMediaFit',
    'backgroundType','backgroundPrimary','backgroundSecondary','backgroundAngle','backgroundMedia','textColour','borderColour','fontFamily'
  ]);
  for (const rawTile of input.tiles) {
    if (!rawTile || typeof rawTile !== 'object' || Array.isArray(rawTile)) return null;
    const tile = rawTile as Record<string, unknown>;
    const featureId = String(tile.featureId ?? '').trim();
    const x = Number(tile.x);
    const y = Number(tile.y);
    const width = Number(tile.width);
    const height = Number(tile.height);
    if (!featureId || seen.has(featureId) || !Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(width) || !Number.isInteger(height)) return null;
    if (x < 0 || y < 0 || x + width > 8 || width < 1 || width > 6 || height < 1 || height > 4 || y > 199) return null;
    seen.add(featureId);
    const normalizedTile: Record<string, unknown> = { featureId, x, y, width, height };
    for (const field of allowedTileFields) {
      const fieldValue = tile[field];
      if (fieldValue === null || ['string','number','boolean'].includes(typeof fieldValue)) normalizedTile[field] = fieldValue;
    }
    tiles.push(normalizedTile);
  }
  const preferences = input.preferences && typeof input.preferences === 'object' && !Array.isArray(input.preferences)
    ? structuredClone(input.preferences as Record<string, unknown>)
    : {};
  const parsed = { tiles, preferences };
  const layout = JSON.stringify(parsed);
  return new TextEncoder().encode(layout).byteLength <= MAX_LAYOUT_BYTES ? { layout, parsed } : null;
}

async function groupsForUser(env: ExperienceEnv, userId: string): Promise<GroupRow[]> {
  const rows = await env.DB.prepare(`
    SELECT g.id,g.name,g.description
    FROM groups g
    JOIN group_memberships gm ON gm.group_id=g.id
    WHERE gm.user_id=?
    ORDER BY g.name
  `).bind(userId).all<GroupRow>();
  return rows.results;
}

async function pageAccess(env: ExperienceEnv, user: ExperienceUser, pageId: string): Promise<PageRow | null> {
  return env.DB.prepare(`
    SELECT p.id,p.owner_user_id,p.group_id,g.name AS group_name,p.name,p.slug,p.layout_json,p.created_by,p.updated_at
    FROM dashboard_pages p
    LEFT JOIN groups g ON g.id=p.group_id
    WHERE p.id=? AND (
      p.owner_user_id=?
      OR (?=1 AND p.group_id IS NOT NULL)
      OR (p.group_id IS NOT NULL AND EXISTS(
        SELECT 1 FROM group_memberships gm WHERE gm.group_id=p.group_id AND gm.user_id=?
      ))
    )
  `).bind(pageId, user.id, user.isAdmin ? 1 : 0, user.id).first<PageRow>();
}

function pageJson(row: PageRow, user: ExperienceUser) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    scope: row.group_id ? 'group' : 'personal',
    groupId: row.group_id,
    groupName: row.group_name,
    layout: parseLayout(row.layout_json),
    canEdit: row.owner_user_id === user.id || (Boolean(row.group_id) && user.isAdmin),
    updatedAt: row.updated_at
  };
}

async function dashboardPagesPayload(env: ExperienceEnv, user: ExperienceUser) {
  const [pageRows, groups, state] = await Promise.all([
    env.DB.prepare(`
      SELECT p.id,p.owner_user_id,p.group_id,g.name AS group_name,p.name,p.slug,p.layout_json,p.created_by,p.updated_at
      FROM dashboard_pages p
      LEFT JOIN groups g ON g.id=p.group_id
      WHERE p.owner_user_id=? OR ?=1 OR (
        p.group_id IS NOT NULL AND EXISTS(
          SELECT 1 FROM group_memberships gm WHERE gm.group_id=p.group_id AND gm.user_id=?
        )
      )
      ORDER BY CASE WHEN p.owner_user_id=? THEN 0 ELSE 1 END,COALESCE(g.name,''),p.name
    `).bind(user.id, user.isAdmin ? 1 : 0, user.id, user.id).all<PageRow>(),
    groupsForUser(env, user.id),
    env.DB.prepare(`SELECT active_page_id FROM user_dashboard_page_state WHERE user_id=?`).bind(user.id).first<{ active_page_id: string | null }>()
  ]);
  const pages = [
    { id: 'home', name: 'Home', slug: 'home', scope: 'home', groupId: null, groupName: null, layout: null, canEdit: true, updatedAt: null },
    ...pageRows.results.map(row => pageJson(row, user))
  ];
  const activePageId = state?.active_page_id && pages.some(page => page.id === state.active_page_id) ? state.active_page_id : 'home';
  return { ok: true, pages, activePageId, groups, canCreateGroupPages: user.isAdmin };
}

async function createDashboardPage(request: Request, env: ExperienceEnv, user: ExperienceUser): Promise<Response> {
  const body = await readJson(request);
  const name = String(body.name ?? '').trim().slice(0, 60);
  const scope = String(body.scope ?? 'personal');
  const groupId = scope === 'group' ? String(body.groupId ?? '').trim() : null;
  const normalized = normalizedLayout(body.layout ?? { tiles: [], preferences: {} });
  if (name.length < 1 || !normalized || !['personal','group'].includes(scope)) return secureJson({ ok: false, message: 'Choose a page name and a valid dashboard layout.' }, 400);
  if (scope === 'group' && !user.isAdmin) return secureJson({ ok: false, message: 'Administrator access is required to create group pages.' }, 403);
  if (groupId) {
    const group = await env.DB.prepare(`SELECT id FROM groups WHERE id=?`).bind(groupId).first<{ id: string }>();
    if (!group) return secureJson({ ok: false, message: 'Group not found.' }, 404);
  }
  const id = `page-${crypto.randomUUID()}`;
  const now = Math.floor(Date.now() / 1000);
  const baseSlug = slugify(name);
  let slug = baseSlug;
  for (let suffix = 2; suffix < 100; suffix += 1) {
    const existing = groupId
      ? await env.DB.prepare(`SELECT id FROM dashboard_pages WHERE group_id=? AND slug=?`).bind(groupId, slug).first()
      : await env.DB.prepare(`SELECT id FROM dashboard_pages WHERE owner_user_id=? AND slug=?`).bind(user.id, slug).first();
    if (!existing) break;
    slug = `${baseSlug}-${suffix}`;
  }
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO dashboard_pages(id,owner_user_id,group_id,name,slug,layout_json,created_by,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?)
    `).bind(id, groupId ? null : user.id, groupId, name, slug, normalized.layout, user.id, now, now),
    env.DB.prepare(`
      INSERT INTO user_dashboard_page_state(user_id,active_page_id,updated_at) VALUES(?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET active_page_id=excluded.active_page_id,updated_at=excluded.updated_at
    `).bind(user.id, id, now),
    env.DB.prepare(`INSERT INTO audit_events(id,actor_user_id,event_type,target_type,target_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?)`)
      .bind(crypto.randomUUID(), user.id, 'dashboard.page_created', 'dashboard_page', id, JSON.stringify({ name, scope, groupId }), now)
  ]);
  return secureJson(await dashboardPagesPayload(env, user), 201);
}

async function updateDashboardPage(request: Request, env: ExperienceEnv, user: ExperienceUser, pageId: string): Promise<Response> {
  const page = await pageAccess(env, user, pageId);
  if (!page) return secureJson({ ok: false, message: 'Dashboard page not found.' }, 404);
  if (page.owner_user_id !== user.id && !user.isAdmin) return secureJson({ ok: false, message: 'You cannot edit this group dashboard page.' }, 403);
  const body = await readJson(request);
  const name = String(body.name ?? page.name).trim().slice(0, 60);
  const normalized = normalizedLayout(body.layout ?? parseLayout(page.layout_json));
  if (!name || !normalized) return secureJson({ ok: false, message: 'Choose a page name and a valid dashboard layout.' }, 400);
  const now = Math.floor(Date.now() / 1000);
  await env.DB.batch([
    env.DB.prepare(`UPDATE dashboard_pages SET name=?,layout_json=?,updated_at=? WHERE id=?`).bind(name, normalized.layout, now, pageId),
    env.DB.prepare(`INSERT INTO audit_events(id,actor_user_id,event_type,target_type,target_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?)`)
      .bind(crypto.randomUUID(), user.id, 'dashboard.page_updated', 'dashboard_page', pageId, JSON.stringify({ name, tileCount: normalized.parsed.tiles.length }), now)
  ]);
  return secureJson(await dashboardPagesPayload(env, user));
}

async function deleteDashboardPage(env: ExperienceEnv, user: ExperienceUser, pageId: string): Promise<Response> {
  const page = await pageAccess(env, user, pageId);
  if (!page) return secureJson({ ok: false, message: 'Dashboard page not found.' }, 404);
  if (page.owner_user_id !== user.id && !user.isAdmin) return secureJson({ ok: false, message: 'You cannot delete this group dashboard page.' }, 403);
  const now = Math.floor(Date.now() / 1000);
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM dashboard_pages WHERE id=?`).bind(pageId),
    env.DB.prepare(`UPDATE user_dashboard_page_state SET active_page_id=NULL,updated_at=? WHERE active_page_id=?`).bind(now, pageId),
    env.DB.prepare(`INSERT INTO audit_events(id,actor_user_id,event_type,target_type,target_id,metadata_json,created_at) VALUES(?,?,?,?,?,'{}',?)`)
      .bind(crypto.randomUUID(), user.id, 'dashboard.page_deleted', 'dashboard_page', pageId, now)
  ]);
  return secureJson(await dashboardPagesPayload(env, user));
}

async function activateDashboardPage(request: Request, env: ExperienceEnv, user: ExperienceUser): Promise<Response> {
  const body = await readJson(request);
  const pageId = String(body.pageId ?? 'home');
  if (pageId !== 'home' && !await pageAccess(env, user, pageId)) return secureJson({ ok: false, message: 'Dashboard page not found.' }, 404);
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(`
    INSERT INTO user_dashboard_page_state(user_id,active_page_id,updated_at) VALUES(?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET active_page_id=excluded.active_page_id,updated_at=excluded.updated_at
  `).bind(user.id, pageId === 'home' ? null : pageId, now).run();
  return secureJson({ ok: true, activePageId: pageId });
}

async function liveDashboardPayload(env: ExperienceEnv, user: ExperienceUser) {
  const [groups, guestbook, activity] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS count FROM group_memberships WHERE user_id=?`).bind(user.id).first<{ count: number }>(),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM profile_guestbook_entries WHERE profile_user_id=? AND deleted_at IS NULL`).bind(user.id).first<{ count: number }>(),
    env.DB.prepare(`
      SELECT event_type,target_type,target_id,metadata_json,created_at
      FROM audit_events
      WHERE actor_user_id=? OR target_id=?
      ORDER BY created_at DESC
      LIMIT 8
    `).bind(user.id, user.id).all<{ event_type: string; target_type: string; target_id: string; metadata_json: string; created_at: number }>()
  ]);
  return {
    ok: true,
    generatedAt: Math.floor(Date.now() / 1000),
    summary: { groupCount: Number(groups?.count ?? 0), guestbookCount: Number(guestbook?.count ?? 0) },
    activity: activity.results.map(item => ({
      eventType: item.event_type,
      targetType: item.target_type,
      targetId: item.target_id,
      createdAt: item.created_at
    }))
  };
}

function normalizePrivacyRecord(value: unknown): { visibility: Visibility; groupId: string | null } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const visibility = String(input.visibility ?? 'all') as Visibility;
  const groupId = visibility === 'groups' ? String(input.groupId ?? '').trim() : null;
  if (!VALID_VISIBILITIES.has(visibility) || (visibility === 'groups' && !groupId)) return null;
  return { visibility, groupId };
}

async function privacyPayload(env: ExperienceEnv, user: ExperienceUser) {
  const [fieldRows, tileRows, settings, groups] = await Promise.all([
    env.DB.prepare(`SELECT field_key,visibility,group_id FROM user_profile_field_privacy WHERE user_id=?`).bind(user.id).all<{ field_key: string; visibility: Visibility; group_id: string | null }>(),
    env.DB.prepare(`SELECT tile_id,visibility,group_id FROM user_profile_tile_privacy WHERE user_id=?`).bind(user.id).all<{ tile_id: string; visibility: Visibility; group_id: string | null }>(),
    env.DB.prepare(`SELECT guestbook_enabled,reactions_enabled FROM user_profile_interaction_settings WHERE user_id=?`).bind(user.id).first<{ guestbook_enabled: number; reactions_enabled: number }>(),
    groupsForUser(env, user.id)
  ]);
  return {
    ok: true,
    fields: Object.fromEntries(fieldRows.results.map(row => [row.field_key, { visibility: row.visibility, groupId: row.group_id }])),
    tiles: Object.fromEntries(tileRows.results.map(row => [row.tile_id, { visibility: row.visibility, groupId: row.group_id }])),
    interactions: {
      guestbookEnabled: settings ? Boolean(settings.guestbook_enabled) : true,
      reactionsEnabled: settings ? Boolean(settings.reactions_enabled) : true
    },
    groups
  };
}

async function savePrivacy(request: Request, env: ExperienceEnv, user: ExperienceUser): Promise<Response> {
  const body = await readJson(request);
  const rawFields = body.fields && typeof body.fields === 'object' && !Array.isArray(body.fields) ? body.fields as Record<string, unknown> : {};
  const rawTiles = body.tiles && typeof body.tiles === 'object' && !Array.isArray(body.tiles) ? body.tiles as Record<string, unknown> : {};
  const groups = new Set((await groupsForUser(env, user.id)).map(group => group.id));
  const now = Math.floor(Date.now() / 1000);
  const statements: D1Statement[] = [
    env.DB.prepare(`DELETE FROM user_profile_field_privacy WHERE user_id=?`).bind(user.id),
    env.DB.prepare(`DELETE FROM user_profile_tile_privacy WHERE user_id=?`).bind(user.id)
  ];
  for (const [key, value] of Object.entries(rawFields)) {
    if (!PROFILE_FIELDS.has(key)) continue;
    const record = normalizePrivacyRecord(value);
    if (!record || (record.groupId && !groups.has(record.groupId))) return secureJson({ ok: false, message: 'Choose valid profile field privacy settings.' }, 400);
    if (record.visibility !== 'all') statements.push(env.DB.prepare(`INSERT INTO user_profile_field_privacy(user_id,field_key,visibility,group_id,updated_at) VALUES(?,?,?,?,?)`).bind(user.id, key, record.visibility, record.groupId, now));
  }
  for (const [tileId, value] of Object.entries(rawTiles)) {
    if (!UUID_RE.test(tileId)) continue;
    const record = normalizePrivacyRecord(value);
    if (!record || (record.groupId && !groups.has(record.groupId))) return secureJson({ ok: false, message: 'Choose valid profile tile privacy settings.' }, 400);
    if (record.visibility !== 'all') statements.push(env.DB.prepare(`INSERT INTO user_profile_tile_privacy(user_id,tile_id,visibility,group_id,updated_at) VALUES(?,?,?,?,?)`).bind(user.id, tileId, record.visibility, record.groupId, now));
  }
  const interactions = body.interactions && typeof body.interactions === 'object' && !Array.isArray(body.interactions) ? body.interactions as Record<string, unknown> : {};
  statements.push(env.DB.prepare(`
    INSERT INTO user_profile_interaction_settings(user_id,guestbook_enabled,reactions_enabled,updated_at)
    VALUES(?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET guestbook_enabled=excluded.guestbook_enabled,reactions_enabled=excluded.reactions_enabled,updated_at=excluded.updated_at
  `).bind(user.id, interactions.guestbookEnabled === false ? 0 : 1, interactions.reactionsEnabled === false ? 0 : 1, now));
  statements.push(env.DB.prepare(`INSERT INTO audit_events(id,actor_user_id,event_type,target_type,target_id,metadata_json,created_at) VALUES(?,?,?,?,?,'{}',?)`).bind(crypto.randomUUID(), user.id, 'profile.privacy_updated', 'user', user.id, now));
  await env.DB.batch(statements);
  return secureJson(await privacyPayload(env, user));
}

async function profileInteractions(env: ExperienceEnv, viewer: ExperienceUser, profileId: string): Promise<Response> {
  if (!UUID_RE.test(profileId)) return secureJson({ ok: false, message: 'Profile not found.' }, 404);
  const [profile, settings, guestbook, reactions, ownReaction] = await Promise.all([
    env.DB.prepare(`SELECT id FROM users WHERE id=? AND status='active'`).bind(profileId).first<{ id: string }>(),
    env.DB.prepare(`SELECT guestbook_enabled,reactions_enabled FROM user_profile_interaction_settings WHERE user_id=?`).bind(profileId).first<{ guestbook_enabled: number; reactions_enabled: number }>(),
    env.DB.prepare(`
      SELECT e.id,e.author_user_id,u.username,u.display_name,e.message,e.created_at
      FROM profile_guestbook_entries e
      JOIN users u ON u.id=e.author_user_id
      WHERE e.profile_user_id=? AND e.deleted_at IS NULL
      ORDER BY e.created_at DESC
      LIMIT 50
    `).bind(profileId).all<{ id: string; author_user_id: string; username: string; display_name: string; message: string; created_at: number }>(),
    env.DB.prepare(`SELECT reaction,COUNT(*) AS count FROM profile_reactions WHERE profile_user_id=? GROUP BY reaction`).bind(profileId).all<{ reaction: string; count: number }>(),
    env.DB.prepare(`SELECT reaction FROM profile_reactions WHERE profile_user_id=? AND author_user_id=?`).bind(profileId, viewer.id).first<{ reaction: string }>()
  ]);
  if (!profile) return secureJson({ ok: false, message: 'Profile not found.' }, 404);
  const guestbookEnabled = settings ? Boolean(settings.guestbook_enabled) : true;
  const reactionsEnabled = settings ? Boolean(settings.reactions_enabled) : true;
  return secureJson({
    ok: true,
    guestbookEnabled,
    reactionsEnabled,
    canModerate: viewer.id === profileId || viewer.isAdmin,
    entries: guestbookEnabled || viewer.id === profileId || viewer.isAdmin ? guestbook.results.map(entry => ({
      id: entry.id,
      author: { id: entry.author_user_id, username: entry.username, displayName: entry.display_name },
      message: entry.message,
      createdAt: entry.created_at,
      canDelete: viewer.id === entry.author_user_id || viewer.id === profileId || viewer.isAdmin
    })) : [],
    reactions: Object.fromEntries(['wave','heart','fire','clap'].map(reaction => [reaction, Number(reactions.results.find(item => item.reaction === reaction)?.count ?? 0)])),
    ownReaction: ownReaction?.reaction ?? null
  });
}

async function addGuestbookEntry(request: Request, env: ExperienceEnv, user: ExperienceUser, profileId: string): Promise<Response> {
  if (!UUID_RE.test(profileId)) return secureJson({ ok: false, message: 'Profile not found.' }, 404);
  const settings = await env.DB.prepare(`SELECT guestbook_enabled FROM user_profile_interaction_settings WHERE user_id=?`).bind(profileId).first<{ guestbook_enabled: number }>();
  if (settings && !settings.guestbook_enabled && user.id !== profileId && !user.isAdmin) return secureJson({ ok: false, message: 'This guestbook is closed.' }, 403);
  const body = await readJson(request);
  const message = String(body.message ?? '').trim();
  if (message.length < 1 || message.length > 500) return secureJson({ ok: false, message: 'Guestbook messages must be between 1 and 500 characters.' }, 400);
  const now = Math.floor(Date.now() / 1000);
  const recent = await env.DB.prepare(`SELECT COUNT(*) AS count FROM profile_guestbook_entries WHERE profile_user_id=? AND author_user_id=? AND created_at>? AND deleted_at IS NULL`).bind(profileId, user.id, now - 3600).first<{ count: number }>();
  if (Number(recent?.count ?? 0) >= 5) return secureJson({ ok: false, message: 'You have posted several guestbook messages recently. Try again later.' }, 429);
  const id = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO profile_guestbook_entries(id,profile_user_id,author_user_id,message,created_at) VALUES(?,?,?,?,?)`).bind(id, profileId, user.id, message, now),
    env.DB.prepare(`INSERT INTO audit_events(id,actor_user_id,event_type,target_type,target_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), user.id, 'profile.guestbook_posted', 'user', profileId, JSON.stringify({ entryId: id }), now)
  ]);
  return profileInteractions(env, user, profileId);
}

async function deleteGuestbookEntry(env: ExperienceEnv, user: ExperienceUser, entryId: string): Promise<Response> {
  if (!UUID_RE.test(entryId)) return secureJson({ ok: false, message: 'Guestbook entry not found.' }, 404);
  const entry = await env.DB.prepare(`SELECT profile_user_id,author_user_id,deleted_at FROM profile_guestbook_entries WHERE id=?`).bind(entryId).first<{ profile_user_id: string; author_user_id: string; deleted_at: number | null }>();
  if (!entry || entry.deleted_at) return secureJson({ ok: false, message: 'Guestbook entry not found.' }, 404);
  if (user.id !== entry.author_user_id && user.id !== entry.profile_user_id && !user.isAdmin) return secureJson({ ok: false, message: 'You cannot remove this guestbook entry.' }, 403);
  await env.DB.prepare(`UPDATE profile_guestbook_entries SET deleted_at=? WHERE id=?`).bind(Math.floor(Date.now() / 1000), entryId).run();
  return profileInteractions(env, user, entry.profile_user_id);
}

async function setReaction(request: Request, env: ExperienceEnv, user: ExperienceUser, profileId: string): Promise<Response> {
  if (!UUID_RE.test(profileId)) return secureJson({ ok: false, message: 'Profile not found.' }, 404);
  const settings = await env.DB.prepare(`SELECT reactions_enabled FROM user_profile_interaction_settings WHERE user_id=?`).bind(profileId).first<{ reactions_enabled: number }>();
  if (settings && !settings.reactions_enabled && user.id !== profileId && !user.isAdmin) return secureJson({ ok: false, message: 'Reactions are disabled for this profile.' }, 403);
  const body = await readJson(request);
  const reaction = body.reaction === null ? null : String(body.reaction ?? '');
  if (reaction !== null && !REACTIONS.has(reaction)) return secureJson({ ok: false, message: 'Choose a valid reaction.' }, 400);
  const now = Math.floor(Date.now() / 1000);
  if (reaction === null) await env.DB.prepare(`DELETE FROM profile_reactions WHERE profile_user_id=? AND author_user_id=?`).bind(profileId, user.id).run();
  else await env.DB.prepare(`
    INSERT INTO profile_reactions(profile_user_id,author_user_id,reaction,created_at) VALUES(?,?,?,?)
    ON CONFLICT(profile_user_id,author_user_id) DO UPDATE SET reaction=excluded.reaction,created_at=excluded.created_at
  `).bind(profileId, user.id, reaction, now).run();
  return profileInteractions(env, user, profileId);
}

export async function handleExperienceRequest(request: Request, env: ExperienceEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!path.startsWith('/api/experience/') && !path.startsWith('/api/profile/privacy') && !path.includes('/interactions') && !path.includes('/guestbook') && !path.includes('/reaction')) return null;
  const user = await getUser(request, env);
  if (!user) return secureJson({ ok: false, message: 'Authentication required.' }, 401);
  if (request.method !== 'GET' && !sameOrigin(request)) return secureJson({ ok: false, message: 'Origin rejected.' }, 403);

  if (path === '/api/experience/dashboard/pages' && request.method === 'GET') return secureJson(await dashboardPagesPayload(env, user));
  if (path === '/api/experience/dashboard/pages' && request.method === 'POST') return createDashboardPage(request, env, user);
  if (path === '/api/experience/dashboard/pages/active' && request.method === 'POST') return activateDashboardPage(request, env, user);
  const pageMatch = path.match(/^\/api\/experience\/dashboard\/pages\/(page-[0-9a-f-]{36})$/i);
  if (pageMatch && request.method === 'PUT') return updateDashboardPage(request, env, user, pageMatch[1]!);
  if (pageMatch && request.method === 'DELETE') return deleteDashboardPage(env, user, pageMatch[1]!);
  if (path === '/api/experience/dashboard/live' && request.method === 'GET') return secureJson(await liveDashboardPayload(env, user));

  if (path === '/api/profile/privacy' && request.method === 'GET') return secureJson(await privacyPayload(env, user));
  if (path === '/api/profile/privacy' && request.method === 'PUT') return savePrivacy(request, env, user);

  const interactionsMatch = path.match(/^\/api\/profiles\/([0-9a-f-]{36})\/interactions$/i);
  if (interactionsMatch && request.method === 'GET') return profileInteractions(env, user, interactionsMatch[1]!);
  const guestbookMatch = path.match(/^\/api\/profiles\/([0-9a-f-]{36})\/guestbook$/i);
  if (guestbookMatch && request.method === 'POST') return addGuestbookEntry(request, env, user, guestbookMatch[1]!);
  const reactionMatch = path.match(/^\/api\/profiles\/([0-9a-f-]{36})\/reaction$/i);
  if (reactionMatch && request.method === 'POST') return setReaction(request, env, user, reactionMatch[1]!);
  const deleteEntryMatch = path.match(/^\/api\/profile\/guestbook\/([0-9a-f-]{36})$/i);
  if (deleteEntryMatch && request.method === 'DELETE') return deleteGuestbookEntry(env, user, deleteEntryMatch[1]!);

  return null;
}
