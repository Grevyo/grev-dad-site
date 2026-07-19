import { type ProfileEnv } from './profile';
import { handleProfileMediaRequest } from './profile-media';

interface D1Result<T> { results: T[]; }
interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<unknown>;
}

type Viewer = { id: string; isOwner: boolean; isAdmin: boolean };
type CardTileKind = 'feature' | 'link' | 'custom';
type ContentMode = 'standard' | 'media-button';
type BackgroundType = 'solid' | 'gradient' | 'media';
type FontFamily = 'system' | 'display' | 'mono' | 'serif' | 'rounded';
type MediaFit = 'cover' | 'contain' | 'stretch';
type MediaOverlay = 'none' | 'dark' | 'light';
type IconMode = 'text' | 'image';

type Feature = {
  id: string;
  name: string;
  description: string;
  category: string;
  route: string;
  iconText: string;
  presentation: 'action' | 'content';
};

type CardTile = {
  tileId: string;
  tileKind: CardTileKind;
  featureId: string | null;
  position: number;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string | null;
  description: string | null;
  linkLabel: string | null;
  linkUrl: string | null;
  contentMode: ContentMode;
  customTitle: string | null;
  customIcon: string | null;
  backgroundType: BackgroundType;
  backgroundPrimary: string;
  backgroundSecondary: string;
  backgroundAngle: number;
  backgroundMedia: string | null;
  textColour: string;
  fontFamily: FontFamily;
  borderColour: string;
  mediaFit: MediaFit;
  mediaOverlay: MediaOverlay;
  iconMode: IconMode;
  iconLabel: string | null;
  iconMedia: string | null;
  iconTextColour: string;
  iconBackgroundColour: string;
  iconBorderColour: string;
  iconMediaFit: MediaFit;
  feature: Feature | null;
};

type StoredTileRow = {
  tile_id: string;
  tile_kind: CardTileKind;
  feature_id: string | null;
  position: number;
  grid_x: number;
  grid_y: number;
  tile_width: number;
  tile_height: number;
  title: string | null;
  description: string | null;
  link_label: string | null;
  link_url: string | null;
  content_mode: ContentMode;
  custom_title: string | null;
  custom_icon: string | null;
  background_type: BackgroundType;
  background_primary: string;
  background_secondary: string;
  background_angle: number;
  text_colour: string;
  font_family: FontFamily;
  border_colour: string;
  media_fit: MediaFit;
  media_overlay: MediaOverlay;
  icon_mode: IconMode;
  icon_label: string | null;
  icon_text_colour: string;
  icon_background_colour: string;
  icon_border_colour: string;
  icon_media_fit: MediaFit;
};

type MediaRow = { tile_id: string; media_slot: 'background' | 'icon'; media_data: string };
type PreparedTile = Omit<CardTile, 'feature'> & { feature: Feature | null };

const COOKIE = 'grev_session';
const encoder = new TextEncoder();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_COLOUR = /^#[0-9a-f]{6}$/i;
const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp|gif);base64,([a-z0-9+/]+={0,2})$/i;
const MAX_MEDIA_BYTES = 1_400_000;
const MAX_PROFILE_MEDIA_BYTES = 8 * 1024 * 1024;
const MAX_CARD_TILES = 4;
const CARD_COLUMNS = 4;
const MAX_CARD_Y = 7;
const VALID_KINDS = new Set<CardTileKind>(['feature', 'link', 'custom']);
const VALID_CONTENT_MODES = new Set<ContentMode>(['standard', 'media-button']);
const VALID_BACKGROUND_TYPES = new Set<BackgroundType>(['solid', 'gradient', 'media']);
const VALID_FONTS = new Set<FontFamily>(['system', 'display', 'mono', 'serif', 'rounded']);
const VALID_MEDIA_FITS = new Set<MediaFit>(['cover', 'contain', 'stretch']);
const VALID_OVERLAYS = new Set<MediaOverlay>(['none', 'dark', 'light']);
const VALID_ICON_MODES = new Set<IconMode>(['text', 'image']);

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
  return new Response(JSON.stringify(payload), { status: response.status, statusText: response.statusText, headers });
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

async function getViewer(request: Request, env: ProfileEnv): Promise<Viewer | null> {
  const token = parseCookies(request)[COOKIE];
  if (!token) return null;
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(`
    SELECT u.id,u.is_owner,
      CASE WHEN u.is_owner=1 OR EXISTS(
        SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role_id='role-admin'
      ) THEN 1 ELSE 0 END AS is_admin
    FROM sessions s
    JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.status='active'
  `).bind(await sha256(token), now).first<{ id: string; is_owner: number; is_admin: number }>();
  return row ? { id: row.id, isOwner: Boolean(row.is_owner), isAdmin: Boolean(row.is_admin) } : null;
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  return !origin || origin === new URL(request.url).origin;
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

function optionalText(value: unknown, max: number): string | null | undefined {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.length <= max ? normalized : undefined;
}

function optionalHttpUrl(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.length > 500) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function overlaps(a: Pick<CardTile, 'x' | 'y' | 'width' | 'height'>, b: Pick<CardTile, 'x' | 'y' | 'width' | 'height'>): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function validPlacement(tile: Pick<CardTile, 'x' | 'y' | 'width' | 'height'>): boolean {
  return Number.isInteger(tile.x) && Number.isInteger(tile.y) && Number.isInteger(tile.width) && Number.isInteger(tile.height)
    && tile.x >= 0 && tile.y >= 0 && tile.y <= MAX_CARD_Y
    && tile.width >= 1 && tile.width <= CARD_COLUMNS && tile.height >= 1 && tile.height <= 2
    && tile.x + tile.width <= CARD_COLUMNS && tile.y + tile.height <= MAX_CARD_Y + 1;
}

async function accessibleFeatures(env: ProfileEnv, viewer: Viewer): Promise<Map<string, Feature>> {
  const rows = await env.DB.prepare(`
    SELECT f.id,f.name,f.description,f.category,f.route,f.icon_text,f.tile_presentation
    FROM dashboard_features f
    WHERE f.is_active=1 AND (
      ?=1 OR f.audience='all'
      OR (f.audience='admin' AND ?=1)
      OR (f.audience='owner' AND ?=1)
      OR (f.audience='groups' AND EXISTS(
        SELECT 1
        FROM dashboard_feature_group_grants fg
        JOIN group_memberships gm ON gm.group_id=fg.group_id
        WHERE fg.feature_id=f.id AND gm.user_id=?
      ))
    )
    ORDER BY f.category,f.sort_order,f.name
  `).bind(viewer.isOwner ? 1 : 0, viewer.isAdmin ? 1 : 0, viewer.isOwner ? 1 : 0, viewer.id).all<{
    id: string; name: string; description: string; category: string; route: string; icon_text: string; tile_presentation: string;
  }>();
  return new Map(rows.results.map(row => [row.id, {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    route: row.route,
    iconText: row.icon_text,
    presentation: row.tile_presentation === 'content' ? 'content' : 'action'
  }]));
}

async function loadCardTiles(env: ProfileEnv, profileId: string, viewer: Viewer): Promise<CardTile[]> {
  const [rows, mediaRows, available] = await Promise.all([
    env.DB.prepare(`
      SELECT tile_id,tile_kind,feature_id,position,grid_x,grid_y,tile_width,tile_height,title,description,
        link_label,link_url,content_mode,custom_title,custom_icon,background_type,background_primary,
        background_secondary,background_angle,text_colour,font_family,border_colour,media_fit,media_overlay,
        icon_mode,icon_label,icon_text_colour,icon_background_colour,icon_border_colour,icon_media_fit
      FROM user_profile_card_tiles
      WHERE user_id=?
      ORDER BY position
    `).bind(profileId).all<StoredTileRow>(),
    env.DB.prepare(`
      SELECT tile_id,media_slot,media_data
      FROM user_profile_card_tile_media
      WHERE user_id=?
    `).bind(profileId).all<MediaRow>(),
    accessibleFeatures(env, viewer)
  ]);
  const media = new Map(mediaRows.results.map(row => [`${row.tile_id}:${row.media_slot}`, row.media_data]));
  return rows.results.flatMap(row => {
    const feature = row.feature_id ? available.get(row.feature_id) ?? null : null;
    if (row.tile_kind === 'feature' && !feature) return [];
    return [{
      tileId: row.tile_id,
      tileKind: row.tile_kind,
      featureId: row.feature_id,
      position: row.position,
      x: row.grid_x,
      y: row.grid_y,
      width: row.tile_width,
      height: row.tile_height,
      title: row.title,
      description: row.description,
      linkLabel: row.link_label,
      linkUrl: row.link_url,
      contentMode: row.content_mode,
      customTitle: row.custom_title,
      customIcon: row.custom_icon,
      backgroundType: row.background_type,
      backgroundPrimary: row.background_primary,
      backgroundSecondary: row.background_secondary,
      backgroundAngle: row.background_angle,
      backgroundMedia: media.get(`${row.tile_id}:background`) ?? null,
      textColour: row.text_colour,
      fontFamily: row.font_family,
      borderColour: row.border_colour,
      mediaFit: row.media_fit,
      mediaOverlay: row.media_overlay,
      iconMode: row.icon_mode,
      iconLabel: row.icon_label,
      iconMedia: media.get(`${row.tile_id}:icon`) ?? null,
      iconTextColour: row.icon_text_colour,
      iconBackgroundColour: row.icon_background_colour,
      iconBorderColour: row.icon_border_colour,
      iconMediaFit: row.icon_media_fit,
      feature
    }];
  });
}

async function injectCardTiles(response: Response, request: Request, env: ProfileEnv): Promise<Response> {
  if (!response.ok) return response;
  const viewer = await getViewer(request, env);
  if (!viewer) return response;
  const payload = await response.json() as { profile?: { id?: unknown; isSelf?: boolean; cardTiles?: CardTile[]; cardTileGrid?: unknown } };
  const profileId = typeof payload.profile?.id === 'string' ? payload.profile.id : null;
  if (!profileId || !payload.profile) return responseWithPayload(response, payload);
  payload.profile.cardTiles = await loadCardTiles(env, profileId, viewer);
  payload.profile.cardTileGrid = {
    columns: CARD_COLUMNS,
    maxTiles: MAX_CARD_TILES,
    maxY: MAX_CARD_Y,
    dimensions: Array.from({ length: 2 }, (_, heightIndex) =>
      Array.from({ length: CARD_COLUMNS }, (_, widthIndex) => `${widthIndex + 1}x${heightIndex + 1}`)
    ).flat()
  };
  return responseWithPayload(response, payload);
}

async function otherProfileMediaBytes(env: ProfileEnv, userId: string): Promise<number> {
  const [profileMedia, lowerTileMedia] = await Promise.all([
    env.DB.prepare(`SELECT media_data FROM user_profile_media WHERE user_id=?`).bind(userId).all<{ media_data: string }>(),
    env.DB.prepare(`SELECT background_media FROM user_profile_tiles WHERE user_id=? AND background_media IS NOT NULL`).bind(userId).all<{ background_media: string }>()
  ]);
  return [...profileMedia.results.map(row => row.media_data), ...lowerTileMedia.results.map(row => row.background_media)]
    .reduce((total, media) => total + dataUrlByteLength(media), 0);
}

async function prepareTiles(rawTiles: unknown, env: ProfileEnv, viewer: Viewer, includeStoredOtherMedia = true): Promise<{ tiles: PreparedTile[] } | Response> {
  if (!Array.isArray(rawTiles) || rawTiles.length > MAX_CARD_TILES) {
    return secureJson({ ok: false, message: 'Choose up to four profile-card tiles.' }, 400);
  }
  const available = await accessibleFeatures(env, viewer);
  const tiles: PreparedTile[] = [];
  const ids = new Set<string>();
  const positions = new Set<number>();
  let cardMediaBytes = 0;

  for (const value of rawTiles) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return secureJson({ ok: false, message: 'The profile-card tile layout is invalid.' }, 400);
    }
    const item = value as Record<string, unknown>;
    const tileId = String(item.tileId ?? '').trim();
    const tileKind = String(item.tileKind ?? '') as CardTileKind;
    const featureIdRaw = item.featureId === null || item.featureId === undefined || item.featureId === '' ? null : String(item.featureId);
    const position = Number(item.position);
    const x = Number(item.x);
    const y = Number(item.y);
    const width = Number(item.width);
    const height = Number(item.height);
    if (!UUID_RE.test(tileId) || ids.has(tileId) || !VALID_KINDS.has(tileKind) || !Number.isInteger(position) || position < 0 || position >= MAX_CARD_TILES || positions.has(position)) {
      return secureJson({ ok: false, message: 'The profile-card tiles contain an invalid or duplicate item.' }, 400);
    }
    if (!validPlacement({ x, y, width, height })) {
      return secureJson({ ok: false, message: 'Every profile-card tile must stay inside the four-column mini grid.' }, 400);
    }
    if (tiles.some(tile => overlaps(tile, { x, y, width, height }))) {
      return secureJson({ ok: false, message: 'Profile-card tiles may not overlap.' }, 400);
    }

    const feature = tileKind === 'feature' && featureIdRaw ? available.get(featureIdRaw) ?? null : null;
    if (tileKind === 'feature' && !feature) {
      return secureJson({ ok: false, message: 'Choose a site tile that is available to this account.' }, 400);
    }
    const featureId = tileKind === 'feature' ? featureIdRaw : null;
    const title = optionalText(item.title, 80);
    const description = optionalText(item.description, 500);
    const linkLabel = optionalText(item.linkLabel, 80);
    const linkUrl = optionalHttpUrl(item.linkUrl);
    const customTitle = optionalText(item.customTitle, 80);
    const customIcon = optionalText(item.customIcon, 12);
    const iconLabel = optionalText(item.iconLabel, 6);
    if ([title, description, linkLabel, linkUrl, customTitle, customIcon, iconLabel].some(result => result === undefined)) {
      return secureJson({ ok: false, message: 'Check the profile-card tile text and link fields.' }, 400);
    }
    if (tileKind === 'link' && !linkUrl) {
      return secureJson({ ok: false, message: 'External link tiles need a valid HTTP or HTTPS address.' }, 400);
    }

    const contentMode = String(item.contentMode ?? 'standard') as ContentMode;
    const backgroundType = String(item.backgroundType ?? 'solid') as BackgroundType;
    const fontFamily = String(item.fontFamily ?? 'system') as FontFamily;
    const mediaFit = String(item.mediaFit ?? 'cover') as MediaFit;
    const mediaOverlay = String(item.mediaOverlay ?? 'dark') as MediaOverlay;
    const iconMode = String(item.iconMode ?? 'text') as IconMode;
    const iconMediaFit = String(item.iconMediaFit ?? 'cover') as MediaFit;
    const backgroundPrimary = String(item.backgroundPrimary ?? '#11161d').toLowerCase();
    const backgroundSecondary = String(item.backgroundSecondary ?? '#5268aa').toLowerCase();
    const textColour = String(item.textColour ?? '#f4f7fb').toLowerCase();
    const borderColour = String(item.borderColour ?? '#394657').toLowerCase();
    const iconTextColour = String(item.iconTextColour ?? '#090b0f').toLowerCase();
    const iconBackgroundColour = String(item.iconBackgroundColour ?? '#f3f5f8').toLowerCase();
    const iconBorderColour = String(item.iconBorderColour ?? '#667181').toLowerCase();
    const backgroundAngle = Number(item.backgroundAngle ?? 135);
    const backgroundMedia = optionalMedia(item.backgroundMedia);
    const submittedIconMedia = optionalMedia(item.iconMedia);
    if (!VALID_CONTENT_MODES.has(contentMode) || !VALID_BACKGROUND_TYPES.has(backgroundType) || !VALID_FONTS.has(fontFamily)
      || !VALID_MEDIA_FITS.has(mediaFit) || !VALID_MEDIA_FITS.has(iconMediaFit) || !VALID_OVERLAYS.has(mediaOverlay) || !VALID_ICON_MODES.has(iconMode)
      || !HEX_COLOUR.test(backgroundPrimary) || !HEX_COLOUR.test(backgroundSecondary) || !HEX_COLOUR.test(textColour) || !HEX_COLOUR.test(borderColour)
      || !HEX_COLOUR.test(iconTextColour) || !HEX_COLOUR.test(iconBackgroundColour) || !HEX_COLOUR.test(iconBorderColour)
      || !Number.isInteger(backgroundAngle) || backgroundAngle < 0 || backgroundAngle > 360
      || backgroundMedia === undefined || submittedIconMedia === undefined) {
      return secureJson({ ok: false, message: 'Choose valid profile-card tile colours, fonts, pictures and display modes.' }, 400);
    }
    const iconMedia = contentMode === 'standard' && iconMode === 'image' ? submittedIconMedia : null;
    if (backgroundType === 'media' && !backgroundMedia) {
      return secureJson({ ok: false, message: 'Picture backgrounds need an uploaded PNG, JPEG, WebP or animated GIF.' }, 400);
    }
    if (contentMode === 'media-button' && (backgroundType !== 'media' || !backgroundMedia)) {
      return secureJson({ ok: false, message: 'Full media card tiles need a picture or animated GIF background.' }, 400);
    }
    if (contentMode === 'standard' && iconMode === 'image' && !iconMedia) {
      return secureJson({ ok: false, message: 'Picture icons need an uploaded PNG, JPEG, WebP or animated GIF.' }, 400);
    }
    if (backgroundMedia) cardMediaBytes += dataUrlByteLength(backgroundMedia);
    if (iconMedia) cardMediaBytes += dataUrlByteLength(iconMedia);

    const safeTitle = title as string | null;
    const safeDescription = description as string | null;
    const safeLinkLabel = linkLabel as string | null;
    const safeLinkUrl = linkUrl as string | null;
    const safeCustomTitle = customTitle as string | null;
    const safeCustomIcon = customIcon as string | null;
    const safeIconLabel = iconLabel as string | null;
    const safeBackgroundMedia = backgroundMedia as string | null;
    const safeIconMedia = iconMedia as string | null;

    ids.add(tileId);
    positions.add(position);
    tiles.push({
      tileId, tileKind, featureId, position, x, y, width, height,
      title: safeTitle, description: safeDescription, linkLabel: safeLinkLabel, linkUrl: safeLinkUrl, contentMode, customTitle: safeCustomTitle, customIcon: safeCustomIcon,
      backgroundType, backgroundPrimary, backgroundSecondary, backgroundAngle, backgroundMedia: safeBackgroundMedia,
      textColour, fontFamily, borderColour, mediaFit, mediaOverlay,
      iconMode: contentMode === 'standard' ? iconMode : 'text', iconLabel: safeIconLabel, iconMedia: safeIconMedia,
      iconTextColour, iconBackgroundColour, iconBorderColour, iconMediaFit, feature
    });
  }

  const otherBytes = includeStoredOtherMedia ? await otherProfileMediaBytes(env, viewer.id) : 0;
  if (otherBytes + cardMediaBytes > MAX_PROFILE_MEDIA_BYTES) {
    return secureJson({ ok: false, message: 'Profile pictures and all profile tile media may use up to 8 MB in total.' }, 400);
  }
  return { tiles: tiles.sort((a, b) => a.position - b.position) };
}

async function persistTiles(env: ProfileEnv, viewer: Viewer, tiles: PreparedTile[]): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const statements: D1Statement[] = [
    env.DB.prepare(`DELETE FROM user_profile_card_tiles WHERE user_id=?`).bind(viewer.id)
  ];
  for (const tile of tiles) {
    statements.push(env.DB.prepare(`
      INSERT INTO user_profile_card_tiles(
        user_id,tile_id,tile_kind,feature_id,position,grid_x,grid_y,tile_width,tile_height,
        title,description,link_label,link_url,content_mode,custom_title,custom_icon,
        background_type,background_primary,background_secondary,background_angle,text_colour,font_family,
        border_colour,media_fit,media_overlay,icon_mode,icon_label,icon_text_colour,
        icon_background_colour,icon_border_colour,icon_media_fit,updated_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      viewer.id, tile.tileId, tile.tileKind, tile.featureId, tile.position, tile.x, tile.y, tile.width, tile.height,
      tile.title, tile.description, tile.linkLabel, tile.linkUrl, tile.contentMode, tile.customTitle, tile.customIcon,
      tile.backgroundType, tile.backgroundPrimary, tile.backgroundSecondary, tile.backgroundAngle, tile.textColour, tile.fontFamily,
      tile.borderColour, tile.mediaFit, tile.mediaOverlay, tile.iconMode, tile.iconLabel, tile.iconTextColour,
      tile.iconBackgroundColour, tile.iconBorderColour, tile.iconMediaFit, now
    ));
    if (tile.backgroundMedia) {
      statements.push(env.DB.prepare(`
        INSERT INTO user_profile_card_tile_media(user_id,tile_id,media_slot,media_data,updated_at)
        VALUES(?,?,'background',?,?)
      `).bind(viewer.id, tile.tileId, tile.backgroundMedia, now));
    }
    if (tile.iconMedia) {
      statements.push(env.DB.prepare(`
        INSERT INTO user_profile_card_tile_media(user_id,tile_id,media_slot,media_data,updated_at)
        VALUES(?,?,'icon',?,?)
      `).bind(viewer.id, tile.tileId, tile.iconMedia, now));
    }
  }
  statements.push(env.DB.prepare(`
    INSERT INTO audit_events(id,actor_user_id,event_type,target_type,target_id,metadata_json,created_at)
    VALUES(?,?,?,?,?,?,?)
  `).bind(
    crypto.randomUUID(), viewer.id, 'profile.card_tiles_updated', 'user', viewer.id,
    JSON.stringify({ tiles: tiles.map(tile => ({ tileId: tile.tileId, tileKind: tile.tileKind, featureId: tile.featureId, position: tile.position, x: tile.x, y: tile.y, width: tile.width, height: tile.height, contentMode: tile.contentMode, backgroundType: tile.backgroundType, hasBackgroundMedia: Boolean(tile.backgroundMedia), iconMode: tile.iconMode, hasIconMedia: Boolean(tile.iconMedia) })) }), now
  ));
  await env.DB.batch(statements);
}

async function saveDirect(request: Request, env: ProfileEnv): Promise<Response> {
  if (!sameOrigin(request)) return secureJson({ ok: false, message: 'Origin rejected.' }, 403);
  const viewer = await getViewer(request, env);
  if (!viewer) return secureJson({ ok: false, message: 'Authentication required.' }, 401);
  const body = await request.json() as { tiles?: unknown };
  const prepared = await prepareTiles(body.tiles, env, viewer);
  if (prepared instanceof Response) return prepared;
  await persistTiles(env, viewer, prepared.tiles);
  return secureJson({ ok: true, cardTiles: await loadCardTiles(env, viewer.id, viewer), message: 'Profile-card tiles saved.' });
}

async function saveWithProfile(request: Request, env: ProfileEnv): Promise<Response | null> {
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.clone().json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    body = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!Object.prototype.hasOwnProperty.call(body, 'cardTiles')) return null;
  if (!sameOrigin(request)) return secureJson({ ok: false, message: 'Origin rejected.' }, 403);
  const viewer = await getViewer(request, env);
  if (!viewer) return secureJson({ ok: false, message: 'Authentication required.' }, 401);
  const prepared = await prepareTiles(body.cardTiles, env, viewer, false);
  if (prepared instanceof Response) return prepared;

  const profileResponse = await handleProfileMediaRequest(request, env);
  if (!profileResponse || !profileResponse.ok) return profileResponse;
  await persistTiles(env, viewer, prepared.tiles);
  return injectCardTiles(profileResponse, request, env);
}

async function catalogue(request: Request, env: ProfileEnv): Promise<Response> {
  const viewer = await getViewer(request, env);
  if (!viewer) return secureJson({ ok: false, message: 'Authentication required.' }, 401);
  const features = [...(await accessibleFeatures(env, viewer)).values()];
  return secureJson({ ok: true, features, grid: { columns: CARD_COLUMNS, maxTiles: MAX_CARD_TILES, maxY: MAX_CARD_Y } });
}

export async function handleProfileCardTilesRequest(request: Request, env: ProfileEnv): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (path === '/api/profile-card-tiles/catalogue' && request.method === 'GET') return catalogue(request, env);
  if (path === '/api/profile-card-tiles' && request.method === 'PUT') return saveDirect(request, env);
  if (path === '/api/profile' && request.method === 'PUT') return saveWithProfile(request, env);
  if (/^\/api\/profiles\/[^/]+$/.test(path) && request.method === 'GET') {
    const response = await handleProfileMediaRequest(request, env);
    return response ? injectCardTiles(response, request, env) : null;
  }
  return null;
}
