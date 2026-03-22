import { CS2_CASE_CATALOG } from "./case-names.js";
import { fetchSteamIconUrl } from "./steam.js";

function isoNow() {
  return new Date().toISOString();
}

/**
 * Skin templates (no wear) — wear is rolled on open (FN/MW/FT/WW/BS).
 * market_value = fallback pence if Steam has no listing.
 */
const SKIN_TEMPLATES = [
  { weapon_name: "UMP-45", skin_name: "Mudder", rarity: "Consumer Grade", color_hex: "#b0c3d9", market_value: 50 },
  { weapon_name: "PP-Bizon", skin_name: "Sand Dashed", rarity: "Consumer Grade", color_hex: "#b0c3d9", market_value: 45 },
  { weapon_name: "Negev", skin_name: "Terrain", rarity: "Consumer Grade", color_hex: "#b0c3d9", market_value: 55 },
  { weapon_name: "P250", skin_name: "Sand Dune", rarity: "Consumer Grade", color_hex: "#b0c3d9", market_value: 48 },
  { weapon_name: "MAC-10", skin_name: "Tornado", rarity: "Industrial Grade", color_hex: "#5e98d9", market_value: 120 },
  { weapon_name: "MAG-7", skin_name: "Rust Coat", rarity: "Industrial Grade", color_hex: "#5e98d9", market_value: 110 },
  { weapon_name: "UMP-45", skin_name: "Corporal", rarity: "Mil-Spec Grade", color_hex: "#4b69ff", market_value: 450 },
  { weapon_name: "Glock-18", skin_name: "Catacombs", rarity: "Mil-Spec Grade", color_hex: "#4b69ff", market_value: 480 },
  { weapon_name: "FAMAS", skin_name: "Djinn", rarity: "Restricted", color_hex: "#8847ff", market_value: 2200 },
  { weapon_name: "M4A1-S", skin_name: "Hyper Beast", rarity: "Classified", color_hex: "#d32ce6", market_value: 12000 },
  { weapon_name: "AK-47", skin_name: "Redline", rarity: "Classified", color_hex: "#d32ce6", market_value: 15000 },
  { weapon_name: "AWP", skin_name: "Asiimov", rarity: "Covert", color_hex: "#eb4b4b", market_value: 65000 },
  { weapon_name: "M4A4", skin_name: "Howl", rarity: "Contraband", color_hex: "#e4ae39", market_value: 500000 },
  { weapon_name: "★ Karambit", skin_name: "Fade", rarity: "Covert", color_hex: "#eb4b4b", market_value: 400000 },
  { weapon_name: "Desert Eagle", skin_name: "Code Red", rarity: "Covert", color_hex: "#eb4b4b", market_value: 35000 },
  { weapon_name: "USP-S", skin_name: "Kill Confirmed", rarity: "Covert", color_hex: "#eb4b4b", market_value: 42000 },
  { weapon_name: "Galil AR", skin_name: "Cerberus", rarity: "Restricted", color_hex: "#8847ff", market_value: 2400 },
  { weapon_name: "SSG 08", skin_name: "Dragonfire", rarity: "Classified", color_hex: "#d32ce6", market_value: 9000 },
  { weapon_name: "Nova", skin_name: "Hyper Beast", rarity: "Restricted", color_hex: "#8847ff", market_value: 1900 },
  { weapon_name: "Five-SeveN", skin_name: "Monkey Business", rarity: "Restricted", color_hex: "#8847ff", market_value: 2000 },
  { weapon_name: "P90", skin_name: "Asiimov", rarity: "Covert", color_hex: "#eb4b4b", market_value: 38000 },
  { weapon_name: "Sawed-Off", skin_name: "The Kraken", rarity: "Classified", color_hex: "#d32ce6", market_value: 8500 },
  { weapon_name: "Tec-9", skin_name: "Fuel Injector", rarity: "Classified", color_hex: "#d32ce6", market_value: 7800 },
  { weapon_name: "CZ75-Auto", skin_name: "Victoria", rarity: "Classified", color_hex: "#d32ce6", market_value: 9200 },
  { weapon_name: "MP9", skin_name: "Starlight Protector", rarity: "Classified", color_hex: "#d32ce6", market_value: 10500 },
  { weapon_name: "★ Karambit", skin_name: "Doppler", rarity: "Special Item", color_hex: "#e4ae39", market_value: 520000 },
  { weapon_name: "★ Butterfly Knife", skin_name: "Tiger Tooth", rarity: "Special Item", color_hex: "#e4ae39", market_value: 475000 },
  { weapon_name: "★ M9 Bayonet", skin_name: "Lore", rarity: "Special Item", color_hex: "#e4ae39", market_value: 610000 },
  { weapon_name: "★ Talon Knife", skin_name: "Crimson Web", rarity: "Special Item", color_hex: "#e4ae39", market_value: 455000 }
];

function rarityWeight(rarity) {
  const r = String(rarity || "").toLowerCase();
  if (r.includes("special item")) return 1;
  if (r.includes("consumer")) return 420;
  if (r.includes("industrial")) return 220;
  if (r.includes("mil-spec")) return 110;
  if (r.includes("restricted")) return 45;
  if (r.includes("classified")) return 14;
  if (r.includes("covert")) return 5;
  if (r.includes("contraband")) return 2;
  return 50;
}

export async function seedCs2CatalogIfEmpty(env) {
  if (!env.CASES_DB) return { seeded: false, reason: "no_cases_db" };

  const countRow = await env.CASES_DB.prepare(`SELECT COUNT(*) AS c FROM case_definitions`).first();
  const existing = Number(countRow?.c || 0);
  if (existing > 0) {
    return { seeded: false, reason: "already_seeded", case_count: existing };
  }

  const now = isoNow();
  const templateIdByKey = new Map();

  for (const t of SKIN_TEMPLATES) {
    const itemName = `${t.weapon_name} | ${t.skin_name}`;
    const result = await env.CASES_DB.prepare(`
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
      VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, 'skin_template', NULL, ?)
    `).bind(
      itemName,
      t.weapon_name,
      t.skin_name,
      t.rarity,
      await fetchSteamIconUrl(itemName) || "",
      t.market_value,
      t.color_hex,
      now,
      itemName
    ).run();

    const id = result.meta?.last_row_id;
    if (id) templateIdByKey.set(itemName, id);
  }

  for (const c of CS2_CASE_CATALOG) {
    const ins = await env.CASES_DB.prepare(`
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
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).bind(
      c.name,
      c.slug,
      await fetchSteamIconUrl(c.steam_market_hash_name) || "",
      c.fallback_price_pence,
      `Simulated ${c.name} drops for Grev Coins.`,
      now,
      c.steam_market_hash_name,
      c.fallback_price_pence
    ).run();

    const caseId = ins.meta?.last_row_id;
    if (!caseId) continue;

    await env.CASES_DB.prepare(`
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
      VALUES (?, '', '', 'container', '', ?, 0, '#9ea3b5', ?, 'case', ?, ?)
    `).bind(`${c.name} (Unopened)`, await fetchSteamIconUrl(c.steam_market_hash_name) || "", now, caseId, c.steam_market_hash_name).run();

    for (const t of SKIN_TEMPLATES) {
      const itemName = `${t.weapon_name} | ${t.skin_name}`;
      const itemId = templateIdByKey.get(itemName);
      if (!itemId) continue;
      const w = rarityWeight(t.rarity);
      await env.CASES_DB.prepare(`
        INSERT INTO case_drops (case_id, item_id, drop_weight)
        VALUES (?, ?, ?)
      `).bind(caseId, itemId, w).run();
    }
  }

  return {
    seeded: true,
    cases: CS2_CASE_CATALOG.length,
    skin_templates: SKIN_TEMPLATES.length
  };
}
