-- Revision 2 lets an authenticated Grev Home installation replace its own high-water snapshot
-- exactly once after removing the legacy Steam/Discord launcher-idle aggregates.
ALTER TABLE grev_home_profile_sources ADD COLUMN statistics_revision INTEGER NOT NULL DEFAULT 1;

DROP TRIGGER IF EXISTS grev_home_account_progression_increment_credit;
CREATE TRIGGER grev_home_account_progression_increment_credit AFTER UPDATE OF home_total_xp ON grev_home_account_progression
WHEN NEW.home_total_xp <> OLD.home_total_xp BEGIN
  UPDATE user_progression
  SET total_xp=MAX(0,total_xp+(NEW.home_total_xp-OLD.home_total_xp)),
      level=CAST(MAX(0,total_xp+(NEW.home_total_xp-OLD.home_total_xp))/500 AS INTEGER)+1,
      updated_at=unixepoch()
  WHERE user_id=NEW.user_id;
  INSERT INTO xp_ledger(id,user_id,xp_amount,source_type,source_id,event_key,description,created_at)
  VALUES('grev-home-account-correction:'||NEW.user_id||':'||NEW.home_total_xp||':'||unixepoch(),
    NEW.user_id,NEW.home_total_xp-OLD.home_total_xp,'grev_home',NEW.user_id,
    'grev-home-account-correction:'||NEW.user_id||':'||NEW.home_total_xp||':'||unixepoch(),
    CASE WHEN NEW.home_total_xp<OLD.home_total_xp THEN 'Corrected legacy launcher-idle progression' ELSE 'Grev Home shared account progression' END,
    unixepoch()) ON CONFLICT DO NOTHING;
END;
