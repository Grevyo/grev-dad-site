PRAGMA foreign_keys = ON;

-- Retired before the Grev Home history backbone is considered locked.
-- This filename can sort before the migration that creates grev_home_session_history on a fresh
-- database, so it must remain a no-op. Optional game/content identity is persisted by the later
-- progression_history_content migration instead. Databases that already applied the earlier ALTER
-- may retain the unused nullable columns safely.
