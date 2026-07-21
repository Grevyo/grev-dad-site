import { pbkdf2Sync, randomUUID, createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const password = process.env.LADMIN_BOOTSTRAP_PASSWORD ?? '';
const targetName = (process.env.LADMIN_TARGET_ENV ?? 'pbe').toLowerCase();
const targets = {
  pbe: { database: 'grev-dad-preview', wranglerEnv: 'pbe' },
  production: { database: 'grev-dad-production', wranglerEnv: 'production' }
};
const target = targets[targetName];

if (!target) {
  console.error('LADMIN_TARGET_ENV must be either pbe or production.');
  process.exit(1);
}

if (!password) {
  console.error(`LADMIN_BOOTSTRAP_PASSWORD is not configured for ${targetName}.`);
  process.exit(1);
}

if (password.length < 12) {
  console.error('LADMIN_BOOTSTRAP_PASSWORD must contain at least 12 characters.');
  process.exit(1);
}

const systemUserId = '03af6b83-ebb3-4d61-8572-f41371cb11b2';
const iterations = 100000;
const salt = createHash('sha256').update(`grev-dad:ladmin:${targetName}:v1`).digest().subarray(0, 16);
const passwordHash = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
const saltText = salt.toString('base64url');
const hashText = passwordHash.toString('base64url');
const auditId = randomUUID();

const sql = `
PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO users(
  id, username, email, display_name, status, is_verified, is_owner,
  verified_at, verified_by, created_at, updated_at
)
SELECT
  '${systemUserId}', 'LADMIN', NULL, 'Local Administrator', 'active', 1, 0,
  unixepoch(), '${systemUserId}', unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE lower(username) = 'ladmin');

INSERT OR IGNORE INTO user_roles(user_id, role_id, assigned_by, assigned_at)
SELECT id, 'role-admin', id, unixepoch()
FROM users
WHERE is_owner = 1 AND lower(username) <> 'ladmin';

UPDATE users
SET is_owner = 0, updated_at = unixepoch()
WHERE is_owner = 1 AND lower(username) <> 'ladmin';

UPDATE sessions
SET revoked_at = unixepoch()
WHERE user_id = (SELECT id FROM users WHERE lower(username) = 'ladmin' LIMIT 1)
  AND revoked_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM user_credentials
    WHERE user_id = (SELECT id FROM users WHERE lower(username) = 'ladmin' LIMIT 1)
      AND password_hash <> '${hashText}'
  );

UPDATE users
SET username = 'LADMIN',
    display_name = 'Local Administrator',
    status = 'active',
    is_verified = 1,
    is_owner = 1,
    verified_at = COALESCE(verified_at, unixepoch()),
    verified_by = id,
    updated_at = unixepoch()
WHERE lower(username) = 'ladmin';

INSERT INTO user_credentials(
  user_id, password_algorithm, password_iterations, password_salt,
  password_hash, password_updated_at
)
SELECT id, 'PBKDF2-SHA256', ${iterations}, '${saltText}', '${hashText}', unixepoch()
FROM users
WHERE lower(username) = 'ladmin'
ON CONFLICT(user_id) DO UPDATE SET
  password_algorithm = excluded.password_algorithm,
  password_iterations = excluded.password_iterations,
  password_salt = excluded.password_salt,
  password_hash = excluded.password_hash,
  password_updated_at = CASE
    WHEN user_credentials.password_hash <> excluded.password_hash THEN unixepoch()
    ELSE user_credentials.password_updated_at
  END;

INSERT OR IGNORE INTO user_roles(user_id, role_id, assigned_by, assigned_at)
SELECT id, 'role-member', id, unixepoch()
FROM users
WHERE lower(username) = 'ladmin';

INSERT OR IGNORE INTO user_roles(user_id, role_id, assigned_by, assigned_at)
SELECT id, 'role-admin', id, unixepoch()
FROM users
WHERE lower(username) = 'ladmin';

INSERT INTO audit_events(
  id, actor_user_id, event_type, target_type, target_id, metadata_json, created_at
)
SELECT
  '${auditId}', id, 'system.ladmin_bootstrapped', 'user', id,
  '${JSON.stringify({ environment: targetName })}', unixepoch()
FROM users
WHERE lower(username) = 'ladmin';
`;

const directory = mkdtempSync(join(tmpdir(), 'grev-dad-ladmin-'));
const sqlPath = join(directory, 'bootstrap-ladmin.sql');
writeFileSync(sqlPath, sql, { encoding: 'utf8', mode: 0o600 });

try {
  const result = spawnSync(
    'npx',
    ['wrangler', 'd1', 'execute', target.database, '--remote', '--env', target.wranglerEnv, '--file', sqlPath],
    { stdio: 'inherit', shell: process.platform === 'win32' }
  );

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  console.log(`LADMIN account is configured as the ${targetName} Owner.`);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
