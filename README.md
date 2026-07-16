# Grev.dad

Grev.dad is Joe's private personal platform, with small shared spaces for trusted friends and family.

The previous implementation is preserved as **Grev.dad.legacy** in the `Grev_Old` release. This repository is a clean rebuild; legacy code is reference-only.

## Environments

- `pbe` branch deploys to **pbe.grev.dad** using the PBE D1 database.
- `main` is the production branch for **grev.dad** using the production D1 database.
- Development is GitHub-first. A local clone is optional and is not required for the normal workflow.

PBE deployments run automatically through GitHub Actions after the required Cloudflare repository secrets are configured. Production deployment is manual until a build has been tested and deliberately promoted.

## First milestone

- Login and sign-up are the only unauthenticated pages.
- New accounts are active, unverified and assigned barebones Member access.
- Verification is separate from permissions.
- Sessions are server-side and stored as hashes in D1.
- The owner account is represented separately from ordinary admin roles.
- Groups, roles, permissions and policies have a clean initial schema.

## Required GitHub secrets

Add these repository Actions secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

The API token must be stored only as a GitHub secret and must never be committed to the repository.

## Deployment commands

GitHub Actions runs the equivalent of:

```bash
npm ci
npm run typecheck
npm run deploy:pbe
```

Production is deployed manually with the production GitHub workflow after PBE has been tested.

No legacy database data will be migrated.
