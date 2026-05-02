import { getCasesDb } from "../lib/cases-binding.js";

function wearCodeFromLabel(label) {
  const value = String(label || '').trim().toLowerCase();
  if (value === 'factory new') return 'FN';
  if (value === 'minimal wear') return 'MW';
  if (value === 'field-tested') return 'FT';
  if (value === 'well-worn') return 'WW';
  if (value === 'battle-scarred') return 'BS';
  return '';
}

function rarityWeight(rarity) {
  const r = String(rarity || '').toLowerCase();
  if (r.includes('special item')) return 1;
  if (r.includes('consumer')) return 420;
  if (r.includes('industrial')) return 220;
  if (r.includes('mil-spec')) return 110;
  if (r.includes('restricted')) return 45;
  if (r.includes('classified')) return 14;
  if (r.includes('covert')) return 5;
  if (r.includes('contraband')) return 2;
  return 50;
}

function normalizeImageUrl(image) {
  const value = String(image || '').trim();
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  if (value.startsWith('/')) return `https://pricempire.com${value}`;
  return `https://community.cloudflare.steamstatic.com/economy/image/${value}`;
}

function inferSkinName(item) {
  const explicit = String(item?.pattern || '').trim();
  if (explicit) return explicit;
  const marketHashName = String(item?.market_hash_name || item?.name || '').trim();
  const weaponName = String(item?.weapon?.name || '').trim();
  if (marketHashName.includes(' | ')) {
    let skin = marketHashName.split(' | ').slice(1).join(' | ');
    skin = skin.replace(/\s*\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)\s*$/i, '').trim();
    return skin;
  }
  if (weaponName && marketHashName.startsWith(weaponName)) {
    return marketHashName.slice(weaponName.length).replace(/^\s*\|\s*/, '').trim();
  }
  return marketHashName;
}

async function fetchPriceEmpireAllItems(apiKey) {
  const response = await fetch('https://api.pricempire.com/v4/paid/items?language=en', {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json'
    }
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`PriceEmpire items request failed (${response.status}): ${text.slice(0, 240)}`);
  }
  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('PriceEmpire items response was not an array.');
  }
  return data;
}

async function ensureCaseDefinition(env, now, crate) {
  const caseName = String(crate?.name || '').trim();
  if (!caseName) return null;
  const slug = caseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
  let existing = await getCasesDb(env).prepare(`
    SELECT id, case_name FROM case_definitions
    WHERE case_name = ? OR slug = ? OR steam_market_hash_name = ?
    LIMIT 1
  `).bind(caseName, slug, caseName).first();

  const imageUrl = normalizeImageUrl(crate?.image);

  if (!existing) {
    const result = await getCasesDb(env).prepare(`
      INSERT INTO case_definitions (
        case_name, slug, image_url, price, description, is_active, created_at, steam_market_hash_name, fallback_price_pence
      ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).bind(
      caseName,
      slug,
      imageUrl,
      0,
      `Imported from PriceEmpire: ${caseName}`,
      now,
      caseName,
      0
    ).run();
    const caseId = Number(result.meta?.last_row_id || 0);
    await getCasesDb(env).prepare(`
      INSERT INTO case_items (
        item_name, weapon_name, skin_name, rarity, wear, image_url, market_value, color_hex, created_at, item_kind, case_def_id, market_hash_name
      ) VALUES (?, '', '', 'container', '', ?, 0, '#9ea3b5', ?, 'case', ?, ?)
    `).bind(`${caseName} (Unopened)`, imageUrl, now, caseId, caseName).run();
    existing = { id: caseId, case_name: caseName };
    return { id: caseId, case_name: caseName, created: true };
  }

  if (imageUrl) {
    await getCasesDb(env).prepare(`UPDATE case_definitions SET image_url = CASE WHEN image_url = '' THEN ? ELSE image_url END WHERE id = ?`).bind(imageUrl, existing.id).run();
    await getCasesDb(env).prepare(`UPDATE case_items SET image_url = CASE WHEN image_url = '' THEN ? ELSE image_url END WHERE case_def_id = ? AND item_kind = 'case'`).bind(imageUrl, existing.id).run();
  }

  return { id: Number(existing.id), case_name: caseName, created: false };
}

async function upsertSkin(env, now, item) {
  const marketHashName = String(item?.market_hash_name || item?.name || '').trim();
  const weaponName = String(item?.weapon?.name || '').trim();
  const skinName = inferSkinName(item);
  const rarityName = String(item?.rarity?.name || '').trim() || 'Mil-Spec Grade';
  const rarityColor = String(item?.rarity?.color || '').trim() || '#4b69ff';
  const wear = String(item?.wear || '').trim();
  const wearCode = wearCodeFromLabel(wear);
  const imageUrl = normalizeImageUrl(item?.image || item?.weapon?.image);
  if (!marketHashName || !weaponName || !skinName) return { inserted: false, updated: false, itemId: 0 };

  const existing = await getCasesDb(env).prepare(`
    SELECT id, image_url, market_value
    FROM case_items
    WHERE market_hash_name = ? AND item_kind = 'skin'
    LIMIT 1
  `).bind(marketHashName).first();

  if (existing?.id) {
    await getCasesDb(env).prepare(`
      UPDATE case_items
      SET item_name = ?, weapon_name = ?, skin_name = ?, rarity = ?, wear = ?, wear_code = ?, color_hex = ?, image_url = CASE WHEN ? <> '' THEN ? ELSE image_url END
      WHERE id = ?
    `).bind(
      marketHashName,
      weaponName,
      skinName,
      rarityName,
      wear,
      wearCode,
      rarityColor,
      imageUrl,
      imageUrl,
      existing.id
    ).run();
    return { inserted: false, updated: true, itemId: Number(existing.id) };
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'skin', NULL, ?, ?)
  `).bind(
    marketHashName,
    weaponName,
    skinName,
    rarityName,
    wear,
    imageUrl,
    0,
    rarityColor,
    now,
    marketHashName,
    wearCode
  ).run();

  return { inserted: true, updated: false, itemId: Number(result.meta?.last_row_id || 0) };
}

async function ensureCaseDrop(env, caseId, itemId, rarity) {
  const existing = await getCasesDb(env).prepare(`
    SELECT id FROM case_drops WHERE case_id = ? AND item_id = ? LIMIT 1
  `).bind(caseId, itemId).first();
  if (existing?.id) return false;
  await getCasesDb(env).prepare(`
    INSERT INTO case_drops (case_id, item_id, drop_weight)
    VALUES (?, ?, ?)
  `).bind(caseId, itemId, rarityWeight(rarity)).run();
  return true;
}

export async function importPriceEmpireCatalog(env, apiKey, options = {}) {
  if (!getCasesDb(env)) throw new Error('CASES-DB is not configured.');
  const key = String(apiKey || '').trim();
  if (!key) throw new Error('A PriceEmpire API key is required.');
  const now = new Date().toISOString();
  const limit = Number(options.limit || 0);
  const rawItems = await fetchPriceEmpireAllItems(key);
  const filtered = rawItems.filter((item) => {
    const marketHashName = String(item?.market_hash_name || item?.name || '').trim();
    const weaponName = String(item?.weapon?.name || '').trim();
    const category = String(item?.category || '').trim().toLowerCase();
    return Boolean(marketHashName && weaponName && category && !category.includes('sticker') && !category.includes('charm') && !category.includes('agent') && !category.includes('music kit') && !category.includes('container'));
  });

  const items = limit > 0 ? filtered.slice(0, limit) : filtered;
  const seenCases = new Set();
  const stats = { total_seen: items.length, skins_inserted: 0, skins_updated: 0, cases_created: 0, drops_added: 0 };

  for (const item of items) {
    const skin = await upsertSkin(env, now, item);
    if (!skin.itemId) continue;
    if (skin.inserted) stats.skins_inserted += 1;
    if (skin.updated) stats.skins_updated += 1;

    for (const crate of Array.isArray(item?.crates) ? item.crates : []) {
      const caseDef = await ensureCaseDefinition(env, now, crate);
      if (!caseDef?.id) continue;
      if (!seenCases.has(caseDef.case_name)) {
        seenCases.add(caseDef.case_name);
        if (caseDef.created) stats.cases_created += 1;
      }
      if (await ensureCaseDrop(env, caseDef.id, skin.itemId, item?.rarity?.name || 'Mil-Spec Grade')) {
        stats.drops_added += 1;
      }
    }
  }

  return stats;
}
