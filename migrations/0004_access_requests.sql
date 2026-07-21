PRAGMA foreign_keys = ON;

CREATE TABLE access_areas (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL COLLATE NOCASE UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  access_type TEXT NOT NULL CHECK (access_type IN ('public','private')),
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE access_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_area_id TEXT NOT NULL REFERENCES access_areas(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','denied')),
  requested_at INTEGER NOT NULL,
  decided_at INTEGER,
  decided_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(user_id,access_area_id)
);
CREATE INDEX access_requests_pending_idx ON access_requests(status,requested_at);
CREATE INDEX access_requests_user_idx ON access_requests(user_id);

INSERT OR IGNORE INTO groups(id,name,description,is_system,created_at,updated_at) VALUES
('group-community','Community','Shared areas available to any registered member.',1,unixepoch(),unixepoch()),
('group-private','Private spaces','Restricted areas for approved members.',1,unixepoch(),unixepoch());

INSERT OR IGNORE INTO access_areas(id,slug,name,description,access_type,group_id,is_active,sort_order,created_at,updated_at) VALUES
('access-community','community','Community access','Shared community areas available to any registered member. Access is granted immediately when requested.','public','group-community',1,10,unixepoch(),unixepoch()),
('access-private','private','Private access','Restricted personal, family and trusted-friend areas. An administrator reviews this request.','private','group-private',1,20,unixepoch(),unixepoch());

INSERT OR IGNORE INTO roles(id,name,description,is_system,created_at,updated_at)
VALUES('role-admin','Administrator','Can review and decide private access requests.',1,unixepoch(),unixepoch());

INSERT OR IGNORE INTO permissions(permission_key,description)
VALUES('access_requests.manage','Review and decide private access requests.');

INSERT OR IGNORE INTO role_permissions(role_id,permission_key)
VALUES('role-admin','access_requests.manage');
