# Grevlings

Grevlings is an original cosy space creature-raising game concept built around caring for and bonding with small alien companions called **Orbitlings**.

## Source Project Structure

The Godot source project lives entirely under:

- `games_src/grevlings/project.godot`
- `games_src/grevlings/scenes/`
- `games_src/grevlings/scripts/`

This keeps gameplay/source files separate from the deployed site files.

## Web Export Preset

The Godot web export preset is defined in:

- `games_src/grevlings/export_presets.cfg`

Preset details:

- **Preset name:** `Web`
- **Target export path:** `../../public/games/grevlings/index.html`
- **Goal:** simple Web export settings for CI validation first
- **Current constraints:** no threaded web requirements and no SharedArrayBuffer dependency added in this step

## GitHub Action (Manual Export)

Workflow file:

- `.github/workflows/export-grevlings-web.yml`

What it does:

1. Runs manually via `workflow_dispatch`.
2. Checks out this repository.
3. Installs Godot 4 headless with export templates.
4. Exports preset `Web` from `games_src/grevlings`.
5. Uploads `public/games/grevlings/` as an artifact.

This workflow is artifact-only for now and does **not** auto-commit exported files.

## Build Output Target

Exported web build target directory:

- `public/games/grevlings`

When integrated, players will open:

- `/games/grevlings/`
