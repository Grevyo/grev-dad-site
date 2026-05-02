-- Safe compatibility migration for old D1 databases that still require users.email
PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO users_new (id, username, password_hash, role, is_admin, created_at)
SELECT id, username, password_hash, COALESCE(role, 'user'), COALESCE(is_admin, 0), COALESCE(created_at, datetime('now'))
FROM users
WHERE username IS NOT NULL AND password_hash IS NOT NULL;

DROP TABLE IF EXISTS users;
ALTER TABLE users_new RENAME TO users;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);

PRAGMA foreign_keys=ON;
