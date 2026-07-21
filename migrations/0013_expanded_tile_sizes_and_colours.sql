PRAGMA foreign_keys = ON;

ALTER TABLE user_dashboard_tiles
ADD COLUMN tile_colour TEXT NOT NULL DEFAULT 'default'
CHECK (tile_colour IN ('default','graphite','blue','cyan','green','amber','red','purple','pink'));

UPDATE dashboard_features
SET allowed_dimensions = '1x1,1x2,1x3,1x4,2x1,2x2,2x3,2x4,3x1,3x2,3x3,3x4,4x1,4x2,4x3,4x4,5x1,5x2,5x3,5x4,6x1,6x2,6x3,6x4'
WHERE id IN (
  'feature-profile',
  'feature-settings',
  'feature-grev-news',
  'feature-cs2',
  'feature-gaming',
  'feature-coding',
  'feature-nhs',
  'feature-family',
  'feature-friends',
  'feature-coworkers',
  'feature-meet-grev',
  'feature-admin'
);
