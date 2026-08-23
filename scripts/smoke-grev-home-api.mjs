#!/usr/bin/env node

const baseUrl = String(process.argv[2] ?? '').replace(/\/+$/, '');
const expectedEnvironment = String(process.argv[3] ?? '').trim();

if (!/^https:\/\//i.test(baseUrl)) {
  console.error('Usage: node scripts/smoke-grev-home-api.mjs https://host [expected-environment]');
  process.exit(2);
}

function fail(message, details) {
  console.error(`Grev Home API smoke test failed: ${message}`);
  if (details !== undefined) console.error(details);
  process.exit(1);
}

async function readJson(response, label) {
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    fail(`${label} did not return JSON (HTTP ${response.status}).`, text.slice(0, 1000));
  }
  return payload;
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(`${baseUrl}${path}`, {
      redirect: 'manual',
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

console.log(`Checking Grev Home API at ${baseUrl}`);

const capabilitiesResponse = await request('/api/grev-home/capabilities');
const capabilities = await readJson(capabilitiesResponse, 'Capabilities');
if (capabilitiesResponse.status !== 200 || capabilities.ok !== true) {
  fail(`Capabilities returned HTTP ${capabilitiesResponse.status}.`, capabilities);
}
if (capabilities.apiVersion !== 1 || capabilities.optional !== true) {
  fail('Capabilities returned an incompatible Grev Home contract.', capabilities);
}
if (expectedEnvironment && capabilities.environment !== expectedEnvironment) {
  fail(`Expected environment '${expectedEnvironment}' but server reported '${capabilities.environment}'.`, capabilities);
}

const requiredCapabilities = [
  'linking',
  'deviceTokens',
  'tokenRotation',
  'perDeviceRevocation',
  'linkMetadataSync',
  'presence',
  'sessionHistory',
  'progressionSync',
  'contentIdentity',
  'offlineHistoryReplay'
];
for (const key of requiredCapabilities) {
  if (capabilities.capabilities?.[key] !== true) {
    fail(`Required capability '${key}' is not advertised.`, capabilities);
  }
}
if (capabilities.capabilities?.stalePresenceReplay !== false) {
  fail('Server must explicitly advertise stalePresenceReplay=false.', capabilities);
}

const nonce = Date.now().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-6);
const smokeUsername = `Smoke${nonce}`;
const grevId = `GABCD${smokeUsername}XYZ`;
const linkResponse = await request('/api/grev-home/link/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    grevId,
    username: smokeUsername,
    displayName: 'Deployment Smoke',
    deviceName: 'GitHub Actions'
  })
});
const link = await readJson(linkResponse, 'Link start');
if (linkResponse.status !== 201 || link.ok !== true) {
  fail(`Link start returned HTTP ${linkResponse.status}.`, link);
}
if (!link.linkId || !link.deviceCode || !link.userCode || !link.verificationUri || !link.expiresAt) {
  fail('Link start returned an incomplete device-code response.', link);
}
if (!String(link.verificationUri).startsWith(`${baseUrl}/link-grev-home`)) {
  fail('Link start returned a verification URI for the wrong origin.', link);
}
if (Number(link.expiresAt) <= Math.floor(Date.now() / 1000)) {
  fail('Link start returned an already-expired request.', link);
}

const statusResponse = await request(`/api/grev-home/link/status?id=${encodeURIComponent(link.linkId)}`, {
  headers: { Authorization: `Bearer ${link.deviceCode}` }
});
const status = await readJson(statusResponse, 'Link status');
if (statusResponse.status !== 200 || status.ok !== true || status.status !== 'pending') {
  fail(`Pending link poll returned HTTP ${statusResponse.status} / status '${status.status}'.`, status);
}

console.log(`Grev Home API ${capabilities.environment} smoke test passed.`);
console.log(`API v${capabilities.apiVersion}; link ${link.linkId} created and polled successfully.`);
