-- Cloud save index. Archives live in R2 (GREV_HOME_SAVES binding); this table is the
-- authoritative pointer to the current archive for each account + app. Saves follow the
-- grev.dad account (user_id), not one local GrevID, so every device linked to the same
-- account restores the same save.
CREATE TABLE grev_home_cloud_saves (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_id TEXT NOT NULL COLLATE NOCASE,
  object_key TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  source_grev_id TEXT NOT NULL DEFAULT '',
  updated_at_ms INTEGER NOT NULL,
  PRIMARY KEY(user_id, app_id)
);
