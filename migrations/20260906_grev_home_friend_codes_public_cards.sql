-- A friend code belongs to the website account, never to a Grev Home device or GrevID.
CREATE TABLE grev_home_friend_codes (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  friend_code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at INTEGER NOT NULL
);

-- Controller-friendly profile-card choices shared by every linked Grev Home device.
CREATE TABLE grev_home_public_cards (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  card_json TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL
);
