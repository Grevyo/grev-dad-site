PRAGMA foreign_keys = ON;

-- The previous request catalogue is no longer user-facing. Private groups remain
-- available for direct administrator assignment in the background.
UPDATE access_areas SET is_active = 0;
DELETE FROM access_requests WHERE status = 'pending';

CREATE TABLE intention_options (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL COLLATE NOCASE UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE intention_group_grants (
  intention_id TEXT NOT NULL REFERENCES intention_options(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY(intention_id, group_id)
);

CREATE TABLE user_intentions (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  intention_id TEXT NOT NULL REFERENCES intention_options(id) ON DELETE CASCADE,
  selected_at INTEGER NOT NULL,
  PRIMARY KEY(user_id, intention_id)
);
CREATE INDEX user_intentions_user_idx ON user_intentions(user_id);

INSERT OR IGNORE INTO groups(id,name,description,is_system,created_at,updated_at) VALUES
('group-family','Family','Family-focused areas and shared family content.',1,unixepoch(),unixepoch()),
('group-friends','Friends','Social and community areas intended for friends.',1,unixepoch(),unixepoch()),
('group-work','Work','Work-related areas, projects and resources.',1,unixepoch(),unixepoch()),
('group-cs2','Counter-Strike 2','Counter-Strike 2 teams, matches, coaching and tools.',1,unixepoch(),unixepoch()),
('group-cpl-manager','CPL Manager','CPL Manager projects, competitions and management tools.',1,unixepoch(),unixepoch());

INSERT INTO intention_options(id,slug,name,description,is_active,sort_order,created_at,updated_at) VALUES
('intent-family','family','Family','I am here for family spaces, shared plans and family content.',1,10,unixepoch(),unixepoch()),
('intent-friend','friend','Friend','I am here as a friend and want access to social and community areas.',1,20,unixepoch(),unixepoch()),
('intent-work','work','Work','I will use Grev.dad for work, projects or professional resources.',1,30,unixepoch(),unixepoch()),
('intent-cs2','counter-strike-2','Counter-Strike 2','I am here for Counter-Strike 2 teams, coaching, demos or match tools.',1,40,unixepoch(),unixepoch()),
('intent-cpl-manager','cpl-manager','CPL Manager','I am here for CPL Manager projects, competitions or management tools.',1,50,unixepoch(),unixepoch());

INSERT INTO intention_group_grants(intention_id,group_id) VALUES
('intent-family','group-family'),
('intent-friend','group-friends'),
('intent-work','group-work'),
('intent-cs2','group-cs2'),
('intent-cpl-manager','group-cpl-manager');