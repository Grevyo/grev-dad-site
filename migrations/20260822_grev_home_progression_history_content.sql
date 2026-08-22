PRAGMA foreign_keys = ON;

-- Optional game/content identity is stored separately from the immutable app-session row. This
-- migration sorts after progression_history (which creates the parent table), and it is safe even
-- on databases where an earlier experimental migration already added unused nullable columns.
CREATE TABLE IF NOT EXISTS grev_home_session_content (
  link_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  content_id TEXT,
  content_name TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(link_id,session_id),
  FOREIGN KEY(link_id,session_id)
    REFERENCES grev_home_session_history(link_id,session_id)
    ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS grev_home_session_content_id_idx
  ON grev_home_session_content(content_id);
