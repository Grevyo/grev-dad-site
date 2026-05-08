CREATE TABLE IF NOT EXISTS user_private_secrets (
  user_id INTEGER NOT NULL,
  secret_key TEXT NOT NULL,
  secret_value_encrypted TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, secret_key)
);
