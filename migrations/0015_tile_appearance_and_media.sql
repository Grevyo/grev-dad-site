PRAGMA foreign_keys = ON;

ALTER TABLE user_dashboard_tiles
ADD COLUMN background_type TEXT NOT NULL DEFAULT 'solid'
CHECK (background_type IN ('solid','gradient','media'));

ALTER TABLE user_dashboard_tiles
ADD COLUMN background_primary TEXT NOT NULL DEFAULT '#171c23';

ALTER TABLE user_dashboard_tiles
ADD COLUMN background_secondary TEXT NOT NULL DEFAULT '#5268aa';

ALTER TABLE user_dashboard_tiles
ADD COLUMN background_angle INTEGER NOT NULL DEFAULT 135
CHECK (background_angle BETWEEN 0 AND 360);

ALTER TABLE user_dashboard_tiles
ADD COLUMN background_media TEXT;

ALTER TABLE user_dashboard_tiles
ADD COLUMN text_colour TEXT NOT NULL DEFAULT '#f4f7fb';

ALTER TABLE user_dashboard_tiles
ADD COLUMN font_family TEXT NOT NULL DEFAULT 'system'
CHECK (font_family IN ('system','display','mono','serif','rounded'));

ALTER TABLE user_dashboard_tiles
ADD COLUMN border_colour TEXT NOT NULL DEFAULT '#526074';

-- Preserve each user's existing named solid colour as the closest matching custom colour.
UPDATE user_dashboard_tiles
SET background_primary = CASE tile_colour
  WHEN 'graphite' THEN '#171b22'
  WHEN 'blue' THEN '#101a2a'
  WHEN 'cyan' THEN '#0e2023'
  WHEN 'green' THEN '#112319'
  WHEN 'amber' THEN '#2a2010'
  WHEN 'red' THEN '#291417'
  WHEN 'purple' THEN '#21172f'
  WHEN 'pink' THEN '#2b1624'
  ELSE '#11161d'
END,
border_colour = CASE tile_colour
  WHEN 'graphite' THEN '#3e4856'
  WHEN 'blue' THEN '#365987'
  WHEN 'cyan' THEN '#2f6c73'
  WHEN 'green' THEN '#376c4b'
  WHEN 'amber' THEN '#7b5b26'
  WHEN 'red' THEN '#793842'
  WHEN 'purple' THEN '#60457f'
  WHEN 'pink' THEN '#7c3b65'
  ELSE '#394657'
END;
