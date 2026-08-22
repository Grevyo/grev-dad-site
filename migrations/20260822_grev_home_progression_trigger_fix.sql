PRAGMA foreign_keys = ON;

-- SQLite can apply an outer UPSERT conflict policy to writes performed inside its triggers.
-- The original Grev Home progression triggers used INSERT OR IGNORE for supporting rows; when
-- /api/grev-home/sync itself UPSERTs grev_home_progression_state, an existing user_progression row
-- can therefore surface as a UNIQUE failure instead of being ignored. Recreate the triggers with
-- explicit existence predicates so the behaviour is deterministic under an outer UPSERT.
DROP TRIGGER IF EXISTS grev_home_progression_first_credit;
DROP TRIGGER IF EXISTS grev_home_progression_increment_credit;

CREATE TRIGGER grev_home_progression_first_credit
AFTER INSERT ON grev_home_progression_state
WHEN NEW.home_total_xp > 0
BEGIN
  INSERT INTO user_progression(user_id,total_xp,level,updated_at)
    SELECT NEW.user_id,0,1,unixepoch()
    WHERE NOT EXISTS(SELECT 1 FROM user_progression WHERE user_id=NEW.user_id);

  UPDATE user_progression
     SET total_xp=total_xp+NEW.home_total_xp,
         level=CAST((total_xp+NEW.home_total_xp)/500 AS INTEGER)+1,
         updated_at=unixepoch()
   WHERE user_id=NEW.user_id;

  INSERT INTO xp_ledger(id,user_id,xp_amount,source_type,source_id,event_key,description,created_at)
    SELECT
      'grev-home:'||NEW.grev_id||':'||NEW.home_total_xp,
      NEW.user_id,
      NEW.home_total_xp,
      'grev_home',
      NEW.grev_id,
      'grev-home:'||NEW.grev_id||':'||NEW.home_total_xp,
      'Grev Home progression sync',
      unixepoch()
    WHERE NOT EXISTS(
      SELECT 1 FROM xp_ledger
       WHERE event_key='grev-home:'||NEW.grev_id||':'||NEW.home_total_xp
    );
END;

CREATE TRIGGER grev_home_progression_increment_credit
AFTER UPDATE OF home_total_xp ON grev_home_progression_state
WHEN NEW.home_total_xp > OLD.home_total_xp
BEGIN
  INSERT INTO user_progression(user_id,total_xp,level,updated_at)
    SELECT NEW.user_id,0,1,unixepoch()
    WHERE NOT EXISTS(SELECT 1 FROM user_progression WHERE user_id=NEW.user_id);

  UPDATE user_progression
     SET total_xp=total_xp+(NEW.home_total_xp-OLD.home_total_xp),
         level=CAST((total_xp+(NEW.home_total_xp-OLD.home_total_xp))/500 AS INTEGER)+1,
         updated_at=unixepoch()
   WHERE user_id=NEW.user_id;

  INSERT INTO xp_ledger(id,user_id,xp_amount,source_type,source_id,event_key,description,created_at)
    SELECT
      'grev-home:'||NEW.grev_id||':'||NEW.home_total_xp,
      NEW.user_id,
      NEW.home_total_xp-OLD.home_total_xp,
      'grev_home',
      NEW.grev_id,
      'grev-home:'||NEW.grev_id||':'||NEW.home_total_xp,
      'Grev Home progression sync',
      unixepoch()
    WHERE NOT EXISTS(
      SELECT 1 FROM xp_ledger
       WHERE event_key='grev-home:'||NEW.grev_id||':'||NEW.home_total_xp
    );
END;
