PRAGMA foreign_keys = ON;

-- The original grid table checks grid_x against the old six-column boundary.
-- Rebuild it so saved tiles may occupy columns seven and eight while preserving
-- every existing position, size, colour and appearance value.
CREATE TABLE user_dashboard_tiles_eight_columns (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_id TEXT NOT NULL REFERENCES dashboard_features(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  size TEXT NOT NULL CHECK (size IN ('small','medium','wide','large')),
  pinned_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  grid_x INTEGER NOT NULL DEFAULT 0 CHECK (grid_x BETWEEN 0 AND 7),
  grid_y INTEGER NOT NULL DEFAULT 0 CHECK (grid_y BETWEEN 0 AND 199),
  tile_width INTEGER NOT NULL DEFAULT 2 CHECK (tile_width BETWEEN 1 AND 6),
  tile_height INTEGER NOT NULL DEFAULT 1 CHECK (tile_height BETWEEN 1 AND 4),
  tile_colour TEXT NOT NULL DEFAULT 'default'
    CHECK (tile_colour IN ('default','graphite','blue','cyan','green','amber','red','purple','pink')),
  background_type TEXT NOT NULL DEFAULT 'solid'
    CHECK (background_type IN ('solid','gradient','media')),
  background_primary TEXT NOT NULL DEFAULT '#171c23',
  background_secondary TEXT NOT NULL DEFAULT '#5268aa',
  background_angle INTEGER NOT NULL DEFAULT 135 CHECK (background_angle BETWEEN 0 AND 360),
  background_media TEXT,
  text_colour TEXT NOT NULL DEFAULT '#f4f7fb',
  font_family TEXT NOT NULL DEFAULT 'system'
    CHECK (font_family IN ('system','display','mono','serif','rounded')),
  border_colour TEXT NOT NULL DEFAULT '#526074',
  content_mode TEXT NOT NULL DEFAULT 'standard'
    CHECK (content_mode IN ('standard','media-button')),
  custom_title TEXT,
  custom_icon TEXT,
  media_fit TEXT NOT NULL DEFAULT 'cover'
    CHECK (media_fit IN ('cover','contain','stretch')),
  media_overlay TEXT NOT NULL DEFAULT 'dark'
    CHECK (media_overlay IN ('none','dark','light')),
  PRIMARY KEY(user_id,feature_id)
);

INSERT INTO user_dashboard_tiles_eight_columns(
  user_id,feature_id,position,size,pinned_at,updated_at,
  grid_x,grid_y,tile_width,tile_height,tile_colour,
  background_type,background_primary,background_secondary,background_angle,
  background_media,text_colour,font_family,border_colour,
  content_mode,custom_title,custom_icon,media_fit,media_overlay
)
SELECT
  user_id,feature_id,position,size,pinned_at,updated_at,
  grid_x,grid_y,tile_width,tile_height,tile_colour,
  background_type,background_primary,background_secondary,background_angle,
  background_media,text_colour,font_family,border_colour,
  'standard',NULL,NULL,'cover','dark'
FROM user_dashboard_tiles;

DROP TABLE user_dashboard_tiles;
ALTER TABLE user_dashboard_tiles_eight_columns RENAME TO user_dashboard_tiles;

CREATE INDEX user_dashboard_tiles_position_idx ON user_dashboard_tiles(user_id,position);
CREATE INDEX user_dashboard_tiles_grid_idx ON user_dashboard_tiles(user_id,grid_y,grid_x);
