import { YGO_ACHIEVEMENTS, YGO_CARDS, YGO_PACKS, YGO_RARITIES } from './data.js';

function isoNow() {
  return new Date().toISOString();
}

async function ensureColumn(db, tableName, columnName, columnDefinition) {
  const result = await db.prepare(`PRAGMA table_info(${tableName})`).all();
  const cols = result.results || [];
  const exists = cols.some((col) => String(col.name).toLowerCase() === String(columnName).toLowerCase());
  if (!exists) {
    await db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`).run();
  }
}

export async function ensureYgoTables(db, walletDb = db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ygo_pack_definitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      set_name TEXT NOT NULL,
      ygoprodeck_set_id TEXT,
      description TEXT NOT NULL,
      pack_price_coins INTEGER NOT NULL,
      cards_per_pack INTEGER NOT NULL DEFAULT 5,
      guaranteed_rare_slot TEXT NOT NULL DEFAULT 'rare',
      cover_card_name TEXT,
      cover_image_url TEXT,
      mission_reward_coins INTEGER NOT NULL DEFAULT 0,
      streak_reward_coins INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ygo_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pack_slug TEXT NOT NULL,
      card_name TEXT NOT NULL,
      ygoprodeck_card_id INTEGER,
      rarity_code TEXT NOT NULL,
      estimated_price_coins INTEGER NOT NULL DEFAULT 0,
      card_type TEXT,
      attribute TEXT,
      level_stars INTEGER NOT NULL DEFAULT 0,
      attack_points INTEGER NOT NULL DEFAULT 0,
      defense_points INTEGER NOT NULL DEFAULT 0,
      image_url TEXT,
      external_price_note TEXT,
      source_url TEXT,
      drop_weight INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(pack_slug, card_name, rarity_code)
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ygo_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      pack_slug TEXT NOT NULL,
      card_id INTEGER NOT NULL,
      card_name TEXT NOT NULL,
      rarity_code TEXT NOT NULL,
      foil_label TEXT NOT NULL,
      sell_back_coins INTEGER NOT NULL,
      estimated_price_coins INTEGER NOT NULL,
      image_url TEXT,
      acquired_at TEXT NOT NULL,
      sold_at TEXT,
      source_pack_id INTEGER,
      mission_tag TEXT
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ygo_pack_open_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      pack_slug TEXT NOT NULL,
      pack_name TEXT NOT NULL,
      pack_price_coins INTEGER NOT NULL,
      opened_at TEXT NOT NULL,
      total_estimated_value_coins INTEGER NOT NULL DEFAULT 0
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ygo_pack_open_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pack_open_id INTEGER NOT NULL,
      card_id INTEGER NOT NULL,
      card_name TEXT NOT NULL,
      rarity_code TEXT NOT NULL,
      foil_label TEXT NOT NULL,
      estimated_price_coins INTEGER NOT NULL,
      sell_back_coins INTEGER NOT NULL,
      image_url TEXT
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ygo_player_stats (
      user_id INTEGER PRIMARY KEY,
      packs_opened INTEGER NOT NULL DEFAULT 0,
      total_spent_coins INTEGER NOT NULL DEFAULT 0,
      cards_owned INTEGER NOT NULL DEFAULT 0,
      total_sellback_coins INTEGER NOT NULL DEFAULT 0,
      ghost_pulls INTEGER NOT NULL DEFAULT 0,
      current_streak_days INTEGER NOT NULL DEFAULT 0,
      best_streak_days INTEGER NOT NULL DEFAULT 0,
      last_opened_on TEXT,
      missions_completed INTEGER NOT NULL DEFAULT 0,
      achievements_completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ygo_achievement_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      achievement_code TEXT NOT NULL,
      current_value INTEGER NOT NULL DEFAULT 0,
      target_value INTEGER NOT NULL,
      claimed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, achievement_code)
    )
  `).run();


  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ygo_showcase (
      user_id INTEGER NOT NULL,
      slot INTEGER NOT NULL,
      inventory_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, slot)
    )
  `).run();

  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_ygo_cards_pack_slug ON ygo_cards (pack_slug, rarity_code)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_ygo_inventory_user_id ON ygo_inventory (user_id, sold_at)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_ygo_open_history_user_id ON ygo_pack_open_history (user_id, opened_at DESC)`).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ygo_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `).run();

  await ensureColumn(walletDb, 'case_profiles', 'balance', 'INTEGER NOT NULL DEFAULT 500000');
  await ensureColumn(db, 'ygo_cards', 'drop_weight', 'INTEGER NOT NULL DEFAULT 0');

  const now = isoNow();
  for (const pack of YGO_PACKS) {
    await db.prepare(`
      INSERT INTO ygo_pack_definitions (
        slug, set_name, ygoprodeck_set_id, description, pack_price_coins, cards_per_pack,
        guaranteed_rare_slot, cover_card_name, cover_image_url, mission_reward_coins,
        streak_reward_coins, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        set_name = excluded.set_name,
        ygoprodeck_set_id = excluded.ygoprodeck_set_id,
        description = excluded.description,
        pack_price_coins = excluded.pack_price_coins,
        cards_per_pack = excluded.cards_per_pack,
        guaranteed_rare_slot = excluded.guaranteed_rare_slot,
        cover_card_name = excluded.cover_card_name,
        cover_image_url = excluded.cover_image_url,
        mission_reward_coins = excluded.mission_reward_coins,
        streak_reward_coins = excluded.streak_reward_coins,
        updated_at = excluded.updated_at
    `).bind(
      pack.slug,
      pack.set_name,
      pack.ygoprodeck_set_id,
      pack.description,
      pack.pack_price_coins,
      pack.cards_per_pack,
      pack.guaranteed_rare_slot,
      pack.cover_card_name,
      pack.cover_image_url,
      pack.mission_reward_coins,
      pack.streak_reward_coins,
      now,
      now
    ).run();
  }

  for (const card of YGO_CARDS) {
    await db.prepare(`
      INSERT INTO ygo_cards (
        pack_slug, card_name, ygoprodeck_card_id, rarity_code, estimated_price_coins,
        card_type, attribute, level_stars, attack_points, defense_points, image_url,
        external_price_note, source_url, drop_weight, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(pack_slug, card_name, rarity_code) DO UPDATE SET
        ygoprodeck_card_id = excluded.ygoprodeck_card_id,
        estimated_price_coins = excluded.estimated_price_coins,
        card_type = excluded.card_type,
        attribute = excluded.attribute,
        level_stars = excluded.level_stars,
        attack_points = excluded.attack_points,
        defense_points = excluded.defense_points,
        image_url = excluded.image_url,
        external_price_note = excluded.external_price_note,
        source_url = excluded.source_url,
        drop_weight = excluded.drop_weight,
        updated_at = excluded.updated_at
    `).bind(
      card.set_slug,
      card.card_name,
      card.ygoprodeck_card_id,
      card.rarity_code,
      card.estimated_price_coins,
      card.card_type,
      card.attribute,
      card.level_stars,
      card.attack_points,
      card.defense_points,
      card.image_url,
      card.external_price_note,
      card.source_url,
      Number(card.drop_weight || YGO_RARITIES[card.rarity_code]?.pull_weight || (card.rarity_code === 'rare' ? 100 : 1)),
      now,
      now
    ).run();
  }

  await db.prepare(`INSERT OR IGNORE INTO ygo_settings (key, value) VALUES ('single_card_price_coins', '125')`).run();

  for (const achievement of YGO_ACHIEVEMENTS) {
    await db.prepare(`
      INSERT OR IGNORE INTO ygo_achievement_progress (
        user_id, achievement_code, current_value, target_value, created_at, updated_at
      ) VALUES (0, ?, 0, ?, ?, ?)
    `).bind(achievement.code, achievement.target_value, now, now).run();
  }
}

export function getYgoRarityMeta(code) {
  return YGO_RARITIES[code] || YGO_RARITIES.common;
}

export { YGO_ACHIEVEMENTS, YGO_PACKS, YGO_RARITIES };
