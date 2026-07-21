PRAGMA foreign_keys = ON;

-- Rebuild the authentication tables against the final users table. This repairs
-- any stale foreign-key metadata left behind by the earlier users-table rebuild.
CREATE TABLE user_credentials_repaired (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_algorithm TEXT NOT NULL CHECK (password_algorithm='PBKDF2-SHA256'),
  password_iterations INTEGER NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_updated_at INTEGER NOT NULL
);
INSERT INTO user_credentials_repaired
SELECT user_id,password_algorithm,password_iterations,password_salt,password_hash,password_updated_at
FROM user_credentials;
DROP TABLE user_credentials;
ALTER TABLE user_credentials_repaired RENAME TO user_credentials;

CREATE TABLE sessions_repaired (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  remember_me INTEGER NOT NULL DEFAULT 0 CHECK (remember_me IN (0,1)),
  user_agent TEXT
);
INSERT INTO sessions_repaired
SELECT id,user_id,token_hash,created_at,last_seen_at,expires_at,revoked_at,remember_me,user_agent
FROM sessions;
DROP TABLE sessions;
ALTER TABLE sessions_repaired RENAME TO sessions;
CREATE INDEX sessions_active_idx ON sessions(token_hash,expires_at) WHERE revoked_at IS NULL;
CREATE INDEX sessions_user_idx ON sessions(user_id);