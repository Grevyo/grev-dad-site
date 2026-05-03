# Grevlings (Godot 4 Source)

Grevlings is an original cozy creature-care prototype centered on Orbitlings.

## Open in Godot 4

1. Open Godot 4.x.
2. Click **Import**.
3. Select `games_src/grevlings/project.godot`.
4. Import and open the project.

## Run the main scene

- Press **F5** to run the project.
- The configured main scene is: `res://scenes/main/Main.tscn`.

## Controls

- **WASD**: Move player placeholder.

## v0.1 Tiny Home Planet Prototype (expected behavior)

- A tiny home-planet style test arena loads.
- A player placeholder can move with keyboard input.
- One Orbitling placeholder is present.
- Orbitling starts in **Wander** and roams randomly around its home area.
- When the player is close, Orbitling switches to **ReactToPlayer** and faces toward the player.
- A debug UI shows Orbitling stats and current state:
  - Name
  - Speed
  - Bond
  - Mood
  - Hunger
  - Current state

## Exporting a web build with GitHub Actions

The repository includes a manual workflow:

- Workflow file: `.github/workflows/export-grevlings-web.yml`
- Trigger: **workflow_dispatch** (run manually from the GitHub Actions UI)
- Godot project working directory: `games_src/grevlings`
- Export preset used: `Web`
- Export output path: `../../public/games/grevlings/index.html`

### How to run it manually

1. Open the repository on GitHub.
2. Go to **Actions**.
3. Select **Export Grevlings Web**.
4. Click **Run workflow** and confirm.

### Where the build appears

- The workflow uploads an artifact named: `grevlings-web-build`.
- The artifact contents are from: `public/games/grevlings/`.

## Placeholder behavior

`public/games/grevlings/index.html` remains a placeholder in source control until exported web artifacts are intentionally deployed.

## Next planned step

After export stability is confirmed, the next gameplay step is wiring food interaction, save/load, and MoonSprint into one playable prototype flow.
