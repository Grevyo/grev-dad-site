import { api, byId, requireAuthOrRedirect, safeText } from "./api.js";
import { mountAvatar, buildAvatarEditor } from "./avatar-renderer.js";
import { renderPet, rarityClass, typeBadgePair } from "./pet-renderer.js";

let profileData = null;
let avatarDraft = null;

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
  renderActivePet(data);
  renderTeamPanel(data.featured_pets || [], data.profile.active_pet_id);
  renderStoragePanel(data.featured_pets || [], data.pet_count || 0);
  renderProgressPanel(data.profile);
  renderStarterOptions(data);
  renderAvatarEditor(data.avatar_options || {}, avatarDraft);
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
        <p class="gp-small">Current area: ${safeText(profile.zone)}</p>
      </div>
    </div>
    <div class="gp-stats-grid">
      <div class="gp-stat-block"><h3>Trainer Lv</h3><p>${Number(profile.trainer_level || 1)}</p></div>
      <div class="gp-stat-block"><h3>Captured</h3><p>${Number(data.pet_count || 0)}</p></div>
      <div class="gp-stat-block"><h3>Battle W/L</h3><p>${profile.battle_record?.wins || 0}/${profile.battle_record?.losses || 0}</p></div>
      <div class="gp-stat-block"><h3>Race Wins</h3><p>${profile.race_record?.wins || 0}</p></div>
    </div>
  `;

  mountAvatar(byId("hero-avatar"), profile.avatar, { size: "lg", label: "Explorer" });
}

function renderActivePet(data) {
  const activePet = data.profile.active_pet;
  const mount = byId("active-pet-panel");

  mount.innerHTML = `
    <div class="gp-section-head">
      <h2>Active Grev Pet</h2>
      <a class="btn" href="/grev-pets/stable.html">Switch Active</a>
    </div>
    ${activePet
      ? `<canvas id="active-pet-canvas" class="gp-pet-canvas" width="440" height="220"></canvas>
         <p><strong>${safeText(activePet.name)}</strong> · Lv ${activePet.level} · ${safeText(activePet.species)}</p>
         <p>${typeBadgePair(activePet.primaryType, activePet.secondaryType)}</p>
         <div class="gp-actions"><a class="btn" href="/grev-pets/pet.html?petId=${encodeURIComponent(activePet.petId)}">Open Detail Card</a><a class="btn btn-primary" href="/grev-pets/overworld.html">Go Explore</a></div>`
      : `<p>No active pet selected yet.</p><a class="btn btn-primary" href="/grev-pets/stable.html">Choose from Storage</a>`}
  `;

  if (activePet) animatePetCanvas("active-pet-canvas", activePet);
}

function renderTeamPanel(pets, activePetId) {
  const mount = byId("team-panel");
  const team = pets.slice(0, 4);
  mount.innerHTML = `
    <div class="gp-section-head">
      <h2>Current Team</h2>
      <a class="btn" href="/grev-pets/overworld.html">Travel</a>
    </div>
    <div class="gp-team-list" id="team-list"></div>
  `;

  const list = byId("team-list");
  if (!team.length) {
    list.innerHTML = `<p class="gp-small">No captured pets yet.</p>`;
    return;
  }

  list.innerHTML = team.map((pet) => `
    <div class="gp-team-item ${pet.petId === activePetId ? "is-active" : ""}">
      <div>
        <strong>${safeText(pet.name)}</strong>
        <p class="gp-small">Lv ${pet.level} · ${safeText(pet.species)}</p>
      </div>
      <div>${typeBadgePair(pet.primaryType, pet.secondaryType)}</div>
    </div>
  `).join("");
}

function renderStoragePanel(pets, count) {
  const recent = pets.slice(0, 3);
  byId("storage-panel").innerHTML = `
    <div class="gp-section-head">
      <h2>Storage / Stable</h2>
      <a class="btn btn-primary" href="/grev-pets/stable.html">Open Stable</a>
    </div>
    <p class="gp-small">Captured total: <strong>${count}</strong></p>
    <div class="gp-recent-captures">
      ${recent.length
        ? recent.map((pet) => `<p>${safeText(pet.name)} <span class="gp-pill ${rarityClass(pet.rarity)}">${safeText(pet.rarity)}</span></p>`).join("")
        : "<p class='gp-small'>No pets in storage yet.</p>"}
    </div>
  `;
}

function renderProgressPanel(profile) {
  byId("progress-panel").innerHTML = `
    <div class="gp-section-head">
      <h2>Quick Actions</h2>
      <a class="btn" href="/grev-pets/event-room.html">Events</a>
    </div>
    <div class="gp-actions">
      <a class="btn btn-primary" href="/grev-pets/overworld.html">Resume Overworld</a>
      <a class="btn" href="/grev-pets/stable.html">Manage Team</a>
      <a class="btn" href="/grev-pets/event-room.html">Run Event Match</a>
    </div>
    <div class="gp-stats-grid">
      <div class="gp-stat-block"><h3>Favorite Type</h3><p>${safeText(profile.favorite_type || "Unpicked")}</p></div>
      <div class="gp-stat-block"><h3>Starter</h3><p>${profile.starter_claimed ? "Claimed" : "Not Claimed"}</p></div>
      <div class="gp-stat-block"><h3>Last Area</h3><p>${safeText(profile.zone)}</p></div>
      <div class="gp-stat-block"><h3>Status</h3><p>Ready</p></div>
    </div>
  `;
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
      <div class="gp-actions">
        <button type="button" class="btn btn-primary" data-starter-key="${safeText(starter.key)}" ${claimed ? "disabled" : ""}>Adopt</button>
      </div>
    </article>
  `).join("");

  byId("starter-status").textContent = claimed
    ? "Starter already claimed. Build your route team from storage."
    : "Pick one starter to begin your run.";

  options.forEach((starter, idx) => {
    animatePetCanvas(`starter-canvas-${idx}`, {
      primaryType: starter.primaryType,
      secondaryType: starter.secondaryType,
      traits: { bodyShape: "chonk", widthScale: 1, heightScale: 1, eyeType: "wide", mouthType: "smile", earType: "leaf", extra: "fluff", accessory: "bandana", patternType: "patch", colorPalette: { base: "#6aa8ff", secondary: "#4456a1", accent: "#ffcc66" } }
    });
  });

  document.querySelectorAll("[data-starter-key]").forEach((button) => {
    button.addEventListener("click", async () => {
      const key = button.dataset.starterKey;
      button.disabled = true;
      byId("starter-status").textContent = `Adopting ${key}...`;
      try {
        await api("/api/grev-pets/starter", {
          method: "POST",
          body: JSON.stringify({ starterKey: key })
        });
        byId("starter-status").textContent = "Starter adopted.";
        await loadProfile();
      } catch (error) {
        byId("starter-status").textContent = safeText(error.message);
        button.disabled = false;
      }
    });
  });
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
