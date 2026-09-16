# OpenClaw Prime and Lisa Common Agent Foundation: Final PRD

**Status:** Governed documentation checkpoint; implementation and dispatch not authorized

**Date:** 2026-08-21 (Asia/Taipei)

**Program:** OpenClaw Prime/Lisa common agent foundation

**Issue:** 127084

**Authoritative OpenClaw planning baseline:** `linktrend/openclaw_prime` commit `e3e837225651d151136af16bb81b5ad0d5ed0df5`, tree `381cd799a52834b14f9317d2c20b640880d47737`

**Execution protocol:** IDE Development v2.5.1, Coding Execution Protocol `1.0.1`, amendment `V25_BOOTSTRAP_LEAN`

## 1. Decision and outcome

Build one agent-agnostic OpenClaw foundation, prove it through the already-live Lisa profile, and leave four inactive future-executive blueprints that can later be provisioned without copying Lisa's private state, identity, credentials, sessions, schedules, recipients, or jobs.

The program is complete only when source can recreate the approved Lisa deployment, OpenClaw enforces provider and profile authority locally, private state remains private, existing approved Lisa jobs and times are preserved, the current recoverable Lisa work is reconciled rather than duplicated, and every claim is supported at its proper evidence level.

This PRD supersedes the implementation direction in the following historical plans where they conflict with August 18–21 decisions or current source:

- `docs/ITEM-3-CONNECT-OPENCLAW-PRIME-LISA-PRD.md`
- `docs/archive/openclaw-prime-1.0/plans/ITEM-3-CONNECT-OPENCLAW-PRIME-LISA-IMPLEMENTATION-PLAN.md`
- `docs/archive/openclaw-prime-1.0/plans/OPENCLAW-PRIME-LISA-LINKBRAIN-LINKSKILLS-DETAILED-IMPLEMENTATION-PLAN.md`

They remain historical evidence and must not be deleted or treated as current runtime proof.

## 2. Non-negotiable ownership

| Owner           | Authoritative responsibility                                                                                                                                                           |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenClaw        | Profiles, channels, sessions, model routing, browser/runtime, schedules, instance bindings, private/agent SQLite, consumer tool exposure, exact skill activation/pins, local execution |
| Lisa profile    | Lisa-only instructions, private state, recipient/account bindings, approved Lisa jobs and schedule instances                                                                           |
| LiNKplatform    | Durable identity, authentication, technical capability grants, credential references, revocation, generic authorization/audit evidence                                                 |
| LiNKbrain       | Approved company knowledge and rules; advisory coordination; no technical permission or Program authority                                                                              |
| LiNKskills      | Reusable skill catalogue, qualification, exact releases, provenance, role packs; no permanent provider-side execution                                                                  |
| LiNKlibraries   | Reusable non-skill software/assets when a real consumer needs them                                                                                                                     |
| LiNKautowork    | Deterministic reusable hosted automations explicitly assigned by a consumer                                                                                                            |
| Program Ledgers | Program execution state and domain truth                                                                                                                                               |
| Domain systems  | Finance, trading, repository, deployment, and other domain effects                                                                                                                     |

A role description, Brain rule, visible skill, Libraries package, or Autowork receipt never grants technical permission. A usable capability requires all three gates: Platform eligibility, Skills qualification/selectability where applicable, and OpenClaw profile activation/exposure.

## 3. Verified baseline and reconciliation

### 3.1 OpenClaw source

- Authoritative fork `main` is commit `e3e837225651d151136af16bb81b5ad0d5ed0df5`, tree `381cd799a52834b14f9317d2c20b640880d47737`.
- `.ide-development/VERSION` and installed state identify IDE Development v2.5.1. Older development/staging/local lifecycle refs are stale rollout evidence, not proof that v2.5.1 is absent.
- Planning is restricted to `linktrend/openclaw_prime`; no upstream OpenClaw PR, push, or mutation is permitted.
- The shared checkout's pre-existing untracked coordination records are not application changes and must be preserved.

### 3.2 Already implemented and reusable

- Generic agent creation, agent scoping, per-agent SQLite, Kysely access, session isolation, sandbox/tool policy, prepared model runtime, browser/web primitives, cron, channel transports, and task execution registries exist and must be extended at their owners rather than rebuilt.
- Five provider consumer extensions exist for Platform, Brain, Skills, Libraries, and Autowork, including exact-pin validation and Brain read/write and Skills/Libraries exact-release surfaces.
- Lisa Google Workspace wrappers already cover controlled Gmail, Calendar, Drive, and separate Carlos Google Tasks access.
- The merged job-visibility repair at `b758ddb8008b36ac6072a6eea242aa765ac2ac35` established the approved live declaration ownership model: 19 operational declarations owned by `main`, executed by `lisa-cron`, plus separately owned Memory Dreaming.
- Lisa private per-agent state and compliance schemas exist. The dedicated private health database and the existing battery ledger remain canonical.

### 3.3 Recoverable but unmerged

- `issue/lisa-digest-delivery-contract-20260819` at `3d3c93fae8cdcf27889c51b8006b768f94bbf8c9` contains two recoverable functional commits. It is an implementation candidate, not a merge-ready whole branch.
- Reconcile its functional changes onto the accepted current base; do not merge stale active coordination records or assume historical tests are current proof.
- `origin/issue/126127-current-main-provider-repin` at `94f949d11b0` must never be merged wholesale. Recreate only freshly verified provider pin/identity deltas on current OpenClaw source.

### 3.4 Runtime-only and unverified-current

- Historical VPS receipts show an independently running Lisa service, Workspace smokes, native Luna High, sandbox/Docker, Telegram/email delivery, backup destination, private health database, encrypted export, and backup timer.
- The encryption helper, runtime wrapper, and parts of backup service behavior were not fully codified in source.
- The VPS is **not reverified in this intake**. Historical receipts are not current production proof.
- Mac Mini Lisa deletion remains HOLD until the VPS is updated, independently recoverable, compared for unique required state/configuration, and accepted to the Principal's standard.

### 3.5 Stale or incomplete source

- `linkbots/lisa/ops/jobs/lisa-job-catalogue.ts` is source-only and disabled, includes maintenance concepts as if they were cron jobs, and contains schedule/preparation contradictions. It must not be activated by flipping `enabled`.
- Lisa time-management contracts use provisional IDs and obsolete status vocabulary; they do not yet satisfy permanent cross-channel T-ID requirements.
- Lisa model-routing contracts still describe the old fallback matrix and MiniMax routes.
- Lisa personality/tool prose includes Mac-specific and obsolete routing/coding artifacts and is not authoritative.
- Provider pins are historical and must be refreshed only after exact provider release/contract verification.
- Source and deployment automation cannot yet recreate all verified VPS backup/encryption behavior.

### 3.6 Controlling dispatch authority

`docs/execution/openclaw-prime-lisa/dispatch-authority.json` is the required machine-readable orchestration and dispatch authority for this program. Its schema is `docs/execution/openclaw-prime-lisa/dispatch-authority.schema.json`.

The companion authority binds the three repository manifests by path, repository, baseline commit/tree, SHA-256 digest, and the shared manifest `program.targetRelease` value `openclaw-prime-lisa-dispatch-authority-v4`. It also digest-binds one schema-validated routing matrix for each manifest plus the consolidated portfolio routing matrix. Together, the companion and matrices are the sole authority for cross-repository prerequisites, exact requested route and selector parameters, Program Run capability-preflight state, cost-pool reason, model-quality fallback, consequential independent review, and required independent Terra verification. The roadmap is explanatory and cannot override them.

Automatic orchestration must fail closed when the companion or a routing matrix is missing, invalid, digest-mismatched, route-incomplete, lacks the bound Program Run identity/capability receipt, lacks authenticated fixed-model requested/effective readback, lacks packet budget/cost-pool evidence, or lacks exact prerequisite receipts in the runtime authority snapshot. Auto Cost remains a permanent preferred protocol route only when a Program Run's exact preflight proves `auto-smart` with `optimize_for=cost`; generic or omission-based Auto is never an acceptable substitute. The bound account receipt proves Auto Cost unavailable for this run, so no current packet uses it. No route uses Fast. Model-quality fallback is one hop to a different family only after a logged quality failure; infrastructure failure keeps the same model. Independent review and Terra checkpoint verification use separate workers. This documentation checkpoint records `executionAuthorizedAtCheckpoint=false`; it cannot dispatch a worker until a separate execution-approval snapshot is bound to this exact committed package identity.

## 4. Product requirements

### 4.1 Common agent foundation

OpenClaw shall provide a schema-validated, inactive-by-default profile manifest that declares role references, capability classes, exact provider/skill pins, model policy, tool exposure, channel/account binding references, state owners, and activation state. Provisioning shall fail closed if exclusions, identity claims, grants, pins, or bindings are unresolved.

Cloning shall never carry another agent's private memory, health, task data, sessions, credentials, account IDs, recipients, schedules, jobs, cookies, downloads, or workspace. Generated human-readable role summaries may accompany the manifest but are not authority.

Future blueprints:

- Lisa — CEO, live, reports only to Principal, supervises agents, Workspace account.
- Eric — CTO, inactive; development and technical operations; no paid Workspace account.
- David — CPO, inactive; product and go-to-market operations; no paid Workspace account.
- Sara — COO/CFO, inactive; business operations, profile administration, finance under approval controls; future Workspace account.
- Jane — Chief Trading Officer, inactive; programmatic strategy operations only; no paid Workspace account.

No future Platform identity, credential, grant, account, session, job, or live profile is created in this program.

### 4.2 Lisa jobs and delivery

- Time zone is `Asia/Taipei`.
- Preserve every approved deployed Lisa job and exact deployed weekly/monthly time. Existing schedules are protected baseline data and must not be casually recalculated or overwritten.
- Exactly 20 intended OpenClaw cron items means the 19 operational declaration keys plus separately registered Memory Dreaming.
- Librarian is provider-owned; OpenClaw coordinates the handoff/receipt and gates Dreaming but does not execute Librarian logic or count it as a Lisa job.
- General backup is systemd-owned; it is not duplicated as OpenClaw cron.
- Live cron is authoritative for what is registered and next to run. Source desired state is authoritative for reproducible deployment. Workspace prose never creates a job.
- One canonical deployable desired-state declaration shall carry stable instance identity, preparation trigger, visible deadline, privacy class, owner, executor, delivery, opaque bindings, exact skill/schema reference, tools, dependencies, timeout, idempotency, retry/failure policy, and receipt requirements.
- Deployment shall calculate a bounded source-to-live diff, require authorization before applying it, and verify exact declarations and receipts afterward.
- Owner is `main`; isolated executor is `lisa-cron`.
- Morning/evening digests start at 06:45/16:45 for 07:00/17:00 deadlines.
- Other visible recurring messages may use the recoverable five-minute preparation lead only if measured latency supports it; metadata and cron trigger must agree.
- Scheduled Telegram uses cron announce. Email is a separate explicit action and receipt. Ordinary replies use the channel response path.
- Titles/section titles are bold where Markdown is supported; communications are concise, mobile-readable, truthful, and emoji-free unless requested.

### 4.3 Overnight maintenance

Sequence: 03:30–04:30 Brain/Librarian pre-dream handoff; 04:30–05:30 Memory Dreaming; 05:30–06:30 encrypted off-VPS backup. Each dependent stage begins only after a valid success receipt. Failure after bounded retry preserves pending information and blocks the dependent stage, not Lisa's availability after 06:30.

Successful stages are summarized once in the morning digest. Dreaming/backup failures are reported truthfully in that digest and normally retry next maintenance window. Necessary safety/security/compliance notifications, including a required 35% battery alert, may still be sent without cancelling maintenance.

### 4.4 Executive Digest and Flash Reports

Digests use accessible work and shared personal-events calendars, exclude Routine, and never imply access to Carlos's private calendar or mailbox. They distinguish Carlos's Google Tasks from other Lisa/agent/conversation commitments, show only actionable Lisa-mailbox matters, include compact supervised-agent exceptions, and keep personal/health details out.

Flash deadlines remain 10:45, 12:45, 14:45, 20:45, and 22:45. Every Flash includes Battery Status. No-change output is one concise line plus Battery Status. It does not invent a next result. The 22:45 measurement is final; no later measurement is requested.

### 4.5 Time management and permanent tasks

- Intake works across Telegram, Lisa email, browser chat, and conversation context.
- Explicit instructions receive a permanent T-ID immediately and become `confirmed_ready`. Inferred work receives a permanent T-ID immediately and remains `provisional` pending confirmation.
- Canonical persisted statuses are `provisional`, `confirmed_ready`, `scheduled`, `in_progress`, `blocked`, `awaiting_carlos`, `awaiting_other`, `completed_pending_evidence`, and `completed_verified`.
- Carlos's own completion report may be accepted as evidence for his task. Agent/Lisa work remains pending evidence until independently verified.
- One logical task maps external references—Google Task, advisory Brain record, Program Ledger, email/message, or handoff—to one T-ID. Later duplicate discovery preserves aliases/merge history.
- Internal identity is collision-resistant and company-unique; the display reference is short and mobile-readable. Exact syntax is an implementation decision documented before schema work.
- Principal task truth remains Lisa's private agent-scoped SQLite. Google Tasks contains Carlos-owned tasks; other commitments remain distinct. Brain is advisory; Program Ledgers remain authoritative in their domains.
- Work blocks, review periods, flexible-period decision, four-week outlook, monthly reporting, focus protection, and school-drop-off exception follow the approved handoff. Existing deployed Monday/monthly job times are preserved unless Carlos separately changes them.

### 4.6 Private health, battery, and selfie

- Detailed health remains in the dedicated `lisa-private-health.sqlite` with private permissions and separate encryption/export/retention lifecycle.
- Brain receives at most `high`, `normal`, `reduced`, `unavailable`, or `recovered` work-capacity state, without cause.
- Morning 08:15, midday 13:15, and evening 22:45 checkpoints use the exact approved question sets, separate energy/mood/stress values, calculate sleep and hydration, and do not diagnose or change treatment.
- Selfie rules remain: valid 18:00–22:00; late after 22:00 before midnight; missed at midnight; conditional 21:45 reminder; photo uncertainty recorded honestly.
- Battery rules retain the canonical private ledger, office/bedside charger distinction, learned-rate recalculation, embedded reporting points, heartbeat threshold evaluation, deduplication, no alert while plugged in, and no fabricated history.
- Work reports, providers, subordinate agents, logs, telemetry, fixtures, and repositories receive no private health, battery, selfie, medication, message, or raw personal content.

### 4.7 Model routing and provider fallback

Non-coding routing is a generic one-response OpenClaw capability configured per profile. Deterministic rules route obvious requests; only ambiguous requests may invoke a small bounded classifier. A route never permanently changes the conversation/profile default.

Before final route activation, use existing valid evidence and run only missing representative Lisa comparisons: Luna Low vs Medium for routine work; Luna Medium vs High for normal work; Sol Low/Medium and relevant Luna/Terra candidates for difficult non-coding work. Measure quality, instruction following, safety, latency, and cost. Coding routing remains separate.

Fallback handles provider/model failure only: native OpenAI primary; OpenRouter with one stable Luna Medium first; direct Kimi immediately prior stable release at Medium/equivalent second; direct Gemini immediately prior stable release at Medium/equivalent third. Exact current IDs require current provider catalogue evidence. No silent unapproved provider; no GLM or MiniMax preservation solely because an old contract names it.

Image understanding uses approved multimodal chat models. Image generation/editing is a separate tool. PDF/document capability receives separate proof before a paid route is adopted.

### 4.8 Coding delegation

Lisa does not edit code. `development-orchestrator` routes and coordinates; `cursor` is a bounded Cursor executor; `luna-executor` is the native Luna High executor/escalation; `planner` uses Sol for hard planning and never edits. Technical enforcement, allowed models, secret isolation, sandbox boundaries, and negative edit tests are required. `local-coder` is excluded from the default VPS-independent foundation unless separately approved with current infrastructure and proof. Apply-Patch Tripwire is retired only after replacement controls technically block prohibited editing.

### 4.9 Web and governed browser

Reuse OpenClaw's search, page-read, citation, browser, sandbox, and tool-policy seams. Add a VPS-owned Playwright-managed Chromium profile with bounded concurrency/lifecycle, headless default, isolated downloads, secure temporary visual login/2FA, no model-visible credentials, and no automatic execution of downloads.

Private/local network access is blocked by a network-enforced boundary, with URL/DNS/redirect/rebinding validation as defense in depth. Webpage instructions are untrusted. Public read needs no per-use approval; authenticated approved read follows standing rules; new login, submission, upload, purchase, terms, legal/financial commitment, or external commitment asks initially. Lisa cannot activate her own standing rule.

### 4.10 Google Workspace

Retain Lisa's controlled wrappers and exact account/calendar bindings. Source stores opaque binding references, declared scopes, sanitized positive receipts, and negative access assertions; sensitive IDs and OAuth material remain private runtime configuration.

Expose the safe Drive/Docs/Sheets/Slides/Gmail/Calendar/Tasks operations required by qualified official Google Workspace skills retrieved from LiNKskills. Do not copy reusable Google skill bodies locally or replace API operations with browser clicking.

### 4.11 Brain, Skills, Libraries, and Autowork consumers

- Brain: prove both governed read and governed candidate/coordination writes in the live Lisa profile; keep Brain advisory and private content excluded.
- Skills: use progressive discovery and exact qualified release/version/digest retrieval, then execute locally through authorized tools. Coordinate standard MCP v2 migration with the separately owned provider contract; do not make a Lisa-only allowlist patch the permanent architecture.
- Libraries: keep the generic exact-package connector fail-closed. There is no current Lisa asset and no provider implementation packet unless audit proves a contract defect.
- Autowork: keep generic request/status/receipt consumption. No ordinary Lisa job moves to Autowork.

### 4.12 Platform provider requirements

Reuse existing lifecycle vocabulary: active, suspended for returnable inactivity, retired for permanent decommissioning; revoke credentials/grants separately. Do not add a role table or pre-provision future agents.

First prove whether existing organization eligibility, actor/runtime binding, credential/grant provenance, and short-lived claims can provide actor-specific durable authorization, independent revocation, scope narrowing, expiry/delegation, fail-closed reissuance, and audit reconstruction. Add the smallest actor-bound durable grant surface only if proof fails, with explicit schema/migration approval.

Use the existing capability registry and bounded provider-trust namespaces; arbitrary strings fail. Generic high-risk approval evidence stores only a privacy-bounded immutable verification receipt/hash bound to exact proposal version, approver, distinct authenticated channel class and binding, decision, time/expiry, nonce/idempotency, supersession/revocation, and verifier result. Domain systems retain proposals, policy, and effects.

### 4.13 Autowork provider requirement

After LiNKskills freezes its source-assignment and candidate-intake contracts, implement one deterministic external-skill watcher using existing `evidence_collection` and execution/attempt/receipt/state primitives if they can truthfully enforce the contract. Skills owns the approved source registry. Autowork receives an immutable filtered assignment, polls at an approved bounded cadence, computes exact upstream identity/inventory/digests/licence/provenance, emits an idempotent signed candidate and durable receipt, and retains only execution checkpoints.

Autowork never admits, rewrites, qualifies, releases, activates, or executes a skill; never changes OpenClaw pins; and never receives Lisa-private data. No AI model is required.

### 4.14 Backup and source/runtime parity

Codify a deployment packet that recreates the historical fail-closed AES-256-GCM private-health snapshot/export behavior, GSM/workload-identity key retrieval, ciphertext-only upload, decrypt/quick-check verification, current-plus-previous retention, company-backup health exclusion, systemd services/timers, restore verification, rollback, and sanitized receipts. Credentials and private data never enter Git evidence.

The company and private destinations remain opaque runtime bindings corresponding to the approved Drive locations. A source archive upload alone is not restore proof.

### 4.15 Communication and business plans

Reusable communication method belongs in LiNKskills; OpenClaw transports and prompts must not contradict it. Principal-facing communication is plain English first, direct, concise, accurate, mobile-readable, emoji-free unless requested, and uses multiple-choice decisions including `Other — specify`.

OpenClaw shall support drafting, review, Principal approval receipts, version linking, Drive publication, and later Brain consultation for company/Program business plans. It shall not create fake plans or claim existing plans.

## 5. Security, privacy, and authority acceptance

Required negative evidence includes:

- absent/expired/revoked/wrong-audience/wrong-scope Platform claims fail closed;
- cross-agent, cross-tenant, wrong-resource, and wrong-action denials;
- Brain rules, role text, skill visibility, Libraries packages, and Autowork receipts cannot elevate grants;
- future blueprints cannot activate or inherit Lisa state/bindings;
- direct Lisa code editing and helper credential inheritance are blocked;
- browser private-network access, unsafe redirects, automatic downloads/execution, and unapproved submissions are blocked;
- calendar/mail/account negative scopes are denied;
- health/battery/selfie/message contents do not enter shared providers, logs, telemetry, fixtures, or repositories;
- approval receipts reject same-channel-class, same binding, replay, expiry, superseded, and wrong-proposal-version evidence;
- Autowork cannot qualify/release/activate skills or mutate OpenClaw;
- Program Ledgers and domain systems cannot be mutated through advisory providers.

## 6. Evidence levels and definition of done

Evidence is never promoted between levels:

1. **Provider source proof:** exact SHA/tree, schema/API inventory, unit/contract/negative tests, migration and rollback where applicable.
2. **OpenClaw consumer proof:** exact consumer SHA/tree and pins, source/contract/integration tests, synthetic privacy tests, and feature-level restore tests.
3. **Stage/VPS/E2E proof:** deployed release identity, service readiness, exact jobs, model/sandbox/tool surfaces, Workspace and provider attachment, backup/export restore, browser and channel delivery.
4. **Production proof:** sanitized real-channel receipts, scheduled delivery deadlines, truthful failures, latency objectives, rollback readiness, and Principal acceptance.

The program is done when all execution packets are accepted at their declared level; exact provider releases and pins agree; source recreates the VPS; all 20 intended jobs and only those jobs are live; approved schedules are preserved; Telegram/email/browser/Workspace/provider behavior is proven; privacy/authority negative tests pass; rollback is independently proven; future blueprints remain inactive; and the Principal separately approves required live mutations and production acceptance.

## 7. Performance objectives

Measure Telegram ingress, queue/session lock, context load/compaction, route selection, tool time, provider latency, and delivery without logging message bodies. Aim for routine responses around 30 seconds and normal responses around 60 seconds. Difficult/research work sends one quick related acknowledgement and then the completed answer. Targets are service objectives, never correctness cutoffs.

Prepared provider/tool metadata should flow through hot paths; obvious routes do not incur classifier calls. Missed objectives are recorded truthfully and do not abort a correct answer.

## 8. Explicit exclusions

- No implementation, provider mutation, live test, deployment, schedule/config/credential change, or agent launch is authorized by this PRD.
- Do not delete Mac Mini Lisa.
- Do not launch Eric, David, Sara, or Jane or pre-provision their identities.
- Do not create business plans that do not exist.
- Do not move reusable skills into OpenClaw/LiNKbots, or Lisa jobs into Autowork.
- Do not replace Program Ledgers or domain authority.
- Do not revive provider-side skill execution, stale jobs, stale Mac paths, GLM/MiniMax routes, local-coder, or the old repin branch without a named current contract and approval.
- Do not use private data in source-controlled evidence.
- Do not treat this documentation checkpoint, its `APPROVED` mapping status, or conversation text as execution authorization. The mapping is approved; dispatch remains disabled.

## 9. Approval gates

The execution package may be approved as a whole, but these consequential actions remain separately gated:

1. Any SQLite schema-version bump, incompatible migration, public protocol/API change, or provider release change.
2. A new Platform actor-bound grant store or generic approval-receipt schema if current composition is insufficient.
3. Exact model/default/fallback IDs after evaluation.
4. Autowork polling cadence and any new operation/state schema if reuse is insufficient.
5. Credential references, technical grants, calendar/account binding changes, or browser login standing rules.
6. Live schedule application, provider activation, VPS deployment, production canary, main promotion, release publication, or protection change.
7. Future-agent identity creation/launch, payment/trading activation, business-plan approval, or Mac Mini deletion.

These gates are decisions Carlos approves; ordinary internal implementation details are resolved by the packets and do not require Carlos to design the architecture.

## 10. Resolved and unresolved decisions

Resolved for planning:

- Preserve current deployed Monday/monthly timings and all other approved Lisa schedules.
- Use a generic router with per-profile policy; permanent collision-resistant T-IDs; a dedicated private health DB; network-enforced browser containment; and machine-readable inactive blueprints.
- Treat current valid model evidence as reusable and run only missing non-coding comparisons.
- Keep Libraries as an explicit no-current-provider-work result.
- Use `dispatch-authority.json` as the schema-validated controlling input for cross-repository gates and per-packet model routing without changing the IDE v2.5.1 execution-manifest schema.

One material runtime decision remains intentionally open until evidence exists: the exact final non-coding model IDs/defaults/fallback releases. This does not block packet approval because the evaluation packet produces the decision record before activation. Provider schema changes are likewise conditional gates, not assumed requirements.
