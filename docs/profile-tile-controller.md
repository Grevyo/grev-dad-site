# Controller-first profile tile editing

`public/profile-tile-controller.js` adds a grid-cursor editing mode alongside the existing mouse
drag in `profile.js`, driven by the same five actions Grev Home's `ProfileTileGridEditor.cs` uses
(`up`/`down`/`left`/`right`, `accept`, `back`), so moving a tile means the same thing and follows
the same rules on both platforms:

```text
Browsing:  arrow keys / D-Pad move a cursor over the grid. Accept (Enter/Space or A) on an
           occupied cell picks that tile up.
Holding:   arrow keys / D-Pad move the held tile one cell at a time; a move that would overlap
           another tile or leave the grid is rejected and the tile stays put. Accept drops it.
           Back (Escape or B) cancels and restores its original position. R / X starts resizing.
Resizing:  arrow keys / D-Pad change width/height one cell at a time, clamped the same way the
           mouse resize handle already is. Accept confirms, Back reverts.
```

It reuses `profile.js`'s own grid rules (`PROFILE_COLUMNS`, `validProfilePlacement`,
`tileOverlaps`, `firstFreeProfilePlacement`) rather than redefining them, and calls the existing
`renderProfileGrid`/`profileEditorMessage` to draw itself - "valid layout" and "how a tile renders"
both still live in exactly one place.

## Two input paths, one action set

- **Keyboard**: a `keydown` listener maps arrow keys/Enter/Space/Escape/R directly to the five
  actions. It backs off when focus is inside a text input, textarea, select or contenteditable
  element so typing a tile's title still works normally.
- **Gamepad**: the browser's Gamepad API has no button-press *event* - `navigator.getGamepads()`
  only reports current state - so this polls it once per animation frame and edge-detects each
  transition into "pressed" itself (a still-held button must not repeat-fire every frame). D-Pad
  and the left stick both map to the same up/down/left/right actions; button 0 (A) is accept,
  button 1 (B) is back, button 2 (X) starts resizing. Standard-mapping gamepad button indices only
  (`pad.mapping === 'standard'` is the common case); an unusual controller's face buttons may not
  line up until it's tested against a real pad, since this repo has no way to attach a physical
  controller to verify.

Both paths funnel into the same `handleAction(action)`, so this genuinely is one interaction model
with two input adapters, not two separate implementations that happen to agree today.

## What this does not cover yet

- The "add a tile" flow still requires the mouse-driven catalogue - Accept on an empty grid cell
  intentionally no-ops so a future controller-friendly picker can own that instead of this file
  guessing what should appear (same boundary `ProfileTileGridEditor.cs` draws on the Grev Home
  side).
- No on-screen button glyphs/prompts (a fixed "Accept" hint always reads as a keyboard action even
  hooked up to a gamepad); a real prompt bar showing the connected controller's actual button icons
  is future work, not part of this change.
- Not tested against a physical gamepad in this environment - the button/axis mapping follows the
  W3C Gamepad "standard" layout but should be confirmed on real hardware before relying on it.
