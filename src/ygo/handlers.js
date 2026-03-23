import { YGO_ACHIEVEMENTS, YGO_PACKS, YGO_RARITIES } from './data.js';
import { getCachedValue, invalidateCachedPrefix, setCachedValue } from '../lib/runtime-cache.js';
import { getStartingBalancePence } from '../lib/gambling.js';
import { getCasesDb } from '../lib/cases-db.js';
import { getYgoRarityMeta } from './schema.js';

function getYgoDataDb(env) {
  return getCasesDb(env);
}

function pickWeighted(rows) {
  const total = rows.reduce((sum, row) => sum + Number(row.weight || 0), 0);
  let roll = Math.random() * total;
  for (const row of rows) {
    roll -= Number(row.weight || 0);
    if (roll <= 0) return row;
  }
  return rows[rows.length - 1] || null;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatFoilLabel(rarityCode) {
  return getYgoRarityMeta(rarityCode).foil;
}

function calcSellBack(priceCoins, rarityCode) {
  const pct = Number(getYgoRarityMeta(rarityCode).sell_back_percent || 50);
  return Math.max(1, Math.round(Number(priceCoins || 0) * (pct / 100)));
}

function normaliseDropWeight(value, fallback = 1) {
  const n = Number(value || 0);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : Math.max(1, Math.round(fallback));
}

function calculatePackExpectedValue(cards) {
  const pool = (cards || []).filter((card) => Number(card.drop_weight || 0) > 0);
  const totalWeight = pool.reduce((sum, card) => sum + Number(card.drop_weight || 0), 0);
  if (!totalWeight) return 0;
  return pool.reduce((sum, card) => sum + (Number(card.estimated_price_coins || 0) * (Number(card.drop_weight || 0) / totalWeight)), 0);
}

function suggestPackPriceFromRoi(expectedValue, roiTargetPercent = 70) {
  const roi = Math.max(5, Math.min(200, Number(roiTargetPercent || 70)));
  return Math.max(1, Math.round(Number(expectedValue || 0) / (roi / 100)));
}

async function getYgoDiscountPercent(env) {
  const row = await getCachedValue('casesdb:event-config', 30000, async () => await getCasesDb(env).prepare(`SELECT is_active, cs2_discount_percent, ygo_discount_percent, blackjack_bonus_percent, title, message, updated_at FROM gambling_event_config WHERE id = 1 LIMIT 1`).first().catch(() => null));
  return row && Number(row.is_active) ? Math.max(0, Math.min(100, Number(row.ygo_discount_percent || 0))) : 0;
}

async function getSingleCardPriceCoins(env) {
  const row = await getCachedValue('casesdb:ygo:single-price', 30000, async () => await getYgoDataDb(env).prepare(`SELECT value FROM ygo_settings WHERE key = 'single_card_price_coins' LIMIT 1`).first());
  return Number(row?.value || 125);
}

async function ensurePlayer(env, session, isoNow) {
  const now = isoNow();
  const ygoDb = getYgoDataDb(env);
  await getCasesDb(env).prepare(`
    INSERT OR IGNORE INTO case_profiles (
      user_id, display_name, balance, total_cases_opened, total_spent, total_inventory_value, created_at, updated_at
    ) VALUES (?, ?, 500000, 0, 0, 0, ?, ?)
  `).bind(session.id, session.username, await getStartingBalancePence(env), now, now).run();

  await ygoDb.prepare(`
    INSERT OR IGNORE INTO ygo_player_stats (
      user_id, created_at, updated_at
    ) VALUES (?, ?, ?)
  `).bind(session.id, now, now).run();

  for (const achievement of YGO_ACHIEVEMENTS) {
    await ygoDb.prepare(`
      INSERT OR IGNORE INTO ygo_achievement_progress (
        user_id, achievement_code, current_value, target_value, created_at, updated_at
      ) VALUES (?, ?, 0, ?, ?, ?)
    `).bind(session.id, achievement.code, achievement.target_value, now, now).run();
  }
}

async function getWallet(env, userId) {
  return await getCasesDb(env).prepare(`SELECT balance FROM case_profiles WHERE user_id = ? LIMIT 1`).bind(userId).first();
}

async function syncCardsOwned(env, userId, isoNow) {
  const ygoDb = getYgoDataDb(env);
  const row = await ygoDb.prepare(`SELECT COUNT(*) AS c FROM ygo_inventory WHERE user_id = ? AND sold_at IS NULL`).bind(userId).first();
  await ygoDb.prepare(`UPDATE ygo_player_stats SET cards_owned = ?, updated_at = ? WHERE user_id = ?`).bind(Number(row?.c || 0), isoNow(), userId).run();
  return Number(row?.c || 0);
}

async function evaluateAchievements(env, userId, isoNow) {
  const ygoDb = getYgoDataDb(env);
  const stats = await ygoDb.prepare(`SELECT * FROM ygo_player_stats WHERE user_id = ? LIMIT 1`).bind(userId).first();
  if (!stats) return [];
  const unlocked = [];
  const metricMap = {
    packs_opened: Number(stats.packs_opened || 0),
    ghost_pulls: Number(stats.ghost_pulls || 0),
    cards_owned: Number(stats.cards_owned || 0)
  };

  for (const achievement of YGO_ACHIEVEMENTS) {
    const currentValue = Number(metricMap[achievement.metric_key] || 0);
    await ygoDb.prepare(`
      UPDATE ygo_achievement_progress
      SET current_value = ?, updated_at = ?
      WHERE user_id = ? AND achievement_code = ?
    `).bind(currentValue, isoNow(), userId, achievement.code).run();

    const row = await ygoDb.prepare(`
      SELECT * FROM ygo_achievement_progress
      WHERE user_id = ? AND achievement_code = ? LIMIT 1
    `).bind(userId, achievement.code).first();

    if (row && !row.claimed_at && currentValue >= Number(row.target_value || achievement.target_value)) {
      const now = isoNow();
      await ygoDb.prepare(`UPDATE ygo_achievement_progress SET claimed_at = ?, updated_at = ? WHERE id = ?`).bind(now, now, row.id).run();
      await getCasesDb(env).prepare(`UPDATE case_profiles SET balance = balance + ?, updated_at = ? WHERE user_id = ?`).bind(achievement.reward_coins, now, userId).run();
      await ygoDb.prepare(`UPDATE ygo_player_stats SET achievements_completed = achievements_completed + 1, updated_at = ? WHERE user_id = ?`).bind(now, userId).run();
      unlocked.push({ ...achievement, claimed_at: now });
    }
  }

  return unlocked;
}

async function getMissionState(env, userId) {
  const stats = await getYgoDataDb(env).prepare(`SELECT packs_opened, current_streak_days, last_opened_on FROM ygo_player_stats WHERE user_id = ? LIMIT 1`).bind(userId).first();
  const packsOpened = Number(stats?.packs_opened || 0);
  const streak = Number(stats?.current_streak_days || 0);
  return [
    { code: 'daily_duelist', title: 'Daily Duelist', description: 'Open 1 pack today.', progress: stats?.last_opened_on === todayIsoDate() ? 1 : 0, target: 1, reward_coins: 90, completed: stats?.last_opened_on === todayIsoDate() },
    { code: 'pack_apprentice', title: 'Pack Apprentice', description: 'Open 3 packs total.', progress: Math.min(packsOpened, 3), target: 3, reward_coins: 140, completed: packsOpened >= 3 },
    { code: 'streak_keeper', title: 'Streak Keeper', description: 'Maintain a 3-day opening streak.', progress: Math.min(streak, 3), target: 3, reward_coins: 175, completed: streak >= 3 }
  ];
}

async function buildProfilePayload(env, session) {
  const ygoDb = getYgoDataDb(env);
  const wallet = await getWallet(env, session.id);
  const stats = await ygoDb.prepare(`SELECT * FROM ygo_player_stats WHERE user_id = ? LIMIT 1`).bind(session.id).first();
  const inventory = await ygoDb.prepare(`
    SELECT COUNT(*) AS count_cards,
           COALESCE(SUM(estimated_price_coins), 0) AS estimated_total,
           COALESCE(SUM(sell_back_coins), 0) AS sell_back_total
    FROM ygo_inventory
    WHERE user_id = ? AND sold_at IS NULL
  `).bind(session.id).first();
  const achievements = await ygoDb.prepare(`SELECT achievement_code, current_value, target_value, claimed_at FROM ygo_achievement_progress WHERE user_id = ? ORDER BY achievement_code ASC`).bind(session.id).all();
  return {
    wallet_balance: Number(wallet?.balance || 0),
    stats: {
      packs_opened: Number(stats?.packs_opened || 0),
      total_spent_coins: Number(stats?.total_spent_coins || 0),
      cards_owned: Number(inventory?.count_cards || 0),
      collection_value_coins: Number(inventory?.estimated_total || 0),
      sell_back_value_coins: Number(inventory?.sell_back_total || 0),
      ghost_pulls: Number(stats?.ghost_pulls || 0),
      current_streak_days: Number(stats?.current_streak_days || 0),
      best_streak_days: Number(stats?.best_streak_days || 0),
      achievements_completed: Number(stats?.achievements_completed || 0)
    },
    achievements: YGO_ACHIEVEMENTS.map((achievement) => {
      const row = (achievements.results || []).find((item) => item.achievement_code === achievement.code);
      return {
        ...achievement,
        current_value: Number(row?.current_value || 0),
        target_value: Number(row?.target_value || achievement.target_value),
        claimed_at: row?.claimed_at || null,
        completed: Boolean(row?.claimed_at)
      };
    }),
    missions: await getMissionState(env, session.id)
  };
}

export async function handleYgoRequest(request, env, deps) {
  const { json, getApprovedUser, requireGamblingAdmin, safeJson, isoNow } = deps;
  const url = new URL(request.url);
  const { pathname } = url;
  if (!pathname.startsWith('/api/ygo')) return null;
  const ygoDb = getYgoDataDb(env);
  if (!getCasesDb(env)) return json({ success: false, error: 'CASES-DB is not configured' }, 500, request);

  if (pathname === '/api/ygo/packs' && request.method === 'GET') {
    const payload = await getCachedValue('casesdb:ygo:packs', 60000, async () => {
      const packs = await ygoDb.prepare(`SELECT * FROM ygo_pack_definitions WHERE is_active = 1 ORDER BY pack_price_coins ASC`).all();
      const list = [];
      for (const pack of packs.results || []) {
        const rarityBreakdown = Object.values(YGO_RARITIES)
          .filter((rarity) => rarity.code !== 'rare')
          .map((rarity) => ({ code: rarity.code, label: rarity.label, weight: rarity.pull_weight }));
        const totalWeight = rarityBreakdown.reduce((sum, item) => sum + item.weight, 0);
        const cards = await ygoDb.prepare(`SELECT COUNT(*) AS c FROM ygo_cards WHERE pack_slug = ?`).bind(pack.slug).first();
        const packCards = await ygoDb.prepare(`SELECT estimated_price_coins, drop_weight FROM ygo_cards WHERE pack_slug = ?`).bind(pack.slug).all();
        const expectedValue = calculatePackExpectedValue(packCards.results || []);
        const discountPercent = await getYgoDiscountPercent(env);
        const discountedPackPrice = Math.max(1, Math.round(Number(pack.pack_price_coins || 0) * ((100 - discountPercent) / 100)));
        list.push({
          slug: pack.slug,
          set_name: pack.set_name,
          ygoprodeck_set_id: pack.ygoprodeck_set_id,
          description: pack.description,
          pack_price_coins: Number(pack.pack_price_coins || 0),
          discounted_pack_price_coins: discountedPackPrice,
          active_discount_percent: discountPercent,
          cards_per_pack: Number(pack.cards_per_pack || 5),
          guaranteed_rare_slot: pack.guaranteed_rare_slot,
          cover_card_name: pack.cover_card_name || '',
          cover_image_url: pack.cover_image_url || '',
          mission_reward_coins: Number(pack.mission_reward_coins || 0),
          streak_reward_coins: Number(pack.streak_reward_coins || 0),
          card_count: Number(cards?.c || 0),
          expected_value_coins: Math.round(expectedValue),
          roi_percent: Number(pack.pack_price_coins || 0) > 0 ? Number(((expectedValue / Number(pack.pack_price_coins || 1)) * 100).toFixed(2)) : 0,
          suggested_pack_price_coins: suggestPackPriceFromRoi(expectedValue),
          rarity_odds: [{ code: 'rare', label: 'Rare', guaranteed: true, chance_percent: 100 }].concat(
            rarityBreakdown.map((item) => ({ code: item.code, label: item.label, guaranteed: false, chance_percent: Number(((item.weight / totalWeight) * 100).toFixed(2)) }))
          )
        });
      }
      return list;
    });
    return json({ success: true, packs: payload }, 200, request);
  }

  if (pathname === '/api/ygo/single/settings' && request.method === 'GET') {
    const basePrice = await getSingleCardPriceCoins(env);
    const activeDiscountPercent = await getYgoDiscountPercent(env);
    return json({ success: true, single_card_price_coins: basePrice, discounted_single_card_price_coins: Math.max(1, Math.round(basePrice * ((100 - activeDiscountPercent) / 100))), active_discount_percent: activeDiscountPercent }, 200, request);
  }

  if (pathname === '/api/ygo/admin/settings' && request.method === 'GET') {
    const admin = await requireGamblingAdmin(request, env);
    if (admin instanceof Response) return admin;
    return json({ success: true, settings: { single_card_price_coins: await getSingleCardPriceCoins(env) } }, 200, request);
  }

  if (pathname === '/api/ygo/admin/settings' && request.method === 'POST') {
    const admin = await requireGamblingAdmin(request, env);
    if (admin instanceof Response) return admin;
    const body = await safeJson(request);
    const price = Math.max(1, Math.round(Number(body?.single_card_price_coins || 0)));
    await ygoDb.prepare(`INSERT INTO ygo_settings (key, value) VALUES ('single_card_price_coins', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).bind(String(price)).run();
    setCachedValue('casesdb:ygo:single-price', { value: String(price) }, 30000);
    return json({ success: true, message: 'Single-card opener price saved', settings: { single_card_price_coins: price } }, 200, request);
  }

  if (pathname === '/api/ygo/admin/packs' && request.method === 'GET') {
    const admin = await requireGamblingAdmin(request, env);
    if (admin instanceof Response) return admin;

    const packs = await ygoDb.prepare(`SELECT * FROM ygo_pack_definitions ORDER BY set_name ASC`).all();
    const payload = [];
    for (const pack of packs.results || []) {
      const cards = await ygoDb.prepare(`SELECT id, card_name, rarity_code, estimated_price_coins, drop_weight FROM ygo_cards WHERE pack_slug = ? ORDER BY estimated_price_coins DESC, card_name ASC`).bind(pack.slug).all();
      const expectedValue = calculatePackExpectedValue(cards.results || []);
      const discountPercent = await getYgoDiscountPercent(env);
      const discountedPackPrice = Math.max(1, Math.round(Number(pack.pack_price_coins || 0) * ((100 - discountPercent) / 100)));
      payload.push({
        ...pack,
        pack_price_coins: Number(pack.pack_price_coins || 0),
        discounted_pack_price_coins: discountedPackPrice,
        active_discount_percent: discountPercent,
        expected_value_coins: Math.round(expectedValue),
        suggested_pack_price_coins: suggestPackPriceFromRoi(expectedValue),
        roi_percent: Number(pack.pack_price_coins || 0) > 0 ? Number(((expectedValue / Number(pack.pack_price_coins || 1)) * 100).toFixed(2)) : 0,
        cards: (cards.results || []).map((card) => ({ ...card, estimated_price_coins: Number(card.estimated_price_coins || 0), drop_weight: Number(card.drop_weight || 0) }))
      });
    }
    return json({ success: true, packs: payload }, 200, request);
  }

  if (pathname === '/api/ygo/admin/pack' && request.method === 'POST') {
    const admin = await requireGamblingAdmin(request, env);
    if (admin instanceof Response) return admin;
    const body = await safeJson(request);
    const slug = String(body?.slug || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
    const setName = String(body?.set_name || '').trim();
    const packPrice = Math.max(1, Math.round(Number(body?.pack_price_coins || 0)));
    const cardsPerPack = Math.max(1, Math.min(10, Math.round(Number(body?.cards_per_pack || 5))));
    if (!slug || !setName) return json({ success: false, error: 'slug and set_name are required' }, 400, request);
    const now = isoNow();
    await ygoDb.prepare(`
      INSERT INTO ygo_pack_definitions (slug, set_name, ygoprodeck_set_id, description, pack_price_coins, cards_per_pack, guaranteed_rare_slot, cover_card_name, cover_image_url, mission_reward_coins, streak_reward_coins, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'rare', ?, ?, 0, 0, 1, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        set_name = excluded.set_name,
        ygoprodeck_set_id = excluded.ygoprodeck_set_id,
        description = excluded.description,
        pack_price_coins = excluded.pack_price_coins,
        cards_per_pack = excluded.cards_per_pack,
        cover_card_name = excluded.cover_card_name,
        cover_image_url = excluded.cover_image_url,
        updated_at = excluded.updated_at
    `).bind(slug, setName, String(body?.ygoprodeck_set_id || '').trim(), String(body?.description || '').trim(), packPrice, cardsPerPack, String(body?.cover_card_name || '').trim(), String(body?.cover_image_url || '').trim(), now, now).run();
    invalidateCachedPrefix('casesdb:ygo:packs');
    return json({ success: true, message: 'Pack saved' }, 200, request);
  }

  if (pathname === '/api/ygo/admin/card' && request.method === 'POST') {
    const admin = await requireGamblingAdmin(request, env);
    if (admin instanceof Response) return admin;
    const body = await safeJson(request);
    const packSlug = String(body?.pack_slug || '').trim();
    const cardName = String(body?.card_name || '').trim();
    const rarityCode = String(body?.rarity_code || 'common').trim();
    if (!packSlug || !cardName) return json({ success: false, error: 'pack_slug and card_name are required' }, 400, request);
    const now = isoNow();
    const estimated = Math.max(1, Math.round(Number(body?.estimated_price_coins || 0)));
    const dropWeight = normaliseDropWeight(body?.drop_weight, YGO_RARITIES[rarityCode]?.pull_weight || 1);
    await ygoDb.prepare(`
      INSERT INTO ygo_cards (pack_slug, card_name, ygoprodeck_card_id, rarity_code, estimated_price_coins, card_type, attribute, level_stars, attack_points, defense_points, image_url, external_price_note, source_url, drop_weight, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    `).bind(packSlug, cardName, Number(body?.ygoprodeck_card_id || 0) || null, rarityCode, estimated, String(body?.card_type || '').trim(), String(body?.attribute || '').trim(), Math.max(0, Math.round(Number(body?.level_stars || 0))), Math.max(0, Math.round(Number(body?.attack_points || 0))), Math.max(0, Math.round(Number(body?.defense_points || 0))), String(body?.image_url || '').trim(), String(body?.external_price_note || '').trim(), String(body?.source_url || '').trim(), dropWeight, now, now).run();
    invalidateCachedPrefix('casesdb:ygo:packs');
    return json({ success: true, message: 'Card saved' }, 200, request);
  }

  if (pathname === '/api/ygo/admin/roi' && request.method === 'POST') {
    const admin = await requireGamblingAdmin(request, env);
    if (admin instanceof Response) return admin;
    const body = await safeJson(request);
    const packSlug = String(body?.pack_slug || '').trim();
    const roiTargetPercent = Math.max(5, Math.min(200, Number(body?.roi_target_percent || 70)));
    if (!packSlug) return json({ success: false, error: 'pack_slug is required' }, 400, request);
    const cards = await ygoDb.prepare(`SELECT estimated_price_coins, drop_weight FROM ygo_cards WHERE pack_slug = ?`).bind(packSlug).all();
    const expectedValue = calculatePackExpectedValue(cards.results || []);
    return json({ success: true, expected_value_coins: Math.round(expectedValue), roi_target_percent: roiTargetPercent, suggested_pack_price_coins: suggestPackPriceFromRoi(expectedValue, roiTargetPercent) }, 200, request);
  }

  const session = await getApprovedUser(request, env);
  if (session instanceof Response) return session;
  await ensurePlayer(env, session, isoNow);

  if (pathname === '/api/ygo/profile' && request.method === 'GET') {
    const profile = await buildProfilePayload(env, session);
    return json({ success: true, profile }, 200, request);
  }

  if (pathname === '/api/ygo/profile/public' && request.method === 'GET') {
    const userId = Number(url.searchParams.get('user_id') || '');
    if (!Number.isInteger(userId) || userId <= 0) {
      return json({ success: false, error: 'A valid user id is required' }, 400, request);
    }

    const wallet = await getWallet(env, userId);
    const stats = await ygoDb.prepare(`SELECT * FROM ygo_player_stats WHERE user_id = ? LIMIT 1`).bind(userId).first();
    if (!wallet && !stats) {
      return json({ success: true, profile: null, showcase: [] }, 200, request);
    }

    const showcaseRows = await ygoDb.prepare(`
      SELECT s.slot, s.inventory_id, i.card_name, i.rarity_code, i.foil_label, i.image_url, i.estimated_price_coins, i.pack_slug
      FROM ygo_showcase s
      INNER JOIN ygo_inventory i ON i.id = s.inventory_id AND i.user_id = s.user_id AND i.sold_at IS NULL
      WHERE s.user_id = ?
      ORDER BY s.slot ASC
    `).bind(userId).all();

    return json({
      success: true,
      profile: {
        wallet_balance: Number(wallet?.balance || 0),
        packs_opened: Number(stats?.packs_opened || 0),
        cards_owned: Number(stats?.cards_owned || 0),
        achievements_completed: Number(stats?.achievements_completed || 0)
      },
      showcase: (showcaseRows.results || []).map((row) => ({ ...row, estimated_price_coins: Number(row.estimated_price_coins || 0) }))
    }, 200, request);
  }

  if (pathname === '/api/ygo/catalog' && request.method === 'GET') {
    const packSlug = (url.searchParams.get('pack_slug') || '').trim();
    const rarityCode = (url.searchParams.get('rarity') || '').trim();
    const rows = await ygoDb.prepare(`SELECT * FROM ygo_cards ORDER BY estimated_price_coins DESC, card_name ASC`).all();
    const items = (rows.results || []).filter((row) => (!packSlug || row.pack_slug === packSlug) && (!rarityCode || row.rarity_code === rarityCode)).map((row) => ({
      id: row.id,
      pack_slug: row.pack_slug,
      card_name: row.card_name,
      rarity_code: row.rarity_code,
      rarity_label: getYgoRarityMeta(row.rarity_code).label,
      foil_label: formatFoilLabel(row.rarity_code),
      estimated_price_coins: Number(row.estimated_price_coins || 0),
      sell_back_coins: calcSellBack(row.estimated_price_coins, row.rarity_code),
      card_type: row.card_type || '',
      attribute: row.attribute || '',
      level_stars: Number(row.level_stars || 0),
      attack_points: Number(row.attack_points || 0),
      defense_points: Number(row.defense_points || 0),
      image_url: row.image_url || '',
      external_price_note: row.external_price_note || '',
      source_url: row.source_url || '',
      drop_weight: Number(row.drop_weight || 0)
    }));
    return json({ success: true, cards: items }, 200, request);
  }

  if (pathname === '/api/ygo/inventory' && request.method === 'GET') {
    const rows = await ygoDb.prepare(`SELECT * FROM ygo_inventory WHERE user_id = ? AND sold_at IS NULL ORDER BY id DESC`).bind(session.id).all();
    const showcaseRows = await ygoDb.prepare(`SELECT slot, inventory_id FROM ygo_showcase WHERE user_id = ? ORDER BY slot ASC`).bind(session.id).all();
    return json({
      success: true,
      inventory: (rows.results || []).map((row) => ({ ...row })),
      showcase: (showcaseRows.results || []).map((row) => ({ slot: Number(row.slot), inventory_id: Number(row.inventory_id) }))
    }, 200, request);
  }

  if (pathname === '/api/ygo/showcase' && request.method === 'POST') {
    const body = await safeJson(request);
    const slot = Number(body?.slot);
    const inventoryId = Number(body?.inventory_id);
    if (!Number.isInteger(slot) || slot < 0 || slot > 4) {
      return json({ success: false, error: 'slot must be 0-4' }, 400, request);
    }
    if (!Number.isInteger(inventoryId) || inventoryId < 0) {
      return json({ success: false, error: 'A valid inventory id is required' }, 400, request);
    }

    if (inventoryId === 0) {
      await ygoDb.prepare(`DELETE FROM ygo_showcase WHERE user_id = ? AND slot = ?`).bind(session.id, slot).run();
      return json({ success: true, message: 'Showcase slot cleared' }, 200, request);
    }

    const item = await ygoDb.prepare(`SELECT id FROM ygo_inventory WHERE id = ? AND user_id = ? AND sold_at IS NULL LIMIT 1`).bind(inventoryId, session.id).first();
    if (!item) {
      return json({ success: false, error: 'Card not found in your collection' }, 404, request);
    }

    await ygoDb.prepare(`
      INSERT INTO ygo_showcase (user_id, slot, inventory_id)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, slot) DO UPDATE SET inventory_id = excluded.inventory_id
    `).bind(session.id, slot, inventoryId).run();

    return json({ success: true, message: 'Showcase updated' }, 200, request);
  }

  if (pathname === '/api/ygo/single/open' && request.method === 'POST') {
    const priceRow = await ygoDb.prepare(`SELECT value FROM ygo_settings WHERE key = 'single_card_price_coins' LIMIT 1`).first();
    const basePrice = Number(priceRow?.value || 125);
    const discountPercent = await getYgoDiscountPercent(env);
    const price = Math.max(1, Math.round(basePrice * ((100 - discountPercent) / 100)));
    const wallet = await getWallet(env, session.id);
    if (Number(wallet?.balance || 0) < price) {
      return json({ success: false, error: 'Not enough Grev Coins for a single-card pull.' }, 400, request);
    }
    const cards = await ygoDb.prepare(`SELECT * FROM ygo_cards`).all();
    const weighted = (cards.results || []).map((row) => ({ ...row, weight: normaliseDropWeight(row.drop_weight, YGO_RARITIES[row.rarity_code]?.pull_weight || 1) }));
    if (!weighted.length) return json({ success: false, error: 'No cards are configured yet.' }, 500, request);
    const pull = pickWeighted(weighted);
    const now = isoNow();
    const sellBack = calcSellBack(pull.estimated_price_coins, pull.rarity_code);
    await getCasesDb(env).prepare(`UPDATE case_profiles SET balance = balance - ?, updated_at = ? WHERE user_id = ?`).bind(price, now, session.id).run();
    await ygoDb.batch([
      ygoDb.prepare(`INSERT INTO ygo_inventory (user_id, pack_slug, card_id, card_name, rarity_code, foil_label, sell_back_coins, estimated_price_coins, image_url, acquired_at, source_pack_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`).bind(session.id, pull.pack_slug, pull.id, pull.card_name, pull.rarity_code, formatFoilLabel(pull.rarity_code), sellBack, Number(pull.estimated_price_coins || 0), pull.image_url || '', now),
      ygoDb.prepare(`UPDATE ygo_player_stats SET cards_owned = cards_owned + 1, updated_at = ? WHERE user_id = ?`).bind(now, session.id)
    ]);
    const profile = await buildProfilePayload(env, session);
    return json({ success: true, single_card_price_coins: price, pull: { ...pull, estimated_price_coins: Number(pull.estimated_price_coins || 0), sell_back_coins: sellBack, rarity_label: getYgoRarityMeta(pull.rarity_code).label, foil_label: formatFoilLabel(pull.rarity_code) }, profile }, 200, request);
  }

  if (pathname === '/api/ygo/open' && request.method === 'POST') {
    const body = await safeJson(request);
    const packSlug = String(body?.pack_slug || '').trim();
    const pack = await ygoDb.prepare(`SELECT * FROM ygo_pack_definitions WHERE slug = ? AND is_active = 1 LIMIT 1`).bind(packSlug).first();
    if (!pack) return json({ success: false, error: 'Pack not found' }, 404, request);

    const wallet = await getWallet(env, session.id);
    const basePrice = Number(pack.pack_price_coins || 0);
    const discountPercent = await getYgoDiscountPercent(env);
    const price = Math.max(1, Math.round(basePrice * ((100 - discountPercent) / 100)));
    if (Number(wallet?.balance || 0) < price) {
      return json({ success: false, error: 'Not enough Grev Coins for this pack.' }, 400, request);
    }

    const rareCards = await ygoDb.prepare(`SELECT * FROM ygo_cards WHERE pack_slug = ? AND rarity_code = 'rare'`).bind(packSlug).all();
    const otherCards = await ygoDb.prepare(`SELECT * FROM ygo_cards WHERE pack_slug = ? AND rarity_code != 'rare'`).bind(packSlug).all();
    const weightedRare = (rareCards.results || []).map((row) => ({ ...row, weight: normaliseDropWeight(row.drop_weight, 100) }));
    const weighted = (otherCards.results || []).map((row) => ({ ...row, weight: normaliseDropWeight(row.drop_weight, YGO_RARITIES[row.rarity_code]?.pull_weight || 1) }));
    if (!weightedRare.length || !weighted.length) {
      return json({ success: false, error: 'Pack pool is incomplete.' }, 500, request);
    }

    const now = isoNow();
    const openResult = await ygoDb.prepare(`
      INSERT INTO ygo_pack_open_history (user_id, pack_slug, pack_name, pack_price_coins, opened_at, total_estimated_value_coins)
      VALUES (?, ?, ?, ?, ?, 0)
    `).bind(session.id, pack.slug, pack.set_name, price, now).run();
    const packOpenId = Number(openResult.meta?.last_row_id || 0);

    const pulls = [];
    const guaranteed = pickWeighted(weightedRare);
    pulls.push(guaranteed);
    for (let i = 1; i < Number(pack.cards_per_pack || 5); i += 1) {
      pulls.push(pickWeighted(weighted));
    }

    let totalEstimated = 0;
    let ghostPulled = 0;
    for (const pull of pulls) {
      const estimated = Number(pull.estimated_price_coins || 0);
      const sellBack = calcSellBack(estimated, pull.rarity_code);
      totalEstimated += estimated;
      if (pull.rarity_code === 'ghost') ghostPulled += 1;
      await ygoDb.batch([
        ygoDb.prepare(`
          INSERT INTO ygo_pack_open_cards (
            pack_open_id, card_id, card_name, rarity_code, foil_label, estimated_price_coins, sell_back_coins, image_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(packOpenId, pull.id, pull.card_name, pull.rarity_code, formatFoilLabel(pull.rarity_code), estimated, sellBack, pull.image_url || ''),
        ygoDb.prepare(`
          INSERT INTO ygo_inventory (
            user_id, pack_slug, card_id, card_name, rarity_code, foil_label, sell_back_coins, estimated_price_coins, image_url, acquired_at, source_pack_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(session.id, pack.slug, pull.id, pull.card_name, pull.rarity_code, formatFoilLabel(pull.rarity_code), sellBack, estimated, pull.image_url || '', now, packOpenId)
      ]);
    }

    const lastOpenDateRow = await ygoDb.prepare(`SELECT last_opened_on, current_streak_days, best_streak_days FROM ygo_player_stats WHERE user_id = ? LIMIT 1`).bind(session.id).first();
    const today = todayIsoDate();
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    let nextStreak = 1;
    if (lastOpenDateRow?.last_opened_on === today) nextStreak = Number(lastOpenDateRow.current_streak_days || 1);
    else if (lastOpenDateRow?.last_opened_on === yesterday) nextStreak = Number(lastOpenDateRow.current_streak_days || 0) + 1;

    let bonusCoins = 0;
    const missionStates = await getMissionState(env, session.id);
    if (!missionStates[0].completed) bonusCoins += 90;
    if (Number(lastOpenDateRow?.current_streak_days || 0) < 3 && nextStreak >= 3) bonusCoins += 175;
    if (Number(lastOpenDateRow?.current_streak_days || 0) < 1) bonusCoins += Number(pack.streak_reward_coins || 0);

    await ygoDb.prepare(`UPDATE ygo_pack_open_history SET total_estimated_value_coins = ? WHERE id = ?`).bind(totalEstimated, packOpenId).run();
    await getCasesDb(env).prepare(`UPDATE case_profiles SET balance = balance - ? + ?, updated_at = ? WHERE user_id = ?`).bind(price, bonusCoins, now, session.id).run();
    await ygoDb.prepare(`
        UPDATE ygo_player_stats
        SET packs_opened = packs_opened + 1,
            total_spent_coins = total_spent_coins + ?,
            ghost_pulls = ghost_pulls + ?,
            current_streak_days = ?,
            best_streak_days = MAX(best_streak_days, ?),
            last_opened_on = ?,
            missions_completed = missions_completed + ?,
            updated_at = ?
        WHERE user_id = ?
      `).bind(price, ghostPulled, nextStreak, nextStreak, today, bonusCoins > 0 ? 1 : 0, now, session.id).run();

    const cardsOwned = await syncCardsOwned(env, session.id, isoNow);
    const unlocked = await evaluateAchievements(env, session.id, isoNow);
    const profile = await buildProfilePayload(env, session);

    return json({
      success: true,
      pack: { slug: pack.slug, set_name: pack.set_name, pack_price_coins: price, base_pack_price_coins: basePrice, active_discount_percent: discountPercent },
      bonus_coins_awarded: bonusCoins,
      achievements_unlocked: unlocked,
      cards_owned_after: cardsOwned,
      pulls: pulls.map((pull) => ({
        card_id: pull.id,
        card_name: pull.card_name,
        rarity_code: pull.rarity_code,
        rarity_label: getYgoRarityMeta(pull.rarity_code).label,
        foil_label: formatFoilLabel(pull.rarity_code),
        estimated_price_coins: Number(pull.estimated_price_coins || 0),
        sell_back_coins: calcSellBack(pull.estimated_price_coins, pull.rarity_code),
        image_url: pull.image_url || '',
        card_type: pull.card_type || '',
        attribute: pull.attribute || '',
        level_stars: Number(pull.level_stars || 0),
        attack_points: Number(pull.attack_points || 0),
        defense_points: Number(pull.defense_points || 0)
      })),
      profile
    }, 200, request);
  }

  if (pathname === '/api/ygo/sell' && request.method === 'POST') {
    const body = await safeJson(request);
    const inventoryId = Number(body?.inventory_id || 0);
    if (!Number.isInteger(inventoryId) || inventoryId <= 0) return json({ success: false, error: 'A valid inventory id is required.' }, 400, request);
    const item = await ygoDb.prepare(`SELECT * FROM ygo_inventory WHERE id = ? AND user_id = ? AND sold_at IS NULL LIMIT 1`).bind(inventoryId, session.id).first();
    if (!item) return json({ success: false, error: 'Card not found in your active collection.' }, 404, request);
    const now = isoNow();
    await ygoDb.prepare(`UPDATE ygo_inventory SET sold_at = ? WHERE id = ?`).bind(now, inventoryId).run();
    await getCasesDb(env).prepare(`UPDATE case_profiles SET balance = balance + ?, updated_at = ? WHERE user_id = ?`).bind(Number(item.sell_back_coins || 0), now, session.id).run();
    await ygoDb.prepare(`UPDATE ygo_player_stats SET total_sellback_coins = total_sellback_coins + ?, updated_at = ? WHERE user_id = ?`).bind(Number(item.sell_back_coins || 0), now, session.id).run();
    await syncCardsOwned(env, session.id, isoNow);
    const unlocked = await evaluateAchievements(env, session.id, isoNow);
    const profile = await buildProfilePayload(env, session);
    return json({ success: true, sold: item, achievements_unlocked: unlocked, profile }, 200, request);
  }

  return json({ success: false, error: 'Unknown YGO route' }, 404, request);
}
