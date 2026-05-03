# Orbitling Creature System

## Orbitling Definition

An **Orbitling** is a small alien companion the player raises over time. Orbitlings have mutable needs, personality expression through behavior, and progression driven by care, routine, and event participation.

Orbitlings should feel responsive rather than scripted: player interaction, environment context, and current internal state all influence what they do next.

## First Prototype Stats

Initial stats for the first prototype:

- **Speed** - influences movement performance and race potential.
- **Bond** - reflects trust/connection with the player and affects responsiveness.
- **Mood** - represents emotional state and behavior positivity.
- **Hunger** - indicates feeding need; high hunger can reduce mood and performance.

## Future Stats (Post-Prototype)

Potential additional stats for later phases:

- Stamina
- Focus
- Confidence
- Curiosity
- Resilience
- Agility

These should be added only when needed by concrete gameplay loops.

## First Behaviours

The first behavior set:

- **Wander** - idle roaming with lightweight variation.
- **FollowPlayer** - move toward and loosely track player position.
- **SeekFood** - path toward known/visible food source.
- **Eat** - consume food and resolve hunger state change.
- **Sleep** - recover and stabilize mood/energy context.
- **ReactToPlayer** - short interaction response (emote/motion/state shift).

## Simple State Machine Plan

Use a simple finite state machine (FSM) per Orbitling:

- One active state at a time.
- States expose `enter`, `update`, and `exit` behavior hooks.
- Transitions are condition-driven (needs, proximity, interaction, timers).

Example transition ideas:

- Wander -> SeekFood when Hunger crosses threshold and food is available.
- SeekFood -> Eat when close enough to target food.
- Eat -> Wander after hunger reduced.
- Wander -> FollowPlayer when player calls/interacts.
- Any state -> Sleep when rest condition is met and no urgent override exists.
- ReactToPlayer can temporarily interrupt and return to prior state.

Design notes:

- Keep transition rules data-driven where practical.
- Avoid tying behavior logic to a single map/event type.
- Ensure behavior state can be serialized later for save/load and co-op sync support.
