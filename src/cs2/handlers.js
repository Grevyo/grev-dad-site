import {
  KEY_PRICE_PENCE,
  QUICK_SELL_FRACTION,
  STARTING_BALANCE_PENCE
} from "./constants.js";
import { getOrFetchItemPricePence } from "./steam.js";

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
  const row = await env.CASES_DB.prepare(`
    SELECT COALESCE(SUM(ci.market_value), 0) AS total
    FROM inventory i
    INNER JOIN case_items ci ON ci.id = i.item_id
    WHERE i.user_id = ? AND ci.item_kind = 'skin'
  `).bind(userId).first();

  const total = Number(row?.total || 0);

  await env.CASES_DB.prepare(`
    UPDATE case_profiles
    SET total_inventory_value = ?, updated_at = ?
    WHERE user_id = ?
  `).bind(total, new Date().toISOString(), userId).run();

  return total;
}

async function ensureCaseProfile(env, session, isoNowFn) {
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
  `).bind(session.id, session.username, STARTING_BALANCE_PENCE, now, now).run();
}

async function getCaseStorePricePence(env, caseRow) {
  const hash = caseRow.steam_market_hash_name || caseRow.case_name;
  const live = await getOrFetchItemPricePence(env, hash);
  if (live != null && live > 0) return live;
  return Number(caseRow.fallback_price_pence || caseRow.price || 0);
}

export async function handleCs2Request(request, env, deps) {
  const { json, getApprovedUser, requireAdmin, isoNow, safeJson } = deps;
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
      const storePrice = await getCaseStorePricePence(env, row);
      cases.push({
        id: row.id,
        case_name: row.case_name,
        slug: row.slug,
        image_url: row.image_url || "",
        description: row.description || "",
        store_price_pence: storePrice,
        key_price_pence: KEY_PRICE_PENCE
      });
    }

    return json({ success: true, cases, key_price_pence: KEY_PRICE_PENCE }, 200, request);
  }

  /* ------------------------------ Feeds ----------------------------------- */
  if (pathname === "/api/cs2/feed/opens" && request.method === "GET") {
    const limit = Math.min(Number(url.searchParams.get("limit") || 40), 120);
    const rows = await env.CASES_DB.prepare(`
      SELECT h.id, h.user_id, h.case_id, h.item_id, h.price_paid, h.opened_at,
             c.case_name,
             i.item_name,
             i.rarity,
             i.color_hex
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
      SELECT h.opened_at, h.price_paid, c.case_name, i.item_name, i.rarity, i.color_hex
      FROM case_open_history h
      INNER JOIN case_definitions c ON c.id = h.case_id
      INNER JOIN case_items i ON i.id = h.item_id
      WHERE h.user_id = ?
      ORDER BY h.id DESC
      LIMIT 30
    `).bind(userId).all();

    const inv = await env.CASES_DB.prepare(`
      SELECT i.id, ci.item_name, ci.rarity, ci.color_hex, ci.item_kind, i.acquired_at
      FROM inventory i
      INNER JOIN case_items ci ON ci.id = i.item_id
      WHERE i.user_id = ?
      ORDER BY i.id DESC
      LIMIT 40
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
      recent_inventory: inv.results || []
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
        ci.item_name,
        ci.rarity,
        ci.color_hex,
        ci.market_hash_name
      FROM market_listings l
      INNER JOIN case_items ci ON ci.id = l.item_id
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

    return json({
      success: true,
      listings: listings.map((r) => ({
        id: r.id,
        seller: names.get(Number(r.seller_user_id)) || `user#${r.seller_user_id}`,
        seller_user_id: r.seller_user_id,
        inventory_id: r.inventory_id,
        item_id: r.item_id,
        item_name: r.item_name,
        rarity: r.rarity,
        color_hex: r.color_hex || "",
        asking_price_pence: Number(r.asking_price_pence || 0),
        created_at: r.created_at
      }))
    }, 200, request);
  }

  if (pathname === "/api/cs2/admin/cases" && request.method === "GET") {
    const admin = await requireAdmin(request, env);
    if (admin instanceof Response) return admin;

    const rows = await env.CASES_DB.prepare(`
      SELECT id, case_name, slug, image_url, price, description, is_active, steam_market_hash_name, fallback_price_pence
      FROM case_definitions
      ORDER BY case_name ASC
    `).all();

    return json({ success: true, cases: rows.results || [] }, 200, request);
  }

  if (pathname === "/api/cs2/admin/cases/toggle" && request.method === "POST") {
    const admin = await requireAdmin(request, env);
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
    const admin = await requireAdmin(request, env);
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
        i.source_case_id,
        i.acquired_at,
        i.locked,
        ci.item_name,
        ci.item_kind,
        ci.rarity,
        ci.wear,
        ci.market_value,
        ci.color_hex,
        ci.market_hash_name,
        cd.case_name AS source_case_name
      FROM inventory i
      INNER JOIN case_items ci ON ci.id = i.item_id
      LEFT JOIN case_definitions cd ON cd.id = i.source_case_id
      WHERE i.user_id = ?
      ORDER BY i.id DESC
    `).bind(session.id).all();

    const items = (rows.results || []).map((r) => ({
      inventory_id: r.id,
      item_id: r.item_id,
      item_kind: r.item_kind || "skin",
      item_name: r.item_name,
      rarity: r.rarity,
      wear: r.wear,
      market_value_pence: Number(r.market_value || 0),
      color_hex: r.color_hex || "",
      market_hash_name: r.market_hash_name || "",
      acquired_at: r.acquired_at,
      acquired_from_case: r.source_case_name || "",
      locked: Boolean(r.locked)
    }));

    return json({ success: true, items }, 200, request);
  }

  if (pathname === "/api/cs2/store/buy-case" && request.method === "POST") {
    await ensureCaseProfile(env, session, isoNow);
    const body = await safeJson(request);
    const caseId = Number(body?.case_id);

    if (!Number.isInteger(caseId) || caseId <= 0) {
      return json({ success: false, error: "A valid case id is required" }, 400, request);
    }

    const caseRow = await env.CASES_DB.prepare(`
      SELECT * FROM case_definitions WHERE id = ? LIMIT 1
    `).bind(caseId).first();

    if (!caseRow || !Number(caseRow.is_active)) {
      return json({ success: false, error: "Case is not available" }, 404, request);
    }

    const price = await getCaseStorePricePence(env, caseRow)
      || Number(caseRow.fallback_price_pence || caseRow.price || 0);

    if (!price || price <= 0) {
      return json({ success: false, error: "Case price is unavailable" }, 400, request);
    }

    const profile = await env.CASES_DB.prepare(`
      SELECT balance FROM case_profiles WHERE user_id = ? LIMIT 1
    `).bind(session.id).first();

    const balance = Number(profile?.balance || 0);
    if (balance < price) {
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

    await env.CASES_DB.batch([
      env.CASES_DB.prepare(`
        UPDATE case_profiles
        SET balance = balance - ?, total_spent = total_spent + ?, updated_at = ?
        WHERE user_id = ?
      `).bind(price, price, stamp, session.id),
      env.CASES_DB.prepare(`
        INSERT INTO inventory (user_id, item_id, source_case_id, acquired_at, locked)
        VALUES (?, ?, NULL, ?, 0)
      `).bind(session.id, sku.id, now),
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
      `).bind(session.id, sku.id, `${caseRow.case_name} (Unopened)`, price, now)
    ]);

    await refreshInventoryValue(env, session.id);

    return json({
      success: true,
      message: "Case purchased",
      spent_pence: price,
      balance_after_pence: balance - price
    }, 200, request);
  }

  if (pathname === "/api/cs2/open" && request.method === "POST") {
    await ensureCaseProfile(env, session, isoNow);
    const body = await safeJson(request);
    const inventoryId = Number(body?.inventory_id);

    if (!Number.isInteger(inventoryId) || inventoryId <= 0) {
      return json({ success: false, error: "A valid inventory id is required" }, 400, request);
    }

    const inv = await env.CASES_DB.prepare(`
      SELECT i.*, ci.item_kind, ci.case_def_id, cd.id AS case_def_pk, cd.case_name
      FROM inventory i
      INNER JOIN case_items ci ON ci.id = i.item_id
      INNER JOIN case_definitions cd ON cd.id = ci.case_def_id
      WHERE i.id = ? AND i.user_id = ?
      LIMIT 1
    `).bind(inventoryId, session.id).first();

    if (!inv || inv.item_kind !== "case") {
      return json({ success: false, error: "That inventory item is not an unopened case" }, 400, request);
    }

    const caseId = Number(inv.case_def_pk);
    const profile = await env.CASES_DB.prepare(`
      SELECT balance FROM case_profiles WHERE user_id = ? LIMIT 1
    `).bind(session.id).first();

    const balance = Number(profile?.balance || 0);
    if (balance < KEY_PRICE_PENCE) {
      return json({ success: false, error: "Not enough Grev Coins for a key (£2.50)" }, 400, request);
    }

    const drops = await env.CASES_DB.prepare(`
      SELECT cd.item_id, cd.drop_weight, ci.item_name, ci.rarity, ci.color_hex
      FROM case_drops cd
      INNER JOIN case_items ci ON ci.id = cd.item_id
      WHERE cd.case_id = ? AND cd.drop_weight > 0 AND ci.item_kind = 'skin'
    `).bind(caseId).all();

    const picked = pickWeighted(drops.results || []);
    if (!picked) {
      return json({ success: false, error: "No drops configured for this case" }, 500, request);
    }

    const now = isoNow();
    const stamp = now;
    const totalPaid = KEY_PRICE_PENCE;

    const newInv = await env.CASES_DB.prepare(`
      INSERT INTO inventory (user_id, item_id, source_case_id, acquired_at, locked)
      VALUES (?, ?, ?, ?, 0)
    `).bind(session.id, picked.item_id, caseId, now).run();

    const newInventoryId = newInv.meta?.last_row_id;

    await env.CASES_DB.batch([
      env.CASES_DB.prepare(`DELETE FROM inventory WHERE id = ?`).bind(inventoryId),
      env.CASES_DB.prepare(`
        UPDATE case_profiles
        SET
          balance = balance - ?,
          total_spent = total_spent + ?,
          total_cases_opened = total_cases_opened + 1,
          updated_at = ?
        WHERE user_id = ?
      `).bind(KEY_PRICE_PENCE, KEY_PRICE_PENCE, stamp, session.id),
      env.CASES_DB.prepare(`
        INSERT INTO case_open_history (user_id, case_id, item_id, price_paid, opened_at)
        VALUES (?, ?, ?, ?, ?)
      `).bind(session.id, caseId, picked.item_id, totalPaid, now)
    ]);

    await refreshInventoryValue(env, session.id);

    const updated = await env.CASES_DB.prepare(`
      SELECT balance FROM case_profiles WHERE user_id = ? LIMIT 1
    `).bind(session.id).first();

    return json({
      success: true,
      message: "Case opened",
      dropped: {
        item_id: picked.item_id,
        item_name: picked.item_name,
        rarity: picked.rarity,
        color_hex: picked.color_hex || ""
      },
      case_name: inv.case_name,
      key_price_pence: KEY_PRICE_PENCE,
      inventory_id: newInventoryId,
      balance_after_pence: Number(updated?.balance || 0)
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

    const payout = Math.max(1, Math.floor(marketPrice * QUICK_SELL_FRACTION));
    const now = isoNow();

    await env.CASES_DB.batch([
      env.CASES_DB.prepare(`DELETE FROM inventory WHERE id = ?`).bind(inventoryId),
      env.CASES_DB.prepare(`
        UPDATE case_profiles
        SET balance = balance + ?, updated_at = ?
        WHERE user_id = ?
      `).bind(payout, now, session.id),
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

    await refreshInventoryValue(env, session.id);

    const updated = await env.CASES_DB.prepare(`
      SELECT balance FROM case_profiles WHERE user_id = ? LIMIT 1
    `).bind(session.id).first();

    return json({
      success: true,
      message: "Quick sold",
      market_reference_pence: marketPrice,
      payout_pence: payout,
      balance_after_pence: Number(updated?.balance || 0)
    }, 200, request);
  }

  if (pathname === "/api/cs2/listings" && request.method === "POST") {
    await ensureCaseProfile(env, session, isoNow);
    const body = await safeJson(request);
    const inventoryId = Number(body?.inventory_id);
    const asking = Number(body?.asking_price_pence);

    if (!Number.isInteger(inventoryId) || inventoryId <= 0) {
      return json({ success: false, error: "A valid inventory id is required" }, 400, request);
    }

    if (!Number.isInteger(asking) || asking <= 0) {
      return json({ success: false, error: "A valid asking price in pence is required" }, 400, request);
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
    await env.CASES_DB.prepare(`
      INSERT INTO market_listings (seller_user_id, inventory_id, item_id, asking_price_pence, status, created_at)
      VALUES (?, ?, ?, ?, 'active', ?)
    `).bind(session.id, inventoryId, inv.item_id, asking, now).run();

    return json({ success: true, message: "listed" }, 200, request);
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
