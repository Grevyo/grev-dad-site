# Grevlings Prototype (Godot 4)

## Controls
- **W/A/S/D**: Move player
- **F**: Spawn/drop food near player
- **F5**: Manual debug save
- **F9**: Manual debug load
- **R**: Start Moon Sprint from HomePlanet
- **Esc**: Return home (from Moon Sprint)

## Gameplay loop (prototype)
1. Spawn into **HomePlanet** with player + Orbitling + Debug UI.
2. Move around and drop food.
3. Orbitling seeks and eats food, changing stats (hunger/mood/bond).
4. Stats and state update live in Debug UI.
5. Save/load Orbitling locally with debug keys.
6. Enter Moon Sprint with **R** and race in 4 participant slots.
7. Return to HomePlanet after race.

## Food usage
- Press **F** to drop a food piece close to the player.
- Orbitling detects nearby food and transitions into **SeekFood**.
- On contact, Orbitling enters **Eat**, consumes food, and updates stats.

## Save / load
- Save file: `user://orbitling_save.json`.
- Loads automatically when HomePlanet starts if a save exists.
- Autosaves every **30 seconds**.
- Manual save/load via **F5/F9**.

Saved fields:
- Orbitling name
- speed
- bond
- mood
- hunger
- position

## Moon Sprint
- Start from HomePlanet with **R**.
- Uses participant slots:
  - Slot 1 = local Orbitling (name/speed loaded from save when available)
  - Slots 2-4 = CPU Orbitlings
- Speed affects race movement and finishing order is shown.
- Press **Esc** or the return button to go back HomePlanet.

## Still placeholder / prototype
- Placeholder shapes and minimal UI.
- Simple state logic and race presentation.
- No account/web integration.
- No multiplayer.
- No advanced evolution systems yet.

## Web Export Deployment
1. Open the GitHub Actions tab and run **Export Grevlings Web** manually.
2. The workflow performs a headless Godot export from `games_src/grevlings` using the `Web` preset.
3. It writes the build directly into `public/games/grevlings/` (including `index.html`) and commits those generated files back to the current branch with the message **Build Grevlings web export**.
4. The workflow also uploads the same files as the **grevlings-web-build** artifact for debugging.
5. Once that commit lands, Cloudflare deploys `/games/grevlings/` from the committed export files.
6. If `/games/grevlings/` still says "Grevlings web build coming soon.", the export workflow has not committed successfully yet.
