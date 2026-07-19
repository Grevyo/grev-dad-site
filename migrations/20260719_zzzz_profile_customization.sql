PRAGMA foreign_keys = ON;

CREATE TABLE user_profile_design (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  page_background_type TEXT NOT NULL DEFAULT 'solid' CHECK (page_background_type IN ('solid','gradient','media')),
  page_background_primary TEXT NOT NULL DEFAULT '#090c11',
  page_background_secondary TEXT NOT NULL DEFAULT '#182131',
  page_background_angle INTEGER NOT NULL DEFAULT 135 CHECK (page_background_angle BETWEEN 0 AND 360),
  page_media_fit TEXT NOT NULL DEFAULT 'cover' CHECK (page_media_fit IN ('cover','contain','stretch')),
  page_media_overlay TEXT NOT NULL DEFAULT 'dark' CHECK (page_media_overlay IN ('none','dark','light')),
  page_text_colour TEXT NOT NULL DEFAULT '#f4f7fb',
  page_font_family TEXT NOT NULL DEFAULT 'system' CHECK (page_font_family IN ('system','display','mono','serif','rounded')),
  content_width TEXT NOT NULL DEFAULT 'wide' CHECK (content_width IN ('standard','wide','full')),
  section_gap INTEGER NOT NULL DEFAULT 32 CHECK (section_gap IN (16,24,32,40,48,64)),
  show_page_heading INTEGER NOT NULL DEFAULT 1 CHECK (show_page_heading IN (0,1)),
  show_grid_heading INTEGER NOT NULL DEFAULT 1 CHECK (show_grid_heading IN (0,1)),
  card_width TEXT NOT NULL DEFAULT 'full' CHECK (card_width IN ('compact','wide','full')),
  card_alignment TEXT NOT NULL DEFAULT 'centre' CHECK (card_alignment IN ('left','centre')),
  card_surface TEXT NOT NULL DEFAULT 'gradient' CHECK (card_surface IN ('gradient','solid','cover')),
  cover_height INTEGER NOT NULL DEFAULT 180 CHECK (cover_height IN (0,120,180,240,320)),
  avatar_size INTEGER NOT NULL DEFAULT 132 CHECK (avatar_size IN (72,96,120,144,168)),
  card_padding INTEGER NOT NULL DEFAULT 28 CHECK (card_padding IN (12,16,20,24,28,32,40,48)),
  card_shadow TEXT NOT NULL DEFAULT 'large' CHECK (card_shadow IN ('none','small','large')),
  card_border_width INTEGER NOT NULL DEFAULT 1 CHECK (card_border_width IN (0,1,2,4)),
  show_cover INTEGER NOT NULL DEFAULT 1 CHECK (show_cover IN (0,1)),
  show_avatar INTEGER NOT NULL DEFAULT 1 CHECK (show_avatar IN (0,1)),
  show_headline INTEGER NOT NULL DEFAULT 1 CHECK (show_headline IN (0,1)),
  show_bio INTEGER NOT NULL DEFAULT 1 CHECK (show_bio IN (0,1)),
  show_location INTEGER NOT NULL DEFAULT 1 CHECK (show_location IN (0,1)),
  show_website INTEGER NOT NULL DEFAULT 1 CHECK (show_website IN (0,1)),
  card_tile_gap INTEGER NOT NULL DEFAULT 10 CHECK (card_tile_gap IN (0,4,8,10,12,16,20,24)),
  card_tile_row_height INTEGER NOT NULL DEFAULT 92 CHECK (card_tile_row_height IN (72,92,112,132,160)),
  grid_surface TEXT NOT NULL DEFAULT 'transparent' CHECK (grid_surface IN ('transparent','outlined','panel')),
  updated_at INTEGER NOT NULL
);

CREATE TABLE user_profile_design_media (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_slot TEXT NOT NULL CHECK (media_slot='page_background'),
  media_data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,media_slot)
);
