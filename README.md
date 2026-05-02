# grev-dad-site

## CPL Dashboard Shell

`/cpl/` is a lightweight shell that embeds the external Streamlit dashboard:

- https://grev-profiles-and-tactics.streamlit.app/#hltv-cpl-profile-viewer

## Admin Deployment Controls

Admins can use deployment controls in `/admin.html` to trigger a Cloudflare Pages deploy hook and/or purge Cloudflare CDN cache when the live site appears stale after a pushed commit.

Required secrets:
- `CLOUDFLARE_DEPLOY_HOOK_URL`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ZONE_ID`

Optional metadata:
- `DEPLOY_COMMIT_SHA`
- `DEPLOY_BRANCH`

Notes:
- Deploy hook triggers a rebuild/deployment for the configured branch.
- Purge cache clears CDN cache and can make next page loads temporarily slower.
- This tool cannot deploy commits that have not been pushed to GitHub.
