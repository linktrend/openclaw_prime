# linkskills (structured telemetry + configurable transports)

Private OpenClaw consumer package for LiNKskills: contract fixtures, process/port-isolated
Skills fake, and a **default-disabled** plugin with durable telemetry outbox.

`transportMode` defaults to `disabled`. Fake is test-only. No conversation hooks.

## Layout

| Path                                                 | Role                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `openclaw.plugin.json` / `package.json` / `index.ts` | Default-disabled private plugin entry (`enabledByDefault: false`)                           |
| `src/`                                               | Config, allowlisted envelopes, keyed-store namespaces, enqueue/drain, transport adapters    |
| `mcp-tool-filter.ts`                                 | Managed MCP §9.2 `toolFilter.include` allowlist (default-deny)                              |
| `fixtures/`                                          | Sanitized contract fixtures (pending LiNKskills owner sign-off; see `fixtures/MANIFEST.md`) |
| `fake/`                                              | Deterministic Node ESM fake (HTTP ephemeral + stdio MCP)                                    |
| `../test/helpers/link-domain-fakes/skills-fake.ts`   | Test helper for in-process and child-process isolation                                      |

## Privacy invariant

- **Zero conversation hooks.** The plugin never registers message/prompt/agent conversation hooks and omits `hooks.allowConversationAccess`.
- Structured telemetry only; conversation/content/Brain/raw-tool fields are hard-rejected at enqueue.

## Transport modes

| Mode       | Behavior                                                                                                                                                                                                                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `disabled` | Default. Drain writes return `transport_disabled` (retryable).                                                                                                                                                                                                                                  |
| `fake`     | Test-only (`environment=test` + injection, or `fakeForTests`). Rejected in stage/production.                                                                                                                                                                                                    |
| `http`     | POST allowlisted `skills_*` ops to Gateway `POST {skillsEndpoint}/v1/{operation}` with envelope `{params,idempotency_key,request_id}` + SecretRef/machine-token bearer. `skillsEndpoint` is the Gateway HTTPS base (origin, optional safe mount prefix, or `/v1/...` paste stripped to origin). |
| `mcp`      | MCP client against `mcp.servers.<mcpServerName>` (default `linkskills`). Prefer SecretRef Authorization headers; oauth `authProfileId` alone returns `auth_profile_required`.                                                                                                                   |

### HTTP Gateway contract

Frozen against LiNKskills Gateway (`POST /v1/{operation}`):

- `skillsEndpoint` example (stage): `https://linktrend-mini.tailf7e13a.ts.net:9445`
- Request path: `/v1/{allowlisted operation}` only — telemetry drain remains restricted to drain ops; the native OAuth bridge separately permits its discovery/governed subset
- JSON body: `{ "params": <write arguments>, "idempotency_key": <write id>, "request_id": <write id> }`
- Also sends `Idempotency-Key` and `X-Request-Id` headers (Gateway accepts header or body)
- Auth, SSRF hostname pin, HTTPS fail-closed (non-test), and one bounded machine-token reissue on 401/403 are unchanged

## Frozen Skills drain ops

Drain maps structured `event_type` values onto exact §9.2 names:

- `skills_run_start` / `skills_run_update` / `skills_run_complete` / `skills_run_fail`
- `skills_feedback_submit` (default)
- `skills_trace_candidate_submit`

Conversation fields are never accepted.

## Independent flags (§12.2)

`mcpDiscoveryRead`, `governedExecution`, `telemetryEnqueue`, `telemetryDrain` — all default `false`.

## Native OAuth bridge

The optional `linkskills_use` tool lets native OAuth runtimes request only
frozen, allowlisted discovery or governed operations. `mcpDiscoveryRead` gates
discovery; `governedExecution` gates governed operations. PACI credentials
remain inside the plugin process and are never sent to the model runtime. The
tool uses either managed MCP or the configured HTTP Gateway; HTTP requires the
host-injected machine-token facade and never falls back to `skillsCredential`.

## Keyed-store namespaces (§11)

`outbox`, `deadletter`, `cursor`, `health` — `overflowPolicy: "reject-new"`.

## Fake capabilities

- All plan §9.2 `skills_*` tools from fixtures/catalog stub
- Hard rejection of conversation/content/Brain/raw-tool fields
- Auth matrix: expired, revoked, wrong-audience, wrong-scope
- Idempotency replay, retry hints, throttling
- Health + version negotiation

## In-memory limitation

The fake keeps runs, idempotency keys, and throttle counters **in process memory only**.
Restart clears state. Fake evidence never proves stage/production readiness, durable
Gateway storage, credential lifecycle, or Librarian operation.

## Run locally

```bash
# ephemeral HTTP (prints {baseUrl,port} then serves)
node extensions/linkskills/fake/cli.mjs http

# stdio MCP (one JSON-RPC object per line)
node extensions/linkskills/fake/cli.mjs stdio

# focused tests
node scripts/run-vitest.mjs extensions/linkskills/**/*.test.ts
```

## Not live proof

Do not enable against Lisa until Platform auth and activation gates pass.
