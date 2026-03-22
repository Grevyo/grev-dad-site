import { KEY_PRICE_PENCE, STARTING_BALANCE_PENCE } from "./constants.js";
import { getQuickSellFeePercent, quickSellPayoutFromMarket } from "./quick-sell.js";
import { getOrCreateResolvedSkinItem } from "./skin-resolve.js";
import { fetchSteamIconUrl, getCachedItemPricePence, getOrFetchItemPricePence } from "./steam.js";
import { pickWearTier } from "./wear.js";
import { importPriceEmpireCatalog } from "./pricempire.js";
import { importMasterCatalog } from "./master-import.js";

function pickWeighted(rows) {
  const list = (rows || []).filter((r) => Number(r.drop_weight) > 0);
  if (!list.length) return null;

  const total = list.reduce((sum, r) => sum + Number(r.drop_weight || 0), 0);
  let roll = Math.random() * total;

  for (const row of list) {
    roll -= Number(row.drop_weight || 0);
    if (roll <= 0) return row;
  }

  return list[list.length - 1];
}

async function ensureUserCaseProfileById(env, userId, username, isoNowFn) {
  const now = isoNowFn();

  await env.CASES_DB.prepare(`
    INSERT OR IGNORE INTO case_profiles (
      user_id,
      display_name,
      balance,
      total_cases_opened,
      total_spent,
      total_inventory_value,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, 0, 0, 0, ?, ?)
  `).bind(userId, username, STARTING_BALANCE_PENCE, now, now).run();
}

async function resolveUsernames(env, userIds) {
  const ids = [...new Set((userIds || []).filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length || !env.DB) return new Map();

  const placeholders = ids.map(() => "?").join(",");
  const rows = await env.DB.prepare(`
    SELECT id, username
    FROM users
    WHERE id IN (${placeholders})
  `).bind(...ids).all();

  const map = new Map();
  for (const row of rows.results || []) {
    map.set(Number(row.id), String(row.username || ""));
  }
  return map;
}

async function refreshInventoryValue(env, userId) {
  const rows = await env.CASES_DB.prepare(`
    SELECT ci.market_hash_name, ci.market_value
    FROM inventory i
    INNER JOIN case_items ci ON ci.id = i.item_id
    WHERE i.user_id = ? AND ci.item_kind = 'skin'
  `).bind(userId).all();

  let total = 0;
  for (const r of rows.results || []) {
    const hash = r.market_hash_name;
    let pence = await getOrFetchItemPricePence(env, hash);
    if (pence == null || pence <= 0) {
      pence = Number(r.market_value || 0);
    }
    total += pence;
  }

  await env.CASES_DB.prepare(`
    UPDATE case_profiles
    SET total_inventory_value = ?, updated_at = ?
    WHERE user_id = ?
  `).bind(total, new Date().toISOString(), userId).run();

  return total;
}

async function ensureCaseProfile(env, session, isoNowFn) {
  await ensureUserCaseProfileById(env, session.id, session.username, isoNowFn);
}

async function createSkinInstance(env, { resolvedItemId, marketHashName, ownerUserId, caseId, pendingDropId, createdAt }) {
  const now = createdAt || new Date().toISOString();
  const result = await env.CASES_DB.prepare(`
    INSERT INTO skin_instances (
      resolved_item_id,
      market_hash_name,
      original_owner_user_id,
      current_owner_user_id,
      source_case_id,
      source_pending_drop_id,
      status,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).bind(resolvedItemId, marketHashName, ownerUserId, ownerUserId, caseId, pendingDropId || null, now, now).run();
  return Number(result.meta?.last_row_id || 0);
}

async function pushToGraveyard(env, payload) {
  await env.CASES_DB.prepare(`
    INSERT INTO quick_sell_graveyard (
      skin_instance_id,
      user_id,
      resolved_item_id,
      source_type,
      source_pending_drop_id,
      source_inventory_id,
      payout_pence,
      market_reference_pence,
      fee_percent,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    payload.skinInstanceId,
    payload.userId,
    payload.resolvedItemId,
    payload.sourceType,
    payload.sourcePendingDropId || null,
    payload.sourceInventoryId || null,
    payload.payoutPence,
    payload.marketReferencePence,
    payload.feePercent,
    payload.createdAt
  ).run();
}

function caseRefundPayout(pence) {
  const n = Number(pence || 0);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

function keyRefundPayout(quantity, unitPricePence = KEY_PRICE_PENCE) {
  const qty = Number(quantity || 0);
  return Number.isInteger(qty) && qty > 0 ? qty * unitPricePence : 0;
}



async function ensureCaseImageUrl(env, caseRow, options = {}) {
  const { allowLiveFetch = true } = options;
  if (!caseRow) return "";
  const existing = String(caseRow.image_url || "").trim();
  if (existing) return existing;
  if (!allowLiveFetch) return "";

  const hash = String(caseRow.steam_market_hash_name || caseRow.case_name || "").trim();
  if (!hash) return "";

  const imageUrl = await fetchSteamIconUrl(hash);
  if (!imageUrl) return "";

  if (caseRow.id) {
    await env.CASES_DB.prepare(`
      UPDATE case_definitions
      SET image_url = ?
      WHERE id = ?
    `).bind(imageUrl, caseRow.id).run();
  }

  caseRow.image_url = imageUrl;
  return imageUrl;
}

async function ensureItemImageUrl(env, itemRow, options = {}) {
  const { allowLiveFetch = true } = options;
  if (!itemRow) return "";
  const existing = String(itemRow.image_url || "").trim();
  if (existing) return existing;
  if (!allowLiveFetch) return "";

  const hash = String(itemRow.market_hash_name || itemRow.item_name || "").trim();
  if (!hash) return "";

  const imageUrl = await fetchSteamIconUrl(hash);
  if (!imageUrl) return "";

  if (itemRow.id) {
    await env.CASES_DB.prepare(`
      UPDATE case_items
      SET image_url = ?
      WHERE id = ?
    `).bind(imageUrl, itemRow.id).run();
  }

  itemRow.image_url = imageUrl;
  return imageUrl;
}

async function getOwnerCountsByItemId(env, itemIds) {
  const ids = [...new Set((itemIds || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  const map = new Map();
  if (!ids.length) return map;
  const placeholders = ids.map(() => '?').join(',');
  const rows = await env.CASES_DB.prepare(`
    SELECT resolved_item_id, COUNT(*) AS c
    FROM skin_instances
    WHERE status = 'inventory' AND resolved_item_id IN (${placeholders})
    GROUP BY resolved_item_id
  `).bind(...ids).all();
  for (const row of rows.results || []) {
    map.set(Number(row.resolved_item_id), Number(row.c || 0));
  }
  return map;
}

async function upsertImageReport(env, payload) {
  const existing = await env.CASES_DB.prepare(`
    SELECT id FROM cs2_image_reports
    WHERE item_type = ? AND target_id = ? AND status = 'open'
    LIMIT 1
  `).bind(payload.itemType, payload.targetId).first();
  const now = payload.now;
  if (existing?.id) {
    await env.CASES_DB.prepare(`
      UPDATE cs2_image_reports
      SET report_reason = ?, current_image_url = ?, market_hash_name = ?, updated_at = ?
      WHERE id = ?
    `).bind(payload.reason || '', payload.currentImageUrl || '', payload.marketHashName || '', now, existing.id).run();
    return Number(existing.id);
  }
  const result = await env.CASES_DB.prepare(`
    INSERT INTO cs2_image_reports (
      item_type, target_id, target_name, market_hash_name, current_image_url,
      report_reason, status, reported_by_user_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)
  `).bind(
    payload.itemType,
    payload.targetId,
    payload.targetName,
    payload.marketHashName || '',
    payload.currentImageUrl || '',
    payload.reason || '',
    payload.reportedByUserId,
    now,
    now
  ).run();
  return Number(result.meta?.last_row_id || 0);
}

async function buildCaseDropPreview(env, caseId) {

  const rows = await env.CASES_DB.prepare(`
    SELECT ci.item_name, ci.rarity, ci.color_hex, ci.image_url, ci.market_hash_name, cd.drop_weight
    FROM case_drops cd
    INNER JOIN case_items ci ON ci.id = cd.item_id
    WHERE cd.case_id = ? AND cd.drop_weight > 0
    ORDER BY cd.drop_weight DESC, ci.item_name ASC
  `).bind(caseId).all();

  const list = rows.results || [];
  const totalWeight = list.reduce((sum, row) => sum + Number(row.drop_weight || 0), 0);
  const preview = [];
  for (const row of list) {
    preview.push({
      item_name: row.item_name,
      rarity: row.rarity || "",
      color_hex: row.color_hex || "",
      image_url: row.image_url || "",
      market_hash_name: row.market_hash_name || row.item_name || "",
      chance_percent: totalWeight > 0 ? Number((((Number(row.drop_weight || 0) / totalWeight) * 100)).toFixed(3)) : 0
    });
  }
  return preview;
}

async function formatCaseSummary(env, caseRow, options = {}) {
  const storePrice = await getCaseStorePricePence(env, caseRow, options);
  const imageUrl = await ensureCaseImageUrl(env, caseRow, options);
  return {
    id: caseRow.id,
    case_name: caseRow.case_name,
    slug: caseRow.slug,
    image_url: imageUrl,
    description: caseRow.description || "",
    store_price_pence: storePrice,
    fallback_price_pence: Number(caseRow.fallback_price_pence || caseRow.price || 0),
    steam_market_hash_name: caseRow.steam_market_hash_name || caseRow.case_name || "",
    key_price_pence: KEY_PRICE_PENCE,
    is_active: Boolean(caseRow.is_active),
    preview_drops: await buildCaseDropPreview(env, caseRow.id)
  };
}

async function buildAdminCasePayload(env, caseRow, options = {}) {
  const summary = await formatCaseSummary(env, caseRow, options);
  const dropStats = await env.CASES_DB.prepare(`
    SELECT COUNT(*) AS drop_count, COALESCE(SUM(drop_weight), 0) AS total_weight
    FROM case_drops
    WHERE case_id = ?
  `).bind(caseRow.id).first();

  return {
    ...summary,
    price: Number(caseRow.price || caseRow.fallback_price_pence || 0),
    drop_count: Number(dropStats?.drop_count || 0),
    total_drop_weight: Number(dropStats?.total_weight || 0)
  };
}

async function getCaseStorePricePence(env, caseRow, options = {}) {
  const { allowLiveFetch = true } = options;
  const hash = caseRow.steam_market_hash_name || caseRow.case_name;
  const live = allowLiveFetch
    ? await getOrFetchItemPricePence(env, hash)
    : await getCachedItemPricePence(env, hash);
  if (live != null && live > 0) return live;
  return Number(caseRow.fallback_price_pence || caseRow.price || 0);
}

/**
 * Opens one unowned case row: consumes one key from key_balance (not balance).
 * @returns {{ success: true, data: object } | { success: false, error: string, status?: number }}
 */
async function executeCaseOpen(env, session, isoNow, inventoryId) {
  const inv = await env.CASES_DB.prepare(`
      SELECT i.*, ci.item_kind, ci.case_def_id, cd.id AS case_def_pk, cd.case_name
      FROM inventory i
      INNER JOIN case_items ci ON ci.id = i.item_id
      INNER JOIN case_definitions cd ON cd.id = ci.case_def_id
      WHERE i.id = ? AND i.user_id = ?
      LIMIT 1
    `)
    .bind(inventoryId, session.id)
    .first();

  if (!inv || inv.item_kind !== "case") {
    return { success: false, error: "That inventory item is not an unopened case", status: 400 };
  }

  const profile = await env.CASES_DB.prepare(`
      SELECT key_balance FROM case_profiles WHERE user_id = ? LIMIT 1
    `)
    .bind(session.id)
    .first();

  const keys = Number(profile?.key_balance || 0);
  if (keys < 1) {
    return {
      success: false,
      error: "You do not have enough keys! Buy more in the store before opening this case.",
      status: 400
    };
  }

  const caseId = Number(inv.case_def_pk);
  const drops = await env.CASES_DB.prepare(`
      SELECT
        cd.item_id,
        cd.drop_weight,
        ci.item_kind,
        ci.item_name,
        ci.weapon_name,
        ci.skin_name,
        ci.rarity,
        ci.color_hex,
        ci.image_url,
        ci.market_value
      FROM case_drops cd
      INNER JOIN case_items ci ON ci.id = cd.item_id
      WHERE cd.case_id = ? AND cd.drop_weight > 0
        AND ci.item_kind IN ('skin', 'skin_template')
    `)
    .bind(caseId)
    .all();

  const picked = pickWeighted(drops.results || []);
  if (!picked) {
    return {
      success: false,
      error: "No drops configured for this case — run /api/setup on a fresh CASES_DB",
      status: 500
    };
  }

  const now = isoNow();
  const stamp = now;

  let resolvedItemId;
  let droppedRow;

  if (picked.item_kind === "skin_template") {
    const tier = pickWearTier();
    resolvedItemId = await getOrCreateResolvedSkinItem(env, picked, tier, now);
    droppedRow = await env.CASES_DB.prepare(`SELECT * FROM case_items WHERE id = ? LIMIT 1`)
      .bind(resolvedItemId)
      .first();
  } else {
    resolvedItemId = Number(picked.item_id);
    droppedRow = await env.CASES_DB.prepare(`SELECT * FROM case_items WHERE id = ? LIMIT 1`)
      .bind(resolvedItemId)
      .first();
  }

  if (!droppedRow) {
    return { success: false, error: "Could not resolve drop item", status: 500 };
  }

  let marketPrice = await getOrFetchItemPricePence(env, droppedRow.market_hash_name || droppedRow.item_name);
  if (marketPrice == null || marketPrice <= 0) {
    marketPrice = Number(droppedRow.market_value || 0);
  }
  const feePct = await getQuickSellFeePercent(env);
  const quickSellPayout = quickSellPayoutFromMarket(marketPrice, feePct);

  const pendingIns = await env.CASES_DB.prepare(`
      INSERT INTO pending_drops (
        user_id,
        case_id,
        resolved_item_id,
        key_paid,
        created_at,
        status,
        quick_sell_payout_pence,
        market_reference_pence
      )
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
    `)
    .bind(session.id, caseId, resolvedItemId, KEY_PRICE_PENCE, now, quickSellPayout, marketPrice)
    .run();

  const pendingDropId = Number(pendingIns.meta?.last_row_id || 0);
  const skinInstanceId = await createSkinInstance(env, {
    resolvedItemId,
    marketHashName: droppedRow.market_hash_name || droppedRow.item_name || "",
    ownerUserId: session.id,
    caseId,
    pendingDropId,
    createdAt: now
  });

  await env.CASES_DB.batch([
    env.CASES_DB.prepare(`UPDATE pending_drops SET skin_instance_id = ? WHERE id = ?`).bind(skinInstanceId, pendingDropId),
    env.CASES_DB.prepare(`DELETE FROM inventory WHERE id = ?`).bind(inventoryId),
    env.CASES_DB.prepare(`
        UPDATE case_profiles
        SET
          key_balance = key_balance - 1,
          total_cases_opened = total_cases_opened + 1,
          updated_at = ?
        WHERE user_id = ?
      `)
      .bind(stamp, session.id)
  ]);

  await refreshInventoryValue(env, session.id);

  const updated = await env.CASES_DB.prepare(`SELECT balance, key_balance FROM case_profiles WHERE user_id = ? LIMIT 1`)
    .bind(session.id)
    .first();

  return {
    success: true,
    data: {
      message: "Case opened — claim the drop to add it to your inventory",
      pending_drop_id: pendingDropId,
      dropped: {
        item_id: resolvedItemId,
        item_name: droppedRow.item_name,
        rarity: droppedRow.rarity,
        wear: droppedRow.wear || "",
        wear_code: droppedRow.wear_code || "",
        color_hex: droppedRow.color_hex || "",
        image_url: await ensureItemImageUrl(env, droppedRow),
        market_hash_name: droppedRow.market_hash_name || "",
        live_price_pence: marketPrice,
        quick_sell_payout_pence: quickSellPayout,
        skin_instance_id: skinInstanceId
      },
      case_name: inv.case_name,
      key_price_pence: KEY_PRICE_PENCE,
      quick_sell_fee_percent: feePct,
      balance_after_pence: Number(updated?.balance || 0),
      key_balance: Number(updated?.key_balance || 0)
    }
  };
}

export async function handleCs2Request(request, env, deps) {
  const { json, getApprovedUser, requireGamblingAdmin, isoNow, safeJson } = deps;
  const url = new URL(request.url);
  const { pathname } = url;

  if (!env.CASES_DB) {
    if (pathname.startsWith("/api/cs2")) {
      return json({ success: false, error: "CASES_DB is not configured" }, 500, request);
    }
    return null;
  }

  /* ------------------------------ Public cases ----------------------------- */
  if (pathname === "/api/cs2/cases" && request.method === "GET") {
    const rows = await env.CASES_DB.prepare(`
      SELECT id, case_name, slug, image_url, price, description, is_active, steam_market_hash_name, fallback_price_pence
      FROM case_definitions
      ORDER BY case_name ASC
    `).all();

    const cases = [];
    for (const row of rows.results || []) {
      if (!Number(row.is_active)) continue;
      cases.push(await formatCaseSummary(env, row, { allowLiveFetch: false }));
    }

    const feePct = await getQuickSellFeePercent(env);
    return json(
      {
        success: true,
        cases,
        key_price_pence: KEY_PRICE_PENCE,
        quick_sell_fee_percent: feePct
      },
      200,
      request
    );
  }

  /* ------------------------------ Feeds ----------------------------------- */
  if (pathname === "/api/cs2/feed/opens" && request.method === "GET") {
    const limit = Math.min(Number(url.searchParams.get("limit") || 40), 120);
    const rows = await env.CASES_DB.prepare(`
      SELECT h.id, h.user_id, h.case_id, h.item_id, h.price_paid, h.opened_at,
             c.case_name,
             i.item_name,
             i.rarity,
             i.color_hex,
             i.image_url,
             i.wear,
             i.wear_code
      FROM case_open_history h
      INNER JOIN case_definitions c ON c.id = h.case_id
      INNER JOIN case_items i ON i.id = h.item_id
      ORDER BY h.id DESC
      LIMIT ?
    `).bind(limit).all();

    const userIds = (rows.results || []).map((r) => Number(r.user_id));
    const names = await resolveUsernames(env, userIds);

    const feed = (rows.results || []).map((r) => ({
      id: r.id,
      user_id: r.user_id,
      username: names.get(Number(r.user_id)) || `user#${r.user_id}`,
      case_name: r.case_name,
      item_name: r.item_name,
      rarity: r.rarity,
      color_hex: r.color_hex || "",
      image_url: r.image_url || "",
      wear: r.wear || "",
      wear_code: r.wear_code || "",
      key_price_pence: KEY_PRICE_PENCE,
      price_paid_pence: Number(r.price_paid || 0),
      opened_at: r.opened_at
    }));

    return json({ success: true, opens: feed }, 200, request);
  }

  if (pathname === "/api/cs2/feed/trades" && request.method === "GET") {
    const limit = Math.min(Number(url.searchParams.get("limit") || 40), 120);
    const rows = await env.CASES_DB.prepare(`
      SELECT id, buyer_user_id, seller_user_id, item_name, price_pence, trade_type, created_at
      FROM trade_history
      ORDER BY id DESC
      LIMIT ?
    `).bind(limit).all();

    const userIds = [];
    for (const r of rows.results || []) {
      if (r.buyer_user_id) userIds.push(Number(r.buyer_user_id));
      if (r.seller_user_id) userIds.push(Number(r.seller_user_id));
    }
    const names = await resolveUsernames(env, userIds);

    const feed = (rows.results || []).map((r) => ({
      id: r.id,
      buyer: r.buyer_user_id ? `${names.get(Number(r.buyer_user_id)) || `user#${r.buyer_user_id}`}` : "—",
      seller: r.seller_user_id ? `${names.get(Number(r.seller_user_id)) || `user#${r.seller_user_id}`}` : "Market",
      price_pence: Number(r.price_pence || 0),
      item_name: r.item_name,
      trade_type: r.trade_type,
      created_at: r.created_at
    }));

    return json({ success: true, trades: feed }, 200, request);
  }

  if (pathname === "/api/cs2/trades/search" && request.method === "GET") {
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const limit = Math.min(Number(url.searchParams.get("limit") || 80), 200);
    const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);

    const rows = await env.CASES_DB.prepare(`
      SELECT id, buyer_user_id, seller_user_id, item_name, price_pence, trade_type, created_at
      FROM trade_history
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    let results = rows.results || [];
    if (q) {
      results = results.filter((row) => String(row.item_name || "").toLowerCase().includes(q));
    }

    const userIds = [];
    for (const r of results) {
      if (r.buyer_user_id) userIds.push(Number(r.buyer_user_id));
      if (r.seller_user_id) userIds.push(Number(r.seller_user_id));
    }
    const names = await resolveUsernames(env, userIds);

    const trades = results.map((r) => ({
      id: r.id,
      buyer: r.buyer_user_id ? `${names.get(Number(r.buyer_user_id)) || `user#${r.buyer_user_id}`}` : "—",
      seller: r.seller_user_id ? `${names.get(Number(r.seller_user_id)) || `user#${r.seller_user_id}`}` : "Market",
      price_pence: Number(r.price_pence || 0),
      item_name: r.item_name,
      trade_type: r.trade_type,
      created_at: r.created_at
    }));

    return json({ success: true, trades: trades, query: q }, 200, request);
  }

  if (pathname === "/api/cs2/catalog" && request.method === "GET") {
    const limit = Math.min(Number(url.searchParams.get("limit") || 100), 400);
    const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const weapon = (url.searchParams.get("weapon") || "").trim().toLowerCase();
    const rarity = (url.searchParams.get("rarity") || "").trim().toLowerCase();
    const wearCode = (url.searchParams.get("wear_code") || "").trim().toUpperCase();
    const minPrice = Number(url.searchParams.get("min_price_pence") || 0);
    const maxPrice = Number(url.searchParams.get("max_price_pence") || 0);

    const rows = await env.CASES_DB.prepare(`
      SELECT
        id,
        item_name,
        weapon_name,
        skin_name,
        rarity,
        wear,
        wear_code,
        market_hash_name,
        market_value,
        image_url,
        color_hex
      FROM case_items
      WHERE item_kind = 'skin'
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    let list = rows.results || [];
    if (q) {
      list = list.filter((r) => {
        const haystack = `${r.item_name || ''} ${r.weapon_name || ''} ${r.skin_name || ''}`.toLowerCase();
        return haystack.includes(q);
      });
    }
    if (weapon) {
      list = list.filter((r) => String(r.weapon_name || '').toLowerCase().includes(weapon));
    }
    if (rarity) {
      list = list.filter((r) => String(r.rarity || '').toLowerCase().includes(rarity));
    }
    if (wearCode) {
      list = list.filter((r) => String(r.wear_code || '').toUpperCase() === wearCode);
    }

    const ownerCounts = await getOwnerCountsByItemId(env, list.map((r) => r.id));
    const items = [];
    for (const r of list) {
      let live = await getCachedItemPricePence(env, r.market_hash_name);
      if (live == null || live <= 0) live = Number(r.market_value || 0);
      if (Number.isFinite(minPrice) && minPrice > 0 && live < minPrice) continue;
      if (Number.isFinite(maxPrice) && maxPrice > 0 && live > maxPrice) continue;
      items.push({
        id: r.id,
        item_name: r.item_name,
        weapon_name: r.weapon_name,
        skin_name: r.skin_name,
        rarity: r.rarity,
        wear: r.wear,
        wear_code: r.wear_code || '',
        market_hash_name: r.market_hash_name,
        image_url: await ensureItemImageUrl(env, r, { allowLiveFetch: false }),
        color_hex: r.color_hex || '',
        fallback_value_pence: Number(r.market_value || 0),
        live_price_pence: live,
        owner_count: ownerCounts.get(Number(r.id)) || 0
      });
    }

    return json({ success: true, items }, 200, request);
  }

  if (pathname === "/api/cs2/catalog/detail" && request.method === "GET") {
    const itemId = Number(url.searchParams.get("item_id") || 0);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return json({ success: false, error: "A valid item_id is required" }, 400, request);
    }
    const row = await env.CASES_DB.prepare(`
      SELECT id, item_name, rarity, wear, wear_code, market_hash_name, market_value, image_url, color_hex
      FROM case_items
      WHERE id = ? AND item_kind = 'skin'
      LIMIT 1
    `).bind(itemId).first();
    if (!row) return json({ success: false, error: "Skin not found" }, 404, request);

    let live = await getCachedItemPricePence(env, row.market_hash_name);
    if (live == null || live <= 0) live = Number(row.market_value || 0);
    const owners = await env.CASES_DB.prepare(`
      SELECT DISTINCT si.current_owner_user_id AS user_id
      FROM skin_instances si
      WHERE si.resolved_item_id = ? AND si.status = 'inventory' AND si.current_owner_user_id IS NOT NULL
      ORDER BY si.id DESC
      LIMIT 20
    `).bind(itemId).all();
    const ownerIds = (owners.results || []).map((r) => Number(r.user_id));
    const names = await resolveUsernames(env, ownerIds);
    const history = await env.CASES_DB.prepare(`
      SELECT price_pence, bucket_started_at
      FROM market_price_history
      WHERE market_hash_name = ?
      ORDER BY bucket_started_at DESC
      LIMIT 14
    `).bind(row.market_hash_name).all();
    return json({
      success: true,
      item: {
        id: row.id,
        item_name: row.item_name,
        rarity: row.rarity,
        wear: row.wear,
        wear_code: row.wear_code || "",
        market_hash_name: row.market_hash_name,
        image_url: await ensureItemImageUrl(env, row, { allowLiveFetch: false }),
        color_hex: row.color_hex || "",
        fallback_value_pence: Number(row.market_value || 0),
        live_price_pence: live
      },
      owners: ownerIds.map((id) => ({ user_id: id, username: names.get(id) || `user#${id}` })),
      price_history: (history.results || []).reverse().map((r) => ({
        price_pence: Number(r.price_pence || 0),
        bucket_started_at: r.bucket_started_at
      }))
    }, 200, request);
  }

  if (pathname === "/api/cs2/report-image" && request.method === "POST") {
    const session = await getApprovedUser(request, env);
    if (session instanceof Response) return session;

    const body = await safeJson(request);
    const itemType = String(body?.item_type || '').trim().toLowerCase();
    const targetId = Number(body?.target_id);
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
    if (!["skin", "case"].includes(itemType)) {
      return json({ success: false, error: "item_type must be skin or case" }, 400, request);
    }
    if (!Number.isInteger(targetId) || targetId <= 0) {
      return json({ success: false, error: "A valid target_id is required" }, 400, request);
    }

    const row = itemType === 'skin'
      ? await env.CASES_DB.prepare(`SELECT id, item_name AS target_name, market_hash_name, image_url FROM case_items WHERE id = ? LIMIT 1`).bind(targetId).first()
      : await env.CASES_DB.prepare(`SELECT id, case_name AS target_name, steam_market_hash_name AS market_hash_name, image_url FROM case_definitions WHERE id = ? LIMIT 1`).bind(targetId).first();
    if (!row) return json({ success: false, error: `${itemType} not found` }, 404, request);

    const reportId = await upsertImageReport(env, {
      itemType,
      targetId,
      targetName: row.target_name,
      marketHashName: row.market_hash_name || '',
      currentImageUrl: row.image_url || '',
      reason,
      reportedByUserId: session.id,
      now: isoNow()
    });

    return json({ success: true, report_id: reportId, message: 'Image report submitted.' }, 200, request);
  }

  if (pathname === "/api/cs2/admin/image-reports" && request.method === "GET") {
    const admin = await requireGamblingAdmin(request, env);
    if (admin instanceof Response) return admin;
    const rows = await env.CASES_DB.prepare(`
      SELECT * FROM cs2_image_reports
      ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END, id DESC
      LIMIT 250
    `).all();
    return json({ success: true, reports: rows.results || [] }, 200, request);
  }

  if (pathname === "/api/cs2/admin/image/update" && request.method === "POST") {
    const admin = await requireGamblingAdmin(request, env);
    if (admin instanceof Response) return admin;
    const body = await safeJson(request);
    const itemType = String(body?.item_type || '').trim().toLowerCase();
    const targetId = Number(body?.target_id);
    const imageUrl = typeof body?.image_url === 'string' ? body.image_url.trim() : '';
    const reportId = Number(body?.report_id || 0);
    if (!["skin", "case"].includes(itemType) || !Number.isInteger(targetId) || targetId <= 0) {
      return json({ success: false, error: 'Valid item_type and target_id are required.' }, 400, request);
    }
    let resolvedUrl = imageUrl;
    if (!resolvedUrl) {
      const source = itemType === 'skin'
        ? await env.CASES_DB.prepare(`SELECT market_hash_name, item_name FROM case_items WHERE id = ? LIMIT 1`).bind(targetId).first()
        : await env.CASES_DB.prepare(`SELECT steam_market_hash_name AS market_hash_name, case_name AS item_name FROM case_definitions WHERE id = ? LIMIT 1`).bind(targetId).first();
      resolvedUrl = await fetchSteamIconUrl(source?.market_hash_name || source?.item_name || '');
    }
    if (!resolvedUrl) return json({ success: false, error: 'Could not resolve a replacement image.' }, 400, request);

    if (itemType === 'skin') {
      await env.CASES_DB.prepare(`UPDATE case_items SET image_url = ? WHERE id = ?`).bind(resolvedUrl, targetId).run();
    } else {
      await env.CASES_DB.prepare(`UPDATE case_definitions SET image_url = ? WHERE id = ?`).bind(resolvedUrl, targetId).run();
      await env.CASES_DB.prepare(`UPDATE case_items SET image_url = ? WHERE case_def_id = ? AND item_kind = 'case'`).bind(resolvedUrl, targetId).run();
    }
    if (reportId > 0) {
      await env.CASES_DB.prepare(`UPDATE cs2_image_reports SET status = 'resolved', resolved_at = ?, resolved_by_user_id = ?, updated_at = ? WHERE id = ?`).bind(isoNow(), admin.id, isoNow(), reportId).run();
    }
    return json({ success: true, image_url: resolvedUrl, message: 'Image updated.' }, 200, request);
  }

  if (pathname === "/api/cs2/admin/image/refresh" && request.method === "POST") {
    const admin = await requireGamblingAdmin(request, env);
    if (admin instanceof Response) return admin;
    const body = await safeJson(request);
    const itemType = String(body?.item_type || '').trim().toLowerCase();
    const onlyReported = body?.only_reported !== false;
    if (!["skin", "case"].includes(itemType)) {
      return json({ success: false, error: 'item_type must be skin or case' }, 400, request);
    }
    const rows = itemType === 'skin'
      ? await env.CASES_DB.prepare(`SELECT id, item_name AS label, market_hash_name AS market_name FROM case_items WHERE item_kind = 'skin' ${''}`).all()
      : await env.CASES_DB.prepare(`SELECT id, case_name AS label, steam_market_hash_name AS market_name FROM case_definitions`).all();
    const openReports = await env.CASES_DB.prepare(`SELECT DISTINCT target_id FROM cs2_image_reports WHERE item_type = ? AND status = 'open'`).bind(itemType).all();
    const targetIds = new Set((openReports.results || []).map((r) => Number(r.target_id)));
    let updated = 0;
    for (const row of rows.results || []) {
      if (onlyReported && !targetIds.has(Number(row.id))) continue;
      const resolvedUrl = await fetchSteamIconUrl(row.market_name || row.label || '');
      if (!resolvedUrl) continue;
      if (itemType === 'skin') {
        await env.CASES_DB.prepare(`UPDATE case_items SET image_url = ? WHERE id = ?`).bind(resolvedUrl, row.id).run();
      } else {
        await env.CASES_DB.prepare(`UPDATE case_definitions SET image_url = ? WHERE id = ?`).bind(resolvedUrl, row.id).run();
        await env.CASES_DB.prepare(`UPDATE case_items SET image_url = ? WHERE case_def_id = ? AND item_kind = 'case'`).bind(resolvedUrl, row.id).run();
      }
      updated += 1;
    }
    if (onlyReported) {
      await env.CASES_DB.prepare(`UPDATE cs2_image_reports SET status = 'resolved', resolved_at = ?, resolved_by_user_id = ?, updated_at = ? WHERE item_type = ? AND status = 'open'`).bind(isoNow(), admin.id, isoNow(), itemType).run();
    }
    return json({ success: true, updated, message: `${updated} ${itemType} image(s) refreshed.` }, 200, request);
  }

  if (pathname === "/api/cs2/profile/public" && request.method === "GET") {
    const userId = Number(url.searchParams.get("user_id") || "");
    if (!Number.isInteger(userId) || userId <= 0) {
      return json({ success: false, error: "A valid user id is required" }, 400, request);
    }

    const profile = await env.CASES_DB.prepare(`
      SELECT * FROM case_profiles WHERE user_id = ? LIMIT 1
    `).bind(userId).first();

    if (!profile) {
      return json({
        success: true,
        profile: null,
        opens: [],
        recent_inventory: []
      }, 200, request);
    }

    const opens = await env.CASES_DB.prepare(`
      SELECT h.opened_at, h.price_paid, c.case_name, i.item_name, i.rarity, i.color_hex,
             i.image_url, i.wear, i.wear_code
      FROM case_open_history h
      INNER JOIN case_definitions c ON c.id = h.case_id
      INNER JOIN case_items i ON i.id = h.item_id
      WHERE h.user_id = ?
      ORDER BY h.id DESC
      LIMIT 30
    `).bind(userId).all();

    const inv = await env.CASES_DB.prepare(`
      SELECT i.id, ci.item_name, ci.rarity, ci.color_hex, ci.item_kind, ci.image_url, ci.wear, i.acquired_at
      FROM inventory i
      INNER JOIN case_items ci ON ci.id = i.item_id
      WHERE i.user_id = ?
      ORDER BY i.id DESC
      LIMIT 40
    `).bind(userId).all();

    const showcase = await env.CASES_DB.prepare(`
      SELECT s.slot, s.inventory_id, ci.item_name, ci.image_url, ci.rarity, ci.wear, ci.color_hex
      FROM profile_showcase s
      INNER JOIN inventory inv ON inv.id = s.inventory_id AND inv.user_id = s.user_id
      INNER JOIN case_items ci ON ci.id = inv.item_id
      WHERE s.user_id = ?
      ORDER BY s.slot ASC
    `).bind(userId).all();

    return json({
      success: true,
      profile: {
        user_id: profile.user_id,
        balance_pence: Number(profile.balance || 0),
        total_cases_opened: Number(profile.total_cases_opened || 0),
        total_spent_pence: Number(profile.total_spent || 0),
        total_inventory_value_pence: Number(profile.total_inventory_value || 0)
      },
      opens: opens.results || [],
      recent_inventory: await Promise.all((inv.results || []).map(async (row) => ({ ...row, image_url: await ensureItemImageUrl(env, row) }))),
      showcase: await Promise.all((showcase.results || []).map(async (row) => ({ ...row, image_url: await ensureItemImageUrl(env, row) })))
    }, 200, request);
  }

  if (pathname === "/api/cs2/listings" && request.method === "GET") {
    const search = (url.searchParams.get("search") || "").trim().toLowerCase();
    const rows = await env.CASES_DB.prepare(`
      SELECT
        l.id,
        l.seller_user_id,
        l.inventory_id,
        l.item_id,
        l.asking_price_pence,
        l.created_at,
        l.list_mode,
        l.auction_end_at,
        l.auction_start_bid_pence,
        l.current_bid_pence,
        l.current_high_bidder_id,
        ci.item_name,
        ci.rarity,
        ci.color_hex,
        ci.market_hash_name,
        ci.image_url,
        ci.wear,
        ci.wear_code,
        COALESCE(om.top_offer, 0) AS top_offer_pence
      FROM market_listings l
      INNER JOIN case_items ci ON ci.id = l.item_id
      LEFT JOIN (
        SELECT listing_id, MAX(offer_pence) AS top_offer
        FROM market_offers
        WHERE status = 'pending'
        GROUP BY listing_id
      ) om ON om.listing_id = l.id
      WHERE l.status = 'active'
      ORDER BY l.id DESC
      LIMIT 200
    `).all();

    let listings = rows.results || [];
    if (search) {
      listings = listings.filter((r) => String(r.item_name || "").toLowerCase().includes(search));
    }

    const sellerIds = listings.map((r) => Number(r.seller_user_id));
    const names = await resolveUsernames(env, sellerIds);

    const formattedListings = [];
    for (const r of listings) {
      formattedListings.push({
        id: r.id,
        seller: names.get(Number(r.seller_user_id)) || `user#${r.seller_user_id}`,
        seller_user_id: r.seller_user_id,
        inventory_id: r.inventory_id,
        item_id: r.item_id,
        item_name: r.item_name,
        rarity: r.rarity,
        color_hex: r.color_hex || "",
        image_url: await ensureItemImageUrl(env, r),
        wear: r.wear || "",
        wear_code: r.wear_code || "",
        asking_price_pence: Number(r.asking_price_pence || 0),
        list_mode: r.list_mode || "fixed",
        auction_end_at: r.auction_end_at || null,
        auction_start_bid_pence: r.auction_start_bid_pence != null ? Number(r.auction_start_bid_pence) : null,
        current_bid_pence: Number(r.current_bid_pence || 0),
        current_high_bidder_id: r.current_high_bidder_id || null,
        top_offer_pence: Number(r.top_offer_pence || 0),
        created_at: r.created_at
      });
    }

    return json({
      success: true,
      listings: formattedListings
    }, 200, request);
  }

  if (pathname === "/api/cs2/admin/cases" && request.method === "GET") {
    const admin = await requireGamblingAdmin(request, env);
    if (admin instanceof Response) return admin;

    const search = (url.searchParams.get("q") || "").trim().toLowerCase();
    const rows = await env.CASES_DB.prepare(`
      SELECT id, case_name, slug, image_url, price, description, is_active, steam_market_hash_name, fallback_price_pence
      FROM case_definitions
      ORDER BY case_name ASC
    `).all();

    let list = rows.results || [];
    if (search) {
      list = list.filter((row) => {
        const haystack = `${row.case_name || ""} ${row.slug || ""} ${row.steam_market_hash_name || ""}`.toLowerCase();
        return haystack.includes(search);
      });
    }

    const cases = [];
    for (const row of list) {
      cases.push(await buildAdminCasePayload(env, row, { allowLiveFetch: false }));
    }

    return json({ success: true, cases, query: search }, 200, request);
  }

  if (pathname === "/api/cs2/admin/cases/create" && request.method === "POST") {
    const admin = await requireGamblingAdmin(request, env);
    if (admin instanceof Response) return admin;

    const body = await safeJson(request);
    const caseName = typeof body?.case_name === "string" ? body.case_name.trim() : "";
    const rawSlug = typeof body?.slug === "string" ? body.slug.trim() : "";
    const steamMarketHashName = typeof body?.steam_market_hash_name === "string" ? body.steam_market_hash_name.trim() : caseName;
    const description = typeof body?.description === "string" ? body.description.trim() : `Simulated ${caseName} drops for Grev Coins.`;
    const fallbackPrice = Number(body?.fallback_price_pence);
    const imageUrlInput = typeof body?.image_url === "string" ? body.image_url.trim() : "";
    const isActive = body?.is_active === false ? 0 : 1;
    const slug = (rawSlug || caseName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")).slice(0, 120);

    if (!caseName) return json({ success: false, error: "case_name is required" }, 400, request);
    if (!slug) return json({ success: false, error: "slug is required" }, 400, request);
    if (!Number.isInteger(fallbackPrice) || fallbackPrice <= 0) {
      return json({ success: false, error: "fallback_price_pence must be a positive integer" }, 400, request);
    }

    const existing = await env.CASES_DB.prepare(`
      SELECT id FROM case_definitions WHERE slug = ? OR case_name = ? LIMIT 1
    `).bind(slug, caseName).first();
    if (existing) return json({ success: false, error: "A case with that name or slug already exists" }, 400, request);

    const now = isoNow();
    let imageUrl = imageUrlInput;
    if (!imageUrl) imageUrl = await fetchSteamIconUrl(steamMarketHashName);

    const insert = await env.CASES_DB.prepare(`
      INSERT INTO case_definitions (
        case_name, slug, image_url, price, description, is_active, created_at, steam_market_hash_name, fallback_price_pence
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(caseName, slug, imageUrl || "", fallbackPrice, description, isActive, now, steamMarketHashName || caseName, fallbackPrice).run();

    const caseId = Number(insert.meta?.last_row_id || 0);
    await env.CASES_DB.prepare(`
      INSERT INTO case_items (
        item_name, weapon_name, skin_name, rarity, wear, image_url, market_value, color_hex, created_at, item_kind, case_def_id, market_hash_name
      ) VALUES (?, '', '', 'container', '', ?, 0, '#9ea3b5', ?, 'case', ?, ?)
    `).bind(`${caseName} (Unopened)`, imageUrl || "", now, caseId, steamMarketHashName || caseName).run();

    const created = await env.CASES_DB.prepare(`
      SELECT id, case_name, slug, image_url, price, description, is_active, steam_market_hash_name, fallback_price_pence
      FROM case_definitions WHERE id = ? LIMIT 1
    `).bind(caseId).first();

    return json({ success: true, message: "Case created", case: await buildAdminCasePayload(env, created) }, 200, request);
  }

  if (pathname === "/api/cs2/admin/cases/toggle" && request.method === "POST") {
    const admin = await requireGamblingAdmin(request, env);
    if (admin instanceof Response) return admin;

    const body = await safeJson(request);
    const caseId = Number(body?.case_id);
    const isActive = Boolean(body?.is_active);

    if (!Number.isInteger(caseId) || caseId <= 0) {
      return json({ success: false, error: "A valid case id is required" }, 400, request);
    }

    await env.CASES_DB.prepare(`
      UPDATE case_definitions SET is_active = ? WHERE id = ?
    `).bind(isActive ? 1 : 0, caseId).run();

    return json({ success: true, message: "Case updated" }, 200, request);
  }

  if (pathname === "/api/cs2/admin/cases/price" && request.method === "POST") {
    const admin = await requireGamblingAdmin(request, env);
    if (admin instanceof Response) return admin;

    const body = await safeJson(request);
    const caseId = Number(body?.case_id);
    const fallback = Number(body?.fallback_price_pence);

    if (!Number.isInteger(caseId) || caseId <= 0) {
      return json({ success: false, error: "A valid case id is required" }, 400, request);
    }

    if (!Number.isInteger(fallback) || fallback <= 0) {
      return json({ success: false, error: "A valid fallback price in pence is required" }, 400, request);
    }

    await env.CASES_DB.prepare(`
      UPDATE case_definitions
      SET price = ?, fallback_price_pence = ?
      WHERE id = ?
    `).bind(fallback, fallback, caseId).run();

    return json({ success: true, message: "Fallback price updated" }, 200, request);
  }

  if (pathname === "/api/cs2/admin/catalog/import" && request.method === "POST") {
    const admin = await requireGamblingAdmin(request, env);
    if (admin instanceof Response) return admin;
    try {
      const stats = await importMasterCatalog(env);
      return json({ success: true, stats, message: `Imported ${stats.skins_upserted} skin rows across ${stats.sections} catalog sections.` }, 200, request);
    } catch (error) {
      return json({ success: false, error: error?.message || 'Catalog import failed.' }, 500, request);
    }
  }

  if (pathname === "/api/cs2/admin/pricempire/import" && request.method === "POST") {
    const admin = await requireGamblingAdmin(request, env);
    if (admin instanceof Response) return admin;

    const body = await safeJson(request);
    const apiKey = typeof body?.api_key === 'string' ? body.api_key.trim() : '';
    const limit = Number(body?.limit || 0);
    if (!apiKey) return json({ success: false, error: 'A PriceEmpire API key is required.' }, 400, request);

    try {
      const stats = await importPriceEmpireCatalog(env, apiKey, { limit });
      return json({ success: true, message: `Imported ${stats.skins_inserted} new skins, updated ${stats.skins_updated} skins, and added ${stats.drops_added} case drops.`, stats }, 200, request);
    } catch (error) {
      return json({ success: false, error: error instanceof Error ? error.message : 'PriceEmpire import failed.' }, 500, request);
    }
  }

  if (pathname === "/api/cs2/admin/settings" && request.method === "GET") {
    const admin = await requireGamblingAdmin(request, env);
    if (admin instanceof Response) return admin;

    const fee = await getQuickSellFeePercent(env);
    return json({ success: true, quick_sell_fee_percent: fee }, 200, request);
  }

  if (pathname === "/api/cs2/admin/graveyard" && request.method === "GET") {
    const admin = await requireGamblingAdmin(request, env);
    if (admin instanceof Response) return admin;

    const rows = await env.CASES_DB.prepare(`
      SELECT
        g.id,
        g.skin_instance_id,
        g.user_id,
        g.resolved_item_id,
        g.source_type,
        g.payout_pence,
        g.market_reference_pence,
        g.fee_percent,
        g.refunded_at,
        g.created_at,
        ci.item_name,
        ci.rarity,
        ci.wear,
        ci.wear_code,
        ci.color_hex,
        ci.image_url
      FROM quick_sell_graveyard g
      INNER JOIN case_items ci ON ci.id = g.resolved_item_id
      ORDER BY g.id DESC
      LIMIT 250
    `).all();
    const userIds = (rows.results || []).map((row) => Number(row.user_id));
    const names = await resolveUsernames(env, userIds);
    const entries = await Promise.all((rows.results || []).map(async (row) => ({
      ...row,
      username: names.get(Number(row.user_id)) || `user#${row.user_id}`,
      image_url: await ensureItemImageUrl(env, row)
    })));
    return json({ success: true, entries }, 200, request);
  }

  if (pathname === "/api/cs2/admin/graveyard/refund" && request.method === "POST") {
    const admin = await requireGamblingAdmin(request, env);
    if (admin instanceof Response) return admin;
    const body = await safeJson(request);
    const graveyardId = Number(body?.graveyard_id);
    if (!Number.isInteger(graveyardId) || graveyardId <= 0) {
      return json({ success: false, error: "A valid graveyard_id is required" }, 400, request);
    }
    const entry = await env.CASES_DB.prepare(`
      SELECT * FROM quick_sell_graveyard WHERE id = ? LIMIT 1
    `).bind(graveyardId).first();
    if (!entry) return json({ success: false, error: "Graveyard entry not found" }, 404, request);
    if (entry.refunded_at) return json({ success: false, error: "That item has already been refunded" }, 400, request);

    const now = isoNow();
    await env.CASES_DB.batch([
      env.CASES_DB.prepare(`
        INSERT INTO inventory (user_id, item_id, skin_instance_id, source_case_id, acquired_at, locked)
        VALUES (?, ?, ?, NULL, ?, 0)
      `).bind(entry.user_id, entry.resolved_item_id, entry.skin_instance_id, now),
      env.CASES_DB.prepare(`
        UPDATE quick_sell_graveyard
        SET refunded_at = ?, refunded_by_user_id = ?
        WHERE id = ?
      `).bind(now, admin.id, graveyardId),
      env.CASES_DB.prepare(`
        UPDATE skin_instances
        SET current_owner_user_id = ?, status = 'inventory', updated_at = ?
        WHERE id = ?
      `).bind(entry.user_id, now, entry.skin_instance_id)
    ]);
    const inserted = await env.CASES_DB.prepare(`
      SELECT id FROM inventory WHERE user_id = ? AND item_id = ? AND acquired_at = ? ORDER BY id DESC LIMIT 1
    `).bind(entry.user_id, entry.resolved_item_id, now).first();
    if (inserted?.id) {
      await env.CASES_DB.prepare(`
        UPDATE skin_instances SET source_inventory_id = ?, updated_at = ? WHERE id = ?
      `).bind(inserted.id, now, entry.skin_instance_id).run();
    }
    await refreshInventoryValue(env, Number(entry.user_id));
    return json({ success: true, message: "Skin refunded from graveyard" }, 200, request);
  }


  if (pathname === "/api/cs2/admin/users" && request.method === "GET") {
    const admin = await requireGamblingAdmin(request, env);
    if (admin instanceof Response) return admin;

    const search = (url.searchParams.get("q") || "").trim().toLowerCase();
    const usersRow = await env.DB.prepare(`
      SELECT id, username
      FROM users
      WHERE approved = 1
      ORDER BY LOWER(username) ASC
    `).all();

    const users = [];
    for (const user of usersRow.results || []) {
      const username = String(user.username || "").trim();
      if (!username) continue;
      if (search && !username.toLowerCase().includes(search)) continue;
      await ensureUserCaseProfileById(env, Number(user.id), username, isoNow);
      const profile = await env.CASES_DB.prepare(`
        SELECT balance, key_balance, total_cases_opened, total_inventory_value
        FROM case_profiles
        WHERE user_id = ?
        LIMIT 1
      `).bind(user.id).first();
      users.push({
        user_id: Number(user.id),
        username,
        balance_pence: Number(profile?.balance || 0),
        key_balance: Number(profile?.key_balance || 0),
        total_cases_opened: Number(profile?.total_cases_opened || 0),
        total_inventory_value_pence: Number(profile?.total_inventory_value || 0)
      });
    }

    return json({ success: true, users, query: search }, 200, request);
  }

  if (pathname === "/api/cs2/admin/users/balance" && request.method === "POST") {
    const admin = await requireGamblingAdmin(request, env);
    if (admin instanceof Response) return admin;

    const body = await safeJson(request);
    const userId = Number(body?.user_id);
    const balanceCoins = Number(body?.balance_coins);

    if (!Number.isInteger(userId) || userId <= 0) {
      return json({ success: false, error: "A valid user id is required" }, 400, request);
    }

    if (!Number.isFinite(balanceCoins) || balanceCoins < 0) {
      return json({ success: false, error: "balance_coins must be 0 or more" }, 400, request);
    }

    const user = await env.DB.prepare(`SELECT id, username FROM users WHERE id = ? LIMIT 1`).bind(userId).first();
    if (!user) {
      return json({ success: false, error: "User not found" }, 404, request);
    }

    await ensureUserCaseProfileById(env, userId, String(user.username || `user#${userId}`), isoNow);

    const balancePence = Math.round(balanceCoins * 100);
    await env.CASES_DB.prepare(`
      UPDATE case_profiles
      SET balance = ?, updated_at = ?
      WHERE user_id = ?
    `).bind(balancePence, isoNow(), userId).run();

    const profile = await env.CASES_DB.prepare(`
      SELECT balance, key_balance
      FROM case_profiles
      WHERE user_id = ?
      LIMIT 1
    `).bind(userId).first();

    return json({
      success: true,
      message: "Balance updated",
      profile: {
        user_id: userId,
        username: String(user.username || `user#${userId}`),
        balance_pence: Number(profile?.balance || 0),
        key_balance: Number(profile?.key_balance || 0)
      }
    }, 200, request);
  }

  if (pathname === "/api/cs2/admin/settings/quick-sell-fee" && request.method === "POST") {
    const admin = await requireGamblingAdmin(request, env);
    if (admin instanceof Response) return admin;

    const body = await safeJson(request);
    const fee = Number(body?.fee_percent);

    if (!Number.isInteger(fee) || fee < 0 || fee >= 100) {
      return json({ success: false, error: "fee_percent must be an integer from 0 to 99" }, 400, request);
    }

    await env.CASES_DB.prepare(`
      INSERT INTO cs2_sim_settings (key, value) VALUES ('quick_sell_fee_percent', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `)
      .bind(String(fee))
      .run();

    return json({ success: true, quick_sell_fee_percent: fee }, 200, request);
  }

  /* ------------------------------ Auth routes ----------------------------- */
  const session = await getApprovedUser(request, env);
  if (session instanceof Response) {
    if (pathname.startsWith("/api/cs2/")) {
      return session;
    }
    return null;
  }

  if (pathname === "/api/cs2/inventory" && request.method === "GET") {
    await ensureCaseProfile(env, session, isoNow);
    await refreshInventoryValue(env, session.id);

    const rows = await env.CASES_DB.prepare(`
      SELECT
        i.id,
        i.item_id,
        i.skin_instance_id,
        i.source_case_id,
        i.acquired_at,
        i.locked,
        ci.item_name,
        ci.item_kind,
        ci.rarity,
        ci.wear,
        ci.wear_code,
        ci.market_value,
        ci.color_hex,
        ci.market_hash_name,
        ci.image_url,
        cd.case_name AS source_case_name
      FROM inventory i
      INNER JOIN case_items ci ON ci.id = i.item_id
      LEFT JOIN case_definitions cd ON cd.id = i.source_case_id
      WHERE i.user_id = ?
      ORDER BY i.id DESC
    `).bind(session.id).all();

    const items = [];
    for (const r of rows.results || []) {
      let live = await getOrFetchItemPricePence(env, r.market_hash_name);
      if (live == null || live <= 0) live = Number(r.market_value || 0);
      items.push({
        inventory_id: r.id,
        item_id: r.item_id,
        skin_instance_id: Number(r.skin_instance_id || 0),
        item_kind: r.item_kind || "skin",
        item_name: r.item_name,
        rarity: r.rarity,
        wear: r.wear,
        wear_code: r.wear_code || "",
        market_value_pence: Number(r.market_value || 0),
        live_price_pence: live,
        color_hex: r.color_hex || "",
        market_hash_name: r.market_hash_name || "",
        image_url: await ensureItemImageUrl(env, r),
        acquired_at: r.acquired_at,
        acquired_from_case: r.source_case_name || "",
        locked: Boolean(r.locked)
      });
    }

    const keyMeta = await env.CASES_DB.prepare(`SELECT key_balance FROM case_profiles WHERE user_id = ? LIMIT 1`)
      .bind(session.id)
      .first();

    return json(
      {
        success: true,
        items,
        key_balance: Number(keyMeta?.key_balance ?? 0)
      },
      200,
      request
    );
  }

  if (pathname === "/api/cs2/store/buy-case" && request.method === "POST") {
    await ensureCaseProfile(env, session, isoNow);
    const body = await safeJson(request);
    const caseId = Number(body?.case_id);
    let qty = Number(body?.quantity ?? 1);
    if (!Number.isInteger(qty) || qty < 1) qty = 1;
    if (qty > 100) qty = 100;

    if (!Number.isInteger(caseId) || caseId <= 0) {
      return json({ success: false, error: "A valid case id is required" }, 400, request);
    }

    const caseRow = await env.CASES_DB.prepare(`
      SELECT * FROM case_definitions WHERE id = ? LIMIT 1
    `).bind(caseId).first();

    if (!caseRow || !Number(caseRow.is_active)) {
      return json({ success: false, error: "Case is not available" }, 404, request);
    }

    const unitPrice = await getCaseStorePricePence(env, caseRow)
      || Number(caseRow.fallback_price_pence || caseRow.price || 0);

    if (!unitPrice || unitPrice <= 0) {
      return json({ success: false, error: "Case price is unavailable" }, 400, request);
    }

    const totalCost = unitPrice * qty;

    const profile = await env.CASES_DB.prepare(`
      SELECT balance FROM case_profiles WHERE user_id = ? LIMIT 1
    `).bind(session.id).first();

    const balance = Number(profile?.balance || 0);
    if (balance < totalCost) {
      return json({ success: false, error: "Not enough Grev Coins" }, 400, request);
    }

    const sku = await env.CASES_DB.prepare(`
      SELECT id FROM case_items
      WHERE case_def_id = ? AND item_kind = 'case'
      LIMIT 1
    `).bind(caseId).first();

    if (!sku?.id) {
      return json({ success: false, error: "Case SKU missing — run seed" }, 500, request);
    }

    const now = isoNow();
    const stamp = now;

    const batch = [
      env.CASES_DB.prepare(`
        UPDATE case_profiles
        SET balance = balance - ?, total_spent = total_spent + ?, updated_at = ?
        WHERE user_id = ?
      `).bind(totalCost, totalCost, stamp, session.id),
      env.CASES_DB.prepare(`
        INSERT INTO trade_history (
          buyer_user_id,
          seller_user_id,
          item_id,
          item_name,
          price_pence,
          trade_type,
          created_at
        )
        VALUES (?, NULL, ?, ?, ?, 'store_buy', ?)
      `).bind(session.id, sku.id, `${caseRow.case_name} (Unopened) ×${qty}`, totalCost, now)
    ];

    for (let i = 0; i < qty; i += 1) {
      batch.push(
        env.CASES_DB.prepare(`
          INSERT INTO inventory (user_id, item_id, source_case_id, acquired_at, locked)
          VALUES (?, ?, NULL, ?, 0)
        `).bind(session.id, sku.id, now)
      );
    }

    await env.CASES_DB.batch(batch);

    await refreshInventoryValue(env, session.id);

    const updated = await env.CASES_DB.prepare(`SELECT balance FROM case_profiles WHERE user_id = ? LIMIT 1`)
      .bind(session.id)
      .first();

    return json(
      {
        success: true,
        message: qty === 1 ? "Case purchased" : `${qty} cases purchased`,
        quantity: qty,
        unit_price_pence: unitPrice,
        spent_pence: totalCost,
        balance_after_pence: Number(updated?.balance || 0)
      },
      200,
      request
    );
  }

  if (pathname === "/api/cs2/store/buy-keys" && request.method === "POST") {
    await ensureCaseProfile(env, session, isoNow);
    const body = await safeJson(request);
    let qty = Number(body?.quantity ?? 1);
    if (!Number.isInteger(qty) || qty < 1) qty = 1;
    if (qty > 100) qty = 100;

    const totalCost = KEY_PRICE_PENCE * qty;

    const profile = await env.CASES_DB.prepare(`
      SELECT balance FROM case_profiles WHERE user_id = ? LIMIT 1
    `).bind(session.id).first();

    const balance = Number(profile?.balance || 0);
    if (balance < totalCost) {
      return json({ success: false, error: "Not enough Grev Coins for keys" }, 400, request);
    }

    const now = isoNow();
    const stamp = now;

    await env.CASES_DB.batch([
      env.CASES_DB.prepare(`
        UPDATE case_profiles
        SET
          balance = balance - ?,
          total_spent = total_spent + ?,
          key_balance = key_balance + ?,
          updated_at = ?
        WHERE user_id = ?
      `).bind(totalCost, totalCost, qty, stamp, session.id),
      env.CASES_DB.prepare(`
        INSERT INTO trade_history (
          buyer_user_id,
          seller_user_id,
          item_id,
          item_name,
          price_pence,
          trade_type,
          created_at
        )
        VALUES (?, NULL, NULL, ?, ?, 'key_purchase', ?)
      `).bind(session.id, `Case keys ×${qty}`, totalCost, now)
    ]);

    const updated = await env.CASES_DB.prepare(`
      SELECT balance, key_balance FROM case_profiles WHERE user_id = ? LIMIT 1
    `)
      .bind(session.id)
      .first();

    return json(
      {
        success: true,
        message: qty === 1 ? "Key purchased" : `${qty} keys purchased`,
        quantity: qty,
        spent_pence: totalCost,
        balance_after_pence: Number(updated?.balance || 0),
        key_balance: Number(updated?.key_balance || 0)
      },
      200,
      request
    );
  }

  if (pathname === "/api/cs2/store/refund-keys" && request.method === "POST") {
    await ensureCaseProfile(env, session, isoNow);
    const body = await safeJson(request);
    let qty = Number(body?.quantity ?? 1);
    if (!Number.isInteger(qty) || qty < 1) qty = 1;
    if (qty > 100) qty = 100;

    const profile = await env.CASES_DB.prepare(`
      SELECT balance, key_balance FROM case_profiles WHERE user_id = ? LIMIT 1
    `).bind(session.id).first();

    if (Number(profile?.key_balance || 0) < qty) {
      return json({ success: false, error: "You do not have enough keys to refund." }, 400, request);
    }

    const payout = keyRefundPayout(qty);
    const now = isoNow();
    await env.CASES_DB.batch([
      env.CASES_DB.prepare(`
        UPDATE case_profiles
        SET key_balance = key_balance - ?, balance = balance + ?, updated_at = ?
        WHERE user_id = ?
      `).bind(qty, payout, now, session.id),
      env.CASES_DB.prepare(`
        INSERT INTO trade_history (buyer_user_id, seller_user_id, item_id, item_name, price_pence, trade_type, created_at)
        VALUES (?, NULL, NULL, ?, ?, 'key_refund', ?)
      `).bind(session.id, `Key refund ×${qty}`, payout, now)
    ]);

    const updated = await env.CASES_DB.prepare(`
      SELECT balance, key_balance FROM case_profiles WHERE user_id = ? LIMIT 1
    `).bind(session.id).first();

    return json({
      success: true,
      message: qty === 1 ? "Key refunded" : `${qty} keys refunded`,
      quantity: qty,
      payout_pence: payout,
      balance_after_pence: Number(updated?.balance || 0),
      key_balance: Number(updated?.key_balance || 0)
    }, 200, request);
  }

  if (pathname === "/api/cs2/store/refund-case" && request.method === "POST") {
    await ensureCaseProfile(env, session, isoNow);
    const body = await safeJson(request);
    const inventoryId = Number(body?.inventory_id);
    if (!Number.isInteger(inventoryId) || inventoryId <= 0) {
      return json({ success: false, error: "A valid inventory id is required" }, 400, request);
    }

    const row = await env.CASES_DB.prepare(`
      SELECT i.id, ci.item_kind, ci.case_def_id, cd.case_name, cd.fallback_price_pence, cd.price
      FROM inventory i
      INNER JOIN case_items ci ON ci.id = i.item_id
      INNER JOIN case_definitions cd ON cd.id = ci.case_def_id
      WHERE i.id = ? AND i.user_id = ?
      LIMIT 1
    `).bind(inventoryId, session.id).first();

    if (!row || row.item_kind !== "case") {
      return json({ success: false, error: "Only unopened cases can be refunded." }, 400, request);
    }

    const payout = caseRefundPayout(Number(row.fallback_price_pence || row.price || 0));
    if (!payout) {
      return json({ success: false, error: "That case does not have a valid refund price." }, 400, request);
    }
    const now = isoNow();
    await env.CASES_DB.batch([
      env.CASES_DB.prepare(`DELETE FROM inventory WHERE id = ?`).bind(inventoryId),
      env.CASES_DB.prepare(`
        UPDATE case_profiles
        SET balance = balance + ?, updated_at = ?
        WHERE user_id = ?
      `).bind(payout, now, session.id),
      env.CASES_DB.prepare(`
        INSERT INTO trade_history (buyer_user_id, seller_user_id, item_id, item_name, price_pence, trade_type, created_at)
        VALUES (?, NULL, NULL, ?, ?, 'case_refund', ?)
      `).bind(session.id, `${row.case_name} refund`, payout, now)
    ]);

    const updated = await env.CASES_DB.prepare(`
      SELECT balance FROM case_profiles WHERE user_id = ? LIMIT 1
    `).bind(session.id).first();

    return json({
      success: true,
      message: "Case refunded",
      payout_pence: payout,
      balance_after_pence: Number(updated?.balance || 0)
    }, 200, request);
  }

  if (pathname === "/api/cs2/open" && request.method === "POST") {
    await ensureCaseProfile(env, session, isoNow);
    const body = await safeJson(request);
    const inventoryId = Number(body?.inventory_id);

    if (!Number.isInteger(inventoryId) || inventoryId <= 0) {
      return json({ success: false, error: "A valid inventory id is required" }, 400, request);
    }

    const opened = await executeCaseOpen(env, session, isoNow, inventoryId);
    if (!opened.success) {
      return json({ success: false, error: opened.error }, opened.status || 400, request);
    }

    return json({ success: true, ...opened.data }, 200, request);
  }

  if (pathname === "/api/cs2/open-batch" && request.method === "POST") {
    await ensureCaseProfile(env, session, isoNow);
    const body = await safeJson(request);
    const raw = body?.inventory_ids;
    const ids = Array.isArray(raw)
      ? [...new Set(raw.map(Number).filter((n) => Number.isInteger(n) && n > 0))]
      : [];

    if (ids.length < 1 || ids.length > 10) {
      return json({ success: false, error: "Provide between 1 and 10 distinct case inventory ids" }, 400, request);
    }

    const prof = await env.CASES_DB.prepare(`SELECT key_balance FROM case_profiles WHERE user_id = ? LIMIT 1`)
      .bind(session.id)
      .first();

    if (Number(prof?.key_balance || 0) < ids.length) {
      return json(
        {
          success: false,
          error: `You do not have enough keys! You need ${ids.length} keys for this batch open.`
        },
        400,
        request
      );
    }

    const opens = [];
    for (const inventoryId of ids) {
      const opened = await executeCaseOpen(env, session, isoNow, inventoryId);
      if (!opened.success) {
        return json(
          {
            success: false,
            error: opened.error,
            partial_opens: opens
          },
          opened.status || 400,
          request
        );
      }
      opens.push(opened.data);
    }

    const updated = await env.CASES_DB.prepare(`SELECT balance, key_balance FROM case_profiles WHERE user_id = ? LIMIT 1`)
      .bind(session.id)
      .first();

    return json(
      {
        success: true,
        opens,
        key_balance: Number(updated?.key_balance || 0),
        balance_after_pence: Number(updated?.balance || 0)
      },
      200,
      request
    );
  }

  if (pathname === "/api/cs2/drop/claim" && request.method === "POST") {
    await ensureCaseProfile(env, session, isoNow);
    const body = await safeJson(request);
    const pendingDropId = Number(body?.pending_drop_id);

    if (!Number.isInteger(pendingDropId) || pendingDropId <= 0) {
      return json({ success: false, error: "A valid pending_drop_id is required" }, 400, request);
    }

    const pend = await env.CASES_DB.prepare(`
      SELECT * FROM pending_drops
      WHERE id = ? AND user_id = ? AND status = 'pending'
      LIMIT 1
    `).bind(pendingDropId, session.id).first();

    if (!pend) {
      return json({ success: false, error: "Pending drop not found" }, 404, request);
    }

    const t = isoNow();
    await env.CASES_DB.batch([
      env.CASES_DB.prepare(`
        INSERT INTO inventory (user_id, item_id, skin_instance_id, source_case_id, acquired_at, locked)
        VALUES (?, ?, ?, ?, ?, 0)
      `).bind(session.id, pend.resolved_item_id, pend.skin_instance_id || null, pend.case_id, t),
      env.CASES_DB.prepare(`
        INSERT INTO case_open_history (user_id, case_id, item_id, price_paid, opened_at)
        VALUES (?, ?, ?, ?, ?)
      `).bind(session.id, pend.case_id, pend.resolved_item_id, pend.key_paid, t),
      env.CASES_DB.prepare(`UPDATE pending_drops SET status = 'claimed' WHERE id = ?`).bind(pendingDropId),
      env.CASES_DB.prepare(`
        UPDATE skin_instances
        SET current_owner_user_id = ?, status = 'inventory', updated_at = ?
        WHERE id = ?
      `).bind(session.id, t, pend.skin_instance_id || 0)
    ]);

    const inserted = await env.CASES_DB.prepare(`
      SELECT id FROM inventory
      WHERE user_id = ? AND item_id = ? AND acquired_at = ?
      ORDER BY id DESC
      LIMIT 1
    `).bind(session.id, pend.resolved_item_id, t).first();
    if (pend.skin_instance_id && inserted?.id) {
      await env.CASES_DB.prepare(`
        UPDATE skin_instances
        SET source_inventory_id = ?, updated_at = ?
        WHERE id = ?
      `).bind(inserted.id, t, pend.skin_instance_id).run();
    }

    await refreshInventoryValue(env, session.id);

    return json({ success: true, message: "Added to inventory" }, 200, request);
  }

  if (pathname === "/api/cs2/drop/quick-sell" && request.method === "POST") {
    await ensureCaseProfile(env, session, isoNow);
    const body = await safeJson(request);
    const pendingDropId = Number(body?.pending_drop_id);

    if (!Number.isInteger(pendingDropId) || pendingDropId <= 0) {
      return json({ success: false, error: "A valid pending_drop_id is required" }, 400, request);
    }

    const pend = await env.CASES_DB.prepare(`
      SELECT * FROM pending_drops
      WHERE id = ? AND user_id = ? AND status = 'pending'
      LIMIT 1
    `).bind(pendingDropId, session.id).first();

    if (!pend) {
      return json({ success: false, error: "Pending drop not found" }, 404, request);
    }

    const row = await env.CASES_DB.prepare(`
      SELECT * FROM case_items WHERE id = ? LIMIT 1
    `).bind(pend.resolved_item_id).first();

    if (!row || row.item_kind !== "skin") {
      return json({ success: false, error: "Invalid resolved item" }, 400, request);
    }

    const hash = row.market_hash_name || row.item_name;
    let marketPrice = await getOrFetchItemPricePence(env, hash);
    if (marketPrice == null || marketPrice <= 0) {
      marketPrice = Number(row.market_value || 0);
    }

    if (!marketPrice || marketPrice <= 0) {
      return json({ success: false, error: "Could not determine market price" }, 400, request);
    }

    const feePct = await getQuickSellFeePercent(env);
    const payout = quickSellPayoutFromMarket(marketPrice, feePct);
    if (!payout) {
      return json({ success: false, error: "Could not compute quick sell payout" }, 400, request);
    }
    const t = isoNow();

    await env.CASES_DB.batch([
      env.CASES_DB.prepare(`UPDATE pending_drops SET status = 'sold' WHERE id = ?`).bind(pendingDropId),
      env.CASES_DB.prepare(`
        UPDATE case_profiles SET balance = balance + ?, updated_at = ? WHERE user_id = ?
      `).bind(payout, t, session.id),
      env.CASES_DB.prepare(`
        UPDATE skin_instances
        SET current_owner_user_id = NULL, graveyard_ref = 'quick_sell_graveyard', status = 'graveyard', updated_at = ?
        WHERE id = ?
      `).bind(t, pend.skin_instance_id || 0),
      env.CASES_DB.prepare(`
        INSERT INTO trade_history (buyer_user_id, seller_user_id, item_id, item_name, price_pence, trade_type, created_at)
        VALUES (NULL, ?, ?, ?, ?, 'quick_sell', ?)
      `).bind(session.id, row.id, row.item_name, payout, t)
    ]);
    if (pend.skin_instance_id) {
      await pushToGraveyard(env, {
        skinInstanceId: pend.skin_instance_id,
        userId: session.id,
        resolvedItemId: row.id,
        sourceType: "pending_drop",
        sourcePendingDropId: pendingDropId,
        payoutPence: payout,
        marketReferencePence: marketPrice,
        feePercent: feePct,
        createdAt: t
      });
    }

    await refreshInventoryValue(env, session.id);

    const updated = await env.CASES_DB.prepare(`
      SELECT balance FROM case_profiles WHERE user_id = ? LIMIT 1
    `).bind(session.id).first();

    return json({
      success: true,
      message: "Quick sold from drop",
      market_reference_pence: marketPrice,
      quick_sell_fee_percent: feePct,
      payout_pence: payout,
      balance_after_pence: Number(updated?.balance || 0)
    }, 200, request);
  }

  if (pathname === "/api/cs2/drop/discard" && request.method === "POST") {
    const body = await safeJson(request);
    const pendingDropId = Number(body?.pending_drop_id);

    if (!Number.isInteger(pendingDropId) || pendingDropId <= 0) {
      return json({ success: false, error: "A valid pending_drop_id is required" }, 400, request);
    }

    const pend = await env.CASES_DB.prepare(`
      SELECT id FROM pending_drops
      WHERE id = ? AND user_id = ? AND status = 'pending'
      LIMIT 1
    `).bind(pendingDropId, session.id).first();

    if (!pend) {
      return json({ success: false, error: "Pending drop not found" }, 404, request);
    }

    await env.CASES_DB.prepare(`UPDATE pending_drops SET status = 'discarded' WHERE id = ?`)
      .bind(pendingDropId)
      .run();

    return json({ success: true, message: "Drop discarded" }, 200, request);
  }

  if (pathname === "/api/cs2/pending" && request.method === "GET") {
    await ensureCaseProfile(env, session, isoNow);
    const rows = await env.CASES_DB.prepare(`
      SELECT
        p.id,
        p.case_id,
        p.resolved_item_id,
        p.skin_instance_id,
        p.key_paid,
        p.quick_sell_payout_pence,
        p.market_reference_pence,
        p.created_at,
        c.case_name,
        i.item_name,
        i.rarity,
        i.wear,
        i.wear_code,
        i.color_hex,
        i.image_url,
        i.market_hash_name
      FROM pending_drops p
      INNER JOIN case_definitions c ON c.id = p.case_id
      INNER JOIN case_items i ON i.id = p.resolved_item_id
      WHERE p.user_id = ? AND p.status = 'pending'
      ORDER BY p.id DESC
    `).bind(session.id).all();

    return json({
      success: true,
      pending: await Promise.all((rows.results || []).map(async (row) => ({
        ...row,
        image_url: await ensureItemImageUrl(env, row)
      })))
    }, 200, request);
  }

  if (pathname === "/api/cs2/quick-sell" && request.method === "POST") {
    await ensureCaseProfile(env, session, isoNow);
    const body = await safeJson(request);
    const inventoryId = Number(body?.inventory_id);

    if (!Number.isInteger(inventoryId) || inventoryId <= 0) {
      return json({ success: false, error: "A valid inventory id is required" }, 400, request);
    }

    const row = await env.CASES_DB.prepare(`
      SELECT i.*, ci.item_kind, ci.item_name, ci.market_hash_name, ci.market_value
      FROM inventory i
      INNER JOIN case_items ci ON ci.id = i.item_id
      WHERE i.id = ? AND i.user_id = ?
      LIMIT 1
    `).bind(inventoryId, session.id).first();

    if (!row || row.item_kind !== "skin") {
      return json({ success: false, error: "Only weapon skins can be quick sold" }, 400, request);
    }

    const hash = row.market_hash_name || row.item_name;
    let marketPrice = await getOrFetchItemPricePence(env, hash);
    if (marketPrice == null || marketPrice <= 0) {
      marketPrice = Number(row.market_value || 0);
    }

    if (!marketPrice || marketPrice <= 0) {
      return json({ success: false, error: "Could not determine market price for this item" }, 400, request);
    }

    const feePct = await getQuickSellFeePercent(env);
    const payout = quickSellPayoutFromMarket(marketPrice, feePct);
    if (!payout) {
      return json({ success: false, error: "Could not compute quick sell payout" }, 400, request);
    }
    const now = isoNow();

    await env.CASES_DB.batch([
      env.CASES_DB.prepare(`DELETE FROM inventory WHERE id = ?`).bind(inventoryId),
      env.CASES_DB.prepare(`
        UPDATE case_profiles
        SET balance = balance + ?, updated_at = ?
        WHERE user_id = ?
      `).bind(payout, now, session.id),
      env.CASES_DB.prepare(`
        UPDATE skin_instances
        SET current_owner_user_id = NULL, graveyard_ref = 'quick_sell_graveyard', status = 'graveyard', updated_at = ?
        WHERE id = ?
      `).bind(now, row.skin_instance_id || 0),
      env.CASES_DB.prepare(`
        INSERT INTO trade_history (
          buyer_user_id,
          seller_user_id,
          item_id,
          item_name,
          price_pence,
          trade_type,
          created_at
        )
        VALUES (NULL, ?, ?, ?, ?, 'quick_sell', ?)
      `).bind(session.id, row.item_id, row.item_name, payout, now)
    ]);
    if (row.skin_instance_id) {
      await pushToGraveyard(env, {
        skinInstanceId: row.skin_instance_id,
        userId: session.id,
        resolvedItemId: row.item_id,
        sourceType: "inventory",
        sourceInventoryId: inventoryId,
        payoutPence: payout,
        marketReferencePence: marketPrice,
        feePercent: feePct,
        createdAt: now
      });
    }

    await refreshInventoryValue(env, session.id);

    const updated = await env.CASES_DB.prepare(`
      SELECT balance FROM case_profiles WHERE user_id = ? LIMIT 1
    `).bind(session.id).first();

    return json({
      success: true,
      message: "Quick sold",
      market_reference_pence: marketPrice,
      quick_sell_fee_percent: feePct,
      payout_pence: payout,
      balance_after_pence: Number(updated?.balance || 0)
    }, 200, request);
  }

  if (pathname === "/api/cs2/listings" && request.method === "POST") {
    await ensureCaseProfile(env, session, isoNow);
    const body = await safeJson(request);
    const inventoryId = Number(body?.inventory_id);
    const asking = Number(body?.asking_price_pence);
    const listMode = String(body?.list_mode || "fixed").toLowerCase();
    const auctionEndAt = typeof body?.auction_end_at === "string" ? body.auction_end_at.trim() : "";
    const startBid = Number(body?.auction_start_bid_pence);

    if (!Number.isInteger(inventoryId) || inventoryId <= 0) {
      return json({ success: false, error: "A valid inventory id is required" }, 400, request);
    }

    if (!Number.isInteger(asking) || asking <= 0) {
      return json({ success: false, error: "A valid price in pence is required (starting bid or buy now)" }, 400, request);
    }

    const inv = await env.CASES_DB.prepare(`
      SELECT i.*, ci.item_kind, ci.item_name
      FROM inventory i
      INNER JOIN case_items ci ON ci.id = i.item_id
      WHERE i.id = ? AND i.user_id = ?
      LIMIT 1
    `).bind(inventoryId, session.id).first();

    if (!inv || inv.item_kind !== "skin") {
      return json({ success: false, error: "Only skins can be listed" }, 400, request);
    }

    const existing = await env.CASES_DB.prepare(`
      SELECT id FROM market_listings WHERE inventory_id = ? AND status = 'active' LIMIT 1
    `).bind(inventoryId).first();

    if (existing) {
      return json({ success: false, error: "That item is already listed" }, 400, request);
    }

    const now = isoNow();
    let mode = "fixed";
    let auctionEnd = null;
    let startBidPence = null;

    if (listMode === "auction") {
      mode = "auction";
      if (!auctionEndAt || Number.isNaN(Date.parse(auctionEndAt))) {
        return json({ success: false, error: "auction_end_at (ISO date) is required for auctions" }, 400, request);
      }
      auctionEnd = auctionEndAt;
      startBidPence = Number.isInteger(startBid) && startBid > 0 ? startBid : asking;
    } else if (listMode === "accept_offers") {
      mode = "accept_offers";
    }

    await env.CASES_DB.prepare(`
      INSERT INTO market_listings (
        seller_user_id, inventory_id, item_id, asking_price_pence, status, created_at,
        list_mode, auction_end_at, auction_start_bid_pence, current_bid_pence, current_high_bidder_id
      )
      VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, 0, NULL)
    `).bind(
      session.id,
      inventoryId,
      inv.item_id,
      asking,
      now,
      mode,
      auctionEnd,
      startBidPence
    ).run();

    return json({ success: true, message: "listed", list_mode: mode }, 200, request);
  }

  if (pathname === "/api/cs2/listings/buy" && request.method === "POST") {
    await ensureCaseProfile(env, session, isoNow);
    const body = await safeJson(request);
    const listingId = Number(body?.listing_id);

    if (!Number.isInteger(listingId) || listingId <= 0) {
      return json({ success: false, error: "A valid listing id is required" }, 400, request);
    }

    const listing = await env.CASES_DB.prepare(`
      SELECT * FROM market_listings WHERE id = ? AND status = 'active' LIMIT 1
    `).bind(listingId).first();

    if (!listing) {
      return json({ success: false, error: "Listing not found" }, 404, request);
    }

    if (Number(listing.seller_user_id) === Number(session.id)) {
      return json({ success: false, error: "You cannot buy your own listing" }, 400, request);
    }

    const mode = String(listing.list_mode || "fixed");
    if (mode === "auction") {
      return json({ success: false, error: "Use auction bidding for this listing" }, 400, request);
    }

    const price = Number(listing.asking_price_pence || 0);
    const buyerProfile = await env.CASES_DB.prepare(`
      SELECT balance FROM case_profiles WHERE user_id = ? LIMIT 1
    `).bind(session.id).first();

    const buyerBalance = Number(buyerProfile?.balance || 0);
    if (buyerBalance < price) {
      return json({ success: false, error: "Not enough Grev Coins" }, 400, request);
    }

    const inv = await env.CASES_DB.prepare(`
      SELECT * FROM inventory WHERE id = ? LIMIT 1
    `).bind(listing.inventory_id).first();

    if (!inv || Number(inv.user_id) !== Number(listing.seller_user_id)) {
      return json({ success: false, error: "Listing inventory mismatch" }, 400, request);
    }

    const item = await env.CASES_DB.prepare(`
      SELECT item_name FROM case_items WHERE id = ? LIMIT 1
    `).bind(listing.item_id).first();

    const now = isoNow();

    await env.CASES_DB.batch([
      env.CASES_DB.prepare(`
        UPDATE case_profiles
        SET balance = balance - ?, updated_at = ?
        WHERE user_id = ?
      `).bind(price, now, session.id),
      env.CASES_DB.prepare(`
        UPDATE case_profiles
        SET balance = balance + ?, updated_at = ?
        WHERE user_id = ?
      `).bind(price, now, listing.seller_user_id),
      env.CASES_DB.prepare(`
        UPDATE inventory
        SET user_id = ?
        WHERE id = ?
      `).bind(session.id, listing.inventory_id),
      env.CASES_DB.prepare(`
        UPDATE market_listings
        SET status = 'sold'
        WHERE id = ?
      `).bind(listingId),
      env.CASES_DB.prepare(`
        INSERT INTO trade_history (
          buyer_user_id,
          seller_user_id,
          item_id,
          item_name,
          price_pence,
          trade_type,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, 'market_buy', ?)
      `).bind(session.id, listing.seller_user_id, listing.item_id, item?.item_name || "Item", price, now)
    ]);

    await refreshInventoryValue(env, session.id);
    await refreshInventoryValue(env, listing.seller_user_id);

    const updated = await env.CASES_DB.prepare(`
      SELECT balance FROM case_profiles WHERE user_id = ? LIMIT 1
    `).bind(session.id).first();

    return json({
      success: true,
      message: "Purchase complete",
      balance_after_pence: Number(updated?.balance || 0)
    }, 200, request);
  }

  if (pathname === "/api/cs2/listings/cancel" && request.method === "POST") {
    const body = await safeJson(request);
    const listingId = Number(body?.listing_id);

    if (!Number.isInteger(listingId) || listingId <= 0) {
      return json({ success: false, error: "A valid listing id is required" }, 400, request);
    }

    const listing = await env.CASES_DB.prepare(`
      SELECT * FROM market_listings WHERE id = ? AND status = 'active' LIMIT 1
    `).bind(listingId).first();

    if (!listing) {
      return json({ success: false, error: "Listing not found" }, 404, request);
    }

    if (Number(listing.seller_user_id) !== Number(session.id)) {
      return json({ success: false, error: "You cannot cancel this listing" }, 403, request);
    }

    await env.CASES_DB.prepare(`
      UPDATE market_listings SET status = 'cancelled' WHERE id = ?
    `).bind(listingId).run();

    return json({ success: true, message: "Listing cancelled" }, 200, request);
  }

  if (pathname === "/api/cs2/auctions/bid" && request.method === "POST") {
    await ensureCaseProfile(env, session, isoNow);
    const body = await safeJson(request);
    const listingId = Number(body?.listing_id);
    const amount = Number(body?.amount_pence);

    if (!Number.isInteger(listingId) || listingId <= 0) {
      return json({ success: false, error: "A valid listing id is required" }, 400, request);
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      return json({ success: false, error: "A valid bid in pence is required" }, 400, request);
    }

    const listing = await env.CASES_DB.prepare(`
      SELECT * FROM market_listings WHERE id = ? AND status = 'active' LIMIT 1
    `).bind(listingId).first();

    if (!listing || String(listing.list_mode || "fixed") !== "auction") {
      return json({ success: false, error: "Not an active auction" }, 400, request);
    }

    const end = Date.parse(listing.auction_end_at || "");
    if (!Number.isFinite(end) || end < Date.now()) {
      return json({ success: false, error: "Auction has ended or has no end time" }, 400, request);
    }

    if (Number(listing.seller_user_id) === Number(session.id)) {
      return json({ success: false, error: "You cannot bid on your own auction" }, 400, request);
    }

    const floor = Math.max(
      Number(listing.current_bid_pence || 0),
      Number(listing.auction_start_bid_pence || listing.asking_price_pence || 0)
    );
    const minBid = floor + 50;

    if (amount < minBid) {
      return json({ success: false, error: `Minimum next bid is ${minBid} pence` }, 400, request);
    }

    const buyer = await env.CASES_DB.prepare(`
      SELECT balance FROM case_profiles WHERE user_id = ? LIMIT 1
    `).bind(session.id).first();

    if (Number(buyer?.balance || 0) < amount) {
      return json({ success: false, error: "Not enough Grev Coins to cover this bid" }, 400, request);
    }

    const now = isoNow();
    await env.CASES_DB.batch([
      env.CASES_DB.prepare(`
        UPDATE market_listings
        SET current_bid_pence = ?, current_high_bidder_id = ?
        WHERE id = ?
      `).bind(amount, session.id, listingId),
      env.CASES_DB.prepare(`
        INSERT INTO auction_bids (listing_id, bidder_user_id, amount_pence, created_at)
        VALUES (?, ?, ?, ?)
      `).bind(listingId, session.id, amount, now)
    ]);

    return json({ success: true, message: "Bid placed", current_bid_pence: amount }, 200, request);
  }

  if (pathname === "/api/cs2/auctions/finalize" && request.method === "POST") {
    await ensureCaseProfile(env, session, isoNow);
    const body = await safeJson(request);
    const listingId = Number(body?.listing_id);

    if (!Number.isInteger(listingId) || listingId <= 0) {
      return json({ success: false, error: "A valid listing id is required" }, 400, request);
    }

    const listing = await env.CASES_DB.prepare(`
      SELECT * FROM market_listings WHERE id = ? AND status = 'active' LIMIT 1
    `).bind(listingId).first();

    if (!listing || String(listing.list_mode || "") !== "auction") {
      return json({ success: false, error: "Not an active auction" }, 400, request);
    }

    const end = Date.parse(listing.auction_end_at || "");
    if (!Number.isFinite(end) || end > Date.now()) {
      return json({ success: false, error: "Auction has not ended yet" }, 400, request);
    }

    if (Number(listing.seller_user_id) !== Number(session.id)) {
      return json({ success: false, error: "Only the seller can finalize this auction" }, 403, request);
    }

    const winnerId = Number(listing.current_high_bidder_id || 0);
    const price = Number(listing.current_bid_pence || 0);
    if (!winnerId || !price) {
      await env.CASES_DB.prepare(`UPDATE market_listings SET status = 'cancelled' WHERE id = ?`).bind(listingId).run();
      return json({ success: true, message: "Auction ended with no bids" }, 200, request);
    }

    const inv = await env.CASES_DB.prepare(`SELECT * FROM inventory WHERE id = ? LIMIT 1`)
      .bind(listing.inventory_id)
      .first();

    if (!inv || Number(inv.user_id) !== Number(listing.seller_user_id)) {
      return json({ success: false, error: "Listing inventory mismatch" }, 400, request);
    }

    const item = await env.CASES_DB.prepare(`SELECT item_name FROM case_items WHERE id = ? LIMIT 1`)
      .bind(listing.item_id)
      .first();

    const now = isoNow();

    await env.CASES_DB.batch([
      env.CASES_DB.prepare(`
        UPDATE case_profiles SET balance = balance - ?, updated_at = ? WHERE user_id = ?
      `).bind(price, now, winnerId),
      env.CASES_DB.prepare(`
        UPDATE case_profiles SET balance = balance + ?, updated_at = ? WHERE user_id = ?
      `).bind(price, now, listing.seller_user_id),
      env.CASES_DB.prepare(`
        UPDATE inventory SET user_id = ? WHERE id = ?
      `).bind(winnerId, listing.inventory_id),
      env.CASES_DB.prepare(`UPDATE market_listings SET status = 'sold' WHERE id = ?`).bind(listingId),
      env.CASES_DB.prepare(`
        INSERT INTO trade_history (buyer_user_id, seller_user_id, item_id, item_name, price_pence, trade_type, created_at)
        VALUES (?, ?, ?, ?, ?, 'auction_win', ?)
      `).bind(winnerId, listing.seller_user_id, listing.item_id, item?.item_name || "Item", price, now)
    ]);

    await refreshInventoryValue(env, winnerId);
    await refreshInventoryValue(env, listing.seller_user_id);

    return json({ success: true, message: "Auction finalized" }, 200, request);
  }

  if (pathname === "/api/cs2/offers" && request.method === "POST") {
    await ensureCaseProfile(env, session, isoNow);
    const body = await safeJson(request);
    const listingId = Number(body?.listing_id);
    const offerPence = Number(body?.offer_pence);
    const commentRaw = typeof body?.comment === "string" ? body.comment.trim() : "";
    const buyerComment = commentRaw.slice(0, 2000) || null;

    if (!Number.isInteger(listingId) || listingId <= 0) {
      return json({ success: false, error: "A valid listing id is required" }, 400, request);
    }

    if (!Number.isInteger(offerPence) || offerPence <= 0) {
      return json({ success: false, error: "A valid offer in pence is required" }, 400, request);
    }

    const listing = await env.CASES_DB.prepare(`
      SELECT * FROM market_listings WHERE id = ? AND status = 'active' LIMIT 1
    `).bind(listingId).first();

    if (!listing || String(listing.list_mode || "") !== "accept_offers") {
      return json({ success: false, error: "This listing does not accept open offers" }, 400, request);
    }

    if (Number(listing.seller_user_id) === Number(session.id)) {
      return json({ success: false, error: "You cannot offer on your own listing" }, 400, request);
    }

    const now = isoNow();
    const ins = await env.CASES_DB.prepare(`
      INSERT INTO market_offers (
        listing_id,
        buyer_user_id,
        offer_pence,
        status,
        created_at,
        buyer_comment
      )
      VALUES (?, ?, ?, 'pending', ?, ?)
    `)
      .bind(listingId, session.id, offerPence, now, buyerComment)
      .run();

    const offerId = ins.meta?.last_row_id;
    if (buyerComment && offerId) {
      await env.CASES_DB.prepare(`
        INSERT INTO offer_messages (offer_id, author_user_id, body, created_at)
        VALUES (?, ?, ?, ?)
      `)
        .bind(offerId, session.id, buyerComment, now)
        .run();
    }

    return json({ success: true, message: "Offer submitted", offer_id: offerId }, 200, request);
  }

  if (pathname === "/api/cs2/offers/accept" && request.method === "POST") {
    await ensureCaseProfile(env, session, isoNow);
    const body = await safeJson(request);
    const offerId = Number(body?.offer_id);

    if (!Number.isInteger(offerId) || offerId <= 0) {
      return json({ success: false, error: "A valid offer id is required" }, 400, request);
    }

    const offer = await env.CASES_DB.prepare(`
      SELECT o.*, l.seller_user_id, l.inventory_id, l.item_id, l.status AS list_status
      FROM market_offers o
      INNER JOIN market_listings l ON l.id = o.listing_id
      WHERE o.id = ? AND o.status = 'pending'
      LIMIT 1
    `).bind(offerId).first();

    if (!offer || offer.list_status !== "active") {
      return json({ success: false, error: "Offer not found" }, 404, request);
    }

    if (Number(offer.seller_user_id) !== Number(session.id)) {
      return json({ success: false, error: "Only the seller can accept" }, 403, request);
    }

    const counter = Number(offer.seller_counter_pence || 0);
    if (counter > 0) {
      return json(
        {
          success: false,
          error: "You sent a counter-offer — wait for the buyer to accept it, or post a new counter"
        },
        400,
        request
      );
    }

    const price = Number(offer.offer_pence || 0);
    const buyerId = Number(offer.buyer_user_id);
    const listingId = Number(offer.listing_id);

    const buyerBal = await env.CASES_DB.prepare(`SELECT balance FROM case_profiles WHERE user_id = ? LIMIT 1`)
      .bind(buyerId)
      .first();

    if (Number(buyerBal?.balance || 0) < price) {
      return json({ success: false, error: "Buyer no longer has enough balance" }, 400, request);
    }

    const item = await env.CASES_DB.prepare(`SELECT item_name FROM case_items WHERE id = ? LIMIT 1`)
      .bind(offer.item_id)
      .first();

    const now = isoNow();

    await env.CASES_DB.batch([
      env.CASES_DB.prepare(`UPDATE case_profiles SET balance = balance - ?, updated_at = ? WHERE user_id = ?`)
        .bind(price, now, buyerId),
      env.CASES_DB.prepare(`UPDATE case_profiles SET balance = balance + ?, updated_at = ? WHERE user_id = ?`)
        .bind(price, now, session.id),
      env.CASES_DB.prepare(`UPDATE inventory SET user_id = ? WHERE id = ?`).bind(buyerId, offer.inventory_id),
      env.CASES_DB.prepare(`UPDATE market_listings SET status = 'sold' WHERE id = ?`).bind(listingId),
      env.CASES_DB.prepare(`UPDATE market_offers SET status = 'rejected' WHERE listing_id = ? AND id != ?`)
        .bind(listingId, offerId),
      env.CASES_DB.prepare(`UPDATE market_offers SET status = 'accepted' WHERE id = ?`).bind(offerId),
      env.CASES_DB.prepare(`
        INSERT INTO trade_history (buyer_user_id, seller_user_id, item_id, item_name, price_pence, trade_type, created_at)
        VALUES (?, ?, ?, ?, ?, 'offer_accept', ?)
      `).bind(buyerId, session.id, offer.item_id, item?.item_name || "Item", price, now)
    ]);

    await refreshInventoryValue(env, buyerId);
    await refreshInventoryValue(env, session.id);

    return json({ success: true, message: "Offer accepted" }, 200, request);
  }

  if (pathname === "/api/cs2/offers/incoming" && request.method === "GET") {
    await ensureCaseProfile(env, session, isoNow);
    const rows = await env.CASES_DB.prepare(`
      SELECT
        o.id,
        o.listing_id,
        o.buyer_user_id,
        o.offer_pence,
        o.created_at,
        o.buyer_comment,
        o.seller_counter_pence,
        o.seller_counter_message,
        ci.item_name,
        ci.image_url,
        ci.wear,
        ci.wear_code,
        ci.rarity
      FROM market_offers o
      INNER JOIN market_listings l ON l.id = o.listing_id AND l.status = 'active'
      INNER JOIN case_items ci ON ci.id = l.item_id
      WHERE o.status = 'pending' AND l.seller_user_id = ?
      ORDER BY o.id DESC
      LIMIT 80
    `).bind(session.id).all();

    const list = rows.results || [];
    const buyers = await resolveUsernames(env, list.map((r) => Number(r.buyer_user_id)));

    const offers = [];
    for (const r of list) {
      offers.push({
        offer_id: r.id,
        listing_id: r.listing_id,
        buyer_user_id: r.buyer_user_id,
        buyer: buyers.get(Number(r.buyer_user_id)) || `user#${r.buyer_user_id}`,
        offer_pence: Number(r.offer_pence || 0),
        buyer_comment: r.buyer_comment || "",
        seller_counter_pence: r.seller_counter_pence != null ? Number(r.seller_counter_pence) : null,
        seller_counter_message: r.seller_counter_message || "",
        created_at: r.created_at,
        item_name: r.item_name,
        image_url: await ensureItemImageUrl(env, r),
        wear: r.wear || "",
        wear_code: r.wear_code || "",
        rarity: r.rarity || ""
      });
    }

    return json({ success: true, offers }, 200, request);
  }

  if (pathname === "/api/cs2/offers/outgoing" && request.method === "GET") {
    await ensureCaseProfile(env, session, isoNow);
    const rows = await env.CASES_DB.prepare(`
      SELECT
        o.id,
        o.listing_id,
        o.offer_pence,
        o.created_at,
        o.buyer_comment,
        o.seller_counter_pence,
        o.seller_counter_message,
        l.seller_user_id,
        ci.item_name,
        ci.image_url,
        ci.wear,
        ci.wear_code,
        ci.rarity
      FROM market_offers o
      INNER JOIN market_listings l ON l.id = o.listing_id AND l.status = 'active'
      INNER JOIN case_items ci ON ci.id = l.item_id
      WHERE o.status = 'pending' AND o.buyer_user_id = ?
      ORDER BY o.id DESC
      LIMIT 80
    `).bind(session.id).all();

    const list = rows.results || [];
    const sellers = await resolveUsernames(env, list.map((r) => Number(r.seller_user_id)));

    const offers = [];
    for (const r of list) {
      offers.push({
        offer_id: r.id,
        listing_id: r.listing_id,
        seller_user_id: r.seller_user_id,
        seller: sellers.get(Number(r.seller_user_id)) || `user#${r.seller_user_id}`,
        offer_pence: Number(r.offer_pence || 0),
        buyer_comment: r.buyer_comment || "",
        seller_counter_pence: r.seller_counter_pence != null ? Number(r.seller_counter_pence) : null,
        seller_counter_message: r.seller_counter_message || "",
        created_at: r.created_at,
        item_name: r.item_name,
        image_url: await ensureItemImageUrl(env, r),
        wear: r.wear || "",
        wear_code: r.wear_code || "",
        rarity: r.rarity || ""
      });
    }

    return json({ success: true, offers }, 200, request);
  }

  if (pathname === "/api/cs2/offers/thread" && request.method === "GET") {
    await ensureCaseProfile(env, session, isoNow);
    const offerId = Number(url.searchParams.get("offer_id"));
    if (!Number.isInteger(offerId) || offerId <= 0) {
      return json({ success: false, error: "offer_id is required" }, 400, request);
    }

    const offer = await env.CASES_DB.prepare(`
      SELECT o.*, l.seller_user_id, l.status AS list_status
      FROM market_offers o
      INNER JOIN market_listings l ON l.id = o.listing_id
      WHERE o.id = ?
      LIMIT 1
    `)
      .bind(offerId)
      .first();

    if (!offer) {
      return json({ success: false, error: "Offer not found" }, 404, request);
    }

    const uid = Number(session.id);
    if (Number(offer.buyer_user_id) !== uid && Number(offer.seller_user_id) !== uid) {
      return json({ success: false, error: "Forbidden" }, 403, request);
    }

    const msgs = await env.CASES_DB.prepare(`
      SELECT id, author_user_id, body, created_at
      FROM offer_messages
      WHERE offer_id = ?
      ORDER BY id ASC
    `)
      .bind(offerId)
      .all();

    const authors = await resolveUsernames(
      env,
      (msgs.results || []).map((m) => Number(m.author_user_id))
    );

    return json(
      {
        success: true,
        offer: {
          offer_id: offer.id,
          listing_id: offer.listing_id,
          buyer_user_id: offer.buyer_user_id,
          seller_user_id: offer.seller_user_id,
          offer_pence: Number(offer.offer_pence || 0),
          buyer_comment: offer.buyer_comment || "",
          seller_counter_pence:
            offer.seller_counter_pence != null ? Number(offer.seller_counter_pence) : null,
          seller_counter_message: offer.seller_counter_message || "",
          status: offer.status,
          created_at: offer.created_at
        },
        messages: (msgs.results || []).map((m) => ({
          id: m.id,
          author_user_id: m.author_user_id,
          author: authors.get(Number(m.author_user_id)) || `user#${m.author_user_id}`,
          body: m.body,
          created_at: m.created_at
        }))
      },
      200,
      request
    );
  }

  if (pathname === "/api/cs2/offers/message" && request.method === "POST") {
    await ensureCaseProfile(env, session, isoNow);
    const body = await safeJson(request);
    const offerId = Number(body?.offer_id);
    const text = typeof body?.message === "string" ? body.message.trim().slice(0, 2000) : "";

    if (!Number.isInteger(offerId) || offerId <= 0) {
      return json({ success: false, error: "A valid offer id is required" }, 400, request);
    }
    if (!text) {
      return json({ success: false, error: "message is required" }, 400, request);
    }

    const offer = await env.CASES_DB.prepare(`
      SELECT o.id, o.buyer_user_id, o.status, l.seller_user_id, l.status AS list_status
      FROM market_offers o
      INNER JOIN market_listings l ON l.id = o.listing_id
      WHERE o.id = ?
      LIMIT 1
    `)
      .bind(offerId)
      .first();

    if (!offer || offer.status !== "pending" || offer.list_status !== "active") {
      return json({ success: false, error: "Offer not open for messages" }, 400, request);
    }

    const uid = Number(session.id);
    if (Number(offer.buyer_user_id) !== uid && Number(offer.seller_user_id) !== uid) {
      return json({ success: false, error: "Forbidden" }, 403, request);
    }

    const now = isoNow();
    await env.CASES_DB.prepare(`
      INSERT INTO offer_messages (offer_id, author_user_id, body, created_at)
      VALUES (?, ?, ?, ?)
    `)
      .bind(offerId, session.id, text, now)
      .run();

    return json({ success: true, message: "Sent" }, 200, request);
  }

  if (pathname === "/api/cs2/offers/counter" && request.method === "POST") {
    await ensureCaseProfile(env, session, isoNow);
    const body = await safeJson(request);
    const offerId = Number(body?.offer_id);
    const counterPence = Number(body?.counter_pence);
    const msgRaw = typeof body?.message === "string" ? body.message.trim().slice(0, 2000) : "";

    if (!Number.isInteger(offerId) || offerId <= 0) {
      return json({ success: false, error: "A valid offer id is required" }, 400, request);
    }
    if (!Number.isInteger(counterPence) || counterPence <= 0) {
      return json({ success: false, error: "A valid counter price in pence is required" }, 400, request);
    }

    const offer = await env.CASES_DB.prepare(`
      SELECT o.*, l.seller_user_id, l.status AS list_status
      FROM market_offers o
      INNER JOIN market_listings l ON l.id = o.listing_id
      WHERE o.id = ? AND o.status = 'pending'
      LIMIT 1
    `)
      .bind(offerId)
      .first();

    if (!offer || offer.list_status !== "active") {
      return json({ success: false, error: "Offer not found" }, 404, request);
    }

    if (Number(offer.seller_user_id) !== Number(session.id)) {
      return json({ success: false, error: "Only the seller can counter" }, 403, request);
    }

    const now = isoNow();
    await env.CASES_DB.prepare(`
      UPDATE market_offers
      SET seller_counter_pence = ?, seller_counter_message = ?
      WHERE id = ?
    `)
      .bind(counterPence, msgRaw || null, offerId)
      .run();

    const line = msgRaw
      ? `Counter: ${counterPence} p — ${msgRaw}`
      : `Counter: ${counterPence} p`;
    await env.CASES_DB.prepare(`
      INSERT INTO offer_messages (offer_id, author_user_id, body, created_at)
      VALUES (?, ?, ?, ?)
    `)
      .bind(offerId, session.id, line, now)
      .run();

    return json({ success: true, message: "Counter sent", seller_counter_pence: counterPence }, 200, request);
  }

  if (pathname === "/api/cs2/offers/accept-counter" && request.method === "POST") {
    await ensureCaseProfile(env, session, isoNow);
    const body = await safeJson(request);
    const offerId = Number(body?.offer_id);

    if (!Number.isInteger(offerId) || offerId <= 0) {
      return json({ success: false, error: "A valid offer id is required" }, 400, request);
    }

    const offer = await env.CASES_DB.prepare(`
      SELECT o.*, l.seller_user_id, l.inventory_id, l.item_id, l.status AS list_status
      FROM market_offers o
      INNER JOIN market_listings l ON l.id = o.listing_id
      WHERE o.id = ? AND o.status = 'pending'
      LIMIT 1
    `)
      .bind(offerId)
      .first();

    if (!offer || offer.list_status !== "active") {
      return json({ success: false, error: "Offer not found" }, 404, request);
    }

    if (Number(offer.buyer_user_id) !== Number(session.id)) {
      return json({ success: false, error: "Only the buyer can accept the seller's counter" }, 403, request);
    }

    const price = Number(offer.seller_counter_pence || 0);
    if (!price || price <= 0) {
      return json({ success: false, error: "There is no counter to accept" }, 400, request);
    }

    const buyerId = Number(offer.buyer_user_id);
    const sellerId = Number(offer.seller_user_id);
    const listingId = Number(offer.listing_id);

    const buyerBal = await env.CASES_DB.prepare(`SELECT balance FROM case_profiles WHERE user_id = ? LIMIT 1`)
      .bind(buyerId)
      .first();

    if (Number(buyerBal?.balance || 0) < price) {
      return json({ success: false, error: "You no longer have enough balance" }, 400, request);
    }

    const item = await env.CASES_DB.prepare(`SELECT item_name FROM case_items WHERE id = ? LIMIT 1`)
      .bind(offer.item_id)
      .first();

    const now = isoNow();

    await env.CASES_DB.batch([
      env.CASES_DB.prepare(`UPDATE case_profiles SET balance = balance - ?, updated_at = ? WHERE user_id = ?`)
        .bind(price, now, buyerId),
      env.CASES_DB.prepare(`UPDATE case_profiles SET balance = balance + ?, updated_at = ? WHERE user_id = ?`)
        .bind(price, now, sellerId),
      env.CASES_DB.prepare(`UPDATE inventory SET user_id = ? WHERE id = ?`).bind(buyerId, offer.inventory_id),
      env.CASES_DB.prepare(`UPDATE market_listings SET status = 'sold' WHERE id = ?`).bind(listingId),
      env.CASES_DB.prepare(`UPDATE market_offers SET status = 'rejected' WHERE listing_id = ? AND id != ?`)
        .bind(listingId, offerId),
      env.CASES_DB.prepare(`UPDATE market_offers SET status = 'accepted' WHERE id = ?`).bind(offerId),
      env.CASES_DB.prepare(`
        INSERT INTO trade_history (buyer_user_id, seller_user_id, item_id, item_name, price_pence, trade_type, created_at)
        VALUES (?, ?, ?, ?, ?, 'offer_counter_accept', ?)
      `).bind(buyerId, sellerId, offer.item_id, item?.item_name || "Item", price, now)
    ]);

    await refreshInventoryValue(env, buyerId);
    await refreshInventoryValue(env, sellerId);

    return json({ success: true, message: "Counter accepted — trade complete" }, 200, request);
  }

  if (pathname === "/api/cs2/showcase" && request.method === "POST") {
    await ensureCaseProfile(env, session, isoNow);
    const body = await safeJson(request);
    const slot = Number(body?.slot);
    const inventoryId = Number(body?.inventory_id);

    if (!Number.isInteger(slot) || slot < 0 || slot > 4) {
      return json({ success: false, error: "slot must be 0–4" }, 400, request);
    }

    if (!Number.isInteger(inventoryId) || inventoryId < 0) {
      return json({ success: false, error: "A valid inventory id is required" }, 400, request);
    }

    if (inventoryId === 0) {
      await env.CASES_DB.prepare(`
        DELETE FROM profile_showcase WHERE user_id = ? AND slot = ?
      `).bind(session.id, slot).run();
      return json({ success: true, message: "Showcase slot cleared" }, 200, request);
    }

    const inv = await env.CASES_DB.prepare(`
      SELECT * FROM inventory WHERE id = ? AND user_id = ? LIMIT 1
    `).bind(inventoryId, session.id).first();

    if (!inv) {
      return json({ success: false, error: "Inventory item not found" }, 404, request);
    }

    const ci = await env.CASES_DB.prepare(`SELECT item_kind FROM case_items WHERE id = ? LIMIT 1`)
      .bind(inv.item_id)
      .first();

    if (!ci || ci.item_kind !== "skin") {
      return json({ success: false, error: "Only skins can be showcased" }, 400, request);
    }

    await env.CASES_DB.prepare(`
      INSERT INTO profile_showcase (user_id, slot, inventory_id)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, slot) DO UPDATE SET inventory_id = excluded.inventory_id
    `).bind(session.id, slot, inventoryId).run();

    return json({ success: true, message: "Showcase updated" }, 200, request);
  }

  if (pathname === "/api/cs2/prices/refresh" && request.method === "POST") {
    const body = await safeJson(request);
    const hash = typeof body?.market_hash_name === "string" ? body.market_hash_name.trim() : "";
    if (!hash) {
      return json({ success: false, error: "market_hash_name is required" }, 400, request);
    }

    const price = await getOrFetchItemPricePence(env, hash);
    return json({ success: true, market_hash_name: hash, price_pence: price }, 200, request);
  }

  if (pathname.startsWith("/api/cs2")) {
    return json({ success: false, error: "Not found" }, 404, request);
  }

  return null;
}
