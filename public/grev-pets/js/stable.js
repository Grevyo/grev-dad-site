import { api, byId, requireAuthOrRedirect, safeText } from "./api.js";
import { renderPet, rarityClass } from "./pet-renderer.js";

async function boot() {
  await requireAuthOrRedirect();
  await loadPets();
}

async function loadPets() {
  const data = await api("/api/grev-pets/pets");
  const pets = data.pets || [];
  const mount = byId("stable-grid");

  if (!pets.length) {
    mount.innerHTML = `<article class="gp-card"><h2>No pets yet</h2><p>Go to the overworld and trigger wild encounters in danger zones.</p></article>`;
    return;
  }

  mount.innerHTML = pets.map((pet, idx) => `
    <article class="gp-card">
      <canvas id="stable-canvas-${idx}" class="gp-pet-canvas" width="260" height="170"></canvas>
      <h2>${safeText(pet.name)}</h2>
      <p><span class="gp-pill ${rarityClass(pet.rarity)}">${safeText(pet.rarity)}</span> · Lv ${pet.level} · ${safeText(pet.species)}</p>
      <p class="gp-small">${safeText(pet.temperament)} · Growth: ${safeText(pet.growthBias)}</p>
      <div class="gp-actions">
        <button class="btn" data-active="${safeText(pet.petId)}">Set Active</button>
        <button class="btn" data-favorite="${safeText(pet.petId)}">Set Favorite</button>
        <a class="btn btn-primary" href="/grev-pets/pet.html?petId=${encodeURIComponent(pet.petId)}">View Details</a>
      </div>
    </article>
  `).join("");

  pets.forEach((pet, idx) => {
    const canvas = byId(`stable-canvas-${idx}`);
    let frame = 0;
    const loop = () => {
      frame += 0.07;
      renderPet(canvas, pet.traits, { bob: frame });
      requestAnimationFrame(loop);
    };
    loop();
  });

  document.querySelectorAll("[data-active]").forEach((button) => {
    button.addEventListener("click", async () => {
      await api("/api/grev-pets/active-pet", {
        method: "POST",
        body: JSON.stringify({ petId: button.dataset.active })
      });
      button.textContent = "Active ✓";
    });
  });

  document.querySelectorAll("[data-favorite]").forEach((button) => {
    button.addEventListener("click", async () => {
      await api("/api/grev-pets/active-pet", {
        method: "POST",
        body: JSON.stringify({ petId: button.dataset.favorite, favorite: true })
      });
      button.textContent = "Favorite ★";
    });
  });
}

boot().catch((error) => {
  byId("stable-grid").innerHTML = `<article class="gp-card"><h2>Error</h2><p>${safeText(error.message)}</p></article>`;
});
