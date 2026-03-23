import { buildMarketHashName } from "./wear.js";
import { fetchSteamIconUrl, getOrFetchItemPricePence } from "./steam.js";
import { getCasesDb } from "../lib/cases-db.js";

/**
 * Returns case_items.id for a concrete skin+wear row, creating it if needed.
 * @param wearTier {{ label: string, code: string }}
 */
export async function getOrCreateResolvedSkinItem(env, templateRow, wearTier, isoNow) {
  const weapon = String(templateRow.weapon_name || "").trim();
  const skin = String(templateRow.skin_name || "").trim();
  const wearLabel = wearTier.label;
  const marketHashName = buildMarketHashName(weapon, skin, wearLabel);
  const displayName = marketHashName;

  const existing = await getCasesDb(env).prepare(`
    SELECT id FROM case_items
    WHERE market_hash_name = ? AND item_kind = 'skin'
    LIMIT 1
  `).bind(marketHashName).first();

  if (existing?.id) {
    return Number(existing.id);
  }

  let pricePence = await getOrFetchItemPricePence(env, marketHashName);
  if (pricePence == null || pricePence <= 0) {
    pricePence = Math.max(1, Number(templateRow.market_value || 100));
  }

  let imageUrl = await fetchSteamIconUrl(marketHashName);
  if (!imageUrl) {
    imageUrl = String(templateRow.image_url || "").trim();
  }

  const result = await getCasesDb(env).prepare(`
    INSERT INTO case_items (
      item_name,
      weapon_name,
      skin_name,
      rarity,
      wear,
      image_url,
      market_value,
      color_hex,
      created_at,
      item_kind,
      case_def_id,
      market_hash_name,
      wear_code
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'skin', NULL, ?, ?)
  `).bind(
    displayName,
    weapon,
    skin,
    templateRow.rarity || "Mil-Spec Grade",
    wearLabel,
    imageUrl,
    pricePence,
    templateRow.color_hex || "#4b69ff",
    isoNow,
    marketHashName,
    wearTier.code
  ).run();

  return Number(result.meta?.last_row_id);
}
