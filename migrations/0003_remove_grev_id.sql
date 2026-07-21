PRAGMA foreign_keys = OFF;

CREATE TABLE users_without_grev_id (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  email TEXT COLLATE NOCASE UNIQUE,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','disabled')),
  is_verified INTEGER NOT NULL DEFAULT 0 CHECK (is_verified IN (0,1)),
  is_owner INTEGER NOT NULL DEFAULT 0 CHECK (is_owner IN (0,1)),
  verified_at INTEGER,
  verified_by TEXT REFERENCES users_without_grev_id(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT INTO users_without_grev_id (
  id, username, email, display_name, status, is_verified, is_owner,
  verified_at, verified_by, created_at, updated_at
)
SELECT
  id, username, email, display_name, status, is_verified, is_owner,
  verified_at, verified_by, created_at, updated_at
FROM users;

DROP TABLE users;
ALTER TABLE users_without_grev_id RENAME TO users;
CREATE UNIQUE INDEX users_single_owner_idx ON users(is_owner) WHERE is_owner = 1;

PRAGMA foreign_keys = ON;
