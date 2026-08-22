PRAGMA foreign_keys = ON;

-- Completed Grev Home sessions are durable history. They are uploaded only when a GrevID is
-- linked, but the source journal remains local to Grev Home and can be replayed idempotently.
CREATE TABLE grev_home_session_history (
  link_id TEXT NOT NULL REFERENCES grev_home_links(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_id TEXT NOT NULL,
  app_name TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds >= 0),
  outcome TEXT NOT NULL CHECK (outcome IN ('exited','failed')),
  failure_message TEXT,
  client_sequence INTEGER NOT NULL CHECK (client_sequence > 0),
  visibility TEXT NOT NULL DEFAULT 'friends' CHECK (visibility IN ('friends','private')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY(link_id,session_id),
  CHECK (ended_at >= started_at)
);
CREATE INDEX grev_home_session_history_user_time_idx
  ON grev_home_session_history(user_id,ended_at DESC);
CREATE INDEX grev_home_session_history_link_sequence_idx
  ON grev_home_session_history(link_id,client_sequence);
CREATE INDEX grev_home_session_history_feed_idx
  ON grev_home_session_history(visibility,ended_at DESC);

-- Grev Home progression stays authoritative locally. Grev.dad stores only the highest reported
-- local XP snapshot so retries, reconnects and re-links can never award the same Grev Home XP twice.
CREATE TABLE grev_home_progression_state (
  grev_id TEXT PRIMARY KEY COLLATE NOCASE,
  link_id TEXT REFERENCES grev_home_links(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  home_total_xp INTEGER NOT NULL DEFAULT 0 CHECK (home_total_xp >= 0),
  home_level INTEGER NOT NULL DEFAULT 1 CHECK (home_level >= 1),
  total_tracked_seconds INTEGER NOT NULL DEFAULT 0 CHECK (total_tracked_seconds >= 0),
  completed_sessions INTEGER NOT NULL DEFAULT 0 CHECK (completed_sessions >= 0),
  unique_apps INTEGER NOT NULL DEFAULT 0 CHECK (unique_apps >= 0),
  updated_at INTEGER NOT NULL
);
CREATE INDEX grev_home_progression_user_idx ON grev_home_progression_state(user_id);

-- Grev.dad's existing progression remains the combined site level. Grev Home XP is one additive
-- source inside it. These triggers award only the increase in the Grev Home high-water mark.
CREATE TRIGGER grev_home_progression_first_credit
AFTER INSERT ON grev_home_progression_state
WHEN NEW.home_total_xp > 0
BEGIN
  INSERT OR IGNORE INTO user_progression(user_id,total_xp,level,updated_at)
    VALUES(NEW.user_id,0,1,unixepoch());
  UPDATE user_progression
     SET total_xp=total_xp+NEW.home_total_xp,
         level=CAST((total_xp+NEW.home_total_xp)/500 AS INTEGER)+1,
         updated_at=unixepoch()
   WHERE user_id=NEW.user_id;
  INSERT OR IGNORE INTO xp_ledger(id,user_id,xp_amount,source_type,source_id,event_key,description,created_at)
    VALUES(
      'grev-home:'||NEW.grev_id||':'||NEW.home_total_xp,
      NEW.user_id,
      NEW.home_total_xp,
      'grev_home',
      NEW.grev_id,
      'grev-home:'||NEW.grev_id||':'||NEW.home_total_xp,
      'Grev Home progression sync',
      unixepoch()
    );
END;

CREATE TRIGGER grev_home_progression_increment_credit
AFTER UPDATE OF home_total_xp ON grev_home_progression_state
WHEN NEW.home_total_xp > OLD.home_total_xp
BEGIN
  INSERT OR IGNORE INTO user_progression(user_id,total_xp,level,updated_at)
    VALUES(NEW.user_id,0,1,unixepoch());
  UPDATE user_progression
     SET total_xp=total_xp+(NEW.home_total_xp-OLD.home_total_xp),
         level=CAST((total_xp+(NEW.home_total_xp-OLD.home_total_xp))/500 AS INTEGER)+1,
         updated_at=unixepoch()
   WHERE user_id=NEW.user_id;
  INSERT OR IGNORE INTO xp_ledger(id,user_id,xp_amount,source_type,source_id,event_key,description,created_at)
    VALUES(
      'grev-home:'||NEW.grev_id||':'||NEW.home_total_xp,
      NEW.user_id,
      NEW.home_total_xp-OLD.home_total_xp,
      'grev_home',
      NEW.grev_id,
      'grev-home:'||NEW.grev_id||':'||NEW.home_total_xp,
      'Grev Home progression sync',
      unixepoch()
    );
END;

CREATE TRIGGER grev_home_platform_change_history_insert
AFTER INSERT ON grev_home_session_history
BEGIN
  UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1;
END;

CREATE TRIGGER grev_home_platform_change_progress_insert
AFTER INSERT ON grev_home_progression_state
BEGIN
  UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1;
END;

CREATE TRIGGER grev_home_platform_change_progress_update
AFTER UPDATE ON grev_home_progression_state
BEGIN
  UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1;
END;
