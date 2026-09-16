---
summary: "Implementation plan mapping Item 3 Lisa PRD acceptance criteria to Wave A policy packets now and a later Wave B adapter-wiring packet"
read_when:
  - Executing Orchestrator Item 3 Wave A Lisa policy source from origin/development
  - Executing Wave B adapter wiring after an independently accepted Item 2 head exists
  - Reviewing Lisa five-provider connection packets, tests, or rollback
title: "Item 3 Connect OpenClaw Prime Lisa Implementation Plan"
---

# Item 3 Connect OpenClaw Prime Lisa Implementation Plan

**Status:** Accepted docs baseline with Wave B §2.2 execution-time amendment on issue/190. Principal superseding authorization 2026-08-17 enabled Wave A; Wave B §2.2 filled 2026-08-17 against independently accepted Item 2 head `90dad7381cce213db23fa81881787c4ea7d1ad0a` / tree `8358bc165dbe0d5c48d61c7c906c773ee6f14ac1`. This plan still authorizes no runtime, VPS, credential, schedule, production, or PR change.

**Companion PRD:** [Item 3 Lisa PRD](/ITEM-3-CONNECT-OPENCLAW-PRIME-LISA-PRD).

**Documentation branch:** `issue/189-author-lisa-five-provider-connection-prd-and-imp`.

**Documentation start SHA / tree:** `f1ca4e8ad32ef87babad397a2ee14c44d5512c1b` / `8843e51cd6d3e2df695d33c68c27724e7ff56502`.

**Amendment date:** 2026-08-17 Asia/Taipei. Principal superseded the wait-for-Item-2 source gate.

**Wave B §2.2 amendment (issue/190):** 2026-08-17 Asia/Taipei. Filled from independently accepted Item 2 public-barrel identity at commit `90dad7381cce213db23fa81881787c4ea7d1ad0a` / tree `8358bc165dbe0d5c48d61c7c906c773ee6f14ac1` without modifying Issue #188 / PR #191.

## 1. Execution gate

Documentation may complete on this issue branch now. This documentation closeout does not start Lisa source packets.

Item 2 owns reusable OpenClaw provider adapters. Item 3 must not edit or duplicate them in either wave. No deep imports. No guessed adapter exports.

### 1.1 Wave A gate (now)

Wave A Item2-independent Lisa policy source may start when all of the following are true:

1. The Principal Wave A authorization in the companion PRD is in force.
2. The table in section 2.1 is filled from `origin/development`, not from memory, not from this document's inspection notes, and not from a still-reviewing Item 2 SHA.
3. The Item 3 Wave A worktree is created from that exact development commit/tree on a **new** `issue/<n>-<slug>`, not from this documentation branch.
4. Packets use Lisa-owned ports and deterministic fakes only.
5. The packet uses commit, push, and checkpoint only.
6. No Item 3 PR is opened until IDE Development v2.4.0 rollout is recorded.

If Item 2 review remains unclean, Wave A continues. Implementers do not repair Item 2, do not layer Wave A from a still-reviewing SHA, and do not treat an Item 2 candidate as the Wave A base.

### 1.2 Wave B gate (later)

The single Wave B adapter-wiring packet may start only when all of the following are true:

1. Item 2 has a clean independently accepted exact head.
2. The table in section 2.2 is filled from that head, including actual public barrel exports read from that tree.
3. Wave A packets through P-09 are checkpointed, or the unfinished Wave A work is deliberately layered onto that accepted head without prefer-incoming.
4. The wiring packet uses commit, push, and checkpoint only.
5. No Item 3 PR is opened until IDE Development v2.4.0 rollout is recorded.

If a required public export is missing on that head, Wave B stops. File the gap against Item 2. Do not duplicate the adapter, deep-import `extensions/*/src/**`, or guess the export name.

## 2. Execution-time fields

### 2.1 Wave A fields

Fill these at Wave A source-packet start. Leave Item 2 fields in section 2.2 blank.

| Field                     | Value at Wave A start                                               |
| ------------------------- | ------------------------------------------------------------------- |
| Development commit        | _execution-time `origin/development` SHA_                           |
| Development tree          | _execution-time `git rev-parse DEVELOPMENT^{tree}`_                 |
| Wave A issue / branch     | _execution-time new `issue/<n>-<slug>`_                             |
| Lisa port modules         | _execution-time paths under `linkbots/lisa/ops/providers/`_         |
| Fake modules              | _execution-time deterministic fake paths_                           |
| Adapter-edit confirmation | _execution-time: diff contains no Item 2 adapter or pin-file edits_ |

Inspection-time non-authority: on 2026-08-17 this documentation session observed Item 2 still reviewing on `issue/188-connect-openclaw-prime-remaining-providers`. That still-reviewing commit/tree must not be copied into section 2.1 or used as a Wave A source base.

### 2.2 Wave B Item 2 fields

Filled at Wave B start on issue/190 from the independently accepted Item 2
public-barrel identity (PR #191 non-draft/unmerged; no edits to #188/#191).
Canonical machine record: `linkbots/lisa/ops/providers/wiring.ts`
(`LISA_WAVE_B_ACCEPTED_ITEM2`, `LISA_WAVE_B_RECORDED_EXPORTS`,
`LISA_WAVE_B_PORT_BINDING_MAP`).

| Field                       | Value at Wave B start                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Item 2 issue                | #188                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Item 2 branch               | `issue/188-connect-openclaw-prime-remaining-providers` (phase `phase/188-connect-openclaw-prime-providers`; PR #191)                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Item 2 accepted commit      | `90dad7381cce213db23fa81881787c4ea7d1ad0a`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Item 2 accepted tree        | `8358bc165dbe0d5c48d61c7c906c773ee6f14ac1`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Independent review identity | Orchestrator-accepted Item 2 public-barrel head for Lisa P-10; PR #191 open non-draft/unmerged at that exact head/tree                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Pin profile on that tree    | `ocp-01`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Public barrels present      | `extensions/linkplatform/api.ts`, `extensions/linkbrain/api.ts`, `extensions/linkskills/api.ts`, `extensions/linklibraries/api.ts`, `extensions/linkautowork/api.ts`                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Actual public exports       | Platform: `PLATFORM_COMMIT`, `PLATFORM_TREE`, `PLATFORM_AUTH_CLAIMS_CONTRACT_VERSION`, `PLATFORM_AUTH_CLAIMS_SCHEMA_VERSION`, `PROVIDER_STATUSES`, `validatePlatformTrustFacts`. Brain: `LINKBRAIN_V2_COMMIT`, `LINKBRAIN_V2_TREE`, `BRAIN_V2_OPERATIONS`, `createBrainV2Client`. Skills: `SKILLS_COMMIT`, `SKILLS_TREE`, `isModernSkillsOperation`, `validateExactRelease`. Libraries: `LIBRARIES_COMMIT`, `LIBRARIES_TREE`, `validateRevision2Record`. Autowork: `AUTOWORK_COMMIT`, `AUTOWORK_TREE`, `AUTOWORK_AUDIENCE`, `AUTOWORK_OPERATIONS`, `requestFingerprint`, `assertIdempotency`. |
| Port-to-barrel binding map  | platform → `validatePlatformTrustFacts` + `PLATFORM_*`; providerStatus → `PROVIDER_STATUSES` (hyphenated `contract-incompatible` mapped to Lisa `contract_incompatible`); skills → `isModernSkillsOperation` + pin constants + `validateExactRelease`; autowork → `AUTOWORK_*` + recorded fingerprint/idempotency helpers (Lisa fingerprints retained; no live Autowork transport); libraries → `LIBRARIES_*` + `validateRevision2Record`; brain → `BRAIN_V2_OPERATIONS` + pin constants + `createBrainV2Client` named only (no live transport); clock → Lisa-injected `LisaPolicyClock`.     |

## 3. Layering and git mechanics

1. **Wave A:** fetch `origin/development` and confirm `git rev-parse DEVELOPMENT^{tree}` matches the recorded tree. Create a new `issue/<n>-<slug>` worktree from that exact commit (`--prefer-worktree`). Do not start from this documentation branch. Do not work on `development` itself. Do not start from a still-reviewing Item 2 SHA.
2. **Wave B:** fetch the accepted Item 2 commit and confirm `git rev-parse ACCEPTED^{tree}` matches the recorded tree. Layer unfinished or checkpointed Lisa Wave A work onto that exact head. Repair conflicts deliberately. Do not use prefer-incoming. Do not merge Item 2 into `development`. Do not open a PR.
3. Do not start Wave B from dirty `development` alone, from this documentation branch, or from an unaccepted Item 2 candidate.
4. If Item 2 later moves to a new accepted head, stop in-flight Wave B, record the new section 2.2 fields, and rebase only unfinished Lisa wiring onto the new accepted head. Do not rewrite a frozen reviewed Lisa SHA. Wave A packets already checkpointed on development remain valid policy source.
5. Rollback is `git revert` of the Lisa packet commit on the Lisa issue branch, or abandoning an unpushed packet. Never force-push `development`, `staging`, or `main`. Never reset Item 2.

## 4. Path ownership

### 4.1 Lisa Item 3 may add or edit

| Path                                                                                                       | Why                                                                                                        |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `linkbots/lisa/ops/providers/`                                                                             | Lisa policy, ports, fakes, and later Wave B wiring. Create the directory in P-01/P-02.                     |
| `linkbots/lisa/ops/providers/ports.ts`                                                                     | Lisa-owned dependency-injected ports. Wave A contract.                                                     |
| `linkbots/lisa/ops/providers/fakes.ts`                                                                     | Deterministic fakes for Wave A tests.                                                                      |
| `linkbots/lisa/ops/providers/*.test.ts`                                                                    | Focused Lisa policy and fake tests.                                                                        |
| `linkbots/lisa/ops/providers/wiring.ts`                                                                    | Wave B only. Binds ports to public Item 2 barrels recorded in section 2.2.                                 |
| `linkbots/lisa/ops/jobs/lisa-job-catalogue.ts`                                                             | Replace placeholder provider dependency refs with pin-backed refs from `origin/development` pins, or HOLD. |
| `linkbots/lisa/ops/jobs/lisa-job-contracts.ts`                                                             | Add closed Lisa provider outcome types if missing.                                                         |
| `linkbots/lisa/ops/jobs/time-management/*`                                                                 | Replace string `linkbrain` destination with policy HOLD in Wave A; Wave B may bind Brain v2.               |
| `linkbots/lisa/Personality files/` only where a Lisa-owned contract currently names v1 provider operations | Obsolete-reference replacement. Do not edit live memory.                                                   |
| `docs/ITEM-3-CONNECT-OPENCLAW-PRIME-LISA-PRD.md`                                                           | Supervisor corrections only.                                                                               |
| `docs/ITEM-3-CONNECT-OPENCLAW-PRIME-LISA-IMPLEMENTATION-PLAN.md`                                           | Supervisor corrections and later execution-time field fill via amendment, not silent rewrite.              |

Wave A policy modules import Lisa-owned ports only. They must not import Item 2 adapters, `extensions/*/src/**`, core `src/**`, or provider repositories.

Wave B `wiring.ts` may import only:

- `extensions/linkplatform/api.ts`
- `extensions/linkbrain/api.ts`
- `extensions/linkskills/api.ts`
- `extensions/linklibraries/api.ts`
- `extensions/linkautowork/api.ts`

and only symbols recorded in section 2.2 from the accepted head.

### 4.2 Lisa Item 3 must not edit

- `extensions/linkplatform/src/**`, `extensions/linkbrain/src/**`, `extensions/linkskills/src/**`, `extensions/linklibraries/src/**`, `extensions/linkautowork/src/**`
- `docs/link-integrations/ocp-01/provider-pins.json` and `verify-provider-pins.mjs`
- workflows, LaunchAgents, VPS units, live config, credentials, schedules
- Item 2 tests except by calling public barrels from Wave B wiring tests
- provider clones under `Projects/LiNK*`

If an accepted Item 2 barrel is missing an export Lisa needs, stop. File the gap against Item 2. Do not duplicate the adapter under `linkbots/lisa`. Do not guess the export. Do not deep-import.

## 5. Packet map

Every PRD acceptance criterion maps to one primary packet. Some criteria are invariants on every packet.

| Packet | Wave | Name                                                | Primary ACs                   | Depends on                                        | Parallel with                                                                                |
| ------ | ---- | --------------------------------------------------- | ----------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| P-00   | A    | Wave A execution-time freeze                        | AC-01, AC-16                  | Recorded `origin/development`                     | Nothing. Serial gate.                                                                        |
| P-01   | A    | Layer, ports, and fake scaffold                     | AC-01, AC-02, AC-16, AC-18    | P-00                                              | Nothing                                                                                      |
| P-02   | A    | Lisa identity requirements                          | AC-03, AC-04                  | P-01                                              | Nothing. Foundation for domain packets.                                                      |
| P-03   | A    | Allowed capability matrix and denial                | AC-05, AC-11, AC-12           | P-02                                              | Serial before domain packets                                                                 |
| P-04   | A    | Privacy, memory, and knowledge                      | AC-06, AC-07                  | P-02                                              | After P-03, or with P-05/P-06/P-07 only if those packets do not edit the same privacy module |
| P-05   | A    | Skills domain request and outcome policy            | AC-08                         | P-03, P-04                                        | P-06, P-07                                                                                   |
| P-06   | A    | Autowork domain request and outcome policy          | AC-09                         | P-03, P-04                                        | P-05, P-07                                                                                   |
| P-07   | A    | Libraries domain request and outcome policy         | AC-10                         | P-03, P-04                                        | P-05, P-06                                                                                   |
| P-08   | A    | Contract-independent obsolete reference replacement | AC-13 (Wave A portion)        | P-05, P-06, P-07                                  | Nothing after domain packets, so replacements match the new names                            |
| P-09   | A    | Non-regression audit, checkpoint, and stop          | AC-14, AC-15, AC-16, AC-17    | P-08                                              | Nothing                                                                                      |
| P-10   | B    | Adapter wiring and exact pin record                 | AC-03, AC-13 remainder, AC-19 | P-09 and independently accepted Item 2 exact head | Nothing. Serial after Wave A and Item 2 acceptance.                                          |

Invariant on **every** source packet: AC-02, AC-11, AC-15, AC-16, AC-17, AC-18. If a packet would violate them, it stops. AC-19 applies only to P-10.

### 5.1 Safe parallelism

- P-00, P-01, P-02, and P-03 are serial.
- P-04 should land before or with the first domain packet that emits provider payloads.
- P-05, P-06, and P-07 may run in **separate worktrees** from the same P-04 parent SHA if they own disjoint files:
  - P-05: `linkbots/lisa/ops/providers/skills.ts` and tests
  - P-06: `linkbots/lisa/ops/providers/autowork.ts` and tests
  - P-07: `linkbots/lisa/ops/providers/libraries.ts` and tests
- Do not parallelize two packets that edit `lisa-job-catalogue.ts`, `ports.ts`, `fakes.ts`, or the shared policy facade.
- P-08 is serial after the domain packets.
- P-09 is serial after P-08. Wave A may checkpoint here while Item 2 is still reviewing.
- P-10 is serial and must not run in parallel with any Wave A packet that edits the same Lisa provider files.
- Wave A may proceed while Item 2 remains under review. Wave B must not start from that reviewing SHA.
- Never share a checkout while another session is using it.

## 6. Packet specifications

Each packet uses the template in section 10. Details below are the bounded work, tests, and stop conditions.

### P-00 Wave A execution-time freeze

**Work:** Record section 2.1 from Git. Confirm the Wave A base is exact `origin/development` commit/tree. Confirm the still-reviewing Item 2 SHA is not used as the base. Confirm this documentation branch is not the source branch.

**Tests:** none beyond `git rev-parse` and a read-only ownership checklist.

**Stop:** missing development identity, dirty unmatched tree, working on `development` or this documentation branch, or attempt to start from Item 2 candidate SHA.

**Rollback:** do not create the Lisa issue branch.

### P-01 Layer, ports, and fake scaffold

**Work:** Create the Lisa issue branch/worktree from the recorded development commit. Add Lisa-owned port types and deterministic fake implementations under `linkbots/lisa/ops/providers/`. Ports name Lisa policy operations, not guessed Item 2 export identifiers. No provider calls and no Item 2 adapter imports yet.

**Owned paths:** issue branch metadata, `ports.ts`, `fakes.ts`, and empty policy directory created with P-02 if that keeps the diff atomic.

**Stop:** accidental checkout of documentation branch 189, working on `development`, a still-reviewing Item 2 SHA, or any edit to `extensions/link*/src/**`.

### P-02 Lisa identity requirements

**Work:** Add `linkbots/lisa/ops/providers/identity.ts` that:

- accepts Platform facts as input through the Lisa identity port;
- requires Lisa actor, binding, org, audience, capability, expiry, and `revocationStatus: "active"`;
- returns a closed Lisa identity handle or typed `denied`.

Add `assertNoCredentialInheritance()` for helper agent ids. Tests inject the identity fake. Do not import Item 2 claim helpers in this packet.

**Positive tests:** valid Lisa facts accepted by the fake.

**Negative tests:** wrong actor, expired, revoked, missing capability, accessor-backed facts, helper agent presenting Lisa facts.

**Unavailability tests:** not applicable; identity failure is `denied`.

**AC:** AC-03, AC-04.

### P-03 Allowed capability matrix and denial

**Work:** Add `linkbots/lisa/ops/providers/capabilities.ts` with the exhaustive allowlists from PRD section 7. Unknown operation, denied Autowork kinds (`external_assistance`, `media_package`, `outreach_adapter`), and legacy v1 names return `denied` before any domain port call.

**Positive tests:** each allowed operation name is admitted after identity succeeds.

**Negative tests:** each denied/legacy name is rejected; extra fields do not widen the allowlist.

**Unavailability tests:** capability matrix itself does not call the network. If the bound provider status fake is supplied as `disabled` / `contract_incompatible`, return `unavailable` without attempting the operation.

**AC:** AC-05, AC-11, AC-12 (denial versus unavailability split).

### P-04 Privacy, memory, and knowledge

**Work:** Add `linkbots/lisa/ops/providers/privacy.ts` that inspects intended payloads and job privacy class. Reject prohibited payloads from PRD section 6.2. Shared Brain knowledge requests must be classified `work`. `private_health` and `personal_compliance` cannot select Brain shared knowledge, Skills, Libraries, or Autowork.

**Positive tests:** work-class knowledge browse with redacted metadata-only fixture accepted by policy (still advisory).

**Negative tests:** transcript, secret-shaped string, private health fixture, and conversation content to Skills.

**Unavailability tests:** if the Brain status fake is unavailable, policy returns `unavailable` and does not read local memory as a claimed Brain result.

**AC:** AC-06, AC-07.

### P-05 Skills domain request and outcome policy

**Work:** Add `linkbots/lisa/ops/providers/skills.ts` that sends Lisa Skills requests through the Lisa Skills port. Encode discovery, exact-release validation, and job-execution evidence outcomes from PRD section 7.3. Lisa job execution emits only verify plus use-report/feedback status operations. Legacy run/tool requests are denied by P-03 and re-tested here. Do not import guessed Item 2 Skills export names.

**Positive tests:** catalog list, exact release describe/verify, use-report status with valid actor and pins against the Skills fake.

**Negative tests:** `skills_run_start`, `skills_tool_invoke`, missing `skillId` where required, cross-operation fields, accessor-backed request.

**Unavailability tests:** provider status offline/stale/unauthorized; missing exact release.

**AC:** AC-08.

### P-06 Autowork domain request and outcome policy

**Work:** Add `linkbots/lisa/ops/providers/autowork.ts` that builds Lisa Autowork requests through the Lisa Autowork port: audience `autowork`, opaque refs only, optional Lisa handoff-ref field, request fingerprint, receipt, callback progression, and idempotency. Handoff create/accept goes through the Lisa Brain port after P-04. Do not import guessed Item 2 Autowork export names.

**Positive tests:** allowed operation request accepted; receipt bound to fingerprint; legal callback progression; handoff ref correlation.

**Negative tests:** wrong audience, terminal regression, mutated body with same idempotency key, denied Autowork kinds, pre-issuance revocation, missing fingerprint match.

**Unavailability tests:** Autowork state `unavailable` / `contract_incompatible`; revoked binding.

**AC:** AC-09.

### P-07 Libraries domain request and outcome policy

**Work:** Add `linkbots/lisa/ops/providers/libraries.ts` that sends Lisa Libraries requests through the Lisa Libraries port. Lisa may select only admitted selectable records of the allowed artifact types. Do not import guessed Item 2 Libraries export names.

**Positive tests:** catalogue page with selectable admitted record; exact-release pass receipt matching pins and catalogue membership.

**Negative tests:** contribution intake attempt; non-selectable/withdrawn record; inherited catalogue fields; truthy non-boolean `resolved`; selected record not in hashed catalogue.

**Unavailability tests:** missing catalogue snapshot; provider disabled.

**AC:** AC-10.

### P-08 Contract-independent obsolete reference replacement

**Work:** Update Lisa-owned files from PRD section 9 Wave A rows:

- job catalogue provider dependencies to pin-backed contract refs from `origin/development` `provider-pins.json` identities, or HOLD if the replacement would name an unaccepted Item 2 export;
- time-management destination/ledger strings to Wave A policy HOLD outcomes;
- comments or Lisa-owned docs that still present the July 2026 two-provider plan or v1 MCP run tools as current Lisa contract.

Do not rewrite Issue 183 preserved ledger files. Do not edit Item 2 adapters to delete v1 compatibility they still own. Leave export-dependent replacements for P-10.

**Positive tests:** catalogue provider refs match development pins or explicit HOLD; time-management no longer claims a live LiNKbrain write.

**Negative tests:** leftover `skills_run_start` or `brain_capture_batch` as Lisa-allowed names in Lisa policy tests.

**AC:** AC-13 (Wave A portion).

### P-09 Non-regression audit, checkpoint, and stop

**Work:** Run the focused tests from P-02 through P-08 in one command. Add a
focused source/static non-regression audit covering every PRD section 10.4
ledger entry: model routing, Cursor ACP delegation, main/lisa-cron sandbox
separation, both Google identities and safe wrappers, Carlos approval gates,
planning/HOLD behavior, memory/privacy, jobs/heartbeat/channels, Personality
and tool doctrine, and the source-versus-live runtime boundary. The audit must
prove that the Item 3 diff does not weaken or bypass those contracts; it must
not rewrite them to make a test pass. Run `git diff --check`. Checkpoint with
commit+push and stop without `review-ready` and without a PR until IDE
Development v2.4.0 rollout is recorded. Wave A may stop here while Item 2 is
still reviewing.

**AC:** AC-14, AC-15, AC-16, AC-17.

### P-10 Adapter wiring and exact pin record

**Work:** Fill section 2.2 from the independently accepted Item 2 exact commit and tree. Confirm the five public barrels exist on that head. Record actual exported symbols; do not guess. Add `linkbots/lisa/ops/providers/wiring.ts` that binds Wave A ports to those recorded public barrel exports only. Record exact `ocp-01` pins from that accepted tree. Complete remaining PRD section 9 Wave B obsolete-reference replacements that required those export names. Re-run focused Lisa tests with wiring plus fakes for any remaining transport. No live provider, VPS, or credential use.

**Tests:** wiring constructs the bound ports from recorded exports; missing export fails closed; no `extensions/*/src/**` import; pin identities match the accepted tree; previously fake-covered policy tests still pass through the bound ports.

**Stop:** Item 2 head not independently accepted; tree mismatch; required public export missing; guessed export; deep import; adapter duplication.

**AC:** AC-03 (binding), AC-13 remainder, AC-19.

## 7. Test matrix

Use `node scripts/run-vitest.mjs` on the Lisa policy test files only. Do not start a second Vitest process in the same worktree. Do not call live providers.

| Area          | Positive                                          | Negative                                                                    | Unavailability                                         |
| ------------- | ------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------ |
| Identity      | Valid Lisa Platform facts                         | Wrong actor, helper inheritance, revoked, expired, inherited/accessor facts | Not used; identity errors are denied                   |
| Capabilities  | Each PRD section 7 allowlist name                 | Legacy v1 names; denied Autowork kinds; unknown operation                   | Provider status disabled/incompatible                  |
| Privacy       | Work-class advisory knowledge                     | Private health, transcripts, secrets to Skills/Libraries/Autowork           | Brain unavailable does not become local-memory success |
| Skills        | Discover, verify exact release, use-report status | `skills_run_*`, `skills_tool_*`, cross-operation fields                     | Missing release, unauthorized, offline                 |
| Autowork      | Request/receipt/callback/handoff correlation      | Audience mismatch, terminal regression, idempotency mutation                | `unavailable`, revoked, pre-issuance revocation        |
| Libraries     | Selectable admitted exact retrieval               | Contribution, non-selectable, catalogue tamper                              | Missing snapshot, disabled                             |
| Obsolete refs | Pin-backed catalogue refs or explicit HOLD        | Residual v1 Lisa contract names                                             | HOLD when pin or bound adapter missing                 |
| Wiring (P-10) | Ports bind to recorded public exports             | Guessed export, deep import, missing barrel                                 | Missing accepted Item 2 head does not start P-10       |

## 8. Review, repair, evidence, rollback, and stop

### 8.1 Review

- Implementer does not open a PR and does not request Bugbot.
- Every clean source checkpoint receives an independent exact-head review before acceptance. Post-rollout Packager review remains a separate delivery gate.
- Codex supervisor acceptance of these two documents is separate from later source review.

### 8.2 Repair

- Continue bounded repair/review while findings are actionable, in scope, and each cycle makes measurable progress. Stop only for repeated unresolved findings, consecutive no-progress cycles, redesign or new-authority requirements, infrastructure retry exhaustion, or an explicit resource limit. Retain the separate two-attempt infrastructure retry limit. There is no fixed three-repair stop.
- If the defect is in Item 2 adapters, stop and return it to Item 2. Do not patch adapters from Item 3.
- Immediate failure types (credentials, usage limit) are not auto-repaired.

### 8.3 Evidence

When a Lisa source issue is actually finished and v2.4.0 allows packaging:

1. Focused Lisa tests pass.
2. `git diff --check` passes.
3. Working tree clean; `HEAD` equals `origin/<lisa-issue-branch>`.
4. `python3 scripts/gitops/completion_gate.py write-evidence` tied to that exact SHA.
5. `python3 scripts/gitops/completion_gate.py review-ready` only after the above.

Until v2.4.0 rollout: commit, push, checkpoint, stop. Wave A may reach this checkpoint before Wave B.

### 8.4 Rollback

- Unpushed packet: delete the Lisa worktree after recording the stop.
- Pushed packet: revert the Lisa commit on the Lisa issue branch.
- Do not revert Item 2.
- Do not use prefer-incoming on conflicts.

### 8.5 Stop conditions

Stop immediately when any of these hold:

- Wave A base is not the recorded `origin/development` commit/tree;
- Wave A would start from a still-reviewing Item 2 SHA;
- Wave B Item 2 exact head is not independently accepted;
- accepted Wave B tree does not match the recorded tree;
- required public export is missing, guessed, or reachable only by deep import;
- packet would edit a forbidden path or duplicate an Item 2 adapter;
- live runtime, VPS, credential, or schedule change is requested;
- independent review of a frozen Lisa SHA is in progress;
- someone asks to open an Item 3 PR before IDE Development v2.4.0 rollout.

## 9. Explicit exclusions

Same as PRD section 11. Packets that would touch those surfaces are out of scope even if that would make a test greener.

## 10. Reusable packet template

Copy this block into each Lisa source packet record. Replace angle-bracket fields. Do not pre-fill Item 2 SHAs from documentation inspection. Do not guess adapter exports.

```text
Packet ID: P-0X
Wave: <A | B>
Title: <bounded Lisa work>
Issue / branch / worktree: <filled by agentsetup>
Parent SHA / tree: <Wave A: origin/development from section 2.1 | Wave B: Item 2 accepted from section 2.2>
This packet SHA / tree: <filled after commit>
Acceptance criteria: <AC-..>
Owned paths:
  - <exact files>
Forbidden paths:
  - extensions/link*/src/**
  - docs/link-integrations/ocp-01/provider-pins.json
  - workflows, runtime, credentials, VPS, schedules
  - duplicated Item 2 adapters under linkbots/lisa
Dependencies: <P-0Y; Wave B also requires independently accepted Item 2 exact head>
Parallelism: <serial | parallel with P-0Z on disjoint files>
Ports / fakes / wiring:
  - Wave A: Lisa-owned ports + deterministic fakes only
  - Wave B: bind recorded public extensions/link*/api.ts exports only
Work:
  - <steps>
Tests:
  - positive: <node scripts/run-vitest.mjs <file>>
  - negative: <...>
  - unavailability: <...>
Evidence:
  - test result:
  - git diff --check:
  - HEAD == origin/<branch>:
Review: none by implementer; no PR; no Bugbot
Repair policy: continue actionable in-scope repairs while measurable progress continues; stop for repeated unresolved findings, consecutive no-progress cycles, redesign/new authority, infrastructure exhaustion, or an explicit resource limit; no fixed three-repair stop; Item 2 defects return to Item 2
Rollback: revert this packet commit or abandon unpushed worktree
Stop if:
  - Wave A parent no longer matches section 2.1
  - Wave B parent no longer matches section 2.2 or Item 2 head is not independently accepted
  - required public export missing, guessed, or deep-imported
  - forbidden path required or Item 2 adapter would be duplicated
  - live/runtime/credential/schedule/production requested
  - PR requested before IDE Development v2.4.0
Checkpoint: commit + push only
```

## 11. Documentation packet closeout

This documentation issue (#189) is complete when:

1. the two named documents exist;
2. documentation validation and `git diff --check` pass;
3. the issue branch is committed, pushed, and remote-equal;
4. no PR is opened;
5. the Codex supervisor is left to accept or correct both documents.

No Lisa source packet is started by this documentation closeout. Wave A source starts on a later new issue branch from recorded `origin/development`.
