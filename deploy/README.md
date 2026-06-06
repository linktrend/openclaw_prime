# LiNKbot-core deploy

Production OpenClaw gateway configuration for LiNKtrend studio VPS (`linkdroplet-00`).

Canonical fleet policy: `LiNKtrend-System/docs/ecosystem/FLEET_AND_RUNTIME_POLICY.md` and `LiNKdev/product/reports/linktrend-system/STUDIO_FORWARD_PLAN.md` Wave 1.

## Layout

| Path                 | Purpose                                                              |
| -------------------- | -------------------------------------------------------------------- |
| `prod/openclaw.json` | Gateway config mounted read-only into the container                  |
| `prod/workspaces/`   | Seed files for per-agent workspaces (SOUL, AGENTS, persona overlays) |
| `prod/.env.example`  | Non-secret deploy pointers and GSM secret names                      |

## Fleet v1 (five OpenClaw profiles)

Single `openclaw-gateway` process on linkdroplet-00:

| Profile                      | Tenant             | Role                                       |
| ---------------------------- | ------------------ | ------------------------------------------ |
| `admin-openclaw`             | Admin (vendor)     | Vendor executive + LiNKsuitegen suite head |
| `ceo-client`                 | Client (Linktrend) | Tenant CEO (default agent)                 |
| `linksites-head`             | Client             | LinkSites department head                  |
| `linkdeveloper-orchestrator` | Client             | LiNKdeveloper factory head                 |
| `linkdeveloper-steward`      | Client             | Product steward (per active product run)   |

Legacy profiles removed in Wave 1: `linksites-builder`, `linksites-ops`, `lisa`, `librarian`, `linksuitegen-orchestrator`, `linksuitegen-factory`.

## Models

| Scope                                                   | Model                                    |
| ------------------------------------------------------- | ---------------------------------------- |
| Head / CEO / steward (`agents.defaults.model`)          | `openrouter/anthropic/claude-sonnet-4-6` |
| OpenClaw sub-agents (`agents.defaults.subagents.model`) | `openrouter/anthropic/claude-haiku-4-5`  |

Sub-agents inherit the cheaper model for bounded burst work under suite heads. Explicit `sessions_spawn.model` overrides still win per OpenClaw config rules.

## VPS bootstrap

From `/opt/linktrend/linkbot-core`:

```bash
./ops/render-runtime-env-from-gsm.sh prod --output /opt/linktrend/runtime/linkbot-core/prod.env.runtime
./ops/bootstrap-linkbot-state.sh
docker compose -f docker-compose.deploy.yml up -d --build --remove-orphans
```

`bootstrap-linkbot-state.sh` seeds workspace files from `deploy/prod/workspaces/` into `/opt/linktrend/data/linkbot-core/state/workspace` without overwriting existing operator edits.

## bot-runtime → gateway

Set in rendered LiNKaios runtime env:

```text
OPENCLAW_AGENT_RUN_URL=http://openclaw-gateway:18789/v1/linktrend/agent-run
OPENCLAW_RUN_AUTH_BEARER=<same as OPENCLAW_LINKTREND_RUN_BEARER on gateway>
```

Both stacks attach **`linktrend-network`**. Do not use `localhost:18789` from inside LiNKaios containers.

## Smoke test (agent-run)

Replace `AGENT_ID` with each fleet profile:

```bash
curl -k -sS -X POST "https://linkbot.linktrend.internal/v1/linktrend/agent-run" \
  -H "Authorization: Bearer $OPENCLAW_RUN_AUTH_BEARER" \
  -H "Content-Type: application/json" \
  -d '{"message":"ping","idempotencyKey":"'"$(uuidgen)"'","agentId":"AGENT_ID","linktrendGovernance":{"bootstrap":{"traceCorrelationId":"smoke","authorizationState":"granted"},"approvedTools":{"toolNames":["read"]}}}'
```

Expect `"ok": true` and a `runId`. Model reply depends on OpenRouter keys in gateway runtime env.

## Local verification

```bash
LINKBOT_DATA_ROOT=/tmp/linkbot-smoke/state LINKBOT_RUN_UID="$(id -u)" LINKBOT_RUN_GID="$(id -g)" ./ops/bootstrap-linkbot-state.sh
OPENCLAW_CONFIG_PATH=deploy/prod/openclaw.json pnpm openclaw doctor
```
