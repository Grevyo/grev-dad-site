import { type ProfileEnv } from './profile';
import { handleProfileCardTilesRequest } from './profile-card-tiles';

interface D1Result<T> { results: T[]; }
interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<unknown>;
}

type Viewer = { id: string };
type PageBackgroundType = 'solid' | 'gradient' | 'media';
type MediaFit = 'cover' | 'contain' | 'stretch';
type MediaOverlay = 'none' | 'dark' | 'light';
type FontFamily = 'system' | 'display' | 'mono' | 'serif' | 'rounded';
type ContentWidth = 'standard' | 'wide' | 'full';
type CardWidth = 'compact' | 'wide' | 'full';
type CardAlignment = 'left' | 'centre';
type CardShadow = 'none' | 'small' | 'large';
type CardSurface = 'gradient' | 'solid' | 'cover';
type GridSurface = 'transparent' | 'outlined' | 'panel';

type ProfileDesign = {
  pageBackgroundType: PageBackgroundType;
  pageBackgroundPrimary: string;
  pageBackgroundSecondary: string;
  pageBackgroundAngle: number;
  pageBackgroundMedia: string | null;
  pageMediaFit: MediaFit;
  pageMediaOverlay: MediaOverlay;
  pageTextColour: string;
  pageFontFamily: FontFamily;
  contentWidth: ContentWidth;
  sectionGap: number;
  showPageHeading: boolean;
  showGridHeading: boolean;
  cardWidth: CardWidth;
  cardAlignment: CardAlignment;
  cardSurface: CardSurface;
  coverHeight: number;
  avatarSize: number;
  cardPadding: number;
  cardShadow: CardShadow;
  cardBorderWidth: number;
  showCover: boolean;
  showAvatar: boolean;
  showHeadline: boolean;
  showBio: boolean;
  showLocation: boolean;
  showWebsite: boolean;
  cardTileGap: number;
  cardTileRowHeight: number;
  gridSurface: GridSurface;
};

type DesignRow = {
  page_background_type: PageBackgroundType;
  page_background_primary: string;
  page_background_secondary: string;
  page_background_angle: number;
  page_media_fit: MediaFit;
  page_media_overlay: MediaOverlay;
  page_text_colour: string;
  page_font_family: FontFamily;
  content_width: ContentWidth;
  section_gap: number;
  show_page_heading: number;
  show_grid_heading: number;
  card_width: CardWidth;
  card_alignment: CardAlignment;
  card_surface: CardSurface;
  cover_height: number;
  avatar_size: number;
  card_padding: number;
  card_shadow: CardShadow;
  card_border_width: number;
  show_cover: number;
  show_avatar: number;
  show_headline: number;
  show_bio: number;
  show_location: number;
  show_website: number;
  card_tile_gap: number;
  card_tile_row_height: number;
  grid_surface: GridSurface;
};

type ProfilePayload = { profile?: { id?: unknown; design?: ProfileDesign } };

const COOKIE = 'grev_session';
const encoder = new TextEncoder();
const HEX_COLOUR = /^#[0-9a-f]{6}$/i;
const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp|gif);base64,([a-z0-9+/]+={0,2})$/i;
const MAX_MEDIA_BYTES = 1_400_000;
const MAX_PROFILE_MEDIA_BYTES = 8 * 1024 * 1024;
const VALID_PAGE_BACKGROUNDS = new Set<PageBackgroundType>(['solid', 'gradient', 'media']);
const VALID_MEDIA_FITS = new Set<MediaFit>(['cover', 'contain', 'stretch']);
const VALID_OVERLAYS = new Set<MediaOverlay>(['none', 'dark', 'light']);
const VALID_FONTS = new Set<FontFamily>(['system', 'display', 'mono', 'serif', 'rounded']);
const VALID_CONTENT_WIDTHS = new Set<ContentWidth>(['standard', 'wide', 'full']);
const VALID_CARD_WIDTHS = new Set<CardWidth>(['compact', 'wide', 'full']);
const VALID_ALIGNMENTS = new Set<CardAlignment>(['left', 'centre']);
const VALID_SHADOWS = new Set<CardShadow>(['none', 'small', 'large']);
const VALID_CARD_SURFACES = new Set<CardSurface>(['gradient', 'solid', 'cover']);
const VALID_GRID_SURFACES = new Set<GridSurface>(['transparent', 'outlined', 'panel']);
const VALID_SECTION_GAPS = new Set([16, 24, 32, 40, 48, 64]);
const VALID_COVER_HEIGHTS = new Set([0, 120, 180, 240, 320]);
const VALID_AVATAR_SIZES = new Set([72, 96, 120, 144, 168]);
const VALID_CARD_PADDING = new Set([12, 16, 20, 24, 28, 32, 40, 48]);
const VALID_BORDER_WIDTHS = new Set([0, 1, 2, 4]);
const VALID_CARD_TILE_GAPS = new Set([0, 4, 8, 10, 12, 16, 20, 24]);
const VALID_CARD_TILE_ROWS = new Set([72, 92, 112, 132, 160]);

const DEFAULT_DESIGN: ProfileDesign = {
  pageBackgroundType: 'solid',
  pageBackgroundPrimary: '#090c11',
  pageBackgroundSecondary: '#182131',
  pageBackgroundAngle: 135,
  pageBackgroundMedia: null,
  pageMediaFit: 'cover',
  pageMediaOverlay: 'dark',
  pageTextColour: '#f4f7fb',
  pageFontFamily: 'system',
  contentWidth: 'wide',
  sectionGap: 32,
  showPageHeading: true,
  showGridHeading: true,
  cardWidth: 'full',
  cardAlignment: 'centre',
  cardSurface: 'gradient',
  coverHeight: 180,
  avatarSize: 132,
  cardPadding: 28,
  cardShadow: 'large',
  cardBorderWidth: 1,
  showCover: true,
  showAvatar: true,
  showHeadline: true,
  showBio: true,
  showLocation: true,
  showWebsite: true,
  cardTileGap: 10,
  cardTileRowHeight: 92,
  gridSurface: 'transparent'
};

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
    SELECT u.id
    FROM sessions s
    JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.status='active'
  `).bind(await sha256(token), now).first<{ id: string }>();
  return row ? { id: row.id } : null;
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

async function completeIncomingMediaBytes(body: Record<string, unknown>, design: ProfileDesign, env: ProfileEnv, userId: string): Promise<number | null> {
  let total = design.pageBackgroundMedia ? dataUrlByteLength(design.pageBackgroundMedia) : 0;
  const rawCard = body.card;
  if (!rawCard || typeof rawCard !== 'object' || Array.isArray(rawCard)) return null;
  const card = rawCard as Record<string, unknown>;
  for (const value of [card.avatarMedia, card.coverMedia]) {
    const media = optionalMedia(value);
    if (media === undefined) return null;
    if (media) total += dataUrlByteLength(media);
  }
  if (!Array.isArray(body.tiles)) return null;
  for (const tileValue of body.tiles) {
    if (!tileValue || typeof tileValue !== 'object' || Array.isArray(tileValue)) return null;
    const media = optionalMedia((tileValue as Record<string, unknown>).backgroundMedia);
    if (media === undefined) return null;
    if (media) total += dataUrlByteLength(media);
  }
  if (Array.isArray(body.cardTiles)) {
    for (const tileValue of body.cardTiles) {
      if (!tileValue || typeof tileValue !== 'object' || Array.isArray(tileValue)) return null;
      const tile = tileValue as Record<string, unknown>;
      for (const value of [tile.backgroundMedia, tile.iconMedia]) {
        const media = optionalMedia(value);
        if (media === undefined) return null;
        if (media) total += dataUrlByteLength(media);
      }
    }
  } else {
    const rows = await env.DB.prepare(`SELECT media_data FROM user_profile_card_tile_media WHERE user_id=?`)
      .bind(userId).all<{ media_data: string }>();
    total += rows.results.reduce((sum, row) => sum + dataUrlByteLength(row.media_data), 0);
  }
  return total;
}

function designFromInput(value: unknown): ProfileDesign | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const pageBackgroundType = String(input.pageBackgroundType ?? DEFAULT_DESIGN.pageBackgroundType) as PageBackgroundType;
  const pageBackgroundPrimary = String(input.pageBackgroundPrimary ?? DEFAULT_DESIGN.pageBackgroundPrimary).toLowerCase();
  const pageBackgroundSecondary = String(input.pageBackgroundSecondary ?? DEFAULT_DESIGN.pageBackgroundSecondary).toLowerCase();
  const pageBackgroundAngle = Number(input.pageBackgroundAngle ?? DEFAULT_DESIGN.pageBackgroundAngle);
  const pageBackgroundMedia = optionalMedia(input.pageBackgroundMedia);
  const pageMediaFit = String(input.pageMediaFit ?? DEFAULT_DESIGN.pageMediaFit) as MediaFit;
  const pageMediaOverlay = String(input.pageMediaOverlay ?? DEFAULT_DESIGN.pageMediaOverlay) as MediaOverlay;
  const pageTextColour = String(input.pageTextColour ?? DEFAULT_DESIGN.pageTextColour).toLowerCase();
  const pageFontFamily = String(input.pageFontFamily ?? DEFAULT_DESIGN.pageFontFamily) as FontFamily;
  const contentWidth = String(input.contentWidth ?? DEFAULT_DESIGN.contentWidth) as ContentWidth;
  const sectionGap = Number(input.sectionGap ?? DEFAULT_DESIGN.sectionGap);
  const cardWidth = String(input.cardWidth ?? DEFAULT_DESIGN.cardWidth) as CardWidth;
  const cardAlignment = String(input.cardAlignment ?? DEFAULT_DESIGN.cardAlignment) as CardAlignment;
  const cardSurface = String(input.cardSurface ?? DEFAULT_DESIGN.cardSurface) as CardSurface;
  const coverHeight = Number(input.coverHeight ?? DEFAULT_DESIGN.coverHeight);
  const avatarSize = Number(input.avatarSize ?? DEFAULT_DESIGN.avatarSize);
  const cardPadding = Number(input.cardPadding ?? DEFAULT_DESIGN.cardPadding);
  const cardShadow = String(input.cardShadow ?? DEFAULT_DESIGN.cardShadow) as CardShadow;
  const cardBorderWidth = Number(input.cardBorderWidth ?? DEFAULT_DESIGN.cardBorderWidth);
  const cardTileGap = Number(input.cardTileGap ?? DEFAULT_DESIGN.cardTileGap);
  const cardTileRowHeight = Number(input.cardTileRowHeight ?? DEFAULT_DESIGN.cardTileRowHeight);
  const gridSurface = String(input.gridSurface ?? DEFAULT_DESIGN.gridSurface) as GridSurface;

  if (!VALID_PAGE_BACKGROUNDS.has(pageBackgroundType) || !VALID_MEDIA_FITS.has(pageMediaFit) || !VALID_OVERLAYS.has(pageMediaOverlay)
    || !VALID_FONTS.has(pageFontFamily) || !VALID_CONTENT_WIDTHS.has(contentWidth) || !VALID_SECTION_GAPS.has(sectionGap)
    || !VALID_CARD_WIDTHS.has(cardWidth) || !VALID_ALIGNMENTS.has(cardAlignment) || !VALID_CARD_SURFACES.has(cardSurface)
    || !VALID_COVER_HEIGHTS.has(coverHeight) || !VALID_AVATAR_SIZES.has(avatarSize) || !VALID_CARD_PADDING.has(cardPadding)
    || !VALID_SHADOWS.has(cardShadow) || !VALID_BORDER_WIDTHS.has(cardBorderWidth) || !VALID_CARD_TILE_GAPS.has(cardTileGap)
    || !VALID_CARD_TILE_ROWS.has(cardTileRowHeight) || !VALID_GRID_SURFACES.has(gridSurface)) return null;
  if (![pageBackgroundPrimary, pageBackgroundSecondary, pageTextColour].every(value => HEX_COLOUR.test(value))) return null;
  if (!Number.isInteger(pageBackgroundAngle) || pageBackgroundAngle < 0 || pageBackgroundAngle > 360 || pageBackgroundMedia === undefined) return null;
  if (pageBackgroundType === 'media' && !pageBackgroundMedia) return null;

  return {
    pageBackgroundType,
    pageBackgroundPrimary,
    pageBackgroundSecondary,
    pageBackgroundAngle,
    pageBackgroundMedia,
    pageMediaFit,
    pageMediaOverlay,
    pageTextColour,
    pageFontFamily,
    contentWidth,
    sectionGap,
    showPageHeading: input.showPageHeading !== false,
    showGridHeading: input.showGridHeading !== false,
    cardWidth,
    cardAlignment,
    cardSurface,
    coverHeight,
    avatarSize,
    cardPadding,
    cardShadow,
    cardBorderWidth,
    showCover: input.showCover !== false,
    showAvatar: input.showAvatar !== false,
    showHeadline: input.showHeadline !== false,
    showBio: input.showBio !== false,
    showLocation: input.showLocation !== false,
    showWebsite: input.showWebsite !== false,
    cardTileGap,
    cardTileRowHeight,
    gridSurface
  };
}

function designFromRow(row: DesignRow | null, media: string | null): ProfileDesign {
  if (!row) return { ...DEFAULT_DESIGN, pageBackgroundMedia: media };
  return {
    pageBackgroundType: VALID_PAGE_BACKGROUNDS.has(row.page_background_type) ? row.page_background_type : DEFAULT_DESIGN.pageBackgroundType,
    pageBackgroundPrimary: HEX_COLOUR.test(row.page_background_primary) ? row.page_background_primary : DEFAULT_DESIGN.pageBackgroundPrimary,
    pageBackgroundSecondary: HEX_COLOUR.test(row.page_background_secondary) ? row.page_background_secondary : DEFAULT_DESIGN.pageBackgroundSecondary,
    pageBackgroundAngle: row.page_background_angle,
    pageBackgroundMedia: media,
    pageMediaFit: VALID_MEDIA_FITS.has(row.page_media_fit) ? row.page_media_fit : DEFAULT_DESIGN.pageMediaFit,
    pageMediaOverlay: VALID_OVERLAYS.has(row.page_media_overlay) ? row.page_media_overlay : DEFAULT_DESIGN.pageMediaOverlay,
    pageTextColour: HEX_COLOUR.test(row.page_text_colour) ? row.page_text_colour : DEFAULT_DESIGN.pageTextColour,
    pageFontFamily: VALID_FONTS.has(row.page_font_family) ? row.page_font_family : DEFAULT_DESIGN.pageFontFamily,
    contentWidth: VALID_CONTENT_WIDTHS.has(row.content_width) ? row.content_width : DEFAULT_DESIGN.contentWidth,
    sectionGap: VALID_SECTION_GAPS.has(row.section_gap) ? row.section_gap : DEFAULT_DESIGN.sectionGap,
    showPageHeading: Boolean(row.show_page_heading),
    showGridHeading: Boolean(row.show_grid_heading),
    cardWidth: VALID_CARD_WIDTHS.has(row.card_width) ? row.card_width : DEFAULT_DESIGN.cardWidth,
    cardAlignment: VALID_ALIGNMENTS.has(row.card_alignment) ? row.card_alignment : DEFAULT_DESIGN.cardAlignment,
    cardSurface: VALID_CARD_SURFACES.has(row.card_surface) ? row.card_surface : DEFAULT_DESIGN.cardSurface,
    coverHeight: VALID_COVER_HEIGHTS.has(row.cover_height) ? row.cover_height : DEFAULT_DESIGN.coverHeight,
    avatarSize: VALID_AVATAR_SIZES.has(row.avatar_size) ? row.avatar_size : DEFAULT_DESIGN.avatarSize,
    cardPadding: VALID_CARD_PADDING.has(row.card_padding) ? row.card_padding : DEFAULT_DESIGN.cardPadding,
    cardShadow: VALID_SHADOWS.has(row.card_shadow) ? row.card_shadow : DEFAULT_DESIGN.cardShadow,
    cardBorderWidth: VALID_BORDER_WIDTHS.has(row.card_border_width) ? row.card_border_width : DEFAULT_DESIGN.cardBorderWidth,
    showCover: Boolean(row.show_cover),
    showAvatar: Boolean(row.show_avatar),
    showHeadline: Boolean(row.show_headline),
    showBio: Boolean(row.show_bio),
    showLocation: Boolean(row.show_location),
    showWebsite: Boolean(row.show_website),
    cardTileGap: VALID_CARD_TILE_GAPS.has(row.card_tile_gap) ? row.card_tile_gap : DEFAULT_DESIGN.cardTileGap,
    cardTileRowHeight: VALID_CARD_TILE_ROWS.has(row.card_tile_row_height) ? row.card_tile_row_height : DEFAULT_DESIGN.cardTileRowHeight,
    gridSurface: VALID_GRID_SURFACES.has(row.grid_surface) ? row.grid_surface : DEFAULT_DESIGN.gridSurface
  };
}

async function loadDesign(env: ProfileEnv, userId: string): Promise<ProfileDesign> {
  const [row, mediaRow] = await Promise.all([
    env.DB.prepare(`
      SELECT page_background_type,page_background_primary,page_background_secondary,page_background_angle,
        page_media_fit,page_media_overlay,page_text_colour,page_font_family,content_width,section_gap,
        show_page_heading,show_grid_heading,card_width,card_alignment,card_surface,cover_height,avatar_size,
        card_padding,card_shadow,card_border_width,show_cover,show_avatar,show_headline,show_bio,
        show_location,show_website,card_tile_gap,card_tile_row_height,grid_surface
      FROM user_profile_design WHERE user_id=?
    `).bind(userId).first<DesignRow>(),
    env.DB.prepare(`SELECT media_data FROM user_profile_design_media WHERE user_id=? AND media_slot='page_background'`)
      .bind(userId).first<{ media_data: string }>()
  ]);
  return designFromRow(row, mediaRow?.media_data ?? null);
}

async function injectDesign(response: Response, env: ProfileEnv): Promise<Response> {
  if (!response.ok) return response;
  const payload = await response.json() as ProfilePayload;
  const profileId = typeof payload.profile?.id === 'string' ? payload.profile.id : null;
  if (!profileId || !payload.profile) return responseWithPayload(response, payload);
  payload.profile.design = await loadDesign(env, profileId);
  return responseWithPayload(response, payload);
}

async function persistDesign(env: ProfileEnv, userId: string, design: ProfileDesign): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const statements: D1Statement[] = [env.DB.prepare(`
    INSERT INTO user_profile_design(
      user_id,page_background_type,page_background_primary,page_background_secondary,page_background_angle,
      page_media_fit,page_media_overlay,page_text_colour,page_font_family,content_width,section_gap,
      show_page_heading,show_grid_heading,card_width,card_alignment,card_surface,cover_height,avatar_size,
      card_padding,card_shadow,card_border_width,show_cover,show_avatar,show_headline,show_bio,
      show_location,show_website,card_tile_gap,card_tile_row_height,grid_surface,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET
      page_background_type=excluded.page_background_type,page_background_primary=excluded.page_background_primary,
      page_background_secondary=excluded.page_background_secondary,page_background_angle=excluded.page_background_angle,
      page_media_fit=excluded.page_media_fit,page_media_overlay=excluded.page_media_overlay,
      page_text_colour=excluded.page_text_colour,page_font_family=excluded.page_font_family,
      content_width=excluded.content_width,section_gap=excluded.section_gap,
      show_page_heading=excluded.show_page_heading,show_grid_heading=excluded.show_grid_heading,
      card_width=excluded.card_width,card_alignment=excluded.card_alignment,card_surface=excluded.card_surface,
      cover_height=excluded.cover_height,avatar_size=excluded.avatar_size,card_padding=excluded.card_padding,
      card_shadow=excluded.card_shadow,card_border_width=excluded.card_border_width,
      show_cover=excluded.show_cover,show_avatar=excluded.show_avatar,show_headline=excluded.show_headline,
      show_bio=excluded.show_bio,show_location=excluded.show_location,show_website=excluded.show_website,
      card_tile_gap=excluded.card_tile_gap,card_tile_row_height=excluded.card_tile_row_height,
      grid_surface=excluded.grid_surface,updated_at=excluded.updated_at
  `).bind(
    userId, design.pageBackgroundType, design.pageBackgroundPrimary, design.pageBackgroundSecondary, design.pageBackgroundAngle,
    design.pageMediaFit, design.pageMediaOverlay, design.pageTextColour, design.pageFontFamily, design.contentWidth, design.sectionGap,
    design.showPageHeading ? 1 : 0, design.showGridHeading ? 1 : 0, design.cardWidth, design.cardAlignment, design.cardSurface,
    design.coverHeight, design.avatarSize, design.cardPadding, design.cardShadow, design.cardBorderWidth,
    design.showCover ? 1 : 0, design.showAvatar ? 1 : 0, design.showHeadline ? 1 : 0, design.showBio ? 1 : 0,
    design.showLocation ? 1 : 0, design.showWebsite ? 1 : 0, design.cardTileGap, design.cardTileRowHeight, design.gridSurface, now
  ), env.DB.prepare(`DELETE FROM user_profile_design_media WHERE user_id=?`).bind(userId)];
  if (design.pageBackgroundMedia) {
    statements.push(env.DB.prepare(`
      INSERT INTO user_profile_design_media(user_id,media_slot,media_data,updated_at)
      VALUES(?,'page_background',?,?)
    `).bind(userId, design.pageBackgroundMedia, now));
  }
  statements.push(env.DB.prepare(`
    INSERT INTO audit_events(id,actor_user_id,event_type,target_type,target_id,metadata_json,created_at)
    VALUES(?,?,?,?,?,?,?)
  `).bind(crypto.randomUUID(), userId, 'profile.design_updated', 'user', userId, JSON.stringify({
    pageBackgroundType: design.pageBackgroundType,
    contentWidth: design.contentWidth,
    cardWidth: design.cardWidth,
    cardAlignment: design.cardAlignment,
    cardSurface: design.cardSurface,
    coverHeight: design.coverHeight,
    avatarSize: design.avatarSize,
    cardTileGap: design.cardTileGap,
    cardTileRowHeight: design.cardTileRowHeight,
    gridSurface: design.gridSurface,
    hasPageMedia: Boolean(design.pageBackgroundMedia)
  }), now));
  await env.DB.batch(statements);
}

async function saveWithProfile(request: Request, env: ProfileEnv): Promise<Response | null> {
  let body: Record<string, unknown>;
  try {
    const value: unknown = await request.clone().json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    body = value as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!Object.prototype.hasOwnProperty.call(body, 'design')) return null;
  if (!sameOrigin(request)) return secureJson({ ok: false, message: 'Origin rejected.' }, 403);
  const viewer = await getViewer(request, env);
  if (!viewer) return secureJson({ ok: false, message: 'Authentication required.' }, 401);
  const design = designFromInput(body.design);
  if (!design) return secureJson({ ok: false, message: 'Choose valid profile-page and profile-card design settings.' }, 400);
  const mediaBytes = await completeIncomingMediaBytes(body, design, env, viewer.id);
  if (mediaBytes === null) return secureJson({ ok: false, message: 'Choose valid PNG, JPEG, WebP or animated GIF profile media no larger than 1.4 MB each.' }, 400);
  if (mediaBytes > MAX_PROFILE_MEDIA_BYTES) return secureJson({ ok: false, message: 'Profile pictures and all profile tile media may use up to 8 MB in total.' }, 400);
  const response = await handleProfileCardTilesRequest(request, env);
  if (!response || !response.ok) return response;
  await persistDesign(env, viewer.id, design);
  return injectDesign(response, env);
}

export async function handleProfileCustomizationRequest(request: Request, env: ProfileEnv): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (path === '/api/profile' && request.method === 'PUT') return saveWithProfile(request, env);
  if (/^\/api\/profiles\/[^/]+$/.test(path) && request.method === 'GET') {
    const response = await handleProfileCardTilesRequest(request, env);
    return response ? injectDesign(response, env) : null;
  }
  return null;
}
