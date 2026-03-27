import { api, byId, requireAuthOrRedirect, safeText } from "./api.js";
import { mountAvatar, buildAvatarEditor } from "./avatar-renderer.js";
import { renderPet, rarityClass, typeBadgePair } from "./pet-renderer.js";

let profileData = null;
let avatarDraft = null;

const ZONES = [
  { key: "town_hub", name: "Town Hub", vibe: "Meetups, social vibes, setup checks." },
  { key: "stable_square", name: "Stable Square", vibe: "Trainers swap tips and comps." },
  { key: "event_gate", name: "Event Gate", vibe: "Battle and race queue entry." },
  { key: "wild_scrapyard", name: "Scrapyard Wilds", vibe: "Balanced captures and commons." },
  { key: "wild_neon_abyss", name: "Neon Abyss", vibe: "Glitchy high-variance encounters." },
  { key: "wild_mushroom_ruins", name: "Mushroom Ruins", vibe: "Odd typings and tricksters." }
];

async function boot() {
  try {
    await requireAuthOrRedirect();
    await loadProfile();
    bindUI();
  } catch (error) {
    byId("profile-summary").innerHTML = `<p>${safeText(error.message)}</p>`;
  }
}

async function loadProfile() {
  const data = await api("/api/grev-pets/me");
  profileData = data;
  avatarDraft = { ...(data.profile.avatar || {}) };

  renderProfileSummary(data);
  renderHighValueCards(data);
  renderStarterOptions(data);
  renderFeatured(data.featured_pets || []);
  renderZones();
  renderTypePreview(data.type_dex || []);
  renderProgression(data.profile);
  renderAvatarEditor(data.avatar_options || {}, avatarDraft);

  const starterStatus = byId("starter-status");
  starterStatus.textContent = data.profile.starter_claimed
    ? "Starter locked in. Grow your stable and challenge the event room."
    : "No starter yet — choose one to kick off your story.";
}

function renderProfileSummary(data) {
  const profile = data.profile;
  const summary = byId("profile-summary");
  summary.innerHTML = `
    <div class="gp-profile-top">
      <div id="hero-avatar"></div>
      <div>
        <h2>${safeText(profile.username)}</h2>
        <p class="gp-small">${safeText(profile.title || "Rookie Wrangler")}</p>
        <p class="gp-small">Current zone: ${safeText(profile.zone)}</p>
      </div>
    </div>
    <div class="gp-stats-grid">
      <div class="gp-stat-block"><h3>Trainer Lv</h3><p>${Number(profile.trainer_level || 1)}</p></div>
      <div class="gp-stat-block"><h3>Total Pets</h3><p>${Number(data.pet_count || 0)}</p></div>
      <div class="gp-stat-block"><h3>Fav Type</h3><p>${safeText(profile.favorite_type || "Unpicked")}</p></div>
      <div class="gp-stat-block"><h3>Battle W/L</h3><p>${profile.battle_record?.wins || 0}/${profile.battle_record?.losses || 0}</p></div>
      <div class="gp-stat-block"><h3>Race Wins</h3><p>${profile.race_record?.wins || 0}</p></div>
      <div class="gp-stat-block"><h3>Starter</h3><p>${profile.starter_claimed ? "Claimed" : "Ready"}</p></div>
    </div>
    ${profile.active_pet ? `<div class="gp-active-strip">Active: <strong>${safeText(profile.active_pet.name)}</strong> ${typeBadgePair(profile.active_pet.primaryType, profile.active_pet.secondaryType)}</div>` : `<div class="gp-active-strip">No active pet set yet.</div>`}
  `;
  mountAvatar(byId("hero-avatar"), profile.avatar, { size: "lg", label: "Explorer" });
}

function renderHighValueCards(data) {
  const activePet = data.profile.active_pet;
  const cards = byId("high-value-cards");

  cards.innerHTML = `
    <article class="gp-card gp-feature-card">
      <h3>Active Pet Spotlight</h3>
      ${activePet
        ? `<canvas id="active-spotlight-canvas" class="gp-pet-canvas" width="280" height="180"></canvas>
           <p><strong>${safeText(activePet.name)}</strong> · Lv ${activePet.level} · ${safeText(activePet.species)}</p>
           <p>${typeBadgePair(activePet.primaryType, activePet.secondaryType)}</p>
           <a class="btn" href="/grev-pets/pet.html?petId=${encodeURIComponent(activePet.petId)}">Open Detail Card</a>`
        : `<p>No active pet yet. Claim your starter or pick one from your stable.</p>
           <a class="btn" href="/grev-pets/stable.html">Open Stable</a>`}
    </article>
    <article class="gp-card gp-feature-card">
      <h3>Starter Collection Track</h3>
      <p>Build your first squad around a core role and type spread.</p>
      <ul class="gp-bullet-list">
        <li>Adopt one starter with dual-typing flavor.</li>
        <li>Capture in danger zones to patch team weaknesses.</li>
        <li>Set your active pet before events.</li>
      </ul>
      <a class="btn" href="#starter-flow-card">Choose Starter</a>
    </article>
    <article class="gp-card gp-feature-card">
      <h3>Quick Path</h3>
      <ol class="gp-bullet-list">
        <li>Customize explorer avatar.</li>
        <li>Adopt first Grev Pet.</li>
        <li>Enter overworld and capture.</li>
        <li>Battle and race for progression.</li>
      </ol>
      <div class="gp-actions">
        <a class="btn" href="/grev-pets/overworld.html">Explore</a>
        <a class="btn" href="/grev-pets/event-room.html">Compete</a>
      </div>
    </article>
  `;

  if (activePet) animatePetCanvas("active-spotlight-canvas", activePet);
}

function renderStarterOptions(data) {
  const mount = byId("starter-options");
  const claimed = data.profile.starter_claimed;
  const options = data.starter_options || [];

  mount.innerHTML = options.map((starter, idx) => `
    <article class="gp-card gp-starter-card ${claimed ? "is-locked" : ""}">
      <canvas id="starter-canvas-${idx}" class="gp-pet-canvas" width="260" height="170"></canvas>
      <h3>${safeText(starter.name)}</h3>
      <p>${typeBadgePair(starter.primaryType, starter.secondaryType)}</p>
      <p class="gp-small">${safeText(starter.personality)}</p>
      <p class="gp-small">Role: ${safeText(starter.roleStyle)}</p>
      <div class="gp-actions">
        <button type="button" class="btn btn-primary" data-starter-key="${safeText(starter.key)}" ${claimed ? "disabled" : ""}>Adopt ${safeText(starter.name)}</button>
      </div>
    </article>
  `).join("");

  options.forEach((starter, idx) => {
    const fauxPet = {
      primaryType: starter.primaryType,
      secondaryType: starter.secondaryType,
      traits: {
        bodyShape: starter.key === "mossguard" ? "chonk" : starter.key === "tidaltrick" ? "moth" : "drake",
        widthScale: 1,
        heightScale: 1,
        eyeType: "wide",
        mouthType: "smile",
        earType: "satellite",
        extra: starter.key === "emberling" ? "horn" : "fluff",
        accessory: "bandana",
        patternType: starter.key === "tidaltrick" ? "circuit" : "patch",
        colorPalette: starter.key === "emberling"
          ? { base: "#ff8b47", secondary: "#c23f2d", accent: "#ffd167" }
          : starter.key === "mossguard"
            ? { base: "#72bc6f", secondary: "#458244", accent: "#d9ff93" }
            : { base: "#58c2ff", secondary: "#4769c8", accent: "#ff6cc7" }
      }
    };
    animatePetCanvas(`starter-canvas-${idx}`, fauxPet);
  });

  document.querySelectorAll("[data-starter-key]").forEach((button) => {
    button.addEventListener("click", async () => {
      const key = button.dataset.starterKey;
      byId("starter-status").textContent = `Adopting ${key}...`;
      button.disabled = true;
      try {
        await api("/api/grev-pets/starter", {
          method: "POST",
          body: JSON.stringify({ starterKey: key })
        });
        byId("starter-status").textContent = "Starter adopted! Your profile and stable are updated.";
        await loadProfile();
      } catch (error) {
        byId("starter-status").textContent = safeText(error.message);
        button.disabled = false;
      }
    });
  });
}

function renderFeatured(pets) {
  const mount = byId("featured-pets");
  if (!pets.length) {
    mount.innerHTML = `<p class="gp-small">Your stable is empty. Start with a first adoption above.</p>`;
    return;
  }

  mount.innerHTML = pets.slice(0, 4).map((pet, i) => `
    <article class="gp-card">
      <canvas class="gp-pet-canvas" id="feat-pet-${i}" width="240" height="150"></canvas>
      <h3>${safeText(pet.name)}</h3>
      <p><span class="gp-pill ${rarityClass(pet.rarity)}">${safeText(pet.rarity)}</span> · Lv ${pet.level}</p>
      <p>${typeBadgePair(pet.primaryType, pet.secondaryType)}</p>
      <a class="btn" href="/grev-pets/pet.html?petId=${encodeURIComponent(pet.petId)}">Open Card</a>
    </article>
  `).join("");

  pets.slice(0, 4).forEach((pet, i) => animatePetCanvas(`feat-pet-${i}`, pet));
}

function renderZones() {
  byId("zones-preview").innerHTML = ZONES.map((zone) => `
    <article class="gp-zone-preview">
      <h3>${safeText(zone.name)}</h3>
      <p>${safeText(zone.vibe)}</p>
    </article>
  `).join("");
}

function renderTypePreview(types) {
  byId("type-preview").innerHTML = types.slice(0, 8).map((entry) => `
    <article class="gp-type-card">
      <h3>${typeBadgePair(entry.type, null)}</h3>
      <p class="gp-small">${safeText(entry.flavor)}</p>
      <p class="gp-small">Strong vs: ${safeText((entry.strong || []).slice(0, 2).join(", "))}</p>
    </article>
  `).join("");
}

function renderProgression(profile) {
  byId("progression-summary").innerHTML = `
    <div class="gp-stat-block"><h3>Trainer Level</h3><p>${Number(profile.trainer_level || 1)}</p></div>
    <div class="gp-stat-block"><h3>Battle Wins</h3><p>${profile.battle_record?.wins || 0}</p></div>
    <div class="gp-stat-block"><h3>Race Wins</h3><p>${profile.race_record?.wins || 0}</p></div>
    <div class="gp-stat-block"><h3>Average Race Place</h3><p>${profile.race_record?.places ? (profile.race_record.places / Math.max(1, profile.race_record.wins || 1)).toFixed(1) : "-"}</p></div>
  `;
}

function renderAvatarEditor(options, state) {
  mountAvatar(byId("avatar-preview"), state, { size: "xl", label: "Preview" });
  buildAvatarEditor(byId("avatar-editor-fields"), options, state);

  document.querySelectorAll("[data-avatar-input]").forEach((input) => {
    input.addEventListener("input", () => {
      avatarDraft[input.dataset.avatarInput] = input.value;
      mountAvatar(byId("avatar-preview"), avatarDraft, { size: "xl", label: "Preview" });
    });
  });
}

function bindUI() {
  byId("toggle-avatar-editor").addEventListener("click", () => {
    byId("avatar-edit-shell").classList.toggle("hidden");
  });

  byId("cancel-avatar").addEventListener("click", () => {
    avatarDraft = { ...(profileData?.profile?.avatar || {}) };
    renderAvatarEditor(profileData?.avatar_options || {}, avatarDraft);
    byId("avatar-edit-shell").classList.add("hidden");
  });

  byId("save-avatar").addEventListener("click", async () => {
    try {
      await api("/api/grev-pets/profile", {
        method: "POST",
        body: JSON.stringify({ avatar: avatarDraft })
      });
      byId("starter-status").textContent = "Explorer avatar saved.";
      await loadProfile();
      byId("avatar-edit-shell").classList.add("hidden");
    } catch (error) {
      byId("starter-status").textContent = safeText(error.message);
    }
  });
}

function animatePetCanvas(id, pet) {
  const canvas = byId(id);
  if (!canvas) return;
  let frame = 0;
  const loop = () => {
    frame += 0.08;
    renderPet(canvas, pet.traits, { bob: frame, primaryType: pet.primaryType, rarityColor: pet.rarityColor });
    requestAnimationFrame(loop);
  };
  loop();
}

boot();
