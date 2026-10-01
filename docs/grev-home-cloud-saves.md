# Grev Home cloud saves

Server half of Grev Home's `docs/CLOUD_SAVES.md`. Implemented in `src/grev-home-saves.ts`.

## Storage

- Archives live in R2 under the `GREV_HOME_SAVES` binding (`grev-dad-saves-dev`,
  `grev-dad-saves-pbe`, `grev-dad-saves`). Deploy workflows create the bucket if missing.
- `grev_home_cloud_saves` (D1) points at the current archive per `(user_id, app_id)`.
  Saves follow the grev.dad account, so every device linked to that account sees the
  same save. App IDs are case-insensitive.
- Without the R2 binding the routes return 503 and `/capabilities` reports
  `cloudSaves:false`; Grev Home then explains that the server has no cloud saves.

## API (device bearer token)

| Method | Path | Result |
| --- | --- | --- |
| `HEAD` | `/api/grev-home/saves/{appId}` | 200 with `X-Grev-Updated-At` + `X-Grev-Content-SHA256`, or 404 |
| `GET` | `/api/grev-home/saves/{appId}` | the zip, same headers, or 404 JSON |
| `PUT` | `/api/grev-home/saves/{appId}` | body is the zip; needs `Content-Length` and `X-Grev-Content-SHA256` (hex). Returns `{ ok, apiVersion, exists, sizeBytes, updatedAtUtc }` |

- R2 verifies the SHA-256 while storing; a mismatch returns 400 and the previous save
  stays current. The new archive becomes visible only after D1 points at it; the old
  archive is then deleted.
- `updatedAtUtc` / `X-Grev-Updated-At` are ISO-8601 and strictly increase per save, which
  is what Grev Home's conflict detection compares.
- Maximum archive size is `limits.cloudSaveMaxBytes` (95 MB) because Cloudflare refuses
  request bodies over 100 MB on Free/Pro plans. Grev Home uses the smaller of this and
  its own 300 MB limit.
- `GET /api/grev-home/account-data` lists `cloudSaves` so a newly linked device can offer
  restores.

## Tests

- `node scripts/verify-grev-home-cloud-saves.mjs` (part of `npm run verify:grev-home`).
- `npm run e2e:grev-home` drives every Grev Home call, including saves, against
  `wrangler dev --local` (apply migrations with `--local` first).
