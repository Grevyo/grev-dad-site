# CLEANUP AUDIT (NO DELETIONS IN THIS STEP)

Scope of this audit: classify current files/folders for safe future cleanup planning while preserving protected systems.

## 1. MUST KEEP
Files/folders clearly connected to protected systems, protected routes, or deployment/runtime:

- `public/index.html`
- `public/login.html`
- `public/register.html`
- `public/profile.html`
- `public/profile-edit.html`
- `public/members.html`
- `public/admin.html`
- `public/forum.html`
- `public/post.html`
- `public/new-post.html`
- `public/cpl/index.html`
- `public/playground/gambling/`
- `public/playground/misc/j-playground/index.html`
- `public/playground/misc/dkpg/index.html`
- `public/scripts/header.js`
- `public/scripts/casino-chat-widget.js`
- `public/header.html`
- `public/styles/site.css`
- `public/styles/gambling-theme.css`
- `src/index.js`
- `src/routes/auth.js`
- `src/routes/users.js`
- `src/routes/admin.js`
- `src/routes/forum.js`
- `src/routes/chat.js`
- `src/routes/core.js`
- `src/routes/meta.js`
- `src/features/casino/`
- `src/lib/gambling.js`
- `src/lib/runtime-cache.js`
- `src/lib/cases-binding.js`
- `wrangler.jsonc`

## 2. SAFE CLEANUP CANDIDATES
Files/folders that appear clearly unrelated to protected systems and may be removable later:

- _None identified yet with high confidence._

## 3. UNCERTAIN — KEEP FOR NOW
Files/folders that might be unused, but could still impact protected systems:

- `README.md` (may document setup/deployment assumptions)
- `public/grev-dad-logo.png` (shared visual asset, usage not fully mapped yet)
- `public/playground/index.html` (index/entrypoint relationship to preserved playground areas not fully verified)
- `public/playground/gambling/dust2bg.webp` (casino visual asset; likely referenced, keep until full reference trace)

## 4. REBUILD CANDIDATES
Files likely worth rewriting/simplifying in a later refactor (but not deleting now):

- `public/styles/site.css` (likely broad/global styling surface)
- `src/index.js` (central Worker entrypoint; likely mixed concerns)
- `src/routes/core.js` (candidate for route/module simplification)
- `src/routes/meta.js` (candidate for tighter separation if currently mixed with app concerns)

## Risk notes
Potentially risky areas during cleanup/rebuild planning:

- Auth/session/cookie coupling across route handlers and frontend pages.
- Chat feature coupling (UI widget + backend routes + any persistence assumptions).
- Casino feature coupling across HTML, scripts, server routes, and feature modules.
- Cloudflare deployment/runtime coupling in `wrangler.jsonc` and Worker entrypoint wiring.

**Rule of thumb for future cleanup:** if uncertain, keep the file until import/route/runtime references are fully proven safe.
