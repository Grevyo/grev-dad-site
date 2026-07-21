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

CREATE TABLE IF NOT EXISTS platform_change_revision (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL DEFAULT 0,
  changed_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT OR IGNORE INTO platform_change_revision(id,revision,changed_at) VALUES(1,0,unixepoch());

CREATE TRIGGER IF NOT EXISTS platform_change_content_items_insert AFTER INSERT ON content_items BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_content_items_update AFTER UPDATE ON content_items BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_content_items_delete AFTER DELETE ON content_items BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_notifications_insert AFTER INSERT ON notifications BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_notifications_update AFTER UPDATE ON notifications BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_notifications_delete AFTER DELETE ON notifications BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_presence_insert AFTER INSERT ON user_presence BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_presence_update AFTER UPDATE ON user_presence BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_presence_delete AFTER DELETE ON user_presence BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_pages_insert AFTER INSERT ON dashboard_pages BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_pages_update AFTER UPDATE ON dashboard_pages BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_pages_delete AFTER DELETE ON dashboard_pages BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_layouts_insert AFTER INSERT ON dashboard_device_layouts BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_layouts_update AFTER UPDATE ON dashboard_device_layouts BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_layouts_delete AFTER DELETE ON dashboard_device_layouts BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_guestbook_insert AFTER INSERT ON profile_guestbook_entries BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_guestbook_update AFTER UPDATE ON profile_guestbook_entries BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_guestbook_delete AFTER DELETE ON profile_guestbook_entries BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_reactions_insert AFTER INSERT ON profile_reactions BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_reactions_update AFTER UPDATE ON profile_reactions BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_reactions_delete AFTER DELETE ON profile_reactions BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_reports_insert AFTER INSERT ON profile_guestbook_reports BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_reports_update AFTER UPDATE ON profile_guestbook_reports BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_reports_delete AFTER DELETE ON profile_guestbook_reports BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_blocks_insert AFTER INSERT ON profile_blocks BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_blocks_update AFTER UPDATE ON profile_blocks BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_blocks_delete AFTER DELETE ON profile_blocks BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_subscriptions_insert AFTER INSERT ON profile_subscriptions BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_subscriptions_update AFTER UPDATE ON profile_subscriptions BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_subscriptions_delete AFTER DELETE ON profile_subscriptions BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_visits_insert AFTER INSERT ON profile_visits BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_visits_update AFTER UPDATE ON profile_visits BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_visits_delete AFTER DELETE ON profile_visits BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_chat_insert AFTER INSERT ON chat_messages BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_chat_update AFTER UPDATE ON chat_messages BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS platform_change_chat_delete AFTER DELETE ON chat_messages BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
