import { getCasesDb } from '../lib/cases-binding.js';

const DEFAULT_SECTIONS = [
  {
    slug: 'slot-games',
    title: 'Slot Games',
    description: 'Classic 3-reel and 5-reel slot machines with Grev Coin bets, bonus rounds, free spins, and jackpots.',
    accent_color: '#f59e0b',
    sort_order: 1,
    settings: {
      min_bet_coins: 100,
      max_bet_coins: 5000,
      default_lines: 20,
      jackpot_enabled: true,
      free_spins_enabled: true,
      rtp_percent: 96
    }
  },
  {
    slug: 'arcade-games',
    title: 'Arcade Games',
    description: 'Skill-based arcade rooms, achievement ladders, and tournament-friendly Grev Coin side modes.',
    accent_color: '#38bdf8',
    sort_order: 2,
    settings: {
      min_bet_coins: 50,
      max_bet_coins: 2500,
      tournament_enabled: true,
      leaderboard_enabled: true,
      reward_multiplier: 125
    }
  },
  {
    slug: 'fishing-games',
    title: 'Fishing Games',
    description: 'Multiplayer fishing rooms with boss fish, auto-fire, tide swings, and shared Grev Coin pools.',
    accent_color: '#22c55e',
    sort_order: 3,
    settings: {
      room_capacity: 6,
      boss_spawn_rate_percent: 12,
      auto_fire_enabled: true,
      tide_cycle_seconds: 90,
      ammo_cost_coins: 25
    }
  },
  {
    slug: 'custom-games',
    title: 'Custom Games',
    description: 'Flexible plugin-ready rooms for new Grev.dad gambling experiments, events, and prototype modes.',
    accent_color: '#a78bfa',
    sort_order: 4,
    settings: {
      room_templates_enabled: true,
      plugin_mode_enabled: true,
      featured_reward_coins: 250,
      moderation_required: true
    }
  }
];

const DEFAULT_GAMES = [
  {
    section_slug: 'slot-games', slug: 'classic-reels', title: 'Classic Reels', summary: 'A retro 3-reel machine with fast spins, low-entry Grev Coin bets, and simple line wins.', badge: '3 reels', sort_order: 1,
    settings: { enabled: true, min_bet_coins: 100, max_bet_coins: 1500, paylines: 3, hit_frequency_percent: 29, jackpot_start_coins: 50000 }
  },
  {
    section_slug: 'slot-games', slug: 'neon-jackpot', title: 'Neon Jackpot', summary: 'A 5-reel featured slot with multipliers, free spins, and a configurable jackpot ladder.', badge: '5 reels', sort_order: 2,
    settings: { enabled: true, min_bet_coins: 200, max_bet_coins: 5000, paylines: 25, bonus_round_enabled: true, jackpot_start_coins: 250000 }
  },
  {
    section_slug: 'arcade-games', slug: 'crash-sprint', title: 'Crash Sprint', summary: 'A quick arcade cash-out game where admins tune the risk curve and maximum booster.', badge: 'arcade', sort_order: 1,
    settings: { enabled: true, min_entry_coins: 75, max_entry_coins: 2000, max_multiplier: 25, auto_cashout_enabled: true }
  },
  {
    section_slug: 'arcade-games', slug: 'token-drop', title: 'Token Drop', summary: 'Coin-drop arcade mode with timed rounds, leaderboard rewards, and event-based boosts.', badge: 'leaderboard', sort_order: 2,
    settings: { enabled: true, min_entry_coins: 50, max_entry_coins: 1250, round_seconds: 45, reward_pool_coins: 10000 }
  },
  {
    section_slug: 'fishing-games', slug: 'harbor-hunt', title: 'Harbor Hunt', summary: 'Standard multiplayer fishing room with ammo scaling, small boss fish, and rotating tides.', badge: '6 players', sort_order: 1,
    settings: { enabled: true, room_capacity: 6, ammo_cost_coins: 25, boss_spawn_rate_percent: 10, auto_fire_enabled: true }
  },
  {
    section_slug: 'fishing-games', slug: 'kraken-rush', title: 'Kraken Rush', summary: 'High-volatility fishing map with big boss spawns and expensive Grev Coin cannons.', badge: 'boss mode', sort_order: 2,
    settings: { enabled: true, room_capacity: 4, ammo_cost_coins: 80, boss_spawn_rate_percent: 24, auto_fire_enabled: false }
  },
  {
    section_slug: 'custom-games', slug: 'room-builder', title: 'Room Builder', summary: 'An admin-curated sandbox for new minigames, prototype rooms, and custom challenge rule sets.', badge: 'sandbox', sort_order: 1,
    settings: { enabled: true, room_fee_coins: 150, template_limit: 8, plugin_slots: 4, moderation_required: true }
  },
  {
    section_slug: 'custom-games', slug: 'event-lab', title: 'Event Lab', summary: 'Seasonal custom mode slot for limited-time experiences tied into Grev Coin progression.', badge: 'seasonal', sort_order: 2,
    settings: { enabled: true, entry_fee_coins: 100, featured_reward_coins: 500, live_event_enabled: true }
  },
  {
    section_slug: 'custom-games', slug: 'texas-holdem', title: 'Texas Holdem', summary: 'Join a table, receive two hole cards, and play standard Texas Holdem streets with blinds, betting rounds, and showdowns.', badge: 'poker', sort_order: 3,
    settings: { enabled: true, min_buy_in_coins: 500, max_seats: 6, small_blind_coins: 10, big_blind_coins: 20 }
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
