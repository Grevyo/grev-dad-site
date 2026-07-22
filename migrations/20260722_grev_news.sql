PRAGMA foreign_keys = ON;

CREATE TABLE grev_news_posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  body TEXT,
  category TEXT NOT NULL DEFAULT 'cs2' CHECK (category IN ('grev','cs2','team','site','community')),
  team_tags_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0,1)),
  source_name TEXT,
  source_url TEXT,
  image_url TEXT,
  external_key TEXT UNIQUE,
  published_at INTEGER NOT NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_grev_news_public ON grev_news_posts(status,is_featured,published_at DESC);
CREATE INDEX idx_grev_news_category ON grev_news_posts(category,status,published_at DESC);

CREATE TABLE grev_news_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('steam','rss','jsonfeed','liquipedia')),
  source_url TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'cs2' CHECK (category IN ('grev','cs2','team','site','community')),
  team_keywords_json TEXT NOT NULL DEFAULT '[]',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  auto_publish INTEGER NOT NULL DEFAULT 0 CHECK (auto_publish IN (0,1)),
  refresh_minutes INTEGER NOT NULL DEFAULT 60 CHECK (refresh_minutes BETWEEN 15 AND 1440),
  last_checked_at INTEGER,
  last_status TEXT,
  last_error TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE grev_news_import_runs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES grev_news_sources(id) ON DELETE CASCADE,
  started_at INTEGER NOT NULL,
  finished_at INTEGER NOT NULL,
  imported_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('ok','error')),
  error_message TEXT,
  triggered_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_grev_news_import_runs ON grev_news_import_runs(source_id,started_at DESC);

INSERT INTO grev_news_sources(
  id,name,source_type,source_url,category,team_keywords_json,enabled,auto_publish,refresh_minutes,
  last_checked_at,last_status,last_error,created_by,created_at,updated_at
) VALUES(
  'source-valve-cs2','Valve · Counter-Strike 2','steam',
  'https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=730&count=20&maxlength=600',
  'cs2','[]',1,1,60,NULL,NULL,NULL,NULL,unixepoch(),unixepoch()
);
