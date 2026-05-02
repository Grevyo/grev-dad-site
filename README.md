# grev-dad-site foundation

This repo is intentionally minimal and only keeps:
- auth routes and session/cookie handling
- password hashing
- admin panel and admin APIs
- money/balance foundation
- D1 schema + migration + worker deployment config

## Public pages
- `public/index.html`
- `public/login.html`
- `public/register.html`
- `public/admin.html`
- `public/styles/site.css`

## API routes (all JSON)
### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Admin
- `GET /api/admin/users`
- `POST /api/admin/make-admin`
- `POST /api/admin/setup-promote`
- `GET /api/admin/deploy/status`
- `POST /api/admin/deploy/redeploy`
- `POST /api/admin/deploy/purge-cache`
- `POST /api/admin/deploy/refresh-live-site`

### Money
- `GET /api/balance`

## Required secrets / vars
- `ADMIN_SETUP_SECRET`
- `CLOUDFLARE_DEPLOY_HOOK_URL`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ZONE_ID`

Optional metadata vars:
- `DEPLOY_COMMIT_SHA`
- `DEPLOY_BRANCH`

## Deployment refresh behavior
- **Trigger Redeploy** calls Cloudflare deploy hook server-side.
- **Purge Cloudflare Cache** calls Cloudflare purge API server-side with `purge_everything`.
- **Redeploy + Purge** runs both and returns combined JSON.

Refresh actions can only deploy code that is already pushed to GitHub and available to Cloudflare Pages.

## Local check
```bash
find . -name "*.js" -not -path "./node_modules/*" -print0 | xargs -0 -n1 node --check
```
