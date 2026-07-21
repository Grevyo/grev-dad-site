PRAGMA foreign_keys = ON;

CREATE INDEX IF NOT EXISTS profile_guestbook_parent_created
  ON profile_guestbook_entries(profile_user_id,parent_id,created_at);

CREATE INDEX IF NOT EXISTS profile_guestbook_pinned_created
  ON profile_guestbook_entries(profile_user_id,is_pinned DESC,created_at);

CREATE INDEX IF NOT EXISTS profile_guestbook_reports_entry
  ON profile_guestbook_reports(entry_id,created_at);

CREATE INDEX IF NOT EXISTS profile_blocks_owner
  ON profile_blocks(owner_user_id,blocked_user_id);

CREATE INDEX IF NOT EXISTS dashboard_pages_group_updated
  ON dashboard_pages(group_id,updated_at DESC);
