import { getCasesDb } from '../lib/cases-db.js';

function getBlackjackDb(env) {
  return getCasesDb(env);
}

export async function ensureBlackjackTables(env) {
  const db = getBlackjackDb(env);
  if (!db) return null;
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS blackjack_rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_name TEXT NOT NULL,
      owner_user_id INTEGER NOT NULL,
      bet_pence INTEGER NOT NULL DEFAULT 100,
      status TEXT NOT NULL DEFAULT 'waiting',
      max_players INTEGER NOT NULL DEFAULT 4,
      room_state TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_blackjack_rooms_status ON blackjack_rooms (status, updated_at DESC)`).run();
  return db;
}

export { getBlackjackDb };
