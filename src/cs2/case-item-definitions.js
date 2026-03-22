import { CS2_CASE_CATALOG } from './case-names.js';

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function rarityWeight(rarity) {
  const r = String(rarity || '').toLowerCase();
  if (r.includes('special item')) return 1;
  if (r.includes('contraband')) return 2;
  if (r.includes('covert')) return 5;
  if (r.includes('classified')) return 14;
  if (r.includes('restricted')) return 45;
  if (r.includes('mil-spec')) return 110;
  if (r.includes('industrial')) return 220;
  if (r.includes('consumer')) return 420;
  return 50;
}

function rarityColorHex(rarity) {
  const r = String(rarity || '').toLowerCase();
  if (r.includes('special item') || r.includes('contraband')) return '#e4ae39';
  if (r.includes('covert')) return '#eb4b4b';
  if (r.includes('classified')) return '#d32ce6';
  if (r.includes('restricted')) return '#8847ff';
  if (r.includes('mil-spec')) return '#4b69ff';
  if (r.includes('industrial')) return '#5e98d9';
  return '#b0c3d9';
}

function fallbackSkinValuePence(rarity) {
  const r = String(rarity || '').toLowerCase();
  if (r.includes('special item')) return 475000;
  if (r.includes('contraband')) return 500000;
  if (r.includes('covert')) return 48000;
  if (r.includes('classified')) return 12000;
  if (r.includes('restricted')) return 3200;
  if (r.includes('mil-spec')) return 850;
  if (r.includes('industrial')) return 220;
  if (r.includes('consumer')) return 80;
  return 500;
}

function buildCaseDefinition(caseName, items, specialItems = []) {
  const fallback = CS2_CASE_CATALOG.find((entry) => entry.name === caseName);
  return {
    case_name: caseName,
    slug: fallback?.slug || slugify(caseName),
    steam_market_hash_name: fallback?.steam_market_hash_name || caseName,
    fallback_price_pence: Number(fallback?.fallback_price_pence || 0),
    items: [...items, ...specialItems].map((item) => ({
      ...item,
      item_name: item.item_name || `${item.weapon_name} | ${item.skin_name}`,
      market_hash_name: item.market_hash_name || item.item_name || `${item.weapon_name} | ${item.skin_name}`,
      color_hex: item.color_hex || rarityColorHex(item.rarity),
      drop_weight: Number(item.drop_weight || rarityWeight(item.rarity) || 1),
      fallback_price_pence: Number(item.fallback_price_pence || fallbackSkinValuePence(item.rarity) || 0),
      item_kind: item.item_kind || 'skin_template'
    }))
  };
}

export const CS2_CASE_ITEM_DEFINITIONS = [
  buildCaseDefinition('CS:GO Weapon Case', [
    { weapon_name: 'MP7', skin_name: 'Skulls', rarity: 'Mil-Spec' },
    { weapon_name: 'SG 553', skin_name: 'Ultraviolet', rarity: 'Mil-Spec' },
    { weapon_name: 'AUG', skin_name: 'Wings', rarity: 'Mil-Spec' },
    { weapon_name: 'M4A1-S', skin_name: 'Dark Water', rarity: 'Restricted' },
    { weapon_name: 'USP-S', skin_name: 'Dark Water', rarity: 'Restricted' },
    { weapon_name: 'Glock-18', skin_name: 'Dragon Tattoo', rarity: 'Restricted' },
    { weapon_name: 'Desert Eagle', skin_name: 'Hypnotic', rarity: 'Classified' },
    { weapon_name: 'AK-47', skin_name: 'Case Hardened', rarity: 'Classified' },
    { weapon_name: 'AWP', skin_name: 'Lightning Strike', rarity: 'Covert' }
  ], [
    { weapon_name: '★ Knife', skin_name: 'Blue Steel', rarity: 'Special Item', market_hash_name: '★ Knife | Blue Steel', fallback_price_pence: 90000 },
    { weapon_name: '★ Knife', skin_name: 'Case Hardened', rarity: 'Special Item', market_hash_name: '★ Knife | Case Hardened', fallback_price_pence: 130000 },
    { weapon_name: '★ Knife', skin_name: 'Crimson Web', rarity: 'Special Item', market_hash_name: '★ Knife | Crimson Web', fallback_price_pence: 180000 },
    { weapon_name: '★ Knife', skin_name: 'Fade', rarity: 'Special Item', market_hash_name: '★ Knife | Fade', fallback_price_pence: 220000 },
    { weapon_name: '★ Knife', skin_name: 'Forest DDPAT', rarity: 'Special Item', market_hash_name: '★ Knife | Forest DDPAT', fallback_price_pence: 70000 },
    { weapon_name: '★ Knife', skin_name: 'Night', rarity: 'Special Item', market_hash_name: '★ Knife | Night', fallback_price_pence: 95000 },
    { weapon_name: '★ Knife', skin_name: 'Safari Mesh', rarity: 'Special Item', market_hash_name: '★ Knife | Safari Mesh', fallback_price_pence: 70000 },
    { weapon_name: '★ Knife', skin_name: 'Scorched', rarity: 'Special Item', market_hash_name: '★ Knife | Scorched', fallback_price_pence: 72000 },
    { weapon_name: '★ Knife', skin_name: 'Slaughter', rarity: 'Special Item', market_hash_name: '★ Knife | Slaughter', fallback_price_pence: 180000 },
    { weapon_name: '★ Knife', skin_name: 'Stained', rarity: 'Special Item', market_hash_name: '★ Knife | Stained', fallback_price_pence: 85000 },
    { weapon_name: '★ Knife', skin_name: 'Urban Masked', rarity: 'Special Item', market_hash_name: '★ Knife | Urban Masked', fallback_price_pence: 76000 },
    { weapon_name: '★ Knife', skin_name: 'Boreal Forest', rarity: 'Special Item', market_hash_name: '★ Knife | Boreal Forest', fallback_price_pence: 73000 }
  ]),
  buildCaseDefinition('Operation Bravo Case', [
    { weapon_name: 'Nova', skin_name: 'Tempest', rarity: 'Mil-Spec' },
    { weapon_name: 'Dual Berettas', skin_name: 'Black Limba', rarity: 'Mil-Spec' },
    { weapon_name: 'UMP-45', skin_name: 'Bone Pile', rarity: 'Mil-Spec' },
    { weapon_name: 'SG 553', skin_name: 'Wave Spray', rarity: 'Mil-Spec' },
    { weapon_name: 'Galil AR', skin_name: 'Shattered', rarity: 'Mil-Spec' },
    { weapon_name: 'G3SG1', skin_name: 'Demeter', rarity: 'Mil-Spec' },
    { weapon_name: 'M4A1-S', skin_name: 'Bright Water', rarity: 'Restricted' },
    { weapon_name: 'M4A4', skin_name: 'Zirka', rarity: 'Restricted' },
    { weapon_name: 'MAC-10', skin_name: 'Graven', rarity: 'Restricted' },
    { weapon_name: 'USP-S', skin_name: 'Overgrowth', rarity: 'Restricted' },
    { weapon_name: 'P90', skin_name: 'Emerald Dragon', rarity: 'Classified' },
    { weapon_name: 'P2000', skin_name: 'Ocean Foam', rarity: 'Classified' },
    { weapon_name: 'AWP', skin_name: 'Graphite', rarity: 'Classified' },
    { weapon_name: 'Desert Eagle', skin_name: 'Golden Koi', rarity: 'Covert' },
    { weapon_name: 'AK-47', skin_name: 'Fire Serpent', rarity: 'Covert' }
  ], [
    { weapon_name: '★ Knife', skin_name: 'Blue Steel', rarity: 'Special Item', market_hash_name: '★ Knife | Blue Steel', fallback_price_pence: 90000 },
    { weapon_name: '★ Knife', skin_name: 'Case Hardened', rarity: 'Special Item', market_hash_name: '★ Knife | Case Hardened', fallback_price_pence: 130000 },
    { weapon_name: '★ Knife', skin_name: 'Crimson Web', rarity: 'Special Item', market_hash_name: '★ Knife | Crimson Web', fallback_price_pence: 180000 },
    { weapon_name: '★ Knife', skin_name: 'Fade', rarity: 'Special Item', market_hash_name: '★ Knife | Fade', fallback_price_pence: 220000 },
    { weapon_name: '★ Knife', skin_name: 'Forest DDPAT', rarity: 'Special Item', market_hash_name: '★ Knife | Forest DDPAT', fallback_price_pence: 70000 },
    { weapon_name: '★ Knife', skin_name: 'Night', rarity: 'Special Item', market_hash_name: '★ Knife | Night', fallback_price_pence: 95000 },
    { weapon_name: '★ Knife', skin_name: 'Safari Mesh', rarity: 'Special Item', market_hash_name: '★ Knife | Safari Mesh', fallback_price_pence: 70000 },
    { weapon_name: '★ Knife', skin_name: 'Scorched', rarity: 'Special Item', market_hash_name: '★ Knife | Scorched', fallback_price_pence: 72000 },
    { weapon_name: '★ Knife', skin_name: 'Slaughter', rarity: 'Special Item', market_hash_name: '★ Knife | Slaughter', fallback_price_pence: 180000 },
    { weapon_name: '★ Knife', skin_name: 'Stained', rarity: 'Special Item', market_hash_name: '★ Knife | Stained', fallback_price_pence: 85000 },
    { weapon_name: '★ Knife', skin_name: 'Urban Masked', rarity: 'Special Item', market_hash_name: '★ Knife | Urban Masked', fallback_price_pence: 76000 },
    { weapon_name: '★ Knife', skin_name: 'Boreal Forest', rarity: 'Special Item', market_hash_name: '★ Knife | Boreal Forest', fallback_price_pence: 73000 }
  ]),
  buildCaseDefinition('Kilowatt Case', [
    { weapon_name: 'Nova', skin_name: 'Dark Sigil', rarity: 'Mil-Spec' },
    { weapon_name: 'Dual Berettas', skin_name: 'Hideout', rarity: 'Mil-Spec' },
    { weapon_name: 'UMP-45', skin_name: 'Motorized', rarity: 'Mil-Spec' },
    { weapon_name: 'XM1014', skin_name: 'Irezumi', rarity: 'Mil-Spec' },
    { weapon_name: 'Tec-9', skin_name: 'Slag', rarity: 'Mil-Spec' },
    { weapon_name: 'SSG 08', skin_name: 'Dezastre', rarity: 'Mil-Spec' },
    { weapon_name: 'MAC-10', skin_name: 'Light Box', rarity: 'Mil-Spec' },
    { weapon_name: 'Sawed-Off', skin_name: 'Analog Input', rarity: 'Restricted' },
    { weapon_name: 'MP7', skin_name: 'Just Smile', rarity: 'Restricted' },
    { weapon_name: 'Five-SeveN', skin_name: 'Hybrid', rarity: 'Restricted' },
    { weapon_name: 'M4A4', skin_name: 'Etch Lord', rarity: 'Restricted' },
    { weapon_name: 'Glock-18', skin_name: 'Block-18', rarity: 'Restricted' },
    { weapon_name: 'Zeus x27', skin_name: 'Olympus', rarity: 'Classified' },
    { weapon_name: 'USP-S', skin_name: 'Jawbreaker', rarity: 'Classified' },
    { weapon_name: 'M4A1-S', skin_name: 'Black Lotus', rarity: 'Classified' },
    { weapon_name: 'AWP', skin_name: 'Chrome Cannon', rarity: 'Covert' },
    { weapon_name: 'AK-47', skin_name: 'Inheritance', rarity: 'Covert' }
  ], [
    { weapon_name: '★ Kukri Knife', skin_name: 'Blue Steel', rarity: 'Special Item', market_hash_name: '★ Kukri Knife | Blue Steel', fallback_price_pence: 110000 },
    { weapon_name: '★ Kukri Knife', skin_name: 'Case Hardened', rarity: 'Special Item', market_hash_name: '★ Kukri Knife | Case Hardened', fallback_price_pence: 150000 },
    { weapon_name: '★ Kukri Knife', skin_name: 'Crimson Web', rarity: 'Special Item', market_hash_name: '★ Kukri Knife | Crimson Web', fallback_price_pence: 170000 },
    { weapon_name: '★ Kukri Knife', skin_name: 'Fade', rarity: 'Special Item', market_hash_name: '★ Kukri Knife | Fade', fallback_price_pence: 210000 },
    { weapon_name: '★ Kukri Knife', skin_name: 'Forest DDPAT', rarity: 'Special Item', market_hash_name: '★ Kukri Knife | Forest DDPAT', fallback_price_pence: 95000 },
    { weapon_name: '★ Kukri Knife', skin_name: 'Night Stripe', rarity: 'Special Item', market_hash_name: '★ Kukri Knife | Night Stripe', fallback_price_pence: 98000 },
    { weapon_name: '★ Kukri Knife', skin_name: 'Safari Mesh', rarity: 'Special Item', market_hash_name: '★ Kukri Knife | Safari Mesh', fallback_price_pence: 90000 },
    { weapon_name: '★ Kukri Knife', skin_name: 'Scorched', rarity: 'Special Item', market_hash_name: '★ Kukri Knife | Scorched', fallback_price_pence: 90000 },
    { weapon_name: '★ Kukri Knife', skin_name: 'Slaughter', rarity: 'Special Item', market_hash_name: '★ Kukri Knife | Slaughter', fallback_price_pence: 190000 },
    { weapon_name: '★ Kukri Knife', skin_name: 'Stained', rarity: 'Special Item', market_hash_name: '★ Kukri Knife | Stained', fallback_price_pence: 105000 },
    { weapon_name: '★ Kukri Knife', skin_name: 'Urban Masked', rarity: 'Special Item', market_hash_name: '★ Kukri Knife | Urban Masked', fallback_price_pence: 96000 },
    { weapon_name: '★ Kukri Knife', skin_name: 'Boreal Forest', rarity: 'Special Item', market_hash_name: '★ Kukri Knife | Boreal Forest', fallback_price_pence: 94000 },
    { weapon_name: '★ Kukri Knife', skin_name: 'Vanilla', rarity: 'Special Item', market_hash_name: '★ Kukri Knife | Vanilla', fallback_price_pence: 140000 }
  ]),
  buildCaseDefinition('Gallery Case', [
    { weapon_name: 'M249', skin_name: 'Hypnosis', rarity: 'Mil-Spec' },
    { weapon_name: 'MP5-SD', skin_name: 'Statics', rarity: 'Mil-Spec' },
    { weapon_name: 'AUG', skin_name: 'Luxe Trim', rarity: 'Mil-Spec' },
    { weapon_name: 'SCAR-20', skin_name: 'Trail Blazer', rarity: 'Mil-Spec' },
    { weapon_name: 'R8 Revolver', skin_name: 'Tango', rarity: 'Mil-Spec' },
    { weapon_name: 'USP-S', skin_name: '27', rarity: 'Mil-Spec' },
    { weapon_name: 'Desert Eagle', skin_name: 'Calligraffiti', rarity: 'Mil-Spec' },
    { weapon_name: 'P90', skin_name: 'Randy Rush', rarity: 'Restricted' },
    { weapon_name: 'Dual Berettas', skin_name: 'Hydro Strike', rarity: 'Restricted' },
    { weapon_name: 'SSG 08', skin_name: 'Rapid Transit', rarity: 'Restricted' },
    { weapon_name: 'MAC-10', skin_name: 'Saibā Oni', rarity: 'Restricted' },
    { weapon_name: 'M4A4', skin_name: 'Turbine', rarity: 'Restricted' },
    { weapon_name: 'UMP-45', skin_name: 'Neo-Noir', rarity: 'Classified' },
    { weapon_name: 'P250', skin_name: 'Epicenter', rarity: 'Classified' },
    { weapon_name: 'AK-47', skin_name: 'The Outsiders', rarity: 'Classified' },
    { weapon_name: 'Glock-18', skin_name: 'Gold Toof', rarity: 'Covert' },
    { weapon_name: 'M4A1-S', skin_name: 'Vaporwave', rarity: 'Covert' }
  ], [
    { weapon_name: '★ Kukri Knife', skin_name: 'Blue Steel', rarity: 'Special Item', market_hash_name: '★ Kukri Knife | Blue Steel', fallback_price_pence: 110000 },
    { weapon_name: '★ Kukri Knife', skin_name: 'Case Hardened', rarity: 'Special Item', market_hash_name: '★ Kukri Knife | Case Hardened', fallback_price_pence: 150000 },
    { weapon_name: '★ Kukri Knife', skin_name: 'Crimson Web', rarity: 'Special Item', market_hash_name: '★ Kukri Knife | Crimson Web', fallback_price_pence: 170000 },
    { weapon_name: '★ Kukri Knife', skin_name: 'Fade', rarity: 'Special Item', market_hash_name: '★ Kukri Knife | Fade', fallback_price_pence: 210000 },
    { weapon_name: '★ Kukri Knife', skin_name: 'Forest DDPAT', rarity: 'Special Item', market_hash_name: '★ Kukri Knife | Forest DDPAT', fallback_price_pence: 95000 },
    { weapon_name: '★ Kukri Knife', skin_name: 'Night Stripe', rarity: 'Special Item', market_hash_name: '★ Kukri Knife | Night Stripe', fallback_price_pence: 98000 },
    { weapon_name: '★ Kukri Knife', skin_name: 'Safari Mesh', rarity: 'Special Item', market_hash_name: '★ Kukri Knife | Safari Mesh', fallback_price_pence: 90000 },
    { weapon_name: '★ Kukri Knife', skin_name: 'Scorched', rarity: 'Special Item', market_hash_name: '★ Kukri Knife | Scorched', fallback_price_pence: 90000 },
    { weapon_name: '★ Kukri Knife', skin_name: 'Slaughter', rarity: 'Special Item', market_hash_name: '★ Kukri Knife | Slaughter', fallback_price_pence: 190000 },
    { weapon_name: '★ Kukri Knife', skin_name: 'Stained', rarity: 'Special Item', market_hash_name: '★ Kukri Knife | Stained', fallback_price_pence: 105000 },
    { weapon_name: '★ Kukri Knife', skin_name: 'Urban Masked', rarity: 'Special Item', market_hash_name: '★ Kukri Knife | Urban Masked', fallback_price_pence: 96000 },
    { weapon_name: '★ Kukri Knife', skin_name: 'Boreal Forest', rarity: 'Special Item', market_hash_name: '★ Kukri Knife | Boreal Forest', fallback_price_pence: 94000 },
    { weapon_name: '★ Kukri Knife', skin_name: 'Vanilla', rarity: 'Special Item', market_hash_name: '★ Kukri Knife | Vanilla', fallback_price_pence: 140000 }
  ]),
  buildCaseDefinition('Anubis Collection', [
    { weapon_name: 'R8 Revolver', skin_name: 'Inlay', rarity: 'Consumer Grade' },
    { weapon_name: 'M249', skin_name: 'Submerged', rarity: 'Consumer Grade' },
    { weapon_name: 'XM1014', skin_name: 'Hieroglyph', rarity: 'Consumer Grade' },
    { weapon_name: 'MP7', skin_name: 'Sunbaked', rarity: 'Consumer Grade' },
    { weapon_name: 'AUG', skin_name: 'Snake Pit', rarity: 'Consumer Grade' },
    { weapon_name: 'M4A1-S', skin_name: 'Mud-Spec', rarity: 'Industrial Grade' },
    { weapon_name: 'SSG 08', skin_name: 'Azure Glyph', rarity: 'Industrial Grade' },
    { weapon_name: 'USP-S', skin_name: 'Desert Tactical', rarity: 'Industrial Grade' },
    { weapon_name: 'MAC-10', skin_name: 'Echoing Sands', rarity: 'Industrial Grade' },
    { weapon_name: 'Tec-9', skin_name: "Mummy's Rot", rarity: 'Mil-Spec' },
    { weapon_name: 'AK-47', skin_name: 'Steel Delta', rarity: 'Mil-Spec' },
    { weapon_name: 'AWP', skin_name: 'Black Nile', rarity: 'Mil-Spec' },
    { weapon_name: 'MAG-7', skin_name: 'Copper Coated', rarity: 'Mil-Spec' },
    { weapon_name: 'Glock-18', skin_name: "Ramese's Reach", rarity: 'Restricted' },
    { weapon_name: 'Nova', skin_name: "Sobek's Bite", rarity: 'Restricted' },
    { weapon_name: 'P90', skin_name: 'ScaraB Rush', rarity: 'Restricted' },
    { weapon_name: 'FAMAS', skin_name: 'Waters of Nephthys', rarity: 'Classified' },
    { weapon_name: 'P250', skin_name: "Apep's Curse", rarity: 'Classified' },
    { weapon_name: 'M4A4', skin_name: 'Eye of Horus', rarity: 'Covert' }
  ]),
  buildCaseDefinition('Ancient Collection', [
    { weapon_name: 'Nova', skin_name: 'Army Sheen', rarity: 'Consumer Grade' },
    { weapon_name: 'SG 553', skin_name: 'Lush Ruins', rarity: 'Consumer Grade' },
    { weapon_name: 'P90', skin_name: 'Ancient Earth', rarity: 'Consumer Grade' },
    { weapon_name: 'SSG 08', skin_name: 'Jungle Dashed', rarity: 'Consumer Grade' },
    { weapon_name: 'R8 Revolver', skin_name: 'Night', rarity: 'Consumer Grade' },
    { weapon_name: 'MP7', skin_name: 'Tall Grass', rarity: 'Industrial Grade' },
    { weapon_name: 'P2000', skin_name: 'Panther Camo', rarity: 'Industrial Grade' },
    { weapon_name: 'G3SG1', skin_name: 'Ancient Ritual', rarity: 'Industrial Grade' },
    { weapon_name: 'CZ75-Auto', skin_name: 'Silver', rarity: 'Industrial Grade' },
    { weapon_name: 'FAMAS', skin_name: 'Dark Water', rarity: 'Mil-Spec' },
    { weapon_name: 'Galil AR', skin_name: 'Dusk Ruins', rarity: 'Mil-Spec' },
    { weapon_name: 'AUG', skin_name: 'Carved Jade', rarity: 'Mil-Spec' },
    { weapon_name: 'Tec-9', skin_name: 'Blast From the Past', rarity: 'Mil-Spec' },
    { weapon_name: 'XM1014', skin_name: 'Ancient Lore', rarity: 'Restricted' },
    { weapon_name: 'MAC-10', skin_name: 'Gold Brick', rarity: 'Restricted' },
    { weapon_name: 'USP-S', skin_name: 'Ancient Visions', rarity: 'Restricted' },
    { weapon_name: 'P90', skin_name: 'Run and Hide', rarity: 'Classified' },
    { weapon_name: 'AK-47', skin_name: 'Panthera onca', rarity: 'Classified' },
    { weapon_name: 'M4A1-S', skin_name: 'Welcome to the Jungle', rarity: 'Covert' }
  ]),
  buildCaseDefinition('Graphic Collection', [
    { weapon_name: 'MP7', skin_name: 'Astrolabe', rarity: 'Industrial Grade' },
    { weapon_name: 'M249', skin_name: 'Spectogram', rarity: 'Industrial Grade' },
    { weapon_name: 'FAMAS', skin_name: 'Halftone Wash', rarity: 'Industrial Grade' },
    { weapon_name: 'SSG 08', skin_name: 'Halftone Whorl', rarity: 'Industrial Grade' },
    { weapon_name: 'P2000', skin_name: 'Coral Halftone', rarity: 'Industrial Grade' },
    { weapon_name: 'Galil AR', skin_name: 'NV', rarity: 'Industrial Grade' },
    { weapon_name: 'SG 553', skin_name: 'Berry Gel Coat', rarity: 'Mil-Spec' },
    { weapon_name: 'XM1014', skin_name: 'Halftone Shift', rarity: 'Mil-Spec' },
    { weapon_name: 'SCAR-20', skin_name: 'Wild Berry', rarity: 'Mil-Spec' },
    { weapon_name: 'AK-47', skin_name: 'Crossfade', rarity: 'Mil-Spec' },
    { weapon_name: 'M4A4', skin_name: 'Polysoup', rarity: 'Restricted' },
    { weapon_name: 'P90', skin_name: 'Attack Vector', rarity: 'Restricted' },
    { weapon_name: 'AUG', skin_name: "Lil' Pig", rarity: 'Classified' },
    { weapon_name: 'Desert Eagle', skin_name: 'Starcade', rarity: 'Classified' },
    { weapon_name: 'AWP', skin_name: 'CMYK', rarity: 'Covert' }
  ])
];

export const CS2_CASE_ITEM_DEFINITIONS_BY_NAME = new Map(CS2_CASE_ITEM_DEFINITIONS.map((entry) => [entry.case_name, entry]));

export { fallbackSkinValuePence, rarityColorHex, rarityWeight };
