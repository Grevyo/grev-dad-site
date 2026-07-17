PRAGMA foreign_keys = ON;

CREATE TABLE dashboard_features (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL COLLATE NOCASE UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'General',
  feature_type TEXT NOT NULL DEFAULT 'workspace' CHECK (feature_type IN ('workspace','link','system')),
  route TEXT NOT NULL DEFAULT '',
  icon_text TEXT NOT NULL DEFAULT 'GD',
  audience TEXT NOT NULL DEFAULT 'groups' CHECK (audience IN ('all','groups','admin','owner')),
  default_size TEXT NOT NULL DEFAULT 'medium' CHECK (default_size IN ('small','medium','wide','large')),
  allowed_sizes TEXT NOT NULL DEFAULT 'small,medium,wide,large',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX dashboard_features_active_sort_idx ON dashboard_features(is_active,sort_order,name);

CREATE TABLE dashboard_feature_group_grants (
  feature_id TEXT NOT NULL REFERENCES dashboard_features(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY(feature_id,group_id)
);
CREATE INDEX dashboard_feature_group_grants_group_idx ON dashboard_feature_group_grants(group_id,feature_id);

CREATE TABLE user_dashboard_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  density TEXT NOT NULL DEFAULT 'comfortable' CHECK (density IN ('comfortable','compact')),
  show_descriptions INTEGER NOT NULL DEFAULT 1 CHECK (show_descriptions IN (0,1)),
  initialized_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE user_dashboard_tiles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_id TEXT NOT NULL REFERENCES dashboard_features(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  size TEXT NOT NULL CHECK (size IN ('small','medium','wide','large')),
  pinned_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,feature_id)
);
CREATE INDEX user_dashboard_tiles_position_idx ON user_dashboard_tiles(user_id,position);

INSERT OR IGNORE INTO permissions(permission_key,description) VALUES
('dashboard.customize_own','Customize the signed-in member dashboard.'),
('dashboard.features.manage','Create and manage dashboard features and access grants.');

INSERT OR IGNORE INTO role_permissions(role_id,permission_key)
VALUES('role-member','dashboard.customize_own');
INSERT OR IGNORE INTO role_permissions(role_id,permission_key)
VALUES('role-admin','dashboard.features.manage');

INSERT OR IGNORE INTO dashboard_features(
  id,slug,name,description,category,feature_type,route,icon_text,audience,
  default_size,allowed_sizes,is_active,is_default,sort_order,created_at,updated_at
) VALUES
('feature-profile','profile','My profile','Open your permanent Grev.dad profile and member identity.','Account','link','/profile','ME','all','medium','small,medium,wide',1,1,10,unixepoch(),unixepoch()),
('feature-settings','profile-settings','Profile settings','Change how you know Grev and the interests attached to your account.','Account','link','/settings','ST','all','medium','small,medium,wide',1,1,20,unixepoch(),unixepoch()),
('feature-grev-news','grev-news','Grev News','Personal updates, announcements and news published through Grev.dad.','News','workspace','/feature/grev-news','GN','groups','wide','medium,wide,large',1,1,30,unixepoch(),unixepoch()),
('feature-cs2','counter-strike-2','Counter-Strike 2','Teams, matches, coaching, demos, tactics and Counter-Strike tools.','Gaming','workspace','/feature/counter-strike-2','CS','groups','wide','medium,wide,large',1,0,40,unixepoch(),unixepoch()),
('feature-gaming','gaming','Gaming','General gaming projects, sessions, communities and shared content.','Gaming','workspace','/feature/gaming','GG','groups','medium','small,medium,wide,large',1,0,50,unixepoch(),unixepoch()),
('feature-coding','coding','Coding Lab','Software development, homelab projects, infrastructure and technical work.','Projects','workspace','/feature/coding','CD','groups','wide','medium,wide,large',1,0,60,unixepoch(),unixepoch()),
('feature-nhs','nhs','NHS Space','NHS digital services, professional resources and relevant work content.','Work','workspace','/feature/nhs','NH','groups','wide','medium,wide,large',1,0,70,unixepoch(),unixepoch()),
('feature-family','family-space','Family Space','A private-by-policy starting point for family-related areas and updates.','People','workspace','/feature/family-space','FA','groups','medium','small,medium,wide',1,0,80,unixepoch(),unixepoch()),
('feature-friends','friends-space','Friends Space','Shared plans, projects, events and areas for friends.','People','workspace','/feature/friends-space','FR','groups','medium','small,medium,wide',1,0,90,unixepoch(),unixepoch()),
('feature-coworkers','co-workers-space','Co-workers Space','Work-related resources and shared areas for people who know Grev through work.','People','workspace','/feature/co-workers-space','CW','groups','medium','small,medium,wide',1,0,100,unixepoch(),unixepoch()),
('feature-meet-grev','meet-grev','Who is Grev?','An introduction to Grev.dad, current projects and public member-facing areas.','Start here','workspace','/feature/meet-grev','HI','groups','wide','medium,wide,large',1,1,110,unixepoch(),unixepoch()),
('feature-admin','admin-centre','Admin centre','Manage users, hidden groups, verification, administrators and dashboard features.','Administration','link','/admin','AD','admin','medium','medium,wide',1,1,120,unixepoch(),unixepoch());

INSERT OR IGNORE INTO dashboard_feature_group_grants(feature_id,group_id) VALUES
('feature-grev-news','group-grev-news'),
('feature-cs2','group-cs2'),
('feature-gaming','group-gaming'),
('feature-coding','group-coding'),
('feature-nhs','group-nhs'),
('feature-family','group-family'),
('feature-friends','group-friends'),
('feature-coworkers','group-work'),
('feature-meet-grev','group-who-is-grev');
