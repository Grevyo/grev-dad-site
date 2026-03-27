import { api, byId, requireAuthOrRedirect, safeText } from "./api.js";
import { renderPet, rarityClass, typeBadgePair } from "./pet-renderer.js";
import { avatarMarkup } from "./avatar-renderer.js";

const WORLD_WIDTH = 1040;
const WORLD_HEIGHT = 620;
const PLAYER_SIZE = 30;
const EDGE_BUFFER = 20;

const AREAS = {
  spawn_town: {
    id: "spawn_town",
    name: "Spawn Town",
    subtitle: "Safe plaza where routes branch in every direction.",
    theme: "spawn_town",
    scene: "spawn-town",
    safe: true,
    encounterRate: 0,
    objective: "Objective: head south to Tallgrass Route and begin captures.",
    encounterFlavor: "Quiet streets and no wild activity.",
    exits: {
      south: { to: "tallgrass_route", spawn: "north", lane: [40, 60], label: "Tallgrass Route" },
      west: { to: "stable_district", spawn: "east", lane: [34, 66], label: "Stable District" },
      east: { to: "event_plaza", spawn: "west", lane: [34, 66], label: "Event Plaza" }
    },
    props: [
      { cls: "gp-prop path-cross" },
      { cls: "gp-prop building-townhall", x: 30, y: 9, w: 20, h: 20, label: "Town Hall" },
      { cls: "gp-prop building-stable", x: 9, y: 34, w: 15, h: 22, label: "Stable Gate" },
      { cls: "gp-prop building-event", x: 76, y: 34, w: 15, h: 22, label: "Plaza Gate" },
      { cls: "gp-prop lamp-row", x: 22, y: 46, w: 56, h: 8 },
      { cls: "gp-prop garden-grid", x: 58, y: 67, w: 28, h: 18 }
    ]
  },
  tallgrass_route: {
    id: "tallgrass_route",
    name: "South Route · Tallgrass",
    subtitle: "A long grassy stretch loaded with common wild encounters.",
    theme: "tallgrass_route",
    scene: "tallgrass-route",
    safe: false,
    encounterRate: 0.37,
    objective: "Objective: find route commons and build your core team.",
    encounterFlavor: "Grass rustles — a wild pet leaps out!",
    exits: {
      north: { to: "spawn_town", spawn: "south", lane: [40, 60], label: "Spawn Town" },
      south: { to: "mushroom_grove", spawn: "north", lane: [36, 64], label: "Mushroom Grove" },
      east: { to: "pondside_path", spawn: "west", lane: [42, 76], label: "Pondside Path" }
    },
    props: [
      { cls: "gp-prop route-road", x: 41, y: 0, w: 18, h: 100 },
      { cls: "gp-prop tallgrass-block", x: 8, y: 12, w: 28, h: 24 },
      { cls: "gp-prop tallgrass-block", x: 64, y: 18, w: 27, h: 25 },
      { cls: "gp-prop tallgrass-block", x: 11, y: 53, w: 22, h: 34 },
      { cls: "gp-prop tallgrass-block", x: 68, y: 56, w: 21, h: 30 },
      { cls: "gp-prop route-sign", x: 46, y: 17, w: 8, h: 10, label: "R-01" }
    ]
  },
  mushroom_grove: {
    id: "mushroom_grove",
    name: "Mushroom Grove",
    subtitle: "Foggy fungal woods with spooky spirit and toxic wildlife.",
    theme: "mushroom_grove",
    scene: "mushroom-grove",
    safe: false,
    encounterRate: 0.43,
    objective: "Objective: hunt Moss/Toxic/Spirit blends in deeper patches.",
    encounterFlavor: "Spores cloud the air as a wild pet appears.",
    exits: {
      north: { to: "tallgrass_route", spawn: "south", lane: [36, 64], label: "Tallgrass" },
      east: { to: "neon_rift", spawn: "south", lane: [22, 48], label: "Neon Rift" },
      west: { to: "scrapyard", spawn: "east", lane: [56, 82], label: "Scrapyard" }
    },
    props: [
      { cls: "gp-prop grove-path", x: 40, y: 0, w: 19, h: 100 },
      { cls: "gp-prop mushroom-ring", x: 11, y: 18, w: 26, h: 25 },
      { cls: "gp-prop mushroom-ring", x: 63, y: 60, w: 27, h: 27 },
      { cls: "gp-prop tree-mass", x: 68, y: 10, w: 20, h: 26 },
      { cls: "gp-prop spores", x: 8, y: 58, w: 24, h: 26 }
    ]
  },
  neon_rift: {
    id: "neon_rift",
    name: "Neon Rift",
    subtitle: "A fractured tech corridor where glitch energy distorts reality.",
    theme: "neon_rift",
    scene: "neon-rift",
    safe: false,
    encounterRate: 0.45,
    objective: "Objective: use lures for rare Glitch/Zap/Lunar catches.",
    encounterFlavor: "Static tears open and a wild signature locks on.",
    exits: {
      west: { to: "event_plaza", spawn: "east", lane: [34, 62], label: "Event Plaza" },
      south: { to: "scrapyard", spawn: "east", lane: [34, 60], label: "Scrapyard" },
      north: { to: "pondside_path", spawn: "east", lane: [38, 68], label: "Pondside" }
    },
    props: [
      { cls: "gp-prop rift-river", x: 46, y: 0, w: 9, h: 100 },
      { cls: "gp-prop neon-grid", x: 8, y: 14, w: 32, h: 24 },
      { cls: "gp-prop neon-grid", x: 60, y: 19, w: 30, h: 25 },
      { cls: "gp-prop crystal-stack", x: 66, y: 66, w: 22, h: 20 },
      { cls: "gp-prop crystal-stack", x: 14, y: 64, w: 20, h: 20 }
    ]
  },
  scrapyard: {
    id: "scrapyard",
    name: "Scrapyard",
    subtitle: "Junk maze with iron heaps and hostile toxic-metal species.",
    theme: "scrapyard",
    scene: "scrapyard",
    safe: false,
    encounterRate: 0.35,
    objective: "Objective: catch sturdy Stone and Iron pets for battle depth.",
    encounterFlavor: "Scrap shifts and something lunges from the pile.",
    exits: {
      north: { to: "stable_district", spawn: "south", lane: [35, 65], label: "Stable District" },
      east: { to: "pondside_path", spawn: "south", lane: [36, 64], label: "Pondside" },
      west: { to: "mushroom_grove", spawn: "east", lane: [42, 72], label: "Grove" }
    },
    props: [
      { cls: "gp-prop junk-road", x: 37, y: 0, w: 26, h: 100 },
      { cls: "gp-prop scrap-heap", x: 8, y: 17, w: 22, h: 24 },
      { cls: "gp-prop scrap-heap", x: 70, y: 19, w: 22, h: 24 },
      { cls: "gp-prop scrap-heap", x: 12, y: 62, w: 24, h: 24 },
      { cls: "gp-prop barrel-row", x: 65, y: 62, w: 22, h: 18 }
    ]
  },
  pondside_path: {
    id: "pondside_path",
    name: "Pondside Path",
    subtitle: "Quiet waterside lane with mixed Tidal, Moss, and Frost species.",
    theme: "pondside_path",
    scene: "pondside-path",
    safe: false,
    encounterRate: 0.32,
    objective: "Objective: scout balanced water-route partners and support pets.",
    encounterFlavor: "Water ripples hard and a wild pet surfaces.",
    exits: {
      west: { to: "tallgrass_route", spawn: "east", lane: [42, 76], label: "Tallgrass" },
      south: { to: "scrapyard", spawn: "east", lane: [34, 66], label: "Scrapyard" },
      east: { to: "neon_rift", spawn: "north", lane: [38, 68], label: "Neon Rift" }
    },
    props: [
      { cls: "gp-prop water-strip", x: 53, y: 0, w: 32, h: 100 },
      { cls: "gp-prop boardwalk", x: 32, y: 7, w: 15, h: 87 },
      { cls: "gp-prop reed-bed", x: 56, y: 17, w: 26, h: 26 },
      { cls: "gp-prop reed-bed", x: 58, y: 60, w: 24, h: 27 },
      { cls: "gp-prop lily-cluster", x: 62, y: 45, w: 18, h: 15 }
    ]
  },
  stable_district: {
    id: "stable_district",
    name: "Stable District",
    subtitle: "Barn-lined logistics quarter for storage, prep, and regrouping.",
    theme: "stable_district",
    scene: "stable-district",
    safe: true,
    encounterRate: 0,
    objective: "Objective: prep your lineup, then head south for scrapyard captures.",
    encounterFlavor: "No wild activity in this managed district.",
    exits: {
      east: { to: "spawn_town", spawn: "west", lane: [34, 66], label: "Spawn Town" },
      south: { to: "scrapyard", spawn: "north", lane: [35, 65], label: "Scrapyard" }
    },
    props: [
      { cls: "gp-prop stable-road", x: 34, y: 0, w: 32, h: 100 },
      { cls: "gp-prop barn-long", x: 8, y: 12, w: 20, h: 24, label: "Storage" },
      { cls: "gp-prop barn-long", x: 72, y: 14, w: 20, h: 24, label: "Training" },
      { cls: "gp-prop wagon-yard", x: 10, y: 61, w: 22, h: 24 },
      { cls: "gp-prop wagon-yard", x: 67, y: 60, w: 23, h: 24 }
    ]
  },
  event_plaza: {
    id: "event_plaza",
    name: "Event Plaza",
    subtitle: "Showcase district with arena gates and festival lighting.",
    theme: "event_plaza",
    scene: "event-plaza",
    safe: true,
    encounterRate: 0,
    objective: "Objective: use west exit for town or east route for Neon Rift.",
    encounterFlavor: "Crowds keep encounters away from the plaza.",
    exits: {
      west: { to: "spawn_town", spawn: "east", lane: [34, 66], label: "Spawn Town" },
      east: { to: "neon_rift", spawn: "west", lane: [34, 62], label: "Neon Rift" }
    },
    props: [
      { cls: "gp-prop plaza-stage", x: 34, y: 13, w: 32, h: 20, label: "Arena" },
      { cls: "gp-prop plaza-rings", x: 19, y: 40, w: 62, h: 46 },
      { cls: "gp-prop neon-pillar", x: 12, y: 20, w: 8, h: 60 },
      { cls: "gp-prop neon-pillar", x: 80, y: 20, w: 8, h: 60 }
    ]
  }
};

const world = {
  x: WORLD_WIDTH / 2,
  y: WORLD_HEIGHT / 2,
  areaId: "spawn_town",
  encounter: null,
  keys: new Set(),
  others: new Map(),
  avatar: null,
  username: "Explorer",
  activePet: null,
  facing: "down",
  bob: 0,
  transitionLock: false,
  touchDirs: new Set()
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

  mountTouchControls();

  byId("btn-battle").addEventListener("click", () => captureAction("battle", true));
  byId("btn-weaken").addEventListener("click", () => captureAction("toss", true));
  byId("btn-capture").addEventListener("click", () => captureAction("toss", false));
  byId("btn-lure").addEventListener("click", () => captureAction("snack-lure", false));
  byId("btn-run").addEventListener("click", runFromEncounter);
}

function startLoop() {
  const step = () => {
    if (!world.encounter) {
      const speed = 3;
      const { dx, dy } = getMovementVector(speed);

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

function mountTouchControls() {
  const controls = document.querySelectorAll("[data-move]");
  controls.forEach((button) => {
    const direction = button.dataset.move;
    if (!direction) return;

    const start = (event) => {
      event.preventDefault();
      world.touchDirs.add(direction);
      button.classList.add("is-active");
    };

    const end = (event) => {
      event.preventDefault();
      world.touchDirs.delete(direction);
      button.classList.remove("is-active");
    };

    button.addEventListener("pointerdown", start);
    button.addEventListener("pointerup", end);
    button.addEventListener("pointercancel", end);
    button.addEventListener("pointerleave", end);
    button.addEventListener("contextmenu", (event) => event.preventDefault());
  });
}

function getMovementVector(speed) {
  let dx = 0;
  let dy = 0;

  if (world.keys.has("arrowup") || world.keys.has("w") || world.touchDirs.has("up")) dy -= speed;
  if (world.keys.has("arrowdown") || world.keys.has("s") || world.touchDirs.has("down")) dy += speed;
  if (world.keys.has("arrowleft") || world.keys.has("a") || world.touchDirs.has("left")) dx -= speed;
  if (world.keys.has("arrowright") || world.keys.has("d") || world.touchDirs.has("right")) dx += speed;

  return { dx, dy };
}

function tryAreaTransition() {
  if (world.transitionLock || world.encounter) return;
  const area = currentArea();
  const exits = area.exits || {};
  const xPercent = (world.x / WORLD_WIDTH) * 100;
  const yPercent = (world.y / WORLD_HEIGHT) * 100;

  const candidates = Object.entries(exits);
  for (const [edge, exit] of candidates) {
    if (!exit?.to) continue;

    const [laneMin, laneMax] = exit.lane || [0, 100];
    const inLane = edge === "north" || edge === "south"
      ? xPercent >= laneMin && xPercent <= laneMax
      : yPercent >= laneMin && yPercent <= laneMax;

    if (!inLane) continue;

    const touchedEdge =
      (edge === "north" && world.y <= EDGE_BUFFER) ||
      (edge === "south" && world.y >= WORLD_HEIGHT - EDGE_BUFFER) ||
      (edge === "west" && world.x <= EDGE_BUFFER) ||
      (edge === "east" && world.x >= WORLD_WIDTH - EDGE_BUFFER);

    if (!touchedEdge) continue;

    world.transitionLock = true;
    switchArea(exit.to, exit.spawn || opposite(edge));
    setTimeout(() => {
      world.transitionLock = false;
    }, 320);
    return;
  }
}

function switchArea(nextAreaId, spawnEdge) {
  world.areaId = normalizeArea(nextAreaId);

  if (spawnEdge === "north") {
    world.y = EDGE_BUFFER + 18;
    world.x = WORLD_WIDTH / 2;
  }
  if (spawnEdge === "south") {
    world.y = WORLD_HEIGHT - EDGE_BUFFER - 18;
    world.x = WORLD_WIDTH / 2;
  }
  if (spawnEdge === "west") {
    world.x = EDGE_BUFFER + 18;
    world.y = WORLD_HEIGHT / 2;
  }
  if (spawnEdge === "east") {
    world.x = WORLD_WIDTH - EDGE_BUFFER - 18;
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

  const sceneMount = byId("map-scene");
  sceneMount.className = `gp-map-scene scene-${safeText(area.scene)}`;
  sceneMount.innerHTML = (area.props || []).map((item) => {
    const style = item.x != null
      ? `style="left:${Number(item.x)}%;top:${Number(item.y)}%;width:${Number(item.w)}%;height:${Number(item.h)}%;"`
      : "";
    return `<div class="${safeText(item.cls)}" ${style}>${item.label ? `<span>${safeText(item.label)}</span>` : ""}</div>`;
  }).join("");

  const exitsMount = byId("map-exits");
  exitsMount.innerHTML = Object.entries(area.exits || {}).map(([dir, exit]) => exitMarkerMarkup(dir, exit)).join("");
}

function exitMarkerMarkup(dir, exit) {
  const [start, end] = exit.lane || [36, 64];
  const laneSize = Math.max(8, end - start);
  const style = {
    north: `left:${start}%;top:0%;width:${laneSize}%;height:6%;`,
    south: `left:${start}%;top:94%;width:${laneSize}%;height:6%;`,
    west: `left:0%;top:${start}%;width:6%;height:${laneSize}%;`,
    east: `left:94%;top:${start}%;width:6%;height:${laneSize}%;`
  }[dir] || "";

  return `
    <div class="gp-exit-marker gp-exit-${dir}" style="${style}" title="${safeText(exit.label || exit.to)}">
      <span>${safeText(exit.label || dir)}</span>
    </div>
  `;
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
  if (!initial) byId("overworld-hint").textContent = area.safe ? "Safe district. Use marked exits to travel." : "Wild route. Encounter overlays can trigger anytime.";
}

function showAreaBanner(name, subtitle) {
  const banner = byId("area-banner");
  banner.innerHTML = `<strong>Entered ${safeText(name)}</strong><span>${safeText(subtitle)}</span>`;
  banner.classList.remove("hidden");
  setTimeout(() => banner.classList.add("hidden"), 1900);
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
  byId("encounter-paused-note").textContent = "Movement paused during encounter";
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
  byId("encounter-paused-note").textContent = "Movement active";
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
