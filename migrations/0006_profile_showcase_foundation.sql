CREATE TABLE IF NOT EXISTS user_unlocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  unlock_key TEXT NOT NULL,
  unlock_type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  source TEXT,
  rarity TEXT NOT NULL DEFAULT 'common',
  metadata_json TEXT,
  unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, unlock_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS profile_showcase_slots (
  user_id INTEGER NOT NULL,
  slot INTEGER NOT NULL,
  unlock_id INTEGER,
  custom_label TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, slot),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (unlock_id) REFERENCES user_unlocks(id) ON DELETE SET NULL
);
