# Fresh foundation

Minimal Cloudflare Worker + D1 foundation with only:
- minimal public pages (`/`, `/login.html`, `/register.html`, `/admin.html`)
- auth APIs with secure password hashing and session cookies
- admin setup endpoint protected by `ADMIN_SETUP_SECRET`
- admin deploy refresh APIs (redeploy/purge/combined)
- balance foundation (`balances`, `ledger`) with default starting balance
- reset migration (`migrations/0002_fresh_reset.sql`) to wipe old schema/data

## Required secrets
- `ADMIN_SETUP_SECRET`
- `CLOUDFLARE_DEPLOY_HOOK_URL`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ZONE_ID`

## Apply migrations
Use Wrangler D1 migration tooling, e.g.:
- `wrangler d1 migrations apply DB --local`
- `wrangler d1 migrations apply DB --remote`
