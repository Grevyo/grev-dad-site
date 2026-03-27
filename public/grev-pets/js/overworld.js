import { api, byId, requireAuthOrRedirect, safeText } from "./api.js";
import { renderPet, rarityClass, typeBadgePair } from "./pet-renderer.js";
import { avatarMarkup } from "./avatar-renderer.js";

const WORLD_WIDTH = 900;
const WORLD_HEIGHT = 580;
const PLAYER_SIZE = 30;

const world = {
  x: 220,
  y: 240,
  zone: "town_hub",
  encounter: null,
  keys: new Set(),
  others: new Map(),
  avatar: null,
  username: "Explorer",
  activePetName: null,
  facing: "down",
  bob: 0,
  inDanger: false
};

const zoneBounds = [
  { zone: "town_hub", x: 6, y: 12, w: 42, h: 32 },
  { zone: "stable_square", x: 50, y: 8, w: 20, h: 26 },
  { zone: "event_gate", x: 73, y: 8, w: 22, h: 26 },
  { zone: "wild_scrapyard", x: 6, y: 48, w: 43, h: 42 },
  { zone: "wild_neon_abyss", x: 53, y: 41, w: 20, h: 48 },
  { zone: "wild_mushroom_ruins", x: 75, y: 38, w: 20, h: 52 }
];

const blockers = [
  { x: 2, y: 3, w: 18, h: 13 },
  { x: 5, y: 63, w: 14, h: 20 },
  { x: 78, y: 56, w: 18, h: 32 },
  { x: 26, y: 8, w: 20, h: 18 },
  { x: 50, y: 8, w: 20, h: 17 },
  { x: 74, y: 8, w: 21, h: 17 },
  { x: 56, y: 67, w: 15, h: 17 },
  { x: 18, y: 46, w: 2, h: 34 },
  { x: 48, y: 46, w: 2, h: 34 },
  { x: 73, y: 41, w: 2, h: 49 }
];

const zoneMeta = {
  town_hub: {
    name: "Town Hub",
    danger: false,
    hint: "Safe zone. Great place to socialize and prep.",
    objective: "Objective: check signs and head to wild grass for encounters."
  },
  stable_square: {
    name: "Stable Square",
    danger: false,
    hint: "Safe zone near the stable. Manage your lineup here.",
    objective: "Objective: use the stable entrance when you want to swap pets."
  },
  event_gate: {
    name: "Event Gate",
    danger: false,
    hint: "Safe zone near competitive events.",
    objective: "Objective: warm up in wild zones before entering Event Hall."
  },
  wild_scrapyard: {
    name: "Tall Grass Wilds",
    danger: true,
    hint: "Danger zone: encounters can trigger here.",
    objective: "Objective: weaken then capture to build your stable."
  },
  wild_neon_abyss: {
    name: "Neon Rift",
    danger: true,
    hint: "Danger zone: volatile energy attracts rare wild pets.",
    objective: "Objective: use snack lure for better odds in this patch."
  },
  wild_mushroom_ruins: {
    name: "Mushroom Grove",
    danger: true,
    hint: "Danger zone: strange flora hides trickster species.",
    objective: "Objective: scout edges and watch for encounter pings."
  }
};

const interactText = {
  welcome: "🪧 Welcome to Grev Town. Respect trainers, love your pets, stay curious.",
  wilds: "🪧 Wild zone ahead. Bring tame orbs and snacks before entering tall grass.",
  board: "📌 Notice Board: Stable upgrades and seasonal events arriving soon.",
  stable: "🏠 Stable Entrance: Opening stable...",
  event: "🏟️ Event Hall: Entering event room..."
};

let animationHandle = null;
let presenceTimer = null;
let encounterTimer = null;

async function boot() {
  try {
    const user = await requireAuthOrRedirect();
    const me = await api("/api/grev-pets/me");
    world.x = Number(me.profile.pos_x || 220);
    world.y = Number(me.profile.pos_y || 240);
    world.zone = me.profile.zone || "town_hub";
    world.avatar = me.profile.avatar;
    world.username = user?.username || me.profile.username || "Explorer";
    world.activePetName = me.profile.active_pet?.name || null;
    mountPlayerAvatar();
    updateHUDForZone(world.zone, true);
    setupControls();
    bindInteractables();
    startLoop();
    startPresence();
    startEncounterChecks();
    log(`Entered overworld at ${zoneMeta[world.zone]?.name || world.zone}.`);
  } catch (error) {
    log(error.message);
  }
}

function mountPlayerAvatar() {
  const node = byId("player-avatar");
  node.innerHTML = avatarMarkup(world.avatar, { size: "mini" });
  byId("player-name").textContent = safeText(world.username);
  byId("active-pet").textContent = `Active Pet: ${safeText(world.activePetName || "none")}`;
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

  byId("btn-weaken").addEventListener("click", () => captureAction("toss", true));
  byId("btn-capture").addEventListener("click", () => captureAction("toss", false));
  byId("btn-lure").addEventListener("click", () => captureAction("snack-lure", false));
}

function bindInteractables() {
  document.querySelectorAll("[data-interact-id]").forEach((node) => {
    node.addEventListener("click", () => {
      const key = node.dataset.interactId;
      if (!key) return;
      const msg = interactText[key] || "It's decorative for now.";
      log(msg);
      byId("overworld-hint").textContent = msg;
      if (key === "stable") {
        setTimeout(() => {
          window.location.href = "/grev-pets/stable.html";
        }, 260);
      }
      if (key === "event") {
        setTimeout(() => {
          window.location.href = "/grev-pets/event-room.html";
        }, 260);
      }
    });
  });
}

function startLoop() {
  const step = () => {
    const speed = 2.8;
    let dx = 0;
    let dy = 0;

    if (world.keys.has("arrowup") || world.keys.has("w")) dy -= speed;
    if (world.keys.has("arrowdown") || world.keys.has("s")) dy += speed;
    if (world.keys.has("arrowleft") || world.keys.has("a")) dx -= speed;
    if (world.keys.has("arrowright") || world.keys.has("d")) dx += speed;

    if (dx !== 0 || dy !== 0) {
      if (Math.abs(dx) > Math.abs(dy)) {
        world.facing = dx > 0 ? "right" : "left";
      } else {
        world.facing = dy > 0 ? "down" : "up";
      }
      attemptMove(dx, dy);
      world.bob += 0.25;
    } else {
      world.bob += 0.08;
    }

    const zone = detectZone(world.x, world.y);
    if (zone !== world.zone) {
      const previousDanger = Boolean(zoneMeta[world.zone]?.danger);
      world.zone = zone;
      updateHUDForZone(zone);
      const enteredDanger = Boolean(zoneMeta[zone]?.danger) && !previousDanger;
      if (enteredDanger) {
        log(`⚠️ Entered ${zoneMeta[zone]?.name || zone}. Wild encounters can trigger.`);
      } else {
        log(`Moved into ${zoneMeta[zone]?.name || zone}.`);
      }
    }

    placeAvatar();
    animationHandle = requestAnimationFrame(step);
  };

  step();
}

function attemptMove(dx, dy) {
  const targetX = clamp(world.x + dx, PLAYER_SIZE / 2, WORLD_WIDTH - PLAYER_SIZE / 2);
  const targetY = clamp(world.y + dy, PLAYER_SIZE / 2, WORLD_HEIGHT - PLAYER_SIZE / 2);

  if (!hitsBlocker(targetX, world.y)) {
    world.x = targetX;
  }
  if (!hitsBlocker(world.x, targetY)) {
    world.y = targetY;
  }
}

function hitsBlocker(px, py) {
  const p = {
    left: px - PLAYER_SIZE / 2,
    right: px + PLAYER_SIZE / 2,
    top: py - PLAYER_SIZE / 2,
    bottom: py + PLAYER_SIZE / 2
  };

  return blockers.some((block) => {
    const rect = {
      left: (block.x / 100) * WORLD_WIDTH,
      top: (block.y / 100) * WORLD_HEIGHT,
      right: ((block.x + block.w) / 100) * WORLD_WIDTH,
      bottom: ((block.y + block.h) / 100) * WORLD_HEIGHT
    };

    return p.right > rect.left && p.left < rect.right && p.bottom > rect.top && p.top < rect.bottom;
  });
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
  if (avatarEl) {
    avatarEl.dataset.facing = world.facing;
  }
}

function detectZone(x, y) {
  const px = (x / WORLD_WIDTH) * 100;
  const py = (y / WORLD_HEIGHT) * 100;
  const found = zoneBounds.find((z) => px >= z.x && px <= z.x + z.w && py >= z.y && py <= z.y + z.h);
  return found ? found.zone : "town_hub";
}

function updateHUDForZone(zone, initial = false) {
  const meta = zoneMeta[zone] || zoneMeta.town_hub;
  world.inDanger = Boolean(meta.danger);
  byId("zone-label").textContent = `Zone: ${meta.name}`;
  byId("danger-state").textContent = meta.hint;
  byId("objective").textContent = meta.objective;

  const map = byId("overworld");
  map.classList.toggle("is-danger", world.inDanger);

  if (!initial) {
    byId("overworld-hint").textContent = world.inDanger
      ? "You are in a danger zone. Stay alert for wild Grev Pets."
      : "Safe zone. Explore buildings, signs, and town paths.";
  }
}

function startPresence() {
  const sync = async () => {
    try {
      await api("/api/grev-pets/presence", {
        method: "POST",
        body: JSON.stringify({ x: world.x, y: world.y, zone: world.zone })
      });
      const presence = await api(`/api/grev-pets/presence?zone=${encodeURIComponent(world.zone)}`);
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
    const inDanger = world.zone.startsWith("wild_");
    if (!inDanger || world.encounter) return;

    if (Math.random() <= 0.35) {
      try {
        const data = await api("/api/grev-pets/encounter", {
          method: "POST",
          body: JSON.stringify({ zone: world.zone })
        });
        world.encounter = data.encounter;
        showEncounter();
        log(`A wild ${data.encounter.wildPet.name} appeared in ${zoneMeta[world.zone]?.name || world.zone}!`);
      } catch (error) {
        log(error.message);
      }
    }
  };

  encounterTimer = setInterval(tick, 4500);
}

function showEncounter() {
  if (!world.encounter) return;

  const card = byId("encounter-card");
  const wild = world.encounter.wildPet;
  card.classList.remove("hidden");
  card.innerHTML = `
    <canvas id="encounter-pet" class="gp-pet-canvas" width="260" height="170"></canvas>
    <h3>${safeText(wild.name)}</h3>
    <p><span class="gp-pill ${rarityClass(wild.rarity)}">${safeText(wild.rarity)}</span> · Lv ${wild.level} · ${safeText(wild.species)}</p>
    <p>${typeBadgePair(wild.primaryType, wild.secondaryType)}</p>
    <p class="gp-small">HP: <span id="wild-hp">${world.encounter.wildCurrentHp}</span> / ${wild.stats.health}</p>
  `;

  const canvas = byId("encounter-pet");
  let idleBob = 0;
  const loop = () => {
    if (!world.encounter || !canvas.isConnected) return;
    idleBob += 0.08;
    renderPet(canvas, wild.traits, { bob: idleBob, primaryType: wild.primaryType });
    requestAnimationFrame(loop);
  };
  loop();

  byId("encounter-status").textContent = `Encounter active: ${wild.name}.`;
}

async function captureAction(mode, weaken) {
  if (!world.encounter) {
    log("No encounter to interact with.");
    return;
  }

  try {
    const data = await api("/api/grev-pets/capture", {
      method: "POST",
      body: JSON.stringify({ encounterId: world.encounter.encounterId, mode, weaken })
    });

    if (data.captured) {
      log(`🎉 Captured ${data.pet.name}! (roll ${data.roll} vs ${data.chance}%)`);
      byId("encounter-status").textContent = `Captured ${data.pet.name}!`;
      world.encounter = null;
      byId("encounter-card").classList.add("hidden");
      byId("encounter-card").innerHTML = "";
      return;
    }

    if (data.wild_current_hp) {
      world.encounter.wildCurrentHp = data.wild_current_hp;
      const hp = byId("wild-hp");
      if (hp) hp.textContent = String(data.wild_current_hp);
    }

    log(`Capture failed (roll ${data.roll} vs ${data.chance}%). ${weaken ? "You rattled the wild pet." : "Try weakening first."}`);
  } catch (error) {
    log(error.message);
  }
}

function log(message) {
  const mount = byId("overworld-log");
  if (!mount) return;
  const p = document.createElement("p");
  p.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  mount.prepend(p);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

window.addEventListener("beforeunload", () => {
  if (animationHandle) cancelAnimationFrame(animationHandle);
  if (presenceTimer) clearInterval(presenceTimer);
  if (encounterTimer) clearInterval(encounterTimer);
});

boot();
