---
summary: "PRD for Lisa-specific five-provider policy: Wave A Item2-independent source now, Wave B adapter wiring after accepted Item 2"
read_when:
  - Authoring or reviewing Orchestrator Item 3 Lisa provider connection work
  - Planning or executing Lisa identity, privacy, Skills, Autowork, or Libraries policy
  - Starting Item 3 Wave A source packets from origin/development
title: "Item 3 Connect OpenClaw Prime Lisa PRD"
---

# Item 3 Connect OpenClaw Prime Lisa PRD

**Status:** Draft for Codex supervisor acceptance. Principal superseding authorization 2026-08-17: Item 3 pre-rollout **Wave A** source may start now. This document still authorizes no runtime, VPS, credential, schedule, production, or PR change.

**Scope owner:** Lisa-specific OpenClaw Prime consumer policy.

**Audience:** Principal, Codex supervisor, Item 3 implementers, and the matching Orchestrator.

**Planning date:** 2026-08-17 Asia/Taipei.

**Amendment date:** 2026-08-17 Asia/Taipei. Principal superseded the wait-for-Item-2 source gate.

**Documentation branch:** `issue/189-author-lisa-five-provider-connection-prd-and-imp`.

**Documentation start SHA / tree:** `f1ca4e8ad32ef87babad397a2ee14c44d5512c1b` / `8843e51cd6d3e2df695d33c68c27724e7ff56502` (`origin/development` at original authoring).

## 1. Purpose

Lisa adds only Lisa-specific policy on top of the five-provider OpenClaw connection:

- identity and permissions;
- allowed provider capabilities;
- privacy, memory, and knowledge boundaries;
- Skills discovery, validation, and job execution;
- Autowork requests, status, handoffs, and receipts;
- LiNKlibraries discovery and retrieval;
- safe denial, provider unavailability, retry/replay, and fail-closed behavior;
- replacement of obsolete provider references.

Execution is split:

- **Wave A (now):** Item2-independent Lisa policy source packets, built from `origin/development`, through dependency-injected Lisa-owned ports and deterministic fakes.
- **Wave B (later):** one narrow adapter-wiring packet after Item 2 has a clean independently accepted exact head. It binds those ports to public Item 2 barrels and records exact pins.

Item 2 owns the reusable OpenClaw provider adapters. Item 3 owns Lisa as one canonical actor. Item 3 must not edit, re-implement, or duplicate those adapters, must not deep-import plugin internals, must not guess adapter exports, must not mutate provider repositories, and must not treat a still-reviewing Item 2 candidate as an accepted head.

Companion execution document: [Item 3 implementation plan](archive/openclaw-prime-1.0/plans/ITEM-3-CONNECT-OPENCLAW-PRIME-LISA-IMPLEMENTATION-PLAN.md) (archived).

## 2. Verified current facts

These statements were read from current source, pins, Lisa files, and Item 2 evidence during this documentation session. They are not live-service claims.

### 2.1 Frozen provider pins on current development

`docs/link-integrations/ocp-01/provider-pins.json` on `origin/development` records profile `ocp-01` with these immutable provider identities:

| Provider  | Repository    | Commit                                     | Tree                                       | Contract / schema                                                                     | MCP                      |
| --------- | ------------- | ------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------ |
| Platform  | LiNKplatform  | `5452f90a35ed690698a9161117a9d92c69985582` | `90b51726f7a77e4620151a463a10cfc3d2007c88` | `platform.auth-claims/1.1.0`, `platform.provider-trust/1.0.0`, schema `2026.07.28-w4` | none                     |
| Brain     | LiNKbrain     | `8ce1d737f8870a479f07b1741c58d6681cd07aa1` | `0cae42d612342f5e52c7e2e0e76cb6fc2f6d81f3` | `brain.v2/2.0.0`, schema `2.0.0`                                                      | `2026-07-28` sessionless |
| Skills    | LiNKskills    | `6269cb173a7c9e0170b29f35c539343c29eab795` | `6c36e6c98f90e55d957fba781327b1b0ef90860a` | `skills.api.v0.2`, `skills-release/0.2`, schema `0.2`                                 | `2026-07-28`             |
| Libraries | LiNKlibraries | `0efa68b19686e976ecee93c6a962e81d2a0265f5` | `c42d20b3119ca4bfdd24d4c6b06d6bc7a7f50d4a` | `libraries.v2/revision-2`, schema `2.2`                                               | none                     |
| Autowork  | LiNKautowork  | `4eb29203766b1ccf200a2dc10b39cc58d175c90c` | `5f306d674780a5a26048017f916da6048d71e7a5` | `2026-08-13.v1`, schema `provider-contract-v1`                                        | none                     |

The shared verifier is `docs/link-integrations/ocp-01/verify-provider-pins.mjs`. It already names the five adapter paths, including files that do not exist on current development.

### 2.2 Provider versus OpenClaw versus Lisa ownership

Issue 183 `docs/link-integrations/ocp-01/PROVIDER-CONSUMER-MAP.md` and `docs/link-integrations/ocp-01/platform-foundation.md` record this ownership split. It remains the planning baseline unless Item 2 acceptance changes it:

| Owner                     | Authority                                                                                                                                                        | Must not do                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Provider repositories     | Contract, release, catalogue, dispatch, and domain data                                                                                                          | Be edited by Item 3                                                                               |
| Platform                  | Actor identity, runtime binding, credential references, issuer/audience/scope, capability facts, revocation                                                      | Be issued, minted, or bypassed by OpenClaw or Lisa                                                |
| OpenClaw Item 2 consumers | Validate supplied evidence against frozen pins; return typed safe failures                                                                                       | Issue credentials, mutate provider state, or silently downgrade                                   |
| Lisa Item 3               | Bind the one Lisa actor to allowed operations; enforce Lisa privacy and obsolete-reference replacement; Wave A via ports/fakes, Wave B via public Item 2 barrels | Own provider truth, activate runtime, edit or duplicate Item 2 adapters, or guess adapter exports |

### 2.3 Current development consumer surface

On documentation start SHA `f1ca4e8ad32ef87babad397a2ee14c44d5512c1b`:

- Platform consumer exists: `extensions/linkplatform/api.ts` and `extensions/linkplatform/src/claims.ts`.
- Historical Brain plugin exists (`extensions/linkbrain/`) with v1 runtime, capture, namespaces, and MCP filter. Public `api.ts` does **not** export Brain v2.
- Historical Skills plugin exists (`extensions/linkskills/`) with v1 runtime, envelopes, and MCP filter. Public `api.ts` does **not** export Skills v2 or exact-release.
- `extensions/linklibraries/` and `extensions/linkautowork/` are **absent**.
- `docs/link-integrations/ocp-01/platform-foundation.md` is present. Brain consumer page, Libraries, and Autowork consumer pages are not on this SHA.

Current Brain write-tool names in `extensions/linkbrain/src/tools.ts` are `brain_capture_batch`, `brain_checkpoint_write`, and `brain_task_update`.

Current Skills MCP allowlist in `extensions/linkskills/mcp-tool-filter.ts` still includes legacy families `skills_run_*` and `skills_tool_*`, plus v1 discovery names `skills_list`, `skills_search`, `skills_describe`, `skills_fragment_get`, and `skills_release_get`. Skills conversation-hook policy already forbids conversation access.

### 2.4 Item 2 candidate evidence, not accepted head

Item 2 remaining-provider work lives on `issue/188-connect-openclaw-prime-remaining-providers`. At documentation inspection it was still under independent exact-head review. The extra-cycle session remained active. No independently accepted exact head existed.

Item 2 candidate source, inspected read-only and not modified, adds:

- Brain v2: `extensions/linkbrain/src/v2.ts`, exported from `extensions/linkbrain/api.ts`.
- Skills v2 and exact-release: `extensions/linkskills/src/v2.ts`, `extensions/linkskills/src/exact-release.ts`.
- Libraries: `extensions/linklibraries/src/revision2.ts`, `extensions/linklibraries/src/exact-release.ts`.
- Autowork: `extensions/linkautowork/src/contract.ts`.
- Brain consumer note: `docs/link-integrations/ocp-01/brain-consumer.md`.

Item 2 Brain v2 operations include discovery, capability status, projections, tasks, inbox, message, checkpoint, handoff, conflict, events, finding submit, and knowledge browse/search/load. Authority is advisory. Execution authority is none. Private capture requires an explicit `private` namespace, opaque references, and prohibited-payload rejection.

Item 2 Skills v2 closed resource operations are discovery and exact-release reads. Closed tool operations are `skills_release_verify`, use-report submit/status, feedback submit/status, and `skills_librarian_status_get`. Legacy `skills_run_*` and `skills_tool_*` are rejected.

Item 2 Autowork closed operations are `status_collection`, `precheck`, `evidence_collection`, `notification_delivery`, `external_assistance`, `artifact_transform`, `media_package`, and `outreach_adapter`. Requests require audience `autowork`, exact request fingerprint, Brain handoff correlation when present, and immutable receipt/callback binding.

Item 2 Libraries consume revision-2 catalogue records and exact-release evidence. OpenClaw validates; Libraries remain authoritative for catalogue admission.

**Critical rule:** the still-reviewing Item 2 commit/tree observed during this documentation session is inspection evidence only. It must not be copied into Item 3 source packets as the execution base. Wave A uses recorded `origin/development` identity from section 12. Wave B uses an independently accepted Item 2 exact head recorded at wiring time. Do not guess adapter exports from this inspection.

### 2.5 Current Lisa source

Lisa's version-controlled definition bundle is `linkbots/lisa/`. `linkbots/lisa/README.md` states that Git holds stable identity and operating instructions; secrets stay out of Git; mutable memory stays out of Git.

Verified Lisa identity and permission facts from `linkbots/lisa/Personality files/`:

- Canonical name Lisa; profile `lisa`; one human-facing Strategic Operations actor.
- Skills are armed by Carlos. Lisa must not author skills via `skill-creator`, ClawHub, or `skill_workshop`.
- Coding is delegated; Lisa is not a hands-on builder.
- Google work uses the Lisa-safe wrapper. `gws auth*` is denied.
- Native local memory, sessions, compaction, cron, and channels remain Lisa/OpenClaw-owned.
- Personality version recorded in `IDENTITY.md` is v1.3 (2026-07-14).

Verified Lisa job-catalogue facts from `linkbots/lisa/ops/jobs/`:

- Ten job families exist as **source-only**, `enabled: false`, `delivery.mode=none`.
- Privacy classes are `work`, `personal_compliance`, and `private_health`.
- Provider dependencies currently use placeholder IDs such as `linkbrain-librarian` with `releaseRef: source-contract-wp04`. They are not pinned to the OCP-01 commits/trees.
- Catalogue hard stops forbid mutating Google, Telegram, email, GSM, LiNKbrain, or any provider from this source package.
- Time-management routes Carlos-owned tasks to Google Tasks and other tasks to a string destination `linkbrain` / ledger `LiNKbrain`, without the Item 2 v2 client.

Historical Lisa Brain/Skills plan `docs/archive/openclaw-prime-1.0/plans/OPENCLAW-PRIME-LISA-LINKBRAIN-LINKSKILLS-DETAILED-IMPLEMENTATION-PLAN.md` (2026-07-27) remains archived. It is a two-provider plan. It does not define Libraries or Autowork. It still describes v1 MCP tool families and managed MCP activation. It is superseded as Lisa five-provider authority by this PRD. Wave A encodes Lisa policy against ports and fakes. Wave B binds that policy to the accepted Item 2 public barrels.

Live briefing `docs/agent-briefing.md` records that VPS Lisa already reaches LiNKskills and LiNKbrain through governed native bridges. That is a **live-runtime** fact. Item 3 is source-only Lisa policy on the Item 2 consumers. Item 3 must not treat live VPS wiring as completed Item 3 source, and must not change that runtime.

### 2.6 Coordination and process facts

- Item 3 documentation may complete now on this issue branch.
- On 2026-08-17 the Principal superseded the earlier wait-for-Item-2 source gate: Item 3 pre-rollout source implementation may start now and does not wait for Item 2 completion.
- **Wave A** Item2-independent Lisa policy source packets may start from recorded `origin/development`, using Lisa-owned ports and deterministic fakes.
- **Wave B** is a later narrow adapter-wiring packet. It starts only after Item 2 has a clean independently accepted exact head. It binds Wave A ports to public Item 2 barrels and records exact pins. No deep imports. No guessed adapter exports.
- Item 2 owns reusable OpenClaw provider adapters. Item 3 must not edit or duplicate them in either wave.
- Both waves proceed only through commit, push, and checkpoint.
- No Item 3 PR may open until IDE Development v2.4.0 is rolled out.
- The Codex supervisor reads and corrects both Item 3 documents and remains responsible for documentation acceptance.

## 3. Assumptions

These are planning assumptions, not verified current facts. Wave A re-verifies them against recorded `origin/development` and Lisa-owned contracts. Wave B re-verifies barrel exports and pins against the accepted Item 2 head before wiring. Do not treat inspection-time Item 2 candidate export names as Wave A imports.

1. Wave A can express Lisa identity, capability, privacy, and domain request/outcome policy through Lisa-owned ports plus deterministic fakes without importing Item 2 adapters.
2. The independently accepted Item 2 head will expose the five consumers through the public barrels `extensions/linkplatform/api.ts`, `extensions/linkbrain/api.ts`, `extensions/linkskills/api.ts`, `extensions/linklibraries/api.ts`, and `extensions/linkautowork/api.ts`. Wave B records the actual exported symbols from that head. Wave A must not guess those export names.
3. Item 2 will keep provider pins identical to the current `provider-pins.json` identities unless a recorded pin amendment exists on the accepted head.
4. Lisa remains one Platform actor with one runtime binding. `main` and `lisa-cron` stay subordinate roles of that actor. `cursor` and `local-coder` do not inherit Lisa provider credentials.
5. Native OpenClaw memory, compaction, sessions, channels, cron, and native skills remain in place. Item 3 adds provider consumption; it does not replace those subsystems.
6. Platform will later issue Lisa-scoped credential references, audiences, and capabilities. Item 3 source uses opaque references and fixtures only.
7. Brain knowledge is advisory. Skills, Libraries, and Autowork results are not execution authority for Git, GitHub, VPS, or production actions.
8. Autowork handoffs that need Brain correlation will use a Lisa port field for the handoff ref plus Lisa policy, not a new OpenClaw ledger. Wave B binds that field to the public Item 2 Brain/Autowork contract actually exported on the accepted head.
9. Libraries contribution intake remains out of Lisa Item 3 unless a later issue explicitly adds it.
10. Historical v1 Brain/Skills MCP names in current Lisa-adjacent allowlists are obsolete as Lisa contracts. Wave A denies them in Lisa-owned policy. Wave B does not fork Item 2 adapters to delete v1 compatibility Item 2 still owns.
11. The July 2026 Lisa Brain/Skills implementation plan remains historical context. Where it conflicts with this PRD, this PRD wins. Where Wave B wiring conflicts with a still-reviewing Item 2 candidate, the accepted Item 2 head wins.

## 4. Goals and non-goals

### 4.1 Goals

1. Define Lisa as the first consumer of the five-provider OpenClaw connection: Wave A policy now, Wave B binding after accepted Item 2.
2. Bind Lisa identity, permissions, and capabilities to Platform facts. Wave A enforces those requirements through Lisa-owned ports and fakes. Wave B binds the identity port to Item 2 public claim/trust helpers.
3. Constrain each provider to the Lisa-allowed operation set in section 7.
4. Keep private memory, private health, credentials, prompts, transcripts, and reasoning out of Skills, Libraries, Autowork, and shared Brain knowledge.
5. Specify Skills discovery/validation/job-execution, Autowork request/status/handoff/receipt, and Libraries discovery/retrieval behavior for Lisa.
6. Specify safe denial, unavailability, retry/replay, and fail-closed behavior.
7. Inventory and replace obsolete Lisa provider references.

### 4.2 Non-goals

See section 11. This documentation issue does not start Lisa source packets. Wave A source is authorized to start on a new issue branch from recorded `origin/development`. Wave B remains gated on an independently accepted Item 2 exact head. Runtime, VPS, credentials, schedules, production, and PRs before IDE Development v2.4.0 remain unauthorized.

## 5. Actor, identity, and permissions

### 5.1 Canonical actor

Lisa is exactly one canonical Platform actor. OpenClaw profile `lisa`, installation, agents, sessions, cron runs, and tools are subordinate records.

Required Lisa identity fields, never minted by Lisa. Wave A validates them through the Lisa identity port and deterministic fakes that encode these checks. Wave B binds that port to Item 2 public Platform claim/trust helpers. Do not guess the Item 2 export names during Wave A.

- actor id;
- organization / tenancy boundary;
- runtime binding id;
- credential reference (opaque);
- issuer;
- audience per provider;
- service scopes;
- capabilities;
- issued-at, expiry, and active revocation status.

### 5.2 Permission rules

Lisa source policy must enforce:

1. No credential issuance, copying, or fallback secret.
2. No widening of Platform capabilities locally.
3. No inheritance of Lisa provider credentials by `cursor`, `local-coder`, or other helpers.
4. No skill authoring, ClawHub install, or `skill_workshop`.
5. No provider repository mutation.
6. No live Gateway, VPS, schedule, or production activation.
7. Denied Lisa media-generation tools remain denied. Autowork `media_package` is a provider operation, not a grant for Lisa to generate media locally.
8. Model output is never authority for identity, scope, release, authorization, or execution state.

### 5.3 Subordinate roles

| Role                     | Provider permission                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `main`                   | May request Lisa-allowed provider operations after policy checks.                                                                           |
| `lisa-cron`              | Same actor; may run only catalogue-declared Lisa jobs once a later activation issue authorizes schedules. Item 3 does not enable schedules. |
| `cursor` / `local-coder` | No Lisa Brain, Skills, Libraries, or Autowork credential.                                                                                   |

## 6. Privacy, memory, and knowledge

### 6.1 Memory ownership

| Store                                                            | Owner                    | Lisa Item 3 rule                                                                                             |
| ---------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Local OpenClaw memory, daily logs, indexes, sessions, compaction | Lisa / OpenClaw          | Remains canonical for Lisa continuity. Not replaced by Brain.                                                |
| Private health ledger and personal compliance state              | Lisa job privacy classes | Never sent to Skills, Libraries, Autowork, or shared Brain knowledge.                                        |
| Shared Brain knowledge and governed coordination                 | LiNKbrain                | Advisory read/write through the Lisa Brain port after redaction. Wave B binds that port to public Item 2 v2. |
| Skills bundles and run evidence                                  | LiNKskills               | Structured skill metadata and exact releases only.                                                           |
| Library catalogue and artifacts                                  | LiNKlibraries            | Discovery/retrieval of admitted selectable records only.                                                     |
| Autowork receipts                                                | LiNKautowork             | Opaque input/result refs; no private payload in OpenClaw.                                                    |

### 6.2 Prohibited payloads

Lisa must fail closed, without retry, if a provider request would include:

- prompts, transcripts, reasoning traces, or raw tool output;
- secrets, tokens, OAuth material, or credential values;
- private health, selfie, battery, or other personal-compliance bodies;
- private Brain episode bodies;
- binaries or unbounded attachments;
- live message contents from Telegram, email, or chat.

Brain private capture, if used at all in later source, requires Item 2 `private` namespace, bounded opaque references, idempotency keys, and safe metadata only. Item 3 source-only work must not enable conversation-bearing Brain hooks.

### 6.3 Knowledge use

Brain knowledge browse/search/load results are references and redacted records. They are not executable instructions, schedule triggers, or merge/deploy authority.

## 7. Allowed Lisa provider capabilities

Lisa may request only the operations below, and only after Platform identity, audience, capability, pin, and revocation checks succeed. Wave A performs those checks through Lisa-owned ports and fakes. Wave B binds the same checks to public Item 2 consumers after the accepted head is recorded. Anything else is a typed denial.

### 7.1 Platform

Lisa consumes Platform facts. Lisa never issues them. Required checks: actor, binding, org, audience, capability, expiry, and active revocation.

### 7.2 Brain

Allowed Lisa operations from the Item 2 v2 map. Wave A encodes this allowlist in Lisa policy. Wave B binds admitted operations to public Item 2 Brain exports actually present on the accepted head:

- `v2.discovery`
- `v2.capability.status`
- `v2.knowledge.browse`
- `v2.knowledge.search`
- `v2.knowledge.load`
- `v2.inbox.read`
- `v2.handoff.create`
- `v2.handoff.accept`
- `v2.conflict.report`
- `v2.finding.submit`
- `v2.checkpoint.write` only with opaque refs and no prohibited payload

Not allowed for Item 3 Lisa source:

- treating Brain as execution authority;
- v1 MCP write names `brain_capture_batch`, `brain_checkpoint_write`, `brain_task_update` as current Lisa contracts;
- enabling conversation capture or live Librarian scheduling.

### 7.3 Skills

Allowed Lisa operations from the Item 2 v2 closed map. Wave A encodes discovery, validation, and job-execution evidence as Lisa domain request/outcome policy. Wave B binds those requests to public Item 2 Skills exports actually present on the accepted head:

- discovery/read: `skills_capabilities_get`, `skills_catalog_list`, `skills_catalog_search`, `skills_release_list`, `skills_release_describe`, `skills_qualification_get`, `skills_release_entrypoint_get`, `skills_release_sections_list`, `skills_release_section_get`, `skills_release_resources_list`, `skills_release_resource_get`, `skills_release_content_get`, `skills_release_package_get`
- validation: `skills_release_verify`
- job-execution evidence: `skills_use_report_submit`, `skills_use_report_status_get`, `skills_feedback_submit`, `skills_feedback_status_get`, `skills_librarian_status_get`

Not allowed:

- legacy `skills_run_*` and `skills_tool_*`;
- v1 names `skills_list`, `skills_search`, `skills_describe`, `skills_fragment_get`, `skills_release_get` as current Lisa contracts;
- ClawHub, skill authoring, or prompt-only certification;
- sending conversation or private memory to Skills.

Lisa job execution through Skills means: resolve an exact release, verify it, and record bounded use/feedback. It does not mean OpenClaw starts a provider-side mutable run through retired v1 run tools.

### 7.4 Autowork

Allowed Lisa operations from the Item 2 closed set, each as request/status/receipt only. Wave A encodes this domain policy against ports and fakes. Wave B binds it to public Item 2 Autowork exports actually present on the accepted head:

- `status_collection`
- `precheck`
- `evidence_collection`
- `notification_delivery`
- `artifact_transform`

`external_assistance`, `media_package`, and `outreach_adapter` are **denied for Lisa Item 3** unless a later Principal decision adds them. They are provider operations, not Lisa grants.

Lisa Autowork flow:

1. Build a request with opaque input/artifact refs, exact pin, audience `autowork`, Lisa actor/binding, and idempotency key.
2. Validate through the Lisa Autowork port (Wave A fake, Wave B public Item 2 request/receipt helpers actually exported on the accepted head) plus a fresh correlated Platform revocation decision.
3. Accept only an immutable receipt bound to the request fingerprint.
4. Track status through callbacks the bound Autowork port accepts; reject terminal regression.
5. Create or accept Brain handoffs only through the Lisa Brain port plus a Lisa handoff-ref field when the Autowork request carries one. Wave B binds that field to the public Item 2 contract; do not guess the export name in Wave A.

Lisa must not locally invent Autowork state, replay a mutated body under the same idempotency key, or treat `uncertainOutcome` as success.

### 7.5 Libraries

Allowed Lisa operations:

- discover revision-2 catalogue records that are admitted and selectable;
- retrieve exact-release evidence for one selected record;
- accept only pass consumption receipts that match pin, catalogue membership, and dependency closure.

Not allowed in Item 3:

- contribution intake;
- selecting draft, withdrawn, quarantined, rejected, superseded, or non-selectable records;
- mutating the Libraries repository or cache as if OpenClaw owned it.

## 8. Failure, denial, retry, replay, and fail-closed behavior

### 8.1 Typed outcomes

Every Lisa provider call returns one closed outcome:

- `accepted` with bounded evidence from the bound port (Wave A fake evidence, Wave B Item 2 public-barrel evidence);
- `denied` for identity, permission, capability, privacy, or obsolete-reference violations;
- `unavailable` for provider status `offline`, `degraded`, `stale`, `disabled`, `unauthorized`, `forbidden`, `contract_incompatible`, or transport failure;
- `invalid` for malformed, inherited, or accessor-backed input.

Silent success, silent downgrade, v1 fallback, and "use local memory instead and claim the provider ran" are forbidden.

### 8.2 Safe denial

Denial is operator-visible, redacted, and non-retryable for the same invalid body. Missing capability, wrong audience, revoked binding, prohibited payload, or legacy operation name is `denied`, not `unavailable`.

### 8.3 Unavailability

If the bound provider port reports unavailable, or Wave B cannot prove the accepted pin/head, Lisa records `HOLD` / `unavailable`. Wave A uses fake unavailability statuses and must not claim a live provider ran. Job catalogue entries that depend on that provider stay skipped. No substitute provider, cached unverified catalogue, or guessed release is used.

### 8.4 Retry and replay

Retry is allowed only for `unavailable` with:

- the exact previously accepted request fingerprint;
- unchanged opaque refs and body;
- a fresh revocation observation that is not older than the bound port max age and not before credential issuance;
- attempt counting owned by the provider receipt, not a Lisa-invented success.

Replay of a different body under the same idempotency key is `invalid`. Callbacks that regress from a terminal Autowork state are `invalid`. Brain snapshot cursors must not be reused across incompatible snapshots.

### 8.5 Fail-closed defaults

- Missing recorded `origin/development` commit/tree: no Wave A packet starts.
- Missing Item 2 accepted head: no Wave B adapter-wiring packet starts. Wave A may continue.
- Missing public adapter export on the accepted Item 2 head: Wave B stops. Do not re-implement the adapter in `linkbots/lisa`. Do not deep-import. Do not guess the export.
- Missing Lisa-owned port or fake in Wave A: packet stops. Do not substitute a live provider or copy Item 2 internals.
- Missing pin, digest, or schema: deny.
- Accessor-backed or inherited fields: deny, matching own-data rules.
- Private class data present: deny without sending.

## 9. Obsolete provider reference replacement

Item 3 must replace Lisa-owned obsolete references. Provider repositories stay unchanged. Item 2 adapters stay unchanged.

Wave A replaces **contract-independent** Lisa-owned references: historical two-provider authority, live VPS claimed as Item 3 completion, and v1 names treated as current Lisa contracts.

Wave B completes **contract-dependent** leftovers that require public Item 2 export names or accepted-head pin binding. Until then those leftovers stay HOLD or explicitly historical.

Inventory of obsolete or superseded Lisa-adjacent references found during inspection:

| Current reference                                                                                               | Why it is obsolete                                 | Replacement                                                                                                   | Wave |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---- |
| `docs/OPENCLAW-PRIME-LISA-LINKBRAIN-LINKSKILLS-DETAILED-IMPLEMENTATION-PLAN.md` as five-provider Lisa authority | Two-provider, v1 MCP, July 2026                    | This PRD                                                                                                      | A    |
| Issue 183 five-provider candidate as live implementation                                                        | Preserved ledger only; retired unresolved findings | Pins remain; Wave B binds accepted Item 2                                                                     | A    |
| Placeholder job provider IDs `linkbrain-librarian`, `source-contract-wp04`                                      | Not OCP-01 commits/trees                           | Pin-backed ids from `origin/development` pins; HOLD if the replacement would name an unaccepted Item 2 export | A    |
| Time-management destination string `linkbrain` without v2 client                                                | No validated Brain client                          | Lisa policy HOLD in Wave A; Wave B may bind Brain v2                                                          | A    |
| Skills MCP v1 names `skills_list`, `skills_run_*`, `skills_tool_*`                                              | Legacy execution is not a Lisa contract            | Skills v2 closed map in Lisa policy                                                                           | A    |
| Brain v1 write names `brain_capture_batch` and siblings as Lisa contract                                        | Replaced by Brain v2 operations                    | Brain v2 allowlist in section 7.2                                                                             | A    |
| Compatibility profile v1 operation titles on Issue 183                                                          | Historical map; not on current development         | Lisa section 7 operation ids                                                                                  | A    |
| Live VPS native Brain/Skills bridges as Item 3 completion                                                       | Runtime, out of scope                              | Source-only Lisa policy tests against fakes                                                                   | A    |
| Remaining replacements that must name public Item 2 barrel exports                                              | Export names are not Wave A contracts              | Bind after inspecting the accepted Item 2 head                                                                | B    |

Lisa personality files that list provider **git checkouts** for Ship/Pull remain operational checkout lists. They are not provider-consumer contracts and must not be rewritten into live MCP endpoints by Item 3.

## 10. Functional, nonfunctional, security, and privacy requirements

### 10.1 Functional

- **F1.** Lisa identity is supplied as Platform facts. Wave A validates them through the Lisa identity port and fakes before any domain call. Wave B binds that port to Item 2 public claim/trust helpers.
- **F2.** Lisa capability allowlists in section 7 are exhaustive for Item 3.
- **F3.** Skills discovery, exact-release validation, and use/feedback status are Lisa domain request/outcome policy in Wave A. Wave B binds them to public Item 2 Skills v2 exports actually present on the accepted head.
- **F4.** Autowork request, status, handoff correlation, and receipt validation are Lisa domain request/outcome policy in Wave A. Wave B binds them to public Item 2 Autowork and Brain exports actually present on the accepted head.
- **F5.** Libraries discovery and exact retrieval are Lisa domain request/outcome policy in Wave A. Wave B binds them to public Item 2 Libraries revision-2 / exact-release exports actually present on the accepted head.
- **F6.** Obsolete Lisa-owned provider references in section 9 are replaced when contract-independent (Wave A) or after accepted-head binding (Wave B), or explicitly marked historical.
- **F7.** Every path has positive, negative, and unavailability tests as specified in the implementation plan. Wave A tests use deterministic fakes. Wave B adds wiring tests against public barrels without live providers.

### 10.2 Nonfunctional

- **N1.** Wave A Lisa policy modules depend on Lisa-owned ports only. Tests inject deterministic fakes. Wave B wiring imports public Item 2 barrels only (`extensions/link*/api.ts`). No deep plugin internals, no copy of provider contracts or Item 2 adapters into Lisa, and no guessed adapter exports.
- **N2.** No new SQLite schema version. No new JSON/JSONL sidecar for runtime provider state.
- **N3.** Deterministic tests with fakes; no live provider, GSM, VPS, or network dependency.
- **N4.** Redacted operator errors; no secret or private-body leakage in tests, docs, or logs.
- **N5.** Source packets stay bounded and reviewable. No Full suite as a required Item 3 proof.

### 10.3 Security and privacy

- **S1.** Fail closed on revocation, expiry, audience mismatch, and missing capability.
- **S2.** Separate audiences/scopes per provider. No cross-credential use.
- **S3.** Privacy classes `private_health` and `personal_compliance` never leave Lisa-owned fixtures.
- **S4.** Skills never receive conversation hooks or conversation content.
- **S5.** Autowork and Libraries see only opaque refs and admitted catalogue metadata.
- **S6.** No production, staging, or live profile mutation.

### 10.4 Existing Lisa operating-model non-regression ledger

Item 3 adds five-provider consumption; it does not redesign Lisa. Every source
packet must preserve the current version-controlled Lisa operating contracts
unless Carlos separately authorizes a named change. The implementation must
test that provider policy cannot bypass or silently weaken these controls:

1. **Model routing:** preserve the authoritative aliases, primary and fallback
   chain, reasoning levels, image/PDF routes and PDF-only rollback in
   `Personality files/TOOLS.md` and `ops/model-routing*`. Provider availability
   must not trigger an unapproved model substitution or turn Nemotron into a
   default/user-visible route.
2. **Coding delegation:** Lisa remains an orchestrator, not a hands-on coding
   agent. Coding must use the configured Cursor ACP route and its advertised
   session contract. Direct `apply_patch`/`edit` remains the documented
   exceptional path only when ACP is genuinely unavailable and Carlos gives
   explicit case-specific authorization. Provider credentials never flow to
   Cursor, `local-coder`, or another helper.
3. **Sandbox separation:** `main` retains `sandbox.mode: non-main` with no
   gateway host override. Trusted scheduled Google/host jobs remain bound to
   the separate no-channel `lisa-cron` agent with sandbox off and heartbeat
   disabled. `main` must not spawn `lisa-cron`; provider policy must not create
   an alternate route around that separation.
4. **Google Workspace:** primary Calendar/Drive/Gmail identity remains
   `lisa@linktrend.media`; allowed work uses `tools/bin/lisa-safe`, never
   improvised bare `gws`, opaque shell, `gws auth*`, or `gws keep*`. Email is
   limited to `@linktrend.media` unless Carlos explicitly approves an
   exception. Carlos Tasks remain the separate `calusa@linktrend.media`
   identity through `tools/bin/lisa-carlos-tasks`; identities and credential
   stores must never be mixed. Google Keep remains unavailable via CLI.
5. **Human authority and sandboxed actions:** existing Carlos-held Spec/PRD,
   Program, Module, launch/release, public-posting, deletion, finance, legal,
   external-sharing/email, and protected-promotion gates remain fail closed.
   Provider facts, model output, Autowork receipts, or Brain advice cannot
   approve an action. Unapproved actions remain planned/held, not executed.
6. **Planning and prioritization:** preserve Lisa's existing progressive
   disclosure, project ranking, approval-first gates, source-of-truth checks,
   and explicit HOLD behavior. Provider results may inform a plan but cannot
   silently reorder Carlos's priorities or replace a missing decision.
7. **Memory and privacy:** preserve native memory, daily logs, indexes,
   sessions, compaction, privacy classes, battery persistence, and the rule
   that mutable memory and secrets stay outside Git. Brain remains advisory;
   private health, personal compliance, prompts, transcripts, reasoning,
   credentials, and live message bodies do not cross provider boundaries.
8. **Jobs, heartbeat, and channels:** preserve the disabled native heartbeat,
   the existing Asia/Taipei cron-owned heartbeat/digest schedules, job
   catalogue disabled/source-only default, templates, Telegram/Web UI session
   rules, internal-only email limits, and separate Telegram-versus-email
   content. Item 3 does not enable, reschedule, or activate any job.
9. **Personality and tools:** preserve the current Personality files, denied
   media/skill-authoring tools, safe wrappers, skills doctrine, Ship/Pull and
   approval contracts, except for the narrow obsolete provider references
   explicitly owned by P-08. Historical documents remain historical.
10. **Runtime boundary:** source, stage, VPS, credentials, schedules, E2E, and
    production are separate proof classes. Item 3 source completion must not
    claim live activation or mutate `~/.openclaw-lisa`.

## 11. Explicit exclusions

Item 3, including later source packets authorized by an accepted plan, excludes:

- Lisa runtime activation;
- VPS and deployment;
- services;
- schedules and cron enablement;
- credentials, GSM, OAuth, Keychain, and secret values;
- production and staging;
- provider repository changes;
- broad OpenClaw redesign;
- Item 2 source modification;
- duplicating Item 2 adapters under `linkbots/lisa`;
- deep imports of `extensions/*/src/**`;
- guessed Item 2 adapter exports;
- Full suite as a merge gate;
- opening a PR before IDE Development v2.4.0 rollout;
- merge, promotion, and branch-protection changes;
- live Librarian timer enablement;
- Eric/David profiles;
- contribution intake to Libraries;
- Autowork `external_assistance`, `media_package`, and `outreach_adapter`;
- conversation-bearing Brain capture.

## 12. No-production boundary and execution-time fields

This documentation issue is complete when the two named docs exist, pass documentation validation, and are checkpointed. It does not start Lisa source packets and still authorizes no runtime, VPS, credential, schedule, production, or PR change.

Principal authorization 2026-08-17: Wave A pre-rollout source may start now on a **new** Lisa issue branch. Wave B stays gated on accepted Item 2. Both waves stay checkpoint-only until IDE Development v2.4.0 rollout is recorded.

### 12.1 Wave A fields

Fill these at Wave A source-packet start from `origin/development`, not from a still-reviewing Item 2 SHA and not from this PRD's inspection notes.

| Execution-time field      | How it is filled                                         | Forbidden stand-in                          |
| ------------------------- | -------------------------------------------------------- | ------------------------------------------- |
| Development commit        | Exact `origin/development` SHA at Wave A branch creation | Item 2 candidate SHA; dirty local tree      |
| Development tree          | `git rev-parse DEVELOPMENT^{tree}`                       | Tree of an unrecorded later commit          |
| Wave A issue / branch     | New `issue/<n>-<slug>` from that development commit      | This docs issue 189                         |
| Lisa port modules         | Lisa-owned port paths created in P-01                    | Item 2 adapter files; `extensions/*/src/**` |
| Fake modules              | Deterministic fakes injected in tests                    | Live provider, VPS, GSM, network            |
| Adapter-edit confirmation | Diff contains no Item 2 adapter or pin-file edits        | Copied adapter code under `linkbots/lisa`   |

### 12.2 Wave B fields

Leave these blank until Item 2 has a clean independently accepted exact head. Fill them at Wave B start by inspecting that head. Do not copy inspection-time candidate exports into this table.

| Execution-time field        | How it is filled                                                     | Forbidden stand-in                                                       |
| --------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Item 2 issue                | The issue that carries the accepted remaining-provider connection    | Issue 183 retired candidate; this docs issue 189                         |
| Item 2 branch               | Branch of the accepted head                                          | Any still-reviewing extra-cycle SHA                                      |
| Item 2 accepted commit      | Exact independently accepted head SHA                                | Inspection-time candidate, local dirty trees, `origin/development` alone |
| Item 2 accepted tree        | `git rev-parse ACCEPTED^{tree}`                                      | Tree of a later unreviewed commit                                        |
| Independent review identity | Reviewer/session that declared the exact head clean                  | Implementer self-review                                                  |
| Pin profile                 | `ocp-01` pins on that accepted tree                                  | Older candidate pins inside adapters                                     |
| Public barrels present      | Checklist of the five `extensions/link*/api.ts` barrels on that head | Assumed barrels from this PRD                                            |
| Actual public exports       | Symbols read from those barrels on that head                         | Guessed names from Item 2 candidate inspection                           |
| Port-to-barrel binding map  | Wave A ports bound to those recorded exports                         | Deep imports; duplicated adapters                                        |

Wave A branches from the recorded development commit/tree. Wave B layers onto the recorded Item 2 accepted head, even if Item 2 has no PR yet. Both waves proceed only through commit, push, and checkpoint. No Item 3 PR opens until IDE Development v2.4.0 is rolled out.

## 13. Acceptance criteria

Item 3 source delivery is complete when every criterion below is true. Wave A may be checkpoint-complete before Wave B. Full five-provider Lisa consumption is complete only after Wave B binds ports on the accepted Item 2 head. Documentation acceptance is Codex supervisor acceptance of this PRD and the companion plan, not these source criteria.

| ID    | Criterion                                                                                                                                                                                                                                                                                                                        |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-01 | Wave A Item2-independent Lisa policy packets start from the recorded `origin/development` commit and tree in section 12.1. They do not wait for Item 2 completion. They must not use a still-reviewing Item 2 SHA as the execution base.                                                                                         |
| AC-02 | Lisa does not modify Item 2 adapter files, provider repositories, workflows, runtime config, credentials, or deployment assets. Lisa does not duplicate those adapters under `linkbots/lisa`.                                                                                                                                    |
| AC-03 | Lisa identity and permissions are expressed as Platform facts. Wave A validates them through the Lisa identity port and fakes before any domain call. Wave B binds that port to Item 2 public claim/trust helpers recorded from the accepted head.                                                                               |
| AC-04 | Helper agents cannot inherit Lisa provider credentials or capabilities.                                                                                                                                                                                                                                                          |
| AC-05 | Lisa-allowed provider operations match section 7 exactly. Extra operations are denied.                                                                                                                                                                                                                                           |
| AC-06 | Privacy classes and prohibited payloads in section 6 are rejected before transport.                                                                                                                                                                                                                                              |
| AC-07 | Local Lisa memory remains separate from shared Brain knowledge; Brain results stay advisory.                                                                                                                                                                                                                                     |
| AC-08 | Skills discovery, exact-release validation, and job-execution evidence are Lisa domain request/outcome policy. Legacy run/tool operations are denied. Wave B binds Skills requests to public Item 2 Skills exports actually present on the accepted head.                                                                        |
| AC-09 | Autowork requests, status, handoffs, and receipts are Lisa domain request/outcome policy. Terminal regression and idempotency mutation are denied. Wave B binds them to public Item 2 Autowork and Brain exports actually present on the accepted head.                                                                          |
| AC-10 | Libraries discovery and retrieval accept only admitted selectable revision-2 records with exact-release identity. Contribution remains excluded. Wave B binds Libraries requests to public Item 2 Libraries exports actually present on the accepted head.                                                                       |
| AC-11 | Unavailable, revoked, unauthorized, stale, disabled, and contract-incompatible providers produce typed `unavailable` or `denied` results with HOLD behavior and no silent fallback.                                                                                                                                              |
| AC-12 | Retry/replay follows section 8.4. Invalid bodies are not retried as unavailability.                                                                                                                                                                                                                                              |
| AC-13 | Obsolete Lisa-owned provider references in section 9 are replaced when contract-independent, completed in Wave B when export-dependent, or labeled historical. No Lisa contract remains on v1 MCP run/write names.                                                                                                               |
| AC-14 | Focused positive, negative, and unavailability tests exist for each provider Lisa consumes, using fakes only. Wave B adds wiring tests against public barrels without live providers.                                                                                                                                            |
| AC-15 | No production, schedule, VPS, service, or live credential proof is claimed.                                                                                                                                                                                                                                                      |
| AC-16 | Item 3 opens no PR until IDE Development v2.4.0 rollout is recorded. Until then, the only git actions are commit, push, and checkpoint.                                                                                                                                                                                          |
| AC-17 | The complete operating-model non-regression ledger in section 10.4 is preserved and covered by focused source/static tests; no provider path bypasses its model, Cursor, sandbox, Google, approval, planning, memory, channel, job, Personality, or runtime boundaries.                                                          |
| AC-18 | Wave A depends only on Lisa-owned ports and deterministic fakes. No deep imports of `extensions/*/src/**`. No guessed Item 2 adapter exports.                                                                                                                                                                                    |
| AC-19 | Wave B is a single narrow adapter-wiring packet that starts only after a clean independently accepted Item 2 exact commit and tree from section 12.2. It binds Wave A ports to public `extensions/link*/api.ts` barrels, records exact pins and actual exports from that head, and stops if a required public export is missing. |

## 14. Documentation acceptance

This PRD is accepted when the Codex supervisor records that:

1. verified facts and assumptions remain correctly separated;
2. ownership, requirements, exclusions, and no-production boundaries are complete;
3. the Principal Wave A/B split is recorded and every acceptance criterion is implementable without editing or duplicating Item 2 adapters;
4. Wave B execution-time Item 2 fields are not hard-coded to a still-reviewing candidate;
5. Wave A is authorized to start from recorded `origin/development` without waiting for Item 2 completion.

The supervising Codex agent remains responsible for that acceptance.
