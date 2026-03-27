import { ensureGrevPetsTables } from "./schema.js";
import {
  createStarterPet,
  makeEncounter,
  runBattle,
  runRace,
  applyXpAndLevel,
  captureChance,
  summarizePet,
  STARTER_OPTIONS,
  getTypeDexPreview,
  normalizeAvatarConfig,
  avatarMeta,
  DEFAULT_AVATAR
} from "./logic.js";

const PRESENCE_TTL_MS = 1000 * 90;

export async function handleGrevPetsRequest(request, env, helpers) {
  const { pathname } = new URL(request.url);
  if (!pathname.startsWith("/api/grev-pets")) {
    return null;
  }

  const { json, safeJson, getApprovedUser } = helpers;
  await ensureGrevPetsTables(env);

  if (pathname === "/api/grev-pets/me" && request.method === "GET") {
    const session = await getApprovedUser(request, env);
    if (session instanceof Response) return session;

    const state = await ensurePlayerState(env, session);
    const pets = await env.DB.prepare(`SELECT * FROM gp_pets WHERE user_id = ? ORDER BY is_favorite DESC, level DESC, updated_at DESC LIMIT 8`).bind(session.id).all();
    const parsedPets = (pets.results || []).map(parsePetRow);
    const activePet = state.active_pet_id ? (parsedPets.find((pet) => pet.petId === state.active_pet_id) || null) : null;

    return json({
      success: true,
      profile: buildProfileSummary(state, parsedPets, activePet),
      pet_count: parsedPets.length,
      featured_pets: parsedPets.slice(0, 6),
      starter_options: STARTER_OPTIONS,
      type_dex: getTypeDexPreview(),
      avatar_options: avatarMeta()
    }, 200, request);
  }

  if (pathname === "/api/grev-pets/profile" && request.method === "POST") {
    const session = await getApprovedUser(request, env);
    if (session instanceof Response) return session;

    const payload = await safeJson(request);
    const avatar = normalizeAvatarConfig(payload?.avatar || {});
    const title = sanitizeText(payload?.title, 40) || "Rookie Wrangler";
    const favoriteType = sanitizeType(payload?.favorite_type || null);

    await ensurePlayerState(env, session);
    await env.DB.prepare(`
      UPDATE gp_player_state
      SET avatar_json = ?,
          title = ?,
          favorite_type = ?,
          username = ?,
          updated_at = ?
      WHERE user_id = ?
    `).bind(JSON.stringify(avatar), title, favoriteType, session.username, new Date().toISOString(), session.id).run();

    return json({ success: true, avatar, title, favorite_type: favoriteType }, 200, request);
  }

  if (pathname === "/api/grev-pets/starter" && request.method === "POST") {
    const session = await getApprovedUser(request, env);
    if (session instanceof Response) return session;

    const payload = await safeJson(request);
    const starterKey = String(payload?.starterKey || payload?.archetype || "scavenger").trim().toLowerCase();

    const state = await ensurePlayerState(env, session);
    if (Number(state.starter_claimed)) {
      return json({ success: false, error: "Starter already claimed." }, 409, request);
    }

    const starter = createStarterPet(session.id, session.username, starterKey);
    const now = new Date().toISOString();
    await savePet(env.DB, starter, session.id, now);

    const trainerLevel = Math.max(1, Math.floor((starter.level + 1) / 2));
    await env.DB.prepare(`
      UPDATE gp_player_state
      SET starter_claimed = 1,
          starter_pet_id = ?,
          active_pet_id = ?,
          trainer_level = ?,
          favorite_type = COALESCE(favorite_type, ?),
          updated_at = ?
      WHERE user_id = ?
    `).bind(starter.petId, starter.petId, trainerLevel, starter.primaryType, now, session.id).run();

    return json({ success: true, pet: starter }, 201, request);
  }

  if (pathname === "/api/grev-pets/presence" && request.method === "POST") {
    const session = await getApprovedUser(request, env);
    if (session instanceof Response) return session;

    const payload = await safeJson(request);
    const x = sanitizeNum(payload?.x, 220, 0, 900);
    const y = sanitizeNum(payload?.y, 240, 0, 580);
    const zone = sanitizeZone(payload?.zone);

    const playerState = await ensurePlayerState(env, session);

    await env.DB.prepare(`
      INSERT INTO gp_presence (user_id, username, avatar_json, pos_x, pos_y, zone, active_pet_id, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?, (SELECT active_pet_id FROM gp_player_state WHERE user_id = ?), ?)
      ON CONFLICT(user_id) DO UPDATE SET
        username = excluded.username,
        avatar_json = excluded.avatar_json,
        pos_x = excluded.pos_x,
        pos_y = excluded.pos_y,
        zone = excluded.zone,
        active_pet_id = excluded.active_pet_id,
        last_seen_at = excluded.last_seen_at
    `).bind(session.id, session.username, playerState.avatar_json || JSON.stringify(DEFAULT_AVATAR), x, y, zone, session.id, new Date().toISOString()).run();

    await env.DB.prepare(`UPDATE gp_player_state SET pos_x = ?, pos_y = ?, zone = ?, username = ?, updated_at = ? WHERE user_id = ?`)
      .bind(x, y, zone, session.username, new Date().toISOString(), session.id).run();

    const cutoff = new Date(Date.now() - PRESENCE_TTL_MS).toISOString();
    await env.DB.prepare(`DELETE FROM gp_presence WHERE last_seen_at < ?`).bind(cutoff).run();

    return json({ success: true }, 200, request);
  }

  if (pathname === "/api/grev-pets/presence" && request.method === "GET") {
    const session = await getApprovedUser(request, env);
    if (session instanceof Response) return session;

    const zone = sanitizeZone(new URL(request.url).searchParams.get("zone") || "town_hub");
    const cutoff = new Date(Date.now() - PRESENCE_TTL_MS).toISOString();

    const rows = await env.DB.prepare(`
      SELECT user_id, username, avatar_json, pos_x, pos_y, zone, active_pet_id, last_seen_at
      FROM gp_presence
      WHERE zone = ? AND last_seen_at >= ?
      ORDER BY last_seen_at DESC
      LIMIT 40
    `).bind(zone, cutoff).all();

    return json({
      success: true,
      players: (rows.results || [])
        .filter((row) => Number(row.user_id) !== Number(session.id))
        .map((row) => ({ ...row, avatar: parseAvatar(row.avatar_json) }))
    }, 200, request);
  }

  if (pathname === "/api/grev-pets/encounter" && request.method === "POST") {
    const session = await getApprovedUser(request, env);
    if (session instanceof Response) return session;

    const payload = await safeJson(request);
    const zone = sanitizeZone(payload?.zone || "wild_scrapyard");

    const encounter = makeEncounter(zone, session.id);

    await env.DB.prepare(`
      INSERT INTO gp_encounters (encounter_id, user_id, wild_data_json, wild_current_hp, zone, created_at, expires_at, resolved)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `).bind(
      encounter.encounterId,
      session.id,
      JSON.stringify(encounter.wildPet),
      encounter.wildCurrentHp,
      zone,
      encounter.createdAt,
      encounter.expiresAt
    ).run();

    return json({ success: true, encounter }, 201, request);
  }

  if (pathname === "/api/grev-pets/capture" && request.method === "POST") {
    const session = await getApprovedUser(request, env);
    if (session instanceof Response) return session;

    const payload = await safeJson(request);
    const encounterId = String(payload?.encounterId || "").trim();
    const mode = String(payload?.mode || "toss").trim();
    const weaken = Boolean(payload?.weaken);

    if (!encounterId) {
      return json({ success: false, error: "Missing encounterId." }, 400, request);
    }

    const row = await env.DB.prepare(`
      SELECT * FROM gp_encounters
      WHERE encounter_id = ? AND user_id = ? AND resolved = 0
      LIMIT 1
    `).bind(encounterId, session.id).first();

    if (!row) {
      return json({ success: false, error: "Encounter expired or not found." }, 404, request);
    }

    if (Date.parse(row.expires_at) < Date.now()) {
      await env.DB.prepare(`UPDATE gp_encounters SET resolved = 1 WHERE encounter_id = ?`).bind(encounterId).run();
      return json({ success: false, error: "Encounter expired." }, 410, request);
    }

    const wildPet = JSON.parse(row.wild_data_json || "{}");
    const currentHp = Math.max(1, Number(row.wild_current_hp || wildPet?.stats?.health || 1) - (weaken ? 8 + Math.floor(Math.random() * 8) : 0));
    const state = await ensurePlayerState(env, session);

    const playerPetRow = state.active_pet_id
      ? await env.DB.prepare(`SELECT * FROM gp_pets WHERE pet_id = ? AND user_id = ? LIMIT 1`).bind(state.active_pet_id, session.id).first()
      : null;
    const playerPetLevel = playerPetRow ? Number(playerPetRow.level || 1) : 1;

    const chance = captureChance({
      rarity: wildPet.rarity,
      level: Number(wildPet.level || 1),
      wildCurrentHp: currentHp,
      wildMaxHp: Number(wildPet?.stats?.health || 1),
      playerPetLevel
    });

    const bonus = mode === "snack-lure" ? 8 : mode === "ultra-net" ? 14 : 0;
    const finalChance = Math.min(93, chance + bonus);
    const roll = Math.floor(Math.random() * 100) + 1;
    const success = roll <= finalChance;

    if (success) {
      const now = new Date().toISOString();
      wildPet.petId = `gp_owned_${Math.abs(Date.now() + Math.floor(Math.random() * 9999)).toString(36)}`;
      wildPet.ownerId = session.id;
      wildPet.xp = Number(wildPet.xp || 0);
      await savePet(env.DB, wildPet, session.id, now);
      await env.DB.prepare(`UPDATE gp_encounters SET resolved = 1, wild_current_hp = ? WHERE encounter_id = ?`).bind(currentHp, encounterId).run();

      const existingFavorite = await env.DB.prepare(`SELECT pet_id FROM gp_pets WHERE user_id = ? AND is_favorite = 1 LIMIT 1`).bind(session.id).first();
      if (!existingFavorite) {
        await env.DB.prepare(`UPDATE gp_pets SET is_favorite = 1 WHERE pet_id = ? AND user_id = ?`).bind(wildPet.petId, session.id).run();
      }

      return json({ success: true, captured: true, chance: finalChance, roll, pet: wildPet }, 200, request);
    }

    await env.DB.prepare(`UPDATE gp_encounters SET wild_current_hp = ? WHERE encounter_id = ?`).bind(currentHp, encounterId).run();
    return json({ success: true, captured: false, chance: finalChance, roll, wild_current_hp: currentHp }, 200, request);
  }

  if (pathname === "/api/grev-pets/pets" && request.method === "GET") {
    const session = await getApprovedUser(request, env);
    if (session instanceof Response) return session;

    const rows = await env.DB.prepare(`SELECT * FROM gp_pets WHERE user_id = ? ORDER BY is_favorite DESC, level DESC, updated_at DESC`).bind(session.id).all();
    return json({ success: true, pets: (rows.results || []).map(parsePetRow) }, 200, request);
  }

  if (pathname === "/api/grev-pets/pet" && request.method === "GET") {
    const session = await getApprovedUser(request, env);
    if (session instanceof Response) return session;

    const petId = String(new URL(request.url).searchParams.get("petId") || "").trim();
    if (!petId) {
      return json({ success: false, error: "petId is required." }, 400, request);
    }

    const row = await env.DB.prepare(`SELECT * FROM gp_pets WHERE pet_id = ? AND user_id = ? LIMIT 1`).bind(petId, session.id).first();
    if (!row) {
      return json({ success: false, error: "Pet not found." }, 404, request);
    }

    const events = await env.DB.prepare(`
      SELECT event_type, outcome, xp_gained, payload_json, created_at
      FROM gp_event_log
      WHERE user_id = ? AND pet_id = ?
      ORDER BY created_at DESC
      LIMIT 25
    `).bind(session.id, petId).all();

    return json({ success: true, pet: parsePetRow(row), events: events.results || [] }, 200, request);
  }

  if (pathname === "/api/grev-pets/active-pet" && request.method === "POST") {
    const session = await getApprovedUser(request, env);
    if (session instanceof Response) return session;

    const payload = await safeJson(request);
    const petId = String(payload?.petId || "").trim();
    const favorite = Boolean(payload?.favorite);

    if (!petId) {
      return json({ success: false, error: "petId is required." }, 400, request);
    }

    const pet = await env.DB.prepare(`SELECT pet_id FROM gp_pets WHERE user_id = ? AND pet_id = ? LIMIT 1`).bind(session.id, petId).first();
    if (!pet) {
      return json({ success: false, error: "Pet not found." }, 404, request);
    }

    await env.DB.prepare(`UPDATE gp_player_state SET active_pet_id = ?, updated_at = ? WHERE user_id = ?`).bind(petId, new Date().toISOString(), session.id).run();

    if (favorite) {
      await env.DB.prepare(`UPDATE gp_pets SET is_favorite = 0 WHERE user_id = ?`).bind(session.id).run();
      await env.DB.prepare(`UPDATE gp_pets SET is_favorite = 1 WHERE user_id = ? AND pet_id = ?`).bind(session.id, petId).run();
    }

    return json({ success: true }, 200, request);
  }

  if (pathname === "/api/grev-pets/events/battle" && request.method === "POST") {
    const session = await getApprovedUser(request, env);
    if (session instanceof Response) return session;

    const payload = await safeJson(request);
    const petId = String(payload?.petId || "").trim();
    if (!petId) {
      return json({ success: false, error: "petId required." }, 400, request);
    }

    const row = await env.DB.prepare(`SELECT * FROM gp_pets WHERE user_id = ? AND pet_id = ? LIMIT 1`).bind(session.id, petId).first();
    if (!row) {
      return json({ success: false, error: "Pet not found." }, 404, request);
    }

    const pet = parsePetRow(row);
    const result = runBattle(pet, Date.now() + Math.floor(Math.random() * 9999));
    const advanced = applyXpAndLevel(pet, result.xpGained);
    const updatedPet = {
      ...advanced.pet,
      battleRecord: {
        wins: (pet.battleRecord?.wins || 0) + (result.won ? 1 : 0),
        losses: (pet.battleRecord?.losses || 0) + (result.won ? 0 : 1)
      },
      raceRecord: pet.raceRecord
    };

    await savePet(env.DB, updatedPet, session.id, new Date().toISOString());
    await env.DB.prepare(`
      INSERT INTO gp_event_log (user_id, pet_id, event_type, outcome, xp_gained, payload_json, created_at)
      VALUES (?, ?, 'battle', ?, ?, ?, ?)
    `).bind(session.id, petId, result.won ? "win" : "loss", result.xpGained, JSON.stringify({ log: result.log, enemy: result.enemy }), new Date().toISOString()).run();

    await updateTrainerLevel(env.DB, session.id);

    return json({
      success: true,
      result,
      pet: updatedPet,
      level_ups: advanced.levelUps
    }, 200, request);
  }

  if (pathname === "/api/grev-pets/events/race" && request.method === "POST") {
    const session = await getApprovedUser(request, env);
    if (session instanceof Response) return session;

    const payload = await safeJson(request);
    const petId = String(payload?.petId || "").trim();
    if (!petId) {
      return json({ success: false, error: "petId required." }, 400, request);
    }

    const row = await env.DB.prepare(`SELECT * FROM gp_pets WHERE user_id = ? AND pet_id = ? LIMIT 1`).bind(session.id, petId).first();
    if (!row) {
      return json({ success: false, error: "Pet not found." }, 404, request);
    }

    const pet = parsePetRow(row);
    const race = runRace(pet, 5);
    const advanced = applyXpAndLevel(pet, race.xpGained);
    const updatedPet = {
      ...advanced.pet,
      raceRecord: {
        wins: (pet.raceRecord?.wins || 0) + (race.placement === 1 ? 1 : 0),
        places: (pet.raceRecord?.places || 0) + race.placement
      },
      battleRecord: pet.battleRecord
    };

    await savePet(env.DB, updatedPet, session.id, new Date().toISOString());
    await env.DB.prepare(`
      INSERT INTO gp_event_log (user_id, pet_id, event_type, outcome, xp_gained, payload_json, created_at)
      VALUES (?, ?, 'race', ?, ?, ?, ?)
    `).bind(session.id, petId, `place_${race.placement}`, race.xpGained, JSON.stringify({ leaderboard: race.leaderboard, commentary: race.commentary }), new Date().toISOString()).run();

    await updateTrainerLevel(env.DB, session.id);

    return json({
      success: true,
      result: race,
      pet: updatedPet,
      level_ups: advanced.levelUps
    }, 200, request);
  }

  return json({ success: false, error: "Unknown Grev Pets route." }, 404, request);
}

async function ensurePlayerState(env, session) {
  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO gp_player_state (user_id, username, title, pos_x, pos_y, zone, starter_claimed, trainer_level, avatar_json, encounter_seed, updated_at)
    VALUES (?, ?, 'Rookie Wrangler', 220, 240, 'town_hub', 0, 1, ?, ABS(RANDOM()), ?)
    ON CONFLICT(user_id) DO UPDATE SET
      username = excluded.username,
      updated_at = excluded.updated_at
  `).bind(session.id, session.username, JSON.stringify(DEFAULT_AVATAR), now).run();

  return await env.DB.prepare(`SELECT * FROM gp_player_state WHERE user_id = ? LIMIT 1`).bind(session.id).first();
}

async function savePet(db, pet, userId, now) {
  const battleRecord = pet.battleRecord || { wins: 0, losses: 0 };
  const raceRecord = pet.raceRecord || { wins: 0, places: 0 };
  const caughtAt = pet.caughtAt || pet.caught_at || now;

  await db.prepare(`
    INSERT INTO gp_pets (
      pet_id, user_id, name, species, primary_type, secondary_type, level, xp, rarity, temperament, growth_bias,
      stats_json, traits_json, battle_wins, battle_losses, race_wins, race_places,
      is_favorite, caught_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    ON CONFLICT(pet_id) DO UPDATE SET
      user_id = excluded.user_id,
      name = excluded.name,
      species = excluded.species,
      primary_type = excluded.primary_type,
      secondary_type = excluded.secondary_type,
      level = excluded.level,
      xp = excluded.xp,
      rarity = excluded.rarity,
      temperament = excluded.temperament,
      growth_bias = excluded.growth_bias,
      stats_json = excluded.stats_json,
      traits_json = excluded.traits_json,
      battle_wins = excluded.battle_wins,
      battle_losses = excluded.battle_losses,
      race_wins = excluded.race_wins,
      race_places = excluded.race_places,
      updated_at = excluded.updated_at
  `).bind(
    pet.petId,
    userId,
    pet.name,
    pet.species,
    pet.primaryType || "Feral",
    pet.secondaryType || null,
    Number(pet.level || 1),
    Number(pet.xp || 0),
    pet.rarity,
    pet.temperament,
    pet.growthBias,
    JSON.stringify(pet.stats || {}),
    JSON.stringify(pet.traits || {}),
    Number(battleRecord.wins || 0),
    Number(battleRecord.losses || 0),
    Number(raceRecord.wins || 0),
    Number(raceRecord.places || 0),
    caughtAt,
    now,
    now
  ).run();
}

function parsePetRow(row) {
  return summarizePet({
    petId: row.pet_id,
    name: row.name,
    species: row.species,
    level: Number(row.level || 1),
    xp: Number(row.xp || 0),
    rarity: row.rarity,
    temperament: row.temperament,
    growthBias: row.growth_bias,
    primaryType: row.primary_type || "Feral",
    secondaryType: row.secondary_type || null,
    stats: JSON.parse(row.stats_json || "{}"),
    traits: JSON.parse(row.traits_json || "{}"),
    battleRecord: { wins: Number(row.battle_wins || 0), losses: Number(row.battle_losses || 0) },
    raceRecord: { wins: Number(row.race_wins || 0), places: Number(row.race_places || 0) },
    caughtAt: row.caught_at,
    isFavorite: Boolean(row.is_favorite)
  });
}

function buildProfileSummary(state, pets, activePet) {
  const avatar = parseAvatar(state.avatar_json);
  const totals = pets.reduce((acc, pet) => {
    acc.battleWins += Number(pet.battleRecord?.wins || 0);
    acc.battleLosses += Number(pet.battleRecord?.losses || 0);
    acc.raceWins += Number(pet.raceRecord?.wins || 0);
    acc.racePlaces += Number(pet.raceRecord?.places || 0);
    acc.types[pet.primaryType] = (acc.types[pet.primaryType] || 0) + 1;
    if (pet.secondaryType) {
      acc.types[pet.secondaryType] = (acc.types[pet.secondaryType] || 0) + 1;
    }
    return acc;
  }, { battleWins: 0, battleLosses: 0, raceWins: 0, racePlaces: 0, types: {} });

  const inferredFavorite = Object.entries(totals.types).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  return {
    user_id: Number(state.user_id),
    username: state.username,
    title: state.title || "Rookie Wrangler",
    pos_x: Number(state.pos_x),
    pos_y: Number(state.pos_y),
    zone: state.zone,
    active_pet_id: state.active_pet_id,
    active_pet: activePet,
    starter_claimed: Boolean(state.starter_claimed),
    starter_pet_id: state.starter_pet_id || null,
    trainer_level: Number(state.trainer_level || 1),
    favorite_type: state.favorite_type || inferredFavorite,
    battle_record: { wins: totals.battleWins, losses: totals.battleLosses },
    race_record: { wins: totals.raceWins, places: totals.racePlaces },
    avatar,
    updated_at: state.updated_at
  };
}

async function updateTrainerLevel(db, userId) {
  const agg = await db.prepare(`
    SELECT COALESCE(SUM(level), 0) AS total_level, COUNT(*) AS pet_count
    FROM gp_pets
    WHERE user_id = ?
  `).bind(userId).first();

  const total = Number(agg?.total_level || 0);
  const count = Number(agg?.pet_count || 0);
  const trainerLevel = Math.max(1, Math.floor(total / Math.max(1, count * 2)) + 1);

  await db.prepare(`UPDATE gp_player_state SET trainer_level = ?, updated_at = ? WHERE user_id = ?`)
    .bind(trainerLevel, new Date().toISOString(), userId)
    .run();
}

function parseAvatar(value) {
  try {
    return normalizeAvatarConfig(JSON.parse(value || "{}"));
  } catch {
    return { ...DEFAULT_AVATAR };
  }
}

function sanitizeNum(value, fallback, min, max) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function sanitizeZone(zone) {
  const normalized = String(zone || "").toLowerCase().trim();
  const allowed = new Set(["town_hub", "stable_square", "event_gate", "wild_scrapyard", "wild_neon_abyss", "wild_mushroom_ruins"]);
  return allowed.has(normalized) ? normalized : "town_hub";
}

function sanitizeText(value, maxLen) {
  const text = String(value || "").replace(/[<>\n\r]/g, "").trim();
  return text.slice(0, maxLen);
}

function sanitizeType(value) {
  if (!value) return null;
  const text = String(value).trim();
  const found = getTypeDexPreview().find((item) => item.type.toLowerCase() === text.toLowerCase());
  return found ? found.type : null;
}
