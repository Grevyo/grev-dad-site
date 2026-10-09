# Codex Prompt: Add CS2 Match History Connection to grev.dad

You are working in the `grev.dad` website repository.

## Goal

Add a CS2 Match History connection feature using Valve/Steam CS2 match-history authentication codes.

This feature lets a logged-in user privately connect their Steam CS2 match history credentials, then optionally show safe, processed CS2 stats publicly on their public profile/Profile Card.

## Hard constraints

- This is for `grev.dad`.
- Do **not** use Leetify.
- Do **not** use FACEIT.
- Do **not** require demo uploads.
- Do **not** ask users for Steam API keys.
- Do **not** store or expose Steam passwords.
- Use the CS2 match-history auth flow where the user provides:
  1. SteamID64 or Steam profile URL
  2. CS2 Match History Authentication Code
  3. Most recently completed match token / sharing code

## Steam helper link

Show this Steam help link inside the Links section of the Profile Edit screen as a helper/action link:

```text
https://help.steampowered.com/en/wizard/HelpWithGameIssue?appid=730&issueid=128&ref=leetify.com
```

Suggested link text:

```text
Get your CS2 Match History Code from Steam
```

## Core privacy rule

The user's CS2 authentication values are private credentials.

- They must only be visible/editable by the logged-in owner.
- Public stats/data produced from those codes may be shown publicly **only** if the user enables public CS2 stats.
- The auth code, latest match token/sharing code, and private connection values must never appear in public payloads.

## Security requirements

- Store the CS2 auth code and latest match token separately from public profile/settings data.
- Do not include these private fields in any public profile API response.
- Do not include them in member lists.
- Do not include them in Profile Card public payloads.
- Do not include them in admin/user listing responses unless absolutely necessary; preferably never include them there.
- Do not log the auth code, latest match token/sharing code, or SteamID key.
- After saving, the UI must not display the full saved auth code again.
- The logged-in owner can update or disconnect/remove the CS2 connection.
- Add a clear warning that the code gives access to CS2 match history and should be treated privately.

## Suggested database design

Create a private table such as:

```sql
CREATE TABLE IF NOT EXISTS cs2_match_connections (
  user_id TEXT PRIMARY KEY,
  steam_id64 TEXT,
  steam_profile_url TEXT,
  cs2_auth_code TEXT,
  latest_known_share_code TEXT,
  is_enabled INTEGER DEFAULT 1,
  public_stats_enabled INTEGER DEFAULT 1,
  last_checked_at TEXT,
  created_at TEXT,
  updated_at TEXT
);
```

Notes:

- If the project already has an encryption helper, use it for `cs2_auth_code` and `latest_known_share_code`.
- If no encryption helper exists, keep this implementation isolated and ready for future encryption, but do not expose private values anywhere public.
- Prefer keeping this table separate from public profile tables.

Create public/sanitized output tables if useful, for example:

```sql
CREATE TABLE IF NOT EXISTS cs2_public_stats (
  user_id TEXT PRIMARY KEY,
  last_match_map TEXT,
  last_match_result TEXT,
  last_match_score TEXT,
  recent_form TEXT,
  matches_tracked INTEGER,
  last_synced_at TEXT,
  updated_at TEXT
);
```

```sql
CREATE TABLE IF NOT EXISTS cs2_matches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_match_code_hash TEXT,
  map TEXT,
  match_date TEXT,
  team_score INTEGER,
  enemy_score INTEGER,
  result TEXT,
  kills INTEGER,
  deaths INTEGER,
  assists INTEGER,
  kd REAL,
  created_at TEXT
);
```

## Backend requirements

### First scan the repository

Before editing, find and understand:

- Current profile edit page.
- Profile save/load endpoints.
- DB schema and migrations.
- Auth/session helpers.
- Profile Card rendering and public profile API.
- Member list/admin user responses.
- Any existing private secrets/encryption helpers.

### Migration/runtime-safe schema

Add migration and runtime-safe D1 table creation for any new tables.

Requirements:

- Use `CREATE TABLE IF NOT EXISTS` for new tables.
- If adding columns to existing tables, make it runtime safe.
- Preserve existing data.
- Keep changes additive and isolated.

### Owner-only CS2 connection APIs

Add private, owner-only endpoints similar to the following.

#### `GET /api/profile/cs2-connection`

- Requires logged-in session.
- Uses the logged-in user from the session, not a user id supplied by the client.
- Returns safe connection metadata only:
  - whether CS2 is connected
  - SteamID64 and/or profile URL if appropriate
  - masked auth-code status, not the raw code
  - masked latest match token status, not the raw token
  - `public_stats_enabled`
  - `last_checked_at`
- Must **not** return the raw auth code.
- Must **not** return the full latest match token unless there is a compelling reason; prefer masked values only.

#### `POST /api/profile/cs2-connection`

- Requires logged-in session.
- Uses the logged-in user from the session, not a user id supplied by the client.
- Saves/updates:
  - SteamID64/profile URL
  - CS2 auth code
  - latest match token/sharing code
  - `public_stats_enabled`
- Validate input lengths and formats.
- Accept SteamID64 or Steam profile URL according to the UI copy.
- Never log submitted secrets.
- Ensure the user row exists before saving.
- Use a safe insert/update/upsert pattern.
- Carefully verify SQL placeholder counts match values.
- Do not overwrite an existing auth code/token with blank values unless the UI intentionally asks to clear or disconnect.

#### `DELETE /api/profile/cs2-connection`

- Requires logged-in session.
- Uses the logged-in user from the session.
- Deletes private CS2 connection values.
- Optionally deletes public CS2 stats/matches for that user if that fits existing product patterns.
- Returns a safe status only.

#### Optional: `POST /api/profile/cs2-sync`

- Requires logged-in session.
- Uses saved private connection values server-side.
- Later this will call Valve's CS2 match-history method to fetch next match sharing code/data.
- For this first implementation, scaffolding the sync endpoint cleanly is acceptable if full Valve parsing is too much for one pass.
- Return safe status only.
- Never return credentials.

## Frontend requirements

In the existing Profile Edit screen, inside or near the Links section, add a compact `CS2 Match History` section.

The UI should include:

- Helper link: `Get your CS2 Match History Code from Steam`.
- Steam Profile URL or SteamID64 input.
- CS2 Authentication Code input.
- Most Recently Completed Match Token / Sharing Code input.
- Toggle/checkbox: `Show CS2 stats publicly`.
- Save button.
- Disconnect button.
- Connected status after save:
  - `CS2 Match History connected`
  - `Last synced: not synced yet` or a formatted date.
- Security note:

```text
Your CS2 authentication code is private. It is only used server-side to fetch your CS2 match history. It is never shown publicly.
```

After saving:

- Do not show the full auth code again.
- Do not show the full latest match token again unless the implementation has a strong reason.
- Show masked/present status instead.
- Allow the user to replace/update the auth code and token.
- Allow the user to disconnect/remove the CS2 connection.

## Public Profile/Profile Card requirements

Add a CS2 stats display area only if:

1. `public_stats_enabled` is true, and
2. public/sanitized CS2 stats exist.

Show safe processed data only, for example:

- Last match result.
- Last match score.
- Map.
- Recent form.
- Matches tracked.
- Last synced.

Never show:

- Steam auth code.
- Latest match token/sharing code.
- Private connection details.
- Any private DB table fields.

## grev.dad baseline rules

- Do not rewrite the whole site.
- Do not change the locked homepage/profile/Profile Card baseline unless needed.
- Keep terminology as `Profile Card`, not `Player Card`.
- Keep changes additive and isolated.
- Preserve existing auth/login/admin/profile behavior.
- Use existing style/layout patterns.
- Avoid introducing massive margins or full-width ugly forms.
- Keep the Profile Edit screen practical and compact.

## Implementation plan for Codex

1. Scan the repo to find:
   - current profile edit page
   - profile save/load endpoints
   - DB schema/migrations
   - auth/session helpers
   - Profile Card rendering/public profile API
2. Add migration/runtime-safe D1 table creation.
3. Add backend owner-only CS2 connection APIs.
4. Add frontend Profile Edit UI.
5. Add safe public CS2 stats display if data exists.
6. Add disconnect/remove functionality.
7. Ensure private fields never appear in public payloads.
8. Run appropriate tests/checks for this repo.
9. Include changed files, migration notes, and the field save audit table in the final response.

## Field save audit required in final response

For every added field, include a field save audit table covering:

| Field | DB schema/migration | Runtime-safe table creation/ALTER | Backend GET owner-only | Backend POST validation/save | SQL placeholders/value counts | Frontend form load/save | Frontend display rules | Public API exclusion | Regression of existing profile fields |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

Fields to audit at minimum:

- `steam_id64`
- `steam_profile_url`
- `cs2_auth_code`
- `latest_known_share_code`
- `is_enabled`
- `public_stats_enabled`
- `last_checked_at`
- `created_at`
- `updated_at`
- Any public stats fields added.
- Any public match fields added.

## Acceptance criteria

- A logged-in user can open Profile Edit and see the CS2 Match History section.
- The Steam help link is visible in the Links/Profile Edit area.
- The user can save SteamID64/profile URL, auth code, and latest match token.
- The saved auth code is not shown back in full.
- Public profile APIs do not return the auth code or match token.
- Other users cannot access another user's CS2 connection data.
- The user can disconnect/delete their CS2 connection.
- Existing profile fields still save correctly.
- Existing Profile Card behavior is not broken.
- Final Codex response includes changed files, migration notes, and the field save audit table.
