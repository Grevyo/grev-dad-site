# One profile across grev.dad and Grev Home

A member has one profile. The grev.dad profile page and Grev Home's profile page show the same
identity, the same tile grid and the same live widgets, and either can edit them.

## Identity

`src/profile-identity.ts` holds the shared identity: display name, headline, bio, location,
website, avatar and banner. It lives where the website editor already kept it (`users.display_name`,
`user_profiles`, `user_profile_media`).

- The Grev Home public card (`grev_home_public_cards`) now stores only its display options:
  theme, frame, avatar shape, which stats to show and the status message. Every read of the card
  (`/me`, link status, `/public-card`, friend lists, friend-code lookup) lays the canonical bio,
  headline, avatar and banner over those options.
- Reads apply the owner's field privacy (`user_profile_field_privacy`) for the viewer, so a bio or
  avatar hidden on the website is hidden in Grev Home friends lists too.
- `PUT /api/grev-home/public-card` still accepts `bio`, `avatarMedia` and `coverMedia` from older
  Grev Home builds and writes them to the canonical profile. A 160-character bio that is a prefix
  of a longer canonical bio is ignored, so an old client's truncated copy can't shorten it. The
  headline is never taken from the card.
- `PUT /api/grev-home/profile/identity` is the partial update Grev Home uses now. Only the keys
  sent change, and `null` clears a field. The combined 8 MB profile media budget applies.
- Migration `20261002_unified_profiles.sql` copies existing card bios, avatars and banners into
  empty canonical fields (never replacing website values), then removes the copies from
  `card_json`.

Grev Home keeps a local copy for offline use and syncs it three-way per field: see
`GrevDadIdentitySyncService` in Grev Home.

## Widget tiles

A tile can carry a `widget` and `widgetConfig` (`src/profile-widgets.ts`). Widget tiles are
stored as `tile_type='text'`, so a client that predates widgets shows their title instead of
dropping them. Unknown kinds are rejected on save and read back as plain tiles.

| widget | shows | config |
| --- | --- | --- |
| `recent-games` | last games played in Grev Home, content name first | `count` 1–12 |
| `game-activity` | now playing plus latest sessions | `count` |
| `most-played` | games ranked by play time | `count` |
| `favourite-games` | starred games (`user_favourite_games`) | `count` |
| `best-friends` | up to 12 picked friends with presence (`user_best_friends`) | `count` |
| `bio` | headline and bio | — |
| `stats` | level, XP, play time, sessions, games, achievements | — |
| `achievements` | latest grev.dad achievements | `count` |
| `retroachievements` | points, rank, rich presence and recent unlocks | `count` |

`src/profile-unified.ts` resolves the widgets for a viewer:

- **Owner:** everything, including private sessions.
- **Friend** (`grev_home_friendships`): session widgets show only sessions shared with friends.
- **Other signed-in member** (website only): no session history. Those widgets say
  "friends only" and the rest show.
- **Blocked** either way: the profile is not found.
- Tile privacy still applies. A tile hidden from the viewer is removed and its widget isn't resolved.
- Stats respect the public card's show-level/XP/play-time/sessions choices for everyone but the owner.
- Best friends exclude anyone with a block involving the owner or the viewer, and anyone no
  longer a friend.

## Endpoints

Grev Home (device Bearer token):

- `GET /api/grev-home/profile`: own profile document (identity, tiles with media, preferences,
  presence, card options, resolved `widgets` keyed by tile ID).
- `GET /api/grev-home/profiles/{userId}`: a friend's document. 404 for non-friends and blocks.
- `PUT /api/grev-home/profile/identity`
- `GET/POST/PUT/DELETE /api/grev-home/profile/favourites[/{itemKey}]`: POST adds one (idempotent),
  PUT replaces and reorders, DELETE removes one.
- `GET/POST/PUT/DELETE /api/grev-home/profile/best-friends[/{userId}]`: friends only, at most 12.
  GET also lists the friends that could be picked.
- `GET/PUT/POST/DELETE /api/grev-home/profile/retroachievements`: PUT links a username, POST
  refreshes, DELETE unlinks.

Website (session cookie, same-origin for writes):

- `GET /api/profile/widgets/{userId}`: `{ relationship, isBestFriend, widgets }` for the profile page.
- `/api/profile/favourites`, `/api/profile/best-friends` and `/api/profile/retroachievements`,
  the same as above.

`public/profile-widgets.js` renders widget tiles on the profile page. It adds a Live widgets
section and an Items-shown control to the editor, a panel for favourites, best friends and
RetroAchievements, and a best-friend toggle on friends' profiles.

## RetroAchievements

Set the Web API key as a Worker secret. Members only enter their RetroAchievements username.

```
npx wrangler secret put RETROACHIEVEMENTS_API_KEY            # development
npx wrangler secret put RETROACHIEVEMENTS_API_KEY --env pbe
npx wrangler secret put RETROACHIEVEMENTS_API_KEY --env production
```

- Summaries come from `API_GetUserSummary` and are cached in `user_retroachievements` for 30
  minutes; a failed fetch is retried after 5 minutes.
- Only the fields the widget shows are stored, never the key.
- Without the secret, linking still saves the username and reports `configured: false`.

## Tests

- `npm run verify:profiles` (`scripts/verify-unified-profiles.mjs`) runs every migration into
  SQLite. It covers the migration, the widget contract, relationship rules, privacy, best friends,
  favourites, identity through the public card, and the RetroAchievements cache with a stubbed fetch.
- `npm run e2e:grev-home` has a unified-profile step. It covers widget tiles from Grev Home,
  identity, favourites and best friends, the website showing the same profile, and a website save
  keeping the widgets.
