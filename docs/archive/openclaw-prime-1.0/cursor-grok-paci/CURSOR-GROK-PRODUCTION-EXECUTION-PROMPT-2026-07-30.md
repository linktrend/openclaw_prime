# OpenClaw Prime PACI and LiNK Integration Execution Prompt

Use **Cursor Grok 4.5 High** for this entire task. Every subagent you spawn must also use **Cursor Grok 4.5 High**. Spawn as many useful Grok 4.5 High subagents as the environment permits and parallelize independent work aggressively, while keeping one primary agent responsible for integration, ownership, validation, and the final handoff.

The prompt file `docs/CURSOR-GROK-PRODUCTION-EXECUTION-PROMPT-2026-07-30.md` may initially appear as the sole untracked Principal-supplied control document. Preserve it, treat it as authorized input rather than conflicting work, and include it in the first cohesive documentation/implementation commit.

Continue PR #38 on branch `issue/ocp-openclawdevelopmentplan01` from exact starting HEAD `bf10d35847c20c5077335070e3599fe91a81a0de`. Before editing, verify branch, HEAD, upstream, status apart from this prompt, remotes, worktrees, stashes, dashboard, every active session in every worktree, and recent handoffs. If the tip advanced, inspect every added commit and proceed only when compatible and unowned; record the new authoritative start SHA. Never overwrite, rebase, merge, or discard another agent's work.

## Principal authority and coordination boundary

The Principal authorizes OpenClaw-owned implementation and local/fake proof of the generic public PACI machine-token/`client_credentials` seam. Platform decision D14 is now **yes** for this OpenClaw-owned work. Platform D12 is unlocked for Platform local/fake implementation and later controlled stage activation, but that does not let OpenClaw invent or operate Platform issuance.

The selected architecture is Platform-owned PACI: ES256 JWT access tokens carrying frozen AuthClaims, 15-minute lifetime, no refresh token, `private_key_jwt` client authentication, JWKS verification, and introspection for defined high-risk writes. OpenClaw owns the generic machine-token client, managed-MCP integration, public Plugin SDK seam, Brain/Skills adapter consumption, separate domain token lifecycle, and later authorized Lisa profile integration.

A separate active Lisa operational/model-evaluation workstream owns `.worktrees/lisa-ops01`, branch `issue/ocp-lisa-ops01`, `linkbots/lisa/Personality files/**`, Lisa operational templates/tests, and read-only model-routing evaluation. Do not edit, switch, merge, rebase, or inspect private runtime content from that worktree. Do not change Lisa models/providers, LLM routing, cron, heartbeat, digest, Ship/Pull, Repair Dispatcher, personality, memory, channels, LaunchAgents, or live workspace/profile in this task.

CI and Bugbot polling are deferred while the Principal repairs those systems. Do not start, rerun, poll, or wait for hosted CI/Bugbot. Never create paid resources or ongoing costs. Never delete/replace/recreate cloud state. Never print secrets. Do not mutate live Lisa or contact live Platform until the later combined integration gate.

## Required preflight and reading

Read in full before editing:

- root `AGENTS.md` and every scoped `AGENTS.md` for touched paths;
- `README.md`;
- `docs/agent-briefing.md`;
- `docs/agent-coordination.md`;
- `docs/current-status.md`;
- all active session records across worktrees;
- `docs/OPENCLAW-PRIME-LISA-LINKBRAIN-LINKSKILLS-DETAILED-IMPLEMENTATION-PLAN.md`;
- `docs/execution/openclawdevelopmentplan01/PLATFORM-PACI-OPENCLAW-COMPATIBILITY-HANDOFF-2026-07-30.md`;
- `docs/execution/openclawdevelopmentplan01/PHASE-5-DECISION-PACKET-PLATFORM-AUTH.md`;
- `docs/execution/openclawdevelopmentplan01/PHASE-13-PROVISIONAL-GROK-HANDOFF.md`;
- the AuthClaims 1.1 countersign closeout and final Phase 14 verification evidence;
- the latest Platform PACI ADR, frozen token envelope/schema, implementation handoff, conformance fixtures, and exact source HEAD;
- current Brain and Skills consumer contracts/handoffs.

Verify and record the OpenClaw plan SHA-256 `17203ee586a3fb2b1281bcddd8b17ae350075ebce537689f3c4bfcbbd14914f7`.

Before implementing protocol-specific behavior, require an exact versioned Platform PACI snapshot or explicit Platform-owner approval of a draft snapshot as the local/fake baseline. Record complete hashes and source HEAD. If absent, continue generic seam design/tests that do not invent Platform protocol, produce a narrow contract-delta packet, and resume protocol-specific work as soon as the owner handoff arrives. Never freeze Platform-owned semantics yourself.

Perform the repository's required existing-solution/dependency preflight. Inspect relevant maintained OAuth/JOSE libraries and direct dependency source/types before choosing an implementation. Reuse an adequate maintained library; do not implement cryptography.

## Parallel work allocation

Register one unique feature-agent session and exact ownership. Spawn Grok 4.5 High subagents for disjoint lanes:

1. Generic machine-token core/config/client-assertion/token lifecycle.
2. Managed MCP integration and interactive OAuth regression preservation.
3. Public Plugin SDK facade and package/export/surface contracts.
4. LiNKbrain adapter consumption and independent failure behavior.
5. LiNKskills adapter consumption and privacy/failure behavior.
6. Deterministic fake PACI server, adversarial/concurrency tests, docs, and evidence.

Shared core files must have one owner. Subagents must not touch the Lisa operations branch/worktree or live state. The primary agent personally reviews callers, callees, siblings, tests, public contracts, and dependency behavior before integration.

## Required implementation

### 1. Generic public machine-token capability

Implement the smallest reusable OpenClaw capability that securely supports PACI and other future standards-compliant machine-token issuers without hardcoding LiNK domain policy into generic core:

- RFC 8414 metadata discovery as required by the frozen PACI contract;
- OAuth `client_credentials` with `private_key_jwt`;
- canonical SecretRef bootstrap for client identity/signing-key references, never literal secrets;
- ES256 client assertions with strict audience/issuer/subject/expiry/`jti`, unique single-use assertion IDs, bounded lifetime, and injected-clock tests;
- 15-minute no-refresh access-token lifecycle, measured early renewal, expiry, invalidation, rotation, revocation, and process-restart behavior;
- single-flight/lease behavior preventing token storms across concurrent MCP and plugin HTTP demand;
- bounded deadlines and AbortSignal behavior with no abandoned mutation, lock release race, unhandled rejection, or infinite retry;
- one bounded reissue after matching 401/403 according to the frozen contract, never broadened scope or endless looping;
- independent provider/binding state, health, caches, and rollback per domain;
- strict TLS, SSRF, discovery/token endpoint origin rules, authorization-header same-origin rules, response bounds, redaction, and safe diagnostics;
- no browser, PKCE, interactive login, refresh token, shared credential, database credential, or private-key persistence.

Short-lived access tokens may live only in bounded process memory or an already approved canonical SQLite surface. No JSON/text/sidecar state and no SQLite schema-version bump without separate Principal approval.

Preserve all existing authorization-code/refresh-token MCP OAuth and non-PACI auth-profile behavior unchanged. Do not pretend static token/SecretRef rotation is equivalent to the new lifecycle.

### 2. Managed MCP integration

Integrate machine-token bindings with managed MCP through current public/canonical surfaces:

- just-in-time bearer acquisition/injection;
- independent Brain and Skills client IDs, audiences, services, operations/scopes, caches, refresh/reissue, failures, and diagnostics;
- operator tool filters remain the ceiling and plugin filters only narrow;
- auth invalidation affects only the matching domain/binding;
- config validation, doctor/inspect/health output, reload/restart semantics, and sanitized operator guidance;
- disabled configuration causes no discovery, mint, hook, drain, network call, or token state.

Do not weaken current MCP OAuth. Do not leak access tokens/client assertions in external projections, config snapshots, logs, errors, test fixtures, or diagnostics.

### 3. Public Plugin SDK seam

Add an intentional narrow typed Plugin SDK facade for plugin-owned HTTP transports to acquire/present domain-bound machine tokens without importing core internals:

- generic API/types, runtime injection, ownership, cancellation, diagnostics, and tests;
- package exports, entrypoint metadata, docs, and SDK surface checks;
- all bundled plugin consumers migrate to the modern seam in the same change where applicable;
- no extension-local duplicate token client and no core hardcoding of `linkbrain`/`linkskills` policy.

### 4. Brain and Skills consumers

Wire `extensions/linkbrain` and `extensions/linkskills` through the generic seam:

- Brain managed MCP and plugin HTTP capture/coordination use the separate Brain binding;
- Skills managed MCP and structured telemetry use the separate Skills binding;
- Brain and Skills credentials/audiences/operations/token state never cross;
- independent expiry/revocation/outage cannot disable the other domain or native OpenClaw;
- current durable buffers, bounded drains, lifecycle/privacy rules, MCP tool filters, default-disabled behavior, and owner-countersigned fixtures remain intact;
- Skills receives no conversation-bearing data;
- no aliases or fake success in stage/production.

If the frozen PACI contract changes fixture semantics, regenerate only through the approved contract process and obtain fresh Brain/Skills owner countersigns. Never self-countersign.

### 5. Deterministic fake/local proof

Build a deterministic local fake PACI issuer and prove:

- exact metadata/issuer/token/JWKS/introspection behavior;
- successful private-key client authentication;
- 15-minute/no-refresh lifecycle and early renewal;
- concurrent MCP+HTTP single-flight;
- assertion-`jti` uniqueness/replay rejection and access-token reuse while valid;
- wrong issuer/audience/scope/service/actor/binding/org/key/signature/algorithm/environment denial;
- malformed metadata/JWKS/token responses;
- unknown key, key rotation, credential rotation/revocation/suspension;
- timeout, abort, 429, 5xx, outage, recovery, and late settlement;
- resource 401/403 invalidation and one bounded reissue;
- Brain/Skills isolation and cross-domain credential rejection;
- no cross-origin authorization header;
- no secret/token/assertion in logs, diagnostics, state, config, screenshots, fixtures, or handoffs;
- interactive OAuth regression behavior;
- disabled-plugin and native OpenClaw coexistence.

Use injected clocks and deterministic keys that are unmistakably test-only. Never contact live services for fake/local proof.

### 6. Stage/Lisa integration preparation

Prepare, but do not apply, the authoritative Lisa integration packet:

- exact default-disabled Brain/Skills plugin and managed-MCP config fragments;
- separate SecretRefs/machine-token bindings and least-privilege operations;
- redacted backup, validation, health, probe, rollback, credential rotation/revocation, and incident commands;
- stage canary and production canary evidence templates;
- combined integration checklist with the separate Lisa ops/model branch;
- one-operator mutation order that preserves native memory, sessions, compaction, cron, heartbeat state, channels, skills, and Program authority.

Do not edit `~/.openclaw-lisa/**`, restart Lisa, change live credentials, enable plugins, contact Platform, or start Phases 7–12 in this packet unless a later explicit coordinated handoff assigns the live mutation after Platform stage and the Lisa ops branch are verified.

## Likely owned surfaces

Inspect and change only the smallest justified subset, including:

- `src/config/types.mcp.ts` and matching config schemas/help/labels;
- `src/agents/mcp-auth-profile.ts`, `mcp-transport.ts`, `mcp-oauth.ts`, `mcp-oauth-provider.ts`, and narrowly named new generic machine-token modules/tests;
- canonical secret resolution and shared state/lease helpers only when required;
- intentional `src/plugin-sdk/` facade plus entrypoint/package/surface metadata;
- `extensions/linkbrain/**` and `extensions/linkskills/**` focused consumers/tests;
- relevant generic docs and `docs/execution/openclawdevelopmentplan01/**` evidence;
- unique session and dated handoff files.

Do not modify `linkbots/lisa/Personality files/**`, `.worktrees/lisa-ops01/**`, live Lisa paths, provider/model routing, or unrelated PR #38 surfaces.

## Validation and handoff

Follow `$openclaw-testing`/repository rules. Use focused trusted local proof and an approved Testbox/Crabbox only if available without cost or conflict; otherwise record the unavailable backend and use proportionate trusted local evidence. Do not poll hosted CI/Bugbot.

At minimum run:

- focused machine-token/core auth tests;
- existing MCP auth-profile/OAuth/transport/config regression tests;
- focused linkbrain/linkskills transport, lifecycle, drain, privacy, and coexistence suites;
- Plugin SDK export/surface/boundary tests;
- `node scripts/check-changed.mjs -- <changed paths>`;
- required targeted `tsgo` lanes/build/package proof for changed boundaries;
- targeted formatting/lint through repository-approved wrappers;
- `git diff --check origin/development...HEAD`.

Record failures and reruns. Run a secret/redaction scan over changed code and evidence. Do not claim hosted CI green.

Commit cohesive changes and push the existing issue branch. Do not merge, rebase, force-push, change PR readiness, promote branches, deploy, or self-certify.

Update the Phase 13 handoff and create a complete dated implementation handoff containing exact start/code/clean pushed heads, changed files, public API/config changes, dependency proof, Platform contract pins/hashes, tests/failures/reruns, local/fake/stage/production separation, secrets/privacy proof, Lisa overlap boundary, prepared live packet, residual risks, rollback, and a coverage index for the approved plan without assigning Codex's seven-value classifications.

Close the implementation session cleanly and stop for independent OpenClaw Codex verification only after all currently possible OpenClaw-owned work is complete.
