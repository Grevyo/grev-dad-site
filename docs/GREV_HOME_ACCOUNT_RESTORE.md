# Grev Home account recovery

Website `users.id` is the permanent cloud identity. The original `grev_home_links`
row remains in place so no history, XP ledger or token foreign keys are rebuilt.
Each local GrevID is a permanently account-owned sync source. Tokens identify that
local source independently of the original account link. Never match by username.

`GET /api/grev-home/account-data` is device-authenticated and returns only that
account's profile sources, private app statistics, original website creation date
and known local profile creation dates. Old profile dates cannot be reconstructed
until an installation uploads them; null means unknown, not the link date.

Sync snapshots must contain local-only totals and matching per-app statistics.
Sources use monotonic totals and the account combines sources. Downloaded data is
a read-only client projection, never a local session to upload again. Historical
snapshot totals survive migration even when per-app details were not uploaded.
Detailed session history continues to follow the existing privacy setting.

New PC: create a local profile, link the existing website account, then allow sync
to finish. No game files, BIOS, saves, emulator settings or local admin permissions
are restored. Unsynced data on an erased PC cannot be recovered.

Unlink in the new client revokes this device's token family. Website account-wide
unlink remains an explicit separate action. Profile-source ownership and cloud
history persist after unlink, preventing reassignment of history to another user.

Run `npm run typecheck` and `npm run verify:grev-home-link` before deployment.
The additive migration must deploy before the updated worker/client.
