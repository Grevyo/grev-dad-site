# Grev

Cloudflare Worker + static pages with username/password auth on D1.

## App features
- Username/password register + login + logout.
- Roles: `admin`, `operator`, `og`, `member`.
- Members/profile/admin pages.
- Internal site currency: **Grev Coins**.
  - `wallets` table (per-user coin balance, integer only).
  - `wallet_transactions` table (wallet history).
  - `/api/wallet/me`
  - `/api/wallet/me/transactions`
  - `/api/admin/wallets`
  - `/api/admin/users/:id/wallet-adjust`
- Old `balances` and `ledger` money system was removed.

## Routes
- `/`, `/unregistered.html`, `/register.html`, `/login.html`, `/members.html`, `/profile.html`, `/admin.html`

## D1 migrations
```bash
npx wrangler d1 migrations apply profile-db --remote
npx wrangler d1 migrations apply profile-db --local
```

## Setup API
```bash
curl -X POST https://<your-domain>/api/setup/schema -H "Content-Type: application/json" -d '{"secret":"<ADMIN_SETUP_SECRET>"}'
curl https://<your-domain>/api/setup/status
```

## Profile showcase admin test API

- `POST /api/admin/users/:id/unlocks` (admin only)
- Body: `{ "unlock_key", "unlock_type", "name", "description", "rarity", "source", "icon_url" }`
- `unlock_type` must be one of: achievement, badge, trophy, minigame, cosmetic, other.
- `rarity` must be one of: common, uncommon, rare, epic, legendary.
- Upserts by `(user_id, unlock_key)`.


## Steam integration

Steam profile links render from user-provided profile URLs and public profile pages; no server-side key is required.
