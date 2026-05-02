# Grev

This repository includes a Cloudflare Worker with auth APIs backed by D1.

## Current routes
- `/`
- `/login.html`
- `/register.html`
- `/admin.html`

## D1 binding setup
- Binding name must be `DB` (the Worker code expects `env.DB`).
- Database name must be `profile-db`.
- `database_id` must be the real Cloudflare D1 database UUID (not a placeholder).

Where to find the D1 database UUID in Cloudflare:
1. Open Cloudflare Dashboard.
2. Go to **Workers & Pages** → **D1**.
3. Open the `profile-db` database.
4. Copy the **Database ID** value (UUID).
5. Paste it into `wrangler.jsonc` under:
   - `d1_databases[0].database_id`

Future major systems should use separate D1 databases/bindings instead of being combined into `profile-db`.
Examples:
- `game-db`
- `casino-db`
- `stats-db`

Example `wrangler.jsonc` section:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "profile-db",
    "database_id": "25b0b37a-b855-46c3-a787-ffef7f04fb64"
  }
]
```

## Apply D1 migrations

Run from this repo root:

```bash
npx wrangler d1 migrations apply profile-db --remote
```

For local dev database:

```bash
npx wrangler d1 migrations apply profile-db --local
```

The auth foundation tables are created by migrations in `migrations/` (`users`, `sessions`, `balances`, `ledger`).

## Manual schema setup via API

If you need to initialize schema from the Worker API, set secret `ADMIN_SETUP_SECRET` and call:

```bash
curl -X POST https://<your-domain>/api/setup/schema \
  -H "Content-Type: application/json" \
  -d '{"secret":"<ADMIN_SETUP_SECRET>"}'
```

Success response:

```json
{"ok":true,"message":"Schema created"}
```

Check status:

```bash
curl https://<your-domain>/api/setup/status
```

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
