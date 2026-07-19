ALTER TABLE user_dashboard_tiles ADD COLUMN icon_mode TEXT NOT NULL DEFAULT 'text';
ALTER TABLE user_dashboard_tiles ADD COLUMN icon_label TEXT;
ALTER TABLE user_dashboard_tiles ADD COLUMN icon_media TEXT;
ALTER TABLE user_dashboard_tiles ADD COLUMN icon_text_colour TEXT NOT NULL DEFAULT '#090b0f';
ALTER TABLE user_dashboard_tiles ADD COLUMN icon_background_colour TEXT NOT NULL DEFAULT '#394657';
ALTER TABLE user_dashboard_tiles ADD COLUMN icon_border_colour TEXT NOT NULL DEFAULT '#667181';
ALTER TABLE user_dashboard_tiles ADD COLUMN icon_media_fit TEXT NOT NULL DEFAULT 'cover';
