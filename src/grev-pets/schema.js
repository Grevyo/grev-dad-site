let grevPetsTablesReadyPromise = null;

export async function ensureGrevPetsTables(env) {
  if (!env?.DB) {
    throw new Error("Missing DB binding");
  }

  if (!grevPetsTablesReadyPromise) {
    grevPetsTablesReadyPromise = ensureGrevPetsTablesOnce(env.DB).catch((error) => {
      grevPetsTablesReadyPromise = null;
      throw error;
    });
  }

  await grevPetsTablesReadyPromise;
}

async function ensureGrevPetsTablesOnce(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS gp_player_state (
      user_id INTEGER PRIMARY KEY,
      username TEXT NOT NULL,
      pos_x REAL NOT NULL DEFAULT 220,
      pos_y REAL NOT NULL DEFAULT 240,
      zone TEXT NOT NULL DEFAULT 'town_hub',
      active_pet_id TEXT,
      starter_claimed INTEGER NOT NULL DEFAULT 0,
      encounter_seed INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    )
  `).run();

  await ensureColumn(db, "gp_player_state", "username", "TEXT NOT NULL DEFAULT 'Player'");
  await ensureColumn(db, "gp_player_state", "pos_x", "REAL NOT NULL DEFAULT 220");
  await ensureColumn(db, "gp_player_state", "pos_y", "REAL NOT NULL DEFAULT 240");
  await ensureColumn(db, "gp_player_state", "zone", "TEXT NOT NULL DEFAULT 'town_hub'");
  await ensureColumn(db, "gp_player_state", "active_pet_id", "TEXT");
  await ensureColumn(db, "gp_player_state", "starter_claimed", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "gp_player_state", "encounter_seed", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "gp_player_state", "updated_at", "TEXT");

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS gp_pets (
      pet_id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      species TEXT NOT NULL,
      level INTEGER NOT NULL,
      xp INTEGER NOT NULL,
      rarity TEXT NOT NULL,
      temperament TEXT NOT NULL,
      growth_bias TEXT NOT NULL,
      stats_json TEXT NOT NULL,
      traits_json TEXT NOT NULL,
      battle_wins INTEGER NOT NULL DEFAULT 0,
      battle_losses INTEGER NOT NULL DEFAULT 0,
      race_wins INTEGER NOT NULL DEFAULT 0,
      race_places INTEGER NOT NULL DEFAULT 0,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      caught_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();

  await ensureColumn(db, "gp_pets", "battle_wins", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "gp_pets", "battle_losses", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "gp_pets", "race_wins", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "gp_pets", "race_places", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "gp_pets", "is_favorite", "INTEGER NOT NULL DEFAULT 0");

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS gp_presence (
      user_id INTEGER PRIMARY KEY,
      username TEXT NOT NULL,
      pos_x REAL NOT NULL,
      pos_y REAL NOT NULL,
      zone TEXT NOT NULL,
      active_pet_id TEXT,
      last_seen_at TEXT NOT NULL
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS gp_encounters (
      encounter_id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      wild_data_json TEXT NOT NULL,
      wild_current_hp INTEGER NOT NULL,
      zone TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      resolved INTEGER NOT NULL DEFAULT 0
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS gp_event_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      pet_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      outcome TEXT NOT NULL,
      xp_gained INTEGER NOT NULL DEFAULT 0,
      payload_json TEXT,
      created_at TEXT NOT NULL
    )
  `).run();

  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_gp_pets_user ON gp_pets (user_id, updated_at DESC)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_gp_presence_seen ON gp_presence (last_seen_at DESC)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_gp_encounters_user ON gp_encounters (user_id, resolved, expires_at)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_gp_event_user_time ON gp_event_log (user_id, created_at DESC)`).run();
}

async function ensureColumn(db, tableName, columnName, columnDefinition) {
  const result = await db.prepare(`PRAGMA table_info(${tableName})`).all();
  const cols = result.results || [];
  const exists = cols.some((col) => String(col.name).toLowerCase() === String(columnName).toLowerCase());

  if (!exists) {
    await db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`).run();
  }
}
