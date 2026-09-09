# Controller-only profile tile creation

The profile tile grid now treats **Accept on an empty cell** as the controller equivalent of opening the mouse/touch tile catalogue.

- D-Pad / left stick: move the grid cursor while browsing.
- A / Enter on an occupied cell: pick the tile up.
- A / Enter on an empty cell: open the tile-type picker.
- D-Pad / arrow keys while choosing: cycle Text, Link, Picture / GIF and Stat.
- A / Enter: create the selected tile at the cursor when it fits, otherwise use the same first-free placement returned by `profileTileDefaults`.
- B / Escape: cancel the picker.
- X / R while holding a tile: resize.

The controller path calls `profileTileDefaults` and `validProfilePlacement` from `public/profile.js`; it does not duplicate the profile tile defaults or grid rules.

`npm run verify:profile-tiles` includes a headless controller regression that verifies the empty-cell picker, cursor placement and the 40-tile ceiling.
