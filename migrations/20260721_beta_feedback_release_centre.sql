PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS feedback_reports (
  id TEXT PRIMARY KEY,
  reporter_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK(category IN ('broken','visual','confusing','suggestion','general')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  expected_result TEXT,
  screenshot_data TEXT,
  page_url TEXT,
  page_title TEXT,
  user_agent TEXT,
  viewport_json TEXT NOT NULL DEFAULT '{}',
  diagnostics_json TEXT NOT NULL DEFAULT '{}',
  environment TEXT NOT NULL,
  build_commit TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','investigating','fixed','cannot_reproduce','planned','closed')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK(severity IN ('low','medium','high','critical')),
  assigned_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  internal_notes TEXT,
  duplicate_of TEXT REFERENCES feedback_reports(id) ON DELETE SET NULL,
  resolved_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback_report_events (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES feedback_reports(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS feedback_reports_status_created ON feedback_reports(status,created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_reports_category_created ON feedback_reports(category,created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_reports_reporter_created ON feedback_reports(reporter_user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_report_events_report ON feedback_report_events(report_id,created_at DESC);

INSERT OR IGNORE INTO site_settings(setting_key,setting_value,updated_at) VALUES
('beta_enabled','1',unixepoch()),
('beta_message','Grev.dad is currently in live beta. Please report anything that feels broken, confusing or unfinished.',unixepoch()),
('release_name','Grev.dad Live Beta',unixepoch()),
('release_notes','First live beta containing the rebuilt dashboard, profiles, chat, Content Hub, achievements, administration and integrated feedback reporting.',unixepoch()),
('known_issues','',unixepoch()),
('release_commit','Pending deployment marker',unixepoch()),
('release_previous_commit','',unixepoch()),
('release_deployed_at','0',unixepoch());