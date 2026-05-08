-- TODO: add encryption-at-rest for cs2_auth_code and latest_known_share_code when a shared secret helper exists.
CREATE TABLE IF NOT EXISTS cs2_match_connections (
  user_id TEXT PRIMARY KEY,
  steam_id64 TEXT,
  steam_profile_url TEXT,
  cs2_auth_code TEXT,
  latest_known_share_code TEXT,
  is_enabled INTEGER DEFAULT 1,
  public_stats_enabled INTEGER DEFAULT 1,
  last_checked_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS faceit_connections (
  user_id TEXT PRIMARY KEY,
  faceit_username TEXT,
  faceit_profile_url TEXT,
  faceit_player_id TEXT,
  is_enabled INTEGER DEFAULT 1,
  public_stats_enabled INTEGER DEFAULT 1,
  last_checked_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cs2_public_stats (
  user_id TEXT PRIMARY KEY,
  premier_rating TEXT,
  premier_rank TEXT,
  last_match_map TEXT,
  last_match_result TEXT,
  last_match_score TEXT,
  recent_form TEXT,
  matches_tracked INTEGER,
  kd TEXT,
  win_rate TEXT,
  last_synced_at TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS faceit_public_stats (
  user_id TEXT PRIMARY KEY,
  faceit_username TEXT,
  faceit_player_id TEXT,
  faceit_level INTEGER,
  faceit_elo INTEGER,
  last_match_map TEXT,
  last_match_result TEXT,
  last_match_score TEXT,
  recent_form TEXT,
  matches_tracked INTEGER,
  kd TEXT,
  win_rate TEXT,
  last_synced_at TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS external_cs_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  source TEXT CHECK (source IN ('premier', 'faceit')),
  external_match_id TEXT,
  safe_match_ref TEXT,
  map TEXT,
  match_date TEXT,
  team_score INTEGER,
  enemy_score INTEGER,
  result TEXT,
  kills INTEGER,
  deaths INTEGER,
  assists INTEGER,
  kd TEXT,
  rank_at_time TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_external_cs_matches_user_source ON external_cs_matches(user_id, source, match_date);
