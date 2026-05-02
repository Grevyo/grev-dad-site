import { getCasesDb } from '../../lib/cases-binding.js';

const DEFAULT_SECTIONS = [
  {
    slug: 'slot-games',
    title: 'Slot Games',
    description: 'Classic slot machines with Grev Coin bets and fast result reveals.',
    accent_color: '#f59e0b',
    sort_order: 1,
    settings: { min_bet_coins: 100, max_bet_coins: 5000, default_lines: 20, jackpot_enabled: true, free_spins_enabled: true, rtp_percent: 96 }
  },
  {
    slug: 'arcade-games',
    title: 'Arcade Games',
    description: 'Fast-paced casino arcade modes with shared timing and leaderboard energy.',
    accent_color: '#38bdf8',
    sort_order: 2,
    settings: { min_bet_coins: 50, max_bet_coins: 2500, tournament_enabled: true, leaderboard_enabled: true, reward_multiplier: 125 }
  },
  {
    slug: 'table-games',
    title: 'Table Games',
    description: 'Classic table action for timed roulette rounds and strategic bets.',
    accent_color: '#a78bfa',
    sort_order: 3,
    settings: { min_bet_coins: 50, max_bet_coins: 5000, leaderboard_enabled: true }
  }
];

const DEFAULT_GAMES = [
  {
    section_slug: 'slot-games', slug: 'classic-fruity', title: 'Classic Fruity', summary: 'Retro fruit cabinet with quick Grev Coin spins, simple line wins, and fast result reveals.', badge: 'slots', sort_order: 0,
    settings: { enabled: true, min_bet_coins: 5, max_bet_coins: 25, paylines: 1, hit_frequency_percent: 29 }
  },
  {
    section_slug: 'arcade-games', slug: 'daily-spin', title: 'Daily Spin', summary: 'Free reward wheel that gives every player a fresh Grev Coin bump.', badge: 'freebie', sort_order: 0,
    settings: { enabled: true, refresh_interval_hours: 6, free_play: true }
  },
  {
    section_slug: 'table-games', slug: 'roulette', title: 'Roulette', summary: 'Place bets on the next wheel result, then watch the table settle when the round closes.', badge: 'table', sort_order: 0,
    settings: { enabled: true, min_bet_coins: 5, max_bet_coins: 50, round_seconds: 30 }
  },
  {
    section_slug: 'arcade-games', slug: 'crash-sprint', title: 'Crash Sprint', summary: 'A shared global cash-out table where everyone races the same crash point every 5 minutes.', badge: 'global', sort_order: 1,
    settings: { enabled: true, min_entry_coins: 75, max_entry_coins: 2000, max_multiplier: 25, auto_cashout_enabled: true }
  }
];


function nowIso() {
  return new Date().toISOString();
}

export async function ensureCasinoTables(env) {
  const db = getCasesDb(env);
  if (!db) return null;

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS casino_sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      accent_color TEXT NOT NULL DEFAULT '#eb4b4b',
      settings_json TEXT NOT NULL DEFAULT '{}',
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS casino_games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_slug TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      badge TEXT,
      settings_json TEXT NOT NULL DEFAULT '{}',
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();

  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_casino_sections_sort ON casino_sections (sort_order ASC, title ASC)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_casino_games_section_sort ON casino_games (section_slug ASC, sort_order ASC, title ASC)`).run();

  const now = nowIso();
  for (const section of DEFAULT_SECTIONS) {
    await db.prepare(`
      INSERT INTO casino_sections (slug, title, description, accent_color, settings_json, is_active, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        accent_color = excluded.accent_color,
        sort_order = excluded.sort_order,
        updated_at = excluded.updated_at
    `).bind(
      section.slug,
      section.title,
      section.description,
      section.accent_color,
      JSON.stringify(section.settings),
      section.sort_order,
      now,
      now
    ).run();
  }

  const defaultGameSlugs = DEFAULT_GAMES.map((game) => game.slug);
  if (defaultGameSlugs.length) {
    const placeholders = defaultGameSlugs.map(() => '?').join(', ');
    await db.prepare(`DELETE FROM casino_games WHERE slug NOT IN (${placeholders})`).bind(...defaultGameSlugs).run();
  }

  for (const game of DEFAULT_GAMES) {
    await db.prepare(`
      INSERT INTO casino_games (section_slug, slug, title, summary, badge, settings_json, is_active, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        section_slug = excluded.section_slug,
        title = excluded.title,
        summary = excluded.summary,
        badge = excluded.badge,
        sort_order = excluded.sort_order,
        updated_at = excluded.updated_at
    `).bind(
      game.section_slug,
      game.slug,
      game.title,
      game.summary,
      game.badge,
      JSON.stringify(game.settings),
      game.sort_order,
      now,
      now
    ).run();
  }

  return db;
}
