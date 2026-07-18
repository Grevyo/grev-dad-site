PRAGMA foreign_keys = ON;

ALTER TABLE dashboard_features
ADD COLUMN tile_presentation TEXT NOT NULL DEFAULT 'action'
CHECK (tile_presentation IN ('action','content'));

UPDATE dashboard_features
SET tile_presentation = 'content'
WHERE id IN ('feature-profile','feature-grev-news');

-- Compact navigation features become true 1x1 dashboard buttons for new/default layouts.
-- Existing user_dashboard_tiles rows keep their current per-user dimensions.
UPDATE dashboard_features
SET default_size = 'small',
    allowed_sizes = 'small',
    default_width = 1,
    default_height = 1
WHERE id IN (
  'feature-settings',
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

UPDATE dashboard_features
SET default_size = 'large',
    allowed_sizes = 'large',
    default_width = 2,
    default_height = 2
WHERE id = 'feature-profile';

UPDATE dashboard_features
SET default_size = 'large',
    allowed_sizes = 'large',
    default_width = 3,
    default_height = 2
WHERE id = 'feature-grev-news';
