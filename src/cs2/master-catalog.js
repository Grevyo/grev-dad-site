function parseItem(value) {
  const parts = String(value || '').split('|').map((part) => part.trim());
  if (parts.length < 2) throw new Error(`Invalid catalog item: ${value}`);
  return { weapon_name: parts[0], skin_name: parts.slice(1).join(' | ') };
}

function makeCase(case_name, groups, meta = {}) {
  const order = [
    ['Mil-Spec Grade', groups.milSpec || []],
    ['Restricted', groups.restricted || []],
    ['Classified', groups.classified || []],
    ['Covert', groups.covert || []],
    ['Contraband', groups.contraband || []]
  ];
  return {
    case_name,
    ...meta,
    items: order.flatMap(([rarity, entries]) => entries.map((entry) => ({ ...parseItem(entry), rarity })))
  };
}

export const CS2_MASTER_CATALOG = [
  makeCase('Fever Case', {
    milSpec: ['M4A4 | Choppa', 'MAG-7 | Resupply', 'SSG 08 | Memorial', 'P2000 | Sure Grip', 'USP-S | PC-GRN', 'MP9 | Nexus', 'XM1014 | Mockingbird'],
    restricted: ['Desert Eagle | Serpent Strike', 'Zeus x27 | Tosai', 'Nova | Rising Sun', 'Galil AR | Control', 'P90 | Wave Breaker'],
    classified: ['AK-47 | Searing Rage', 'Glock-18 | Shinobu', 'UMP-45 | K.O. Factory'],
    covert: ['AWP | Printstream', 'FAMAS | Bad Trip']
  }, { release_date: '2025-03-31', source_url: 'https://csdb.gg/case/fever/' }),
  makeCase('Gallery Case', {
    milSpec: ['M249 | Hypnosis', 'MP5-SD | Statics', 'SCAR-20 | Trail Blazer', 'AUG | Luxe Trim', 'R8 Revolver | Tango', 'USP-S | 27', 'Desert Eagle | Calligraffiti'],
    restricted: ['P90 | Randy Rush', 'Dual Berettas | Hydro Strike', 'SSG 08 | Rapid Transit', 'MAC-10 | Saibā Oni', 'M4A4 | Turbine'],
    classified: ['P250 | Epicenter', 'UMP-45 | Neo-Noir', 'AK-47 | The Outsiders'],
    covert: ['Glock-18 | Gold Toof', 'M4A1-S | Vaporwave']
  }, { release_date: '2024-10-02', source_url: 'https://counterstrike.fandom.com/wiki/Gallery_Case' }),
  makeCase('Kilowatt Case', {
    milSpec: ['Dual Berettas | Hideout', 'MAC-10 | Light Box', 'Nova | Dark Sigil', 'SSG 08 | Dezastre', 'Tec-9 | Slag', 'UMP-45 | Motorized', 'XM1014 | Irezumi'],
    restricted: ['Glock-18 | Block-18', 'M4A4 | Etch Lord', 'Five-SeveN | Hybrid', 'MP7 | Just Smile', 'Sawed-Off | Analog Input'],
    classified: ['M4A1-S | Black Lotus', 'Zeus x27 | Olympus', 'USP-S | Jawbreaker'],
    covert: ['AWP | Chrome Cannon', 'AK-47 | Inheritance']
  }, { release_date: '2024-02-06', source_url: 'https://counterstrike.fandom.com/wiki/Kilowatt_Case' }),
  makeCase('Revolution Case', {
    milSpec: ['MP9 | Featherweight', 'MAG-7 | Insomnia', 'SCAR-20 | Fragments', 'P250 | Re.built', 'MP5-SD | Liquidation', 'SG553 | Cyberforce', 'Tec-9 | Rebel'],
    restricted: ['M4A1-S | Emphorosaur-S', 'Glock-18 | Umbral Rabbit', 'MAC-10 | Sakkaku', 'R8 Revolver | Banana Cannon', 'P90 | Neon Queen'],
    classified: ['AWP | Duality', 'UMP-45 | Wild Child', 'P2000 | Wicked Sick'],
    covert: ['AK-47 | Head Shot', 'M4A4 | Temukau']
  }, { release_date: '2023-02-09', source_url: 'https://counterstrike.fandom.com/wiki/Revolution_Case' }),
  makeCase('Recoil Case', {
    milSpec: ['FAMAS | Meow 36', 'Galil AR | Destroyer', 'M4A4 | Poly Mag', 'MAC-10 | Monkeyflage', 'Negev | Drop Me', 'UMP-45 | Roadblock', 'Glock-18 | Winterized'],
    restricted: ['R8 Revolver | Crazy 8', 'M249 | Downtown', 'SG 553 | Dragon Tech', 'P90 | Vent Rush', 'Dual Berettas | Flora Carnivora'],
    classified: ['AK-47 | Ice Coaled', 'P250 | Visions', 'Sawed-Off | Kiss♥Love'],
    covert: ['USP-S | Printstream', 'AWP | Chromatic Aberration']
  }, { release_date: '2022-07-01', source_url: 'https://counterstrike.fandom.com/wiki/Recoil_Case' }),
  makeCase('Dreams & Nightmares Case', {
    milSpec: ['MP5-SD | Necro Jr.', 'MAC-10 | Ensnared', 'Sawed-Off | Spirit Board', 'P2000 | Lifted Spirits', 'MAG-7 | Foresight', 'SCAR-20 | Poultrygeist', 'Five-SeveN | Scrawl'],
    restricted: ['USP-S | Ticket to Hell', 'M4A1-S | Night Terror', 'G3SG1 | Dream Glade', 'PP-Bizon | Space Cat', 'XM1014 | Zombie Offensive'],
    classified: ['FAMAS | Rapid Eye Movement', 'Dual Berettas | Melondrama', 'MP7 | Abyssal Apparition'],
    covert: ['AK-47 | Nightwish', 'MP9 | Starlight Protector']
  }, { release_date: '2022-01-20', source_url: 'https://counterstrike.fandom.com/wiki/Dreams_%26_Nightmares_Case' }),
  makeCase('Snakebite Case', {
    milSpec: ['Nova | Windblown', 'Glock-18 | Clear Polymer', 'CZ75-Auto | Circaetus', 'M249 | O.S.I.P.R.', 'UMP-45 | Oscillator', 'SG 553 | Heavy Metal', 'R8 Revolver | Junkyard'],
    restricted: ['P250 | Cyber Shell', 'MAC-10 | Button Masher', 'Negev | dev_texture', 'Desert Eagle | Trigger Discipline', 'AK-47 | Slate'],
    classified: ['Galil AR | Chromatic Aberration', 'MP9 | Food Chain', 'XM1014 | XOXO'],
    covert: ['USP-S | The Traitor', 'M4A4 | In Living Color']
  }, { release_date: '2021-05-03', source_url: 'https://counterstrike.fandom.com/wiki/Snakebite_Case' }),
  makeCase('Fracture Case', {
    milSpec: ['MAC-10 | Allure', 'MP5-SD | Kitbash', 'Galil AR | Connexion', 'Tec-9 | Brother', 'SSG 08 | Mainframe 001', 'P250 | Cassette', 'P2000 | Gnarled'],
    restricted: ['P90 | Freight', 'SG 553 | Ol\' Rusty', 'Negev | Ultralight', 'PP-Bizon | Runic', 'MAG-7 | Monster Call'],
    classified: ['M4A4 | Tooth Fairy', 'XM1014 | Entombed', 'Glock-18 | Vogue'],
    covert: ['Desert Eagle | Printstream', 'AK-47 | Legion of Anubis']
  }, { release_date: '2020-08-06', source_url: 'https://counterstrike.fandom.com/wiki/Fracture_Case' }),
  makeCase('Prisma 2 Case', {
    milSpec: ['R8 Revolver | Bone Forged', 'Negev | Prototype', 'CZ75-Auto | Distressed', 'AUG | Tom Cat', 'MP5-SD | Desert Strike', 'Desert Eagle | Blue Ply', 'AWP | Capillary'],
    restricted: ['Sawed-Off | Apocalypto', 'P2000 | Acid Etched', 'SCAR-20 | Enforcer', 'SG 553 | Darkwing', 'SSG 08 | Fever Dream'],
    classified: ['MAC-10 | Disco Tech', 'MAG-7 | Justice', 'AK-47 | Phantom Disruptor'],
    covert: ['Glock-18 | Bullet Queen', 'M4A1-S | Player Two']
  }, { release_date: '2020-03-31', source_url: 'https://counterstrike.fandom.com/wiki/Prisma_2_Case' }),
  makeCase('CS20 Case', {
    milSpec: ['SCAR-20 | Assault', 'Tec-9 | Flash Out', 'MAG-7 | Popdog', 'MAC-10 | Classic Crate', 'Dual Berettas | Elite 1.6', 'FAMAS | Decommissioned', 'Glock-18 | Sacrifice'],
    restricted: ['M249 | Aztec', 'Five-SeveN | Buddy', 'P250 | Inferno', 'UMP-45 | Plastique', 'MP5-SD | Agent'],
    classified: ['P90 | Nostalgia', 'AUG | Death by Puppy', 'MP9 | Hydra'],
    covert: ['FAMAS | Commemoration', 'AWP | Wildfire']
  }, { release_date: '2019-10-18', source_url: 'https://counterstrike.fandom.com/wiki/CS20_Case' }),
  makeCase('Prisma Case', {
    milSpec: ['FAMAS | Crypsis', 'AK-47 | Uncharted', 'MAC-10 | Whitefish', 'Galil AR | Akoben', 'MP7 | Mischief', 'P250 | Verdigris', 'P90 | Off World'],
    restricted: ['AWP | Atheris', 'Tec-9 | Bamboozle', 'Desert Eagle | Light Rail', 'MP5-SD | Gauss', 'UMP-45 | Moonrise'],
    classified: ['R8 Revolver | Skull Crusher', 'AUG | Momentum', 'XM1014 | Incenigator'],
    covert: ['Five-SeveN | Angry Mob', 'M4A4 | The Emperor']
  }, { release_date: '2019-03-13', source_url: 'https://counterstrike.fandom.com/wiki/Prisma_Case' }),
  makeCase('Danger Zone Case', {
    milSpec: ['MP9 | Modest Threat', 'Glock-18 | Oxide Blaze', 'Nova | Wood Fired', 'M4A4 | Magnesium', 'Sawed-Off | Black Sand', 'SG 553 | Danger Close', 'Tec-9 | Fubar'],
    restricted: ['G3SG1 | Scavenger', 'Galil AR | Signal', 'MAC-10 | Pipe Down', 'P250 | Nevermore', 'USP-S | Flashback'],
    classified: ['UMP-45 | Momentum', 'Desert Eagle | Mecha Industries', 'MP5-SD | Phosphor'],
    covert: ['AK-47 | Asiimov', 'AWP | Neo-Noir']
  }, { release_date: '2018-12-06', source_url: 'https://counterstrike.fandom.com/wiki/Danger_Zone_Case' }),
  makeCase('Horizon Case', {
    milSpec: ['AUG | Amber Slipstream', 'Dual Berettas | Shred', 'Glock-18 | Warhawk', 'MP9 | Capillary', 'P90 | Traction', 'R8 Revolver | Survivalist', 'Tec-9 | Snek-9'],
    restricted: ['CZ75-Auto | Eco', 'G3SG1 | High Seas', 'Nova | Toy Soldier', 'AWP | PAW', 'MP7 | Powercore'],
    classified: ['M4A1-S | Nightmare', 'Sawed-Off | Devourer', 'FAMAS | Eye of Athena'],
    covert: ['AK-47 | Neon Rider', 'Desert Eagle | Code Red']
  }, { release_date: '2018-08-03', source_url: 'https://counterstrike.fandom.com/wiki/Horizon_Case' }),
  makeCase('Clutch Case', {
    milSpec: ['MAG-7 | SWAG-7', 'Negev | Lionfish', 'Nova | Wild Six', 'R8 Revolver | Grip', 'P2000 | Urban Hazard', 'MP9 | Black Sand', 'Five-SeveN | Flame Test'],
    restricted: ['SG 553 | Aloha', 'PP-Bizon | Night Riot', 'XM1014 | Oxide Blaze', 'AUG | Stymphalian', 'Glock-18 | Moonrise'],
    classified: ['UMP-45 | Arctic Wolf', 'USP-S | Cortex', 'AWP | Mortis'],
    covert: ['M4A4 | Neo-Noir', 'MP7 | Bloodsport']
  }, { release_date: '2018-02-15', source_url: 'https://counterstrike.fandom.com/wiki/Clutch_Case' }),
  makeCase('Spectrum 2 Case', {
    milSpec: ['Sawed-Off | Morris', 'AUG | Triqua', 'Tec-9 | Cracked Opal', 'MAC-10 | Oceanic', 'Glock-18 | Off World', 'G3SG1 | Hunter', 'SCAR-20 | Jungle Slipstream'],
    restricted: ['XM1014 | Ziggy', 'SG 553 | Phantom', 'UMP-45 | Exposure', 'MP9 | Goo', 'CZ75-Auto | Tacticat'],
    classified: ['PP-Bizon | High Roller', 'R8 Revolver | Llama Cannon', 'M4A1-S | Leaded Glass'],
    covert: ['P250 | See Ya Later', 'AK-47 | The Empress']
  }, { release_date: '2017-09-14', source_url: 'https://counterstrike.fandom.com/wiki/Spectrum_2_Case' }),
  makeCase('Spectrum Case', {
    milSpec: ['PP-Bizon | Jungle Slipstream', 'SCAR-20 | Blueprint', 'Desert Eagle | Oxide Blaze', 'Five-SeveN | Capillary', 'MP7 | Akoben', 'P250 | Ripple', 'Sawed-Off | Zander'],
    restricted: ['Galil AR | Crimson Tsunami', 'M249 | Emerald Poison Dart', 'MAC-10 | Last Dive', 'UMP-45 | Scaffold', 'XM1014 | Seasons'],
    classified: ['AWP | Fever Dream', 'CZ75-Auto | Xiangliu', 'M4A1-S | Decimator'],
    covert: ['AK-47 | Bloodsport', 'USP-S | Neo-Noir']
  }, { release_date: '2017-03-15', source_url: 'https://counterstrike.fandom.com/wiki/Spectrum_Case' }),
  makeCase('Chroma 3 Case', {
    milSpec: ['Dual Berettas | Ventilators', 'G3SG1 | Orange Crash', 'M249 | Spectre', 'MP9 | Bioleak', 'P2000 | Oceanic', 'Sawed-Off | Fubar', 'SG 553 | Atlas'],
    restricted: ['CZ75-Auto | Red Astor', 'Galil AR | Firefight', 'SSG 08 | Ghost Crusader', 'Tec-9 | Re-Entry', 'XM1014 | Black Tie'],
    classified: ['AUG | Fleet Flock', 'P250 | Asiimov', 'UMP-45 | Primal Saber'],
    covert: ['M4A1-S | Chantico\'s Fire', 'PP-Bizon | Judgement of Anubis']
  }, { release_date: '2016-04-27', source_url: 'https://counterstrike.fandom.com/wiki/Chroma_3_Case' }),
  makeCase('Chroma 2 Case', {
    milSpec: ['AK-47 | Elite Build', 'MP7 | Armor Core', 'Desert Eagle | Bronze Deco', 'P250 | Valence', 'Negev | Man-o\' -war', 'Sawed-Off | Origami'],
    restricted: ['AWP | Worm God', 'MAG-7 | Heat', 'CZ75-Auto | Pole Position', 'UMP-45 | Grand Prix'],
    classified: ['Five-SeveN | Monkey Business', 'Galil AR | Eco', 'FAMAS | Djinn'],
    covert: ['M4A1-S | Hyper Beast', 'MAC-10 | Neon Rider']
  }, { release_date: '2015-04-15', source_url: 'https://counterstrike.fandom.com/wiki/Chroma_2_Case' }),
  makeCase('Chroma Case', {
    milSpec: ['Glock-18 | Catacombs', 'M249 | System Lock', 'MP9 | Deadly Poison', 'SCAR-20 | Grotto', 'XM1014 | Quicksilver', 'Dual Berettas | Urban Shock'],
    restricted: ['Desert Eagle | Naga', 'MAC-10 | Malachite', 'Sawed-Off | Serenity', 'AK-47 | Cartel'],
    classified: ['M4A4 | 龍王 (Dragon King)', 'P250 | Muertos', 'Five-SeveN | Fowl Play'],
    covert: ['AWP | Man-o\'-war', 'Galil AR | Chatterbox']
  }, { release_date: '2015-01-08', source_url: 'https://counterstrike.fandom.com/wiki/Chroma_Case' }),
  makeCase('CS:GO Weapon Case', {
    milSpec: ['MP7 | Skulls', 'SG 553 | Ultraviolet', 'AUG | Wings'],
    restricted: ['M4A1-S | Dark Water', 'USP-S | Dark Water', 'Glock-18 | Dragon Tattoo'],
    classified: ['Desert Eagle | Hypnotic', 'AK-47 | Case Hardened'],
    covert: ['AWP | Lightning Strike']
  }, { release_date: '2013-08-14', source_url: 'https://counterstrike.fandom.com/wiki/CSGO_Weapon_Case' }),
  makeCase('Operation Riptide Case', {
    milSpec: ['AUG | Plague', 'Dual Berettas | Tread', 'G3SG1 | Keeping Tabs', 'MP7 | Guerrilla', 'PP-Bizon | Lumen', 'USP-S | Black Lotus', 'XM1014 | Watchdog'],
    restricted: ['MAG-7 | BI83 Spectrum', 'FAMAS | ZX Spectron', 'Five-SeveN | Boost Protocol', 'MP9 | Mount Fuji', 'M4A4 | Spider Lily'],
    classified: ['MAC-10 | Toybox', 'Glock-18 | Snack Attack', 'SSG 08 | Turbo Peek'],
    covert: ['AK-47 | Leet Museo', 'Desert Eagle | Ocean Drive']
  }, { release_date: '2021-09-22', source_url: 'https://counterstrike.fandom.com/wiki/Operation_Riptide_Case' }),
  makeCase('Operation Broken Fang Case', {
    milSpec: ['Dual Berettas | Dezastre', 'SSG 08 | Parallax', 'Nova | Clear Polymer', 'MP5-SD | Condition Zero', 'M249 | Deep Relief', 'P250 | Containment', 'Galil AR | Vandal'],
    restricted: ['G3SG1 | Digital Mesh', 'P90 | Cocoa Rampage', 'CZ75-Auto | Vendetta', 'AWP | Exoskeleton', 'UMP-45 | Gold Bismuth'],
    classified: ['M4A4 | Cyber Security', 'USP-S | Monster Mashup', 'Five-SeveN | Fairy Tale'],
    covert: ['M4A1-S | Printstream', 'Glock-18 | Neo-Noir']
  }, { release_date: '2020-12-03', source_url: 'https://counterstrike.fandom.com/wiki/Operation_Broken_Fang_Case' }),
  makeCase('Shattered Web Case', {
    milSpec: ['G3SG1 | Black Sand', 'SCAR-20 | Torn', 'Nova | Plume', 'M249 | Warbird', 'R8 Revolver | Memento', 'MP5-SD | Acid Wash', 'Dual Berettas | Balance'],
    restricted: ['PP-Bizon | Embargo', 'MP7 | Neon Ply', 'P2000 | Obsidian', 'AUG | Arctic Wolf', 'AK-47 | Rat Rod'],
    classified: ['Tec-9 | Decimator', 'SSG 08 | Bloodshot', 'SG 553 | Colony IV'],
    covert: ['MAC-10 | Stalker', 'AWP | Containment Breach']
  }, { release_date: '2019-11-18', source_url: 'https://counterstrike.fandom.com/wiki/Shattered_Web_Case' }),
  makeCase('Operation Hydra Case', {
    milSpec: ['USP-S | Blueprint', 'FAMAS | Macabre', 'M4A1-S | Briefing', 'MAC-10 | Aloha', 'MAG-7 | Hard Water', 'Tec-9 | Cut Out', 'UMP-45 | Metal Flowers'],
    restricted: ['AK-47 | Orbit Mk01', 'P2000 | Woodsman', 'P250 | Red Rock', 'P90 | Death Grip', 'SSG 08 | Death\'s Head'],
    classified: ['Dual Berettas | Cobra Strike', 'Galil AR | Sugar Rush', 'M4A4 | Hellfire'],
    covert: ['Five-SeveN | Hyper Beast', 'AWP | Oni Taiji']
  }, { release_date: '2017-05-23', source_url: 'https://counterstrike.fandom.com/wiki/Operation_Hydra_Case' }),
  makeCase('Operation Wildfire Case', {
    milSpec: ['PP-Bizon | Photic Zone', 'Dual Berettas | Cartel', 'MAC-10 | Lapis Gator', 'SSG 08 | Necropos', 'Tec-9 | Jambiya', 'USP-S | Lead Conduit'],
    restricted: ['FAMAS | Valence', 'Five-SeveN | Triumvirate', 'Glock-18 | Royal Legion', 'MAG-7 | Praetorian', 'MP7 | Impire'],
    classified: ['AWP | Elite Build', 'Desert Eagle | Kumicho Dragon', 'Nova | Hyper Beast'],
    covert: ['M4A4 | The Battlestar', 'AK-47 | Fuel Injector']
  }, { release_date: '2016-02-17', source_url: 'https://counterstrike.fandom.com/wiki/Operation_Wildfire_Case' })
];
