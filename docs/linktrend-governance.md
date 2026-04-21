# LiNKtrend governance hooks (LiNKbot-core fork)

This repository is the **LiNKtrend-managed fork** of the OpenClaw engine baseline. Central governance, skills, memory, missions, and tool approval live in the proprietary monorepo (`bot-runtime`, LiNKlogic, etc.). The fork exposes **narrow runtime surfaces** so the wrapper can orchestrate workers without moving platform logic into the engine.

## What is implemented (Version 1)

1. **Gateway `agent` RPC extension** — optional `linktrendGovernance` object (validated by `AgentParamsSchema`). Same fields are accepted on `agentCommand` / `agentCommandFromIngress` as `opts.linktrendGovernance`.

2. **Bootstrap gate** — If `bootstrap.authorizationState === "denied"`, the run is rejected before model execution. Optional config enforces presence of governance payload or explicit `granted` authorization.

3. **Mission + runtime instructions** — Structured mission and instruction payloads are merged into `extraSystemPrompt` as clearly labeled, session-bound blocks (not persisted as engine-owned truth).

4. **Approved tool surface** — `approvedTools.toolNames` maps to the embedded runner **`toolsAllow`** list so only named built-in tools are exposed for that run.

5. **Structured lifecycle signals** — `emitAgentEvent` on stream `lifecycle` with `data.kind === "linktrend.gov"` and phases such as `bootstrap_check`, `bootstrap_accepted`, `bootstrap_denied`, `context_injected`, `capability_surface_set`. The monorepo should translate these into its shared observability model.

6. **Kill switch** — Use the existing per-run **`abortSignal`** on agent ingress / `AgentCommandOpts`; the embedded runner already honors abort.

## Config (`openclaw.json`)

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

## RPC payload shape (illustrative)

```json
{
  "message": "…",
  "idempotencyKey": "…",
  "sessionKey": "agent:main:default",
  "linktrendGovernance": {
    "bootstrap": {
      "workerIdentityRef": "dpr:worker:…",
      "authorizationState": "granted",
      "traceCorrelationId": "trace-…"
    },
    "mission": {
      "missionId": "mission-123",
      "summaryText": "Bounded objective text"
    },
    "runtimeInstructions": {
      "skillVersionRef": "skill/pkg@1.4.2",
      "text": "Centrally resolved instruction body."
    },
    "approvedTools": {
      "toolNames": ["read", "exec"]
    }
  }
}
```

## What must not be added here (anti-drift)

Do **not** implement LiNKskills retrieval, LiNKbrain persistence, vault logic, dashboard semantics, or PRISM cleanup ownership in this fork. Keep those in the monorepo; this repo only **accepts** governed inputs and **signals** engine-local state.

## Programmatic imports

```ts
import { applyLinktrendGovernanceToAgentCommand, resolveLinktrendGovernance } from "openclaw";
```

These symbols are re-exported from the package root (`src/library.ts`) for monorepo wrappers and tests.

## LiNKbrain virtual file HTTP bridge (LiNKaios)

The monorepo can expose **published** virtual markdown (Pattern A) and **retrieval tiers** over HTTPS so this fork never needs Supabase credentials.

- **`POST /api/brain/published`** on LiNKaios — JSON body `{ "scope": "company" | "mission" | "agent", "logicalPath": "SOUL.md", "missionId"?: "<uuid>", "agentId"?: "<uuid>" }`. Header `Authorization: Bearer <BOT_BRAIN_API_SECRET>`. Response `{ "fileId": "<uuid> | null", "body": "<markdown>" }`.

- **`POST /api/brain/retrieve`** — JSON `{ "scope", "logicalPath", "query", "missionId"?, "agentId"?, "topK"? }` with the same bearer secret. Response matches `BrainRetrieveContextResult` from `@linktrend/linklogic-sdk` (index cards plus ranked chunk excerpts; semantic ranking when `GEMINI_API_KEY` is set on the server).

Implement a small HTTP client at the workspace read boundary if you want canonical files to mirror central truth; keep persistence and RLS ownership in the monorepo.
