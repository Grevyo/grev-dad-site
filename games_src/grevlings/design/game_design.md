# Grevlings - Game Design Overview

## Working Title

**Grevlings**

## Core Pillars

1. **Creature Care with Personality**  
   Orbitlings feel alive through needs, moods, and reactions.
2. **Cosy Progression**  
   Growth comes from consistent care, bonding, and gentle goals.
3. **Planetary Wonder**  
   The universe expands from a calm home planet to varied destination planets.
4. **Flexible Event Framework**  
   Races, battles, and contests all run on the same participant-slot architecture.
5. **Solo-First, Co-op-Ready**  
   Initial implementation is local solo play, with future-ready data and logic boundaries.

## Main Game Loop

1. Hatch or adopt an Orbitling.
2. Observe current needs (Hunger, Mood, Bond, energy context).
3. Perform care actions (feed, interact, train, rest).
4. Orbitling behavior updates based on state and environment.
5. Enter events (race, battle, contest) for rewards and progression.
6. Return to home planet to recover, decorate, and continue raising.
7. Unlock access to new planets and event categories over time.

## First Prototype Scope

The first playable prototype should focus on:

- One home planet sandbox area.
- One Orbitling at a time (minimum viable creature loop).
- Core needs/stat updates for Speed, Bond, Mood, Hunger.
- Basic behavior state machine (wander/follow/seek food/eat/sleep/react).
- One simple event prototype: **Moon Sprint** race.
- Local desktop build workflow only.

Out of scope for this phase:

- Networking and live co-op.
- Web export pipeline.
- Large content breadth (many planets/items/species).

## Future Planet Types

Potential future planet archetypes:

- **Verdant Garden Moon** - calm, fertile, food-rich beginner zone.
- **Crystal Dune World** - open terrain with speed-focused race routes.
- **Low-Gravity Ring Habitat** - floaty traversal and aerial contest emphasis.
- **Ashlight Forge Planet** - harsh biomes, endurance-focused challenges.
- **Biolumina Night Planet** - mood/behavior modifiers tied to light cycles.

## Future Event Ideas

### Race Events

- Moon Sprint (starter race)
- Ring Relay
- Meteor Weave Time Trial

### Battle Events (non-lethal competitive)

- Pulse Clash (timed skill exchanges)
- Orbit Arena Skirmish (score-based rounds)
- Guard Core Defense (protect objective under pressure)

### Non-Combat Events

- Harmony Showcase (bond/mood expression judging)
- Forage Dash (resource collection under time limit)
- Resonance Puzzle Trials (cooperative or solo behavior command tasks)
