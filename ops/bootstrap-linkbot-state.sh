#!/usr/bin/env bash
# Prepare host bind-mount state for OpenClaw gateway (uid 1000 / node in container).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SEED_ROOT="${LINKBOT_WORKSPACE_SEED_DIR:-$REPO_ROOT/deploy/prod/workspaces}"

DATA_ROOT="${LINKBOT_DATA_ROOT:-/opt/linktrend/data/linkbot-core/state}"
WS="${DATA_ROOT}/workspace"
CFG="${DATA_ROOT}/config"
RUN_UID="${LINKBOT_RUN_UID:-1000}"
RUN_GID="${LINKBOT_RUN_GID:-1000}"

AGENTS=(
  shared
  admin-openclaw
  ceo-client
  linksites-head
  linkdeveloper-orchestrator
  linkdeveloper-steward
)

mkdir -p "${WS}/shared"
for agent_id in admin-openclaw ceo-client linksites-head linkdeveloper-orchestrator linkdeveloper-steward; do
  mkdir -p \
    "${WS}/${agent_id}" \
    "${CFG}/agents/${agent_id}/agent"
done

seed_workspace() {
  local agent_id="$1"
  local dest="${WS}/${agent_id}"
  local src="${SEED_ROOT}/${agent_id}"
  if [[ ! -d "$src" ]]; then
    return 0
  fi
  mkdir -p "$dest"
  for file in AGENTS.md SOUL.md IDENTITY.md USER.md TOOLS.md HEARTBEAT.md; do
    if [[ -f "${src}/${file}" && ! -f "${dest}/${file}" ]]; then
      install -m 664 -o "${RUN_UID}" -g "${RUN_GID}" "${src}/${file}" "${dest}/${file}"
    fi
  done
}

for agent_id in "${AGENTS[@]}"; do
  seed_workspace "$agent_id"
done

chown -R "${RUN_UID}:${RUN_GID}" "${WS}" "${CFG}"
find "${WS}" "${CFG}" -type d -exec chmod 775 {} \;
find "${WS}" "${CFG}" -type f -exec chmod 664 {} \; 2>/dev/null || true

echo "linkbot state ready under ${DATA_ROOT} (owner ${RUN_UID}:${RUN_GID})"
