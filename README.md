# Grev

This repository has been reset to a fresh homepage-only foundation.

## Current routes
- `/`
- `/login.html`
- `/register.html`
- `/admin.html`

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

## Admin Force Refresh Site

Admins can use **Force Refresh Site** on `/admin.html` to run Cloudflare refresh actions from the Worker API.

Required secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ZONE_ID`
- `CLOUDFLARE_DEPLOY_HOOK_URL` (optional)

What each action does:
- **Purge Cache** clears Cloudflare CDN cache for the configured zone.
- **Trigger Redeploy** calls the configured deploy hook URL.
- **Purge Cache + Trigger Redeploy** runs purge first, then redeploy if the hook is configured.

Notes:
- The deploy button cannot deploy changes that have not already been pushed to GitHub.
- If any required secrets are missing, `/admin.html` shows a clear error/configuration message.
