ALTER TABLE user_profiles ADD COLUMN dashboard_background_colour TEXT DEFAULT '';
ALTER TABLE user_profiles ADD COLUMN dashboard_background_url TEXT DEFAULT '';
ALTER TABLE user_profiles ADD COLUMN dashboard_background_size TEXT DEFAULT 'cover';
ALTER TABLE user_profiles ADD COLUMN dashboard_background_overlay_strength INTEGER DEFAULT 0;
