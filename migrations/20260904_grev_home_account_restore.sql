-- Keep the existing account link and all foreign keys intact. Local profile IDs are
-- sync sources; website user_id is the permanent account identity.
ALTER TABLE grev_home_tokens ADD COLUMN local_grev_id TEXT;
CREATE TABLE grev_home_profile_sources (
  grev_id TEXT PRIMARY KEY COLLATE NOCASE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_created_at INTEGER,
  local_username TEXT NOT NULL DEFAULT '',
  local_display_name TEXT NOT NULL DEFAULT '',
  total_seconds INTEGER NOT NULL DEFAULT 0,
  completed_sessions INTEGER NOT NULL DEFAULT 0,
  unique_apps INTEGER NOT NULL DEFAULT 0,
  apps_json TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL
);
CREATE INDEX grev_home_sources_user ON grev_home_profile_sources(user_id);
INSERT INTO grev_home_profile_sources(grev_id,user_id,total_seconds,completed_sessions,unique_apps,updated_at)
SELECT grev_id,user_id,total_tracked_seconds,completed_sessions,unique_apps,updated_at
FROM grev_home_progression_state;
INSERT OR IGNORE INTO grev_home_profile_sources(grev_id,user_id,updated_at)
SELECT grev_id,user_id,updated_at FROM grev_home_links;
UPDATE grev_home_tokens SET local_grev_id=(SELECT grev_id FROM grev_home_links WHERE id=link_id);
UPDATE grev_home_profile_sources SET
  local_username=COALESCE((SELECT local_username FROM grev_home_links l WHERE l.grev_id=grev_home_profile_sources.grev_id),''),
  local_display_name=COALESCE((SELECT local_display_name FROM grev_home_links l WHERE l.grev_id=grev_home_profile_sources.grev_id),'');
