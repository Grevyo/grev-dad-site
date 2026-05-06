-- grev.dad account XP ledger and achievements.
ALTER TABLE users ADD COLUMN account_xp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN account_level INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS xp_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  source_key TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, source_type, source_key)
);

CREATE TABLE IF NOT EXISTS achievement_definitions (
  achievement_key TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  xp_reward INTEGER NOT NULL DEFAULT 0,
  icon TEXT NOT NULL DEFAULT '',
  rarity TEXT NOT NULL DEFAULT 'common',
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  achievement_key TEXT NOT NULL,
  xp_awarded INTEGER NOT NULL DEFAULT 0,
  earned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(user_id, achievement_key)
);
