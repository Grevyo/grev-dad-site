PRAGMA foreign_keys = ON;

CREATE TABLE user_profile_canvas_positions (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  card_x INTEGER NOT NULL DEFAULT 0 CHECK (card_x BETWEEN 0 AND 4),
  card_y INTEGER NOT NULL DEFAULT 0 CHECK (card_y BETWEEN 0 AND 194),
  updated_at INTEGER NOT NULL
);
