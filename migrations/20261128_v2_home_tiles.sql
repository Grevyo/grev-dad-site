-- grev.dad v2: the Home page's tile grid. Same tile format as user_profile_tiles (one tile engine
-- for Home and Profile), with Home-only widget kinds allowed in `widget`.
PRAGMA foreign_keys = ON;

CREATE TABLE user_home_tiles (
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
  widget TEXT,
  widget_config TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,tile_id)
);
CREATE INDEX user_home_tiles_order_idx ON user_home_tiles(user_id,grid_y,grid_x);

-- Marks a Home that has been set up, so an emptied Home isn't refilled with the starter tiles.
CREATE TABLE user_home_state (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  initialized_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
