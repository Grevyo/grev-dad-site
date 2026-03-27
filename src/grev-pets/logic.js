const RARITY_TABLE = [
  { rarity: "common", weight: 54, xpBonus: 0.9, color: "#7bc3ff" },
  { rarity: "uncommon", weight: 28, xpBonus: 1, color: "#79ffac" },
  { rarity: "rare", weight: 12, xpBonus: 1.15, color: "#d4a3ff" },
  { rarity: "epic", weight: 5, xpBonus: 1.3, color: "#ff9fd8" },
  { rarity: "mythic", weight: 1, xpBonus: 1.5, color: "#ffd966" }
];

const SPECIES = ["Blooplet", "Fangmop", "Tunkhopper", "Mossdrake", "Skibble", "Woblin", "Nimphib", "Grembryo"];
const TEMPERAMENTS = ["Chaotic Friendly", "Snack-Obsessed", "Nervy Zoomer", "Dramatic", "Battle Goblin", "Sleepy Menace", "Polite Menace", "Hype Beast"];
const GROWTH_BIASES = ["Bruiser", "Sprinter", "Tank", "Trickster", "All-Rounder", "Glass Cannon"];
const NAME_PREFIX = ["Snor", "Wib", "Grizz", "Tun", "Zib", "Floof", "Krim", "Mop", "Plin", "Gub", "Tron", "Bri", "Yip", "Mung", "Dink"];
const NAME_SUFFIX = ["fle", "bo", "lepup", "kle", "let", "snack", "zoodle", "nib", "zorp", "munk", "bit", "wump", "doodle", "mog", "blip"];
const NAME_END = ["", " Jr", " Prime", " the 3rd", " Deluxe", "_irl", " of Doom"];

const BODY_SHAPES = ["blob", "chonk", "ferret", "moth", "drake", "gecko", "puff", "bean"];
const EAR_TYPES = ["nubs", "satellite", "floppy", "spike", "leaf", "antenna"];
const EYE_TYPES = ["dot", "oval", "sleepy", "star", "cyclops", "wide"];
const MOUTH_TYPES = ["smile", "fang", "beak", "grin", "flat", "wobble"];
const TAIL_TYPES = ["stub", "whip", "curl", "fan", "none", "fork"];
const PATTERN_TYPES = ["plain", "spots", "stripes", "patch", "blotch", "circuit"];
const ACCESSORY_TYPES = ["none", "scarf", "bell", "visor", "spoon", "tiny-cape", "bandana"];
const EXTRA_TYPES = ["none", "horn", "spikes", "fluff", "wings", "mushroom"];

export function createStarterPet(userId, username, archetype) {
  const seed = seededInt(`${userId}:${username}:${archetype}:${Date.now()}`);
  return generatePet({
    userId,
    minLevel: 1,
    maxLevel: 2,
    forcedRarity: "uncommon",
    seed,
    source: "starter"
  });
}

export function generateWildPet({ userId, zone = "wild_scrapyard", seed = Date.now() }) {
  const zoneBias = zone.includes("abyss") ? 3 : zone.includes("ruins") ? 2 : 1;
  const levelBase = 1 + (seededInt(`${seed}:${zone}`) % (4 + zoneBias * 2));
  return generatePet({
    userId,
    minLevel: levelBase,
    maxLevel: levelBase + zoneBias + 2,
    seed,
    source: "wild"
  });
}

export function generatePet({ userId, minLevel = 1, maxLevel = 10, forcedRarity = null, seed = Date.now(), source = "wild" }) {
  const petSeed = Number(seed) || Date.now();
  const rarityEntry = forcedRarity
    ? RARITY_TABLE.find((entry) => entry.rarity === forcedRarity) || RARITY_TABLE[0]
    : weightedChoice(RARITY_TABLE, petSeed + 77, "weight");
  const level = randomRange(minLevel, maxLevel, petSeed + 13);
  const temperament = pickFrom(TEMPERAMENTS, petSeed + 44);
  const growthBias = pickFrom(GROWTH_BIASES, petSeed + 88);
  const species = pickFrom(SPECIES, petSeed + 19);
  const traits = {
    bodyShape: pickFrom(BODY_SHAPES, petSeed + 1),
    bodySize: Number((0.8 + randomFloat(petSeed + 2) * 0.8).toFixed(2)),
    colorPalette: makePalette(petSeed + 3),
    earType: pickFrom(EAR_TYPES, petSeed + 4),
    eyeType: pickFrom(EYE_TYPES, petSeed + 5),
    mouthType: pickFrom(MOUTH_TYPES, petSeed + 6),
    tailType: pickFrom(TAIL_TYPES, petSeed + 7),
    patternType: pickFrom(PATTERN_TYPES, petSeed + 8),
    accessory: pickFrom(ACCESSORY_TYPES, petSeed + 9),
    extra: pickFrom(EXTRA_TYPES, petSeed + 10),
    widthScale: Number((0.8 + randomFloat(petSeed + 11) * 0.9).toFixed(2)),
    heightScale: Number((0.8 + randomFloat(petSeed + 12) * 0.9).toFixed(2)),
    bobSpeed: Number((0.6 + randomFloat(petSeed + 14) * 1.2).toFixed(2))
  };

  const stats = generateStats(level, growthBias, rarityEntry.rarity, petSeed + 99);
  const name = makeName(petSeed + 101);
  const petId = `gp_${source}_${petSeed.toString(36)}_${Math.abs(seededInt(`${name}:${species}:${petSeed}`)).toString(36).slice(0, 8)}`;

  return {
    petId,
    name,
    species,
    level,
    xp: 0,
    rarity: rarityEntry.rarity,
    rarityColor: rarityEntry.color,
    temperament,
    growthBias,
    stats,
    traits,
    ownerId: userId,
    source,
    battleRecord: { wins: 0, losses: 0 },
    raceRecord: { wins: 0, places: 0 }
  };
}

export function makeEncounter(zone, userId) {
  const seed = seededInt(`${userId}:${zone}:${Date.now()}:${Math.random()}`);
  const pet = generateWildPet({ userId, zone, seed });
  const encounterId = `enc_${Math.abs(seed).toString(36)}${Math.floor(Math.random() * 999).toString().padStart(3, "0")}`;
  return {
    encounterId,
    wildPet: pet,
    wildCurrentHp: pet.stats.health,
    zone,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 10).toISOString()
  };
}

export function runBattle(playerPet, enemyPetSeed) {
  const enemy = generatePet({
    userId: 0,
    minLevel: Math.max(1, playerPet.level - 1),
    maxLevel: playerPet.level + 3,
    seed: enemyPetSeed,
    source: "npc"
  });

  let playerHp = playerPet.stats.health;
  let enemyHp = enemy.stats.health;
  const log = [];
  let turn = 1;

  while (playerHp > 0 && enemyHp > 0 && turn < 20) {
    const playerActsFirst = playerPet.stats.speed + (Math.random() * 10) >= enemy.stats.speed + (Math.random() * 10);

    if (playerActsFirst) {
      const damage = computeDamage(playerPet, enemy);
      enemyHp -= damage;
      log.push(`Turn ${turn}: ${playerPet.name} bonks ${enemy.name} for ${damage}.`);
      if (enemyHp <= 0) break;
      const retaliation = computeDamage(enemy, playerPet);
      playerHp -= retaliation;
      log.push(`Turn ${turn}: ${enemy.name} yells and hits back for ${retaliation}.`);
    } else {
      const damage = computeDamage(enemy, playerPet);
      playerHp -= damage;
      log.push(`Turn ${turn}: ${enemy.name} speed-rushes for ${damage}.`);
      if (playerHp <= 0) break;
      const retaliation = computeDamage(playerPet, enemy);
      enemyHp -= retaliation;
      log.push(`Turn ${turn}: ${playerPet.name} counters for ${retaliation}.`);
    }

    turn += 1;
  }

  const won = playerHp > 0 && enemyHp <= 0;
  const xpGained = won ? 35 + Math.floor(enemy.level * 3) : 14 + Math.floor(enemy.level * 2);

  return {
    won,
    xpGained,
    log,
    enemy: summarizePet(enemy),
    playerRemainingHp: Math.max(0, playerHp)
  };
}

export function runRace(playerPet, competitorCount = 4) {
  const racers = [{
    kind: "player",
    name: playerPet.name,
    speed: playerPet.stats.speed,
    stamina: playerPet.stats.stamina,
    agility: playerPet.stats.agility,
    focus: playerPet.stats.focus,
    burst: playerPet.stats.burst
  }];

  for (let i = 1; i < competitorCount; i += 1) {
    const seed = Date.now() + i * 111;
    const npc = generatePet({ userId: 0, minLevel: Math.max(1, playerPet.level - 1), maxLevel: playerPet.level + 2, seed, source: "race" });
    racers.push({
      kind: "npc",
      name: npc.name,
      speed: npc.stats.speed,
      stamina: npc.stats.stamina,
      agility: npc.stats.agility,
      focus: npc.stats.focus,
      burst: npc.stats.burst
    });
  }

  const results = racers.map((racer) => {
    const base = racer.speed * 2.2 + racer.agility * 1.6 + racer.stamina * 1.3 + racer.focus * 1.2 + racer.burst * 1.8;
    const variance = 0.82 + Math.random() * 0.38;
    return {
      ...racer,
      score: Number((base * variance).toFixed(2))
    };
  }).sort((a, b) => b.score - a.score);

  const placement = results.findIndex((r) => r.kind === "player") + 1;
  const xpGained = placement === 1 ? 32 : placement === 2 ? 24 : placement === 3 ? 19 : 13;

  const commentary = [
    `${results[0].name} rockets off the line!`,
    `${results[Math.max(1, Math.min(results.length - 1, Math.floor(results.length / 2)))].name} clips a corner and keeps momentum.`,
    `${results[results.length - 1].name} is still vibing and cheering.`
  ];

  return {
    placement,
    xpGained,
    leaderboard: results,
    commentary
  };
}

export function levelProgress(level) {
  return 60 + level * level * 14;
}

export function applyXpAndLevel(pet, xpGained) {
  const out = { ...pet, xp: Number(pet.xp) + Number(xpGained || 0), level: Number(pet.level) || 1 };
  const levelUps = [];

  while (out.xp >= levelProgress(out.level) && out.level < 100) {
    out.xp -= levelProgress(out.level);
    out.level += 1;
    const growth = rollLevelGrowth(out.growthBias, out.level);
    out.stats = {
      health: out.stats.health + growth.health,
      attack: out.stats.attack + growth.attack,
      defence: out.stats.defence + growth.defence,
      speed: out.stats.speed + growth.speed,
      stamina: out.stats.stamina + growth.stamina,
      agility: out.stats.agility + growth.agility,
      focus: out.stats.focus + growth.focus,
      burst: out.stats.burst + growth.burst
    };
    levelUps.push(growth);
  }

  return { pet: out, levelUps };
}

export function captureChance({ rarity, level, wildCurrentHp, wildMaxHp, playerPetLevel = 1 }) {
  const rarityPenalty = rarity === "mythic" ? 24 : rarity === "epic" ? 18 : rarity === "rare" ? 11 : rarity === "uncommon" ? 6 : 0;
  const hpFactor = Math.max(0.12, 1 - (wildCurrentHp / Math.max(1, wildMaxHp)));
  const levelHelp = Math.max(-8, Math.min(10, playerPetLevel - level));
  const percent = Math.max(8, Math.min(89, Math.floor(42 + hpFactor * 38 + levelHelp - rarityPenalty)));
  return percent;
}

export function summarizePet(pet) {
  return {
    petId: pet.petId,
    name: pet.name,
    species: pet.species,
    level: pet.level,
    xp: pet.xp,
    rarity: pet.rarity,
    temperament: pet.temperament,
    growthBias: pet.growthBias,
    stats: pet.stats,
    traits: pet.traits,
    battleRecord: pet.battleRecord || { wins: pet.battle_wins || 0, losses: pet.battle_losses || 0 },
    raceRecord: pet.raceRecord || { wins: pet.race_wins || 0, places: pet.race_places || 0 }
  };
}

function generateStats(level, growthBias, rarity, seed) {
  const rarityMultiplier = rarity === "mythic" ? 1.24 : rarity === "epic" ? 1.17 : rarity === "rare" ? 1.1 : rarity === "uncommon" ? 1.04 : 1;
  const bias = {
    Bruiser: { attack: 5, health: 3, speed: -1, burst: 2 },
    Sprinter: { speed: 5, agility: 4, stamina: 2, defence: -1 },
    Tank: { health: 6, defence: 5, speed: -2 },
    Trickster: { agility: 5, focus: 4, burst: 3, health: -1 },
    "Glass Cannon": { attack: 7, burst: 4, defence: -3 },
    "All-Rounder": { health: 2, attack: 2, defence: 2, speed: 2, stamina: 2, agility: 2, focus: 2, burst: 2 }
  }[growthBias] || {};

  const base = {
    health: 35 + level * 7,
    attack: 9 + level * 2,
    defence: 8 + level * 2,
    speed: 8 + level * 2,
    stamina: 9 + level * 2,
    agility: 8 + level * 2,
    focus: 8 + level * 2,
    burst: 7 + level * 2
  };

  const stats = {};
  for (const [key, value] of Object.entries(base)) {
    const randomBump = Math.floor(randomFloat(seed + value * 13) * 5);
    const biased = value + (bias[key] || 0) + randomBump;
    stats[key] = Math.max(1, Math.floor(biased * rarityMultiplier));
  }

  return stats;
}

function rollLevelGrowth(growthBias, level) {
  const seed = seededInt(`${growthBias}:${level}:${Date.now()}`);
  const spread = {
    health: 1 + (seed % 3),
    attack: 1 + ((seed >> 2) % 3),
    defence: 1 + ((seed >> 3) % 3),
    speed: 1 + ((seed >> 4) % 3),
    stamina: 1 + ((seed >> 5) % 3),
    agility: 1 + ((seed >> 6) % 3),
    focus: 1 + ((seed >> 7) % 3),
    burst: 1 + ((seed >> 8) % 3)
  };

  if (growthBias === "Bruiser") spread.attack += 2;
  if (growthBias === "Sprinter") spread.speed += 2;
  if (growthBias === "Tank") spread.health += 2;
  if (growthBias === "Trickster") spread.agility += 2;
  if (growthBias === "Glass Cannon") spread.burst += 2;

  return spread;
}

function computeDamage(attacker, defender) {
  const attackScore = attacker.stats.attack + attacker.stats.burst * 0.45 + Math.random() * 9;
  const defenceScore = defender.stats.defence + defender.stats.stamina * 0.35 + Math.random() * 7;
  return Math.max(4, Math.floor(attackScore - defenceScore * 0.5));
}

function makeName(seed) {
  return `${pickFrom(NAME_PREFIX, seed)}${pickFrom(NAME_SUFFIX, seed + 1)}${pickFrom(NAME_END, seed + 2)}`;
}

function makePalette(seed) {
  const hue1 = Math.floor(randomFloat(seed) * 360);
  const hue2 = (hue1 + 20 + Math.floor(randomFloat(seed + 1) * 180)) % 360;
  const hue3 = (hue1 + 180 + Math.floor(randomFloat(seed + 2) * 90)) % 360;
  return {
    base: `hsl(${hue1}deg 72% 58%)`,
    secondary: `hsl(${hue2}deg 66% 47%)`,
    accent: `hsl(${hue3}deg 88% 66%)`
  };
}

function weightedChoice(items, seed, weightKey = "weight") {
  const total = items.reduce((acc, item) => acc + Number(item[weightKey] || 0), 0);
  let roll = Math.floor(randomFloat(seed) * total);
  for (const item of items) {
    roll -= Number(item[weightKey] || 0);
    if (roll < 0) return item;
  }
  return items[0];
}

function pickFrom(list, seed) {
  return list[Math.abs(seededInt(`${seed}:${list.length}`)) % list.length];
}

function randomRange(min, max, seed) {
  return min + Math.floor(randomFloat(seed) * (Math.max(min + 1, max + 1) - min));
}

function randomFloat(seed) {
  const x = Math.sin(Number(seed) * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function seededInt(text) {
  const str = String(text);
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
