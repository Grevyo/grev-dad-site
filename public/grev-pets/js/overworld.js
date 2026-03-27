import { api, byId, requireAuthOrRedirect, safeText } from "./api.js";
import { renderPet, rarityClass } from "./pet-renderer.js";

const world = {
  x: 220,
  y: 240,
  zone: "town_hub",
  encounter: null,
  keys: new Set(),
  others: new Map()
};

const zoneBounds = [
  { zone: "town_hub", x: 3, y: 6, w: 29, h: 34 },
  { zone: "stable_square", x: 35, y: 6, w: 26, h: 24 },
  { zone: "event_gate", x: 65, y: 6, w: 30, h: 25 },
  { zone: "wild_scrapyard", x: 4, y: 45, w: 42, h: 45 },
  { zone: "wild_neon_abyss", x: 49, y: 37, w: 25, h: 54 },
  { zone: "wild_mushroom_ruins", x: 76, y: 34, w: 20, h: 56 }
];

let animationHandle = null;
let presenceTimer = null;
let encounterTimer = null;
let idleBob = 0;

async function boot() {
  try {
    await requireAuthOrRedirect();
    const me = await api("/api/grev-pets/me");
    world.x = me.profile.pos_x || 220;
    world.y = me.profile.pos_y || 240;
    world.zone = me.profile.zone || "town_hub";
    placeAvatar();
    setupControls();
    startLoop();
    startPresence();
    startEncounterChecks();
    log(`Entered overworld at ${world.zone}.`);
  } catch (error) {
    log(error.message);
  }
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

  const overworld = byId("overworld");
  overworld.addEventListener("click", (event) => {
    const rect = overworld.getBoundingClientRect();
    world.x = ((event.clientX - rect.left) / rect.width) * 900;
    world.y = ((event.clientY - rect.top) / rect.height) * 580;
    placeAvatar();
  });

  byId("btn-weaken").addEventListener("click", () => captureAction("toss", true));
  byId("btn-capture").addEventListener("click", () => captureAction("toss", false));
  byId("btn-lure").addEventListener("click", () => captureAction("snack-lure", false));
}

function startLoop() {
  const step = () => {
    const speed = 3.2;
    if (world.keys.has("arrowup") || world.keys.has("w")) world.y -= speed;
    if (world.keys.has("arrowdown") || world.keys.has("s")) world.y += speed;
    if (world.keys.has("arrowleft") || world.keys.has("a")) world.x -= speed;
    if (world.keys.has("arrowright") || world.keys.has("d")) world.x += speed;

    world.x = Math.max(8, Math.min(892, world.x));
    world.y = Math.max(8, Math.min(572, world.y));

    const zone = detectZone(world.x, world.y);
    if (zone !== world.zone) {
      world.zone = zone;
      byId("zone-label").textContent = `Zone: ${zone}`;
      log(`Moved into ${zone}.`);
    }

    placeAvatar();
    animationHandle = requestAnimationFrame(step);
  };

  step();
}

function placeAvatar() {
  const avatar = byId("player-avatar");
  const overworld = byId("overworld");
  const rect = overworld.getBoundingClientRect();
  const percentX = (world.x / 900) * 100;
  const percentY = (world.y / 580) * 100;
  avatar.style.left = `${percentX}%`;
  avatar.style.top = `${percentY}%`;
}

function detectZone(x, y) {
  const px = (x / 900) * 100;
  const py = (y / 580) * 100;
  const found = zoneBounds.find((z) => px >= z.x && px <= (z.x + z.w) && py >= z.y && py <= (z.y + z.h));
  return found ? found.zone : "town_hub";
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
    item.dot.remove();
    item.label.remove();
  });
  world.others.clear();

  players.forEach((player) => {
    const dot = document.createElement("div");
    dot.className = "gp-other";
    dot.style.left = `${(Number(player.pos_x || 0) / 900) * 100}%`;
    dot.style.top = `${(Number(player.pos_y || 0) / 580) * 100}%`;

    const label = document.createElement("div");
    label.className = "gp-name-tag";
    label.textContent = safeText(player.username);
    label.style.left = dot.style.left;
    label.style.top = dot.style.top;

    map.appendChild(dot);
    map.appendChild(label);
    world.others.set(player.user_id, { dot, label });
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
        log(`A wild ${data.encounter.wildPet.name} appeared in ${world.zone}!`);
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
    <p class="gp-small">HP: <span id="wild-hp">${world.encounter.wildCurrentHp}</span> / ${wild.stats.health}</p>
  `;

  const canvas = byId("encounter-pet");
  const loop = () => {
    if (!world.encounter || !canvas.isConnected) return;
    idleBob += 0.08;
    renderPet(canvas, wild.traits, { bob: idleBob });
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
  const p = document.createElement("p");
  p.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  mount.prepend(p);
}

window.addEventListener("beforeunload", () => {
  if (animationHandle) cancelAnimationFrame(animationHandle);
  if (presenceTimer) clearInterval(presenceTimer);
  if (encounterTimer) clearInterval(encounterTimer);
});

boot();
