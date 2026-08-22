PRAGMA foreign_keys = ON;

-- App history exists before game/content launchers. Reserve optional content identity now so a
-- future emulator/library launch can distinguish, for example, PCSX2 from the game run inside it
-- without redesigning or replacing previously uploaded session history.
ALTER TABLE grev_home_session_history ADD COLUMN content_id TEXT;
ALTER TABLE grev_home_session_history ADD COLUMN content_name TEXT;
CREATE INDEX IF NOT EXISTS grev_home_session_history_content_time_idx
  ON grev_home_session_history(user_id,content_id,ended_at DESC);
