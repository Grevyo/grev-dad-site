import { CS2_CASE_CATALOG } from "./case-names.js";
import { CS2_MASTER_CATALOG_RAW } from "./master-catalog.js";

function isoNow() {
  return new Date().toISOString();
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function rarityWeight(rarity) {
  const r = String(rarity || "").toLowerCase();
  if (r.includes("special item")) return 1;
  if (r.includes("contraband")) return 2;
  if (r.includes("covert")) return 5;
  if (r.includes("classified")) return 14;
  if (r.includes("restricted")) return 45;
  if (r.includes("mil-spec")) return 110;
  if (r.includes("industrial")) return 220;
  if (r.includes("consumer")) return 420;
  return 50;
}

function rarityColorHex(rarity) {
  const r = String(rarity || "").toLowerCase();
  if (r.includes("special item") || r.includes("contraband")) return "#e4ae39";
  if (r.includes("covert")) return "#eb4b4b";
  if (r.includes("classified")) return "#d32ce6";
  if (r.includes("restricted")) return "#8847ff";
  if (r.includes("mil-spec")) return "#4b69ff";
  if (r.includes("industrial")) return "#5e98d9";
  return "#b0c3d9";
}

function fallbackSkinValuePence(rarity) {
  const r = String(rarity || "").toLowerCase();
  if (r.includes("special item")) return 475000;
  if (r.includes("contraband")) return 500000;
  if (r.includes("covert")) return 48000;
  if (r.includes("classified")) return 12000;
  if (r.includes("restricted")) return 3200;
  if (r.includes("mil-spec")) return 850;
  if (r.includes("industrial")) return 220;
  if (r.includes("consumer")) return 80;
  return 500;
}

function parseMasterCatalog(raw) {
  const lines = String(raw || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const sections = [];
  let current = null;

  for (const line of lines) {
    if (/^(collections|map collections|themed collections|weapon case collections|limited edition item)$/i.test(line)) continue;
    if (/^weapon\s+skin\s+quality/i.test(line) || /^weapon\tSkin\tQuality/i.test(line)) continue;

    const parts = line.split(/\t+/).map((entry) => entry.trim()).filter(Boolean);
    if (parts.length >= 3) {
      if (!current) continue;
      current.items.push({
        weapon_name: parts[0],
        skin_name: parts[1],
        rarity: parts[2]
      });
      continue;
    }

    if (current?.items?.length) sections.push(current);
    current = { case_name: line, items: [] };
  }

  if (current?.items?.length) sections.push(current);
  return sections;
}

function buildSeedCatalog() {
  const priceByCaseName = new Map(
    CS2_CASE_CATALOG.map((entry) => [
      entry.name,
      {
        slug: entry.slug,
        fallback_price_pence: Number(entry.fallback_price_pence || 0),
        steam_market_hash_name: entry.steam_market_hash_name || entry.name
      }
    ])
  );

  return parseMasterCatalog(CS2_MASTER_CATALOG_RAW)
    .map((section) => {
      const fallback = priceByCaseName.get(section.case_name);
      return {
        case_name: section.case_name,
        slug: fallback?.slug || slugify(section.case_name),
        fallback_price_pence: Number(fallback?.fallback_price_pence || 0),
        steam_market_hash_name: fallback?.steam_market_hash_name || section.case_name,
        items: section.items
      };
    })
    .filter((section) => section.items.length > 0);
}

async function insertSkinTemplate(env, item, now) {
  const itemName = `${item.weapon_name} | ${item.skin_name}`;
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
    VALUES (?, ?, ?, ?, '', '', ?, ?, ?, 'skin_template', NULL, ?)
  `).bind(
    itemName,
    item.weapon_name,
    item.skin_name,
    item.rarity,
    fallbackSkinValuePence(item.rarity),
    rarityColorHex(item.rarity),
    now,
    itemName
  ).run();

  return Number(result.meta?.last_row_id || 0);
}

export async function seedCs2CatalogIfEmpty(env) {
  if (!env.CASES_DB) return { seeded: false, reason: "no_cases_db" };

  const countRow = await env.CASES_DB.prepare(`SELECT COUNT(*) AS c FROM case_definitions`).first();
  const existing = Number(countRow?.c || 0);
  if (existing > 0) {
    return { seeded: false, reason: "already_seeded", case_count: existing };
  }

  const seedCatalog = buildSeedCatalog();
  const now = isoNow();

  for (const section of seedCatalog) {
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
    `).bind(`${section.case_name} (Unopened)`, now, caseId, section.steam_market_hash_name).run();

    for (const item of section.items) {
      const itemId = await insertSkinTemplate(env, item, now);
      if (!itemId) continue;
      await env.CASES_DB.prepare(`
        INSERT INTO case_drops (case_id, item_id, drop_weight)
        VALUES (?, ?, ?)
      `).bind(caseId, itemId, rarityWeight(item.rarity)).run();
    }
  }

  return {
    seeded: true,
    cases: seedCatalog.length,
    source: "local_master_catalog"
  };
}
