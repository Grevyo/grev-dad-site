import { api, byId, requireAuthOrRedirect, safeText } from "./api.js";

let pets = [];

async function boot() {
  await requireAuthOrRedirect();
  await loadPets();
  byId("battle-btn").addEventListener("click", () => runEvent("battle"));
  byId("race-btn").addEventListener("click", () => runEvent("race"));
}

async function loadPets() {
  const data = await api("/api/playground/grev-pets/pets");
  pets = data.pets || [];

  const select = byId("pet-select");
  if (!pets.length) {
    select.innerHTML = `<option value="">No pets available</option>`;
    byId("result-headline").textContent = "Catch or claim a pet first.";
    return;
  }

  select.innerHTML = pets.map((pet) => `<option value="${safeText(pet.petId)}">${safeText(pet.name)} (Lv ${pet.level}, ${safeText(pet.rarity)})</option>`).join("");
}

async function runEvent(type) {
  const petId = byId("pet-select").value;
  if (!petId) return;

  try {
    const endpoint = type === "battle" ? "/api/playground/grev-pets/events/battle" : "/api/playground/grev-pets/events/race";
    const data = await api(endpoint, {
      method: "POST",
      body: JSON.stringify({ petId })
    });

    if (type === "battle") {
      renderBattle(data.result, data.pet, data.level_ups || []);
    } else {
      renderRace(data.result, data.pet, data.level_ups || []);
    }
  } catch (error) {
    appendLog(`Error: ${error.message}`);
  }
}

function renderBattle(result, pet, levelUps) {
  byId("result-headline").textContent = result.won
    ? `Victory! ${pet.name} earned ${result.xpGained} XP.`
    : `Defeat, but ${pet.name} still gained ${result.xpGained} XP.`;

  appendLog(`BATTLE ${result.won ? "WIN" : "LOSS"} · Enemy ${result.enemy.name} · XP +${result.xpGained}`);
  (result.log || []).forEach((line) => appendLog(line));
  if (levelUps.length) appendLog(`LEVEL UP x${levelUps.length}!`);
}

function renderRace(result, pet, levelUps) {
  byId("result-headline").textContent = `${pet.name} finished place #${result.placement} and gained ${result.xpGained} XP.`;
  appendLog(`RACE place #${result.placement} · XP +${result.xpGained}`);

  (result.commentary || []).forEach((line) => appendLog(line));
  (result.leaderboard || []).slice(0, 5).forEach((entry, idx) => {
    appendLog(`#${idx + 1}: ${entry.name} (${entry.score})`);
  });
  if (levelUps.length) appendLog(`LEVEL UP x${levelUps.length}!`);
}

function appendLog(text) {
  const mount = byId("event-log");
  const line = document.createElement("p");
  line.textContent = `${new Date().toLocaleTimeString()} · ${text}`;
  mount.prepend(line);
}

boot().catch((error) => {
  byId("result-headline").textContent = safeText(error.message);
});
