import { STEAM_APPID_CS2, STEAM_CURRENCY_GBP } from "./constants.js";

function normalizeMarketName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function pickBestSteamResult(results, marketHashName) {
  const target = normalizeMarketName(marketHashName);
  return (results || []).find((entry) => {
    const desc = entry?.asset_description || {};
    return [entry?.hash_name, entry?.name, desc?.market_hash_name, desc?.name]
      .some((value) => normalizeMarketName(value) === target);
  }) || (results || [])[0] || null;
}

/**
 * Fetches median/last Steam Community Market price for CS2 (appid 730), GBP.
 * Returns price in pence or null if unavailable.
 */
export async function fetchSteamPricePence(marketHashName) {
  if (!marketHashName || typeof marketHashName !== "string") return null;

  const encoded = encodeURIComponent(marketHashName);
  const url = `https://steamcommunity.com/market/priceoverview/?appid=${STEAM_APPID_CS2}&currency=${STEAM_CURRENCY_GBP}&market_hash_name=${encoded}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; GrevDadBot/1.0)"
    }
  });

  if (!response.ok) return null;

  let data;
  try {
    data = await response.json();
  } catch {
    return null;
  }

  if (!data || !data.success) return null;

  const raw = data.median_price || data.lowest_price || "";
  const pence = parseSteamGbpToPence(raw);
  return pence;
}

function parseSteamGbpToPence(value) {
  if (!value || typeof value !== "string") return null;
  const cleaned = value.replace(/£/g, "").replace(/,/g, "").trim();
  const num = Number.parseFloat(cleaned);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}

export async function getOrFetchItemPricePence(env, marketHashName, nowMs = Date.now()) {
  if (!env.CASES_DB || !marketHashName) return null;

  const cached = await getCachedItemPrice(env, marketHashName);
  const currentBucket = getPriceBucketIso(nowMs);
  if (cached?.updated_at && cached.updated_at === currentBucket) {
    return Number(cached.price_pence) || null;
  }

  const live = await fetchAndStoreItemPricePence(env, marketHashName, nowMs);
  if (live != null && live > 0) {
    return live;
  }

  if (cached && Number(cached.price_pence) > 0) {
    return Number(cached.price_pence);
  }

  return null;
}

async function getCachedItemPrice(env, marketHashName) {
  if (!env.CASES_DB || !marketHashName) return null;

  return await env.CASES_DB.prepare(`
    SELECT price_pence, updated_at
    FROM market_price_cache
    WHERE market_hash_name = ?
    LIMIT 1
  `).bind(marketHashName).first();
}

export async function getCachedItemPricePence(env, marketHashName) {
  const cached = await getCachedItemPrice(env, marketHashName);
  return Number(cached?.price_pence) || null;
}

export function getPriceBucketIso(nowMs = Date.now()) {
  const date = new Date(nowMs);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const hour = date.getUTCHours() >= 12 ? 12 : 0;
  return new Date(Date.UTC(year, month, day, hour, 0, 0, 0)).toISOString();
}


export async function fetchAndStoreItemPricePence(env, marketHashName, nowMs = Date.now()) {
  if (!env.CASES_DB || !marketHashName) return null;

  const live = await fetchSteamPricePence(marketHashName);
  const stamp = getPriceBucketIso(nowMs);

  if (live != null && live > 0) {
    await env.CASES_DB.prepare(`
      INSERT INTO market_price_cache (market_hash_name, price_pence, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(market_hash_name) DO UPDATE SET
        price_pence = excluded.price_pence,
        updated_at = excluded.updated_at
    `).bind(marketHashName, live, stamp).run();
    await env.CASES_DB.prepare(`
      INSERT INTO market_price_history (market_hash_name, price_pence, bucket_started_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(market_hash_name, bucket_started_at) DO UPDATE SET
        price_pence = excluded.price_pence,
        updated_at = excluded.updated_at
    `).bind(marketHashName, live, stamp, new Date(nowMs).toISOString()).run();
    return live;
  }

  return null;
}

/**
 * Resolves weapon icon URL from Steam Community Market search (CS2 appid 730).
 */
export async function fetchSteamIconUrl(marketHashName) {
  if (!marketHashName || typeof marketHashName !== "string") return null;

  const queries = [marketHashName];
  if (!/\([^)]+\)\s*$/.test(marketHashName) && marketHashName.includes(" | ")) {
    queries.push(`${marketHashName} (Battle-Scarred)`);
  }

  for (const query of queries) {
    const encoded = encodeURIComponent(query);
    const url = `https://steamcommunity.com/market/search/render/?query=${encoded}&start=0&count=10&appid=${STEAM_APPID_CS2}&norender=1&currency=${STEAM_CURRENCY_GBP}`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; GrevDadBot/1.0)"
      }
    });

    if (!response.ok) continue;

    let data;
    try {
      data = await response.json();
    } catch {
      continue;
    }

    const results = data.results || [];
    const match = pickBestSteamResult(results, query);
    const icon = match?.asset_description?.icon_url_large || match?.asset_description?.icon_url;
    if (icon) {
      return `https://community.cloudflare.steamstatic.com/economy/image/${icon}`;
    }
  }

  return null;
}
