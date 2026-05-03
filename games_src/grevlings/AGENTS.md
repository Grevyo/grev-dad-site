# AGENTS.md

## Project Rules for Codex Agents

This repository is a **Godot 4 project**.

### Implementation style

- Use readable, maintainable GDScript.
- Keep files small, focused, and organised by system responsibility.
- Prefer clear naming and straightforward control flow over clever abstractions.

### Content and IP safety

- Do **not** use copyrighted Chao/Sonic/SEGA terminology, names, designs, or direct system copies.
- Use original game language (e.g., Orbitlings, planets, events).

### Scope constraints (current phase)

- Do **not** build networking yet.
- Design solo-first systems that can expand later.
- Do **not** hardcode single-player-only event logic.
- All events must use participant slots.

### Event architecture requirement

Event systems should always be built around participant slots that can represent:

- `LocalPlayerCreature`
- `CPUCreature`
- `RemotePlayerCreature` (placeholder for future co-op)

### Task wrap-up requirement

After every task, explain:

1. Which files were changed and why.
2. How to test/validate the change.
3. The next sensible incremental step.
