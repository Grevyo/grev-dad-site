PRAGMA foreign_keys = ON;

ALTER TABLE dashboard_features ADD COLUMN default_width INTEGER NOT NULL DEFAULT 2 CHECK (default_width BETWEEN 1 AND 6);
ALTER TABLE dashboard_features ADD COLUMN default_height INTEGER NOT NULL DEFAULT 1 CHECK (default_height BETWEEN 1 AND 4);
ALTER TABLE dashboard_features ADD COLUMN allowed_dimensions TEXT NOT NULL DEFAULT '1x1,1x2,2x1,2x2,3x1,3x2,4x1,4x2,6x1,6x2,6x3';

UPDATE dashboard_features
SET default_width = CASE default_size
      WHEN 'small' THEN 1
      WHEN 'medium' THEN 2
      WHEN 'wide' THEN 4
      WHEN 'large' THEN 3
      ELSE 2
    END,
    default_height = CASE default_size
      WHEN 'small' THEN 1
      WHEN 'medium' THEN 1
      WHEN 'wide' THEN 2
      WHEN 'large' THEN 2
      ELSE 1
    END;

UPDATE dashboard_features SET allowed_dimensions='1x1,1x2,2x1,2x2,3x1' WHERE id IN ('feature-profile','feature-settings');
UPDATE dashboard_features SET allowed_dimensions='2x1,2x2,3x1,3x2,4x1,4x2,6x1,6x2,6x3' WHERE id IN ('feature-grev-news','feature-cs2','feature-coding','feature-nhs','feature-meet-grev');
UPDATE dashboard_features SET allowed_dimensions='1x1,1x2,2x1,2x2,3x1,3x2,4x1,4x2' WHERE id IN ('feature-gaming','feature-family','feature-friends','feature-coworkers','feature-admin');

ALTER TABLE user_dashboard_preferences ADD COLUMN tile_gap INTEGER NOT NULL DEFAULT 12 CHECK (tile_gap BETWEEN 0 AND 48);
ALTER TABLE user_dashboard_preferences ADD COLUMN outer_margin INTEGER NOT NULL DEFAULT 0 CHECK (outer_margin BETWEEN 0 AND 64);

ALTER TABLE user_dashboard_tiles ADD COLUMN grid_x INTEGER NOT NULL DEFAULT 0 CHECK (grid_x BETWEEN 0 AND 5);
ALTER TABLE user_dashboard_tiles ADD COLUMN grid_y INTEGER NOT NULL DEFAULT 0 CHECK (grid_y BETWEEN 0 AND 199);
ALTER TABLE user_dashboard_tiles ADD COLUMN tile_width INTEGER NOT NULL DEFAULT 2 CHECK (tile_width BETWEEN 1 AND 6);
ALTER TABLE user_dashboard_tiles ADD COLUMN tile_height INTEGER NOT NULL DEFAULT 1 CHECK (tile_height BETWEEN 1 AND 4);

UPDATE user_dashboard_tiles
SET grid_x = 0,
    grid_y = position * 3,
    tile_width = CASE size
      WHEN 'small' THEN 1
      WHEN 'medium' THEN 2
      WHEN 'wide' THEN 4
      WHEN 'large' THEN 3
      ELSE 2
    END,
    tile_height = CASE size
      WHEN 'small' THEN 1
      WHEN 'medium' THEN 1
      WHEN 'wide' THEN 2
      WHEN 'large' THEN 2
      ELSE 1
    END;

CREATE INDEX user_dashboard_tiles_grid_idx ON user_dashboard_tiles(user_id,grid_y,grid_x);
