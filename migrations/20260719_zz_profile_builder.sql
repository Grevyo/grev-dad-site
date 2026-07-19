PRAGMA foreign_keys = ON;

CREATE TABLE user_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  headline TEXT,
  bio TEXT,
  location TEXT,
  website_url TEXT,
  avatar_media TEXT,
  cover_media TEXT,
  background_primary TEXT NOT NULL DEFAULT '#11161d',
  background_secondary TEXT NOT NULL DEFAULT '#3157c9',
  background_angle INTEGER NOT NULL DEFAULT 135 CHECK (background_angle BETWEEN 0 AND 360),
  text_colour TEXT NOT NULL DEFAULT '#f4f7fb',
  border_colour TEXT NOT NULL DEFAULT '#526074',
  show_username INTEGER NOT NULL DEFAULT 1 CHECK (show_username IN (0,1)),
  show_status INTEGER NOT NULL DEFAULT 1 CHECK (show_status IN (0,1)),
  show_member_since INTEGER NOT NULL DEFAULT 1 CHECK (show_member_since IN (0,1)),
  updated_at INTEGER NOT NULL
);

CREATE TABLE user_profile_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  density TEXT NOT NULL DEFAULT 'comfortable' CHECK (density IN ('comfortable','compact')),
  tile_gap INTEGER NOT NULL DEFAULT 12 CHECK (tile_gap IN (0,4,8,12,16,20,24,32,40,48)),
  outer_margin INTEGER NOT NULL DEFAULT 0 CHECK (outer_margin IN (0,8,12,16,24,32,40,48,56,64)),
  updated_at INTEGER NOT NULL
);

CREATE TABLE user_profile_tiles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tile_id TEXT NOT NULL,
  tile_type TEXT NOT NULL CHECK (tile_type IN ('text','link','media','stat')),
  position INTEGER NOT NULL,
  grid_x INTEGER NOT NULL CHECK (grid_x BETWEEN 0 AND 7),
  grid_y INTEGER NOT NULL CHECK (grid_y BETWEEN 0 AND 199),
  tile_width INTEGER NOT NULL CHECK (tile_width BETWEEN 1 AND 6),
  tile_height INTEGER NOT NULL CHECK (tile_height BETWEEN 1 AND 4),
  title TEXT,
  body TEXT,
  link_label TEXT,
  link_url TEXT,
  stat_value TEXT,
  background_type TEXT NOT NULL DEFAULT 'solid' CHECK (background_type IN ('solid','gradient','media')),
  background_primary TEXT NOT NULL DEFAULT '#11161d',
  background_secondary TEXT NOT NULL DEFAULT '#3157c9',
  background_angle INTEGER NOT NULL DEFAULT 135 CHECK (background_angle BETWEEN 0 AND 360),
  background_media TEXT,
  media_fit TEXT NOT NULL DEFAULT 'cover' CHECK (media_fit IN ('cover','contain','stretch')),
  media_overlay TEXT NOT NULL DEFAULT 'dark' CHECK (media_overlay IN ('none','dark','light')),
  text_colour TEXT NOT NULL DEFAULT '#f4f7fb',
  border_colour TEXT NOT NULL DEFAULT '#394657',
  font_family TEXT NOT NULL DEFAULT 'system' CHECK (font_family IN ('system','display','mono','serif','rounded')),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,tile_id)
);

CREATE INDEX user_profile_tiles_grid_idx ON user_profile_tiles(user_id,grid_y,grid_x);
CREATE INDEX user_profile_tiles_position_idx ON user_profile_tiles(user_id,position);
