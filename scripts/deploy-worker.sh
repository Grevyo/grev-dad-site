#!/usr/bin/env bash
# Deploys the Worker for one environment (production or pbe).
#
# Cloud saves need the R2 bucket bound as GREV_HOME_SAVES. The deploy always tries with the bucket
# first: Cloudflare accepts the binding whenever the bucket exists, even if this API token can't
# read R2 itself (so creating the bucket in the dashboard is enough). Only if that deploy fails
# because of the bucket does it deploy without cloud saves, with a warning, so the site still ships.
set -uo pipefail
env_name="$1"
bucket="$2"

deploy() {
  local config="$1" output status
  output=$(npx wrangler deploy --config "$config" --env "$env_name" 2>&1)
  status=$?
  printf '%s\n' "$output"
  if [ "$status" -ne 0 ] && printf '%s\n' "$output" | grep -q "Completion token has already been consumed"; then
    echo "Cloudflare returned transient completion-token error 100312. Retrying once in 20 seconds."
    sleep 20
    output=$(npx wrangler deploy --config "$config" --env "$env_name" 2>&1)
    status=$?
    printf '%s\n' "$output"
  fi
  LAST_OUTPUT="$output"
  return "$status"
}

if deploy wrangler.jsonc; then
  echo "Deployed $env_name with cloud saves (R2 bucket $bucket)."
  exit 0
fi

if ! printf '%s\n' "$LAST_OUTPUT" | grep -qiE "r2|bucket"; then
  echo "Deploy failed for a reason unrelated to the cloud save bucket."
  exit 1
fi

echo "::warning::The R2 bucket $bucket isn't available, so $env_name is deploying without cloud saves. Create the bucket in the Cloudflare dashboard (R2 > Create bucket > $bucket) or give the API token 'Workers R2 Storage: Edit', then redeploy."
node scripts/wrangler-without-saves.mjs "$env_name" || exit 1
deploy wrangler.deploy.json
