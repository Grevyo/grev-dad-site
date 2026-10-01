-- Minimal profile tables for contract tests that build their own schema rather than running every
-- migration: what src/profile-identity.ts reads and writes when a Grev Home public card is served.
CREATE TABLE IF NOT EXISTS user_profiles (user_id TEXT PRIMARY KEY, headline TEXT, bio TEXT, location TEXT,
  website_url TEXT, avatar_media TEXT, cover_media TEXT, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS user_profile_media (user_id TEXT NOT NULL, media_slot TEXT NOT NULL, media_data TEXT NOT NULL,
  updated_at INTEGER NOT NULL, PRIMARY KEY(user_id,media_slot));
CREATE TABLE IF NOT EXISTS user_profile_field_privacy (user_id TEXT NOT NULL, field_key TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'all', group_id TEXT, updated_at INTEGER, PRIMARY KEY(user_id,field_key));
CREATE TABLE IF NOT EXISTS group_memberships (group_id TEXT NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY(group_id,user_id));
CREATE TABLE IF NOT EXISTS user_profile_card_tile_media (user_id TEXT NOT NULL, media_data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, actor_user_id TEXT, event_type TEXT NOT NULL,
  target_type TEXT NOT NULL, target_id TEXT, metadata_json TEXT, created_at INTEGER NOT NULL);
