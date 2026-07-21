PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS dashboard_default_layouts (
  device_mode TEXT PRIMARY KEY CHECK (device_mode IN ('desktop','mobile')),
  layout_json TEXT NOT NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS site_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL DEFAULT '',
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO site_settings(setting_key,setting_value,updated_at) VALUES
('site_title','Grev.dad',unixepoch()),
('header_notice','',unixepoch()),
('community_label','Communities',unixepoch()),
('admin_contact_label','Site administration',unixepoch());
