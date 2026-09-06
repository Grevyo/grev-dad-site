PRAGMA foreign_keys = OFF;
DROP TRIGGER IF EXISTS grev_home_progression_first_credit;
DROP TRIGGER IF EXISTS grev_home_progression_increment_credit;
DROP TRIGGER IF EXISTS grev_home_platform_change_progress_insert;
DROP TRIGGER IF EXISTS grev_home_platform_change_progress_update;

-- Multiple GrevIDs can belong to one restored account; the old UNIQUE(user_id) prevented that.
CREATE TABLE grev_home_progression_state_v2 (
  grev_id TEXT PRIMARY KEY COLLATE NOCASE,
  link_id TEXT REFERENCES grev_home_links(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  home_total_xp INTEGER NOT NULL DEFAULT 0 CHECK (home_total_xp >= 0),
  home_level INTEGER NOT NULL DEFAULT 1 CHECK (home_level >= 1),
  total_tracked_seconds INTEGER NOT NULL DEFAULT 0 CHECK (total_tracked_seconds >= 0),
  completed_sessions INTEGER NOT NULL DEFAULT 0 CHECK (completed_sessions >= 0),
  unique_apps INTEGER NOT NULL DEFAULT 0 CHECK (unique_apps >= 0),
  updated_at INTEGER NOT NULL
);
INSERT INTO grev_home_progression_state_v2 SELECT * FROM grev_home_progression_state;
DROP TABLE grev_home_progression_state;
ALTER TABLE grev_home_progression_state_v2 RENAME TO grev_home_progression_state;
CREATE INDEX grev_home_progression_user_idx ON grev_home_progression_state(user_id);

-- This is the single Home-XP high-water mark for the Grev.dad account.
CREATE TABLE grev_home_account_progression (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  home_total_xp INTEGER NOT NULL DEFAULT 0 CHECK (home_total_xp >= 0),
  updated_at INTEGER NOT NULL
);
INSERT INTO grev_home_account_progression(user_id,home_total_xp,updated_at)
SELECT user_id,MAX(home_total_xp),MAX(updated_at) FROM grev_home_progression_state GROUP BY user_id;

CREATE TRIGGER grev_home_account_progression_first_credit AFTER INSERT ON grev_home_account_progression
WHEN NEW.home_total_xp > 0 BEGIN
  INSERT INTO user_progression(user_id,total_xp,level,updated_at) VALUES(NEW.user_id,0,1,unixepoch()) ON CONFLICT(user_id) DO NOTHING;
  UPDATE user_progression SET total_xp=total_xp+NEW.home_total_xp,level=CAST((total_xp+NEW.home_total_xp)/500 AS INTEGER)+1,updated_at=unixepoch() WHERE user_id=NEW.user_id;
  INSERT OR IGNORE INTO xp_ledger(id,user_id,xp_amount,source_type,source_id,event_key,description,created_at)
  VALUES('grev-home-account:'||NEW.user_id||':'||NEW.home_total_xp,NEW.user_id,NEW.home_total_xp,'grev_home',NEW.user_id,
    'grev-home-account:'||NEW.user_id||':'||NEW.home_total_xp,'Grev Home shared account progression',unixepoch());
END;
CREATE TRIGGER grev_home_account_progression_increment_credit AFTER UPDATE OF home_total_xp ON grev_home_account_progression
WHEN NEW.home_total_xp > OLD.home_total_xp BEGIN
  UPDATE user_progression SET total_xp=total_xp+(NEW.home_total_xp-OLD.home_total_xp),level=CAST((total_xp+(NEW.home_total_xp-OLD.home_total_xp))/500 AS INTEGER)+1,updated_at=unixepoch() WHERE user_id=NEW.user_id;
  INSERT OR IGNORE INTO xp_ledger(id,user_id,xp_amount,source_type,source_id,event_key,description,created_at)
  VALUES('grev-home-account:'||NEW.user_id||':'||NEW.home_total_xp,NEW.user_id,NEW.home_total_xp-OLD.home_total_xp,'grev_home',NEW.user_id,
    'grev-home-account:'||NEW.user_id||':'||NEW.home_total_xp,'Grev Home shared account progression',unixepoch());
END;

CREATE TRIGGER grev_home_platform_change_progress_insert AFTER INSERT ON grev_home_progression_state BEGIN
 UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER grev_home_platform_change_progress_update AFTER UPDATE ON grev_home_progression_state BEGIN
 UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
PRAGMA foreign_keys = ON;
