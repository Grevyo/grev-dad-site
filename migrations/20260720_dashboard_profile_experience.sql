PRAGMA foreign_keys = ON;

CREATE TABLE dashboard_pages (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  layout_json TEXT NOT NULL DEFAULT '{"tiles":[],"preferences":{}}',
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK ((owner_user_id IS NOT NULL AND group_id IS NULL) OR (owner_user_id IS NULL AND group_id IS NOT NULL))
);
CREATE UNIQUE INDEX dashboard_pages_owner_slug ON dashboard_pages(owner_user_id,slug) WHERE owner_user_id IS NOT NULL;
CREATE UNIQUE INDEX dashboard_pages_group_slug ON dashboard_pages(group_id,slug) WHERE group_id IS NOT NULL;
CREATE INDEX dashboard_pages_owner_updated ON dashboard_pages(owner_user_id,updated_at DESC);
CREATE INDEX dashboard_pages_group_updated ON dashboard_pages(group_id,updated_at DESC);

CREATE TABLE user_dashboard_page_state (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  active_page_id TEXT REFERENCES dashboard_pages(id) ON DELETE SET NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE user_profile_field_privacy (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL CHECK (field_key IN ('headline','bio','location','website','avatar','cover','username','status','memberSince')),
  visibility TEXT NOT NULL DEFAULT 'all' CHECK (visibility IN ('all','verified','groups','private')),
  group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,field_key)
);

CREATE TABLE user_profile_tile_privacy (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tile_id TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'all' CHECK (visibility IN ('all','verified','groups','private')),
  group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,tile_id)
);

CREATE TABLE user_profile_interaction_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  guestbook_enabled INTEGER NOT NULL DEFAULT 1 CHECK (guestbook_enabled IN (0,1)),
  reactions_enabled INTEGER NOT NULL DEFAULT 1 CHECK (reactions_enabled IN (0,1)),
  updated_at INTEGER NOT NULL
);

CREATE TABLE profile_guestbook_entries (
  id TEXT PRIMARY KEY,
  profile_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX profile_guestbook_profile_created ON profile_guestbook_entries(profile_user_id,created_at DESC);
CREATE INDEX profile_guestbook_author_created ON profile_guestbook_entries(author_user_id,created_at DESC);

CREATE TABLE profile_reactions (
  profile_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL CHECK (reaction IN ('wave','heart','fire','clap')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY(profile_user_id,author_user_id)
);
CREATE INDEX profile_reactions_profile ON profile_reactions(profile_user_id,reaction);

INSERT OR IGNORE INTO dashboard_features(
  id,slug,name,description,category,feature_type,tile_presentation,route,icon_text,audience,
  default_size,allowed_sizes,default_width,default_height,allowed_dimensions,
  is_active,is_default,sort_order,created_at,updated_at
) VALUES
('feature-live-clock','live-clock','Clock','A live local clock and current date.','Live','system','content','','CLK','all','medium','medium,large',2,1,'2x1,2x2,3x1',1,0,300,unixepoch(),unixepoch()),
('feature-live-activity','live-activity','Recent activity','Recent Grev.dad account, dashboard and profile activity.','Live','system','content','','NEW','all','large','large,wide',3,2,'3x2,4x2,4x3,5x2',1,0,310,unixepoch(),unixepoch()),
('feature-quick-profile','quick-profile','Edit profile','Jump directly to your personal homepage editor.','Quick actions','link','action','/profile','ME','all','medium','small,medium,large',2,1,'1x1,2x1,2x2',1,0,320,unixepoch(),unixepoch()),
('feature-quick-page','quick-page','New dashboard page','Create another personal dashboard page.','Quick actions','system','action','#new-dashboard-page','PG','all','medium','small,medium,large',2,1,'1x1,2x1,2x2',1,0,330,unixepoch(),unixepoch()),
('feature-quick-guestbook','quick-guestbook','Profile guestbook','Open your profile guestbook and recent messages.','Quick actions','link','action','/profile#guestbook','HI','all','medium','small,medium,large',2,1,'1x1,2x1,2x2',1,0,340,unixepoch(),unixepoch()),
('feature-quick-theme','quick-theme','Profile themes','Open the profile editor theme starters.','Quick actions','link','action','/profile#themes','FX','all','medium','small,medium,large',2,1,'1x1,2x1,2x2',1,0,350,unixepoch(),unixepoch());
