import { readFileSync, writeFileSync, rmSync } from 'node:fs';

function replaceOrFail(source, find, replacement, label) {
  if (!source.includes(find)) throw new Error(`Unable to find patch anchor: ${label}`);
  return source.replace(find, replacement);
}

let index = readFileSync('src/index.ts', 'utf8');
index = replaceOrFail(
  index,
  "    const intentionIds=[...new Set(rawIds.map(value=>value.trim()).filter(Boolean))];\n    const activeRows=await env.DB.prepare(`SELECT id FROM intention_options WHERE is_active=1`).all<{id:string}>(),active=new Set(activeRows.results.map(row=>row.id));",
  "    const intentionIds=[...new Set(rawIds.map(value=>value.trim()).filter(Boolean))];\n    if(!intentionIds.length)return json({ok:false,message:'Choose at least one intention.'},{status:400});\n    const activeRows=await env.DB.prepare(`SELECT id FROM intention_options WHERE is_active=1`).all<{id:string}>(),active=new Set(activeRows.results.map(row=>row.id));",
  'normalized intention validation'
);
index = replaceOrFail(
  index,
  "      env.DB.prepare(`DELETE FROM user_intentions WHERE user_id=? AND intention_id IN (SELECT id FROM intention_options WHERE is_active=1)`).bind(user.id),\n      env.DB.prepare(`DELETE FROM group_memberships WHERE user_id=? AND group_id IN (SELECT igg.group_id FROM intention_group_grants igg JOIN intention_options io ON io.id=igg.intention_id WHERE io.is_active=1)`).bind(user.id)",
  "      env.DB.prepare(`DELETE FROM user_intentions WHERE user_id=? AND intention_id IN (SELECT intention_id FROM intention_group_grants)`).bind(user.id),\n      env.DB.prepare(`DELETE FROM group_memberships WHERE user_id=? AND group_id IN (SELECT group_id FROM intention_group_grants)`).bind(user.id)",
  'self-service intention replacement cleanup'
);
writeFileSync('src/index.ts', index);

let workflow = readFileSync('.github/workflows/deploy-pbe.yml', 'utf8');
workflow = replaceOrFail(
  workflow,
  "          console.log('Relationship and intention onboarding catalog verified.');\n          NODE\n",
  "          console.log('Relationship and intention onboarding catalog verified.');\n          NODE\n\n      - name: Reject empty normalized intentions\n        shell: bash\n        run: |\n          set -euo pipefail\n          status=$(curl --silent --show-error \\\n            --output /tmp/empty-intentions.json \\\n            --write-out '%{http_code}' \\\n            --cookie /tmp/ladmin.cookies \\\n            --request POST \\\n            --header 'Content-Type: application/json' \\\n            --data '{\"intentionIds\":[\"   \"]}' \\\n            https://pbe.grev.dad/api/onboarding/intentions)\n          cat /tmp/empty-intentions.json\n          echo\n          if [ \"$status\" != \"400\" ]; then\n            echo \"Whitespace-only intentions must be rejected with HTTP 400.\"\n            exit 1\n          fi\n",
  'PBE invalid intention smoke test'
);
writeFileSync('.github/workflows/deploy-pbe.yml', workflow);

rmSync('scripts/apply-onboarding-review-fixes.mjs');
rmSync('.github/workflows/apply-onboarding-review-fixes.yml');
