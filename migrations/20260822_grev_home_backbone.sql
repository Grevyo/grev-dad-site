PRAGMA foreign_keys = ON;

-- Grev Home is a linked desktop client, not a second copy of the website users table.
-- The site's UUID remains the server identity; the permanent local GrevID is linked explicitly.
CREATE TABLE grev_home_link_requests (
  id TEXT PRIMARY KEY,
  device_code_hash TEXT NOT NULL UNIQUE,
  user_code TEXT NOT NULL COLLATE NOCASE UNIQUE,
  grev_id TEXT NOT NULL COLLATE NOCASE,
  local_username TEXT NOT NULL,
  local_display_name TEXT NOT NULL,
  device_name TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  approved_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_at INTEGER,
  denied_at INTEGER,
  last_token_issued_at INTEGER,
  CHECK (expires_at > created_at)
);
CREATE INDEX grev_home_link_requests_expiry_idx ON grev_home_link_requests(expires_at);
CREATE INDEX grev_home_link_requests_user_idx ON grev_home_link_requests(approved_user_id);

CREATE TABLE grev_home_links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  grev_id TEXT NOT NULL COLLATE NOCASE UNIQUE,
  local_username TEXT NOT NULL,
  local_display_name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_seen_at INTEGER,
  revoked_at INTEGER
);
CREATE INDEX grev_home_links_active_user_idx ON grev_home_links(user_id) WHERE revoked_at IS NULL;
CREATE INDEX grev_home_links_active_grev_idx ON grev_home_links(grev_id) WHERE revoked_at IS NULL;

CREATE TABLE grev_home_tokens (
  id TEXT PRIMARY KEY,
  link_id TEXT NOT NULL REFERENCES grev_home_links(id) ON DELETE CASCADE,
  link_request_id TEXT REFERENCES grev_home_link_requests(id) ON DELETE SET NULL,
  token_hash TEXT NOT NULL UNIQUE,
  device_name TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  CHECK (expires_at > created_at)
);
CREATE INDEX grev_home_tokens_active_hash_idx ON grev_home_tokens(token_hash,expires_at) WHERE revoked_at IS NULL;
CREATE INDEX grev_home_tokens_link_idx ON grev_home_tokens(link_id,revoked_at,expires_at);

-- Friendships are canonical unordered pairs. Requests are directional and auditable.
CREATE TABLE grev_home_friend_requests (
  id TEXT PRIMARY KEY,
  sender_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  resolved_at INTEGER,
  CHECK (sender_user_id <> recipient_user_id)
);
CREATE UNIQUE INDEX grev_home_friend_requests_pending_direction_idx
  ON grev_home_friend_requests(sender_user_id,recipient_user_id)
  WHERE status='pending';
CREATE INDEX grev_home_friend_requests_recipient_idx
  ON grev_home_friend_requests(recipient_user_id,status,created_at DESC);
CREATE INDEX grev_home_friend_requests_sender_idx
  ON grev_home_friend_requests(sender_user_id,status,created_at DESC);

CREATE TABLE grev_home_friendships (
  user_low_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_high_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by_request_id TEXT REFERENCES grev_home_friend_requests(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(user_low_id,user_high_id),
  CHECK (user_low_id < user_high_id)
);
CREATE INDEX grev_home_friendships_high_idx ON grev_home_friendships(user_high_id,user_low_id);

-- Durable activity is separate from user_presence. Presence expires; activity is feed/history data.
CREATE TABLE grev_home_activity_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  link_id TEXT REFERENCES grev_home_links(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('app.started','app.stopped')),
  app_id TEXT NOT NULL DEFAULT '',
  app_name TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'friends' CHECK (visibility IN ('friends','private')),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  occurred_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX grev_home_activity_user_time_idx ON grev_home_activity_events(user_id,occurred_at DESC);
CREATE INDEX grev_home_activity_feed_idx ON grev_home_activity_events(visibility,occurred_at DESC);

-- Blocking someone immediately removes the Grev Home friendship and outstanding requests in both directions.
CREATE TRIGGER grev_home_block_removes_friendship
AFTER INSERT ON profile_blocks
BEGIN
  DELETE FROM grev_home_friendships
   WHERE (user_low_id=MIN(NEW.owner_user_id,NEW.blocked_user_id) AND user_high_id=MAX(NEW.owner_user_id,NEW.blocked_user_id));
  UPDATE grev_home_friend_requests
     SET status='cancelled',resolved_at=unixepoch(),updated_at=unixepoch()
   WHERE status='pending'
     AND ((sender_user_id=NEW.owner_user_id AND recipient_user_id=NEW.blocked_user_id)
       OR (sender_user_id=NEW.blocked_user_id AND recipient_user_id=NEW.owner_user_id));
END;

-- Keep the existing platform change revision useful to clients that already observe it.
CREATE TRIGGER grev_home_platform_change_friend_request_insert AFTER INSERT ON grev_home_friend_requests
BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER grev_home_platform_change_friend_request_update AFTER UPDATE ON grev_home_friend_requests
BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER grev_home_platform_change_friendship_insert AFTER INSERT ON grev_home_friendships
BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER grev_home_platform_change_friendship_delete AFTER DELETE ON grev_home_friendships
BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
CREATE TRIGGER grev_home_platform_change_activity_insert AFTER INSERT ON grev_home_activity_events
BEGIN UPDATE platform_change_revision SET revision=revision+1,changed_at=unixepoch() WHERE id=1; END;
