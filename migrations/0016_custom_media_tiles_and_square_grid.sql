PRAGMA foreign_keys = ON;

ALTER TABLE user_dashboard_tiles
ADD COLUMN content_mode TEXT NOT NULL DEFAULT 'standard'
CHECK (content_mode IN ('standard','media-button'));

ALTER TABLE user_dashboard_tiles
ADD COLUMN custom_title TEXT;

ALTER TABLE user_dashboard_tiles
ADD COLUMN custom_icon TEXT;

ALTER TABLE user_dashboard_tiles
ADD COLUMN media_fit TEXT NOT NULL DEFAULT 'cover'
CHECK (media_fit IN ('cover','contain','stretch'));

ALTER TABLE user_dashboard_tiles
ADD COLUMN media_overlay TEXT NOT NULL DEFAULT 'dark'
CHECK (media_overlay IN ('none','dark','light'));
