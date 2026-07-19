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

export interface ProfileEnv {
  DB: D1Database;
  ASSETS: { fetch(request: Request): Promise<Response> };
  APP_ENV: 'development' | 'pbe' | 'production';
}

type Viewer = {
  id: string;
  username: string;
  displayName: string;
  isVerified: boolean;
  isOwner: boolean;
  isAdmin: boolean;
};

type ProfileTileType = 'text' | 'link' | 'media' | 'stat';
type ProfileBackgroundType = 'solid' | 'gradient' | 'media';
type ProfileMediaFit = 'cover' | 'contain' | 'stretch';
type ProfileMediaOverlay = 'none' | 'dark' | 'light';
type ProfileFont = 'system' | 'display' | 'mono' | 'serif' | 'rounded';
type ProfileDensity = 'comfortable' | 'compact';

type ProfileTile = {
  tileId: string;
  tileType: ProfileTileType;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string | null;
  body: string | null;
  linkLabel: string | null;
  linkUrl: string | null;
  statValue: string | null;
  backgroundType: ProfileBackgroundType;
  backgroundPrimary: string;
  backgroundSecondary: string;
  backgroundAngle: number;
  backgroundMedia: string | null;
  mediaFit: ProfileMediaFit;
  mediaOverlay: ProfileMediaOverlay;
  textColour: string;
  borderColour: string;
  fontFamily: ProfileFont;
};

type ProfileCard = {
  displayName: string;
  headline: string | null;
  bio: string | null;
  location: string | null;
  websiteUrl: string | null;
  avatarMedia: string | null;
  coverMedia: string | null;
  backgroundPrimary: string;
  backgroundSecondary: string;
  backgroundAngle: number;
  textColour: string;
  borderColour: string;
  showUsername: boolean;
  showStatus: boolean;
  showMemberSince: boolean;
};

type ProfilePreferences = {
  density: ProfileDensity;
  tileGap: number;
  outerMargin: number;
};

type UserRow = {
  id: string;
  username: string;
  display_name: string;
  is_verified: number;
  is_owner: number;
  is_admin: number;
  created_at: number;
};

type ProfileRow = {
  headline: string | null;
  bio: string | null;
  location: string | null;
  website_url: string | null;
  avatar_media: string | null;
  cover_media: string | null;
  background_primary: string;
  background_secondary: string;
  background_angle: number;
  text_colour: string;
  border_colour: string;
  show_username: number;
  show_status: number;
  show_member_since: number;
};

type TileRow = {
  tile_id: string;
  tile_type: ProfileTileType;
  grid_x: number;
  grid_y: number;
  tile_width: number;
  tile_height: number;
  title: string | null;
  body: string | null;
  link_label: string | null;
  link_url: string | null;
  stat_value: string | null;
  background_type: ProfileBackgroundType;
  background_primary: string;
  background_secondary: string;
  background_angle: number;
  background_media: string | null;
  media_fit: ProfileMediaFit;
  media_overlay: ProfileMediaOverlay;
  text_colour: string;
  border_colour: string;
  font_family: ProfileFont;
};

type PreferenceRow = {
  density: ProfileDensity;
  tile_gap: number;
  outer_margin: number;
};

const COOKIE = 'grev_session';
const encoder = new TextEncoder();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_COLOUR = /^#[0-9a-f]{6}$/i;
const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp|gif);base64,([a-z0-9+/]+={0,2})$/i;
const MAX_MEDIA_BYTES = 1_400_000;
const MAX_PROFILE_MEDIA_BYTES = 8 * 1024 * 1024;
const MAX_TILES = 40;
const GRID_COLUMNS = 8;
const MAX_TILE_WIDTH = 6;
const MAX_GRID_Y = 199;
const VALID_TILE_TYPES = new Set<ProfileTileType>(['text', 'link', 'media', 'stat']);
const VALID_BACKGROUND_TYPES = new Set<ProfileBackgroundType>(['solid', 'gradient', 'media']);
const VALID_MEDIA_FITS = new Set<ProfileMediaFit>(['cover', 'contain', 'stretch']);
const VALID_MEDIA_OVERLAYS = new Set<ProfileMediaOverlay>(['none', 'dark', 'light']);
const VALID_FONTS = new Set<ProfileFont>(['system', 'display', 'mono', 'serif', 'rounded']);
const VALID_DENSITIES = new Set<ProfileDensity>(['comfortable', 'compact']);
const VALID_GAPS = new Set([0, 4, 8, 12, 16, 20, 24, 32, 40, 48]);
const VALID_MARGINS = new Set([0, 8, 12, 16, 24, 32, 40, 48, 56, 64]);

const DEFAULT_CARD = {
  headline: null,
  bio: null,
  location: null,
  websiteUrl: null,
  avatarMedia: null,
  coverMedia: null,
  backgroundPrimary: '#11161d',
  backgroundSecondary: '#3157c9',
  backgroundAngle: 135,
  textColour: '#f4f7fb',
  borderColour: '#526074',
  showUsername: true,
  showStatus: true,
  showMemberSince: true
} satisfies Omit<ProfileCard, 'displayName'>;

const DEFAULT_PREFERENCES: ProfilePreferences = {
  density: 'comfortable',
  tileGap: 12,
  outerMargin: 0
};

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

async function getViewer(request: Request, env: ProfileEnv): Promise<Viewer | null> {
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

function cleanText(value: unknown, maximum: number): string | null | undefined {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length <= maximum ? trimmed : undefined;
}

function requiredText(value: unknown, minimum: number, maximum: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length >= minimum && trimmed.length <= maximum ? trimmed : null;
}

function validUrl(value: string | null): boolean {
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
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

function validPlacement(tile: ProfileTile): boolean {
  return Number.isInteger(tile.x) && Number.isInteger(tile.y) && Number.isInteger(tile.width) && Number.isInteger(tile.height)
    && tile.x >= 0 && tile.y >= 0 && tile.y <= MAX_GRID_Y
    && tile.width >= 1 && tile.width <= MAX_TILE_WIDTH
    && tile.height >= 1 && tile.height <= 4
    && tile.x + tile.width <= GRID_COLUMNS
    && tile.y + tile.height <= MAX_GRID_Y + 1;
}

function overlaps(a: ProfileTile, b: ProfileTile): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function cardFromInput(value: unknown, fallbackDisplayName: string): ProfileCard | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const displayName = requiredText(input.displayName ?? fallbackDisplayName, 1, 60);
  const headline = cleanText(input.headline, 120);
  const bio = cleanText(input.bio, 800);
  const location = cleanText(input.location, 100);
  const websiteUrl = cleanText(input.websiteUrl, 500);
  const avatarMedia = optionalMedia(input.avatarMedia);
  const coverMedia = optionalMedia(input.coverMedia);
  const backgroundPrimary = String(input.backgroundPrimary ?? DEFAULT_CARD.backgroundPrimary).toLowerCase();
  const backgroundSecondary = String(input.backgroundSecondary ?? DEFAULT_CARD.backgroundSecondary).toLowerCase();
  const backgroundAngle = Number(input.backgroundAngle ?? DEFAULT_CARD.backgroundAngle);
  const textColour = String(input.textColour ?? DEFAULT_CARD.textColour).toLowerCase();
  const borderColour = String(input.borderColour ?? DEFAULT_CARD.borderColour).toLowerCase();
  if (!displayName || headline === undefined || bio === undefined || location === undefined || websiteUrl === undefined) return null;
  if (avatarMedia === undefined || coverMedia === undefined || !validUrl(websiteUrl)) return null;
  if (!HEX_COLOUR.test(backgroundPrimary) || !HEX_COLOUR.test(backgroundSecondary) || !HEX_COLOUR.test(textColour) || !HEX_COLOUR.test(borderColour)) return null;
  if (!Number.isInteger(backgroundAngle) || backgroundAngle < 0 || backgroundAngle > 360) return null;
  return {
    displayName,
    headline,
    bio,
    location,
    websiteUrl,
    avatarMedia,
    coverMedia,
    backgroundPrimary,
    backgroundSecondary,
    backgroundAngle,
    textColour,
    borderColour,
    showUsername: input.showUsername !== false,
    showStatus: input.showStatus !== false,
    showMemberSince: input.showMemberSince !== false
  };
}

function tileFromInput(value: unknown): ProfileTile | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const tileId = String(input.tileId ?? '').trim();
  const tileType = String(input.tileType ?? '') as ProfileTileType;
  const title = cleanText(input.title, 80);
  const body = cleanText(input.body, 2000);
  const linkLabel = cleanText(input.linkLabel, 80);
  const linkUrl = cleanText(input.linkUrl, 500);
  const statValue = cleanText(input.statValue, 80);
  const backgroundType = String(input.backgroundType ?? 'solid') as ProfileBackgroundType;
  const backgroundPrimary = String(input.backgroundPrimary ?? '#11161d').toLowerCase();
  const backgroundSecondary = String(input.backgroundSecondary ?? '#3157c9').toLowerCase();
  const backgroundAngle = Number(input.backgroundAngle ?? 135);
  const backgroundMedia = optionalMedia(input.backgroundMedia);
  const mediaFit = String(input.mediaFit ?? 'cover') as ProfileMediaFit;
  const mediaOverlay = String(input.mediaOverlay ?? 'dark') as ProfileMediaOverlay;
  const textColour = String(input.textColour ?? '#f4f7fb').toLowerCase();
  const borderColour = String(input.borderColour ?? '#394657').toLowerCase();
  const fontFamily = String(input.fontFamily ?? 'system') as ProfileFont;

  if (!UUID_RE.test(tileId) || !VALID_TILE_TYPES.has(tileType)) return null;
  if (title === undefined || body === undefined || linkLabel === undefined || linkUrl === undefined || statValue === undefined) return null;
  if (!VALID_BACKGROUND_TYPES.has(backgroundType) || !VALID_MEDIA_FITS.has(mediaFit) || !VALID_MEDIA_OVERLAYS.has(mediaOverlay) || !VALID_FONTS.has(fontFamily)) return null;
  if (!HEX_COLOUR.test(backgroundPrimary) || !HEX_COLOUR.test(backgroundSecondary) || !HEX_COLOUR.test(textColour) || !HEX_COLOUR.test(borderColour)) return null;
  if (!Number.isInteger(backgroundAngle) || backgroundAngle < 0 || backgroundAngle > 360 || backgroundMedia === undefined) return null;
  if (backgroundType === 'media' && !backgroundMedia) return null;
  if (tileType === 'link' && (!linkUrl || !validUrl(linkUrl))) return null;
  if (tileType === 'media' && !backgroundMedia) return null;
  if (tileType === 'stat' && !statValue) return null;

  const tile: ProfileTile = {
    tileId,
    tileType,
    x: Number(input.x),
    y: Number(input.y),
    width: Number(input.width),
    height: Number(input.height),
    title,
    body,
    linkLabel,
    linkUrl,
    statValue,
    backgroundType,
    backgroundPrimary,
    backgroundSecondary,
    backgroundAngle,
    backgroundMedia,
    mediaFit,
    mediaOverlay,
    textColour,
    borderColour,
    fontFamily
  };
  return validPlacement(tile) ? tile : null;
}

function preferencesFromInput(value: unknown): ProfilePreferences {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const densityValue = String(input.density ?? DEFAULT_PREFERENCES.density) as ProfileDensity;
  const gapValue = Number(input.tileGap ?? DEFAULT_PREFERENCES.tileGap);
  const marginValue = Number(input.outerMargin ?? DEFAULT_PREFERENCES.outerMargin);
  return {
    density: VALID_DENSITIES.has(densityValue) ? densityValue : DEFAULT_PREFERENCES.density,
    tileGap: VALID_GAPS.has(gapValue) ? gapValue : DEFAULT_PREFERENCES.tileGap,
    outerMargin: VALID_MARGINS.has(marginValue) ? marginValue : DEFAULT_PREFERENCES.outerMargin
  };
}

function tileFromRow(row: TileRow): ProfileTile {
  return {
    tileId: row.tile_id,
    tileType: row.tile_type,
    x: row.grid_x,
    y: row.grid_y,
    width: row.tile_width,
    height: row.tile_height,
    title: row.title,
    body: row.body,
    linkLabel: row.link_label,
    linkUrl: row.link_url,
    statValue: row.stat_value,
    backgroundType: row.background_type,
    backgroundPrimary: row.background_primary,
    backgroundSecondary: row.background_secondary,
    backgroundAngle: row.background_angle,
    backgroundMedia: row.background_media,
    mediaFit: row.media_fit,
    mediaOverlay: row.media_overlay,
    textColour: row.text_colour,
    borderColour: row.border_colour,
    fontFamily: row.font_family
  };
}

async function profilePayload(env: ProfileEnv, viewer: Viewer, profileId: string): Promise<Response> {
  if (!UUID_RE.test(profileId)) return secureJson({ ok: false, message: 'Profile not found.' }, { status: 404 });
  const user = await env.DB.prepare(`
    SELECT u.id,u.username,u.display_name,u.is_verified,u.is_owner,u.created_at,
      CASE WHEN u.is_owner=1 OR EXISTS(
        SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role_id='role-admin'
      ) THEN 1 ELSE 0 END AS is_admin
    FROM users u
    WHERE u.id=? AND u.status='active'
  `).bind(profileId).first<UserRow>();
  if (!user) return secureJson({ ok: false, message: 'Profile not found.' }, { status: 404 });

  const [profileRow, tileRows, preferenceRow] = await Promise.all([
    env.DB.prepare(`
      SELECT headline,bio,location,website_url,avatar_media,cover_media,
        background_primary,background_secondary,background_angle,text_colour,border_colour,
        show_username,show_status,show_member_since
      FROM user_profiles WHERE user_id=?
    `).bind(profileId).first<ProfileRow>(),
    env.DB.prepare(`
      SELECT tile_id,tile_type,grid_x,grid_y,tile_width,tile_height,title,body,
        link_label,link_url,stat_value,background_type,background_primary,
        background_secondary,background_angle,background_media,media_fit,media_overlay,
        text_colour,border_colour,font_family
      FROM user_profile_tiles
      WHERE user_id=?
      ORDER BY grid_y,grid_x,position
    `).bind(profileId).all<TileRow>(),
    env.DB.prepare(`SELECT density,tile_gap,outer_margin FROM user_profile_preferences WHERE user_id=?`)
      .bind(profileId).first<PreferenceRow>()
  ]);

  const card: ProfileCard = profileRow ? {
    displayName: user.display_name,
    headline: profileRow.headline,
    bio: profileRow.bio,
    location: profileRow.location,
    websiteUrl: profileRow.website_url,
    avatarMedia: profileRow.avatar_media,
    coverMedia: profileRow.cover_media,
    backgroundPrimary: profileRow.background_primary,
    backgroundSecondary: profileRow.background_secondary,
    backgroundAngle: profileRow.background_angle,
    textColour: profileRow.text_colour,
    borderColour: profileRow.border_colour,
    showUsername: Boolean(profileRow.show_username),
    showStatus: Boolean(profileRow.show_status),
    showMemberSince: Boolean(profileRow.show_member_since)
  } : { displayName: user.display_name, ...DEFAULT_CARD };

  const preferences: ProfilePreferences = preferenceRow ? {
    density: VALID_DENSITIES.has(preferenceRow.density) ? preferenceRow.density : DEFAULT_PREFERENCES.density,
    tileGap: VALID_GAPS.has(preferenceRow.tile_gap) ? preferenceRow.tile_gap : DEFAULT_PREFERENCES.tileGap,
    outerMargin: VALID_MARGINS.has(preferenceRow.outer_margin) ? preferenceRow.outer_margin : DEFAULT_PREFERENCES.outerMargin
  } : DEFAULT_PREFERENCES;

  return secureJson({
    ok: true,
    profile: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      isVerified: Boolean(user.is_verified),
      isOwner: Boolean(user.is_owner),
      isAdmin: Boolean(user.is_admin),
      createdAt: user.created_at,
      isSelf: viewer.id === user.id,
      card,
      tiles: tileRows.results.map(tileFromRow),
      preferences,
      grid: { columns: GRID_COLUMNS, maxY: MAX_GRID_Y, maxTileWidth: MAX_TILE_WIDTH, maxTileHeight: 4 }
    }
  });
}

async function saveProfile(request: Request, env: ProfileEnv, viewer: Viewer): Promise<Response> {
  if (!sameOrigin(request)) return secureJson({ ok: false, message: 'Origin rejected.' }, { status: 403 });
  const data = await readJson(request);
  const card = cardFromInput(data.card, viewer.displayName);
  const rawTiles = data.tiles;
  if (!card || !Array.isArray(rawTiles) || rawTiles.length > MAX_TILES) {
    return secureJson({ ok: false, message: `Choose valid profile details and up to ${MAX_TILES} profile tiles.` }, { status: 400 });
  }

  const tiles: ProfileTile[] = [];
  const seen = new Set<string>();
  let totalMediaBytes = 0;
  for (const media of [card.avatarMedia, card.coverMedia]) {
    if (media) totalMediaBytes += dataUrlByteLength(media);
  }

  for (const rawTile of rawTiles) {
    const tile = tileFromInput(rawTile);
    if (!tile || seen.has(tile.tileId)) {
      return secureJson({ ok: false, message: 'The profile contains an invalid or duplicate tile.' }, { status: 400 });
    }
    if (tiles.some(existing => overlaps(existing, tile))) {
      return secureJson({ ok: false, message: 'Profile tiles cannot overlap.' }, { status: 400 });
    }
    if (tile.backgroundMedia) totalMediaBytes += dataUrlByteLength(tile.backgroundMedia);
    if (totalMediaBytes > MAX_PROFILE_MEDIA_BYTES) {
      return secureJson({ ok: false, message: 'Profile pictures and tile media may use up to 8 MB in total.' }, { status: 400 });
    }
    seen.add(tile.tileId);
    tiles.push(tile);
  }

  const preferences = preferencesFromInput(data.preferences);
  const now = Math.floor(Date.now() / 1000);
  const statements: D1Statement[] = [
    env.DB.prepare(`UPDATE users SET display_name=?,updated_at=? WHERE id=?`).bind(card.displayName, now, viewer.id),
    env.DB.prepare(`
      INSERT INTO user_profiles(
        user_id,headline,bio,location,website_url,avatar_media,cover_media,
        background_primary,background_secondary,background_angle,text_colour,border_colour,
        show_username,show_status,show_member_since,updated_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET
        headline=excluded.headline,bio=excluded.bio,location=excluded.location,
        website_url=excluded.website_url,avatar_media=excluded.avatar_media,cover_media=excluded.cover_media,
        background_primary=excluded.background_primary,background_secondary=excluded.background_secondary,
        background_angle=excluded.background_angle,text_colour=excluded.text_colour,
        border_colour=excluded.border_colour,show_username=excluded.show_username,
        show_status=excluded.show_status,show_member_since=excluded.show_member_since,
        updated_at=excluded.updated_at
    `).bind(
      viewer.id, card.headline, card.bio, card.location, card.websiteUrl, card.avatarMedia, card.coverMedia,
      card.backgroundPrimary, card.backgroundSecondary, card.backgroundAngle, card.textColour, card.borderColour,
      card.showUsername ? 1 : 0, card.showStatus ? 1 : 0, card.showMemberSince ? 1 : 0, now
    ),
    env.DB.prepare(`
      INSERT INTO user_profile_preferences(user_id,density,tile_gap,outer_margin,updated_at)
      VALUES(?,?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET
        density=excluded.density,tile_gap=excluded.tile_gap,
        outer_margin=excluded.outer_margin,updated_at=excluded.updated_at
    `).bind(viewer.id, preferences.density, preferences.tileGap, preferences.outerMargin, now),
    env.DB.prepare(`DELETE FROM user_profile_tiles WHERE user_id=?`).bind(viewer.id)
  ];

  tiles.forEach((tile, position) => {
    statements.push(env.DB.prepare(`
      INSERT INTO user_profile_tiles(
        user_id,tile_id,tile_type,position,grid_x,grid_y,tile_width,tile_height,
        title,body,link_label,link_url,stat_value,background_type,background_primary,
        background_secondary,background_angle,background_media,media_fit,media_overlay,
        text_colour,border_colour,font_family,updated_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      viewer.id, tile.tileId, tile.tileType, position, tile.x, tile.y, tile.width, tile.height,
      tile.title, tile.body, tile.linkLabel, tile.linkUrl, tile.statValue, tile.backgroundType,
      tile.backgroundPrimary, tile.backgroundSecondary, tile.backgroundAngle, tile.backgroundMedia,
      tile.mediaFit, tile.mediaOverlay, tile.textColour, tile.borderColour, tile.fontFamily, now
    ));
  });

  statements.push(env.DB.prepare(`
    INSERT INTO audit_events(id,actor_user_id,event_type,target_type,target_id,metadata_json,created_at)
    VALUES(?,?,?,?,?,?,?)
  `).bind(
    crypto.randomUUID(), viewer.id, 'profile.builder_updated', 'user', viewer.id,
    JSON.stringify({
      tileCount: tiles.length,
      hasAvatar: Boolean(card.avatarMedia),
      hasCover: Boolean(card.coverMedia),
      hasBio: Boolean(card.bio),
      density: preferences.density,
      tileGap: preferences.tileGap,
      outerMargin: preferences.outerMargin
    }),
    now
  ));

  await env.DB.batch(statements);
  return profilePayload(env, { ...viewer, displayName: card.displayName }, viewer.id);
}

export async function handleProfileRequest(request: Request, env: ProfileEnv): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  const match = path.match(/^\/api\/profiles\/([^/]+)$/);
  if (match && request.method === 'GET') {
    const viewer = await getViewer(request, env);
    if (!viewer) return secureJson({ ok: false, message: 'Authentication required.' }, { status: 401 });
    return profilePayload(env, viewer, decodeURIComponent(match[1] ?? ''));
  }

  if (path === '/api/profile' && request.method === 'PUT') {
    const viewer = await getViewer(request, env);
    if (!viewer) return secureJson({ ok: false, message: 'Authentication required.' }, { status: 401 });
    return saveProfile(request, env, viewer);
  }

  return null;
}
