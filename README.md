# Grev.dad

Grev.dad is Joe's private personal platform, with small shared spaces for trusted friends and family.

The previous implementation is preserved as **Grev.dad.legacy** in the `Grev_Old` release. This repository is a clean rebuild; legacy code is reference-only.

## First milestone

- Login and sign-up are the only unauthenticated pages.
- New accounts are active, unverified and assigned barebones Member access.
- Verification is separate from permissions.
- Sessions are server-side and stored as hashes in D1.
- The owner account is represented separately from ordinary admin roles.
- Groups, roles, permissions and policies have a clean initial schema.

## Setup

```bash
npm install
npx wrangler login
npx wrangler d1 create grev-dad-dev
npx wrangler d1 create grev-dad-preview
npx wrangler d1 create grev-dad-production
```

Put the returned D1 IDs into `wrangler.jsonc`, then run:

```bash
npm run db:migrate:local
npm run dev
```

No legacy database data will be migrated.
