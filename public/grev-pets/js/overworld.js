import { api, byId, requireAuthOrRedirect, safeText } from "./api.js";
import { renderPet, rarityClass, typeBadgePair } from "./pet-renderer.js";
import { avatarMarkup } from "./avatar-renderer.js";

const WORLD_WIDTH = 900;
const WORLD_HEIGHT = 580;
const PLAYER_SIZE = 30;
const EDGE_BUFFER = 18;

const AREAS = {
  spawn_town: {
    id: "spawn_town",
    name: "Spawn Town",
    subtitle: "Safe spawn hub with routes to the south and west districts.",
    theme: "spawn_town",
    safe: true,
    encounterRate: 0,
    objective: "Objective: head south into Tallgrass Trail to start catching.",
    encounterFlavor: "Calm streets. Wild pets avoid the busy plaza.",
    landmarks: [
      { cls: "house-row" },
      { cls: "stable-building", label: "Stable" },
      { cls: "event-building", label: "Event Plaza" },
      { cls: "fence fence-west" },
      { cls: "fence fence-east" }
    ],
    exits: {
      south: { to: "tallgrass_route", spawn: "north" },
      west: { to: "stable_district", spawn: "east" },
      east: { to: "event_plaza", spawn: "west" }
    }
  },
  tallgrass_route: {
    id: "tallgrass_route",
    name: "Tallgrass Trail",
    subtitle: "Classic capture route filled with rustling grass and low-level wilds.",
    theme: "tallgrass_route",
    safe: false,
    encounterRate: 0.36,
    objective: "Objective: weaken and capture common route species.",
    encounterFlavor: "Grass trembles — something is stalking nearby.",
    landmarks: [{ cls: "tree-cluster cluster-sw" }, { cls: "flowers" }, { cls: "bushes" }],
    exits: {
      north: { to: "spawn_town", spawn: "south" },
      east: { to: "pondside_path", spawn: "west" },
      south: { to: "mushroom_grove", spawn: "north" }
    }
  },
  stable_district: {
    id: "stable_district",
    name: "Stable District",
    subtitle: "Quiet training strip next to storage barns and prep spaces.",
    theme: "stable_district",
    safe: true,
    encounterRate: 0,
    objective: "Objective: regroup here, then move to Scrapyard for tougher catches.",
    encounterFlavor: "Stable workers keep wild pets away from this district.",
    landmarks: [{ cls: "stable-building", label: "Barn Row" }, { cls: "tree-cluster cluster-nw" }],
    exits: {
      east: { to: "spawn_town", spawn: "west" },
      south: { to: "scrapyard", spawn: "north" }
    }
  },
  event_plaza: {
    id: "event_plaza",
    name: "Event Plaza",
    subtitle: "Bright social plaza leading to unstable neon hunting ground.",
    theme: "event_plaza",
    safe: true,
    encounterRate: 0,
    objective: "Objective: move east into Neon Rift for glitch and lunar hunts.",
    encounterFlavor: "Crowds and lights keep this plaza encounter-free.",
    landmarks: [{ cls: "event-building", label: "Arena" }, { cls: "pond" }],
    exits: {
      west: { to: "spawn_town", spawn: "east" },
      east: { to: "neon_rift", spawn: "west" }
    }
  },
  mushroom_grove: {
    id: "mushroom_grove",
    name: "Mushroom Grove",
    subtitle: "Foggy fungal grove with spirit and toxic-flavored encounters.",
    theme: "mushroom_grove",
    safe: false,
    encounterRate: 0.42,
    objective: "Objective: hunt rare Moss/Toxic/Spirit mixes here.",
    encounterFlavor: "Spores swirl — a strange wild pet emerges.",
    landmarks: [{ cls: "cluster-east tree-cluster" }, { cls: "flowers" }],
    exits: {
      north: { to: "tallgrass_route", spawn: "south" },
      east: { to: "neon_rift", spawn: "south" }
    }
  },
  neon_rift: {
    id: "neon_rift",
    name: "Neon Rift",
    subtitle: "Electric rift zone with unstable glitch signatures and lunar echoes.",
    theme: "neon_rift",
    safe: false,
    encounterRate: 0.44,
    objective: "Objective: use snack lure for high-variance rare captures.",
    encounterFlavor: "Reality flickers. A wild signal locks onto you.",
    landmarks: [{ cls: "pond" }, { cls: "bushes" }],
    exits: {
      west: { to: "event_plaza", spawn: "east" },
      south: { to: "scrapyard", spawn: "east" },
      north: { to: "pondside_path", spawn: "east" }
    }
  },
  scrapyard: {
    id: "scrapyard",
    name: "Scrapyard",
    subtitle: "Twisted metal route with Iron/Stone/Toxic encounters.",
    theme: "scrapyard",
    safe: false,
    encounterRate: 0.34,
    objective: "Objective: farm sturdy Iron and Stone catches for your core team.",
    encounterFlavor: "Metal clanks nearby as a wild shape lunges out.",
    landmarks: [{ cls: "fence fence-east" }, { cls: "fence fence-west" }],
    exits: {
      north: { to: "stable_district", spawn: "south" },
      east: { to: "pondside_path", spawn: "south" },
      west: { to: "mushroom_grove", spawn: "east" }
    }
  },
  pondside_path: {
    id: "pondside_path",
    name: "Pondside Path",
    subtitle: "Waterside lane with Tidal, Moss, and Frost encounter pools.",
    theme: "pondside_path",
    safe: false,
    encounterRate: 0.31,
    objective: "Objective: find balanced water-adjacent partners.",
    encounterFlavor: "Ripples split apart as a wild pet leaps forward.",
    landmarks: [{ cls: "pond" }, { cls: "tree-cluster cluster-east" }],
    exits: {
      west: { to: "tallgrass_route", spawn: "east" },
      south: { to: "scrapyard", spawn: "east" },
      east: { to: "neon_rift", spawn: "north" }
    }
  }
};

const world = {
  x: 220,
  y: 140,
  areaId: "spawn_town",
  encounter: null,
  keys: new Set(),
  others: new Map(),
  avatar: null,
  username: "Explorer",
  activePet: null,
  facing: "down",
  bob: 0,
  transitionLock: false
};

let animationHandle = null;
let presenceTimer = null;
let encounterTimer = null;
let encounterAnimHandle = null;

async function boot() {
  try {
    const user = await requireAuthOrRedirect();
    const me = await api("/api/grev-pets/me");

    world.areaId = normalizeArea(me.profile.zone);
    world.x = Number(me.profile.pos_x || WORLD_WIDTH / 2);
    world.y = Number(me.profile.pos_y || WORLD_HEIGHT / 2);
    world.avatar = me.profile.avatar;
    world.username = user?.username || me.profile.username || "Explorer";
    world.activePet = me.profile.active_pet || null;

    mountPlayerAvatar();
    renderAreaVisuals();
    updateHUDForArea(true);
    setupControls();
    startLoop();
    startPresence();
    startEncounterChecks();
    log(`Entered ${currentArea().name}.`);
  } catch (error) {
    log(error.message);
  }
}

function mountPlayerAvatar() {
  byId("player-avatar").innerHTML = avatarMarkup(world.avatar, { size: "mini" });
  byId("player-name").textContent = safeText(world.username);
  byId("active-pet").textContent = `Active Pet: ${safeText(world.activePet?.name || "none")}`;
}

function setupControls() {
  window.addEventListener("keydown", (event) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D"].includes(event.key)) {
      event.preventDefault();
      world.keys.add(event.key.toLowerCase());
    }
  });

  window.addEventListener("keyup", (event) => {
    world.keys.delete(event.key.toLowerCase());
  });

  byId("btn-battle").addEventListener("click", () => captureAction("battle", true));
  byId("btn-weaken").addEventListener("click", () => captureAction("toss", true));
  byId("btn-capture").addEventListener("click", () => captureAction("toss", false));
  byId("btn-lure").addEventListener("click", () => captureAction("snack-lure", false));
  byId("btn-run").addEventListener("click", runFromEncounter);
}

function startLoop() {
  const step = () => {
    if (!world.encounter) {
      const speed = 2.9;
      let dx = 0;
      let dy = 0;
      if (world.keys.has("arrowup") || world.keys.has("w")) dy -= speed;
      if (world.keys.has("arrowdown") || world.keys.has("s")) dy += speed;
      if (world.keys.has("arrowleft") || world.keys.has("a")) dx -= speed;
      if (world.keys.has("arrowright") || world.keys.has("d")) dx += speed;

      if (dx !== 0 || dy !== 0) {
        world.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
        world.x = clamp(world.x + dx, PLAYER_SIZE / 2, WORLD_WIDTH - PLAYER_SIZE / 2);
        world.y = clamp(world.y + dy, PLAYER_SIZE / 2, WORLD_HEIGHT - PLAYER_SIZE / 2);
        tryAreaTransition();
        world.bob += 0.2;
      } else {
        world.bob += 0.08;
      }
    }

    placeAvatar();
    animationHandle = requestAnimationFrame(step);
  };

  step();
}

function tryAreaTransition() {
  if (world.transitionLock || world.encounter) return;
  const exits = currentArea().exits || {};
  let edge = null;

  if (world.y <= EDGE_BUFFER) edge = "north";
  else if (world.y >= WORLD_HEIGHT - EDGE_BUFFER) edge = "south";
  else if (world.x <= EDGE_BUFFER) edge = "west";
  else if (world.x >= WORLD_WIDTH - EDGE_BUFFER) edge = "east";

  const exit = edge ? exits[edge] : null;
  if (!exit?.to) return;

  world.transitionLock = true;
  switchArea(exit.to, exit.spawn || opposite(edge));
  setTimeout(() => {
    world.transitionLock = false;
  }, 280);
}

function switchArea(nextAreaId, spawnEdge) {
  world.areaId = normalizeArea(nextAreaId);

  if (spawnEdge === "north") {
    world.y = EDGE_BUFFER + 10;
    world.x = WORLD_WIDTH / 2;
  }
  if (spawnEdge === "south") {
    world.y = WORLD_HEIGHT - EDGE_BUFFER - 10;
    world.x = WORLD_WIDTH / 2;
  }
  if (spawnEdge === "west") {
    world.x = EDGE_BUFFER + 10;
    world.y = WORLD_HEIGHT / 2;
  }
  if (spawnEdge === "east") {
    world.x = WORLD_WIDTH - EDGE_BUFFER - 10;
    world.y = WORLD_HEIGHT / 2;
  }

  renderAreaVisuals();
  updateHUDForArea();
  showAreaBanner(currentArea().name, currentArea().subtitle);
  log(`➡️ Entered ${currentArea().name}.`);
}

function renderAreaVisuals() {
  const area = currentArea();
  const map = byId("overworld");
  map.dataset.theme = area.theme;

  const exitsMount = byId("map-exits");
  exitsMount.innerHTML = Object.entries(area.exits || {}).map(([dir, exit]) => `
    <div class="gp-exit-marker gp-exit-${dir}" title="${safeText(exit.to)}">
      <span>${dir.toUpperCase()}</span>
    </div>
  `).join("");

  const landmarksMount = byId("map-landmarks");
  landmarksMount.innerHTML = (area.landmarks || []).map((item) => `
    <div class="gp-scenery ${safeText(item.cls)}">${item.label ? `<span>${safeText(item.label)}</span>` : ""}</div>
  `).join("");
}

function placeAvatar() {
  const wrap = byId("player-wrap");
  const percentX = (world.x / WORLD_WIDTH) * 100;
  const percentY = (world.y / WORLD_HEIGHT) * 100;
  const bobY = Math.sin(world.bob) * 1.8;

  wrap.style.left = `${percentX}%`;
  wrap.style.top = `${percentY}%`;
  wrap.style.transform = `translate(-50%, calc(-50% + ${bobY}px))`;

  const avatarEl = wrap.querySelector(".gp-explorer-avatar");
  if (avatarEl) avatarEl.dataset.facing = world.facing;
}

function updateHUDForArea(initial = false) {
  const area = currentArea();
  byId("area-title").textContent = area.name;
  byId("area-subtitle").textContent = area.subtitle;
  byId("zone-label").textContent = `Area: ${area.name}`;
  byId("danger-state").textContent = area.safe ? "Safe area. No random encounters." : "Wild area. Encounters are active.";
  byId("objective").textContent = area.objective;
  byId("area-mode-pill").textContent = area.safe ? "Safe Zone" : "Wild Zone";
  byId("overworld").classList.toggle("is-danger", !area.safe);
  if (!initial) byId("overworld-hint").textContent = area.safe ? "Safe district. Use exits to travel." : "Wild route. Stay ready for encounter overlays.";
}

function showAreaBanner(name, subtitle) {
  const banner = byId("area-banner");
  banner.innerHTML = `<strong>${safeText(name)}</strong><span>${safeText(subtitle)}</span>`;
  banner.classList.remove("hidden");
  setTimeout(() => banner.classList.add("hidden"), 1800);
}

function startPresence() {
  const sync = async () => {
    try {
      await api("/api/grev-pets/presence", {
        method: "POST",
        body: JSON.stringify({ x: world.x, y: world.y, zone: world.areaId })
      });
      const presence = await api(`/api/grev-pets/presence?zone=${encodeURIComponent(world.areaId)}`);
      drawOthers(presence.players || []);
    } catch (error) {
      log(`Presence issue: ${error.message}`);
    }
  };

  sync();
  presenceTimer = setInterval(sync, 3000);
}

function drawOthers(players) {
  const map = byId("overworld");
  world.others.forEach((item) => {
    item.node.remove();
    item.label.remove();
  });
  world.others.clear();

  players.forEach((player) => {
    const wrap = document.createElement("div");
    wrap.className = "gp-other";
    wrap.style.left = `${(Number(player.pos_x || 0) / WORLD_WIDTH) * 100}%`;
    wrap.style.top = `${(Number(player.pos_y || 0) / WORLD_HEIGHT) * 100}%`;

    const shadow = document.createElement("div");
    shadow.className = "gp-player-shadow";

    const node = document.createElement("div");
    node.className = "gp-avatar";
    node.innerHTML = avatarMarkup(player.avatar || {}, { size: "mini" });

    const label = document.createElement("div");
    label.className = "gp-name-tag";
    label.textContent = safeText(player.username);
    label.style.left = wrap.style.left;
    label.style.top = wrap.style.top;

    wrap.append(shadow, node);
    map.appendChild(wrap);
    map.appendChild(label);
    world.others.set(player.user_id, { node: wrap, label });
  });
}

function startEncounterChecks() {
  const tick = async () => {
    const area = currentArea();
    if (area.safe || world.encounter) return;
    if (Math.random() > area.encounterRate) return;

    try {
      const data = await api("/api/grev-pets/encounter", {
        method: "POST",
        body: JSON.stringify({ zone: area.id })
      });
      world.encounter = data.encounter;
      showEncounter();
      log(`⚔️ ${data.encounter.wildPet.name} appeared in ${area.name}.`);
    } catch (error) {
      log(error.message);
    }
  };

  encounterTimer = setInterval(tick, 4200);
}

function showEncounter() {
  const overlay = byId("encounter-overlay");
  const wild = world.encounter?.wildPet;
  if (!wild) return;

  byId("encounter-title").textContent = `A wild ${safeText(wild.name)} appeared!`;
  byId("encounter-kicker").textContent = `${currentArea().name.toUpperCase()} ENCOUNTER`;
  byId("encounter-flavor").textContent = currentArea().encounterFlavor;
  byId("encounter-wild-meta").innerHTML = `<span class="gp-pill ${rarityClass(wild.rarity)}">${safeText(wild.rarity)}</span> · Lv ${wild.level} · ${safeText(wild.species)}`;
  byId("encounter-wild-types").innerHTML = typeBadgePair(wild.primaryType, wild.secondaryType);
  byId("wild-hp").textContent = String(world.encounter.wildCurrentHp);
  byId("wild-max-hp").textContent = String(wild.stats.health || 1);

  if (world.activePet) {
    byId("encounter-active-meta").textContent = `${world.activePet.name} · Lv ${world.activePet.level} · ${world.activePet.species}`;
    byId("encounter-active-types").innerHTML = typeBadgePair(world.activePet.primaryType, world.activePet.secondaryType);
    animateEncounterPet("encounter-active-pet", world.activePet);
  } else {
    byId("encounter-active-meta").textContent = "No active pet selected. Capture odds are reduced.";
    byId("encounter-active-types").innerHTML = "";
    clearCanvas("encounter-active-pet");
  }

  byId("encounter-log").innerHTML = "";
  animateEncounterPet("encounter-pet", wild);

  overlay.classList.remove("hidden");
  byId("encounter-status").textContent = `Encounter active: ${wild.name}`;
}

function animateEncounterPet(canvasId, pet) {
  const canvas = byId(canvasId);
  if (!canvas) return;
  if (encounterAnimHandle) cancelAnimationFrame(encounterAnimHandle);

  let bob = 0;
  const loop = () => {
    if (!world.encounter || !canvas.isConnected) return;
    bob += 0.09;
    renderPet(canvas, pet.traits, { bob, primaryType: pet.primaryType });
    encounterAnimHandle = requestAnimationFrame(loop);
  };
  loop();
}

function clearCanvas(canvasId) {
  const canvas = byId(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

async function captureAction(mode, weaken) {
  if (!world.encounter) return;

  try {
    const data = await api("/api/grev-pets/capture", {
      method: "POST",
      body: JSON.stringify({ encounterId: world.encounter.encounterId, mode, weaken })
    });

    if (data.captured) {
      overlayLog(`🎉 Captured ${data.pet.name}! (roll ${data.roll}/${data.chance})`);
      log(`Captured ${data.pet.name} in ${currentArea().name}.`);
      resolveEncounter(`Captured ${data.pet.name}!`);
      return;
    }

    if (data.wild_current_hp) {
      world.encounter.wildCurrentHp = data.wild_current_hp;
      byId("wild-hp").textContent = String(data.wild_current_hp);
    }

    overlayLog(`Attempt failed (roll ${data.roll}/${data.chance}). ${weaken ? "You softened it up." : "Try weaken first."}`);
  } catch (error) {
    overlayLog(error.message);
  }
}

function runFromEncounter() {
  if (!world.encounter) return;
  overlayLog("You escaped safely.");
  resolveEncounter("Escaped encounter.");
}

function resolveEncounter(status) {
  world.encounter = null;
  byId("encounter-overlay").classList.add("hidden");
  byId("encounter-status").textContent = status;
}

function overlayLog(text) {
  const mount = byId("encounter-log");
  const p = document.createElement("p");
  p.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  mount.prepend(p);
}

function log(message) {
  const mount = byId("overworld-log");
  if (!mount) return;
  const p = document.createElement("p");
  p.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  mount.prepend(p);
}

function normalizeArea(areaId) {
  const normalized = String(areaId || "").trim().toLowerCase();
  return AREAS[normalized] ? normalized : "spawn_town";
}

function currentArea() {
  return AREAS[world.areaId] || AREAS.spawn_town;
}

function opposite(direction) {
  return { north: "south", south: "north", east: "west", west: "east" }[direction] || "south";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

window.addEventListener("beforeunload", () => {
  if (animationHandle) cancelAnimationFrame(animationHandle);
  if (presenceTimer) clearInterval(presenceTimer);
  if (encounterTimer) clearInterval(encounterTimer);
  if (encounterAnimHandle) cancelAnimationFrame(encounterAnimHandle);
});

boot();
