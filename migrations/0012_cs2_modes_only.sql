-- CS2 mode-based public stat summaries for Premier, Competitive, and Wingman.
-- FACEIT tables from 0011 are intentionally left dormant/unused for compatibility.

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

CREATE TABLE IF NOT EXISTS cs2_match_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('premier', 'competitive', 'wingman', 'unknown')),
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

CREATE INDEX IF NOT EXISTS idx_cs2_match_history_user_mode_date
ON cs2_match_history(user_id, mode, match_date);
