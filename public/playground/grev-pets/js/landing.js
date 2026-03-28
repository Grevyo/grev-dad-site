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
  const data = await api("/api/playground/grev-pets/me");
  profileData = data;
  avatarDraft = { ...(data.profile.avatar || {}) };

  renderProfileSummary(data);
  renderActivePet(data);
  renderTeamPanel(data.featured_pets || [], data.profile.active_pet_id);
  renderStoragePanel(data.featured_pets || [], data.pet_count || 0);
  renderProgressPanel(data.profile);
  renderRecentPanel(data);
  renderStarterOptions(data);
  renderStarterClaimedCard(data);
  renderAvatarEditor(data.avatar_options || {}, avatarDraft);
}

function renderProfileSummary(data) {
  const profile = data.profile;
  const summary = byId("profile-summary");
  const readiness = profile.active_pet ? "Companion Linked" : "Pet Link Pending";

  summary.innerHTML = `
    <div class="gp-trainer-panel-head">
      <p class="gp-small">Trainer Signal</p>
      <span class="gp-home-tag">${safeText(profile.zone)}</span>
    </div>
    <div class="gp-profile-top gp-trainer-identity">
      <div id="hero-avatar"></div>
      <div class="gp-trainer-copy">
        <h2>${safeText(profile.username)}</h2>
        <p class="gp-small">${safeText(profile.title || "Rookie Wrangler")}</p>
        <p class="gp-small">Rank ${Number(profile.trainer_level || 1)} • ${safeText(readiness)}</p>
      </div>
    </div>
    <div class="gp-stats-grid gp-trainer-stat-grid">
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
  const readiness = activePet ? "Garden bond active" : "Welcome a companion";

  mount.innerHTML = `
    <div class="gp-active-topline">
      <p class="gp-kicker">Companion Garden</p>
      <span class="gp-home-tag">${safeText(readiness)}</span>
    </div>
    ${activePet
      ? `<div class="gp-active-feature-grid">
          <div class="gp-pet-stage">
            <div class="gp-pet-stage-glow"></div>
            <canvas id="active-pet-canvas" class="gp-pet-canvas gp-pet-canvas-stage" width="500" height="280"></canvas>
          </div>
          <div class="gp-active-meta">
            <h2>${safeText(activePet.name)}</h2>
            <p class="gp-small">Lv ${activePet.level} • ${safeText(activePet.species)}</p>
            <div class="gp-active-chip-row">${typeBadgePair(activePet.primaryType, activePet.secondaryType)}</div>
            <p class="gp-small">Mood: Bright-eyed • Bond: Cozy • Energy: Ready for a short route walk.</p>
            <p class="gp-small">Spend time feeding, grooming, and playing so your partner grows before tougher zones.</p>
            <div class="gp-actions gp-active-actions">
              <a class="btn btn-primary" href="/playground/grev-pets/overworld.html">Walk in Overworld</a>
              <a class="btn" href="/playground/grev-pets/pet.html?petId=${encodeURIComponent(activePet.petId)}">Pet Habitat View</a>
              <a class="btn" href="/playground/grev-pets/stable.html">Rest / Switch Companion</a>
            </div>
          </div>
        </div>`
      : `<div class="gp-active-empty">
          <h2>No Active Companion</h2>
          <p class="gp-small">Adopt your first companion to unlock the habitat and route exploration flow.</p>
          <a class="btn btn-primary" href="/playground/grev-pets/stable.html">Choose from Stable</a>
        </div>`}
  `;

  if (activePet) animatePetCanvas("active-pet-canvas", activePet);
}

function renderTeamPanel(pets, activePetId) {
  const mount = byId("team-panel");
  const team = pets.slice(0, 4);
  mount.innerHTML = `
    <div class="gp-section-head">
      <h2>Current Team</h2>
      <a class="btn" href="/playground/grev-pets/overworld.html">Deploy</a>
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
      <div class="gp-team-item-main">
        <strong>${safeText(pet.name)}</strong>
        <p class="gp-small">Lv ${pet.level} · ${safeText(pet.species)}</p>
      </div>
      <div class="gp-team-types">${typeBadgePair(pet.primaryType, pet.secondaryType)}</div>
    </div>
  `).join("");
}

function renderStoragePanel(pets, count) {
  const recent = pets.slice(0, 3);
  byId("storage-panel").innerHTML = `
    <div class="gp-section-head">
      <h2>Stable Vault</h2>
      <a class="btn btn-primary" href="/playground/grev-pets/stable.html">Open Stable</a>
    </div>
    <p class="gp-small">Total Stored: <strong>${count}</strong></p>
    <div class="gp-recent-captures">
      ${recent.length
        ? recent.map((pet) => `<p><span>${safeText(pet.name)}</span> <span class="gp-pill ${rarityClass(pet.rarity)}">${safeText(pet.rarity)}</span></p>`).join("")
        : "<p class='gp-small'>No pets in storage yet.</p>"}
    </div>
  `;
}

function renderProgressPanel(profile) {
  byId("progress-panel").innerHTML = `
    <div class="gp-section-head">
      <h2>Quick Actions</h2>
      <a class="btn" href="/playground/grev-pets/event-room.html">Events</a>
    </div>
    <div class="gp-actions gp-action-buttons">
      <a class="btn btn-primary" href="/playground/grev-pets/overworld.html">Resume Overworld</a>
      <a class="btn" href="/playground/grev-pets/stable.html">Manage Team</a>
      <a class="btn" href="/playground/grev-pets/event-room.html">Run Event Match</a>
    </div>
    <div class="gp-stats-grid gp-stats-grid-2 gp-action-meta">
      <div class="gp-stat-block"><h3>Favorite Type</h3><p>${safeText(profile.favorite_type || "Unpicked")}</p></div>
      <div class="gp-stat-block"><h3>Last Area</h3><p>${safeText(profile.zone)}</p></div>
    </div>
  `;
}

function renderRecentPanel(data) {
  const mount = byId("recent-panel");
  const activePet = data.profile.active_pet;
  mount.innerHTML = `
    <div class="gp-section-head">
      <h2>Area + Mission Status</h2>
      <a class="btn" href="/playground/grev-pets/event-room.html">Open Event Plaza</a>
    </div>
    <div class="gp-home-status-grid">
      <div class="gp-stat-block">
        <h3>Last Visited Area</h3>
        <p>${safeText(data.profile.zone)}</p>
      </div>
      <div class="gp-stat-block">
        <h3>Explorer Readiness</h3>
        <p>${activePet ? "Team Ready" : "Select Active Pet"}</p>
      </div>
      <div class="gp-stat-block">
        <h3>Starter Status</h3>
        <p>${data.profile.starter_claimed ? "Starter Claimed" : "Starter Pending"}</p>
      </div>
      <div class="gp-stat-block">
        <h3>Recommended Next Step</h3>
        <p>${activePet ? "Resume Overworld" : "Open Storage"}</p>
      </div>
    </div>
    <p class="gp-small">Mission board updates when your active companion, area progression, or event rotation changes.</p>
  `;
}

function renderStarterOptions(data) {
  const section = byId("starter-flow-card");
  const mount = byId("starter-options");
  const claimed = data.profile.starter_claimed;
  const options = data.starter_options || [];

  section.classList.toggle("hidden", claimed);
  if (claimed) {
    mount.innerHTML = "";
    byId("starter-status").textContent = "Starter already claimed. Home base now focuses on your active team.";
    return;
  }

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

  byId("starter-status").textContent = "Pick one starter to begin your run.";

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
        await api("/api/playground/grev-pets/starter", {
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

function renderStarterClaimedCard(data) {
  const card = byId("starter-claimed-card");
  const activePet = data.profile.active_pet;
  const starterPet = data.featured_pets?.find((pet) => pet.petId === data.profile.starter_pet_id) || activePet;
  if (!data.profile.starter_claimed) {
    card.classList.add("hidden");
    card.innerHTML = "";
    return;
  }

  card.classList.remove("hidden");
  card.innerHTML = `
    <div class="gp-section-head">
      <h2>Your First Partner</h2>
      <span class="gp-pill">Starter Claimed</span>
    </div>
    <p class="gp-small">${starterPet ? `${safeText(starterPet.name)} is part of your roster.` : "Starter is secured in your roster."}</p>
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
      await api("/api/playground/grev-pets/profile", {
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
