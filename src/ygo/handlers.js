import { YGO_ACHIEVEMENTS, YGO_PACKS, YGO_RARITIES } from './data.js';
import { getYgoRarityMeta } from './schema.js';

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

async function ensurePlayer(env, session, isoNow) {
  const now = isoNow();
  await env.CASES_DB.prepare(`
    INSERT OR IGNORE INTO case_profiles (
      user_id, display_name, balance, total_cases_opened, total_spent, total_inventory_value, created_at, updated_at
    ) VALUES (?, ?, 500000, 0, 0, 0, ?, ?)
  `).bind(session.id, session.username, now, now).run();

  await env.CASES_DB.prepare(`
    INSERT OR IGNORE INTO ygo_player_stats (
      user_id, created_at, updated_at
    ) VALUES (?, ?, ?)
  `).bind(session.id, now, now).run();

  for (const achievement of YGO_ACHIEVEMENTS) {
    await env.CASES_DB.prepare(`
      INSERT OR IGNORE INTO ygo_achievement_progress (
        user_id, achievement_code, current_value, target_value, created_at, updated_at
      ) VALUES (?, ?, 0, ?, ?, ?)
    `).bind(session.id, achievement.code, achievement.target_value, now, now).run();
  }
}

async function getWallet(env, userId) {
  return await env.CASES_DB.prepare(`SELECT balance FROM case_profiles WHERE user_id = ? LIMIT 1`).bind(userId).first();
}

async function syncCardsOwned(env, userId, isoNow) {
  const row = await env.CASES_DB.prepare(`SELECT COUNT(*) AS c FROM ygo_inventory WHERE user_id = ? AND sold_at IS NULL`).bind(userId).first();
  await env.CASES_DB.prepare(`UPDATE ygo_player_stats SET cards_owned = ?, updated_at = ? WHERE user_id = ?`).bind(Number(row?.c || 0), isoNow(), userId).run();
  return Number(row?.c || 0);
}

async function evaluateAchievements(env, userId, isoNow) {
  const stats = await env.CASES_DB.prepare(`SELECT * FROM ygo_player_stats WHERE user_id = ? LIMIT 1`).bind(userId).first();
  if (!stats) return [];
  const unlocked = [];
  const metricMap = {
    packs_opened: Number(stats.packs_opened || 0),
    ghost_pulls: Number(stats.ghost_pulls || 0),
    cards_owned: Number(stats.cards_owned || 0)
  };

  for (const achievement of YGO_ACHIEVEMENTS) {
    const currentValue = Number(metricMap[achievement.metric_key] || 0);
    await env.CASES_DB.prepare(`
      UPDATE ygo_achievement_progress
      SET current_value = ?, updated_at = ?
      WHERE user_id = ? AND achievement_code = ?
    `).bind(currentValue, isoNow(), userId, achievement.code).run();

    const row = await env.CASES_DB.prepare(`
      SELECT * FROM ygo_achievement_progress
      WHERE user_id = ? AND achievement_code = ? LIMIT 1
    `).bind(userId, achievement.code).first();

    if (row && !row.claimed_at && currentValue >= Number(row.target_value || achievement.target_value)) {
      const now = isoNow();
      await env.CASES_DB.batch([
        env.CASES_DB.prepare(`UPDATE ygo_achievement_progress SET claimed_at = ?, updated_at = ? WHERE id = ?`).bind(now, now, row.id),
        env.CASES_DB.prepare(`UPDATE case_profiles SET balance = balance + ?, updated_at = ? WHERE user_id = ?`).bind(achievement.reward_coins, now, userId),
        env.CASES_DB.prepare(`UPDATE ygo_player_stats SET achievements_completed = achievements_completed + 1, updated_at = ? WHERE user_id = ?`).bind(now, userId)
      ]);
      unlocked.push({ ...achievement, claimed_at: now });
    }
  }

  return unlocked;
}

async function getMissionState(env, userId) {
  const stats = await env.CASES_DB.prepare(`SELECT packs_opened, current_streak_days, last_opened_on FROM ygo_player_stats WHERE user_id = ? LIMIT 1`).bind(userId).first();
  const packsOpened = Number(stats?.packs_opened || 0);
  const streak = Number(stats?.current_streak_days || 0);
  return [
    { code: 'daily_duelist', title: 'Daily Duelist', description: 'Open 1 pack today.', progress: stats?.last_opened_on === todayIsoDate() ? 1 : 0, target: 1, reward_coins: 90, completed: stats?.last_opened_on === todayIsoDate() },
    { code: 'pack_apprentice', title: 'Pack Apprentice', description: 'Open 3 packs total.', progress: Math.min(packsOpened, 3), target: 3, reward_coins: 140, completed: packsOpened >= 3 },
    { code: 'streak_keeper', title: 'Streak Keeper', description: 'Maintain a 3-day opening streak.', progress: Math.min(streak, 3), target: 3, reward_coins: 175, completed: streak >= 3 }
  ];
}

async function buildProfilePayload(env, session) {
  const wallet = await getWallet(env, session.id);
  const stats = await env.CASES_DB.prepare(`SELECT * FROM ygo_player_stats WHERE user_id = ? LIMIT 1`).bind(session.id).first();
  const inventory = await env.CASES_DB.prepare(`
    SELECT COUNT(*) AS count_cards,
           COALESCE(SUM(estimated_price_coins), 0) AS estimated_total,
           COALESCE(SUM(sell_back_coins), 0) AS sell_back_total
    FROM ygo_inventory
    WHERE user_id = ? AND sold_at IS NULL
  `).bind(session.id).first();
  const achievements = await env.CASES_DB.prepare(`SELECT achievement_code, current_value, target_value, claimed_at FROM ygo_achievement_progress WHERE user_id = ? ORDER BY achievement_code ASC`).bind(session.id).all();
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
  const { json, getApprovedUser, safeJson, isoNow } = deps;
  const url = new URL(request.url);
  const { pathname } = url;
  if (!pathname.startsWith('/api/ygo')) return null;
  if (!env.CASES_DB) return json({ success: false, error: 'CASES_DB is not configured' }, 500, request);

  if (pathname === '/api/ygo/packs' && request.method === 'GET') {
    const packs = await env.CASES_DB.prepare(`SELECT * FROM ygo_pack_definitions WHERE is_active = 1 ORDER BY pack_price_coins ASC`).all();
    const payload = [];
    for (const pack of packs.results || []) {
      const rarityBreakdown = Object.values(YGO_RARITIES)
        .filter((rarity) => rarity.code !== 'rare')
        .map((rarity) => ({ code: rarity.code, label: rarity.label, weight: rarity.pull_weight }));
      const totalWeight = rarityBreakdown.reduce((sum, item) => sum + item.weight, 0);
      const cards = await env.CASES_DB.prepare(`SELECT COUNT(*) AS c FROM ygo_cards WHERE pack_slug = ?`).bind(pack.slug).first();
      payload.push({
        slug: pack.slug,
        set_name: pack.set_name,
        ygoprodeck_set_id: pack.ygoprodeck_set_id,
        description: pack.description,
        pack_price_coins: Number(pack.pack_price_coins || 0),
        cards_per_pack: Number(pack.cards_per_pack || 5),
        guaranteed_rare_slot: pack.guaranteed_rare_slot,
        cover_card_name: pack.cover_card_name || '',
        cover_image_url: pack.cover_image_url || '',
        mission_reward_coins: Number(pack.mission_reward_coins || 0),
        streak_reward_coins: Number(pack.streak_reward_coins || 0),
        card_count: Number(cards?.c || 0),
        rarity_odds: [{ code: 'rare', label: 'Rare', guaranteed: true, chance_percent: 100 }].concat(
          rarityBreakdown.map((item) => ({ code: item.code, label: item.label, guaranteed: false, chance_percent: Number(((item.weight / totalWeight) * 100).toFixed(2)) }))
        )
      });
    }
    return json({ success: true, packs: payload }, 200, request);
  }

  const session = await getApprovedUser(request, env);
  if (session instanceof Response) return session;
  await ensurePlayer(env, session, isoNow);

  if (pathname === '/api/ygo/profile' && request.method === 'GET') {
    const profile = await buildProfilePayload(env, session);
    return json({ success: true, profile }, 200, request);
  }

  if (pathname === '/api/ygo/catalog' && request.method === 'GET') {
    const packSlug = (url.searchParams.get('pack_slug') || '').trim();
    const rarityCode = (url.searchParams.get('rarity') || '').trim();
    const rows = await env.CASES_DB.prepare(`SELECT * FROM ygo_cards ORDER BY estimated_price_coins DESC, card_name ASC`).all();
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
      source_url: row.source_url || ''
    }));
    return json({ success: true, cards: items }, 200, request);
  }

  if (pathname === '/api/ygo/inventory' && request.method === 'GET') {
    const rows = await env.CASES_DB.prepare(`SELECT * FROM ygo_inventory WHERE user_id = ? AND sold_at IS NULL ORDER BY id DESC`).bind(session.id).all();
    return json({ success: true, inventory: (rows.results || []).map((row) => ({ ...row })) }, 200, request);
  }

  if (pathname === '/api/ygo/open' && request.method === 'POST') {
    const body = await safeJson(request);
    const packSlug = String(body?.pack_slug || '').trim();
    const pack = await env.CASES_DB.prepare(`SELECT * FROM ygo_pack_definitions WHERE slug = ? AND is_active = 1 LIMIT 1`).bind(packSlug).first();
    if (!pack) return json({ success: false, error: 'Pack not found' }, 404, request);

    const wallet = await getWallet(env, session.id);
    const price = Number(pack.pack_price_coins || 0);
    if (Number(wallet?.balance || 0) < price) {
      return json({ success: false, error: 'Not enough Grev Coins for this pack.' }, 400, request);
    }

    const rareCards = await env.CASES_DB.prepare(`SELECT * FROM ygo_cards WHERE pack_slug = ? AND rarity_code = 'rare'`).bind(packSlug).all();
    const otherCards = await env.CASES_DB.prepare(`SELECT * FROM ygo_cards WHERE pack_slug = ? AND rarity_code != 'rare'`).bind(packSlug).all();
    const weighted = (otherCards.results || []).map((row) => ({ ...row, weight: Number(YGO_RARITIES[row.rarity_code]?.pull_weight || 1) }));
    if (!(rareCards.results || []).length || !weighted.length) {
      return json({ success: false, error: 'Pack pool is incomplete.' }, 500, request);
    }

    const now = isoNow();
    const openResult = await env.CASES_DB.prepare(`
      INSERT INTO ygo_pack_open_history (user_id, pack_slug, pack_name, pack_price_coins, opened_at, total_estimated_value_coins)
      VALUES (?, ?, ?, ?, ?, 0)
    `).bind(session.id, pack.slug, pack.set_name, price, now).run();
    const packOpenId = Number(openResult.meta?.last_row_id || 0);

    const pulls = [];
    const guaranteed = rareCards.results[Math.floor(Math.random() * rareCards.results.length)];
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
      await env.CASES_DB.batch([
        env.CASES_DB.prepare(`
          INSERT INTO ygo_pack_open_cards (
            pack_open_id, card_id, card_name, rarity_code, foil_label, estimated_price_coins, sell_back_coins, image_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(packOpenId, pull.id, pull.card_name, pull.rarity_code, formatFoilLabel(pull.rarity_code), estimated, sellBack, pull.image_url || ''),
        env.CASES_DB.prepare(`
          INSERT INTO ygo_inventory (
            user_id, pack_slug, card_id, card_name, rarity_code, foil_label, sell_back_coins, estimated_price_coins, image_url, acquired_at, source_pack_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(session.id, pack.slug, pull.id, pull.card_name, pull.rarity_code, formatFoilLabel(pull.rarity_code), sellBack, estimated, pull.image_url || '', now, packOpenId)
      ]);
    }

    const lastOpenDateRow = await env.CASES_DB.prepare(`SELECT last_opened_on, current_streak_days, best_streak_days FROM ygo_player_stats WHERE user_id = ? LIMIT 1`).bind(session.id).first();
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

    await env.CASES_DB.batch([
      env.CASES_DB.prepare(`UPDATE ygo_pack_open_history SET total_estimated_value_coins = ? WHERE id = ?`).bind(totalEstimated, packOpenId),
      env.CASES_DB.prepare(`UPDATE case_profiles SET balance = balance - ? + ?, updated_at = ? WHERE user_id = ?`).bind(price, bonusCoins, now, session.id),
      env.CASES_DB.prepare(`
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
      `).bind(price, ghostPulled, nextStreak, nextStreak, today, bonusCoins > 0 ? 1 : 0, now, session.id)
    ]);

    const cardsOwned = await syncCardsOwned(env, session.id, isoNow);
    const unlocked = await evaluateAchievements(env, session.id, isoNow);
    const profile = await buildProfilePayload(env, session);

    return json({
      success: true,
      pack: { slug: pack.slug, set_name: pack.set_name, pack_price_coins: price },
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
    const item = await env.CASES_DB.prepare(`SELECT * FROM ygo_inventory WHERE id = ? AND user_id = ? AND sold_at IS NULL LIMIT 1`).bind(inventoryId, session.id).first();
    if (!item) return json({ success: false, error: 'Card not found in your active collection.' }, 404, request);
    const now = isoNow();
    await env.CASES_DB.batch([
      env.CASES_DB.prepare(`UPDATE ygo_inventory SET sold_at = ? WHERE id = ?`).bind(now, inventoryId),
      env.CASES_DB.prepare(`UPDATE case_profiles SET balance = balance + ?, updated_at = ? WHERE user_id = ?`).bind(Number(item.sell_back_coins || 0), now, session.id),
      env.CASES_DB.prepare(`UPDATE ygo_player_stats SET total_sellback_coins = total_sellback_coins + ?, updated_at = ? WHERE user_id = ?`).bind(Number(item.sell_back_coins || 0), now, session.id)
    ]);
    await syncCardsOwned(env, session.id, isoNow);
    const unlocked = await evaluateAchievements(env, session.id, isoNow);
    const profile = await buildProfilePayload(env, session);
    return json({ success: true, sold: item, achievements_unlocked: unlocked, profile }, 200, request);
  }

  return json({ success: false, error: 'Unknown YGO route' }, 404, request);
}
