-- CS2 match-history state, private discovered share codes, imported matches, and mode public stat summaries.
-- FACEIT tables from 0011 are intentionally left dormant/unused for compatibility.
-- These ALTER statements are mirrored by runtime-safe try/catch checks in src/index.js for already-deployed databases.

ALTER TABLE cs2_match_connections ADD COLUMN connected_at TEXT;
ALTER TABLE cs2_match_connections ADD COLUMN last_successful_sync_at TEXT;
ALTER TABLE cs2_match_connections ADD COLUMN last_sync_error TEXT;
ALTER TABLE cs2_match_connections ADD COLUMN sync_status TEXT;

CREATE TABLE IF NOT EXISTS cs2_match_share_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  share_code_private TEXT,
  safe_share_ref TEXT,
  discovered_at TEXT DEFAULT CURRENT_TIMESTAMP,
  source TEXT DEFAULT 'steam_match_history',
  imported_at TEXT,
  import_status TEXT DEFAULT 'pending',
  import_error TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cs2_match_share_codes_user_ref
ON cs2_match_share_codes(user_id, safe_share_ref);

CREATE TABLE IF NOT EXISTS cs2_imported_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  safe_share_ref TEXT,
  match_date TEXT,
  map TEXT,
  mode TEXT CHECK (mode IN ('premier', 'competitive', 'wingman', 'unknown')) DEFAULT 'unknown',
  result TEXT,
  team_score INTEGER,
  enemy_score INTEGER,
  kills INTEGER,
  deaths INTEGER,
  assists INTEGER,
  damage INTEGER,
  adr TEXT,
  kd TEXT,
  rank_before TEXT,
  rank_after TEXT,
  imported_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cs2_imported_matches_user_mode_date
ON cs2_imported_matches(user_id, mode, match_date);

CREATE TABLE IF NOT EXISTS cs2_mode_public_stats (
  user_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('premier', 'competitive', 'wingman')),
  rank_label TEXT,
  rating TEXT,
  map_group TEXT,
  last_match_map TEXT,
  last_match_result TEXT,
  last_match_score TEXT,
  recent_form TEXT,
  matches_tracked INTEGER DEFAULT 0,
  wins INTEGER,
  losses INTEGER,
  win_rate TEXT,
  kills INTEGER,
  deaths INTEGER,
  assists INTEGER,
  kd TEXT,
  last_synced_at TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, mode)
);
