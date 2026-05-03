# Multiplayer Future Notes (Not Implemented Yet)

## Current Status

Multiplayer is **not built in the current phase**.

The project is intentionally solo-first to validate the core creature-raising loop before network complexity is introduced.

## Future Co-op Direction

Planned long-term direction includes co-op-friendly features such as:

- Shared or visitable planet sessions.
- Joining friends for races, contests, and cooperative activities.
- Mixed events containing local, CPU, and remote participant creatures.

## Future Remote Player Creature Slots

Event and roster systems should remain prepared for remote slots:

- `RemotePlayerCreature` should exist as a valid participant type in design now.
- Slot assignment and event setup should be agnostic to controller source.
- UI and result processing should not assume only local+CPU forever.

## Data That Should Stay Multiplayer-Ready

Even during solo prototype work, keep these data shapes future-compatible:

- Creature identity (stable IDs)
- Creature snapshot/state payloads
- Event participant slot records
- Event result records (rank/score/times)
- Planet/session metadata boundaries

This avoids expensive migration when networking is added.

## Warnings Against Local-Player-Only Assumptions

Avoid assumptions like:

- "The player is always slot 0."
- "Only one non-CPU participant can ever exist."
- "UI labels can hardcode player/opponent semantics."
- "Event flow must be local creature vs enemy creature."

Preferred framing:

- Participants occupy typed slots.
- Rules evaluate slot data uniformly.
- Ownership/controller is metadata, not hardwired logic branches.
