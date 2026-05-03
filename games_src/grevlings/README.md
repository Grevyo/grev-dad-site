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
1. Open the GitHub Actions tab and run **Export Grevlings Web** manually (or let it run on pushes that touch `games_src/grevlings/**`).
2. The workflow performs a headless Godot export from `games_src/grevlings` using the `Web` preset.
3. Exported files are written to a temporary build directory and uploaded as the **grevlings-web-build** artifact only.
4. The workflow does **not** commit generated `.wasm`, `.pck`, or `.js` files into `public/games/grevlings/`.
5. This is required because the current Godot web export produces a `.wasm` larger than Cloudflare's **25 MiB per-file static asset limit**.
6. `/games/grevlings/` stays as a placeholder page while browser hosting is being finalized.

## Current hosting constraint
- Cloudflare Workers/Pages static assets reject single files larger than **25 MiB**.
- Current Godot Web export output includes a `.wasm` that exceeds that limit.
- For now, web exports are preserved as CI artifacts rather than committed site assets.

## Next hosting options
1. Reduce the Godot `.wasm` below 25 MiB.
2. Host large Godot files in Cloudflare R2 (or another public bucket/CDN).
3. Use another static host for the game build files.
4. Revisit custom Godot export templates later for better size control.
