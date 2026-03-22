import { DEFAULT_QUICK_SELL_FEE_PERCENT, STARTING_BALANCE_PENCE } from "./constants.js";

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
  await ensureColumn(db, "case_items", "wear_code", "TEXT");

  await ensureColumn(db, "case_profiles", "balance", `INTEGER NOT NULL DEFAULT ${STARTING_BALANCE_PENCE}`);
  await ensureColumn(db, "case_profiles", "key_balance", "INTEGER NOT NULL DEFAULT 0");

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS market_price_cache (
      market_hash_name TEXT PRIMARY KEY,
      price_pence INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS market_price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      market_hash_name TEXT NOT NULL,
      price_pence INTEGER NOT NULL,
      bucket_started_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (market_hash_name, bucket_started_at)
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

  await ensureColumn(db, "market_listings", "list_mode", "TEXT NOT NULL DEFAULT 'fixed'");
  await ensureColumn(db, "market_listings", "auction_end_at", "TEXT");
  await ensureColumn(db, "market_listings", "auction_start_bid_pence", "INTEGER");
  await ensureColumn(db, "market_listings", "current_bid_pence", "INTEGER");
  await ensureColumn(db, "market_listings", "current_high_bidder_id", "INTEGER");

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS pending_drops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      case_id INTEGER NOT NULL,
      resolved_item_id INTEGER NOT NULL,
      key_paid INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS skin_instances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resolved_item_id INTEGER NOT NULL,
      market_hash_name TEXT NOT NULL,
      original_owner_user_id INTEGER NOT NULL,
      current_owner_user_id INTEGER,
      source_case_id INTEGER,
      source_pending_drop_id INTEGER,
      source_inventory_id INTEGER,
      graveyard_ref TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();

  await ensureColumn(db, "inventory", "skin_instance_id", "INTEGER");
  await ensureColumn(db, "pending_drops", "skin_instance_id", "INTEGER");
  await ensureColumn(db, "pending_drops", "quick_sell_payout_pence", "INTEGER");
  await ensureColumn(db, "pending_drops", "market_reference_pence", "INTEGER");

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS quick_sell_graveyard (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skin_instance_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      resolved_item_id INTEGER NOT NULL,
      source_type TEXT NOT NULL,
      source_pending_drop_id INTEGER,
      source_inventory_id INTEGER,
      payout_pence INTEGER NOT NULL,
      market_reference_pence INTEGER NOT NULL,
      fee_percent INTEGER NOT NULL,
      refunded_at TEXT,
      refunded_by_user_id INTEGER,
      created_at TEXT NOT NULL
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS auction_bids (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id INTEGER NOT NULL,
      bidder_user_id INTEGER NOT NULL,
      amount_pence INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS market_offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id INTEGER NOT NULL,
      buyer_user_id INTEGER NOT NULL,
      offer_pence INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    )
  `).run();

  await ensureColumn(db, "market_offers", "buyer_comment", "TEXT");
  await ensureColumn(db, "market_offers", "seller_counter_pence", "INTEGER");
  await ensureColumn(db, "market_offers", "seller_counter_message", "TEXT");

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS offer_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      offer_id INTEGER NOT NULL,
      author_user_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS cs2_sim_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `).run();

  const feeSeed = await db.prepare(`SELECT 1 FROM cs2_sim_settings WHERE key = 'quick_sell_fee_percent' LIMIT 1`).first();
  if (!feeSeed) {
    await db.prepare(`
      INSERT INTO cs2_sim_settings (key, value) VALUES ('quick_sell_fee_percent', ?)
    `).bind(String(DEFAULT_QUICK_SELL_FEE_PERCENT)).run();
  }


  const startingBalanceMigrationKey = 'starting_balance_5000_gc_applied';
  const startingBalanceSeed = await db.prepare(`SELECT 1 FROM cs2_sim_settings WHERE key = ? LIMIT 1`)
    .bind(startingBalanceMigrationKey)
    .first();
  if (!startingBalanceSeed) {
    await db.prepare(`UPDATE case_profiles SET balance = ?, updated_at = ?`)
      .bind(STARTING_BALANCE_PENCE, new Date().toISOString())
      .run();
    await db.prepare(`INSERT INTO cs2_sim_settings (key, value) VALUES (?, ?)`)
      .bind(startingBalanceMigrationKey, String(STARTING_BALANCE_PENCE))
      .run();
  }

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS profile_showcase (
      user_id INTEGER NOT NULL,
      slot INTEGER NOT NULL,
      inventory_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, slot)
    )
  `).run();

  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_trade_history_created_at ON trade_history (created_at DESC)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_market_price_history_hash_bucket ON market_price_history (market_hash_name, bucket_started_at DESC)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_market_listings_status ON market_listings (status)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_market_listings_seller ON market_listings (seller_user_id)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_case_items_case_def ON case_items (case_def_id)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_pending_drops_user ON pending_drops (user_id)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_skin_instances_owner ON skin_instances (current_owner_user_id, status)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_quick_sell_graveyard_user ON quick_sell_graveyard (user_id, created_at DESC)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_auction_bids_listing ON auction_bids (listing_id)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_market_offers_listing ON market_offers (listing_id)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_offer_messages_offer ON offer_messages (offer_id)`).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS cs2_image_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      target_name TEXT NOT NULL,
      market_hash_name TEXT,
      current_image_url TEXT,
      report_reason TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      reported_by_user_id INTEGER,
      resolved_at TEXT,
      resolved_by_user_id INTEGER,
      admin_note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();

  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_cs2_image_reports_status ON cs2_image_reports (status, created_at DESC)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_cs2_image_reports_target ON cs2_image_reports (item_type, target_id, status)`).run();
}
