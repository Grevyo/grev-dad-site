# Grev

This repository contains a Cloudflare Worker + static pages app with username/password authentication backed by a D1 database.

## App features
- Username/password register + login + logout.
- Role system (`admin`, `operator`, `og`, `member`) with centralized role metadata in the Worker.
- Members and profile pages that show role information.
- Basic money foundation:
  - `balances` table (per-user balance in cents).
  - `ledger` table (append-only balance adjustments with reason).
  - `/api/balance` for the current user.
  - `/api/ledger/me` for the current user.
  - Admin balance adjustment endpoint.

## Main routes
- `/`
- `/unregistered.html`
- `/register.html`
- `/login.html`
- `/members.html`
- `/profile.html`
- `/admin.html`

## D1 binding setup
- Binding name must be `DB` (the Worker expects `env.DB`).
- Database name must be `profile-db`.
- `database_id` in `wrangler.jsonc` must be your real D1 UUID.

## Apply D1 migrations
Run from repo root:

```bash
npx wrangler d1 migrations apply profile-db --remote
```

For local D1:

```bash
npx wrangler d1 migrations apply profile-db --local
```

The auth/money foundation tables are maintained in `migrations/` and are also protected by Worker-side `CREATE TABLE IF NOT EXISTS` setup.

## Optional manual schema setup API
If you want to initialize schema through the Worker API, set `ADMIN_SETUP_SECRET` and call:

```bash
curl -X POST https://<your-domain>/api/setup/schema \
  -H "Content-Type: application/json" \
  -d '{"secret":"<ADMIN_SETUP_SECRET>"}'
```

Check status:

```bash
curl https://<your-domain>/api/setup/status
```

## Password hashing
Cloudflare Workers currently support PBKDF2 up to 100000 iterations, and this project uses 100000.
