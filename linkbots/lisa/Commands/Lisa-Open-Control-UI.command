#!/bin/zsh
# Open Lisa Control UI using the local gateway token without printing it.
set -euo pipefail

env_file="/Users/linktrend/.openclaw-lisa/service-env/ai.openclaw.lisa.env"
if [[ ! -r "$env_file" ]]; then
  echo "Missing token env file: $env_file"
  echo "Open Lisa-Control-UI.txt and use the bookmark there."
  exit 1
fi

set -a
source "$env_file"
set +a
token="${OPENCLAW_GATEWAY_TOKEN:-}"

if [[ -z "$token" ]]; then
  echo "OPENCLAW_GATEWAY_TOKEN is missing or empty in $env_file"
  exit 1
fi

open_cmd="${OPENCLAW_CONTROL_UI_OPEN:-/usr/bin/open}"
"$open_cmd" "https://linktrend-mini.tailf7e13a.ts.net:8443/#token=${token}"
