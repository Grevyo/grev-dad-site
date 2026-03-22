export const YGO_RARITIES = {
  common: {
    code: 'common',
    label: 'Common',
    foil: 'Nothing special.',
    style: 'Plain finish, standard nameplate.',
    pull_weight: 560,
    sell_back_percent: 50,
    card_color: '#94a3b8'
  },
  rare: {
    code: 'rare',
    label: 'Rare',
    foil: 'Silver card name.',
    style: 'One guaranteed per pack.',
    pull_weight: 0,
    sell_back_percent: 58,
    card_color: '#dbeafe'
  },
  super: {
    code: 'super',
    label: 'Super Rare',
    foil: 'Black name with holo art.',
    style: 'Holo art flash with dark type line.',
    pull_weight: 150,
    sell_back_percent: 62,
    card_color: '#60a5fa'
  },
  ultra: {
    code: 'ultra',
    label: 'Ultra Rare',
    foil: 'Gold name and holo art.',
    style: 'Premium holo with gold title text.',
    pull_weight: 70,
    sell_back_percent: 68,
    card_color: '#fbbf24'
  },
  ultimate: {
    code: 'ultimate',
    label: 'Ultimate Rare',
    foil: 'Gold name, holo art, embossed edges, attribute, and stars.',
    style: 'Thin embossed finish across the frame.',
    pull_weight: 20,
    sell_back_percent: 74,
    card_color: '#f59e0b'
  },
  ghost: {
    code: 'ghost',
    label: 'Ghost Rare',
    foil: 'Shiny name and card art that is practically all-white.',
    style: 'Signature spectral foil treatment, usually one per set chase.',
    pull_weight: 4,
    sell_back_percent: 82,
    card_color: '#e2e8f0'
  },
  secret: {
    code: 'secret',
    label: 'Secret Rare',
    foil: 'Silver name, holo art, diagonal sparkles across the art.',
    style: 'Diagonal sparkle foil pattern over holo art.',
    pull_weight: 36,
    sell_back_percent: 76,
    card_color: '#c4b5fd'
  }
};

export const YGO_PACKS = [
  {
    slug: 'legend-of-grev',
    set_name: 'Legend of Grev',
    ygoprodeck_set_id: 'legend-of-blue-eyes-white-dragon',
    description: 'Retro dragon-heavy opener with nostalgic chase cards and clean entry pricing.',
    pack_price_coins: 425,
    cards_per_pack: 5,
    guaranteed_rare_slot: 'rare',
    cover_card_name: 'Blue-Eyes White Dragon',
    cover_image_url: 'https://images.ygoprodeck.com/images/cards/89631139.jpg',
    mission_reward_coins: 120,
    streak_reward_coins: 55
  },
  {
    slug: 'chaos-archives',
    set_name: 'Chaos Archives',
    ygoprodeck_set_id: 'invasion-of-chaos',
    description: 'Higher risk, higher ceiling pack built around iconic chaos-era pulls.',
    pack_price_coins: 650,
    cards_per_pack: 5,
    guaranteed_rare_slot: 'rare',
    cover_card_name: 'Dark Magician Girl',
    cover_image_url: 'https://images.ygoprodeck.com/images/cards/38033121.jpg',
    mission_reward_coins: 160,
    streak_reward_coins: 80
  }
];

export const YGO_CARDS = [
  { set_slug: 'legend-of-grev', card_name: 'Blue-Eyes White Dragon', ygoprodeck_card_id: 89631139, rarity_code: 'ghost', estimated_price_coins: 8200, card_type: 'Normal Monster', attribute: 'LIGHT', level_stars: 8, attack_points: 3000, defense_points: 2500, image_url: 'https://images.ygoprodeck.com/images/cards/89631139.jpg', external_price_note: 'High-end ghost chase value aligned to premium collector pricing.', source_url: 'https://ygoprodeck.com/card/blue-eyes-white-dragon-7485' },
  { set_slug: 'legend-of-grev', card_name: 'Dark Magician', ygoprodeck_card_id: 46986414, rarity_code: 'ultimate', estimated_price_coins: 5600, card_type: 'Normal Monster', attribute: 'DARK', level_stars: 7, attack_points: 2500, defense_points: 2100, image_url: 'https://images.ygoprodeck.com/images/cards/46986414.jpg', external_price_note: 'Ultimate foil estimate based on iconic collector demand.', source_url: 'https://ygoprodeck.com/card/dark-magician-4003' },
  { set_slug: 'legend-of-grev', card_name: 'Red-Eyes Black Dragon', ygoprodeck_card_id: 74677422, rarity_code: 'secret', estimated_price_coins: 3400, card_type: 'Normal Monster', attribute: 'DARK', level_stars: 7, attack_points: 2400, defense_points: 2000, image_url: 'https://images.ygoprodeck.com/images/cards/74677422.jpg', external_price_note: 'Secret rare benchmarked to steady nostalgia demand.', source_url: 'https://ygoprodeck.com/card/red-eyes-black-dragon-6203' },
  { set_slug: 'legend-of-grev', card_name: 'Summoned Skull', ygoprodeck_card_id: 70781052, rarity_code: 'ultra', estimated_price_coins: 2100, card_type: 'Normal Monster', attribute: 'DARK', level_stars: 6, attack_points: 2500, defense_points: 1200, image_url: 'https://images.ygoprodeck.com/images/cards/70781052.jpg', external_price_note: 'Ultra rare estimated from evergreen collector listings.', source_url: 'https://ygoprodeck.com/card/summoned-skull-4563' },
  { set_slug: 'legend-of-grev', card_name: 'Exodia the Forbidden One', ygoprodeck_card_id: 33396948, rarity_code: 'ultra', estimated_price_coins: 2650, card_type: 'Effect Monster', attribute: 'DARK', level_stars: 3, attack_points: 1000, defense_points: 1000, image_url: 'https://images.ygoprodeck.com/images/cards/33396948.jpg', external_price_note: 'Icon card estimated at a stronger-than-baseline ultra value.', source_url: 'https://ygoprodeck.com/card/exodia-the-forbidden-one-5304' },
  { set_slug: 'legend-of-grev', card_name: 'Gaia The Fierce Knight', ygoprodeck_card_id: 6368038, rarity_code: 'super', estimated_price_coins: 980, card_type: 'Normal Monster', attribute: 'EARTH', level_stars: 7, attack_points: 2300, defense_points: 2100, image_url: 'https://images.ygoprodeck.com/images/cards/6368038.jpg', external_price_note: 'Super rare set staple with mid-tier value.', source_url: 'https://ygoprodeck.com/card/gaia-the-fierce-knight-4365' },
  { set_slug: 'legend-of-grev', card_name: 'Celtic Guardian', ygoprodeck_card_id: 91152256, rarity_code: 'super', estimated_price_coins: 760, card_type: 'Normal Monster', attribute: 'EARTH', level_stars: 4, attack_points: 1400, defense_points: 1200, image_url: 'https://images.ygoprodeck.com/images/cards/91152256.jpg', external_price_note: 'Super rare nostalgic warrior price estimate.', source_url: 'https://ygoprodeck.com/card/celtic-guardian-4315' },
  { set_slug: 'legend-of-grev', card_name: 'Kuriboh', ygoprodeck_card_id: 40640057, rarity_code: 'rare', estimated_price_coins: 320, card_type: 'Effect Monster', attribute: 'DARK', level_stars: 1, attack_points: 300, defense_points: 200, image_url: 'https://images.ygoprodeck.com/images/cards/40640057.jpg', external_price_note: 'Rare slot anchor card.', source_url: 'https://ygoprodeck.com/card/kuriboh-5000' },
  { set_slug: 'legend-of-grev', card_name: 'Monster Reborn', ygoprodeck_card_id: 83764718, rarity_code: 'rare', estimated_price_coins: 360, card_type: 'Spell Card', attribute: '', level_stars: 0, attack_points: 0, defense_points: 0, image_url: 'https://images.ygoprodeck.com/images/cards/83764718.jpg', external_price_note: 'Rare utility spell estimate.', source_url: 'https://ygoprodeck.com/card/monster-reborn-4371' },
  { set_slug: 'legend-of-grev', card_name: 'Swords of Revealing Light', ygoprodeck_card_id: 72302403, rarity_code: 'rare', estimated_price_coins: 240, card_type: 'Spell Card', attribute: '', level_stars: 0, attack_points: 0, defense_points: 0, image_url: 'https://images.ygoprodeck.com/images/cards/72302403.jpg', external_price_note: 'Rare spell with lower sell-back floor.', source_url: 'https://ygoprodeck.com/card/swords-of-revealing-light-5520' },
  { set_slug: 'legend-of-grev', card_name: 'Mystical Elf', ygoprodeck_card_id: 15025844, rarity_code: 'common', estimated_price_coins: 95, card_type: 'Normal Monster', attribute: 'LIGHT', level_stars: 4, attack_points: 800, defense_points: 2000, image_url: 'https://images.ygoprodeck.com/images/cards/15025844.jpg', external_price_note: 'Fallback common price.', source_url: 'https://ygoprodeck.com/card/mystical-elf-4530' },
  { set_slug: 'legend-of-grev', card_name: 'Trap Hole', ygoprodeck_card_id: 42941100, rarity_code: 'common', estimated_price_coins: 90, card_type: 'Trap Card', attribute: '', level_stars: 0, attack_points: 0, defense_points: 0, image_url: 'https://images.ygoprodeck.com/images/cards/42941100.jpg', external_price_note: 'Fallback common price.', source_url: 'https://ygoprodeck.com/card/trap-hole-4402' },
  { set_slug: 'legend-of-grev', card_name: 'Feral Imp', ygoprodeck_card_id: 41392891, rarity_code: 'common', estimated_price_coins: 70, card_type: 'Normal Monster', attribute: 'DARK', level_stars: 4, attack_points: 1300, defense_points: 1400, image_url: 'https://images.ygoprodeck.com/images/cards/41392891.jpg', external_price_note: 'Fallback common price.', source_url: 'https://ygoprodeck.com/card/feral-imp-4274' },
  { set_slug: 'legend-of-grev', card_name: 'Hane-Hane', ygoprodeck_card_id: 07089711, rarity_code: 'common', estimated_price_coins: 75, card_type: 'Effect Monster', attribute: 'EARTH', level_stars: 2, attack_points: 450, defense_points: 500, image_url: 'https://images.ygoprodeck.com/images/cards/7089711.jpg', external_price_note: 'Fallback common price.', source_url: 'https://ygoprodeck.com/card/hane-hane-4419' },
  { set_slug: 'legend-of-grev', card_name: 'Witty Phantom', ygoprodeck_card_id: 36304921, rarity_code: 'common', estimated_price_coins: 60, card_type: 'Normal Monster', attribute: 'DARK', level_stars: 4, attack_points: 1400, defense_points: 1300, image_url: 'https://images.ygoprodeck.com/images/cards/36304921.jpg', external_price_note: 'Fallback common price.', source_url: 'https://ygoprodeck.com/card/witty-phantom-4258' },

  { set_slug: 'chaos-archives', card_name: 'Dark Magician Girl', ygoprodeck_card_id: 38033121, rarity_code: 'ghost', estimated_price_coins: 9600, card_type: 'Effect Monster', attribute: 'DARK', level_stars: 6, attack_points: 2000, defense_points: 1700, image_url: 'https://images.ygoprodeck.com/images/cards/38033121.jpg', external_price_note: 'Top chase price aligned to premium DMG collector demand.', source_url: 'https://ygoprodeck.com/card/dark-magician-girl-4038' },
  { set_slug: 'chaos-archives', card_name: 'Black Luster Soldier - Envoy of the Beginning', ygoprodeck_card_id: 72989439, rarity_code: 'ultimate', estimated_price_coins: 6100, card_type: 'Effect Monster', attribute: 'LIGHT', level_stars: 8, attack_points: 3000, defense_points: 2500, image_url: 'https://images.ygoprodeck.com/images/cards/72989439.jpg', external_price_note: 'Ultimate rare estimate from iconic chaos-era chase pricing.', source_url: 'https://ygoprodeck.com/card/black-luster-soldier-envoy-of-the-beginning-5903' },
  { set_slug: 'chaos-archives', card_name: 'Chaos Emperor Dragon - Envoy of the End', ygoprodeck_card_id: 82301904, rarity_code: 'secret', estimated_price_coins: 4300, card_type: 'Effect Monster', attribute: 'DARK', level_stars: 8, attack_points: 3000, defense_points: 2500, image_url: 'https://images.ygoprodeck.com/images/cards/82301904.jpg', external_price_note: 'Secret rare estimated from collector demand.', source_url: 'https://ygoprodeck.com/card/chaos-emperor-dragon-envoy-of-the-end-5428' },
  { set_slug: 'chaos-archives', card_name: 'Jinzo', ygoprodeck_card_id: 77585513, rarity_code: 'ultra', estimated_price_coins: 2350, card_type: 'Effect Monster', attribute: 'DARK', level_stars: 6, attack_points: 2400, defense_points: 1500, image_url: 'https://images.ygoprodeck.com/images/cards/77585513.jpg', external_price_note: 'Ultra rare set highlight estimate.', source_url: 'https://ygoprodeck.com/card/jinzo-4693' },
  { set_slug: 'chaos-archives', card_name: 'Buster Blader', ygoprodeck_card_id: 78193831, rarity_code: 'ultra', estimated_price_coins: 2200, card_type: 'Effect Monster', attribute: 'EARTH', level_stars: 7, attack_points: 2600, defense_points: 2300, image_url: 'https://images.ygoprodeck.com/images/cards/78193831.jpg', external_price_note: 'Collector-favorite ultra estimate.', source_url: 'https://ygoprodeck.com/card/buster-blader-4707' },
  { set_slug: 'chaos-archives', card_name: 'Injection Fairy Lily', ygoprodeck_card_id: 79575620, rarity_code: 'super', estimated_price_coins: 1150, card_type: 'Effect Monster', attribute: 'EARTH', level_stars: 3, attack_points: 400, defense_points: 1500, image_url: 'https://images.ygoprodeck.com/images/cards/79575620.jpg', external_price_note: 'Premium super estimate.', source_url: 'https://ygoprodeck.com/card/injection-fairy-lily-4975' },
  { set_slug: 'chaos-archives', card_name: 'Chaos Sorcerer', ygoprodeck_card_id: 09596126, rarity_code: 'super', estimated_price_coins: 840, card_type: 'Effect Monster', attribute: 'DARK', level_stars: 6, attack_points: 2300, defense_points: 2000, image_url: 'https://images.ygoprodeck.com/images/cards/9596126.jpg', external_price_note: 'Mid-tier holo estimate.', source_url: 'https://ygoprodeck.com/card/chaos-sorcerer-5924' },
  { set_slug: 'chaos-archives', card_name: 'Skilled Dark Magician', ygoprodeck_card_id: 73752131, rarity_code: 'rare', estimated_price_coins: 390, card_type: 'Effect Monster', attribute: 'DARK', level_stars: 4, attack_points: 1900, defense_points: 1700, image_url: 'https://images.ygoprodeck.com/images/cards/73752131.jpg', external_price_note: 'Rare slot anchor card.', source_url: 'https://ygoprodeck.com/card/skilled-dark-magician-5522' },
  { set_slug: 'chaos-archives', card_name: 'Magician of Faith', ygoprodeck_card_id: 31560081, rarity_code: 'rare', estimated_price_coins: 345, card_type: 'Effect Monster', attribute: 'LIGHT', level_stars: 1, attack_points: 300, defense_points: 400, image_url: 'https://images.ygoprodeck.com/images/cards/31560081.jpg', external_price_note: 'Rare utility flip estimate.', source_url: 'https://ygoprodeck.com/card/magician-of-faith-4980' },
  { set_slug: 'chaos-archives', card_name: 'Book of Moon', ygoprodeck_card_id: 14087893, rarity_code: 'rare', estimated_price_coins: 330, card_type: 'Quick-Play Spell Card', attribute: '', level_stars: 0, attack_points: 0, defense_points: 0, image_url: 'https://images.ygoprodeck.com/images/cards/14087893.jpg', external_price_note: 'Rare spell estimate.', source_url: 'https://ygoprodeck.com/card/book-of-moon-5942' },
  { set_slug: 'chaos-archives', card_name: 'Marauding Captain', ygoprodeck_card_id: 02359737, rarity_code: 'common', estimated_price_coins: 120, card_type: 'Effect Monster', attribute: 'EARTH', level_stars: 3, attack_points: 1200, defense_points: 400, image_url: 'https://images.ygoprodeck.com/images/cards/2359737.jpg', external_price_note: 'Fallback common price.', source_url: 'https://ygoprodeck.com/card/marauding-captain-4938' },
  { set_slug: 'chaos-archives', card_name: 'D. D. Warrior Lady', ygoprodeck_card_id: 07572887, rarity_code: 'common', estimated_price_coins: 110, card_type: 'Effect Monster', attribute: 'LIGHT', level_stars: 4, attack_points: 1500, defense_points: 1600, image_url: 'https://images.ygoprodeck.com/images/cards/7572887.jpg', external_price_note: 'Fallback common price.', source_url: 'https://ygoprodeck.com/card/d-d-warrior-lady-5930' },
  { set_slug: 'chaos-archives', card_name: 'Smashing Ground', ygoprodeck_card_id: 97169186, rarity_code: 'common', estimated_price_coins: 95, card_type: 'Spell Card', attribute: '', level_stars: 0, attack_points: 0, defense_points: 0, image_url: 'https://images.ygoprodeck.com/images/cards/97169186.jpg', external_price_note: 'Fallback common price.', source_url: 'https://ygoprodeck.com/card/smashing-ground-5927' },
  { set_slug: 'chaos-archives', card_name: 'Berserk Gorilla', ygoprodeck_card_id: 80233946, rarity_code: 'common', estimated_price_coins: 100, card_type: 'Effect Monster', attribute: 'EARTH', level_stars: 4, attack_points: 2000, defense_points: 1000, image_url: 'https://images.ygoprodeck.com/images/cards/80233946.jpg', external_price_note: 'Fallback common price.', source_url: 'https://ygoprodeck.com/card/berserk-gorilla-5916' },
  { set_slug: 'chaos-archives', card_name: 'Compulsory Evacuation Device', ygoprodeck_card_id: 94192409, rarity_code: 'common', estimated_price_coins: 90, card_type: 'Trap Card', attribute: '', level_stars: 0, attack_points: 0, defense_points: 0, image_url: 'https://images.ygoprodeck.com/images/cards/94192409.jpg', external_price_note: 'Fallback common price.', source_url: 'https://ygoprodeck.com/card/compulsory-evacuation-device-5928' }
];

export const YGO_ACHIEVEMENTS = [
  { code: 'first_pack', title: 'Heart of the Packs', description: 'Open your first Yu-Gi-Oh pack.', target_value: 1, reward_coins: 120, metric_key: 'packs_opened' },
  { code: 'ten_packs', title: 'Booster Ritual', description: 'Open 10 packs in the Yu-Gi-Oh playground.', target_value: 10, reward_coins: 450, metric_key: 'packs_opened' },
  { code: 'ghost_pull', title: 'Ghosted', description: 'Pull a Ghost Rare card.', target_value: 1, reward_coins: 900, metric_key: 'ghost_pulls' },
  { code: 'collector_25', title: 'Binder Builder', description: 'Own 25 Yu-Gi-Oh cards total.', target_value: 25, reward_coins: 350, metric_key: 'cards_owned' }
];
