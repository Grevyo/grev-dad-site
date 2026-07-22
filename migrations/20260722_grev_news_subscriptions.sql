PRAGMA foreign_keys = ON;

CREATE TABLE grev_news_subscriptions (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_type TEXT NOT NULL CHECK (subscription_type IN ('grev','cs2','team')),
  subscription_key TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, subscription_type, subscription_key)
);

CREATE INDEX idx_grev_news_subscriptions_user ON grev_news_subscriptions(user_id, subscription_type);

CREATE TABLE grev_news_dashboard_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  selected_scope TEXT NOT NULL DEFAULT 'subscribed',
  initialized_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO grev_news_subscriptions(user_id,subscription_type,subscription_key,label,created_at)
SELECT id,'grev','grev','Grev News',unixepoch() FROM users;

INSERT OR IGNORE INTO grev_news_dashboard_preferences(user_id,selected_scope,initialized_at,updated_at)
SELECT id,'subscribed',unixepoch(),unixepoch() FROM users;

CREATE TRIGGER grev_news_default_subscription_after_user_insert
AFTER INSERT ON users
BEGIN
  INSERT OR IGNORE INTO grev_news_subscriptions(user_id,subscription_type,subscription_key,label,created_at)
  VALUES(NEW.id,'grev','grev','Grev News',unixepoch());
  INSERT OR IGNORE INTO grev_news_dashboard_preferences(user_id,selected_scope,initialized_at,updated_at)
  VALUES(NEW.id,'subscribed',unixepoch(),unixepoch());
END;
