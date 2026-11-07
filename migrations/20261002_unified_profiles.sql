-- One profile across grev.dad and Grev Home.
--
-- 1. Widget tiles. A widget tile is stored as an ordinary 'text' tile plus a widget kind, so an
--    older client that does not know widgets still shows it as a titled text tile instead of
--    dropping it (and keeps it when it saves the layout back).
-- 2. Favourite games, best friends and a linked RetroAchievements account, which the widgets show.
-- 3. The Grev Home public card's bio, avatar and banner move into the canonical profile, so the
--    two can no longer drift apart. The card keeps only its display options.

ALTER TABLE user_profile_tiles ADD COLUMN widget TEXT;
ALTER TABLE user_profile_tiles ADD COLUMN widget_config TEXT NOT NULL DEFAULT '{}';

CREATE TABLE user_favourite_games (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  title TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT '',
  app_id TEXT NOT NULL DEFAULT '',
  content_id TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  added_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,item_key)
);
CREATE INDEX user_favourite_games_order_idx ON user_favourite_games(user_id,position);

CREATE TABLE user_best_friends (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  added_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,friend_user_id),
  CHECK (user_id <> friend_user_id)
);
CREATE INDEX user_best_friends_order_idx ON user_best_friends(user_id,position);

CREATE TABLE user_retroachievements (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  ra_username TEXT NOT NULL,
  summary_json TEXT,
  fetched_at INTEGER,
  last_error TEXT,
  updated_at INTEGER NOT NULL
);

-- A Grev Home bio fills an empty grev.dad bio; it never replaces one.
INSERT INTO user_profiles(user_id,bio,updated_at)
SELECT c.user_id, TRIM(json_extract(c.card_json,'$.bio')), c.updated_at
FROM grev_home_public_cards c
WHERE json_valid(c.card_json) AND TRIM(COALESCE(json_extract(c.card_json,'$.bio'),'')) <> ''
ON CONFLICT(user_id) DO UPDATE SET bio=excluded.bio
WHERE COALESCE(TRIM(user_profiles.bio),'') = '';

-- Likewise a Grev Home avatar or banner fills an empty grev.dad slot only.
INSERT OR IGNORE INTO user_profile_media(user_id,media_slot,media_data,updated_at)
SELECT c.user_id,'avatar',json_extract(c.card_json,'$.avatarMedia'),c.updated_at
FROM grev_home_public_cards c
WHERE json_valid(c.card_json) AND COALESCE(json_extract(c.card_json,'$.avatarMedia'),'') <> ''
  AND NOT EXISTS(SELECT 1 FROM user_profiles p WHERE p.user_id=c.user_id AND COALESCE(p.avatar_media,'') <> '');

INSERT OR IGNORE INTO user_profile_media(user_id,media_slot,media_data,updated_at)
SELECT c.user_id,'cover',json_extract(c.card_json,'$.coverMedia'),c.updated_at
FROM grev_home_public_cards c
WHERE json_valid(c.card_json) AND COALESCE(json_extract(c.card_json,'$.coverMedia'),'') <> ''
  AND NOT EXISTS(SELECT 1 FROM user_profiles p WHERE p.user_id=c.user_id AND COALESCE(p.cover_media,'') <> '');

-- From now on the card is read through the canonical profile, so the copies are dropped; leaving
-- them would bring back an avatar someone later removed on grev.dad.
UPDATE grev_home_public_cards
SET card_json=json_remove(card_json,'$.bio','$.avatarMedia','$.coverMedia')
WHERE json_valid(card_json);
