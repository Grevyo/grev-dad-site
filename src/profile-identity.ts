// The one identity a person has on grev.dad and in Grev Home: display name, headline, bio,
// location, website, avatar and banner. Stored where the grev.dad profile editor already keeps
// them (users.display_name, user_profiles, user_profile_media), so editing in either place edits
// the same record. Grev Home's public card (grev_home_public_cards) now keeps only its display
// options (theme, frame, which stats to show, status message) and reads identity through here.
//
// Reads apply the owner's grev.dad field privacy for the viewer, so a bio or avatar hidden on the
// website is hidden from Grev Home friends lists too.

import { canView, type PrivacyRow, type PrivacyViewer } from './profile-privacy-hardening';
import { validImageDataUrl } from './profile-media';

type Statement = {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
};
export type IdentityDatabase = {
  prepare(query: string): Statement;
  batch(statements: Statement[]): Promise<unknown[]>;
};

export type CanonicalIdentity = {
  headline: string | null;
  bio: string | null;
  location: string | null;
  websiteUrl: string | null;
  avatarMedia: string | null;
  coverMedia: string | null;
};

export type IdentityPatch = Partial<CanonicalIdentity & { displayName: string }>;

export const MAX_BIO_LENGTH = 800;
export const MAX_HEADLINE_LENGTH = 120;
const MAX_PROFILE_MEDIA_BYTES = 8 * 1024 * 1024;
const MAX_BATCH = 90;

const EMPTY: CanonicalIdentity = { headline: null, bio: null, location: null, websiteUrl: null, avatarMedia: null, coverMedia: null };

type IdentityRow = {
  user_id: string;
  headline: string | null;
  bio: string | null;
  location: string | null;
  website_url: string | null;
  avatar_media: string | null;
  cover_media: string | null;
};

/**
 * Canonical identity for each user, as `viewer` may see it. viewer null = trusted, unfiltered
 * (the owner reading their own record).
 */
export async function readCanonicalIdentities(
  db: IdentityDatabase,
  userIds: string[],
  viewer: PrivacyViewer | null
): Promise<Map<string, CanonicalIdentity>> {
  const result = new Map<string, CanonicalIdentity>();
  const unique = [...new Set(userIds.filter(Boolean))];
  for (let offset = 0; offset < unique.length; offset += MAX_BATCH) {
    const ids = unique.slice(offset, offset + MAX_BATCH);
    const marks = ids.map(() => '?').join(',');
    const [profiles, media, privacy, groups] = await Promise.all([
      db.prepare(`SELECT user_id,headline,bio,location,website_url,avatar_media,cover_media FROM user_profiles WHERE user_id IN (${marks})`)
        .bind(...ids).all<IdentityRow>(),
      db.prepare(`SELECT user_id,media_slot,media_data FROM user_profile_media WHERE user_id IN (${marks})`)
        .bind(...ids).all<{ user_id: string; media_slot: 'avatar' | 'cover'; media_data: string }>(),
      viewer
        ? db.prepare(`SELECT user_id,field_key AS key,visibility,group_id FROM user_profile_field_privacy WHERE user_id IN (${marks})`)
          .bind(...ids).all<PrivacyRow & { user_id: string }>()
        : Promise.resolve({ results: [] as (PrivacyRow & { user_id: string })[] }),
      viewer
        ? db.prepare(`
            SELECT owner.user_id,owner.group_id FROM group_memberships owner
            JOIN group_memberships viewer ON viewer.group_id=owner.group_id
            WHERE owner.user_id IN (${marks}) AND viewer.user_id=?
          `).bind(...ids, viewer.id).all<{ user_id: string; group_id: string }>()
        : Promise.resolve({ results: [] as { user_id: string; group_id: string }[] })
    ]);
    const profileById = new Map(profiles.results.map(row => [row.user_id, row]));
    const mediaById = new Map<string, Map<string, string>>();
    for (const row of media.results) {
      const slots = mediaById.get(row.user_id) ?? new Map<string, string>();
      slots.set(row.media_slot, row.media_data);
      mediaById.set(row.user_id, slots);
    }
    for (const id of ids) {
      const row = profileById.get(id);
      const slots = mediaById.get(id);
      const identity: CanonicalIdentity = {
        headline: row?.headline ?? null,
        bio: row?.bio ?? null,
        location: row?.location ?? null,
        websiteUrl: row?.website_url ?? null,
        avatarMedia: slots?.get('avatar') ?? row?.avatar_media ?? null,
        coverMedia: slots?.get('cover') ?? row?.cover_media ?? null
      };
      if (viewer && viewer.id !== id) {
        const rules = new Map(privacy.results.filter(rule => rule.user_id === id).map(rule => [rule.key, rule]));
        const shared = new Set(groups.results.filter(group => group.user_id === id).map(group => group.group_id));
        const visible = (key: string) => canView(rules.get(key), false, viewer, shared);
        if (!visible('headline')) identity.headline = null;
        if (!visible('bio')) identity.bio = null;
        if (!visible('location')) identity.location = null;
        if (!visible('website')) identity.websiteUrl = null;
        if (!visible('avatar')) identity.avatarMedia = null;
        if (!visible('cover')) identity.coverMedia = null;
      }
      result.set(id, identity);
    }
  }
  return result;
}

export async function readCanonicalIdentity(db: IdentityDatabase, userId: string, viewer: PrivacyViewer | null): Promise<CanonicalIdentity> {
  return (await readCanonicalIdentities(db, [userId], viewer)).get(userId) ?? { ...EMPTY };
}

function cleanOptional(value: unknown, maximum: number): string | null | undefined {
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length <= maximum ? trimmed : undefined;
}

function dataUrlBytes(value: string): number {
  const encoded = value.slice(value.indexOf(',') + 1);
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  return Math.floor(encoded.length * 3 / 4) - padding;
}

/**
 * Validates a partial identity update. Only keys present in the input are returned, so a client
 * that only edits its bio never clears an avatar it did not send. Returns an error message for
 * invalid input.
 */
export function identityPatchFromInput(input: Record<string, unknown>): IdentityPatch | string {
  const patch: IdentityPatch = {};
  if ('displayName' in input) {
    const name = typeof input.displayName === 'string' ? input.displayName.trim() : '';
    if (name.length < 1 || name.length > 60) return 'Display names must be 1 to 60 characters.';
    patch.displayName = name;
  }
  const texts: [keyof CanonicalIdentity, number, string][] = [
    ['headline', MAX_HEADLINE_LENGTH, 'Headlines can be up to 120 characters.'],
    ['bio', MAX_BIO_LENGTH, 'Bios can be up to 800 characters.'],
    ['location', 100, 'Locations can be up to 100 characters.'],
    ['websiteUrl', 500, 'Website addresses can be up to 500 characters.']
  ];
  for (const [key, maximum, message] of texts) {
    if (!(key in input)) continue;
    const value = cleanOptional(input[key], maximum);
    if (value === undefined) return message;
    (patch as Record<string, unknown>)[key] = value;
  }
  if (patch.websiteUrl) {
    try {
      const url = new URL(patch.websiteUrl);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'Website addresses must start with http:// or https://.';
    } catch {
      return 'Enter a valid website address.';
    }
  }
  for (const key of ['avatarMedia', 'coverMedia'] as const) {
    if (!(key in input)) continue;
    const value = input[key];
    if (value === null || value === '') { patch[key] = null; continue; }
    if (typeof value !== 'string' || !validImageDataUrl(value)) return 'Choose a valid PNG, JPEG, GIF or WebP image under 1.4 MB.';
    patch[key] = value;
  }
  return patch;
}

/** Writes a validated patch. Returns an error message when it would exceed the 8 MB media budget. */
export async function writeCanonicalIdentity(db: IdentityDatabase, userId: string, patch: IdentityPatch, source: string): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  const touchesMedia = 'avatarMedia' in patch || 'coverMedia' in patch;
  if (touchesMedia) {
    const [tileMedia, cardTileMedia, current] = await Promise.all([
      db.prepare(`SELECT background_media FROM user_profile_tiles WHERE user_id=? AND background_media IS NOT NULL`)
        .bind(userId).all<{ background_media: string }>(),
      db.prepare(`SELECT media_data FROM user_profile_card_tile_media WHERE user_id=?`)
        .bind(userId).all<{ media_data: string }>().catch(() => ({ results: [] as { media_data: string }[] })),
      readCanonicalIdentity(db, userId, null)
    ]);
    const avatar = 'avatarMedia' in patch ? patch.avatarMedia : current.avatarMedia;
    const cover = 'coverMedia' in patch ? patch.coverMedia : current.coverMedia;
    const total = [avatar, cover].reduce((sum, media) => sum + (media ? dataUrlBytes(media) : 0), 0)
      + tileMedia.results.reduce((sum, row) => sum + dataUrlBytes(row.background_media), 0)
      + cardTileMedia.results.reduce((sum, row) => sum + dataUrlBytes(row.media_data), 0);
    if (total > MAX_PROFILE_MEDIA_BYTES) return 'Profile pictures and all profile tile media may use up to 8 MB in total.';
  }

  const statements: Statement[] = [];
  if (patch.displayName !== undefined) {
    statements.push(db.prepare(`UPDATE users SET display_name=?,updated_at=? WHERE id=?`).bind(patch.displayName, now, userId));
  }
  const columns: [keyof CanonicalIdentity, string][] = [
    ['headline', 'headline'], ['bio', 'bio'], ['location', 'location'], ['websiteUrl', 'website_url']
  ];
  const changed = columns.filter(([key]) => key in patch);
  if (changed.length || touchesMedia) {
    statements.push(db.prepare(`INSERT INTO user_profiles(user_id,updated_at) VALUES(?,?) ON CONFLICT(user_id) DO NOTHING`).bind(userId, now));
  }
  if (changed.length) {
    statements.push(db.prepare(`UPDATE user_profiles SET ${changed.map(([, column]) => `${column}=?`).join(',')},updated_at=? WHERE user_id=?`)
      .bind(...changed.map(([key]) => patch[key] ?? null), now, userId));
  }
  for (const [key, slot, legacy] of [['avatarMedia', 'avatar', 'avatar_media'], ['coverMedia', 'cover', 'cover_media']] as const) {
    if (!(key in patch)) continue;
    const media = patch[key];
    // The website keeps media in user_profile_media; the legacy column is cleared so it can
    // never shadow a removal.
    statements.push(db.prepare(`UPDATE user_profiles SET ${legacy}=NULL WHERE user_id=?`).bind(userId));
    statements.push(media
      ? db.prepare(`
          INSERT INTO user_profile_media(user_id,media_slot,media_data,updated_at) VALUES(?,?,?,?)
          ON CONFLICT(user_id,media_slot) DO UPDATE SET media_data=excluded.media_data,updated_at=excluded.updated_at
        `).bind(userId, slot, media, now)
      : db.prepare(`DELETE FROM user_profile_media WHERE user_id=? AND media_slot=?`).bind(userId, slot));
  }
  if (!statements.length) return null;
  statements.push(db.prepare(`
    INSERT INTO audit_events(id,actor_user_id,event_type,target_type,target_id,metadata_json,created_at)
    VALUES(?,?,?,?,?,?,?)
  `).bind(crypto.randomUUID(), userId, 'profile.identity_updated', 'user', userId,
    JSON.stringify({ source, fields: Object.keys(patch) }), now));
  await db.batch(statements);
  return null;
}
