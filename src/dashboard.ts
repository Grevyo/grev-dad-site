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

export interface DashboardEnv {
  DB: D1Database;
  ASSETS: { fetch(request: Request): Promise<Response> };
  APP_ENV: 'development' | 'pbe' | 'production';
}

type DashboardUser = {
  id: string;
  username: string;
  displayName: string;
  isOwner: boolean;
  isAdmin: boolean;
};

type FeatureRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  feature_type: 'workspace' | 'link' | 'system';
  route: string;
  icon_text: string;
  audience: 'all' | 'groups' | 'admin' | 'owner';
  default_size: DashboardSize;
  allowed_sizes: string;
  is_active: number;
  is_default: number;
  sort_order: number;
  position: number | null;
  tile_size: DashboardSize | null;
  matched_groups: string;
};

type DashboardSize = 'small' | 'medium' | 'wide' | 'large';
type DashboardDensity = 'comfortable' | 'compact';

const COOKIE = 'grev_session';
const encoder = new TextEncoder();
const VALID_SIZES = new Set<DashboardSize>(['small', 'medium', 'wide', 'large']);

function b64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function sha256(value: string): Promise<string> {
  return b64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

function parseCookies(request: Request): Record<string, string> {
  const entries = (request.headers.get('Cookie') ?? '')
    .split(';')
    .map(value => value.trim())
    .filter(Boolean)
    .map(value => {
      const index = value.indexOf('=');
      return index < 0 ? null : [value.slice(0, index), decodeURIComponent(value.slice(index + 1))] as const;
    })
    .filter((entry): entry is readonly [string, string] => entry !== null);
  return Object.fromEntries(entries);
}

async function getDashboardUser(request: Request, env: DashboardEnv): Promise<DashboardUser | null> {
  const token = parseCookies(request)[COOKIE];
  if (!token) return null;
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(`
    SELECT u.id,u.username,u.display_name,u.is_owner,
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
    is_owner: number;
    is_admin: number;
  }>();
  return row ? {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    isOwner: Boolean(row.is_owner),
    isAdmin: Boolean(row.is_admin)
  } : null;
}

function secureJson(value: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'same-origin');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return new Response(JSON.stringify(value), { ...init, headers });
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  return !origin || origin === new URL(request.url).origin;
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (!(request.headers.get('Content-Type') ?? '').includes('application/json')) throw new Error('JSON_REQUIRED');
  const value: unknown = await request.json();
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_BODY');
  return value as Record<string, unknown>;
}

function featureFromRow(row: FeatureRow) {
  const allowedSizes = row.allowed_sizes
    .split(',')
    .map(value => value.trim())
    .filter((value): value is DashboardSize => VALID_SIZES.has(value as DashboardSize));
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    category: row.category,
    featureType: row.feature_type,
    route: row.route,
    iconText: row.icon_text,
    audience: row.audience,
    defaultSize: row.default_size,
    allowedSizes,
    isActive: Boolean(row.is_active),
    isDefault: Boolean(row.is_default),
    sortOrder: row.sort_order,
    pinned: row.position !== null,
    position: row.position,
    size: row.tile_size ?? row.default_size,
    accessGroups: row.matched_groups ? row.matched_groups.split(', ') : []
  };
}

async function accessibleFeatures(env: DashboardEnv, user: DashboardUser): Promise<FeatureRow[]> {
  const rows = await env.DB.prepare(`
    SELECT f.*,
      t.position,
      t.size AS tile_size,
      COALESCE((
        SELECT GROUP_CONCAT(g.name, ', ')
        FROM dashboard_feature_group_grants fg
        JOIN groups g ON g.id=fg.group_id
        JOIN group_memberships gm ON gm.group_id=fg.group_id AND gm.user_id=?
        WHERE fg.feature_id=f.id
      ),'') AS matched_groups
    FROM dashboard_features f
    LEFT JOIN user_dashboard_tiles t ON t.feature_id=f.id AND t.user_id=?
    WHERE f.is_active=1 AND (
      ?=1
      OR f.audience='all'
      OR (f.audience='admin' AND ?=1)
      OR (f.audience='owner' AND ?=1)
      OR (f.audience='groups' AND EXISTS(
        SELECT 1
        FROM dashboard_feature_group_grants fg2
        JOIN group_memberships gm2 ON gm2.group_id=fg2.group_id
        WHERE fg2.feature_id=f.id AND gm2.user_id=?
      ))
    )
    ORDER BY CASE WHEN t.position IS NULL THEN 1 ELSE 0 END,t.position,f.sort_order,f.name
  `).bind(
    user.id,
    user.id,
    user.isOwner ? 1 : 0,
    user.isAdmin ? 1 : 0,
    user.isOwner ? 1 : 0,
    user.id
  ).all<FeatureRow>();
  return rows.results;
}

async function defaultFeatures(env: DashboardEnv, user: DashboardUser): Promise<FeatureRow[]> {
  const rows = await env.DB.prepare(`
    SELECT f.*,NULL AS position,NULL AS tile_size,'' AS matched_groups
    FROM dashboard_features f
    WHERE f.is_active=1 AND f.is_default=1 AND (
      f.audience='all'
      OR (f.audience='admin' AND ?=1)
      OR (f.audience='owner' AND ?=1)
      OR (f.audience='groups' AND EXISTS(
        SELECT 1
        FROM dashboard_feature_group_grants fg
        JOIN group_memberships gm ON gm.group_id=fg.group_id
        WHERE fg.feature_id=f.id AND gm.user_id=?
      ))
    )
    ORDER BY f.sort_order,f.name
    LIMIT 12
  `).bind(user.isAdmin ? 1 : 0, user.isOwner ? 1 : 0, user.id).all<FeatureRow>();
  return rows.results;
}

async function ensureDashboardInitialized(env: DashboardEnv, user: DashboardUser): Promise<void> {
  const existing = await env.DB.prepare(`SELECT user_id FROM user_dashboard_preferences WHERE user_id=?`).bind(user.id).first<{ user_id: string }>();
  if (existing) return;
  const defaults = await defaultFeatures(env, user);
  const now = Math.floor(Date.now() / 1000);
  const statements: D1Statement[] = [
    env.DB.prepare(`INSERT OR IGNORE INTO user_dashboard_preferences(user_id,density,show_descriptions,initialized_at,updated_at) VALUES(?,'comfortable',1,?,?)`).bind(user.id, now, now)
  ];
  defaults.forEach((feature, position) => {
    statements.push(env.DB.prepare(`INSERT OR IGNORE INTO user_dashboard_tiles(user_id,feature_id,position,size,pinned_at,updated_at) VALUES(?,?,?,?,?,?)`).bind(user.id, feature.id, position, feature.default_size, now, now));
  });
  await env.DB.batch(statements);
}

async function dashboardPayload(env: DashboardEnv, user: DashboardUser) {
  await ensureDashboardInitialized(env, user);
  const [rows, preferences] = await Promise.all([
    accessibleFeatures(env, user),
    env.DB.prepare(`SELECT density,show_descriptions,initialized_at,updated_at FROM user_dashboard_preferences WHERE user_id=?`).bind(user.id).first<{
      density: DashboardDensity;
      show_descriptions: number;
      initialized_at: number;
      updated_at: number;
    }>()
  ]);
  const features = rows.map(featureFromRow);
  return {
    ok: true,
    features,
    pinnedTiles: features.filter(feature => feature.pinned).sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    preferences: {
      density: preferences?.density ?? 'comfortable',
      showDescriptions: Boolean(preferences?.show_descriptions ?? 1),
      initializedAt: preferences?.initialized_at ?? null,
      updatedAt: preferences?.updated_at ?? null
    },
    capabilities: { canCustomize: true, isAdmin: user.isAdmin, isOwner: user.isOwner }
  };
}

async function saveLayout(request: Request, env: DashboardEnv, user: DashboardUser): Promise<Response> {
  const data = await readJson(request);
  const rawTiles = data.tiles;
  if (!Array.isArray(rawTiles) || rawTiles.length > 40) return secureJson({ ok: false, message: 'Choose up to 40 dashboard tiles.' }, { status: 400 });

  const availableRows = await accessibleFeatures(env, user);
  const available = new Map(availableRows.map(row => [row.id, row]));
  const seen = new Set<string>();
  const tiles: Array<{ featureId: string; size: DashboardSize }> = [];

  for (const rawTile of rawTiles) {
    if (!rawTile || typeof rawTile !== 'object' || Array.isArray(rawTile)) return secureJson({ ok: false, message: 'The dashboard layout is invalid.' }, { status: 400 });
    const item = rawTile as Record<string, unknown>;
    const featureId = String(item.featureId ?? '').trim();
    const size = String(item.size ?? '') as DashboardSize;
    const feature = available.get(featureId);
    if (!feature || seen.has(featureId) || !VALID_SIZES.has(size)) return secureJson({ ok: false, message: 'The dashboard contains an unavailable or duplicate feature.' }, { status: 400 });
    const allowed = new Set(feature.allowed_sizes.split(',').map(value => value.trim()));
    if (!allowed.has(size)) return secureJson({ ok: false, message: `${feature.name} does not support that tile size.` }, { status: 400 });
    seen.add(featureId);
    tiles.push({ featureId, size });
  }

  const rawPreferences = data.preferences;
  const preferences = rawPreferences && typeof rawPreferences === 'object' && !Array.isArray(rawPreferences) ? rawPreferences as Record<string, unknown> : {};
  const densityValue = String(preferences.density ?? 'comfortable');
  const density: DashboardDensity = densityValue === 'compact' ? 'compact' : 'comfortable';
  const showDescriptions = preferences.showDescriptions !== false;
  const now = Math.floor(Date.now() / 1000);
  const statements: D1Statement[] = [env.DB.prepare(`DELETE FROM user_dashboard_tiles WHERE user_id=?`).bind(user.id)];
  tiles.forEach((tile, position) => {
    statements.push(env.DB.prepare(`INSERT INTO user_dashboard_tiles(user_id,feature_id,position,size,pinned_at,updated_at) VALUES(?,?,?,?,?,?)`).bind(user.id, tile.featureId, position, tile.size, now, now));
  });
  statements.push(env.DB.prepare(`
    INSERT INTO user_dashboard_preferences(user_id,density,show_descriptions,initialized_at,updated_at)
    VALUES(?,?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET density=excluded.density,show_descriptions=excluded.show_descriptions,updated_at=excluded.updated_at
  `).bind(user.id, density, showDescriptions ? 1 : 0, now, now));
  statements.push(env.DB.prepare(`INSERT INTO audit_events(id,actor_user_id,event_type,target_type,target_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?)`).bind(
    crypto.randomUUID(), user.id, 'dashboard.layout_updated', 'user', user.id, JSON.stringify({ featureIds: tiles.map(tile => tile.featureId), density, showDescriptions }), now
  ));
  await env.DB.batch(statements);
  return secureJson(await dashboardPayload(env, user));
}

async function resetLayout(env: DashboardEnv, user: DashboardUser): Promise<Response> {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM user_dashboard_tiles WHERE user_id=?`).bind(user.id),
    env.DB.prepare(`DELETE FROM user_dashboard_preferences WHERE user_id=?`).bind(user.id),
    env.DB.prepare(`INSERT INTO audit_events(id,actor_user_id,event_type,target_type,target_id,metadata_json,created_at) VALUES(?,?,?,?,?,'{}',?)`).bind(crypto.randomUUID(), user.id, 'dashboard.layout_reset', 'user', user.id, now)
  ]);
  return secureJson(await dashboardPayload(env, user));
}

async function featureForUser(env: DashboardEnv, user: DashboardUser, slug: string) {
  const rows = await accessibleFeatures(env, user);
  const row = rows.find(feature => feature.slug.toLowerCase() === slug.toLowerCase());
  return row ? featureFromRow(row) : null;
}

async function adminCatalogue(env: DashboardEnv) {
  const [features, grants, groups] = await Promise.all([
    env.DB.prepare(`SELECT f.*,NULL AS position,NULL AS tile_size,'' AS matched_groups FROM dashboard_features f ORDER BY f.sort_order,f.name`).all<FeatureRow>(),
    env.DB.prepare(`SELECT feature_id,group_id FROM dashboard_feature_group_grants ORDER BY feature_id,group_id`).all<{ feature_id: string; group_id: string }>(),
    env.DB.prepare(`SELECT id,name,description FROM groups ORDER BY name`).all<{ id: string; name: string; description: string }>()
  ]);
  const grantsByFeature = new Map<string, string[]>();
  for (const grant of grants.results) {
    const list = grantsByFeature.get(grant.feature_id) ?? [];
    list.push(grant.group_id);
    grantsByFeature.set(grant.feature_id, list);
  }
  return {
    ok: true,
    features: features.results.map(row => ({ ...featureFromRow(row), groupIds: grantsByFeature.get(row.id) ?? [] })),
    groups: groups.results.map(group => ({ id: group.id, name: group.name, description: group.description }))
  };
}

function normalizedFeatureInput(data: Record<string, unknown>) {
  const slug = String(data.slug ?? '').trim().toLowerCase();
  const name = String(data.name ?? '').trim();
  const description = String(data.description ?? '').trim();
  const category = String(data.category ?? 'General').trim() || 'General';
  const featureTypeValue = String(data.featureType ?? 'workspace');
  const featureType = (['workspace', 'link', 'system'].includes(featureTypeValue) ? featureTypeValue : 'workspace') as 'workspace' | 'link' | 'system';
  const audienceValue = String(data.audience ?? 'groups');
  const audience = (['all', 'groups', 'admin', 'owner'].includes(audienceValue) ? audienceValue : 'groups') as 'all' | 'groups' | 'admin' | 'owner';
  const defaultSizeValue = String(data.defaultSize ?? 'medium') as DashboardSize;
  const defaultSize = VALID_SIZES.has(defaultSizeValue) ? defaultSizeValue : 'medium';
  const rawAllowed = Array.isArray(data.allowedSizes) ? data.allowedSizes : [defaultSize];
  const allowedSizes = [...new Set(rawAllowed.map(value => String(value)).filter((value): value is DashboardSize => VALID_SIZES.has(value as DashboardSize)))];
  if (!allowedSizes.includes(defaultSize)) allowedSizes.push(defaultSize);
  const routeValue = String(data.route ?? '').trim();
  const route = routeValue || (featureType === 'workspace' && slug ? `/feature/${slug}` : '');
  const iconText = String(data.iconText ?? 'GD').trim().slice(0, 3).toUpperCase() || 'GD';
  const groupIds = Array.isArray(data.groupIds) ? [...new Set(data.groupIds.map(value => String(value).trim()).filter(Boolean))] : [];
  const sortOrderNumber = Number(data.sortOrder ?? 0);
  return {
    slug, name, description, category, featureType, audience, defaultSize, allowedSizes,
    route, iconText, groupIds,
    isActive: data.isActive !== false,
    isDefault: data.isDefault === true,
    sortOrder: Number.isFinite(sortOrderNumber) ? Math.max(-10000, Math.min(10000, Math.trunc(sortOrderNumber))) : 0
  };
}

async function saveAdminFeature(request: Request, env: DashboardEnv, actor: DashboardUser, featureId: string | null): Promise<Response> {
  const data = await readJson(request);
  const input = normalizedFeatureInput(data);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug) || input.slug.length > 64 || input.name.length < 2 || input.name.length > 80 || input.description.length > 500 || input.category.length > 60) {
    return secureJson({ ok: false, message: 'Check the feature name, slug, category and description.' }, { status: 400 });
  }
  if (input.route && !input.route.startsWith('/')) return secureJson({ ok: false, message: 'Feature routes must be internal paths beginning with /.' }, { status: 400 });
  if (input.audience === 'groups' && input.groupIds.length === 0) return secureJson({ ok: false, message: 'Choose at least one access group.' }, { status: 400 });

  if (input.groupIds.length) {
    const knownGroups = await env.DB.prepare(`SELECT id FROM groups`).all<{ id: string }>();
    const known = new Set(knownGroups.results.map(group => group.id));
    if (input.groupIds.some(groupId => !known.has(groupId))) return secureJson({ ok: false, message: 'One or more access groups do not exist.' }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  const id = featureId ?? `feature-${crypto.randomUUID()}`;
  const statements: D1Statement[] = [];
  if (featureId) {
    const existing = await env.DB.prepare(`SELECT id FROM dashboard_features WHERE id=?`).bind(featureId).first<{ id: string }>();
    if (!existing) return secureJson({ ok: false, message: 'Dashboard feature not found.' }, { status: 404 });
    statements.push(env.DB.prepare(`
      UPDATE dashboard_features SET slug=?,name=?,description=?,category=?,feature_type=?,route=?,icon_text=?,audience=?,default_size=?,allowed_sizes=?,is_active=?,is_default=?,sort_order=?,updated_at=? WHERE id=?
    `).bind(input.slug, input.name, input.description, input.category, input.featureType, input.route, input.iconText, input.audience, input.defaultSize, input.allowedSizes.join(','), input.isActive ? 1 : 0, input.isDefault ? 1 : 0, input.sortOrder, now, id));
  } else {
    statements.push(env.DB.prepare(`
      INSERT INTO dashboard_features(id,slug,name,description,category,feature_type,route,icon_text,audience,default_size,allowed_sizes,is_active,is_default,sort_order,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(id, input.slug, input.name, input.description, input.category, input.featureType, input.route, input.iconText, input.audience, input.defaultSize, input.allowedSizes.join(','), input.isActive ? 1 : 0, input.isDefault ? 1 : 0, input.sortOrder, now, now));
  }
  statements.push(env.DB.prepare(`DELETE FROM dashboard_feature_group_grants WHERE feature_id=?`).bind(id));
  input.groupIds.forEach(groupId => statements.push(env.DB.prepare(`INSERT INTO dashboard_feature_group_grants(feature_id,group_id) VALUES(?,?)`).bind(id, groupId)));
  statements.push(env.DB.prepare(`INSERT INTO audit_events(id,actor_user_id,event_type,target_type,target_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?)`).bind(
    crypto.randomUUID(), actor.id, featureId ? 'dashboard.feature_updated' : 'dashboard.feature_created', 'dashboard_feature', id, JSON.stringify({ slug: input.slug, audience: input.audience, groupIds: input.groupIds }), now
  ));
  try {
    await env.DB.batch(statements);
  } catch {
    return secureJson({ ok: false, message: 'That feature slug is already in use or the feature could not be saved.' }, { status: 409 });
  }
  return secureJson(await adminCatalogue(env), { status: featureId ? 200 : 201 });
}

async function serveAsset(request: Request, env: DashboardEnv, pathname: string): Promise<Response> {
  const assetUrl = new URL(pathname, request.url);
  return env.ASSETS.fetch(new Request(assetUrl, { method: 'GET', headers: request.headers }));
}

export async function handleDashboardRequest(request: Request, env: DashboardEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/api/dashboard' && request.method === 'GET') {
    const user = await getDashboardUser(request, env);
    if (!user) return secureJson({ ok: false, message: 'Authentication required.' }, { status: 401 });
    return secureJson(await dashboardPayload(env, user));
  }

  if (path === '/api/dashboard/layout' && request.method === 'POST') {
    if (!sameOrigin(request)) return secureJson({ ok: false, message: 'Origin rejected.' }, { status: 403 });
    const user = await getDashboardUser(request, env);
    if (!user) return secureJson({ ok: false, message: 'Authentication required.' }, { status: 401 });
    return saveLayout(request, env, user);
  }

  if (path === '/api/dashboard/reset' && request.method === 'POST') {
    if (!sameOrigin(request)) return secureJson({ ok: false, message: 'Origin rejected.' }, { status: 403 });
    const user = await getDashboardUser(request, env);
    if (!user) return secureJson({ ok: false, message: 'Authentication required.' }, { status: 401 });
    return resetLayout(env, user);
  }

  const featureApiMatch = path.match(/^\/api\/dashboard\/features\/([a-z0-9-]+)$/i);
  if (featureApiMatch && request.method === 'GET') {
    const user = await getDashboardUser(request, env);
    if (!user) return secureJson({ ok: false, message: 'Authentication required.' }, { status: 401 });
    const feature = await featureForUser(env, user, featureApiMatch[1]!);
    return feature ? secureJson({ ok: true, feature }) : secureJson({ ok: false, message: 'Feature unavailable.' }, { status: 404 });
  }

  if (path === '/api/admin/dashboard/features' && request.method === 'GET') {
    const actor = await getDashboardUser(request, env);
    if (!actor?.isAdmin) return secureJson({ ok: false, message: 'Administrator access required.' }, { status: 403 });
    return secureJson(await adminCatalogue(env));
  }

  if (path === '/api/admin/dashboard/features' && request.method === 'POST') {
    if (!sameOrigin(request)) return secureJson({ ok: false, message: 'Origin rejected.' }, { status: 403 });
    const actor = await getDashboardUser(request, env);
    if (!actor?.isAdmin) return secureJson({ ok: false, message: 'Administrator access required.' }, { status: 403 });
    return saveAdminFeature(request, env, actor, null);
  }

  const adminFeatureMatch = path.match(/^\/api\/admin\/dashboard\/features\/([^/]+)$/);
  if (adminFeatureMatch && request.method === 'POST') {
    if (!sameOrigin(request)) return secureJson({ ok: false, message: 'Origin rejected.' }, { status: 403 });
    const actor = await getDashboardUser(request, env);
    if (!actor?.isAdmin) return secureJson({ ok: false, message: 'Administrator access required.' }, { status: 403 });
    return saveAdminFeature(request, env, actor, decodeURIComponent(adminFeatureMatch[1]!));
  }

  if (path === '/admin/dashboard' && request.method === 'GET') {
    const actor = await getDashboardUser(request, env);
    if (!actor) return new Response(null, { status: 303, headers: { Location: '/login' } });
    if (!actor.isAdmin) return new Response('Administrator access required.', { status: 403 });
    return serveAsset(request, env, '/admin-dashboard.html');
  }

  const featurePageMatch = path.match(/^\/feature\/([a-z0-9-]+)$/i);
  if (featurePageMatch && request.method === 'GET') {
    const user = await getDashboardUser(request, env);
    if (!user) return new Response(null, { status: 303, headers: { Location: '/login' } });
    const feature = await featureForUser(env, user, featurePageMatch[1]!);
    if (!feature) return new Response('Feature unavailable.', { status: 404 });
    return serveAsset(request, env, '/feature.html');
  }

  return null;
}
