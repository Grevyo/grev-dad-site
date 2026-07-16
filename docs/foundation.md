# Grev.dad foundation

## Product boundary

Grev.dad is Joe's private digital home with a small community layer for trusted friends and family. Unauthenticated visitors may only use login and sign-up.

## Account lifecycle

1. Anyone may sign up.
2. The account starts active, unverified and assigned the Member role.
3. The user receives only barebones access.
4. An administrator may verify the account separately from assigning groups or policies.
5. Groups, roles, permissions and policies determine access.

## Engineering rules

- Grev.dad.legacy is reference-only.
- Database changes use numbered migrations only.
- Runtime requests never create, alter or repair schema.
- Sessions are server-side; only a random token is placed in a secure HTTP-only cookie and only its hash is stored in D1.
- Verification is never used as a substitute for authorisation.
- The server enforces every protected action.
- The owner account cannot later be disabled, deleted or demoted through normal administration.
- Features remain modular and own their routes, data and tests.

## Build order

1. Authentication, sessions and account states.
2. Owner/admin account management, verification and group assignment.
3. Effective permission resolution.
4. Custom dashboard tile engine.
5. Tiled profiles and profile cards.
6. Community features and integrations.
