import { CS2_CASE_CATALOG } from "./case-names.js";

function isoNow() {
  return new Date().toISOString();
}

/** market_value stored as integer pence (GBP). */
const SKIN_POOL = [
  { item_name: "UMP-45 | Mudder (Field-Tested)", weapon_name: "UMP-45", skin_name: "Mudder", rarity: "Consumer Grade", wear: "Field-Tested", market_value: 8, color_hex: "#b0c3d9", market_hash_name: "UMP-45 | Mudder (Field-Tested)" },
  { item_name: "PP-Bizon | Sand Dashed (Battle-Scarred)", weapon_name: "PP-Bizon", skin_name: "Sand Dashed", rarity: "Consumer Grade", wear: "Battle-Scarred", market_value: 6, color_hex: "#b0c3d9", market_hash_name: "PP-Bizon | Sand Dashed (Battle-Scarred)" },
  { item_name: "Negev | Terrain (Minimal Wear)", weapon_name: "Negev", skin_name: "Terrain", rarity: "Consumer Grade", wear: "Minimal Wear", market_value: 10, color_hex: "#b0c3d9", market_hash_name: "Negev | Terrain (Minimal Wear)" },
  { item_name: "P250 | Sand Dune (Field-Tested)", weapon_name: "P250", skin_name: "Sand Dune", rarity: "Consumer Grade", wear: "Field-Tested", market_value: 7, color_hex: "#b0c3d9", market_hash_name: "P250 | Sand Dune (Field-Tested)" },
  { item_name: "MAC-10 | Tornado (Minimal Wear)", weapon_name: "MAC-10", skin_name: "Tornado", rarity: "Industrial Grade", wear: "Minimal Wear", market_value: 25, color_hex: "#5e98d9", market_hash_name: "MAC-10 | Tornado (Minimal Wear)" },
  { item_name: "MAG-7 | Rust Coat (Battle-Scarred)", weapon_name: "MAG-7", skin_name: "Rust Coat", rarity: "Industrial Grade", wear: "Battle-Scarred", market_value: 22, color_hex: "#5e98d9", market_hash_name: "MAG-7 | Rust Coat (Battle-Scarred)" },
  { item_name: "UMP-45 | Corporal (Field-Tested)", weapon_name: "UMP-45", skin_name: "Corporal", rarity: "Mil-Spec Grade", wear: "Field-Tested", market_value: 80, color_hex: "#4b69ff", market_hash_name: "UMP-45 | Corporal (Field-Tested)" },
  { item_name: "Glock-18 | Catacombs (Minimal Wear)", weapon_name: "Glock-18", skin_name: "Catacombs", rarity: "Mil-Spec Grade", wear: "Minimal Wear", market_value: 95, color_hex: "#4b69ff", market_hash_name: "Glock-18 | Catacombs (Minimal Wear)" },
  { item_name: "FAMAS | Djinn (Field-Tested)", weapon_name: "FAMAS", skin_name: "Djinn", rarity: "Restricted", wear: "Field-Tested", market_value: 450, color_hex: "#8847ff", market_hash_name: "FAMAS | Djinn (Field-Tested)" },
  { item_name: "M4A1-S | Hyper Beast (Field-Tested)", weapon_name: "M4A1-S", skin_name: "Hyper Beast", rarity: "Classified", wear: "Field-Tested", market_value: 2200, color_hex: "#d32ce6", market_hash_name: "M4A1-S | Hyper Beast (Field-Tested)" },
  { item_name: "AK-47 | Redline (Field-Tested)", weapon_name: "AK-47", skin_name: "Redline", rarity: "Classified", wear: "Field-Tested", market_value: 2800, color_hex: "#d32ce6", market_hash_name: "AK-47 | Redline (Field-Tested)" },
  { item_name: "AWP | Asiimov (Field-Tested)", weapon_name: "AWP", skin_name: "Asiimov", rarity: "Covert", wear: "Field-Tested", market_value: 12000, color_hex: "#eb4b4b", market_hash_name: "AWP | Asiimov (Field-Tested)" },
  { item_name: "M4A4 | Howl (Minimal Wear)", weapon_name: "M4A4", skin_name: "Howl", rarity: "Contraband", wear: "Minimal Wear", market_value: 250000, color_hex: "#e4ae39", market_hash_name: "M4A4 | Howl (Minimal Wear)" },
  { item_name: "★ Karambit | Fade (Factory New)", weapon_name: "Karambit", skin_name: "Fade", rarity: "Covert", wear: "Factory New", market_value: 180000, color_hex: "#eb4b4b", market_hash_name: "★ Karambit | Fade (Factory New)" },
  { item_name: "Desert Eagle | Code Red (Minimal Wear)", weapon_name: "Desert Eagle", skin_name: "Code Red", rarity: "Covert", wear: "Minimal Wear", market_value: 6500, color_hex: "#eb4b4b", market_hash_name: "Desert Eagle | Code Red (Minimal Wear)" },
  { item_name: "USP-S | Kill Confirmed (Field-Tested)", weapon_name: "USP-S", skin_name: "Kill Confirmed", rarity: "Covert", wear: "Field-Tested", market_value: 9000, color_hex: "#eb4b4b", market_hash_name: "USP-S | Kill Confirmed (Field-Tested)" },
  { item_name: "Galil AR | Cerberus (Minimal Wear)", weapon_name: "Galil AR", skin_name: "Cerberus", rarity: "Restricted", wear: "Minimal Wear", market_value: 520, color_hex: "#8847ff", market_hash_name: "Galil AR | Cerberus (Minimal Wear)" },
  { item_name: "SSG 08 | Dragonfire (Minimal Wear)", weapon_name: "SSG 08", skin_name: "Dragonfire", rarity: "Classified", wear: "Minimal Wear", market_value: 1800, color_hex: "#d32ce6", market_hash_name: "SSG 08 | Dragonfire (Minimal Wear)" },
  { item_name: "Nova | Hyper Beast (Field-Tested)", weapon_name: "Nova", skin_name: "Hyper Beast", rarity: "Restricted", wear: "Field-Tested", market_value: 380, color_hex: "#8847ff", market_hash_name: "Nova | Hyper Beast (Field-Tested)" },
  { item_name: "Five-SeveN | Monkey Business (Battle-Scarred)", weapon_name: "Five-SeveN", skin_name: "Monkey Business", rarity: "Restricted", wear: "Battle-Scarred", market_value: 420, color_hex: "#8847ff", market_hash_name: "Five-SeveN | Monkey Business (Battle-Scarred)" },
  { item_name: "P90 | Asiimov (Field-Tested)", weapon_name: "P90", skin_name: "Asiimov", rarity: "Covert", wear: "Field-Tested", market_value: 7500, color_hex: "#eb4b4b", market_hash_name: "P90 | Asiimov (Field-Tested)" },
  { item_name: "Sawed-Off | The Kraken (Minimal Wear)", weapon_name: "Sawed-Off", skin_name: "The Kraken", rarity: "Classified", wear: "Minimal Wear", market_value: 1600, color_hex: "#d32ce6", market_hash_name: "Sawed-Off | The Kraken (Minimal Wear)" },
  { item_name: "Tec-9 | Fuel Injector (Field-Tested)", weapon_name: "Tec-9", skin_name: "Fuel Injector", rarity: "Classified", wear: "Field-Tested", market_value: 1400, color_hex: "#d32ce6", market_hash_name: "Tec-9 | Fuel Injector (Field-Tested)" },
  { item_name: "CZ75-Auto | Victoria (Minimal Wear)", weapon_name: "CZ75-Auto", skin_name: "Victoria", rarity: "Classified", wear: "Minimal Wear", market_value: 1900, color_hex: "#d32ce6", market_hash_name: "CZ75-Auto | Victoria (Minimal Wear)" },
  { item_name: "MP9 | Starlight Protector (Minimal Wear)", weapon_name: "MP9", skin_name: "Starlight Protector", rarity: "Classified", wear: "Minimal Wear", market_value: 2100, color_hex: "#d32ce6", market_hash_name: "MP9 | Starlight Protector (Minimal Wear)" }
];

function rarityWeight(rarity) {
  const r = String(rarity || "").toLowerCase();
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
  const skinIdByName = new Map();

  for (const skin of SKIN_POOL) {
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'skin', NULL, ?)
    `).bind(
      skin.item_name,
      skin.weapon_name,
      skin.skin_name,
      skin.rarity,
      skin.wear,
      "",
      skin.market_value,
      skin.color_hex,
      now,
      skin.market_hash_name
    ).run();

    const id = result.meta?.last_row_id;
    if (id) skinIdByName.set(skin.item_name, id);
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
      "",
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
      VALUES (?, '', '', 'container', '', '', 0, '#9ea3b5', ?, 'case', ?, ?)
    `).bind(`${c.name} (Unopened)`, now, caseId, c.steam_market_hash_name).run();

    for (const skin of SKIN_POOL) {
      const itemId = skinIdByName.get(skin.item_name);
      if (!itemId) continue;
      const w = rarityWeight(skin.rarity);
      await env.CASES_DB.prepare(`
        INSERT INTO case_drops (case_id, item_id, drop_weight)
        VALUES (?, ?, ?)
      `).bind(caseId, itemId, w).run();
    }
  }

  return {
    seeded: true,
    cases: CS2_CASE_CATALOG.length,
    skins: SKIN_POOL.length
  };
}
