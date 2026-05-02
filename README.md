# Grev

This repository has been reset to a fresh homepage-only foundation.

## Current routes
- `/`
- `/login.html`
- `/register.html`

## Current status
- Auth, admin, and database systems will be added later.
- No D1 database is required for this homepage-only version.

## Planned D1 setup (for future login/profile work)
- Database name: `profile-db`
- Worker binding: `PROFILE_DB`

Future major systems should use separate D1 databases/bindings instead of being combined into `profile-db`.
Examples:
- `game-db`
- `casino-db`
- `stats-db`
