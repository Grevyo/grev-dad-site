# Grevlings Web Hosting (R2 / Large-File Host)

## Why this exists

Grevlings is exported as a Godot web build, which includes large files (for example `.wasm` and `.pck`).
These files should not be checked into `public/` and may exceed Cloudflare Workers/Pages static asset size limits.

## Current deployment flow

1. The GitHub Action `.github/workflows/export-grevlings-web.yml` exports the web build.
2. The workflow uploads the exported output as a GitHub Actions artifact (`grevlings-web-build`).
3. The site route `/games/grevlings/` remains a launcher page only.

## Manual hosting flow (Cloudflare R2)

1. Run/export via the workflow and wait for artifact upload.
2. Download the `grevlings-web-build` artifact from the workflow run.
3. Upload all exported files to a public Cloudflare R2 bucket (or another static host that supports large files).
4. Copy the public URL for the uploaded `index.html`.
5. Set `public/games/grevlings/config.js`:

```js
window.GREVLINGS_CONFIG = {
  buildUrl: 'https://your-public-host.example/grevlings/index.html'
};
```

6. Deploy the site so `/games/grevlings/` uses the updated launcher config.

After this, users visiting `/games/grevlings/` can click the launcher button to open the hosted build.

## Planned future automation

Later, the export workflow can be extended to upload artifact contents directly to Cloudflare R2 automatically once R2 credentials/secrets are configured in GitHub Actions.
