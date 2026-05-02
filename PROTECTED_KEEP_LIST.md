# PROTECTED KEEP LIST (DO NOT DELETE / DO NOT BREAK)

This repository is being prepared for a safe rebuild/cleanup.

**Hard rule:** do not delete, disable, or break anything connected to the systems, routes, and areas listed below.

## Core protected systems
- Auth
- Login
- Register
- Logout
- Sessions/cookies
- User profiles
- Profile edit
- Members
- Admin panel
- Roles/permissions
- Forum
- Global chat
- Casino chat
- Private/direct chats if present
- Chat APIs/routes/UI/database tables
- D1 schema/migrations/bindings needed by preserved systems
- Cloudflare Worker/Pages deployment structure

## Protected areas
- Grev Casino
- Skips Playground / J Playground
- DontKnow Playground
- CPL dashboard at `/cpl/`

## Protected routes
- `/`
- `/login.html`
- `/register.html`
- `/profile.html`
- `/profile-edit.html`
- `/members.html`
- `/admin.html`
- `/forum.html`
- `/post.html`
- `/new-post.html`
- `/playground/gambling/index.html`
- `/playground/gambling/daily-spin.html`
- `/playground/gambling/classic-spins.html`
- `/playground/gambling/roulette.html`
- `/playground/gambling/crash-sprint.html`
- `/playground/misc/j-playground/index.html`
- `/playground/misc/dkpg/index.html`
- `/cpl/`

## Protection rules
- Do not delete anything connected to the protected keep list.
- Do not delete auth/session/cookie/helper files just because they look small or unused.
- Do not delete route files unless every import, route, and page reference proves they are unrelated to the keep list.
- Do not delete placeholder/private chat code if it may be part of future chat functionality.
- Do not delete casino backend/data unless it is clearly for a removed casino game and not used by the casino base.
- If unsure, keep it.
