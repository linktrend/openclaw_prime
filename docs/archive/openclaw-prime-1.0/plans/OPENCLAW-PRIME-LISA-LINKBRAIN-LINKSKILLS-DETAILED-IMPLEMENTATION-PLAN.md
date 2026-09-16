---
summary: "Historical July 2026 two-provider Brain/Skills plan; superseded as Lisa five-provider authority by Item 3"
read_when:
  - Reading historical Lisa Brain/Skills planning provenance
  - Confirming Item 3 Wave A P-08 marked the two-provider plan non-current
title: "OpenClaw Prime/Lisa LiNKbrain and LiNKskills Implementation Plan (historical)"
---

# OpenClaw Prime/Lisa + LiNKbrain + LiNKskills Detailed Implementation Plan

> **Historical (Wave A Item 3):** This July 2026 two-provider Brain/Skills plan is
> retained for provenance only. It is **not** the current Lisa five-provider
> contract. It does not define Libraries or Autowork, and it still describes v1
> MCP tool families. Authoritative Lisa five-provider policy is the accepted
> Item 3 PRD and implementation plan on `issue/189` (`docs/ITEM-3-CONNECT-OPENCLAW-PRIME-LISA-PRD.md`,
> `docs/ITEM-3-CONNECT-OPENCLAW-PRIME-LISA-IMPLEMENTATION-PLAN.md`), with Wave A
> source under `linkbots/lisa/ops/providers/`.

**Status:** Historical / superseded as Lisa five-provider authority (Item 3 Wave A P-08)

**Scope owner:** OpenClaw Prime/Lisa

**Audience:** Principal, OpenClaw implementers, LiNKplatform, LiNKbrain, LiNKskills, Librarian, and operations owners

**Planning date:** 2026-07-27

**Planning confidence:** 99.5%

## 1. Purpose and Decision

This plan defines how the canonical Lisa actor will consume LiNKbrain and LiNKskills through OpenClaw Prime without replacing native OpenClaw behavior or merging the two domains.

The approved target is:

- one canonical Lisa actor;
- one Lisa OpenClaw runtime binding;
- one Brain plugin and one Skills plugin;
- one Brain managed MCP server and one Skills managed MCP server;
- Brain-only access to the minimum conversation-bearing lifecycle events required for capture, compaction safety, and coordination;
- Skills access only to contract-approved structured execution and tool telemetry;
- separate credentials, scopes, flags, state, outboxes, health, telemetry, retention, rollout, rollback, and evidence windows;
- Platform-owned identity, claims, credential lifecycle, infrastructure, secret injection, migrations, generic Librarian hosting, and audit;
- OpenClaw-owned plugin implementation, Lisa profile integration, tests, rollout, and operational evidence.

This is an additive Phase 1 integration. It preserves Lisa's existing local memory, compaction, sessions, cron, channels, native skills, and Program authority. LiNKbrain becomes an additional institutional-memory and coordination capability. LiNKskills becomes a separate governed skill discovery and execution capability. Neither becomes a hidden replacement for an existing OpenClaw subsystem.

No product code, runtime configuration, credential, deployment, migration, or live service change is authorized by this document alone.

## 2. Frozen Inputs and Source Hierarchy

Implementation must begin from the exact reviewed planning snapshots below. If a source changes, the owning team must provide a versioned contract delta before OpenClaw adopts it.

| Priority | Source                                                                                     | Reviewed snapshot                                                          | Authority in this plan                                                                                       |
| -------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1        | Principal decisions recorded in the OpenClaw planning session and handoffs                 | 2026-07-27                                                                 | Intent, privacy, ownership, rollout, and approval authority                                                  |
| 2        | LiNKplatform shared-foundation detailed implementation plan                                | SHA-256 `fbcf36235c4caaa6abf7ee93afedeedf105a96f6614a3a3ff5ccb8d78e33c6b9` | Actor identity, claims, credentials, environments, infrastructure, migrations, audit, generic Librarian host |
| 3        | LiNKbrain Phase 1 detailed implementation plan                                             | SHA-256 `051caa80191639c06b2dee6fa4800e736ada30772a55ad84e12e5fa6a4e63458` | Brain Gateway, tools, capture, coordination, curation, failure, retention, and rollout contracts             |
| 4        | LiNKskills internal-launch detailed development plan                                       | SHA-256 `31a6cc70bb778ce1dff236819e4bf600b0495dbb06c95bac55bcb2b0b2f5fe88` | Skills Gateway, immutable bundles, profiles, validation, telemetry, evidence, and rollout contracts          |
| 5        | Current OpenClaw source, tests, public plugin SDK, managed MCP, and operator documentation | OpenClaw `2026.7.2`, planning HEAD `ec90aa8cd119`                          | Available implementation seams and current Lisa integration behavior                                         |
| 6        | This plan                                                                                  | 2026-07-27                                                                 | OpenClaw-specific sequencing, file ownership, tests, rollout, operations, and acceptance                     |

Conflict rule:

1. Stop the affected work item; do not silently reinterpret a frozen upstream boundary.
2. Record the exact contract, owner, consumer, and impact.
3. Ask the owning upstream team for a narrow amendment or versioned delta.
4. Ask the Principal only when the conflict changes intent, privacy, risk, scope, ownership, cost, or definition of done.
5. Resume only after the decision is recorded in the appropriate plan and handoff.

## 3. Reconciliation Finding

The three upstream plans and current OpenClaw extension surfaces are mutually compatible. No upstream correction is required before implementation planning.

The apparent deployment dependency is resolved as follows:

- Platform may provision a service, binding, and domain credential while the corresponding Lisa actor flag remains disabled.
- OpenClaw may implement and test each plugin against frozen fakes before a live Platform environment exists.
- Platform environment readiness is a gate for live stage proof, not for contract-first implementation.
- Platform's domain milestone is not complete until the OpenClaw consumer canary succeeds.
- Brain may reach production before Skills.
- Skills may not begin the Lisa canary until the Cursor and Codex Skills readiness gates pass.

The remaining uncertainties are implementation gates, not unresolved architectural questions:

- stage and production Platform projects exist but are inactive; schema, data, migrations, backup, restore, and service deployment are unverified;
- the exact Platform token mechanism and encoding remain an ADR;
- Brain production retention durations require Principal approval;
- outbox capacity, retry timing, and ordinary canary event counts require measurements;
- Cursor's exposed process-argument credentials are an external launch-critical maintenance gate and are not reusable by OpenClaw.

## 4. Non-Goals and Hard Boundaries

This plan does not authorize or include:

- replacing OpenClaw local memory, memory compaction, heartbeat, cron, sessions, channels, native skills, or Program Ledgers;
- making GitHub, Git, a handoff folder, or LiNKbrain a live branch lock or synchronization database;
- combining Brain and Skills into one plugin, MCP server, credential, token, queue, state namespace, health state, telemetry stream, or rollback switch;
- sending raw conversations, messages, prompts, Brain findings, private episodes, tool inputs, tool outputs, or reasoning traces to Skills;
- prompt-only Skills certification, scoring, readiness, or live proof;
- giving OpenClaw database credentials or a production Supabase `service_role` credential;
- inspecting, copying, rotating, or reusing Cursor credentials exposed in process arguments;
- introducing JSON, JSONL, text, or sidecar files for runtime state or queues;
- advancing an OpenClaw SQLite schema version;
- importing private core modules from a plugin or adding owner-specific policy to generic core;
- creating a fallback that claims success when a Gateway, credential, queue, or evidence path is unavailable;
- publishing these private integration plugins to public npm or ClawHub in Phase 1;
- changing upstream Brain, Skills, or Platform contracts without their owner and a versioned amendment;
- implementation before the Principal approves this plan.

## 5. Current Baseline

### 5.1 OpenClaw

The reviewed OpenClaw version already provides the required generic primitives:

- managed MCP servers with independent enablement, transport, authentication, timeout, health, tool filter, and hot-apply behavior;
- plugin manifests, per-plugin config, startup diagnostics, and explicit trust controls;
- `hooks.allowConversationAccess` for conversation-bearing hooks;
- public plugin runtime helpers, including SQLite-backed keyed plugin state;
- owner-only OAuth token storage in the shared state database;
- `SecretRef`-compatible plugin configuration contracts;
- namespaced plugin tools, services, commands, hooks, and diagnostics;
- typed session, agent, message, compaction, reset, subagent, tool, cron, and gateway lifecycle events.

No new generic core capability is assumed in the initial implementation. If the public SDK cannot provide correct ordered and crash-safe outbox behavior after a focused prototype, the implementer must stop and propose the smallest generic SDK seam. It must not reach into core internals, use raw database access, or create a sidecar queue.

### 5.2 Lisa

The sanitized planning baseline showed:

- the `lisa` profile validates and its Gateway is reachable;
- configured local agent identities include `main`, `lisa-cron`, `cursor`, and `local-coder`;
- native memory uses the current local OpenClaw path and remains in place;
- native heartbeat is disabled and remains unchanged;
- Telegram, Google Chat, cron, sessions, and native skill inventory are present and remain in place;
- there are no managed MCP servers configured for Lisa;
- there is no `skills.load.extraDirs` LiNKskills integration;
- there is no verified live LiNKbrain or LiNKskills consumer wiring.

This baseline must be refreshed, sanitized, and recorded at implementation start. Do not copy message bodies, memory contents, tokens, OAuth material, or other private data into repository evidence.

### 5.3 Platform Environments

Stage and production Platform projects are recorded but inactive. Until the Platform owner proves environment readiness, OpenClaw work is limited to source implementation, local contract fakes, static validation, and trusted isolated tests.

A fake may prove OpenClaw behavior. It may not prove stage service availability, production service availability, real credential lifecycle, migration state, backup/restore, audit, or Librarian operation.

## 6. Canonical Actor and Runtime-Binding Mapping

Lisa is one canonical Platform actor. OpenClaw installations, runtime bindings, credentials, agents, sessions, channels, tasks, runs, cron executions, and subagents are subordinate records, not automatically new actors.

### 6.1 Required mapping

| OpenClaw concept                       | Platform concept                                      | Rule                                                                                              |
| -------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Lisa human-facing agent                | Canonical actor                                       | Exactly one stable Lisa actor ID                                                                  |
| Lisa OpenClaw profile and installation | Runtime binding                                       | Includes opaque host identity, environment, OpenClaw version, plugin versions, and binding status |
| Brain MCP client and Brain plugin      | Brain consumers on the Lisa binding                   | Use Brain-only credential family and scopes                                                       |
| Skills MCP client and Skills plugin    | Skills consumers on the Lisa binding                  | Use Skills-only credential family and scopes                                                      |
| `main` and `lisa-cron`                 | Subordinate local execution roles                     | Same Lisa actor; distinct agent/trigger metadata                                                  |
| Chat/channel session                   | Subordinate session                                   | Opaque session identity; no actor promotion                                                       |
| Cron execution, agent run, tool run    | Subordinate run                                       | Carries correlation and parent relationships                                                      |
| Transient subagent                     | Subordinate execution                                 | Same actor by default; parent session/run recorded                                                |
| Durable independent consumer           | Separate actor/binding only if Platform designates it | Must never inherit Lisa credentials by convenience                                                |

### 6.2 `cursor` and `local-coder` gate

Before credentials are issued, the implementer and Platform owner must classify `cursor` and `local-coder`:

- if they are helper roles executing under Lisa, keep them subordinate and attach the correct parent/session/run metadata;
- if either is a durable independent consumer, create a separate Platform actor and runtime binding outside this plan;
- in neither case may it silently inherit Lisa's Brain or Skills credential.

This is an acceptance classification, not a reason to create multiple Lisa actors.

### 6.3 Required claims

Every live domain credential must resolve to the Platform contract's minimum claims:

- contract version;
- canonical actor ID and actor kind;
- runtime binding ID;
- credential ID;
- organization or internal tenancy boundary;
- service and allowed operation scopes;
- issuer and audience;
- issued-at and expiry;
- optional Program and repository context;
- opaque correlation identity.

OpenClaw propagates only the minimum claim-derived context needed by the called domain. It does not mint canonical actor identity or authorize broader scopes locally.

## 7. Target Architecture

```text
Canonical Lisa actor
  |
  +-- Lisa OpenClaw runtime binding
      |
      +-- Native OpenClaw behavior (unchanged)
      |   +-- local memory and compaction
      |   +-- sessions and channels
      |   +-- cron and native skills
      |
      +-- linkbrain plugin (Brain-only trust boundary)
      |   +-- selected conversation lifecycle hooks
      |   +-- Brain SQLite outbox, cursors, dead letters, health
      |   +-- Brain managed MCP server
      |       +-- Brain-only endpoint
      |       +-- Brain-only credential and scopes
      |
      +-- linkskills plugin (no conversation access)
          +-- structured Skills lifecycle and tool telemetry only
          +-- Skills SQLite outbox, cursors, dead letters, health
          +-- Skills managed MCP server
              +-- Skills-only endpoint
              +-- Skills-only credential and scopes

Platform control plane
  +-- actor and runtime-binding registry
  +-- separate Brain and Skills credential lifecycle
  +-- environment and secret injection
  +-- migrations, audit, and generic Librarian hosting

Domain planes remain separate
  +-- LiNKbrain Gateway and Brain-owned data
  +-- LiNKskills Gateway and Skills-owned data/bundles
```

### 7.1 Plugin placement and packaging

Implement two thin bundled private-fork plugins:

- `extensions/linkbrain/`
- `extensions/linkskills/`

Each plugin must:

- depend only on public `openclaw/plugin-sdk/*` barrels and documented runtime helpers;
- contain a manifest, public entry point, narrow source modules, tests, and operator-facing diagnostics;
- remain default-disabled;
- introduce no root dependency unless core imports it or the bundled-runtime rule requires it;
- use generated inventory and build conventions already used by bundled plugins;
- update `.github/labeler.yml` and required GitHub labels because these are new plugin surfaces;
- use a sibling scoped `AGENTS.md` only if ongoing rules genuinely differ, and then add the required `CLAUDE.md` symlink;
- remain version-locked to the OpenClaw private fork for Phase 1.

The plugins are adapters, not alternate Gateways. They own OpenClaw lifecycle translation, durable delivery, local health, redaction, correlation, and feature flags. Domain authorization and business logic remain in their respective Gateways.

### 7.2 Managed MCP placement

Configure two independent entries under `mcp.servers`:

- `linkbrain`
- `linkskills`

Each entry must have its own:

- endpoint and transport;
- enabled flag;
- timeout and repeated-failure behavior;
- tool allow/filter policy;
- authentication configuration;
- health and probe evidence;
- change and rollback procedure.

The Brain plugin may submit batched capture events over a Brain HTTP endpoint when the frozen Brain contract requires a non-MCP ingestion path. That endpoint uses a Brain-only `SecretRef` and the same actor/binding claim family, but a separate credential ID or operation scope when required. It must never use the Skills credential.

### 7.3 Authentication compatibility gate

Preferred order:

1. Platform issues a domain-specific OAuth-compatible credential usable through OpenClaw's native MCP OAuth or auth-profile path.
2. Otherwise, the Platform-approved secret injector materializes a domain-specific `SecretRef` or environment reference without putting values in Git, OpenClaw JSON, documentation, logs, or process arguments.
3. If the Platform ADR selects a mechanism current public OpenClaw surfaces cannot consume securely, stop and raise a contract-compatibility decision. Do not paste a literal bearer token, reuse Cursor credentials, add a broad core authentication hack, or give OpenClaw database access.

Brain and Skills authentication are independently issuable, rotatable, revocable, expirable, observable, and testable. Revoking one domain must leave the other and native OpenClaw behavior functional.

## 8. Privacy and Information-Flow Contract

### 8.1 Brain allowed flow

The Brain plugin may receive the minimum conversation-bearing data needed to satisfy the frozen capture and coordination contract. It must set `hooks.allowConversationAccess: true` explicitly and document why each registered hook needs that access.

Allowed categories include:

- redacted user and assistant message content needed for approved capture;
- session, run, channel, actor-binding, and correlation metadata;
- compaction/reset/end boundaries needed to flush buffered capture;
- explicit findings, checkpoints, handoffs, and coordination actions invoked through Brain tools;
- success/failure state and bounded diagnostic metadata.

Excluded even from Brain capture:

- hidden chain-of-thought or model reasoning;
- system/developer prompt bodies unless an upstream contract and Principal approval explicitly require them;
- secret values, tokens, private keys, OAuth material, or credential payloads;
- unbounded raw tool outputs, attachments, or binary content;
- unrelated private memory, messages, email, or user data.

### 8.2 Skills allowed flow

The Skills plugin must not enable conversation access and must not register a hook whose event contains prompt, message, conversation, or content fields merely because the current hook gate does not classify that hook as conversation-bearing.

Skills may receive only contract-approved structured facts such as:

- skill requested, candidate set, selected skill, immutable release hash, and execution profile;
- run started, updated, completed, or failed;
- tool-resolution and tool-invocation identifiers;
- validation outcome, duration, retry class, and bounded error taxonomy;
- actor, runtime binding, session, task, run, and opaque correlation IDs;
- explicit user/operator feedback and trace-candidate metadata after redaction.

Skills must not receive:

- raw user or assistant messages;
- prompts or prompt fragments;
- Brain search results, findings, private episodes, captures, or handoffs;
- raw tool parameters or raw tool results;
- reasoning traces;
- credentials or secret-bearing environment/config values.

### 8.3 Skills instruction placement

LiNKskills invocation guidance must come from stable, non-conversation surfaces:

- MCP tool names, schemas, and descriptions;
- immutable skill bundle metadata and retrieved fragments;
- explicit operator or repository instructions reviewed as ordinary configuration/documentation;
- typed portable tool contracts.

Do not use `before_prompt_build`, `before_agent_run`, memory prompt supplements, or other dynamic conversation/prompt hooks for Skills. If later evidence shows a small generic static-guidance seam is required, propose it separately with a privacy proof; do not smuggle it through a conversation hook.

### 8.4 Cross-domain prohibition

Correlation is opaque and joinable only under Platform audit policy. OpenClaw must not:

- copy Brain payloads into Skills events;
- copy Skills telemetry into Brain knowledge by default;
- build a combined local or Platform datastore;
- use a shared queue, dead-letter record, cursor, health state, or idempotency namespace;
- derive one domain's authorization from the other's credential.

## 9. Tool and Contract Mapping

### 9.1 Brain managed tools

The `linkbrain` managed MCP entry exposes only the frozen Brain tool families allowed for Lisa:

- knowledge: `brain_browse`, `brain_search`, `brain_load`, `brain_append_finding`;
- private capture and episodes: `brain_capture_batch`, `brain_episode_checkpoint`, `brain_private_search`, `brain_private_load`;
- coordination: `brain_task_start`, `brain_task_update`, `brain_inbox_read`, `brain_conflict_respond`, `brain_message_send`, `brain_checkpoint_write`, `brain_handoff_create`, `brain_handoff_accept`, `brain_task_close`.

Every Brain write carries an idempotency key. `brain_task_start` retains the upstream transactional contract. Tool filters default-deny any unreviewed Brain tool.

### 9.2 Skills managed tools

The `linkskills` managed MCP entry exposes only the frozen Skills tool families allowed for Lisa:

- discovery: `skills_list`, `skills_search`, `skills_describe`, `skills_fragment_get`, `skills_release_get`;
- runs: `skills_run_start`, `skills_run_update`, `skills_run_complete`, `skills_run_fail`;
- tool mediation: `skills_tool_resolve`, `skills_tool_invoke`;
- validation: `skills_input_validate`, `skills_output_validate`;
- evidence: `skills_feedback_submit`, `skills_trace_candidate_submit`.

Lisa executes immutable published releases by exact hash and a compatible certified execution profile. Production must not execute a mutable Git checkout, an unpinned fragment, or a prompt-only certification result.

### 9.3 Contract fixtures

Before adapter logic, commit owner-approved sanitized fixtures for:

- positive and negative identity claims;
- expired, revoked, wrong-audience, and wrong-scope credentials;
- every enabled tool request/response and error class;
- Brain capture batches and lifecycle events;
- Skills structured telemetry and validation outcomes;
- duplicate idempotency keys and replay responses;
- retryable, terminal, throttled, and authentication failures;
- health and version negotiation;
- redaction boundaries and prohibited-field rejection.

Fixtures must contain no live identifiers, endpoints, messages, credentials, or private data.

## 10. Lifecycle Mapping

### 10.1 Brain lifecycle hooks

The Brain plugin should use the smallest proven set from the current typed lifecycle surface:

| OpenClaw lifecycle  | Brain action                                                     | Critical-path rule                                       |
| ------------------- | ---------------------------------------------------------------- | -------------------------------------------------------- |
| `session_start`     | Start or attach opaque session context                           | Local bookkeeping only                                   |
| `message_received`  | Enqueue approved redacted capture input                          | Durable local enqueue before return                      |
| `agent_end`         | Enqueue assistant outcome and run status                         | Do not perform an unbounded remote flush                 |
| `before_compaction` | Flush the current capture buffer and write a boundary checkpoint | Bounded; preserve native compaction if Brain is degraded |
| `after_compaction`  | Record compaction result metadata                                | Structured and bounded                                   |
| `before_reset`      | Flush pending capture and close/reset subordinate context        | Bounded; never block reset indefinitely                  |
| `session_end`       | Flush/close session capture state                                | Bounded; remainder stays durable                         |
| `gateway_start`     | Validate config, open state, start drain worker                  | No secret logging                                        |
| `gateway_stop`      | Stop intake, bounded drain, persist cursor/health                | Unsent records remain durable                            |
| subagent start/end  | Record parent/child execution linkage                            | Same canonical actor by default                          |

`before_agent_run` or `before_prompt_build` may be added only if a specific frozen Brain requirement cannot be met through the table above. The implementer must document the additional data exposure and prove it is necessary. A timeout does not guarantee underlying work cancellation, so every async hook must have its own abort/bounds and must not leave an unowned remote operation running.

### 10.2 Skills lifecycle collection

The Skills plugin observes only Skills-owned operations. Preferred inputs are explicit wrappers around `skills_*` MCP/tool calls and typed plugin-service callbacks, not broad capture of every OpenClaw tool.

If a generic tool hook is needed:

- filter by the exact Skills tool namespace before doing work;
- discard raw parameters and results;
- construct an allowlisted structured event;
- reject any unexpected content-bearing field;
- enqueue locally and return;
- prove through tests that non-Skills tools produce no Skills event.

### 10.3 Native lifecycle preservation

Brain or Skills degradation must not silently disable or replace:

- local memory writes and retrieval;
- compaction and reset;
- normal message delivery;
- existing cron jobs;
- channel operation;
- native skill loading;
- Program Ledger authority;
- user-visible session continuity.

High-risk actions may enter an explicit cautious or advisory mode when required evidence is unavailable. Ordinary low-risk conversation remains available with honest degraded-state reporting.

## 11. Durable State and Outbox Design

Each plugin uses its own SQLite-backed keyed store through the public plugin runtime. Initial namespaces:

| Plugin       | Namespace        | Purpose                                             |
| ------------ | ---------------- | --------------------------------------------------- |
| `linkbrain`  | `outbox`         | Ordered pending Brain deliveries                    |
| `linkbrain`  | `deadletter`     | Terminal Brain failures with redacted metadata      |
| `linkbrain`  | `cursor`         | Drain and lifecycle checkpoints                     |
| `linkbrain`  | `health`         | Last success/failure/degraded state                 |
| `linkbrain`  | `capture-buffer` | Bounded approved raw capture pending batch assembly |
| `linkskills` | `outbox`         | Ordered pending Skills events                       |
| `linkskills` | `deadletter`     | Terminal Skills failures with redacted metadata     |
| `linkskills` | `cursor`         | Drain and evidence checkpoints                      |
| `linkskills` | `health`         | Last success/failure/degraded state                 |

Rules:

- use `overflowPolicy: "reject-new"`; never silently evict undelivered evidence;
- keep each record below the runtime's value-size limit and enforce a lower domain-specific maximum;
- choose an explicit maximum entry count below the store cap after load testing;
- use sortable monotonic keys containing domain, runtime binding, event time, and collision-resistant suffix;
- include a domain-specific idempotency key on every remote write;
- drain in deterministic creation/key order;
- use a lease so only one plugin worker owns a drain attempt;
- complete async network planning before any SQLite transaction and never `await` inside a transaction callback;
- reread authoritative state before commit;
- delete an outbox record only after the Gateway confirms the idempotent write;
- classify terminal failures into the matching domain's dead-letter namespace;
- use bounded exponential backoff with jitter and server retry hints;
- persist next-attempt metadata so restart does not cause a retry storm;
- expose capacity, oldest age, retry count, dead-letter count, and last drain status without payloads;
- never fall back from SQLite to a file or in-memory success claim.

Brain capture-buffer retention follows the frozen Brain plan: the planning recommendation is deletion 30 days after successful processing, with approved holds up to 90 days. Production activation remains blocked until the Principal approves final durations. Skills uses its independently approved telemetry retention; it must not inherit Brain retention.

## 12. Configuration and Feature Flags

Configuration remains explicit and domain-separated.

### 12.1 Plugin configuration shape

Each plugin should define only the minimum settings that cannot be derived from the managed MCP entry, Platform claims, or stable defaults:

- enabled state;
- domain ingestion endpoint only if distinct from MCP;
- credential `SecretRef` for that endpoint;
- bounded batch size and flush interval;
- measured queue capacity and age alarm thresholds;
- domain feature flags;
- redaction policy version;
- stage/production environment identity.

Do not add an environment variable or config field when current managed MCP, plugin config, Platform injection, or a fixed contract default already solves it.

### 12.2 Independent flags

Minimum independently operable flags:

| Domain | Flag                | Effect when disabled                                                     |
| ------ | ------------------- | ------------------------------------------------------------------------ |
| Brain  | MCP read            | No Brain read tools; native OpenClaw continues                           |
| Brain  | capture enqueue     | No new capture records; existing outbox retained                         |
| Brain  | capture drain       | Stop Brain delivery; local durable queue retained                        |
| Brain  | coordination writes | Block Brain coordination mutations only                                  |
| Skills | MCP discovery/read  | No Skills discovery/retrieval; native skills continue                    |
| Skills | governed execution  | Block LiNKskills execution only                                          |
| Skills | telemetry enqueue   | No new Skills telemetry; execution policy follows approved degraded mode |
| Skills | telemetry drain     | Stop Skills delivery; local durable queue retained                       |

Flags must not be implemented as one shared `linkbrainSkillsEnabled` switch.

### 12.3 Change application

- managed MCP changes may use the supported hot-apply path after validation;
- plugin config and plugin code changes require a controlled Lisa Gateway restart;
- credential rotation follows Platform issuance, overlap, verification, and revocation order;
- no operator pastes a secret into a command line or process argument;
- every change has a same-domain rollback step and a proof that the other domain stayed unchanged.

## 13. Execution Governance

Every phase follows the repository coordination protocol before product work:

1. Register one unique active session record with platform, machine, surface, execution location, role, and Orchestrator key.
2. Refresh Git branch, tracking, remotes, worktrees, stash, dashboard, overlapping active records, and recent handoffs.
3. Use one task branch and a separate worktree/clone for simultaneous work.
4. Stop only the conflicting action if another session owns the same file, runtime, credential, service, or functional area.
5. Preserve unrelated and uncommitted work.
6. Record material decisions, evidence, owner, impact, and approval status during the work.
7. Submit a dated handoff and completed session record at every phase boundary.
8. Ask the matching Orchestrator to refresh the dashboard; do not treat the Orchestrator as a permission gate for a direct Principal assignment.

Each implementation phase must start by re-reading root `AGENTS.md`, every scoped `AGENTS.md`, `docs/agent-briefing.md`, `docs/agent-coordination.md`, `docs/current-status.md`, relevant active session records, and the latest domain handoffs. Dependency and external API behavior must be verified from current source/docs/types and live proof when feasible.

### 13.1 Four-agent execution model

Implementation is performed concurrently by four repository-specific Cursor agents using the Principal-assigned **Grok 4.5 High** model:

1. LiNKbrain execution agent;
2. LiNKskills execution agent;
3. LiNKplatform execution agent;
4. OpenClaw Prime execution agent.

Each execution agent requires:

- its assigned repository and only the ownership granted by that repository's plan and rules;
- a separate checkout or worktree where required by repository coordination or concurrent ownership;
- a dedicated implementation branch;
- an active session and ownership record;
- declared files and interfaces before editing;
- an implementation handoff suitable for independent verification.

The four execution agents may work concurrently against frozen contracts and fakes. Concurrency does not waive an interface gate or allow an agent to claim another repository's live evidence. Using Cursor as the development environment grants no authority to inspect, alter, or inherit shared/global Cursor configuration, credentials, or process state.

Within this plan, **OpenClaw Grok execution agent** means the fourth agent above. It is the sole implementation owner for OpenClaw plugins, hooks, MCP integration, outboxes, Lisa profile changes, OpenClaw tests, and OpenClaw rollout evidence, subject to the approved cross-repository contracts.

### 13.2 Independent verification model

Four **Codex 5.6 Sol Medium** agents independently verify the matching repository implementations:

1. LiNKbrain Codex verifier;
2. LiNKskills Codex verifier;
3. LiNKplatform Codex verifier;
4. OpenClaw Prime Codex verifier.

The LiNKbrain Codex verifier is also the coordinating verifier. After all four independent reports exist, it reconciles the verified results across the four plans and sends the combined conclusion to the Principal.

A Grok completion report is provisional until the matching Codex verifier examines the actual implementation and evidence. The OpenClaw Codex verifier:

- must not accept the OpenClaw Grok summary, claims, or checklists as proof;
- must inspect actual code, configuration, tests, runtime evidence, stage evidence, production evidence, rollout, rollback, and coverage of this complete plan;
- must report deficiencies through bounded correction work packets assigned to the original OpenClaw Grok owner;
- must not silently edit, repair, finish, or take over implementation unless the Principal explicitly changes the role assignment;
- must preserve the distinction between independent verification and implementation ownership.

The OpenClaw Grok execution agent may demonstrate and explain its work, but it must not certify its own implementation or mark the independent verification gate passed.

### 13.3 Plan-conformance classifications

The OpenClaw Codex verifier must classify every task, phase, test, gate, risk, evidence requirement, and definition-of-done item as exactly one of these seven values:

1. `implemented and proven`;
2. `implemented but not proven live`;
3. `partially implemented`;
4. `omitted`;
5. `implemented differently from plan`;
6. `blocked by another repository or interface`;
7. `outside the execution agent's ownership`.

No planned item may be left unclassified, grouped under an ambiguous status, or inferred complete from an execution summary. For each item, the verifier records the classification, evidence location, implementation owner, verifier conclusion, deficiency if any, and next action. Only `implemented and proven` satisfies a proof-bearing item. `Outside the execution agent's ownership` still requires the owning repository and its independent verification report before a cross-plan gate can pass.

### 13.4 Repository ownership matrix

| Surface                                              | LiNKbrain                 | LiNKskills           | LiNKplatform               | OpenClaw Prime                 |
| ---------------------------------------------------- | ------------------------- | -------------------- | -------------------------- | ------------------------------ |
| Brain Gateway, `brain_*`, domain behavior            | Own                       | No change            | Host/foundation support    | Consume                        |
| Skills Gateway, `skills_*`, domain behavior          | No change                 | Own                  | Host/foundation support    | Consume                        |
| Canonical actor identity and credentials             | Requirements/tests        | Requirements/tests   | Own/operate                | Consume/map                    |
| Domain migration source                              | Own `lbrain`              | Own `lskills`        | Review/apply/operate live  | No change                      |
| Generic Librarian host                               | Supply Brain worker       | Supply Skills worker | Own/integrate/operate      | No change                      |
| OpenClaw plugins, hooks, MCP, outboxes, Lisa profile | Contracts/tests only      | Contracts/tests only | Identity/hosting support   | Sole implementation owner      |
| Shared Codex host configuration                      | Default integration owner | Fragment/tests only  | Identity/endpoints         | No change                      |
| Cursor Skills product canary                         | No change                 | Own                  | Identity/endpoints         | No change                      |
| Program permission to act                            | Never                     | Never                | Capability foundation only | Respect host/Program authority |

Cross-repository ownership transfers require a coordinated work packet that names the exact files, owner, branch/worktree, contract inputs, acceptance criteria, and required handoff. A message, summary, shared development environment, or blocked dependency does not transfer ownership.

### 13.5 Approved-plan deviation control

If the OpenClaw Grok execution agent believes a deviation is necessary, it must:

1. stop dependent work;
2. document the proposed deviation and reason;
3. identify every affected plan, repository, interface, environment, and file;
4. send the deviation packet to the OpenClaw Codex verifier and LiNKbrain coordinating verifier;
5. wait for a recorded plan-level decision before dependent integration proceeds.

Execution convenience, schedule pressure, an unavailable dependency, or a passing local test does not authorize architecture, privacy, ownership, credential, evidence, canary, rollout, or rollback changes. Approved deviations must amend the relevant plan/version and be visible to all four execution and verification agents.

## 14. Cross-Plan Interface Gates

Agents may implement concurrently against frozen contracts and fakes, but no agent may claim a live gate passed without the named owner's independently verifiable evidence.

1. **Platform identity and credential gate.** LiNKplatform owns canonical actor/runtime-binding records, claims, separate Brain/Skills credential lifecycle, issuer/audience/scope behavior, and secret injection. Brain, Skills, and OpenClaw supply requirements and tests; the Platform Codex verifier confirms the implementation and evidence.
2. **Brain contract, fake, and conformance gate.** LiNKbrain owns the versioned Brain contract, fake, tool/domain behavior, idempotency, capture, coordination, and conformance evidence. OpenClaw may consume the frozen fake but cannot declare the Brain contract implemented.
3. **Skills contract, fake, certification-profile, and conformance gate.** LiNKskills owns the versioned Skills contract, fake, immutable bundles, certified execution profiles, domain behavior, and conformance evidence. OpenClaw cannot replace execution-backed certification with prompt evidence.
4. **Platform migration and environment-readiness gate.** LiNKplatform reviews/applies/operates live migrations and proves schema/data state, services, backup/restore, audit, Librarian host, and stage/production readiness. Repository fakes do not pass this gate.
5. **OpenClaw implementation-ownership gate.** Only the OpenClaw Grok execution agent implements OpenClaw plugins, hooks, managed MCP entries, outboxes, Lisa profile/configuration, OpenClaw tests, and rollout work. Other agents provide contracts, fixtures, and review rather than editing OpenClaw-owned surfaces.
6. **Brain Lisa stage and production gate.** Brain owner, Platform owner, OpenClaw owner, their matching verifiers, and operations must accept the applicable Brain contract, environment, credential, privacy, retention, canary, failure/recovery, rollback, and real-activity evidence.
7. **Skills Cursor and Codex readiness gate before Lisa Skills.** The Skills owner and matching independent verifiers must prove Cursor and Codex readiness before the Lisa Skills canary starts. Lisa evidence cannot substitute for those consumer gates.
8. **Skills certified-profile and Lisa stage/production gate.** LiNKskills supplies verified immutable releases and certified profiles; Platform supplies identity/endpoints; OpenClaw proves Lisa consumption, structured telemetry, privacy, canary, and rollback under independent verification.
9. **Production credential and authoritative Lisa-profile mutation gate.** Platform issues the production domain credential; the authorized OpenClaw operator performs and records the authoritative Lisa-profile mutation. No execution agent may infer permission from stage success, shared Cursor access, or credential availability.
10. **Independent repository verification gate.** Each Codex verifier must inspect the matching repository's actual implementation and issue a complete seven-classification report. A Grok handoff alone cannot pass this gate.
11. **Four-plan reconciliation and Principal acceptance gate.** The LiNKbrain Codex coordinating verifier reconciles all four independently verified reports, deviations, correction packets, and remaining contradictions. Only the Principal accepts final completion.

## 15. Phased Implementation Plan

Phases are deliberately gated. A later phase may prepare fixtures or documentation, but it may not claim an earlier gate or live environment has passed. The OpenClaw Grok execution agent owns OpenClaw implementation work in Phases 0 through 13. Phase 14 belongs only to the OpenClaw Codex verifier. Phase 15 belongs to the LiNKbrain Codex coordinating verifier, with final Principal acceptance.

### Phase 0 — Approval, Snapshot, and Ownership Freeze

**Objective:** convert this proposal into an authorized, reproducible execution packet.

**OpenClaw owner:** OpenClaw Prime Orchestrator plus assigned feature agent

**External owners:** Principal and the three upstream plan owners

**Work:**

- obtain explicit Principal approval of this plan;
- record exact commits/hashes for OpenClaw and all three upstream plans;
- obtain versioned contract/schema artifacts and named owners for Brain, Skills, and Platform;
- freeze the two-plugin/two-MCP, Brain-only conversation access, and independent-domain boundaries;
- create the implementation branch/worktree and coordination records;
- inventory active work for overlap;
- identify CODEOWNERS/maintainers for new plugins, public SDK, auth, MCP, runtime state, and Lisa profile;
- record the environment, credential, migration, retention, and external Cursor gates.

**Deliverables:** approved plan reference, execution packet, owner matrix, frozen hashes, initial risk register.

**Exit gate:** Principal approval is recorded; every contract has a version and owner; no unresolved ownership collision; no implementation begins earlier.

**Rollback:** close the implementation packet without product changes.

### Phase 1 — Contract and Fake Freeze

**Objective:** prove OpenClaw can implement the approved contracts without relying on an unavailable live Platform environment.

**OpenClaw owner:** plugin feature agent

**External owners:** Brain Gateway, Skills Gateway, Platform identity/credentials

**Work:**

- create sanitized versioned fixtures described in Section 9.3;
- build deterministic Brain and Skills fake servers that are process- and port-isolated;
- implement fake authentication outcomes, idempotency, retry hints, throttling, revocation, health, and version negotiation;
- ensure the Skills fake rejects conversation/content fields;
- ensure the Brain fake rejects secret/reasoning/unbounded payload categories;
- specify exact MCP tool filters and expected schemas;
- decide, with Platform, the preferred OAuth/auth-profile or secret-injection mechanism;
- prototype public keyed-store lease and ordered-drain semantics with no product behavior;
- measure record size, transaction behavior, and ordering under restart/concurrency;
- stop for a generic SDK proposal if correct semantics are impossible through public surfaces.

**Deliverables:** contract fixture package, fakes, compatibility matrix, outbox prototype findings, auth ADR linkage.

**Tests:** contract parse tests, negative-field tests, duplicate/replay tests, auth matrix, deterministic ordering, fake crash/restart, cross-domain rejection.

**Exit gate:** both domain owners approve fixtures; Platform approves the auth consumption path; current public OpenClaw surfaces are sufficient or an approved generic SDK prerequisite exists.

**Rollback:** remove only the fixture/fake branch changes; no Lisa or live service state exists.

### Phase 2 — Brain Plugin Skeleton and Local State

**Objective:** add a default-disabled Brain adapter with no live endpoint and no Lisa activation.

**Primary files:** `extensions/linkbrain/**`, generated plugin inventory/build metadata, `.github/labeler.yml`, focused tests.

**Work:**

- add manifest, entry point, config schema, secret-input contract, diagnostic surface, and default-disabled registration;
- explicitly require `hooks.allowConversationAccess: true` when Brain hook features are enabled;
- implement typed internal event envelopes and allowlist redaction;
- open only `linkbrain` keyed-store namespaces;
- implement deterministic enqueue, lease, drain, retry, dead-letter, health, and shutdown behavior against the fake;
- implement idempotency keys and replay-safe acknowledgements;
- implement independent Brain flags;
- add capacity and oldest-age diagnostics without payload exposure;
- keep remote I/O off ordinary message critical paths;
- prove plugin disable/uninstall leaves native OpenClaw behavior unchanged.

**Tests:** manifest/config validation, secret redaction, state isolation, ordering, duplicate/replay, lease contention, retry/backoff, restart recovery, overflow rejection, dead-letter, shutdown, plugin-disabled baseline.

**Exit gate:** focused tests pass; no core-private import or file state exists; plugin is default-disabled; no live Lisa change.

**Rollback:** disable/remove the Brain plugin registration; its plugin-owned SQLite entries may be retained for diagnosis or purged through an approved operator action.

### Phase 3 — Brain Lifecycle Capture and Coordination Mapping

**Objective:** translate approved OpenClaw lifecycle events into the frozen Brain contract.

**Work:**

- implement the hook table in Section 10.1 one event at a time;
- add bounded local capture batching and compaction/reset/end flush boundaries;
- implement AbortController and per-operation bounds independent of host hook timeouts;
- exclude chain-of-thought, prompt bodies, secrets, raw large tool output, and attachments;
- map opaque actor/binding/session/task/run/subagent correlations;
- expose Brain MCP tools through the managed entry fake and enforce allowlists;
- preserve native compaction, reset, message delivery, local memory, cron, and channels during every Brain failure mode;
- implement high-risk cautious/advisory behavior only where the frozen Brain contract requires it;
- test all coordination writes with idempotency and task-start transaction semantics at the Gateway boundary.

**Tests:** each lifecycle hook, duplicate callbacks, compaction race, reset race, gateway stop with backlog, hook timeout with uncancelled-work prevention, subagent parentage, secret canaries, native behavior invariants, coordination tool contract suite.

**Exit gate:** Brain fake evidence shows loss-bounded durable capture and correct coordination; privacy suite proves exclusions; native OpenClaw regression suite passes.

**Rollback:** disable Brain hook flags and drain; retain the managed MCP read path only if separately approved and healthy.

### Phase 4 — Skills Plugin Skeleton and Structured Telemetry

**Objective:** add a default-disabled Skills adapter that never receives conversation content.

**Primary files:** `extensions/linkskills/**`, generated plugin inventory/build metadata, `.github/labeler.yml`, focused tests.

**Work:**

- add manifest, entry point, config schema, secret-input contract, diagnostic surface, and default-disabled registration;
- omit `hooks.allowConversationAccess` or set it false;
- prohibit registration of all conversation/prompt/message-bearing hooks;
- implement allowlisted structured event envelopes;
- open only `linkskills` keyed-store namespaces;
- implement independent enqueue, lease, drain, retry, dead-letter, health, and shutdown behavior against the Skills fake;
- expose exact immutable release and certified execution-profile fields;
- implement independent Skills flags;
- prove Brain and non-Skills tool activity creates no Skills event;
- keep stable invocation guidance in MCP schemas/descriptions and immutable Skills artifacts, not dynamic prompt hooks.

**Tests:** hook-registration privacy invariant, prohibited-field rejection, non-Skills silence, state isolation, ordering, replay, retry, restart, overflow, dead-letter, bundle hash mismatch, profile mismatch, plugin-disabled baseline.

**Exit gate:** Skills fake accepts only structured telemetry; raw content canaries never appear; no conversation hook is registered; native skills remain unchanged.

**Rollback:** disable/remove the Skills plugin registration; Brain and native skills remain functional.

### Phase 5 — Managed MCP Integration and Authentication

**Objective:** connect both default-disabled plugins to two independent managed MCP clients using non-secret configuration.

**Work:**

- add Lisa configuration templates or operator patches for `mcp.servers.linkbrain` and `mcp.servers.linkskills` without values;
- set independent tool filters, timeouts, health thresholds, and enabled flags;
- bind each server to its separately issued credential reference;
- bind any Brain ingestion endpoint to a Brain-only `SecretRef`;
- validate issuer, audience, binding, actor, service, operations, expiry, and revocation behavior;
- prove missing or invalid auth omits/degrades only the affected server;
- prove repeated-failure pause and recovery independently;
- document supported hot-apply versus restart boundaries;
- add operator commands that never echo secret values.

**Tests:** wrong audience/scope/binding, expired/revoked credential, rotation overlap, one-domain logout/revocation, network/TLS failure, tool filtering, server pause/recovery, other-domain continuity.

**Exit gate:** fake-backed MCP and auth suites pass independently; Platform approves claim propagation and credential references; no literal credential exists in source/config/process arguments.

**Rollback:** disable the affected MCP entry and plugin domain flags; revoke only that domain credential.

### Phase 6 — Integrated Local and Isolated QA

**Objective:** validate the complete OpenClaw integration against deterministic fakes before Platform stage exists.

**Work:**

- run both plugins and both fake MCP servers together;
- exercise native local memory, compaction, sessions, cron, channels, and native skills concurrently;
- inject domain-specific latency, throttling, malformed responses, crashes, restart, stale credential, queue pressure, and disk/store limits;
- prove opaque correlation without payload crossing;
- prove independent enable, disable, drain, rollback, and recovery;
- measure hook latency, enqueue latency, record size, drain throughput, queue growth, and restart time;
- set initial evidence thresholds from measurements and document rationale;
- run trusted heavy suites on the selected Testbox/Crabbox path in accordance with root policy.

**Required failure/recovery scenarios:**

- Brain unavailable while Skills and native OpenClaw remain healthy;
- Skills unavailable while Brain and native OpenClaw remain healthy;
- both unavailable while native OpenClaw remains available in honest degraded mode;
- Brain credential revoked; Skills credential still works;
- Skills credential revoked; Brain credential still works;
- plugin process/Gateway restart with both outboxes pending;
- queue capacity reached with explicit reject-new state;
- duplicate delivery and replay;
- Platform audit/correlation rejection;
- Brain content sent to Skills is rejected before transmission;
- secret canary introduced at every ingress is absent from logs/state/events.

**Exit gate:** all mandatory scenarios pass; performance budgets are justified; no privacy or cross-domain violation; owner review confirms this is the best bounded implementation, not merely a plausible one.

**Rollback:** return both plugins and MCP entries to disabled; preserve only sanitized test artifacts.

### Phase 7 — Platform Stage Readiness Gate

**Objective:** prove stage is a real, recoverable environment before any Lisa stage canary.

**Platform-owned evidence:**

- active stage project and service endpoints;
- migration ledger and current schema/data state;
- least-privilege Brain and Skills credential issuance, rotation, revocation, expiry, issuer, audience, and scopes;
- runtime binding and Lisa actor records;
- secret injection with no process-argument exposure;
- backup and restore proof;
- audit and opaque correlation proof;
- generic Librarian host readiness for Brain;
- health, alerting, incident owner, and environment rollback;
- exact recovery-versus-replacement decision after inventory, with Principal involvement if required by the Platform gate.

**OpenClaw work:** validate contract versions and endpoints, run no-secret probes, and compare stage behavior with frozen fixtures.

**Exit gate:** Platform owner signs stage readiness; OpenClaw verifies both independent credentials and health paths; fakes are no longer cited as environment proof.

**Rollback:** Platform disables Lisa bindings/credentials; OpenClaw remains fake-tested and default-disabled.

### Phase 8 — Brain Stage Shadow and Write Canary

**Objective:** establish Brain first, starting with observation and then bounded writes.

**Sequence:**

1. Enable Brain MCP health and contract probes with actor features off.
2. Enable Brain read tools for designated test sessions.
3. Enable capture enqueue with drain off and inspect local capacity/age.
4. Enable stage drain for approved redacted scenarios.
5. Enable coordination writes for bounded scenarios.
6. Exercise Librarian ingestion/curation paths without claiming automatic canonical promotion by the originating agent.
7. Run every mandatory Brain stage failure/recovery scenario at least once.
8. Observe for at least three active operating days and required event/scenario counts, whichever is longer.

**Evidence minimums:** successful reads, loads, append findings, private capture batches, compaction/reset/end flushes, task start/update/close, handoff create/accept, duplicate replay, revocation/recovery, restart recovery, queue drain, redaction, native behavior continuity. Ordinary event count thresholds are set from Phase 6 measurements and approved before the window starts.

**Window rule:** a Brain failure restarts only the Brain window unless it exposes shared Platform/OpenClaw risk.

**Exit gate:** Brain owner, Platform owner, OpenClaw owner, and operations accept the stage evidence; Principal-approved retention is not yet required for stage if stage deletion policy is bounded and documented, but it is required before production writes.

**Rollback:** disable Brain writes/drain, revoke stage Brain credential if needed, preserve Skills state and native OpenClaw.

### Phase 9 — Skills Stage Canary

**Objective:** establish governed Skills use after its cross-consumer readiness prerequisites pass.

**Hard prerequisite:** Skills Cursor and Codex readiness gates are complete and recorded. Lisa may not be used to substitute for those proofs.

**Sequence:**

1. Enable Skills health and discovery against stage with actor execution flags off.
2. Prove exact immutable release retrieval and certified profile compatibility.
3. Enable bounded governed execution for approved scenarios.
4. Enable structured telemetry enqueue, then drain.
5. Exercise feedback and trace-candidate submission without raw conversation content.
6. Run every mandatory Skills stage failure/recovery scenario at least once.
7. Observe for at least three active operating days and required run/event counts, whichever is longer.

**Evidence minimums:** list/search/describe/fragment/release, run start/update/complete/fail, tool resolve/invoke, input/output validation, feedback, trace candidate, hash mismatch rejection, profile mismatch rejection, credential revocation/recovery, restart recovery, queue drain, and zero prohibited fields.

**Window rule:** a Skills failure restarts only the Skills window unless it exposes shared Platform/OpenClaw risk.

**Exit gate:** Skills, Platform, OpenClaw, and operations owners accept non-prompt, execution-backed stage proof.

**Rollback:** disable Skills execution/telemetry and revoke the stage Skills credential if needed; Brain and native OpenClaw remain unchanged.

### Phase 10 — Integrated Stage Soak and Operational Rehearsal

**Objective:** prove the domains coexist under real stage conditions and operators can recover them independently.

**Work:**

- run approved Brain and Skills workloads concurrently;
- verify no shared state, credential, correlation payload, or coupled health transition;
- rotate Brain and Skills credentials separately;
- rehearse plugin disable, MCP disable, queue pause, drain resume, dead-letter inspection, credential revocation, and Gateway restart;
- rehearse Platform service rollback and OpenClaw same-domain rollback order;
- exercise backup/restore and audit retrieval without inspecting private payloads;
- verify alerts route to named owners and contain no sensitive data;
- validate handoff, dashboard, and Program evidence ownership.

**Exit gate:** integrated mandatory scenarios pass; runbooks are executable by an operator other than the implementer; no open severity-one privacy, identity, data-loss, or native-regression risk.

**Rollback:** rollback the affected domain first; rollback shared Platform only if evidence proves a shared fault.

### Phase 11 — Brain Production Deployment and Canary

**Prerequisites:**

- Principal approves Brain production retention and hold durations;
- Platform production environment, migration, backup/restore, audit, Librarian, secret injection, and credential lifecycle are proven;
- production Brain credential is least-privilege and distinct from stage and Skills;
- Brain stage exit and integrated operational rehearsal are accepted;
- owner-approved production change and rollback window exists.

**Sequence:** deploy service/binding with actor flags off; validate health and contract; enable Brain read; enable bounded capture; enable coordination; monitor queue/latency/privacy/native behavior; run approved production recovery exercises; complete at least three active operating days plus adequate real activity, whichever is longer.

Synthetic activity may supplement but not replace real Lisa activity. Required real-activity thresholds are approved before the window starts and must cover the lifecycle categories exercised by production use.

**Exit gate:** Brain production evidence is accepted independently; no open retention, privacy, credential, delivery, or native-regression blocker.

**Rollback order:** disable Brain writes -> stop Brain drain -> disable Brain MCP -> revoke Brain credential -> rollback Brain service if required. Do not touch Skills unless shared-risk evidence exists.

### Phase 12 — Skills Production Deployment and Canary

**Prerequisites:** Skills stage exit, Cursor/Codex readiness, integrated rehearsal, Platform production readiness, immutable bundle publication, certified execution profiles, production Skills credential, approved change window.

**Sequence:** deploy service/binding with actor flags off; validate health and contract; enable discovery; enable bounded governed execution; enable telemetry; monitor privacy/hash/profile/queue/native behavior; run approved recovery exercises; complete at least three active operating days plus adequate real activity, whichever is longer.

**Exit gate:** Skills production evidence is execution-backed, not prompt-only; zero conversation/Brain payload leakage; independent rollback proven.

**Rollback order:** disable Skills execution -> stop Skills telemetry drain -> disable Skills MCP -> revoke Skills credential -> rollback Skills service if required. Brain remains enabled if healthy.

### Phase 13 — OpenClaw Execution Closeout and Grok Implementation Handoff

**Objective:** close OpenClaw execution ownership and produce a reproducible provisional implementation report for independent verification.

**Owner:** OpenClaw Grok execution agent only.

**Work:**

- compare delivered OpenClaw behavior with this plan and all approved amendments;
- inspect final code/config/state ownership and obtain required CODEOWNERS review;
- confirm no temporary credential, fake endpoint, debug bypass, sidecar, raw payload, or broad scope remains;
- archive sanitized fake, integration, stage, production, canary, and rollback evidence with explicit provenance;
- submit authorized structured lifecycle findings to LiNKbrain scratch ingestion; the Librarian decides canonical promotion;
- finalize operator runbooks, incident paths, credential schedule, retention jobs, audit review, and capacity thresholds;
- produce the execution-to-verification handoff required by Section 21;
- complete the Grok session record and implementation handoff;
- ask the OpenClaw Orchestrator to refresh the dashboard and state that Grok execution is complete but independent verification remains active;
- create follow-up work only for disclosed omitted or accepted non-launch debt with an owner and gate.

**Exit gate:** the complete OpenClaw Grok implementation handoff exists, its repository/worktree is stable for inspection, and all claimed evidence locations are accessible to the OpenClaw Codex verifier. This is a provisional execution closeout, not certification or final completion.

### Phase 14 — Independent OpenClaw Codex Plan-Conformance Verification

**Objective:** independently determine whether the actual OpenClaw implementation and evidence conform to every item in this plan.

**Owner:** OpenClaw Codex verifier only.

**Work:**

- inspect actual code, configuration, commits, tests, runtime actions, stage/production evidence, canaries, rollout, rollback, and sanitized artifacts rather than relying on the Grok summary;
- classify every task, phase, test, gate, risk, evidence requirement, and definition-of-done item using exactly one of the seven values in Section 13.3;
- distinguish fake, integration, stage, and production proof and reject substitutions;
- verify contract/hash provenance and the evidence of every external interface owner;
- reproduce representative tests, failure/recovery scenarios, configuration checks, and rollback evidence proportionate to risk;
- issue bounded correction work packets to the original OpenClaw Grok owner for every actionable deficiency;
- re-verify corrected work without silently implementing it;
- publish the independent OpenClaw verification report, unresolved classification ledger, and recommendation to the LiNKbrain coordinating verifier.

**Exit gate:** every planned item has exactly one classification; all correction packets are resolved or explicitly accepted by the authorized decision owner; the OpenClaw verification report states what is proven, provisional, blocked, outside ownership, or divergent. The verifier does not grant final four-plan acceptance.

### Phase 15 — LiNKbrain Codex Four-Plan Reconciliation and Principal Closeout

**Objective:** reconcile the four independently verified repository results and present one evidence-backed completion decision to the Principal.

**Owner:** LiNKbrain Codex coordinating verifier, with final Principal acceptance.

**Inputs:** LiNKbrain, LiNKskills, LiNKplatform, and OpenClaw Prime independent Codex verification reports; all correction packets; approved deviation decisions; frozen plan and contract versions; stage and production evidence.

**Work:**

- verify that all four reports are final independent results rather than provisional Grok completion reports;
- reconcile ownership, contracts, identity, credentials, migrations, environment, privacy, configuration, rollout, rollback, canary, and evidence conclusions;
- identify inconsistent classifications, missing owner evidence, cross-plan deviations, and launch-blocking contradictions;
- confirm Brain-first and later Skills sequencing and all independent evidence windows;
- confirm the Librarian and Program authority boundaries remain intact;
- produce a four-plan reconciliation report with accepted results, unresolved items, owners, and recommended Principal decision;
- request final Principal acceptance only when no unresolved launch-blocking contradiction remains.

**Exit gate:** the Principal accepts the reconciled four-plan result. Until then, execution reports and individual repository verification reports do not constitute overall completion.

## 16. Test Strategy

### 16.1 Test layers

| Layer       | Purpose                                                  | Required proof                              |
| ----------- | -------------------------------------------------------- | ------------------------------------------- |
| Unit        | Envelope, redaction, idempotency, backoff, config, flags | Focused deterministic tests per plugin      |
| Contract    | Gateway schemas, claims, errors, health, versioning      | Owner-approved sanitized fixtures and fakes |
| State       | Ordering, lease, crash/restart, capacity, dead letter    | SQLite-backed plugin runtime tests          |
| Privacy     | Prohibited fields, secret canaries, cross-domain silence | Negative tests and sanitized artifact scan  |
| Integration | Two plugins, two MCP entries, native behavior            | Fake-backed full lifecycle scenarios        |
| Stage       | Real identity, credentials, services, migrations, audit  | Live Platform environment evidence          |
| Production  | Real Lisa use, failure recovery, rollback                | Independent domain canary windows           |

### 16.2 Required invariants

Tests must prove:

- one canonical Lisa actor across all subordinate executions;
- separate Brain and Skills credentials and scopes;
- no Skills conversation access or raw payload;
- no cross-domain state or payload copy;
- no delivery acknowledgement before durable remote acceptance;
- idempotent replay after ambiguous failures;
- deterministic drain order and single lease owner;
- domain-specific overflow and dead-letter behavior;
- native memory, compaction, cron, channels, sessions, and skills continue during degradation;
- disabled means no hooks, drain, or remote traffic for that domain;
- one-domain rollback leaves the other domain healthy;
- secrets do not appear in source, config, CLI arguments, logs, diagnostics, state, fixtures, screenshots, or handoffs.

### 16.3 Repository command guidance

The execution agent must use the current root policy and the `openclaw-testing` and `crabbox` skills to select proof. Expected commands include:

```bash
node scripts/run-vitest.mjs extensions/linkbrain
node scripts/run-vitest.mjs extensions/linkskills
node scripts/check-changed.mjs -- extensions/linkbrain extensions/linkskills
pnpm plugin-sdk:surface:check
pnpm build
git diff --check
```

Use focused local commands only for trusted source with ready dependencies. Heavy checks, builds, packaging, E2E, live proof, and cross-platform scenarios use the selected Testbox/Crabbox path. Do not run untrusted repository tooling locally. Do not add a public SDK check unless the SDK surface actually changes.

### 16.4 Lisa runtime proof

Use profile-qualified, redacted commands and record exit status and sanitized output:

```bash
pnpm openclaw --profile lisa config validate
pnpm openclaw --profile lisa health
pnpm openclaw --profile lisa mcp doctor
pnpm openclaw --profile lisa mcp probe linkbrain
pnpm openclaw --profile lisa mcp probe linkskills
pnpm openclaw --profile lisa plugins inspect linkbrain --runtime --json
pnpm openclaw --profile lisa plugins inspect linkskills --runtime --json
```

Confirm the exact current CLI help before execution. Never include credential values or private message/memory content in evidence.

## 17. Observability, Health, and Alerting

### 17.1 Per-domain health

Each plugin exposes independently:

- enabled/disabled/degraded state;
- contract and plugin version;
- endpoint identity without sensitive query/header material;
- credential presence and expiry class, never value;
- last successful probe and delivery time;
- last failure class and bounded message;
- queue depth, oldest age, retry count, dead-letter count, and capacity state;
- drain lease status;
- current feature flags;
- stage/production environment label;
- privacy policy/redaction version.

### 17.2 Alert classes

| Severity | Example                                                                                                  | Owner/action                                                             |
| -------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Critical | secret/privacy leak, wrong actor/scope, cross-domain payload, confirmed data loss                        | Disable affected domain immediately; security/Platform/OpenClaw incident |
| High     | credential revoked unexpectedly, outbox near full, oldest age over loss budget, repeated terminal writes | Domain owner and OpenClaw operator; pause intake or drain safely         |
| Medium   | transient service outage, elevated retry, stale health, one failed probe                                 | Observe/retry within bounded policy                                      |
| Low      | capacity trend, approaching expiry, non-blocking version drift                                           | Planned maintenance                                                      |

Alert payloads contain identifiers and counts only. They do not contain messages, Brain evidence, Skills inputs/results, credentials, or raw tool data.

### 17.3 Honest degraded states

- Brain unavailable: native OpenClaw continues; capture buffers within approved bounds; high-risk evidence-dependent actions become cautious/advisory; operator sees Brain degraded.
- Skills unavailable: native skills continue; governed LiNKskills operations stop or use only an exact last-verified bundle/profile when explicitly approved by the Skills contract; telemetry queues honestly.
- State full: reject new domain records and alert; never silently drop or report delivery.
- Auth invalid: disable the affected remote path; never broaden scopes or reuse another credential.

## 18. Security and Secret Handling

- Platform owns issuance, injection, rotation, expiry, revocation, and audit.
- OpenClaw owns secure consumption and domain-specific configuration.
- Credentials are runtime-binding-owned and domain-specific.
- No production `service_role` or database credential reaches OpenClaw.
- Prefer native OAuth/auth profiles; otherwise use Platform-approved `SecretRef` injection.
- Never inspect or reuse Cursor process-argument credentials. Their remediation is a launch-critical external maintenance gate.
- Redact authorization headers, cookies, query secrets, private endpoints when required, tokens, claims containing private facts, message content, and stored payloads from diagnostics.
- Use short-lived least-privilege credentials and independently test revocation.
- Validate issuer, audience, actor, binding, service, operations, expiry, and contract version at the Gateway.
- Treat all externally supplied text and tool data as untrusted input.
- Do not log full request/response envelopes in production.
- Run repository secret scanning and targeted canary searches before each live gate.

## 19. Operations and Runbooks

Required runbooks:

1. Brain enable/disable/read-only/write/drain controls.
2. Skills enable/disable/discovery/execution/telemetry controls.
3. Brain credential issue/rotate/revoke/recover.
4. Skills credential issue/rotate/revoke/recover.
5. MCP probe, repeated-failure pause, and recovery.
6. Plugin/Gateway restart with durable outboxes.
7. Queue pressure, reject-new, capacity increase decision, and dead-letter handling.
8. Brain capture hold, retention deletion, and Principal-approved exceptions.
9. Skills bundle/profile mismatch and last-verified-bundle policy.
10. Privacy or secret incident containment.
11. Cross-domain leakage incident containment.
12. Platform environment rollback, migration recovery, backup, and restore.
13. Lisa native-behavior regression isolation.
14. Stage and production canary start, pause, restart, accept, and reject.

Every runbook must name prerequisites, owner, commands, expected sanitized evidence, stop conditions, rollback, and escalation.

## 20. Rollback Matrix

| Failure                        | First action                                                       | Preserve                                       | Escalate when                                    |
| ------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------ |
| Brain remote failure           | Stop Brain drain or writes                                         | Brain outbox, Skills, native OpenClaw          | loss budget/capacity or auth concern             |
| Skills remote failure          | Stop Skills execution/telemetry drain                              | Skills outbox, Brain, native OpenClaw          | governed execution or evidence integrity at risk |
| Brain privacy/secret issue     | Disable Brain hooks and MCP; revoke Brain credential               | Skills and native OpenClaw                     | immediately, critical incident                   |
| Skills content leak            | Disable Skills plugin and MCP; revoke Skills credential            | Brain and native OpenClaw                      | immediately, critical incident                   |
| Shared Platform identity fault | Disable both actor bindings only if evidence confirms shared scope | durable local queues and native OpenClaw       | Platform/security incident                       |
| Queue full                     | Reject new records and pause affected producer                     | existing records and other domain              | capacity/retention decision needed               |
| Native OpenClaw regression     | Disable newly enabled plugin/domain                                | local native state and other unaffected domain | regression persists after domain disable         |
| Bad plugin release             | Disable plugin, restore prior OpenClaw/plugin build                | database state for forward diagnosis           | state compatibility uncertain                    |

Rollback is domain-first. A shared rollback requires evidence of a shared fault.

## 21. Evidence, Handoffs, and Verification Artifacts

Every phase handoff includes:

- frozen source versions and owner approvals;
- files inspected, created, modified, and deleted;
- commands actually run and execution location;
- test results with failures and reruns, not only final green status;
- sanitized runtime evidence and artifact hashes;
- decisions with reason, evidence, impact, and approval status;
- active flags, environment, binding, plugin, and contract versions;
- queue/health/canary measurements without payloads;
- credentials referenced only by opaque ID/class and expiry state;
- problems, blockers, risks, uncommitted changes, exact next action, and confidence;
- distinction between fake, stage, and production proof;
- explicit statement of native behavior preserved;
- explicit statement of whether work remains active.

### 21.1 OpenClaw Grok execution-to-verification handoff

The Phase 13 OpenClaw Grok handoff is the verifier's evidence index, not proof by assertion. It must contain:

- every plan phase and issue claimed complete;
- all changed files;
- intentionally untouched ownership boundaries;
- exact repository, branch, worktree, commits, and session record;
- commands, tests, failures, reruns, and validation results;
- contract versions and hashes produced or consumed;
- every configuration, credential reference, profile change, deployment, and live action, including the actual operator;
- fake, integration, stage, and production evidence clearly distinguished;
- canary start/end, active duration, scenario counts, event/run counts, failures, and window restarts;
- failures, approved and proposed deviations, blockers, risks, omitted work, and known unproven claims;
- exact reproduction instructions;
- domain-specific and full OpenClaw rollback instructions;
- sanitized evidence locations suitable for independent Codex verification;
- a coverage index mapping each task, phase, test, gate, risk, evidence requirement, and definition-of-done item to its claimed evidence, without assigning the final seven-value classification.

The OpenClaw Grok agent must disclose live actions even when another operator performed them and must identify that operator. A missing handoff field is an independent-verification deficiency, not permission for the verifier to infer the answer.

### 21.2 Correction work packets

Each OpenClaw Codex correction packet returns work to the original OpenClaw Grok owner and names:

- affected plan item and current conformance classification;
- exact files, interface, environment, and evidence gap;
- expected correction and acceptance criteria;
- owner branch/worktree and prohibited ownership crossings;
- tests and proof required for re-verification;
- dependencies, blockers, and whether a plan-level deviation decision is required;
- the follow-up handoff location.

The Codex verifier records and verifies the correction; it does not silently implement it.

Meaningful lifecycle findings should be submitted through `brain_append_finding` when the live integration and scope authorize it. Originating agents submit structured scratch findings; the Librarian decides canonical promotion. Repository handoffs and Program Ledgers remain authoritative for their existing purposes.

## 22. Risks, Gates, and Accepted Assumptions

### 22.1 Launch-blocking gates

- explicit Principal approval of this plan;
- active, verified Platform environment for each live stage/production phase;
- approved auth mechanism consumable through secure current OpenClaw surfaces;
- versioned Brain, Skills, and Platform contracts and owner sign-off;
- public-SDK outbox semantics proven or a separately approved generic SDK change;
- no credential in source, literal config, logs, or process arguments;
- Brain production retention approval;
- Skills Cursor and Codex readiness before Lisa Skills canary;
- Cursor credential-exposure remediation/acceptance by its external owner before shared production launch;
- required stage failure/recovery scenarios and independent observation windows;
- production backup/restore, audit, rotation/revocation, and rollback proof;
- complete independent Codex verification reports for all four repositories;
- LiNKbrain Codex four-plan reconciliation and final Principal acceptance.

### 22.2 Principal gates during implementation

Return to the Principal if:

- a change would combine domains or expand Skills access to conversation content;
- OpenClaw would need database access, `service_role`, literal credentials, or a new broad auth system;
- a SQLite schema-version bump is proposed;
- Platform recovery inventory forces a choice between recovering and replacing existing data/services;
- Brain retention or hold durations need approval or expansion;
- a fallback changes user-visible risk or claims success without evidence;
- a new paid service, dependency, public publication, or broad architectural change is proposed;
- a canary threshold materially changes launch scope or risk;
- an upstream conflict changes intent, ownership, privacy, risk, cost, or definition of done.

### 22.3 Implementation decisions already resolved

- two private bundled plugins and two managed MCP entries;
- Brain-only conversation-hook access;
- Skills uses structured telemetry and stable tool/bundle guidance, not dynamic conversation prompt hooks;
- existing public keyed plugin state is the first outbox implementation target;
- no schema bump, sidecar, or runtime fallback;
- native OpenClaw behavior remains authoritative and preserved;
- one canonical Lisa actor with subordinate executions;
- Platform owns identity/credentials/infrastructure; OpenClaw owns adapters/profile/tests/rollout;
- Brain may launch before Skills;
- each domain has an independent evidence window and rollback;
- fake evidence is not environment proof.

### 22.4 Assumptions to verify, not silently trust

- current public keyed-store ordering and lease behavior remains stable at implementation HEAD;
- managed MCP auth surfaces support the Platform-selected mechanism;
- plugin config restart and MCP hot-apply behavior remains as currently documented;
- the Lisa profile still matches the sanitized baseline;
- stage/production projects, migrations, backups, Librarian, and audit become available on the Platform schedule;
- immutable Skills bundles and certified profiles are available for Lisa scenarios;
- measured outbox limits fit within current keyed-store caps;
- hook timeout behavior and cancellation semantics remain current.

### 22.5 Execution and verification risks

| Risk                                                                                        | Required control                                                                                                                                           |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A Grok completion report is accepted without independent proof                              | Treat every Grok report as provisional until the matching Codex verifier inspects actual implementation and evidence.                                      |
| The execution agent certifies its own work                                                  | Separate Phase 13 execution closeout from Phase 14 verification; only the OpenClaw Codex verifier issues the OpenClaw conformance report.                  |
| Planned items remain unclassified                                                           | Require exactly one of the seven Section 13.3 classifications for every task, phase, test, gate, risk, evidence requirement, and definition-of-done item.  |
| A cross-repository interface is assumed complete without its owner's verified evidence      | Keep the eleven interface gates owner-evidenced; `outside the execution agent's ownership` cannot pass a live gate by itself.                              |
| Codex verification silently becomes implementation                                          | Return deficiencies to the original Grok owner through correction work packets; require explicit Principal reassignment before Codex edits implementation. |
| Final reconciliation uses provisional rather than independently verified repository results | Phase 15 accepts only four completed Codex verification reports and checks their provenance before reconciliation.                                         |

These risks are launch-blocking when the corresponding control or evidence is missing.

## 23. Definition of Done

Implementation is complete only when all statements below are proven with current evidence:

### Architecture and ownership

- Lisa maps to one canonical Platform actor and one recorded OpenClaw runtime binding.
- `linkbrain` and `linkskills` are separate default-disabled plugins using only public SDK surfaces.
- `mcp.servers.linkbrain` and `mcp.servers.linkskills` are separate and independently operable.
- Platform and OpenClaw ownership boundaries match all four plans.
- no unresolved active ownership collision or hidden implementation session remains.

### Identity and credentials

- Brain and Skills credentials have different IDs, audiences/scopes as required, rotation, revocation, and evidence.
- no production database credential or `service_role` reaches OpenClaw.
- no credential value exists in Git, OpenClaw JSON, docs, logs, screenshots, handoffs, or process arguments.
- `cursor` and `local-coder` are explicitly classified as subordinate or separate actors/bindings.

### Privacy and data

- only Brain has explicit conversation access.
- Skills registers no conversation/prompt/message-bearing hook and receives no raw content.
- secret, reasoning, prompt, attachment, and unbounded-output exclusions pass canary tests.
- no combined Brain/Skills datastore, queue, credential, health, or payload exists.
- opaque correlation works under Platform audit policy.

### Reliability

- both outboxes are durable, ordered, idempotent, leased, bounded, observable, restart-safe, and independently recoverable.
- overflow rejects explicitly; no silent eviction or false delivery acknowledgement occurs.
- all mandatory stage failure/recovery scenarios pass at least once per applicable domain.
- rollback of either domain leaves the other and native OpenClaw healthy.

### Functional behavior

- all approved Brain tools and lifecycle paths pass contract and live stage tests.
- all approved Skills tools pass exact bundle/profile, validation, execution, and telemetry tests.
- Skills readiness is execution-backed and not prompt-only.
- native memory, compaction, sessions, cron, channels, Program authority, and native skills remain functional.

### Environments and operations

- stage and production services, migrations, schema/data state, backups/restores, audit, Librarian, alerts, and owners are verified.
- required runbooks are rehearsed by an operator other than the implementer.
- Brain production retention is Principal-approved and enforced.
- the Cursor credential-exposure gate is resolved or explicitly accepted by the responsible authority.

### Execution and independent verification

- the OpenClaw Grok execution handoff is complete and contains every field required by Section 21.1.
- the OpenClaw Codex verifier independently inspected actual implementation and evidence rather than accepting the Grok summary.
- every task, phase, test, gate, risk, evidence requirement, and definition-of-done item has exactly one of the seven Section 13.3 classifications.
- all OpenClaw correction work packets are resolved or explicitly accepted by the authorized decision owner.
- final independent Codex verification reports exist for LiNKbrain, LiNKskills, LiNKplatform, and OpenClaw Prime.
- the LiNKbrain Codex coordinating verifier completed cross-plan reconciliation using those four final reports.
- no unresolved launch-blocking ownership, contract, identity, credential, migration, configuration, privacy, evidence, rollout, or rollback contradiction remains.
- the verifier roles remained separate from Grok implementation ownership unless the Principal explicitly recorded a reassignment.

### Canary and closeout

- Brain stage and production each meet at least three active operating days plus approved event/activity thresholds, whichever is longer.
- Skills stage and production independently meet the same duration rule plus approved run/activity thresholds.
- every failure that restarts a window is recorded with scope and reason.
- fake, stage, and production evidence are clearly distinguished.
- final four-plan verification, handoffs, dashboard refresh, owner acceptance, LiNKbrain Codex reconciliation, and Principal acceptance are complete.

## 24. Immediate Next Action After Approval

After the Principal approves this plan, start Phase 0 only:

1. assign the four repository-specific Cursor execution agents with Grok 4.5 High;
2. create each repository's implementation session, dedicated branch, and separate checkout/worktree where required, then register exact ownership and interfaces;
3. freeze exact current hashes and versioned contract artifacts across all four repositories;
4. request owner approval of sanitized fixtures and the Platform auth ADR;
5. begin concurrent contract/fake preparation within repository ownership and stop at the Phase 1 exit gate before authoritative Lisa configuration or live Platform service work.

Until that approval, this document is the completed planning deliverable and no implementation action is permitted.
