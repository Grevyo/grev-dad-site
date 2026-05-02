const fartButton = document.getElementById("digital-finger-btn");
const feedback = document.getElementById("azzbuh-feedback");

// Drop your audio files into: /public/playground/azzbuh-mode/assets/audio/
// Expected filenames (edit this list if you want more):
//  - fart-1.mp3
//  - fart-2.mp3
//  - fart-3.mp3
//  - fart-4.mp3
const fartSoundPaths = [
  "/playground/azzbuh-mode/assets/audio/fart-1.mp3",
  "/playground/azzbuh-mode/assets/audio/fart-2.mp3",
  "/playground/azzbuh-mode/assets/audio/fart-3.mp3",
  "/playground/azzbuh-mode/assets/audio/fart-4.mp3",
];

const fartPlayers = fartSoundPaths.map((src) => {
  const audio = new Audio(src);
  audio.preload = "auto";
  return audio;
});

const celebrationLines = [
  "Toot toot. Mission accomplished.",
  "That one rattled the digital trees.",
  "Certified Grade-A cyber-fog.",
  "Azzbuh Mode: engaged and gassy.",
  "Somewhere, a unicycle lost balance.",
];

function chooseRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function setFeedback(message, muted = false) {
  feedback.textContent = message;
  feedback.classList.toggle("is-muted", muted);
}

async function playRandomFart() {
  const randomAudio = chooseRandom(fartPlayers);
  randomAudio.currentTime = 0;

  try {
    await randomAudio.play();
    setFeedback(chooseRandom(celebrationLines));
  } catch {
    setFeedback("No fart files found yet. Drop audio files into /playground/azzbuh-mode/assets/audio/ 💨", true);
  }
}

fartButton?.addEventListener("click", async () => {
  fartButton.classList.add("is-fired");
  window.setTimeout(() => fartButton.classList.remove("is-fired"), 160);
  await playRandomFart();
});
