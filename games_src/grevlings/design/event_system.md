# Event System Design (Participant Slots)

## Participant-Slot Architecture

All events in Grevlings should be defined around **participant slots**, not hardcoded roles like "player vs enemy".

A participant slot describes:

- Slot ID/index
- Participant type
- Creature reference
- Optional controller/profile data
- Event-local runtime state (progress, score, status flags)

This structure allows race, battle, and contest events to share core orchestration logic.

## Participant Types

Supported participant types from the start of architecture design:

- `LocalPlayerCreature`
- `CPUCreature`
- `RemotePlayerCreature` (placeholder; not active in prototype)

Even before networking exists, the third type should remain in schemas/interfaces to prevent rewrites later.

## Moon Sprint (First Prototype Event)

**Moon Sprint** is the starter race event.

Initial design:

1. Event instance creates a fixed number of participant slots.
2. Local player Orbitling occupies one slot.
3. Remaining slots are filled by CPU Orbitlings.
4. All participants progress through the same race rules (start, checkpoints, finish).
5. Rankings are computed from shared timing/progress metrics.

Key requirement:

- No rule path should assume only one human-related slot exists forever.

## Why CPU and Future Remote Players Share One Slot Structure

Using one slot model for CPU and remote participants gives major benefits:

- **Consistency:** Event logic reads slot data, not controller origin.
- **Scalability:** Co-op or PvP additions can reuse existing event pipelines.
- **Testability:** CPU can simulate remote-slot flows during offline development.
- **Maintenance:** Fewer branching code paths and less duplicated event logic.

Design principle:

> Event rules should care about participant capabilities and progress data, not whether the driver is local, AI, or remote.
