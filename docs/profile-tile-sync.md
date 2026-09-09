# Grev Home &lt;-&gt; grev.dad profile tile sync

`GET`/`PUT /api/grev-home/profile-tiles` (in `src/grev-home-sync.ts`) is a device-authenticated
(Bearer token, same as the rest of `/api/grev-home/*`) mirror of the session-authenticated tile
editor at `/api/profile/tiles`, scoped by `userId` rather than a browser cookie. It's the one path
Grev Home uses to read and write a profile's tile layout in D1.

Both directions run the exact same validation as the web editor - `getProfileTilesForSync` and
`saveProfileTilesForSync` (`src/profile.ts`) reuse `tileFromInput`/`overlaps`/`tileFromRow`/
`MAX_TILES` directly rather than a second copy of the rules, and are a parallel read/write path
scoped to `user_profile_tiles` only (not a refactor of `saveProfile`, which also touches the card
and preferences) so this can't regress the existing editor.

## Conflict policy: last-write-wins by timestamp

`GET` returns `updatedAt`: `MAX(user_profile_tiles.updated_at)` for that user, or `0` when they have
no tiles at all. `PUT` sets every tile's `updated_at` to the save time and returns that as
`updatedAt`.

Grev Home compares this against its own local `ProfileTileLayout.UpdatedAtUtc`
(`GrevDadProfileSyncService.SyncProfileTilesAsync`, C# side):

- remote `updatedAt` > local -> **pull**: download the cloud layout, convert each tile's
  `backgroundMedia` data URL into a local file, save it as the new local layout with
  `UpdatedAtUtc` set to the cloud timestamp.
- local `UpdatedAtUtc` > remote `updatedAt` -> **push**: convert each tile's local
  `BackgroundMediaFile` into a data URL and `PUT` the layout.
- equal (including both empty) -> no-op.

A fresh Grev Home install has an empty local layout with `UpdatedAtUtc` at the default (unset/zero),
so it always loses to any real cloud layout and pulls it down - this is also how a profile is
restored after reinstalling and re-linking, with no separate "restore" code path to keep in sync
with the normal one.

This is intentionally simple (whichever side saved most recently wins outright, no field-level
merge) rather than trying to merge two conflicting layouts tile-by-tile. A person editing the same
profile from two devices at close to the same moment can lose one side's edit; there is no warning
for that today. A future revision could show "the cloud layout changed since you started editing"
before overwriting, the same way a real-time collaborative editor would - not implemented here.

## Media conversion

grev.dad stores every tile's picture as an inline base64 data URL, like all its other profile
media. Grev Home stores media as local files elsewhere in the app (`DashboardTileOverride.
TileMediaFile`, `ProfilePresentationSettings.BannerImageFile`), and `ProfileTile.
BackgroundMediaFile` follows that same convention rather than carrying a multi-megabyte string
through memory and every local JSON round-trip. The sync client is where the two representations
meet:

- **pull** (cloud -> local): decode the data URL, sniff its extension from the MIME prefix, write
  it under `Profiles/<GrevID>/Presentation/ProfileTiles/Media/`, enforcing the same
  `ProfileTileGrid.MaxBackgroundMediaBytes` (1.4 MB) limit `src/profile.ts` enforces server-side.
- **push** (local -> cloud): read the referenced file and re-encode it as a data URL, reusing
  `ProfileMediaDataUrl` - the same helper already used to share a Grev Home avatar/banner as a data
  URL elsewhere in the app - rather than a second image-encoding implementation.

## What this does not do

- No delta/patch sync - every sync round-trips the *entire* tile layout, not individual tile
  changes. Fine at 40 tiles max; would need rethinking well before that cap grew much larger.
- No background/automatic sync trigger is wired up here - `SyncProfileTilesAsync` is a method
  Grev Home can call (e.g. after the tile editor closes, or alongside `GrevDadProfileSyncService.
  SyncAsync`'s existing progression sync), not a job that runs itself. Wiring that call site in is
  a small remaining step, not a design gap.
