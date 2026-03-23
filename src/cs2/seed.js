import { CS2_CASE_ITEM_DEFINITIONS, fallbackSkinValuePence, rarityColorHex, rarityWeight } from "./case-item-definitions.js";
import { getCasesDb } from "../lib/cases-binding.js";

function isoNow() {
  return new Date().toISOString();
}

async function insertSkinTemplate(env, item, now) {
  const itemName = item.item_name || `${item.weapon_name} | ${item.skin_name}`;
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
      market_hash_name
    )
    VALUES (?, ?, ?, ?, '', '', ?, ?, ?, ?, NULL, ?)
  `).bind(
    itemName,
    item.weapon_name || '',
    item.skin_name || '',
    item.rarity,
    Number(item.fallback_price_pence || fallbackSkinValuePence(item.rarity)),
    item.color_hex || rarityColorHex(item.rarity),
    now,
    item.item_kind || 'skin_template',
    item.market_hash_name || itemName
  ).run();

  return Number(result.meta?.last_row_id || 0);
}

export async function seedCs2CatalogIfEmpty(env) {
  if (!getCasesDb(env)) return { seeded: false, reason: "no_cases_db" };

  const countRow = await getCasesDb(env).prepare(`SELECT COUNT(*) AS c FROM case_definitions`).first();
  const existing = Number(countRow?.c || 0);
  if (existing > 0) {
    return { seeded: false, reason: "already_seeded", case_count: existing };
  }

  const seedCatalog = CS2_CASE_ITEM_DEFINITIONS;
  const now = isoNow();

  for (const section of seedCatalog) {
    const ins = await getCasesDb(env).prepare(`
      INSERT INTO case_definitions (
        case_name,
        slug,
        image_url,
        price,
        description,
        is_active,
        created_at,
        steam_market_hash_name,
        fallback_price_pence
      )
      VALUES (?, ?, '', ?, ?, 1, ?, ?, ?)
    `).bind(
      section.case_name,
      section.slug,
      section.fallback_price_pence,
      `Simulated ${section.case_name} drops for Grev Coins.`,
      now,
      section.steam_market_hash_name,
      section.fallback_price_pence
    ).run();

    const caseId = Number(ins.meta?.last_row_id || 0);
    if (!caseId) continue;

    await getCasesDb(env).prepare(`
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
        market_hash_name
      )
      VALUES (?, '', '', 'container', '', '', 0, '#9ea3b5', ?, 'case', ?, ?)
    `).bind(`${section.case_name} (Unopened)`, now, caseId, section.steam_market_hash_name).run();

    for (const item of section.items) {
      const itemId = await insertSkinTemplate(env, item, now);
      if (!itemId) continue;
      await getCasesDb(env).prepare(`
        INSERT INTO case_drops (case_id, item_id, drop_weight)
        VALUES (?, ?, ?)
      `).bind(caseId, itemId, Number(item.drop_weight || rarityWeight(item.rarity))).run();
    }
  }

  return {
    seeded: true,
    cases: seedCatalog.length,
    source: "local_master_catalog"
  };
}
