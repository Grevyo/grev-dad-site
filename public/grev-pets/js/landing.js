import { api, byId, requireAuthOrRedirect, safeText } from "./api.js";
import { renderPet, rarityClass } from "./pet-renderer.js";

async function boot() {
  try {
    await requireAuthOrRedirect();
    await loadProfile();
    setupStarterButtons();
  } catch (error) {
    byId("profile-status").textContent = error.message;
  }
}

async function loadProfile() {
  const data = await api("/api/grev-pets/me");
  byId("profile-status").textContent = `Explorer: ${safeText(data.profile.username)} · Zone: ${safeText(data.profile.zone)}`;

  byId("profile-grid").innerHTML = `
    <div class="gp-card"><h3>Pets Owned</h3><p>${data.pet_count}</p></div>
    <div class="gp-card"><h3>Current Zone</h3><p>${safeText(data.profile.zone)}</p></div>
    <div class="gp-card"><h3>Active Pet</h3><p>${safeText(data.profile.active_pet_id || "Not selected")}</p></div>
  `;

  byId("starter-status").textContent = data.profile.starter_claimed
    ? "Starter already claimed. Go collect more weirdos in danger zones."
    : "Starter available: choose your first little menace.";

  renderFeatured(data.featured_pets || []);
}

function renderFeatured(pets) {
  const mount = byId("featured-pets");
  if (!pets.length) {
    mount.innerHTML = `<p class="gp-small">No pets yet. Claim a starter and head to the wild zones.</p>`;
    return;
  }

  mount.innerHTML = pets.map((pet, i) => `
    <article class="gp-card">
      <canvas class="gp-pet-canvas" id="feat-pet-${i}" width="260" height="170"></canvas>
      <h3>${safeText(pet.name)}</h3>
      <p><span class="gp-pill ${rarityClass(pet.rarity)}">${safeText(pet.rarity)}</span> · Lv ${pet.level} · ${safeText(pet.species)}</p>
      <a class="btn" href="/grev-pets/pet.html?petId=${encodeURIComponent(pet.petId)}">Open Card</a>
    </article>
  `).join("");

  pets.forEach((pet, i) => {
    const canvas = byId(`feat-pet-${i}`);
    let frame = 0;
    const loop = () => {
      frame += 0.08;
      renderPet(canvas, pet.traits, { bob: frame });
      requestAnimationFrame(loop);
    };
    loop();
  });
}

function setupStarterButtons() {
  document.querySelectorAll("[data-archetype]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      byId("starter-status").textContent = "Opening starter crate...";
      try {
        await api("/api/grev-pets/starter", {
          method: "POST",
          body: JSON.stringify({ archetype: button.dataset.archetype })
        });
        byId("starter-status").textContent = "Starter claimed! Check your stable.";
        await loadProfile();
      } catch (error) {
        byId("starter-status").textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });
  });
}

boot();
