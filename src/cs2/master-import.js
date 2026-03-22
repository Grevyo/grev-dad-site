import { fetchSteamIconUrl } from './steam.js';
import { CS2_MASTER_CATALOG_RAW } from './master-catalog.js';

function slugify(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
}

function rarityWeight(rarity) {
  const r = String(rarity || '').toLowerCase();
  if (r.includes('consumer')) return 420;
  if (r.includes('industrial')) return 220;
  if (r.includes('mil-spec')) return 110;
  if (r.includes('restricted')) return 45;
  if (r.includes('classified')) return 14;
  if (r.includes('covert')) return 5;
  if (r.includes('contraband')) return 1;
  return 50;
}

function parseCatalog(raw) {
  const lines = String(raw || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const sections = [];
  let current = null;
  for (const line of lines) {
    if (/^(collections|map collections|themed collections|weapon case collections|limited edition item)$/i.test(line)) continue;
    if (/^weapon\s+skin\s+quality/i.test(line) || /^weapon\tSkin\tQuality/i.test(line)) continue;
    const parts = line.split(/\t+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 3) {
      if (!current) continue;
      current.items.push({ weapon_name: parts[0], skin_name: parts[1], rarity: parts[2] });
      continue;
    }
    if (current) sections.push(current);
    current = { case_name: line, items: [] };
  }
  if (current) sections.push(current);
  return sections.filter((s) => s.items.length);
}

async function ensureCaseDefinition(env, caseName, now) {
  const slug = slugify(caseName);
  let existing = await env.CASES_DB.prepare(`SELECT id, image_url FROM case_definitions WHERE case_name = ? OR slug = ? LIMIT 1`).bind(caseName, slug).first();
  if (existing?.id) return Number(existing.id);
  const imageUrl = await fetchSteamIconUrl(caseName).catch(() => '');
  const result = await env.CASES_DB.prepare(`
    INSERT INTO case_definitions (case_name, slug, image_url, price, description, is_active, created_at, steam_market_hash_name, fallback_price_pence)
    VALUES (?, ?, ?, 0, ?, 1, ?, ?, 0)
  `).bind(caseName, slug, imageUrl || '', `Imported catalog for ${caseName}`, now, caseName).run();
  const caseId = Number(result.meta?.last_row_id || 0);
  await env.CASES_DB.prepare(`
    INSERT INTO case_items (item_name, weapon_name, skin_name, rarity, wear, wear_code, image_url, market_value, color_hex, created_at, item_kind, case_def_id, market_hash_name)
    VALUES (?, '', '', 'container', '', '', ?, 0, '#9ea3b5', ?, 'case', ?, ?)
  `).bind(`${caseName} (Unopened)`, imageUrl || '', now, caseId, caseName).run();
  return caseId;
}

async function upsertSkin(env, row, now) {
  const itemName = `${row.weapon_name} | ${row.skin_name}`;
  const existing = await env.CASES_DB.prepare(`SELECT id, image_url FROM case_items WHERE item_kind = 'skin' AND weapon_name = ? AND skin_name = ? LIMIT 1`).bind(row.weapon_name, row.skin_name).first();
  let imageUrl = existing?.image_url || '';
  if (!imageUrl) imageUrl = await fetchSteamIconUrl(itemName).catch(() => '');
  if (existing?.id) {
    await env.CASES_DB.prepare(`UPDATE case_items SET item_name = ?, rarity = ?, market_hash_name = COALESCE(NULLIF(market_hash_name, ''), ?), image_url = CASE WHEN ? <> '' THEN ? ELSE image_url END, color_hex = COALESCE(NULLIF(color_hex, ''), '#4b69ff') WHERE id = ?`).bind(itemName, row.rarity, itemName, imageUrl, imageUrl, existing.id).run();
    return Number(existing.id);
  }
  const result = await env.CASES_DB.prepare(`
    INSERT INTO case_items (item_name, weapon_name, skin_name, rarity, wear, wear_code, image_url, market_value, color_hex, created_at, item_kind, case_def_id, market_hash_name)
    VALUES (?, ?, ?, ?, '', '', ?, 0, '#4b69ff', ?, 'skin', NULL, ?)
  `).bind(itemName, row.weapon_name, row.skin_name, row.rarity, imageUrl, now, itemName).run();
  return Number(result.meta?.last_row_id || 0);
}

export async function importMasterCatalog(env) {
  const now = new Date().toISOString();
  const sections = parseCatalog(CS2_MASTER_CATALOG_RAW);
  const stats = { sections: sections.length, cases_created: 0, skins_upserted: 0, drops_added: 0, images_refreshed: 0 };
  for (const section of sections) {
    const before = await env.CASES_DB.prepare(`SELECT id FROM case_definitions WHERE case_name = ? LIMIT 1`).bind(section.case_name).first();
    const caseId = await ensureCaseDefinition(env, section.case_name, now);
    if (!before?.id && caseId) stats.cases_created += 1;
    for (const item of section.items) {
      const itemId = await upsertSkin(env, item, now);
      if (!itemId) continue;
      stats.skins_upserted += 1;
      const existingDrop = await env.CASES_DB.prepare(`SELECT id FROM case_drops WHERE case_id = ? AND item_id = ? LIMIT 1`).bind(caseId, itemId).first();
      if (!existingDrop?.id) {
        await env.CASES_DB.prepare(`INSERT INTO case_drops (case_id, item_id, drop_weight) VALUES (?, ?, ?)` ).bind(caseId, itemId, rarityWeight(item.rarity)).run();
        stats.drops_added += 1;
      }
      const withImage = await env.CASES_DB.prepare(`SELECT image_url FROM case_items WHERE id = ? LIMIT 1`).bind(itemId).first();
      if (withImage?.image_url) stats.images_refreshed += 1;
    }
  }
  return stats;
}
