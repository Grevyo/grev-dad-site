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

type LegacyDashboardSize = 'small' | 'medium' | 'wide' | 'large';
type DashboardDensity = 'comfortable' | 'compact';
type TileColour = 'default' | 'graphite' | 'blue' | 'cyan' | 'green' | 'amber' | 'red' | 'purple' | 'pink';
type TilePresentation = 'action' | 'content';
type Dimension = { width: number; height: number };
type TilePlacement = Dimension & { featureId: string; x: number; y: number; colour?: TileColour };

type FeatureRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  feature_type: 'workspace' | 'link' | 'system';
  tile_presentation: TilePresentation;
  route: string;
  icon_text: string;
  audience: 'all' | 'groups' | 'admin' | 'owner';
  default_size: LegacyDashboardSize;
  allowed_sizes: string;
  default_width: number;
  default_height: number;
  allowed_dimensions: string;
  is_active: number;
  is_default: number;
  sort_order: number;
  position: number | null;
  grid_x: number | null;
  grid_y: number | null;
  tile_width: number | null;
  tile_height: number | null;
  tile_colour: string | null;
  matched_groups: string;
};

const COOKIE = 'grev_session';
const encoder = new TextEncoder();
const GRID_COLUMNS = 6;
const MAX_GRID_Y = 199;
const MAX_TILES = 60;
const VALID_DENSITIES = new Set<DashboardDensity>(['comfortable', 'compact']);
const VALID_GAPS = new Set([0, 4, 8, 12, 16, 20, 24, 32, 40, 48]);
const VALID_MARGINS = new Set([0, 8, 12, 16, 24, 32, 40, 48, 56, 64]);
const ALL_DIMENSIONS = Array.from({ length: 4 }, (_, heightIndex) =>
  Array.from({ length: GRID_COLUMNS }, (_, widthIndex) => `${widthIndex + 1}x${heightIndex + 1}`)
).flat();
const VALID_DIMENSIONS = new Set(ALL_DIMENSIONS);
const VALID_TILE_COLOURS = new Set<TileColour>(['default','graphite','blue','cyan','green','amber','red','purple','pink']);

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

function dimensionKey(width: number, height: number): string {
  return `${width}x${height}`;
}

function parseDimension(value: unknown): Dimension | null {
  const match = String(value ?? '').trim().toLowerCase().match(/^(\d+)x(\d+)$/);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return VALID_DIMENSIONS.has(dimensionKey(width, height)) ? { width, height } : null;
}

function dimensionsFromCsv(value: string): string[] {
  const result = [...new Set(value.split(',').map(item => item.trim()).filter(item => VALID_DIMENSIONS.has(item)))];
  return result.length ? result : ['2x1'];
}

function legacySizeForDimension(width: number, height: number): LegacyDashboardSize {
  if (width === 1 && height === 1) return 'small';
  if (height === 1 && width <= 2) return 'medium';
  if (width >= 4) return 'wide';
  return 'large';
}

function overlaps(a: TilePlacement, b: TilePlacement): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function validPlacement(tile: TilePlacement): boolean {
  return Number.isInteger(tile.x) && Number.isInteger(tile.y) && Number.isInteger(tile.width) && Number.isInteger(tile.height)
    && tile.x >= 0 && tile.y >= 0 && tile.y <= MAX_GRID_Y
    && tile.width >= 1 && tile.width <= GRID_COLUMNS && tile.height >= 1 && tile.height <= 4
    && tile.x + tile.width <= GRID_COLUMNS && tile.y + tile.height <= MAX_GRID_Y + 1;
}

function firstFreePlacement(existing: TilePlacement[], width: number, height: number): Omit<TilePlacement, 'featureId'> {
  for (let y = 0; y <= MAX_GRID_Y - height + 1; y += 1) {
    for (let x = 0; x <= GRID_COLUMNS - width; x += 1) {
      const candidate: TilePlacement = { featureId: '', x, y, width, height };
      if (!existing.some(tile => overlaps(candidate, tile))) return { x, y, width, height };
    }
  }
  return { x: 0, y: MAX_GRID_Y - height + 1, width, height };
}

function featureFromRow(row: FeatureRow) {
  const allowedDimensions = dimensionsFromCsv(row.allowed_dimensions);
  const width = row.tile_width ?? row.default_width;
  const height = row.tile_height ?? row.default_height;
  const colourValue = String(row.tile_colour ?? 'default') as TileColour;
  const tileColour = VALID_TILE_COLOURS.has(colourValue) ? colourValue : 'default';
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    category: row.category,
    featureType: row.feature_type,
    presentation: row.tile_presentation === 'content' ? 'content' : 'action',
    route: row.route,
    iconText: row.icon_text,
    audience: row.audience,
    defaultDimension: dimensionKey(row.default_width, row.default_height),
    defaultWidth: row.default_width,
    defaultHeight: row.default_height,
    allowedDimensions,
    isActive: Boolean(row.is_active),
    isDefault: Boolean(row.is_default),
    sortOrder: row.sort_order,
    pinned: row.grid_x !== null,
    position: row.position,
    x: row.grid_x,
    y: row.grid_y,
    width,
    height,
    dimension: dimensionKey(width, height),
    tileColour,
    accessGroups: row.matched_groups ? row.matched_groups.split(', ') : []
  };
}

async function accessibleFeatures(env: DashboardEnv, user: DashboardUser): Promise<FeatureRow[]> {
  const rows = await env.DB.prepare(`
    SELECT f.*,
      t.position,
      t.grid_x,
      t.grid_y,
      t.tile_width,
      t.tile_height,
      t.tile_colour,
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
    ORDER BY CASE WHEN t.grid_x IS NULL THEN 1 ELSE 0 END,t.grid_y,t.grid_x,f.sort_order,f.name
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
    SELECT f.*,NULL AS position,NULL AS grid_x,NULL AS grid_y,NULL AS tile_width,NULL AS tile_height,NULL AS tile_colour,'' AS matched_groups
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
    LIMIT 20
  `).bind(user.isAdmin ? 1 : 0, user.isOwner ? 1 : 0, user.id).all<FeatureRow>();
  return rows.results;
}

function defaultPlacements(features: FeatureRow[]): TilePlacement[] {
  const placements: TilePlacement[] = [];
  for (const feature of features) {
    const width = Math.max(1, Math.min(GRID_COLUMNS, feature.default_width));
    const height = Math.max(1, Math.min(4, feature.default_height));
    const location = firstFreePlacement(placements, width, height);
    placements.push({ featureId: feature.id, ...location });
  }
  return placements;
}

async function ensureDashboardInitialized(env: DashboardEnv, user: DashboardUser): Promise<void> {
  const existing = await env.DB.prepare(`SELECT user_id FROM user_dashboard_preferences WHERE user_id=?`).bind(user.id).first<{ user_id: string }>();
  if (existing) return;
  const defaults = await defaultFeatures(env, user);
  const placements = defaultPlacements(defaults);
  const now = Math.floor(Date.now() / 1000);
  const statements: D1Statement[] = [
    env.DB.prepare(`INSERT OR IGNORE INTO user_dashboard_preferences(user_id,density,show_descriptions,tile_gap,outer_margin,initialized_at,updated_at) VALUES(?,'comfortable',1,12,0,?,?)`).bind(user.id, now, now)
  ];
  placements.forEach((tile, position) => {
    statements.push(env.DB.prepare(`
      INSERT OR IGNORE INTO user_dashboard_tiles(user_id,feature_id,position,size,grid_x,grid_y,tile_width,tile_height,tile_colour,pinned_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)
    `).bind(user.id, tile.featureId, position, legacySizeForDimension(tile.width, tile.height), tile.x, tile.y, tile.width, tile.height, 'default', now, now));
  });
  await env.DB.batch(statements);
}

async function dashboardPayload(env: DashboardEnv, user: DashboardUser) {
  await ensureDashboardInitialized(env, user);
  const [rows, preferences] = await Promise.all([
    accessibleFeatures(env, user),
    env.DB.prepare(`SELECT density,show_descriptions,tile_gap,outer_margin,initialized_at,updated_at FROM user_dashboard_preferences WHERE user_id=?`).bind(user.id).first<{
      density: DashboardDensity;
      show_descriptions: number;
      tile_gap: number;
      outer_margin: number;
      initialized_at: number;
      updated_at: number;
    }>()
  ]);
  const features = rows.map(featureFromRow);
  return {
    ok: true,
    viewer: { id: user.id, username: user.username, displayName: user.displayName, isAdmin: user.isAdmin, isOwner: user.isOwner },
    grid: { columns: GRID_COLUMNS, maxY: MAX_GRID_Y, dimensions: ALL_DIMENSIONS },
    features,
    pinnedTiles: features.filter(feature => feature.pinned).sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0)),
    preferences: {
      density: preferences?.density ?? 'comfortable',
      showDescriptions: Boolean(preferences?.show_descriptions ?? 1),
      tileGap: preferences?.tile_gap ?? 12,
      outerMargin: preferences?.outer_margin ?? 0,
      initializedAt: preferences?.initialized_at ?? null,
      updatedAt: preferences?.updated_at ?? null
    },
    capabilities: { canCustomize: true, isAdmin: user.isAdmin, isOwner: user.isOwner }
  };
}

async function saveLayout(request: Request, env: DashboardEnv, user: DashboardUser): Promise<Response> {
  const data = await readJson(request);
  const rawTiles = data.tiles;
  if (!Array.isArray(rawTiles) || rawTiles.length > MAX_TILES) return secureJson({ ok: false, message: `Choose up to ${MAX_TILES} dashboard tiles.` }, { status: 400 });

  const availableRows = await accessibleFeatures(env, user);
  const available = new Map(availableRows.map(row => [row.id, row]));
  const seen = new Set<string>();
  const tiles: TilePlacement[] = [];

  for (const rawTile of rawTiles) {
    if (!rawTile || typeof rawTile !== 'object' || Array.isArray(rawTile)) return secureJson({ ok: false, message: 'The dashboard layout is invalid.' }, { status: 400 });
    const item = rawTile as Record<string, unknown>;
    const featureId = String(item.featureId ?? '').trim();
    const feature = available.get(featureId);
    const tile: TilePlacement = {
      featureId,
      x: Number(item.x),
      y: Number(item.y),
      width: Number(item.width),
      height: Number(item.height),
      colour: String(item.colour ?? 'default') as TileColour
    };
    if (!VALID_TILE_COLOURS.has(tile.colour ?? 'default')) return secureJson({ ok: false, message: 'Choose a valid tile colour.' }, { status: 400 });
    if (!feature || seen.has(featureId) || !validPlacement(tile)) return secureJson({ ok: false, message: 'The dashboard contains an unavailable, duplicate, or out-of-bounds tile.' }, { status: 400 });
    const allowed = new Set(dimensionsFromCsv(feature.allowed_dimensions));
    if (!allowed.has(dimensionKey(tile.width, tile.height))) return secureJson({ ok: false, message: `${feature.name} does not support ${tile.width}×${tile.height}.` }, { status: 400 });
    if (tiles.some(existing => overlaps(existing, tile))) return secureJson({ ok: false, message: `${feature.name} overlaps another tile. Move it into empty grid space.` }, { status: 400 });
    seen.add(featureId);
    tiles.push(tile);
  }

  const rawPreferences = data.preferences;
  const preferences = rawPreferences && typeof rawPreferences === 'object' && !Array.isArray(rawPreferences) ? rawPreferences as Record<string, unknown> : {};
  const densityValue = String(preferences.density ?? 'comfortable') as DashboardDensity;
  const density = VALID_DENSITIES.has(densityValue) ? densityValue : 'comfortable';
  const showDescriptions = preferences.showDescriptions !== false;
  const gapValue = Number(preferences.tileGap ?? 12);
  const marginValue = Number(preferences.outerMargin ?? 0);
  const tileGap = VALID_GAPS.has(gapValue) ? gapValue : 12;
  const outerMargin = VALID_MARGINS.has(marginValue) ? marginValue : 0;
  const now = Math.floor(Date.now() / 1000);
  const statements: D1Statement[] = [env.DB.prepare(`DELETE FROM user_dashboard_tiles WHERE user_id=?`).bind(user.id)];
  tiles.forEach((tile, position) => {
    statements.push(env.DB.prepare(`
      INSERT INTO user_dashboard_tiles(user_id,feature_id,position,size,grid_x,grid_y,tile_width,tile_height,tile_colour,pinned_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)
    `).bind(user.id, tile.featureId, position, legacySizeForDimension(tile.width, tile.height), tile.x, tile.y, tile.width, tile.height, tile.colour ?? 'default', now, now));
  });
  statements.push(env.DB.prepare(`
    INSERT INTO user_dashboard_preferences(user_id,density,show_descriptions,tile_gap,outer_margin,initialized_at,updated_at)
    VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET density=excluded.density,show_descriptions=excluded.show_descriptions,tile_gap=excluded.tile_gap,outer_margin=excluded.outer_margin,updated_at=excluded.updated_at
  `).bind(user.id, density, showDescriptions ? 1 : 0, tileGap, outerMargin, now, now));
  statements.push(env.DB.prepare(`INSERT INTO audit_events(id,actor_user_id,event_type,target_type,target_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?)`).bind(
    crypto.randomUUID(), user.id, 'dashboard.grid_updated', 'user', user.id,
    JSON.stringify({ tiles: tiles.map(tile => ({ featureId: tile.featureId, x: tile.x, y: tile.y, width: tile.width, height: tile.height, colour: tile.colour ?? 'default' })), density, showDescriptions, tileGap, outerMargin }), now
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
    env.DB.prepare(`SELECT f.*,NULL AS position,NULL AS grid_x,NULL AS grid_y,NULL AS tile_width,NULL AS tile_height,NULL AS tile_colour,'' AS matched_groups FROM dashboard_features f ORDER BY f.sort_order,f.name`).all<FeatureRow>(),
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
    grid: { columns: GRID_COLUMNS, dimensions: ALL_DIMENSIONS },
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
  const hasPresentation = Object.prototype.hasOwnProperty.call(data, 'presentation');
  const presentationValue = String(data.presentation ?? 'action');
  const presentation = hasPresentation
    ? (['action', 'content'].includes(presentationValue) ? presentationValue : 'action') as TilePresentation
    : null;
  const audienceValue = String(data.audience ?? 'groups');
  const audience = (['all', 'groups', 'admin', 'owner'].includes(audienceValue) ? audienceValue : 'groups') as 'all' | 'groups' | 'admin' | 'owner';
  const defaultDimension = parseDimension(data.defaultDimension) ?? { width: 2, height: 1 };
  const rawAllowed = Array.isArray(data.allowedDimensions) ? data.allowedDimensions : [dimensionKey(defaultDimension.width, defaultDimension.height)];
  const allowedDimensions = [...new Set(rawAllowed.map(value => String(value).trim()).filter(value => VALID_DIMENSIONS.has(value)))];
  const defaultKey = dimensionKey(defaultDimension.width, defaultDimension.height);
  if (!allowedDimensions.includes(defaultKey)) allowedDimensions.push(defaultKey);
  const routeValue = String(data.route ?? '').trim();
  const route = routeValue || (featureType === 'workspace' && slug ? `/feature/${slug}` : '');
  const iconText = String(data.iconText ?? 'GD').trim().slice(0, 3).toUpperCase() || 'GD';
  const groupIds = Array.isArray(data.groupIds) ? [...new Set(data.groupIds.map(value => String(value).trim()).filter(Boolean))] : [];
  const sortOrderNumber = Number(data.sortOrder ?? 0);
  return {
    slug, name, description, category, featureType, presentation, audience, defaultDimension, allowedDimensions,
    route, iconText, groupIds,
    isActive: data.isActive !== false,
    isDefault: data.isDefault === true,
    sortOrder: Number.isFinite(sortOrderNumber) ? Math.max(-10000, Math.min(10000, Math.trunc(sortOrderNumber))) : 0
  };
}

async function saveAdminFeature(request: Request, env: DashboardEnv, actor: DashboardUser, featureId: string | null): Promise<Response> {
  const data = await readJson(request);
  const input = normalizedFeatureInput(data);
  let presentation: TilePresentation = input.presentation ?? 'action';
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
  const legacySize = legacySizeForDimension(input.defaultDimension.width, input.defaultDimension.height);
  const statements: D1Statement[] = [];
  if (featureId) {
    const existing = await env.DB.prepare(`SELECT id,tile_presentation FROM dashboard_features WHERE id=?`).bind(featureId).first<{ id: string; tile_presentation: string }>();
    if (!existing) return secureJson({ ok: false, message: 'Dashboard feature not found.' }, { status: 404 });
    presentation = input.presentation ?? (existing.tile_presentation === 'content' ? 'content' : 'action');
    statements.push(env.DB.prepare(`
      UPDATE dashboard_features
      SET slug=?,name=?,description=?,category=?,feature_type=?,tile_presentation=?,route=?,icon_text=?,audience=?,default_size=?,allowed_sizes=?,default_width=?,default_height=?,allowed_dimensions=?,is_active=?,is_default=?,sort_order=?,updated_at=?
      WHERE id=?
    `).bind(input.slug, input.name, input.description, input.category, input.featureType, presentation, input.route, input.iconText, input.audience, legacySize, legacySize, input.defaultDimension.width, input.defaultDimension.height, input.allowedDimensions.join(','), input.isActive ? 1 : 0, input.isDefault ? 1 : 0, input.sortOrder, now, id));
  } else {
    statements.push(env.DB.prepare(`
      INSERT INTO dashboard_features(id,slug,name,description,category,feature_type,tile_presentation,route,icon_text,audience,default_size,allowed_sizes,default_width,default_height,allowed_dimensions,is_active,is_default,sort_order,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(id, input.slug, input.name, input.description, input.category, input.featureType, presentation, input.route, input.iconText, input.audience, legacySize, legacySize, input.defaultDimension.width, input.defaultDimension.height, input.allowedDimensions.join(','), input.isActive ? 1 : 0, input.isDefault ? 1 : 0, input.sortOrder, now, now));
  }
  statements.push(env.DB.prepare(`DELETE FROM dashboard_feature_group_grants WHERE feature_id=?`).bind(id));
  input.groupIds.forEach(groupId => statements.push(env.DB.prepare(`INSERT INTO dashboard_feature_group_grants(feature_id,group_id) VALUES(?,?)`).bind(id, groupId)));
  statements.push(env.DB.prepare(`INSERT INTO audit_events(id,actor_user_id,event_type,target_type,target_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?)`).bind(
    crypto.randomUUID(), actor.id, featureId ? 'dashboard.feature_updated' : 'dashboard.feature_created', 'dashboard_feature', id,
    JSON.stringify({ slug: input.slug, presentation, audience: input.audience, groupIds: input.groupIds, defaultDimension: dimensionKey(input.defaultDimension.width, input.defaultDimension.height), allowedDimensions: input.allowedDimensions }), now
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
