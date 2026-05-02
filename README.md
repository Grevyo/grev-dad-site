# grev-dad-site

## CPL Playground

`/CPL_Playground/` now acts as a lightweight shell that loads the external Streamlit app directly:

- https://grev-profiles-and-tactics.streamlit.app/#hltv-cpl-profile-viewer

The previous in-repo CPL Streamlit source/data files were removed from `public/CPL_Playground/`.


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
