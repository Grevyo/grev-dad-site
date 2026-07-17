PRAGMA foreign_keys = ON;

CREATE TABLE relationship_options (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL COLLATE NOCASE UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE relationship_group_grants (
  relationship_id TEXT NOT NULL REFERENCES relationship_options(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY(relationship_id, group_id)
);

CREATE TABLE user_relationships (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  relationship_id TEXT NOT NULL REFERENCES relationship_options(id) ON DELETE CASCADE,
  selected_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX user_relationships_relationship_idx ON user_relationships(relationship_id);

CREATE TABLE user_onboarding (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  relationship_completed_at INTEGER,
  intentions_completed_at INTEGER,
  updated_at INTEGER NOT NULL
);

UPDATE groups
SET name = 'Co-workers',
    description = 'Areas and resources intended for people who know Grev through work.',
    updated_at = unixepoch()
WHERE id = 'group-work';

INSERT OR IGNORE INTO groups(id,name,description,is_system,created_at,updated_at) VALUES
('group-who-is-grev','Who is Grev?','Introductory areas for members who do not know Grev personally yet.',1,unixepoch(),unixepoch()),
('group-gaming','Gaming','General gaming spaces, projects, sessions and community content.',1,unixepoch(),unixepoch()),
('group-coding','Coding','Software, development, infrastructure and technical project areas.',1,unixepoch(),unixepoch()),
('group-nhs','NHS','NHS-related professional areas and digital service content.',1,unixepoch(),unixepoch()),
('group-grev-news','Grev News','Personal updates, announcements and news from Grev.dad.',1,unixepoch(),unixepoch());

INSERT INTO relationship_options(id,slug,name,description,is_active,sort_order,created_at,updated_at) VALUES
('relationship-family','family','Family','I know Grev as family.',1,10,unixepoch(),unixepoch()),
('relationship-friends','friends','Friends','I know Grev as a friend.',1,20,unixepoch(),unixepoch()),
('relationship-co-workers','co-workers','Co-workers','I know Grev through work.',1,30,unixepoch(),unixepoch()),
('relationship-who-is-grev','who-is-grev','Who is Grev?','I do not know Grev personally and want to see what Grev.dad is about.',1,40,unixepoch(),unixepoch());

INSERT INTO relationship_group_grants(relationship_id,group_id) VALUES
('relationship-family','group-family'),
('relationship-friends','group-friends'),
('relationship-co-workers','group-work'),
('relationship-who-is-grev','group-who-is-grev');

UPDATE intention_options SET is_active = 0, updated_at = unixepoch();

UPDATE intention_options
SET slug = 'counter-strike-2',
    name = 'Counter-Strike 2',
    description = 'Teams, matches, coaching, demos, tactics and Counter-Strike tools.',
    is_active = 1,
    sort_order = 10,
    updated_at = unixepoch()
WHERE id = 'intent-cs2';

INSERT OR IGNORE INTO intention_options(id,slug,name,description,is_active,sort_order,created_at,updated_at) VALUES
('intent-gaming','gaming','Gaming','General gaming projects, sessions, communities and shared gaming content.',1,20,unixepoch(),unixepoch()),
('intent-coding','coding','Coding','Software development, homelab projects, infrastructure and technical work.',1,30,unixepoch(),unixepoch()),
('intent-nhs','nhs','NHS','NHS digital services, professional resources and relevant work content.',1,40,unixepoch(),unixepoch()),
('intent-grev-news','grev-news','Grev News','Personal updates, announcements and news published through Grev.dad.',1,50,unixepoch(),unixepoch());

UPDATE intention_options SET is_active=1,sort_order=20,updated_at=unixepoch() WHERE id='intent-gaming';
UPDATE intention_options SET is_active=1,sort_order=30,updated_at=unixepoch() WHERE id='intent-coding';
UPDATE intention_options SET is_active=1,sort_order=40,updated_at=unixepoch() WHERE id='intent-nhs';
UPDATE intention_options SET is_active=1,sort_order=50,updated_at=unixepoch() WHERE id='intent-grev-news';

DELETE FROM intention_group_grants
WHERE intention_id IN ('intent-cs2','intent-gaming','intent-coding','intent-nhs','intent-grev-news');

INSERT INTO intention_group_grants(intention_id,group_id) VALUES
('intent-cs2','group-cs2'),
('intent-gaming','group-gaming'),
('intent-coding','group-coding'),
('intent-nhs','group-nhs'),
('intent-grev-news','group-grev-news');
