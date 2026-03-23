import { fetchSteamIconUrl } from './steam.js';
import { CS2_CASE_ITEM_DEFINITIONS, rarityColorHex } from './case-item-definitions.js';
import { getCasesDb } from '../lib/cases-db.js';

function slugify(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
}

async function ensureCaseDefinition(env, section, now) {
  const slug = section.slug || slugify(section.case_name);
  let existing = await getCasesDb(env).prepare(`SELECT id, image_url FROM case_definitions WHERE case_name = ? OR slug = ? LIMIT 1`).bind(section.case_name, slug).first();
  if (existing?.id) {
    await getCasesDb(env).prepare(`
      UPDATE case_definitions
      SET slug = ?, steam_market_hash_name = ?, fallback_price_pence = CASE WHEN ? > 0 THEN ? ELSE fallback_price_pence END
      WHERE id = ?
    `).bind(slug, section.steam_market_hash_name || section.case_name, Number(section.fallback_price_pence || 0), Number(section.fallback_price_pence || 0), existing.id).run();
    return { caseId: Number(existing.id), created: false };
  }
  const imageUrl = await fetchSteamIconUrl(section.steam_market_hash_name || section.case_name).catch(() => '');
  const result = await getCasesDb(env).prepare(`
    INSERT INTO case_definitions (case_name, slug, image_url, price, description, is_active, created_at, steam_market_hash_name, fallback_price_pence)
    VALUES (?, ?, ?, 0, ?, 1, ?, ?, ?)
  `).bind(section.case_name, slug, imageUrl || '', `Imported catalog for ${section.case_name}`, now, section.steam_market_hash_name || section.case_name, Number(section.fallback_price_pence || 0)).run();
  const caseId = Number(result.meta?.last_row_id || 0);
  await getCasesDb(env).prepare(`
    INSERT INTO case_items (item_name, weapon_name, skin_name, rarity, wear, wear_code, image_url, market_value, color_hex, created_at, item_kind, case_def_id, market_hash_name)
    VALUES (?, '', '', 'container', '', '', ?, 0, '#9ea3b5', ?, 'case', ?, ?)
  `).bind(`${section.case_name} (Unopened)`, imageUrl || '', now, caseId, section.steam_market_hash_name || section.case_name).run();
  return { caseId, created: true };
}

async function upsertTemplateItem(env, row, now) {
  const itemName = row.item_name || `${row.weapon_name} | ${row.skin_name}`;
  const itemKind = row.item_kind || 'skin_template';
  const existing = await getCasesDb(env).prepare(`
    SELECT id, image_url FROM case_items
    WHERE item_kind IN ('skin', 'skin_template') AND market_hash_name = ?
    LIMIT 1
  `).bind(row.market_hash_name || itemName).first();
  let imageUrl = existing?.image_url || '';
  if (!imageUrl) imageUrl = await fetchSteamIconUrl(row.market_hash_name || itemName).catch(() => '');
  if (existing?.id) {
    await getCasesDb(env).prepare(`
      UPDATE case_items
      SET item_name = ?, weapon_name = ?, skin_name = ?, rarity = ?, market_hash_name = ?, image_url = CASE WHEN ? <> '' THEN ? ELSE image_url END,
          color_hex = ?, market_value = CASE WHEN market_value <= 0 THEN ? ELSE market_value END
      WHERE id = ?
    `).bind(itemName, row.weapon_name || '', row.skin_name || '', row.rarity || '', row.market_hash_name || itemName, imageUrl, imageUrl, row.color_hex || rarityColorHex(row.rarity), Number(row.fallback_price_pence || 0), existing.id).run();
    return Number(existing.id);
  }
  const result = await getCasesDb(env).prepare(`
    INSERT INTO case_items (item_name, weapon_name, skin_name, rarity, wear, wear_code, image_url, market_value, color_hex, created_at, item_kind, case_def_id, market_hash_name)
    VALUES (?, ?, ?, ?, '', '', ?, ?, ?, ?, ?, NULL, ?)
  `).bind(itemName, row.weapon_name || '', row.skin_name || '', row.rarity || '', imageUrl, Number(row.fallback_price_pence || 0), row.color_hex || rarityColorHex(row.rarity), now, itemKind, row.market_hash_name || itemName).run();
  return Number(result.meta?.last_row_id || 0);
}

export async function importMasterCatalog(env) {
  const now = new Date().toISOString();
  const sections = CS2_CASE_ITEM_DEFINITIONS;
  const stats = { sections: sections.length, cases_created: 0, skins_upserted: 0, drops_added: 0, drops_removed: 0, images_refreshed: 0 };

  for (const section of sections) {
    const { caseId, created } = await ensureCaseDefinition(env, section, now);
    if (!caseId) continue;
    if (created) stats.cases_created += 1;

    const desiredItemIds = new Set();
    for (const item of section.items) {
      const itemId = await upsertTemplateItem(env, item, now);
      if (!itemId) continue;
      desiredItemIds.add(itemId);
      stats.skins_upserted += 1;

      const existingDrop = await getCasesDb(env).prepare(`SELECT id FROM case_drops WHERE case_id = ? AND item_id = ? LIMIT 1`).bind(caseId, itemId).first();
      if (existingDrop?.id) {
        await getCasesDb(env).prepare(`UPDATE case_drops SET drop_weight = ? WHERE id = ?`).bind(Number(item.drop_weight || 1), existingDrop.id).run();
      } else {
        await getCasesDb(env).prepare(`INSERT INTO case_drops (case_id, item_id, drop_weight) VALUES (?, ?, ?)`).bind(caseId, itemId, Number(item.drop_weight || 1)).run();
        stats.drops_added += 1;
      }

      const withImage = await getCasesDb(env).prepare(`SELECT image_url FROM case_items WHERE id = ? LIMIT 1`).bind(itemId).first();
      if (withImage?.image_url) stats.images_refreshed += 1;
    }

    const existingDrops = await getCasesDb(env).prepare(`SELECT id, item_id FROM case_drops WHERE case_id = ?`).bind(caseId).all();
    for (const drop of existingDrops.results || []) {
      if (!desiredItemIds.has(Number(drop.item_id))) {
        await getCasesDb(env).prepare(`DELETE FROM case_drops WHERE id = ?`).bind(drop.id).run();
        stats.drops_removed += 1;
      }
    }
  }

  return stats;
}
