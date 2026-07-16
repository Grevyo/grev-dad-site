PRAGMA foreign_keys = ON;

-- Private groups are assigned only by administrators. They are intentionally
-- separate from the member-facing intention groups and are never requestable.
CREATE TABLE private_group_categories (
  group_id TEXT PRIMARY KEY REFERENCES groups(id) ON DELETE CASCADE,
  category_key TEXT NOT NULL COLLATE NOCASE UNIQUE
    CHECK (category_key IN ('family','friends','co-workers','other')),
  display_name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO groups(id,name,description,is_system,created_at,updated_at) VALUES
('group-private-family','Private Family','Hidden private access group for family members.',1,unixepoch(),unixepoch()),
('group-private-friends','Private Friends','Hidden private access group for friends.',1,unixepoch(),unixepoch()),
('group-private-co-workers','Private Co-workers','Hidden private access group for co-workers.',1,unixepoch(),unixepoch()),
('group-private-other','Private Other','Hidden private access group for trusted people who do not fit another broad category.',1,unixepoch(),unixepoch());

INSERT INTO private_group_categories(group_id,category_key,display_name,sort_order) VALUES
('group-private-family','family','Family',10),
('group-private-friends','friends','Friends',20),
('group-private-co-workers','co-workers','Co-workers',30),
('group-private-other','other','Other',40);

-- Preserve any assignments made through the earlier single generic private
-- group by moving them to Other before retiring that group.
INSERT OR IGNORE INTO group_memberships(group_id,user_id,assigned_by,assigned_at)
SELECT 'group-private-other',user_id,assigned_by,assigned_at
FROM group_memberships
WHERE group_id='group-private';

INSERT OR IGNORE INTO policy_assignments(policy_id,subject_type,subject_id,assigned_by,assigned_at)
SELECT policy_id,'group','group-private-other',assigned_by,assigned_at
FROM policy_assignments
WHERE subject_type='group' AND subject_id='group-private';

DELETE FROM policy_assignments
WHERE subject_type='group' AND subject_id='group-private';
DELETE FROM access_requests WHERE access_area_id='access-private';
DELETE FROM access_areas WHERE id='access-private';
DELETE FROM group_memberships WHERE group_id='group-private';
DELETE FROM groups WHERE id='group-private';