// Writes wrangler.deploy.json: wrangler.jsonc without the cloud-save R2 binding for one
// environment. The deploy workflows use it when the save bucket can't be confirmed (most often
// because the Cloudflare API token has no R2 permission), so the site still deploys. Cloud saves
// then report themselves unavailable (`cloudSaves: false` in the Grev Home capabilities) until the
// bucket exists and the next deploy binds it.
import { readFileSync, writeFileSync } from 'node:fs';

const envName = process.argv[2];
if (!envName) {
  console.error('Usage: node scripts/wrangler-without-saves.mjs <env>');
  process.exit(1);
}
const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
const target = config.env?.[envName];
if (!target) {
  console.error(`wrangler.jsonc has no "${envName}" environment.`);
  process.exit(1);
}
const strip = (section) => {
  if (!Array.isArray(section.r2_buckets)) return;
  section.r2_buckets = section.r2_buckets.filter((bucket) => bucket.binding !== 'GREV_HOME_SAVES');
  if (section.r2_buckets.length === 0) delete section.r2_buckets;
};
strip(config);
strip(target);
writeFileSync('wrangler.deploy.json', `${JSON.stringify(config, null, 2)}\n`);
console.log(`Wrote wrangler.deploy.json for "${envName}" without the cloud-save bucket.`);
