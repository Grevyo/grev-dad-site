import { api, byId, requireAuthOrRedirect, safeText } from "./api.js";
import { renderPet, rarityClass, typeBadgePair } from "./pet-renderer.js";

async function boot() {
  await requireAuthOrRedirect();
  const params = new URLSearchParams(window.location.search);
  const petId = params.get("petId");

  if (!petId) {
    byId("pet-card").innerHTML = `<h2>No pet selected</h2><p>Add ?petId=... to the URL.</p>`;
    return;
  }

  const data = await api(`/api/grev-pets/pet?petId=${encodeURIComponent(petId)}`);
  renderPetCard(data.pet);
  renderEvents(data.events || []);
}

function renderPetCard(pet) {
  byId("pet-card").innerHTML = `
    <canvas id="pet-detail-canvas" class="gp-pet-canvas" width="300" height="190"></canvas>
    <h2>${safeText(pet.name)} <span class="gp-pill ${rarityClass(pet.rarity)}">${safeText(pet.rarity)}</span></h2>
    <p>Lv ${pet.level} ${safeText(pet.species)} · ${safeText(pet.temperament)} · Growth ${safeText(pet.growthBias)}</p>
    <p>${typeBadgePair(pet.primaryType, pet.secondaryType)}</p>
    <div class="gp-stats-grid">
      ${Object.entries(pet.stats || {}).map(([k, v]) => `<div class="gp-card"><h3>${safeText(k)}</h3><p>${v}</p></div>`).join("")}
    </div>
    <p class="gp-small">Battle W/L: ${pet.battleRecord?.wins || 0}/${pet.battleRecord?.losses || 0} · Race Wins: ${pet.raceRecord?.wins || 0} · Race Places Sum: ${pet.raceRecord?.places || 0}</p>
  `;

  const canvas = byId("pet-detail-canvas");
  let frame = 0;
  const loop = () => {
    frame += 0.08;
    renderPet(canvas, pet.traits, { bob: frame, primaryType: pet.primaryType });
    requestAnimationFrame(loop);
  };
  loop();
}

function renderEvents(events) {
  const feed = byId("event-feed");
  if (!events.length) {
    feed.innerHTML = `<p>No events yet. Try battles and races in the Event Room.</p>`;
    return;
  }

  feed.innerHTML = events.map((event) => {
    const label = `${event.event_type.toUpperCase()} · ${event.outcome} · +${event.xp_gained} XP`;
    return `<p>${safeText(new Date(event.created_at).toLocaleString())} — ${safeText(label)}</p>`;
  }).join("");
}

boot().catch((error) => {
  byId("pet-card").innerHTML = `<h2>Error</h2><p>${safeText(error.message)}</p>`;
});
