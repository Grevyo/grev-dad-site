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

## Next planned step

- Add a simple **food interaction loop** (spawn + seek/eat response), while keeping scope prototype-sized.
