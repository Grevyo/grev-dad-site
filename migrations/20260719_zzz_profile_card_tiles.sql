PRAGMA foreign_keys = ON;

CREATE TABLE user_profile_card_tiles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tile_id TEXT NOT NULL,
  tile_kind TEXT NOT NULL CHECK (tile_kind IN ('feature','link','custom')),
  feature_id TEXT REFERENCES dashboard_features(id) ON DELETE SET NULL,
  position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 3),
  grid_x INTEGER NOT NULL CHECK (grid_x BETWEEN 0 AND 3),
  grid_y INTEGER NOT NULL CHECK (grid_y BETWEEN 0 AND 7),
  tile_width INTEGER NOT NULL CHECK (tile_width BETWEEN 1 AND 4),
  tile_height INTEGER NOT NULL CHECK (tile_height BETWEEN 1 AND 2),
  title TEXT,
  description TEXT,
  link_label TEXT,
  link_url TEXT,
  content_mode TEXT NOT NULL DEFAULT 'standard' CHECK (content_mode IN ('standard','media-button')),
  custom_title TEXT,
  custom_icon TEXT,
  background_type TEXT NOT NULL DEFAULT 'solid' CHECK (background_type IN ('solid','gradient','media')),
  background_primary TEXT NOT NULL DEFAULT '#11161d',
  background_secondary TEXT NOT NULL DEFAULT '#5268aa',
  background_angle INTEGER NOT NULL DEFAULT 135 CHECK (background_angle BETWEEN 0 AND 360),
  text_colour TEXT NOT NULL DEFAULT '#f4f7fb',
  font_family TEXT NOT NULL DEFAULT 'system' CHECK (font_family IN ('system','display','mono','serif','rounded')),
  border_colour TEXT NOT NULL DEFAULT '#394657',
  media_fit TEXT NOT NULL DEFAULT 'cover' CHECK (media_fit IN ('cover','contain','stretch')),
  media_overlay TEXT NOT NULL DEFAULT 'dark' CHECK (media_overlay IN ('none','dark','light')),
  icon_mode TEXT NOT NULL DEFAULT 'text' CHECK (icon_mode IN ('text','image')),
  icon_label TEXT,
  icon_text_colour TEXT NOT NULL DEFAULT '#090b0f',
  icon_background_colour TEXT NOT NULL DEFAULT '#f3f5f8',
  icon_border_colour TEXT NOT NULL DEFAULT '#667181',
  icon_media_fit TEXT NOT NULL DEFAULT 'cover' CHECK (icon_media_fit IN ('cover','contain','stretch')),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,tile_id),
  UNIQUE(user_id,position)
);

CREATE TABLE user_profile_card_tile_media (
  user_id TEXT NOT NULL,
  tile_id TEXT NOT NULL,
  media_slot TEXT NOT NULL CHECK (media_slot IN ('background','icon')),
  media_data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,tile_id,media_slot),
  FOREIGN KEY(user_id,tile_id) REFERENCES user_profile_card_tiles(user_id,tile_id) ON DELETE CASCADE
);

CREATE INDEX user_profile_card_tiles_grid_idx ON user_profile_card_tiles(user_id,grid_y,grid_x);
CREATE INDEX user_profile_card_tiles_feature_idx ON user_profile_card_tiles(feature_id);
