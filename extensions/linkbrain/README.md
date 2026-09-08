# linkbrain (lifecycle capture + configurable transports, default-disabled)

Private bundled OpenClaw Brain adapter. **Default-disabled.** `transportMode` defaults to
`disabled`. Fake is test-only. HTTP/MCP adapters are opt-in and do not require live servers
at plugin start.

This directory does **not** mutate Lisa profile/credentials.

## Status

| Path                                                 | Role                                                                                                     |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `fixtures/`                                          | Sanitized JSON contracts (Phase 1; draft pending Brain owner sign-off)                                   |
| `fake/`                                              | Deterministic Node ESM fake: stdio MCP or localhost HTTP                                                 |
| `openclaw.plugin.json` / `package.json` / `index.ts` | Default-disabled plugin packaging (`enabledByDefault: false`, `onStartup: true` when explicitly enabled) |
| `src/`                                               | Outbox runtime, capture batching, §10.1 lifecycle mapping, transport adapters                            |
| `mcp-tool-filter.ts`                                 | Managed MCP §9.1 `toolFilter.include` allowlist (default-deny)                                           |

## Transport modes

| Mode       | Behavior                                                                                                                                                                                           |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `disabled` | Default. Drain writes return `transport_disabled` (retryable).                                                                                                                                     |
| `fake`     | Test-only (`environment=test` + injection, or `fakeForTests`). Rejected in stage/production.                                                                                                       |
| `http`     | POST tool calls to `ingestionEndpoint` with SecretRef bearer.                                                                                                                                      |
| `mcp`      | MCP client against `mcp.servers.<mcpServerName>` (default `linkbrain`). Prefer SecretRef Authorization headers; oauth `authProfileId` alone returns `auth_profile_required` until Gateway injects. |

Remote MCP URLs require HTTPS by default. A co-located production deployment may set
`allowProductionLoopbackHttp: true` to permit only the literal managed MCP URL
`http://127.0.0.1:18789/mcp`. This exception does not admit `localhost`, IPv6, other loopback
addresses, ports or paths, LAN/private/reserved addresses, public HTTP, URL credentials, query
strings, or fragments. The flag has no effect in stage and defaults to false.

## Frozen Brain write tool names

Lifecycle/outbox delivery uses **only** these frozen OpenClaw §9.1 names:

- `brain_capture_batch`
- `brain_checkpoint_write`
- `brain_task_update`

The Brain Gateway consumed by this plugin **must implement these exact names**. This adapter does
**not** remap to Brain's current shipped aliases (for example `brain_search_knowledge`). Alias
mapping is out of scope and must not be added here.

## Plugin behavior

- Opens only linkbrain namespaces: `outbox`, `deadletter`, `cursor`, `health`, `capture-buffer`
- `overflowPolicy: "reject-new"`
- Independent flags (§12.2): `mcpRead`, `captureEnqueue`, `captureDrain`, `coordinationWrites` (all default **false**)
- Registers plan §10.1 hooks: conversation/data-bearing set gated by `allowConversationAccess===true`; service hooks `gateway_start` / `gateway_stop` always when enabled
- Bounded local capture buffer; flush on batch limits and compaction/reset/end/gateway_stop
- Per-operation `AbortController` bounds independent of host hook timeouts
- Opaque actor/binding/session/task/run/subagent correlations only
- Brain failures degrade honestly — hooks never throw uncaught; native OpenClaw continues
- Optional `linkbrain_read` bridge: `brain_browse`, `brain_search`, and `brain_load` for native OAuth runtimes; PACI credentials remain inside the plugin process
- Separate optional `linkbrain_write` bridge: only `brain_capture_batch` and `brain_checkpoint_write`; it requires host-owned machine-token auth and never returns Brain result payloads

Native write access is additive and default-denied. Enable it for one agent with
`agents.list[].tools.alsoAllow: ["linkbrain_write"]`; do not replace the agent's normal profile
with a broad `tools.allow`. Capture additionally requires both `captureEnqueue` and
`captureDrain`; checkpoint writes require `coordinationWrites`. The bridge rejects actor/binding
overrides, unknown operations and fields, oversized payloads, invalid timestamps, duplicate or
unordered event sequences, and missing idempotency keys.

`linkbrain_write` additionally verifies the trusted current agent entry itself contains the exact
`tools.alsoAllow` value `linkbrain_write`; generic `tools.allow` grants such as `*`,
`group:plugins`, or the plugin id do not enable it. Checkpoint callers cannot supply `taskId`.
The factory derives it only from the out-of-band `toolBindings.linkbrain.taskId` attached to a
trusted session context, and fails closed when that binding or session identity is absent.

## Conversation access (required for Brain capture/coordination hooks)

Fail-closed: conversation/data-bearing §10.1 hooks register **only** when
`plugins.entries.linkbrain.hooks.allowConversationAccess===true`.

Governed hooks (blocked unless explicitly true):

- `session_start`, `message_received`, `agent_end`
- `before_compaction`, `after_compaction`, `before_reset`, `session_end`
- `subagent_spawned`, `subagent_ended`

Always registerable when the plugin is explicitly enabled (no conversation gate):

- service/worker: `gateway_start`, `gateway_stop`
- outbox service startup

Absent or `false` keeps the plugin able to open state/workers but does **not**
register capture/coordination lifecycle hooks (including `message_received`).

Operators enabling Brain capture/coordination must set:

```json
{
  "plugins": {
    "entries": {
      "linkbrain": {
        "enabled": true,
        "hooks": {
          "allowConversationAccess": true
        }
      }
    }
  }
}
```

Constant: `plugins.entries.linkbrain.hooks.allowConversationAccess=true`.

## Privacy exclusions

Never retained in envelopes or remote writes:

- chain-of-thought / reasoning
- system/developer prompt bodies
- secrets, tokens, API keys
- raw/unbounded tool output
- attachments / media / binary

## Fake usage

```bash
node extensions/linkbrain/fake/server.mjs --http
node extensions/linkbrain/fake/server.mjs --stdio
```

Shared test entry: `test/helpers/link-domain-fakes/brain-fake.ts`.

## Focused tests

```bash
node scripts/run-vitest.mjs extensions/linkbrain/**/*.test.ts
```

## Not live proof

Do not enable against Lisa or a live Brain endpoint from this plugin until activation gates pass.
