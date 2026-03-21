import { STARTING_BALANCE_PENCE } from "./constants.js";

async function ensureColumn(db, tableName, columnName, columnDefinition) {
  const result = await db.prepare(`PRAGMA table_info(${tableName})`).all();
  const cols = result.results || [];
  const exists = cols.some((col) => String(col.name).toLowerCase() === String(columnName).toLowerCase());

  if (!exists) {
    await db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`).run();
  }
}

/**
 * Extends CASES_DB with CS2 marketplace / trading tables and columns.
 */
export async function ensureCs2Extensions(db) {
  await ensureColumn(db, "case_definitions", "steam_market_hash_name", "TEXT");
  await ensureColumn(db, "case_definitions", "fallback_price_pence", "INTEGER NOT NULL DEFAULT 0");

  await ensureColumn(db, "case_items", "item_kind", "TEXT NOT NULL DEFAULT 'skin'");
  await ensureColumn(db, "case_items", "case_def_id", "INTEGER");
  await ensureColumn(db, "case_items", "market_hash_name", "TEXT");

  await ensureColumn(db, "case_profiles", "balance", `INTEGER NOT NULL DEFAULT ${STARTING_BALANCE_PENCE}`);

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS market_price_cache (
      market_hash_name TEXT PRIMARY KEY,
      price_pence INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS trade_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      buyer_user_id INTEGER,
      seller_user_id INTEGER,
      item_id INTEGER,
      item_name TEXT NOT NULL,
      price_pence INTEGER NOT NULL,
      trade_type TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS market_listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_user_id INTEGER NOT NULL,
      inventory_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      asking_price_pence INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    )
  `).run();

  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_trade_history_created_at ON trade_history (created_at DESC)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_market_listings_status ON market_listings (status)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_market_listings_seller ON market_listings (seller_user_id)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_case_items_case_def ON case_items (case_def_id)`).run();
}
