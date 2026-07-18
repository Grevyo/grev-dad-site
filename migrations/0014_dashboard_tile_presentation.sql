PRAGMA foreign_keys = ON;

ALTER TABLE dashboard_features
ADD COLUMN tile_presentation TEXT NOT NULL DEFAULT 'action'
CHECK (tile_presentation IN ('action','content'));

UPDATE dashboard_features
SET tile_presentation = 'content'
WHERE id IN ('feature-profile','feature-grev-news');
