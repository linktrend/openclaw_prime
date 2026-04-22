# LiNKtrend governance hooks (LiNKbot-core fork)

This repository is the **LiNKtrend-managed fork** of the OpenClaw engine baseline. Central governance, skills, memory, missions, and tool approval live in the proprietary monorepo (`bot-runtime`, LiNKlogic, etc.). The fork exposes **narrow runtime surfaces** so the wrapper can orchestrate workers without moving platform logic into the engine.

## What is implemented (Version 1)

1. **Gateway `agent` RPC extension** — optional `linktrendGovernance` object (validated by `AgentParamsSchema`). Same fields are accepted on `agentCommand` / `agentCommandFromIngress` as `opts.linktrendGovernance`.

2. **HTTP POST ingress for bot-runtime** — `POST /v1/linktrend/agent-run` on the gateway HTTP port (same port as WebSocket + Control UI). Accepts the same JSON body as the WebSocket `agent` method. Optional dedicated bearer auth via `OPENCLAW_LINKTREND_RUN_BEARER` or `gateway.linktrendAgentRun.bearerToken`; when unset, the gateway shared-secret HTTP auth flow applies (same trust model as `/tools/invoke`).

3. **Bootstrap gate** — If `bootstrap.authorizationState === "denied"`, the run is rejected before model execution. Optional config enforces presence of governance payload or explicit `granted` authorization.

4. **Mission + runtime instructions** — Structured mission and instruction payloads are merged into `extraSystemPrompt` as clearly labeled, session-bound blocks (not persisted as engine-owned truth). Monorepo shapes (`mission.id`, `mission.title`, runtime segments `label`/`text`) are accepted and normalized internally.

5. **Approved tool surface** — `approvedTools.toolNames` maps to the embedded runner **`toolsAllow`** list so only named built-in tools are exposed for that run.

6. **Structured lifecycle signals** — `emitAgentEvent` on stream `lifecycle` with `data.kind === "linktrend.gov"` and phases such as `bootstrap_check`, `bootstrap_accepted`, `bootstrap_denied`, `context_injected`, `capability_surface_set`. The monorepo should translate these into its shared observability model.

7. **Kill switch** — Use the existing per-run **`abortSignal`** on agent ingress / `AgentCommandOpts`; the embedded runner already honors abort.

8. **Hooks `/hooks/.../agent`** — Optional `linktrendGovernance` in the JSON body is forwarded: when present, the hook dispatches via `agentCommandFromIngress` with governance (same enforcement as gateway), instead of the isolated cron hook path alone.

## Config (`openclaw.json`)

### Governance policy

```json
{
  "linktrendGovernance": {
    "enabled": true,
    "requireIngressGovernancePayload": false,
    "requireBootstrapAuthorization": false,
    "requireMissionContext": false
  }
}
```

- **`enabled`**: Activates stricter validation paths when combined with the `require*` flags.
- **`requireIngressGovernancePayload`**: Every gateway `agent` call must include `linktrendGovernance`.
- **`requireBootstrapAuthorization`**: Governance payload must include `bootstrap.authorizationState: "granted"`.
- **`requireMissionContext`**: Governance payload must include a `mission` object.

### Recommended production posture

Set:

- `"enabled": true`
- `"requireIngressGovernancePayload": true` for any deployment where bot-runtime is expected to send slips.
- `"requireBootstrapAuthorization": true` when central policy always grants explicitly.
- `"requireMissionContext": true` only if every product path supplies mission context.

Failure modes:

- Missing governance when required → clear error from `resolveLinktrendGovernance` (ingress validation).
- Invalid JSON / schema → `400` from gateway validation with AJV error text.
- `bootstrap.authorizationState === "denied"` → model does not run; lifecycle shows `bootstrap_denied`.

### HTTP ingress (LiNKtrend worker URL)

```json
{
  "gateway": {
    "linktrendAgentRun": {
      "bearerToken": "your-shared-secret",
      "path": "/v1/linktrend/agent-run"
    }
  }
}
```

- **`bearerToken`**: Optional; if set (or env `OPENCLAW_LINKTREND_RUN_BEARER` is non-empty), POST requests must send `Authorization: Bearer <same secret>`. Align with monorepo `OPENCLAW_RUN_AUTH_BEARER`.
- **`path`**: Override path; default is **`/v1/linktrend/agent-run`**.

## Configure `OPENCLAW_AGENT_RUN_URL` (bot-runtime)

Point the worker at the gateway base URL plus the ingress path:

```text
OPENCLAW_AGENT_RUN_URL=http://127.0.0.1:18789/v1/linktrend/agent-run
```

Use HTTPS and a hostname when exposing beyond loopback. Set `OPENCLAW_RUN_AUTH_BEARER` in the worker to match `OPENCLAW_LINKTREND_RUN_BEARER` or `gateway.linktrendAgentRun.bearerToken`.

### Example curl (matches monorepo `agent_params`)

```bash
curl -sS -X POST "http://127.0.0.1:18789/v1/linktrend/agent-run" \
  -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "ping",
    "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000",
    "sessionKey": "agent:main:main",
    "linktrendGovernance": {
      "bootstrap": {
        "traceCorrelationId": "trace-1",
        "authorizationState": "granted"
      },
      "mission": { "id": "mission-uuid", "title": "Demo" },
      "runtimeInstructions": { "text": "Governance summary." },
      "approvedTools": { "toolNames": ["read"] }
    }
  }'
```

### Governance-only body (alternate)

The schema allows a minimal body:

```json
{
  "linktrendGovernance": {
    "bootstrap": { "authorizationState": "granted", "traceCorrelationId": "t1" },
    "approvedTools": { "toolNames": ["read"] }
  },
  "sessionKey": "agent:main:main"
}
```

Optional `idempotencyKey`; if omitted, the gateway generates one. The placeholder user message `(linktrend governance run)` is used unless you send a full `agent_params` body with `message`.

## RPC payload shape (LiNKtrend-compatible)

Monorepo field names are accepted alongside fork aliases:

```json
{
  "message": "ping",
  "idempotencyKey": "…",
  "sessionKey": "agent:main:default",
  "linktrendGovernance": {
    "bootstrap": {
      "workerIdentityRef": "dpr:worker:…",
      "authorizationState": "granted",
      "traceCorrelationId": "trace-…"
    },
    "mission": {
      "id": "mission-uuid",
      "title": "Display title",
      "missionId": "optional-alias",
      "summaryText": "Bounded objective text"
    },
    "runtimeInstructions": {
      "skillVersionRef": "skill/pkg@1.4.2",
      "text": "Centrally resolved instruction body.",
      "segments": [{ "label": "Step A", "text": "Do X." }]
    },
    "approvedTools": { "toolNames": ["read", "exec"] },
    "skillDeclaredTools": { "toolNames": ["read", "exec", "extra"] },
    "skillName": "pkg-name",
    "skillVersion": "1.0.0",
    "skillId": "uuid"
  }
}
```

`skillDeclaredTools` is audit-only (never expands `toolsAllow`). Denied bootstrap runs still emit `bootstrap_denied` before any model call.

## Anti-patterns

- **Do not** point `OPENCLAW_AGENT_RUN_URL` at a raw Control UI or unrelated path; use **`/v1/linktrend/agent-run`** (or your configured override).
- Hooks alone are not a substitute for documented ingress unless you intentionally POST `linktrendGovernance` to **`/hooks/<token>/agent`**; prefer the dedicated HTTP ingress for bot-runtime.

## Troubleshooting

| Symptom                                 | Likely cause                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `401` from POST ingress                 | Wrong or missing `Authorization: Bearer` when dedicated bearer is configured                            |
| `400 invalid agent params`              | Body does not match `AgentParamsSchema` (unknown keys under `additionalProperties: false`, wrong types) |
| `503 Gateway request context not ready` | Request hit HTTP before gateway finished startup (retry)                                                |
| Governance errors in logs               | `resolveLinktrendGovernance` threw (missing required mission, denied bootstrap, etc.)                   |

## What must not be added here (anti-drift)

Do **not** implement LiNKskills retrieval, LiNKbrain persistence, vault logic, dashboard semantics, or PRISM cleanup ownership in this fork. Keep those in the monorepo; this repo only **accepts** governed inputs and **signals** engine-local state.

## LiNKbrain virtual file HTTP bridge (LiNKaios) — not implemented in-engine

The monorepo can expose **published** virtual markdown and **retrieval** over HTTPS so this fork never needs Supabase credentials. There is **no first-party Linkbrain HTTP client** in this repository yet; runtime text arrives only via `linktrendGovernance.runtimeInstructions`. To add a small client later, call LiNKaios from a tool plugin with secrets in env only (`BOT_BRAIN_API_SECRET`).

## Programmatic imports

```ts
import {
  applyLinktrendGovernanceToAgentCommand,
  normalizeLinktrendGovernanceInbound,
  resolveLinktrendGovernance,
} from "openclaw";
```

These symbols are re-exported from the package root (`src/library.ts`) for monorepo wrappers and tests.
