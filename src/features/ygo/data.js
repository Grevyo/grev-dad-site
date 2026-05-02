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
    set_name: 'Spaced',
    ygoprodeck_set_id: 'legend-of-blue-eyes-white-dragon',
    description: 'Retro dragon-heavy opener with nostalgic chase cards and cleaner entry pricing for the shared GC economy.',
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
  },
  {
    slug: 'elemental-academy',
    set_name: 'Elemental Academy',
    ygoprodeck_set_id: 'elemental-energy',
    description: 'Jaden-flavored GX opener with Elemental HERO staples and academy icons.',
    pack_price_coins: 575,
    cards_per_pack: 5,
    guaranteed_rare_slot: 'rare',
    cover_card_name: 'Elemental HERO Flame Wingman',
    cover_image_url: 'https://images.ygoprodeck.com/images/cards/35809262.jpg',
    mission_reward_coins: 140,
    streak_reward_coins: 70
  },
  {
    slug: 'cyber-revolution',
    set_name: 'Cyber Revolution',
    ygoprodeck_set_id: 'cybernetic-revolution',
    description: 'Zane-focused GX set led by Cyber Dragon lines and machine power cards.',
    pack_price_coins: 560,
    cards_per_pack: 5,
    guaranteed_rare_slot: 'rare',
    cover_card_name: 'Cyber Dragon',
    cover_image_url: 'https://images.ygoprodeck.com/images/cards/70095154.jpg',
    mission_reward_coins: 135,
    streak_reward_coins: 68
  },
  {
    slug: 'ancient-gear-forge',
    set_name: 'Ancient Gear Forge',
    ygoprodeck_set_id: 'the-lost-millennium',
    description: 'Crowler-style GX pack with Ancient Gear bosses and heavy-hitting support.',
    pack_price_coins: 540,
    cards_per_pack: 5,
    guaranteed_rare_slot: 'rare',
    cover_card_name: 'Ancient Gear Golem',
    cover_image_url: 'https://images.ygoprodeck.com/images/cards/83104731.jpg',
    mission_reward_coins: 130,
    streak_reward_coins: 65
  },
  {
    slug: 'rainbow-chaos',
    set_name: 'Rainbow Chaos',
    ygoprodeck_set_id: 'tactical-evolution',
    description: 'Late-GX chase pack built around Crystal Beasts, Rainbow Dragon, and darkness-era hitters.',
    pack_price_coins: 610,
    cards_per_pack: 5,
    guaranteed_rare_slot: 'rare',
    cover_card_name: 'Rainbow Dragon',
    cover_image_url: 'https://images.ygoprodeck.com/images/cards/79856792.jpg',
    mission_reward_coins: 150,
    streak_reward_coins: 75
  },
  {
    slug: 'destiny-showdown',
    set_name: 'Destiny Showdown',
    ygoprodeck_set_id: 'enemy-of-justice',
    description: 'Aster and rivals-focused GX pack with Destiny HERO pressure and iconic duelists.',
    pack_price_coins: 590,
    cards_per_pack: 5,
    guaranteed_rare_slot: 'rare',
    cover_card_name: 'Destiny HERO - Plasma',
    cover_image_url: 'https://images.ygoprodeck.com/images/cards/83965310.jpg',
    mission_reward_coins: 145,
    streak_reward_coins: 72
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
  { set_slug: 'legend-of-grev', card_name: 'Hane-Hane', ygoprodeck_card_id: 7089711, rarity_code: 'common', estimated_price_coins: 75, card_type: 'Effect Monster', attribute: 'EARTH', level_stars: 2, attack_points: 450, defense_points: 500, image_url: 'https://images.ygoprodeck.com/images/cards/7089711.jpg', external_price_note: 'Fallback common price.', source_url: 'https://ygoprodeck.com/card/hane-hane-4419' },
  { set_slug: 'legend-of-grev', card_name: 'Witty Phantom', ygoprodeck_card_id: 36304921, rarity_code: 'common', estimated_price_coins: 60, card_type: 'Normal Monster', attribute: 'DARK', level_stars: 4, attack_points: 1400, defense_points: 1300, image_url: 'https://images.ygoprodeck.com/images/cards/36304921.jpg', external_price_note: 'Fallback common price.', source_url: 'https://ygoprodeck.com/card/witty-phantom-4258' },

  { set_slug: 'chaos-archives', card_name: 'Dark Magician Girl', ygoprodeck_card_id: 38033121, rarity_code: 'ghost', estimated_price_coins: 9600, card_type: 'Effect Monster', attribute: 'DARK', level_stars: 6, attack_points: 2000, defense_points: 1700, image_url: 'https://images.ygoprodeck.com/images/cards/38033121.jpg', external_price_note: 'Top chase price aligned to premium DMG collector demand.', source_url: 'https://ygoprodeck.com/card/dark-magician-girl-4038' },
  { set_slug: 'chaos-archives', card_name: 'Black Luster Soldier - Envoy of the Beginning', ygoprodeck_card_id: 72989439, rarity_code: 'ultimate', estimated_price_coins: 6100, card_type: 'Effect Monster', attribute: 'LIGHT', level_stars: 8, attack_points: 3000, defense_points: 2500, image_url: 'https://images.ygoprodeck.com/images/cards/72989439.jpg', external_price_note: 'Ultimate rare estimate from iconic chaos-era chase pricing.', source_url: 'https://ygoprodeck.com/card/black-luster-soldier-envoy-of-the-beginning-5903' },
  { set_slug: 'chaos-archives', card_name: 'Chaos Emperor Dragon - Envoy of the End', ygoprodeck_card_id: 82301904, rarity_code: 'secret', estimated_price_coins: 4300, card_type: 'Effect Monster', attribute: 'DARK', level_stars: 8, attack_points: 3000, defense_points: 2500, image_url: 'https://images.ygoprodeck.com/images/cards/82301904.jpg', external_price_note: 'Secret rare estimated from collector demand.', source_url: 'https://ygoprodeck.com/card/chaos-emperor-dragon-envoy-of-the-end-5428' },
  { set_slug: 'chaos-archives', card_name: 'Jinzo', ygoprodeck_card_id: 77585513, rarity_code: 'ultra', estimated_price_coins: 2350, card_type: 'Effect Monster', attribute: 'DARK', level_stars: 6, attack_points: 2400, defense_points: 1500, image_url: 'https://images.ygoprodeck.com/images/cards/77585513.jpg', external_price_note: 'Ultra rare set highlight estimate.', source_url: 'https://ygoprodeck.com/card/jinzo-4693' },
  { set_slug: 'chaos-archives', card_name: 'Buster Blader', ygoprodeck_card_id: 78193831, rarity_code: 'ultra', estimated_price_coins: 2200, card_type: 'Effect Monster', attribute: 'EARTH', level_stars: 7, attack_points: 2600, defense_points: 2300, image_url: 'https://images.ygoprodeck.com/images/cards/78193831.jpg', external_price_note: 'Collector-favorite ultra estimate.', source_url: 'https://ygoprodeck.com/card/buster-blader-4707' },
  { set_slug: 'chaos-archives', card_name: 'Injection Fairy Lily', ygoprodeck_card_id: 79575620, rarity_code: 'super', estimated_price_coins: 1150, card_type: 'Effect Monster', attribute: 'EARTH', level_stars: 3, attack_points: 400, defense_points: 1500, image_url: 'https://images.ygoprodeck.com/images/cards/79575620.jpg', external_price_note: 'Premium super estimate.', source_url: 'https://ygoprodeck.com/card/injection-fairy-lily-4975' },
  { set_slug: 'chaos-archives', card_name: 'Chaos Sorcerer', ygoprodeck_card_id: 9596126, rarity_code: 'super', estimated_price_coins: 840, card_type: 'Effect Monster', attribute: 'DARK', level_stars: 6, attack_points: 2300, defense_points: 2000, image_url: 'https://images.ygoprodeck.com/images/cards/9596126.jpg', external_price_note: 'Mid-tier holo estimate.', source_url: 'https://ygoprodeck.com/card/chaos-sorcerer-5924' },
  { set_slug: 'chaos-archives', card_name: 'Skilled Dark Magician', ygoprodeck_card_id: 73752131, rarity_code: 'rare', estimated_price_coins: 390, card_type: 'Effect Monster', attribute: 'DARK', level_stars: 4, attack_points: 1900, defense_points: 1700, image_url: 'https://images.ygoprodeck.com/images/cards/73752131.jpg', external_price_note: 'Rare slot anchor card.', source_url: 'https://ygoprodeck.com/card/skilled-dark-magician-5522' },
  { set_slug: 'chaos-archives', card_name: 'Magician of Faith', ygoprodeck_card_id: 31560081, rarity_code: 'rare', estimated_price_coins: 345, card_type: 'Effect Monster', attribute: 'LIGHT', level_stars: 1, attack_points: 300, defense_points: 400, image_url: 'https://images.ygoprodeck.com/images/cards/31560081.jpg', external_price_note: 'Rare utility flip estimate.', source_url: 'https://ygoprodeck.com/card/magician-of-faith-4980' },
  { set_slug: 'chaos-archives', card_name: 'Book of Moon', ygoprodeck_card_id: 14087893, rarity_code: 'rare', estimated_price_coins: 330, card_type: 'Quick-Play Spell Card', attribute: '', level_stars: 0, attack_points: 0, defense_points: 0, image_url: 'https://images.ygoprodeck.com/images/cards/14087893.jpg', external_price_note: 'Rare spell estimate.', source_url: 'https://ygoprodeck.com/card/book-of-moon-5942' },
  { set_slug: 'chaos-archives', card_name: 'Marauding Captain', ygoprodeck_card_id: 2359737, rarity_code: 'common', estimated_price_coins: 120, card_type: 'Effect Monster', attribute: 'EARTH', level_stars: 3, attack_points: 1200, defense_points: 400, image_url: 'https://images.ygoprodeck.com/images/cards/2359737.jpg', external_price_note: 'Fallback common price.', source_url: 'https://ygoprodeck.com/card/marauding-captain-4938' },
  { set_slug: 'chaos-archives', card_name: 'D. D. Warrior Lady', ygoprodeck_card_id: 7572887, rarity_code: 'common', estimated_price_coins: 110, card_type: 'Effect Monster', attribute: 'LIGHT', level_stars: 4, attack_points: 1500, defense_points: 1600, image_url: 'https://images.ygoprodeck.com/images/cards/7572887.jpg', external_price_note: 'Fallback common price.', source_url: 'https://ygoprodeck.com/card/d-d-warrior-lady-5930' },
  { set_slug: 'chaos-archives', card_name: 'Smashing Ground', ygoprodeck_card_id: 97169186, rarity_code: 'common', estimated_price_coins: 95, card_type: 'Spell Card', attribute: '', level_stars: 0, attack_points: 0, defense_points: 0, image_url: 'https://images.ygoprodeck.com/images/cards/97169186.jpg', external_price_note: 'Fallback common price.', source_url: 'https://ygoprodeck.com/card/smashing-ground-5927' },
  { set_slug: 'chaos-archives', card_name: 'Berserk Gorilla', ygoprodeck_card_id: 80233946, rarity_code: 'common', estimated_price_coins: 100, card_type: 'Effect Monster', attribute: 'EARTH', level_stars: 4, attack_points: 2000, defense_points: 1000, image_url: 'https://images.ygoprodeck.com/images/cards/80233946.jpg', external_price_note: 'Fallback common price.', source_url: 'https://ygoprodeck.com/card/berserk-gorilla-5916' },
  { set_slug: 'chaos-archives', card_name: 'Compulsory Evacuation Device', ygoprodeck_card_id: 94192409, rarity_code: 'common', estimated_price_coins: 90, card_type: 'Trap Card', attribute: '', level_stars: 0, attack_points: 0, defense_points: 0, image_url: 'https://images.ygoprodeck.com/images/cards/94192409.jpg', external_price_note: 'Fallback common price.', source_url: 'https://ygoprodeck.com/card/compulsory-evacuation-device-5928' }

,
  { set_slug: 'elemental-academy', card_name: 'Elemental HERO Flame Wingman', ygoprodeck_card_id: 35809262, rarity_code: 'ghost', estimated_price_coins: 740, card_type: 'Fusion Monster', attribute: 'WIND', level_stars: 6, attack_points: 2100, defense_points: 1200, image_url: 'https://images.ygoprodeck.com/images/cards/35809262.jpg', external_price_note: 'Top GX HERO chase.', source_url: 'https://ygoprodeck.com/card/elemental-hero-flame-wingman-6121' },
  { set_slug: 'elemental-academy', card_name: 'Elemental HERO Shining Flare Wingman', ygoprodeck_card_id: 25366484, rarity_code: 'ultimate', estimated_price_coins: 620, card_type: 'Fusion Monster', attribute: 'LIGHT', level_stars: 8, attack_points: 2500, defense_points: 2100, image_url: 'https://images.ygoprodeck.com/images/cards/25366484.jpg', external_price_note: 'Premium GX fusion.', source_url: 'https://ygoprodeck.com/card/elemental-hero-shining-flare-wingman-6198' },
  { set_slug: 'elemental-academy', card_name: 'Elemental HERO Neos', ygoprodeck_card_id: 89943723, rarity_code: 'ultra', estimated_price_coins: 430, card_type: 'Normal Monster', attribute: 'LIGHT', level_stars: 7, attack_points: 2500, defense_points: 2000, image_url: 'https://images.ygoprodeck.com/images/cards/89943723.jpg', external_price_note: 'Iconic GX ace.', source_url: 'https://ygoprodeck.com/card/elemental-hero-neos-7280' },
  { set_slug: 'elemental-academy', card_name: 'Elemental HERO Sparkman', ygoprodeck_card_id: 20721928, rarity_code: 'super', estimated_price_coins: 280, card_type: 'Normal Monster', attribute: 'LIGHT', level_stars: 4, attack_points: 1600, defense_points: 1400, image_url: 'https://images.ygoprodeck.com/images/cards/20721928.jpg', external_price_note: 'Classic HERO holo.', source_url: 'https://ygoprodeck.com/card/elemental-hero-sparkman-6107' },
  { set_slug: 'elemental-academy', card_name: 'Elemental HERO Avian', ygoprodeck_card_id: 21844576, rarity_code: 'rare', estimated_price_coins: 145, card_type: 'Normal Monster', attribute: 'WIND', level_stars: 3, attack_points: 1000, defense_points: 1000, image_url: 'https://images.ygoprodeck.com/images/cards/21844576.jpg', external_price_note: 'Starter HERO rare.', source_url: 'https://ygoprodeck.com/card/elemental-hero-avian-6104' },
  { set_slug: 'elemental-academy', card_name: 'Polymerization', ygoprodeck_card_id: 24094653, rarity_code: 'rare', estimated_price_coins: 160, card_type: 'Spell Card', attribute: '', level_stars: 0, attack_points: 0, defense_points: 0, image_url: 'https://images.ygoprodeck.com/images/cards/24094653.jpg', external_price_note: 'GX fusion staple.', source_url: 'https://ygoprodeck.com/card/polymerization-4001' },
  { set_slug: 'elemental-academy', card_name: 'Winged Kuriboh', ygoprodeck_card_id: 57116033, rarity_code: 'common', estimated_price_coins: 85, card_type: 'Effect Monster', attribute: 'LIGHT', level_stars: 1, attack_points: 300, defense_points: 200, image_url: 'https://images.ygoprodeck.com/images/cards/57116033.jpg', external_price_note: 'Beloved GX mascot.', source_url: 'https://ygoprodeck.com/card/winged-kuriboh-6248' },
  { set_slug: 'cyber-revolution', card_name: 'Cyber Dragon', ygoprodeck_card_id: 70095154, rarity_code: 'ghost', estimated_price_coins: 710, card_type: 'Effect Monster', attribute: 'LIGHT', level_stars: 5, attack_points: 2100, defense_points: 1600, image_url: 'https://images.ygoprodeck.com/images/cards/70095154.jpg', external_price_note: 'GX machine chase.', source_url: 'https://ygoprodeck.com/card/cyber-dragon-6774' },
  { set_slug: 'cyber-revolution', card_name: 'Cyber End Dragon', ygoprodeck_card_id: 15155568, rarity_code: 'ultimate', estimated_price_coins: 640, card_type: 'Fusion Monster', attribute: 'LIGHT', level_stars: 10, attack_points: 4000, defense_points: 2800, image_url: 'https://images.ygoprodeck.com/images/cards/15155568.jpg', external_price_note: 'High-end fusion finisher.', source_url: 'https://ygoprodeck.com/card/cyber-end-dragon-6802' },
  { set_slug: 'cyber-revolution', card_name: 'Cyber Twin Dragon', ygoprodeck_card_id: 74157028, rarity_code: 'ultra', estimated_price_coins: 420, card_type: 'Fusion Monster', attribute: 'LIGHT', level_stars: 8, attack_points: 2800, defense_points: 2100, image_url: 'https://images.ygoprodeck.com/images/cards/74157028.jpg', external_price_note: 'Strong GX fusion.', source_url: 'https://ygoprodeck.com/card/cyber-twin-dragon-6803' },
  { set_slug: 'cyber-revolution', card_name: 'Proto-Cyber Dragon', ygoprodeck_card_id: 26439287, rarity_code: 'super', estimated_price_coins: 250, card_type: 'Effect Monster', attribute: 'LIGHT', level_stars: 3, attack_points: 1100, defense_points: 600, image_url: 'https://images.ygoprodeck.com/images/cards/26439287.jpg', external_price_note: 'Cyber bridge card.', source_url: 'https://ygoprodeck.com/card/proto-cyber-dragon-6820' },
  { set_slug: 'cyber-revolution', card_name: 'Power Bond', ygoprodeck_card_id: 37630732, rarity_code: 'rare', estimated_price_coins: 155, card_type: 'Spell Card', attribute: '', level_stars: 0, attack_points: 0, defense_points: 0, image_url: 'https://images.ygoprodeck.com/images/cards/37630732.jpg', external_price_note: 'Zane combo spell.', source_url: 'https://ygoprodeck.com/card/power-bond-6818' },
  { set_slug: 'cyber-revolution', card_name: 'Cyber Barrier Dragon', ygoprodeck_card_id: 68774379, rarity_code: 'common', estimated_price_coins: 78, card_type: 'Effect Monster', attribute: 'LIGHT', level_stars: 6, attack_points: 800, defense_points: 2800, image_url: 'https://images.ygoprodeck.com/images/cards/68774379.jpg', external_price_note: 'Machine wall option.', source_url: 'https://ygoprodeck.com/card/cyber-barrier-dragon-6814' },
  { set_slug: 'ancient-gear-forge', card_name: 'Ancient Gear Golem', ygoprodeck_card_id: 83104731, rarity_code: 'ghost', estimated_price_coins: 690, card_type: 'Effect Monster', attribute: 'EARTH', level_stars: 8, attack_points: 3000, defense_points: 3000, image_url: 'https://images.ygoprodeck.com/images/cards/83104731.jpg', external_price_note: 'Crowler boss chase.', source_url: 'https://ygoprodeck.com/card/ancient-gear-golem-6582' },
  { set_slug: 'ancient-gear-forge', card_name: 'Ancient Gear Castle', ygoprodeck_card_id: 92001300, rarity_code: 'super', estimated_price_coins: 255, card_type: 'Spell Card', attribute: '', level_stars: 0, attack_points: 0, defense_points: 0, image_url: 'https://images.ygoprodeck.com/images/cards/92001300.jpg', external_price_note: 'GX machine support.', source_url: 'https://ygoprodeck.com/card/ancient-gear-castle-6589' },
  { set_slug: 'ancient-gear-forge', card_name: 'Ancient Gear Beast', ygoprodeck_card_id: 7171149, rarity_code: 'ultra', estimated_price_coins: 410, card_type: 'Effect Monster', attribute: 'EARTH', level_stars: 6, attack_points: 2000, defense_points: 2000, image_url: 'https://images.ygoprodeck.com/images/cards/7171149.jpg', external_price_note: 'Mid-tier machine hitter.', source_url: 'https://ygoprodeck.com/card/ancient-gear-beast-6583' },
  { set_slug: 'ancient-gear-forge', card_name: 'Ancient Gear Soldier', ygoprodeck_card_id: 10509340, rarity_code: 'rare', estimated_price_coins: 150, card_type: 'Effect Monster', attribute: 'EARTH', level_stars: 4, attack_points: 1300, defense_points: 1300, image_url: 'https://images.ygoprodeck.com/images/cards/10509340.jpg', external_price_note: 'Theme rare.', source_url: 'https://ygoprodeck.com/card/ancient-gear-soldier-6585' },
  { set_slug: 'ancient-gear-forge', card_name: 'Ancient Gear Engineer', ygoprodeck_card_id: 22046459, rarity_code: 'common', estimated_price_coins: 82, card_type: 'Effect Monster', attribute: 'EARTH', level_stars: 5, attack_points: 1500, defense_points: 1500, image_url: 'https://images.ygoprodeck.com/images/cards/22046459.jpg', external_price_note: 'Theme common.', source_url: 'https://ygoprodeck.com/card/ancient-gear-engineer-6584' },
  { set_slug: 'rainbow-chaos', card_name: 'Rainbow Dragon', ygoprodeck_card_id: 79856792, rarity_code: 'ghost', estimated_price_coins: 760, card_type: 'Effect Monster', attribute: 'LIGHT', level_stars: 10, attack_points: 4000, defense_points: 0, image_url: 'https://images.ygoprodeck.com/images/cards/79856792.jpg', external_price_note: 'Late-GX rainbow chase.', source_url: 'https://ygoprodeck.com/card/rainbow-dragon-7331' },
  { set_slug: 'rainbow-chaos', card_name: 'Crystal Beast Sapphire Pegasus', ygoprodeck_card_id: 32710364, rarity_code: 'ultra', estimated_price_coins: 430, card_type: 'Effect Monster', attribute: 'WIND', level_stars: 4, attack_points: 1800, defense_points: 1200, image_url: 'https://images.ygoprodeck.com/images/cards/32710364.jpg', external_price_note: 'Top Crystal Beast.', source_url: 'https://ygoprodeck.com/card/crystal-beast-sapphire-pegasus-7289' },
  { set_slug: 'rainbow-chaos', card_name: 'Crystal Bond', ygoprodeck_card_id: 3549275, rarity_code: 'super', estimated_price_coins: 260, card_type: 'Spell Card', attribute: '', level_stars: 0, attack_points: 0, defense_points: 0, image_url: 'https://images.ygoprodeck.com/images/cards/3549275.jpg', external_price_note: 'Rainbow engine spell.', source_url: 'https://ygoprodeck.com/card/crystal-bond-13090' },
  { set_slug: 'rainbow-chaos', card_name: 'Crystal Beast Ruby Carbuncle', ygoprodeck_card_id: 32726617, rarity_code: 'rare', estimated_price_coins: 155, card_type: 'Effect Monster', attribute: 'LIGHT', level_stars: 3, attack_points: 300, defense_points: 300, image_url: 'https://images.ygoprodeck.com/images/cards/32726617.jpg', external_price_note: 'GX rainbow rare.', source_url: 'https://ygoprodeck.com/card/crystal-beast-ruby-carbuncle-7288' },
  { set_slug: 'rainbow-chaos', card_name: 'Crystal Beast Amethyst Cat', ygoprodeck_card_id: 58706841, rarity_code: 'common', estimated_price_coins: 82, card_type: 'Effect Monster', attribute: 'EARTH', level_stars: 3, attack_points: 1200, defense_points: 400, image_url: 'https://images.ygoprodeck.com/images/cards/58706841.jpg', external_price_note: 'Theme common.', source_url: 'https://ygoprodeck.com/card/crystal-beast-amethyst-cat-7284' },
  { set_slug: 'destiny-showdown', card_name: 'Destiny HERO - Plasma', ygoprodeck_card_id: 83965310, rarity_code: 'ghost', estimated_price_coins: 745, card_type: 'Effect Monster', attribute: 'DARK', level_stars: 8, attack_points: 1900, defense_points: 600, image_url: 'https://images.ygoprodeck.com/images/cards/83965310.jpg', external_price_note: 'Aster chase card.', source_url: 'https://ygoprodeck.com/card/destiny-hero-plasma-6912' },
  { set_slug: 'destiny-showdown', card_name: 'Destiny HERO - Dogma', ygoprodeck_card_id: 13093792, rarity_code: 'ultimate', estimated_price_coins: 620, card_type: 'Effect Monster', attribute: 'DARK', level_stars: 8, attack_points: 3400, defense_points: 2400, image_url: 'https://images.ygoprodeck.com/images/cards/13093792.jpg', external_price_note: 'High-end D-HERO boss.', source_url: 'https://ygoprodeck.com/card/destiny-hero-dogma-6908' },
  { set_slug: 'destiny-showdown', card_name: 'Destiny HERO - Diamond Dude', ygoprodeck_card_id: 13059604, rarity_code: 'ultra', estimated_price_coins: 405, card_type: 'Effect Monster', attribute: 'DARK', level_stars: 4, attack_points: 1400, defense_points: 1600, image_url: 'https://images.ygoprodeck.com/images/cards/13059604.jpg', external_price_note: 'GX fan favorite.', source_url: 'https://ygoprodeck.com/card/destiny-hero-diamond-dude-6909' },
  { set_slug: 'destiny-showdown', card_name: 'Destiny Draw', ygoprodeck_card_id: 45812361, rarity_code: 'super', estimated_price_coins: 255, card_type: 'Spell Card', attribute: '', level_stars: 0, attack_points: 0, defense_points: 0, image_url: 'https://images.ygoprodeck.com/images/cards/45812361.jpg', external_price_note: 'D-HERO power spell.', source_url: 'https://ygoprodeck.com/card/destiny-draw-6919' },
  { set_slug: 'destiny-showdown', card_name: 'Destiny HERO - Fear Monger', ygoprodeck_card_id: 79109599, rarity_code: 'rare', estimated_price_coins: 150, card_type: 'Effect Monster', attribute: 'DARK', level_stars: 4, attack_points: 1000, defense_points: 1000, image_url: 'https://images.ygoprodeck.com/images/cards/79109599.jpg', external_price_note: 'Mid-pack rare.', source_url: 'https://ygoprodeck.com/card/destiny-hero-fear-monger-6910' },
  { set_slug: 'destiny-showdown', card_name: 'Destiny HERO - Captain Tenacious', ygoprodeck_card_id: 17444133, rarity_code: 'common', estimated_price_coins: 80, card_type: 'Effect Monster', attribute: 'DARK', level_stars: 3, attack_points: 800, defense_points: 800, image_url: 'https://images.ygoprodeck.com/images/cards/17444133.jpg', external_price_note: 'Theme common.', source_url: 'https://ygoprodeck.com/card/destiny-hero-captain-tenacious-6907' }

];

export const YGO_ACHIEVEMENTS = [
  { code: 'first_pack', title: 'Heart of the Packs', description: 'Open your first Yu-Gi-Oh pack.', target_value: 1, reward_coins: 120, metric_key: 'packs_opened' },
  { code: 'ten_packs', title: 'Booster Ritual', description: 'Open 10 packs in the Yu-Gi-Oh playground.', target_value: 10, reward_coins: 450, metric_key: 'packs_opened' },
  { code: 'ghost_pull', title: 'Ghosted', description: 'Pull a Ghost Rare card.', target_value: 1, reward_coins: 900, metric_key: 'ghost_pulls' },
  { code: 'collector_25', title: 'Binder Builder', description: 'Own 25 Yu-Gi-Oh cards total.', target_value: 25, reward_coins: 350, metric_key: 'cards_owned' }
];
