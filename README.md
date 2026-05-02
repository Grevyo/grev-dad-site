# grev-dad-site (Fresh Foundation)

Minimal Cloudflare Worker + Pages + D1 foundation focused on:
- Auth (`/api/auth/login`, `/api/auth/register`, `/api/auth/logout`, `/api/auth/me`)
- Admin basics (`/admin.html`, `/api/admin/users`, `/api/admin/make-admin`)
- Safe bootstrap promote route (`/api/admin/setup-promote` with `ADMIN_SETUP_SECRET`)
- Money foundation (`users.balance_cents`, `/api/balance`)

## Routes
- `/`
- `/login.html`
- `/register.html`
- `/admin.html`

## Notes
- All API responses return JSON.
- Session cookie is httpOnly.
