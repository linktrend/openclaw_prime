# OpenClaw Prime and Lisa Common Agent Foundation Implementation Roadmap

> **For execution agents:** Use IDE Development v2.5.1 Coding Execution Protocol `1.0.1` with amendment `V25_BOOTSTRAP_LEAN`. Each packet is repository-owned, lease-bound, issue-scoped, independently verified by Terra, and accepted only at an exact pushed commit/tree. This document is a plan; implementation requires separate approval.

**Goal:** Deliver a reusable, secure OpenClaw agent foundation proven through Lisa, recreate the approved Lisa VPS state from source, add only the verified missing Platform and Autowork provider contracts, and leave inactive future-agent blueprints.

**Architecture:** Extend existing OpenClaw agent/profile, per-agent SQLite, cron, channel, model-runtime, browser, sandbox, Workspace, and provider-consumer seams. Keep provider and domain authority separate. Reconcile the unmerged Lisa fixes onto current source, then converge all Lisa instance configuration through one deployable desired state and a final integrated VPS acceptance packet.

**Technology:** TypeScript/Node, Kysely/SQLite, OpenClaw cron/channel/plugin SDK, shell/systemd deployment assets, Playwright-managed Chromium, standard MCP, JSON Schema, IDE Development v2.5.1 execution manifests.

**Primary PRD:** `docs/execution/openclaw-prime-lisa/FINAL-PRD.md`

## 1. Execution topology

The program uses three repository-owned execution manifests:

- OpenClaw: `docs/execution/openclaw-prime-lisa/openclaw-prime-lisa.execution-manifest.json`
- Platform: `docs/execution/openclaw-prime-lisa/linkplatform-agent-foundation.execution-manifest.json`
- Autowork: `docs/execution/openclaw-prime-lisa/linkautowork-skill-watcher.execution-manifest.json`

The required controlling companion is `docs/execution/openclaw-prime-lisa/dispatch-authority.json`, validated by `docs/execution/openclaw-prime-lisa/dispatch-authority.schema.json`. All three manifests identify it through `program.targetRelease=openclaw-prime-lisa-dispatch-authority-v4`; the companion binds each manifest by SHA-256 digest. Each manifest also has a separate schema-validated routing matrix, bound by digest from the companion:

- OpenClaw: `docs/execution/openclaw-prime-lisa/openclaw-prime-lisa.routing-matrix.json`
- Platform: `docs/execution/openclaw-prime-lisa/linkplatform-agent-foundation.routing-matrix.json`
- Autowork: `docs/execution/openclaw-prime-lisa/linkautowork-skill-watcher.routing-matrix.json`

`docs/execution/openclaw-prime-lisa/portfolio-routing-matrix.json` is the consolidated 13-packet view and digest-binds all three repository matrices. It prevents route capability from being rediscovered packet by packet.

The companion, not this prose graph, is authoritative for cross-repository prerequisites and per-packet model routes. Dispatch fails closed unless its mapping is valid, the three manifest digests and target-release identifiers match, every prerequisite has an exact receipt in the runtime authority snapshot, and a separate execution-approval snapshot is bound to the committed package. At this checkpoint `executionAuthorizedAtCheckpoint=false`.

The dispatch backend is the authenticated Cursor SDK. Preferred automatic work selects exact Router ID `auto-smart` with `optimize_for=cost`; generic Auto, Auto Balance, Auto Intelligence, omitted-model defaults, and unverifiable Auto are forbidden. Fully bounded simple/repetitive/easily verified reversible work selects Composer 2.5. Explicit complex or long-running work selects Cursor Grok 4.6 Medium. No route may use Fast. Third-party Opus is reserved for the packet-specific independent-review needs recorded in the matrices, and independent Terra checkpoint verification remains a distinct worker using exact ID `gpt-5.6-terra-high`.

The Principal confirms exactly one Cursor account serves the entire portfolio and this Program Run. That statement binds the run to `apiKeyName=LiNKdeveloper`, `userId=348277621`, `product@linktrend.media`, Cursor SDK `1.0.28`, and capability receipt `sha256:23a0173dc24e67a86a87aacd7aee8b8ec93719371070a7e26fe7045b33267aeb`. The receipt proves 36 models with `auto-smart` and `optimize_for=cost` absent and generic default Auto only. It satisfies the once-per-Program-Run capability preflight; do not request another identity record or preflight. PKT-01 and PKT-07 are directly reclassified to Composer 2.5 because both are bounded, reversible, and objectively verified. Their authority-v3 Auto Cost PREPARED identities are immutable, superseded, and dispatch-ineligible.

Every dispatch must persist and identically read back its `PREPARED` intent, requested selector and parameters, catalogue membership, selected/effective model, optimization mode, cost pool, usage and charge when exposed. Cursor Cloud API v1 is not accepted for Auto Cost because omission selects a configured default and does not prove cost optimization. A model-quality fallback requires a logged quality failure and is limited to one hop to a different family; an infrastructure failure retries the same model under the execution protocol. Cursor Desktop `.cursor/agents/route-*.md` materialization is not required.

The route audit forecasts 13 primary workers: 0 Auto Cost, 3 Composer 2.5, and 10 Cursor Grok 4.6 Medium. Nine consequential packets additionally require an independent Opus review, and all 13 require distinct Terra verification. Composer and Grok use the Cursor Models pool; Opus and Terra use the Other Models pool only for their recorded review purpose. Auto Cost remains the permanent preferred protocol route only for a future Program Run whose exact account capability preflight proves it. The aggregate dollar ceiling remains a pre-dispatch HOLD because packet token budgets and authenticated account-plan readback are intentionally not invented in this planning checkpoint. The runtime authority snapshot must bind both before admission.

LiNKlibraries has no execution manifest because no current provider work is justified. LiNKbrain and LiNKskills provider packets remain in their separately owned programs. OpenClaw packets consume their accepted exact contracts.

IDE v2.5.1 admits at most one local packet and two hosted packets. The dependency graph below is the theoretical safe graph; actual admission remains limited by leases, complete resource snapshots, and the hosted-capacity scheduler.

```text
PKT-01 Lisa recoverable contracts/jobs ─┬─> PKT-09 source/VPS parity ─┐
                                        │                            │
PKT-02 common profile foundation ───────┼─> PKT-10 inactive roles    │
          ▲                             │                            │
          └── LP-01 Platform contract ──┼─> PKT-03 provider gates    │
                                        │                            ├─> PKT-11 Lisa integration
PKT-04 model evaluation/router ─────────┤                            │
PKT-05 task/private state ──────────────┤                            │
PKT-06 governed browser ────────────────┤                            │
PKT-07 Workspace expansion ─────────────┤                            │
PKT-08 Brain/Skills MCP consumers ──────┘                            │
          ▲                                                          │
          └── accepted Brain/Skills provider contracts               │

AW-01 Skills update watcher <── accepted Skills intake + LP-01
```

## 2. Baselines and promotion discipline

- OpenClaw authoritative start: `linktrend/openclaw_prime` commit `e3e837225651d151136af16bb81b5ad0d5ed0df5`, tree `381cd799a52834b14f9317d2c20b640880d47737`, fork `main`.
- Platform planned start: `linktrend/LiNKplatform` remote `main` commit `76caa010acb09722218dd691e42756bc8cd351ec`, tree `1cb6da7fed41b5a36fbf6c3914b12a1194a4282b`. The first issue must reconcile branch/release asymmetry before editing functionality.
- Autowork planned start: `linktrend/LiNKautowork` remote `main` commit `ee54d9c00c3659c950e8d2beaeb804131b0d0e8b`, tree `0502aa8cabe145925b234ced55993f8bb89710d7`.
- Libraries audit reference: remote `main` commit `fba1deb99f28e66b3f5e0ec112e757d5d51b9e6d`, tree `02ca5df88529ea0c0ce4b8427a1e6ec0cc449c08`; no provider packet.

Every implementation issue starts from its manifest baseline or the exact accepted dependency commit named by the packager. Identity changes invalidate prior verification. Implementers push only `issue/<n>-<slug>` and do not open/merge delivery PRs. Accepted issue commits integrate serially on a phase branch; normally one Phase PR is promoted through the protected lifecycle. Main, publish, deploy, provider-live mutation, protection changes, and production activation require recorded founder approval.

## 3. Wave plan

### Wave 0: Approval and exact-contract intake

Before mutation:

1. Load and validate the companion dispatch authority and all three bound manifest digests; HOLD on any mismatch.
2. Obtain a separate execution-approval snapshot bound to this exact package commit/tree; this checkpoint alone cannot authorize dispatch.
3. Refresh remote heads and exact trees without switching shared checkouts.
4. Resolve every packet's external prerequisites from exact contract/commit/tree receipts in the runtime authority snapshot.
5. Create repository-owned issue branches/worktrees and durable packet/repository leases.
6. Persist/read back checkout-bound heartbeat and resource snapshot.
7. Read back the bound one-account identity and applicable capability-receipt digest from authority v4; do not request another identity record or preflight.
8. Validate each fixed Composer/Grok selector and requested/effective readback; HOLD if an exact fixed model, budget, or cost pool cannot be proven.
9. Dispatch the companion's exact primary route and required reviews; the dispatch intent must carry the route and any fallback must satisfy the one-hop logged-quality-failure rule.
10. Discover Autowork when callable; if unavailable, record HOLD rather than hosted proof.

### Wave 1: Safe parallel foundations

At most two hosted packets concurrently:

- OpenClaw `PKT-01` Lisa recoverable contracts/jobs.
- Platform `LP-01` identity/grant/approval contract audit and conditional implementation.

After either slot frees, admit OpenClaw `PKT-04` model evaluation because its primary owned paths do not overlap `PKT-01`. `PKT-05` waits for `PKT-01` because both touch Lisa time-management job contracts.

### Wave 2: Common runtime capabilities

- `PKT-02` common profile foundation after LP-01's accepted identity/grant contract is known.
- `PKT-03` provider gates/pins after LP-01 and accepted Brain/Skills contracts.
- `PKT-06` governed browser and `PKT-07` Workspace expansion may run in parallel if owned-path inspection confirms no shared tool-policy file edits. Otherwise serialize.
- `PKT-08` MCP consumers waits for Brain/Skills accepted standard lifecycle/content contracts.

### Wave 3: Provider automation and operational parity

- Autowork `AW-01` waits for LP-01 and the accepted Skills assignment/candidate contract.
- `PKT-09` backup/encryption/source deployment parity waits for `PKT-01` desired state and can otherwise run independently of Autowork.
- `PKT-10` inactive executive blueprints waits for `PKT-02` and `PKT-03`; it never activates a profile.

### Wave 4: Serial integration and live acceptance

`PKT-11` is the sole Lisa integration/deployment packet. It consumes accepted exact commits from all applicable OpenClaw packets and exact provider releases. It performs stage/VPS proof and proposes production activation. It must not absorb unresolved provider work or silently modify schedules.

## 4. OpenClaw work packets

### PKT-01: Reconcile Lisa delivery contracts and canonical job desired state

**Purpose:** Land the recoverable behavior without stale branch baggage and replace contradictory source-only job authority with reproducible desired state while preserving deployed schedules.

**Primary owned paths:**

- `linkbots/lisa/ops/jobs/**`
- `linkbots/lisa/ops/templates/**`
- `linkbots/lisa/ops/lisa-profile-manifest.json`
- `linkbots/lisa/docs/LISA-JOBS-SOURCE-OPERATIONS.md`
- focused Lisa job/template/contract tests and sanitized receipts

**Steps:**

1. Diff commits `7e9b8a51122` and `3d3c93fae8c` against current main, classify every hunk as reusable, stale coordination, generated evidence, or superseded.
2. Recreate only functional changes: cron announce ownership, separate email receipt, exact digest preparation triggers, five-minute candidate leads, concise/no-change formatting, bold/no-emoji rendering, corrected health/battery/selfie/Flash behavior, and duplicate post-send suppression.
3. Inventory the 19 stable declaration keys and separately registered Memory Dreaming; prove no Librarian or backup cron is added.
4. Replace/reshape the disabled catalogue into one typed deployable desired state plus explicitly typed external maintenance dependencies. Preserve exact current Monday/monthly schedules from live/source receipts; do not recompute them.
5. Add materialization/diff verification that compares desired declarations with live-format SQLite exports but cannot mutate live cron without an explicit apply authority.
6. Delete or retire obsolete active Ship/Pull/Repair Dispatcher/pipeline/old-heartbeat instructions only when an exact negative inventory proves they are unapproved.
7. Run focused historical-equivalent tests and regenerate synthetic/sanitized receipts on the accepted tree.

**Acceptance:** 19 declarations plus Memory Dreaming are the only intended cron set; owner/executor/delivery are exact; visible trigger/deadline metadata agrees; deployed weekly/monthly times are unchanged; no stale job can be inferred from prose; no emoji/false Telegram failure/duplicate diagnostic/late battery request remains.

**Rollback:** Revert the packet commit; desired-state application is not performed by this packet.

### PKT-02: Common profile manifest, safe provisioning, and cloning exclusions

**Purpose:** Make agent provisioning reusable and inactive-by-default without carrying Lisa data.

**Primary owned paths:**

- `src/agents/agent-create.ts`
- `src/agents/agent-scope.ts`
- new `src/agents/profile-manifest*.ts`
- relevant `src/commands/agents*.ts` and config schema/help surfaces
- profile manifest tests and synthetic fixtures

**Steps:**

1. Extend existing `createAgent`/agent scope rather than adding a parallel profile authority.
2. Define a versioned manifest containing opaque identity/profile references, activation state, capability classes, exact pins, model policy reference, state owners, optional channel/account references, and exclusion declarations.
3. Add validation and dry-run provisioning; `inactive` produces no runtime actor, credential, grant, session, channel, job, recipient, or private state.
4. Add clone/export logic that copies approved generic profile structure only and rejects source manifests containing live secret/account/private-state fields.
5. Align public config/schema/help and add doctor migration only if a shipped config shape changes.

**Acceptance:** synthetic Lisa-to-future clone tests prove all private/instance data exclusions; inactive profiles cannot route, schedule, or authenticate; current agent creation remains compatible through a named migration where required.

**Approval gate:** any public config break, protocol version change, or SQLite schema-version bump.

### PKT-03: Three-gate provider consumers, exact pins, and capability exposure

**Dependencies:** `PKT-02`, accepted `LP-01`, accepted Brain/Skills provider releases.

**Primary owned paths:**

- `extensions/linkplatform/**`
- `extensions/linkbrain/**`
- `extensions/linkskills/**`
- `extensions/linklibraries/**`
- `extensions/linkautowork/**`
- `docs/link-integrations/ocp-01/provider-pins.json`
- consumer contract/integration tests

**Steps:**

1. Revalidate all five provider release commits/trees/contracts; recreate exact pin deltas on current main and never reuse the stale repin branch ancestry.
2. Carry Platform authenticated actor/audience/scope/resource/action facts through prepared runtime objects.
3. Enforce Platform eligibility, Skills qualification/selectability, and OpenClaw profile activation as independent fail-closed gates.
4. Prove Brain read and candidate/coordination write exposure, Skills exact retrieval/local execution, Libraries exact connector with no Lisa asset, and assigned-only Autowork request/status/receipt.
5. Add negative tests for role/Brain/skill/receipt-based elevation and cross-agent/cross-tenant/resource denials.

**Acceptance:** exact provider identity/digest checks pass; no discovery widens permission; no provider becomes execution or Program authority; Libraries concludes no current use.

### PKT-04: Non-coding model evaluation, transient router, and fallback migration

**Primary owned paths:**

- `src/agents/prepared-model-*`
- new `src/agents/noncoding-route*.ts`
- Lisa model-routing contract/evaluation files
- routing, fallback, latency, and profile-default tests

**Steps:**

1. Inventory and reuse valid prior evaluation evidence; identify only missing representative non-coding comparisons.
2. Build a synthetic/private-safe Lisa evaluation corpus and score quality, instruction following, safety, latency, and cost consistently.
3. Implement deterministic bounded route tags; call a classifier only for ambiguous requests and expose only minimal relevant context.
4. Apply one-response model/reasoning override without persisting it to the Telegram/browser/main-session default.
5. Replace fallback contract with native OpenAI, OpenRouter Luna Medium, direct Kimi prior stable Medium/equivalent, and direct Gemini prior stable Medium/equivalent. Resolve exact current IDs from provider catalogues at execution time.
6. Remove GLM/MiniMax routing unless a separately proven document capability requires a named route.
7. Add bounded body-free latency telemetry across ingress, lock/context, route, tools, provider, and delivery.

**Acceptance:** obvious requests add no classifier call; all surfaces share profile default; fallbacks occur only on provider/model failure; no unapproved model is used; evaluation decision record names exact IDs and evidence.

**Approval gate:** final model/default/fallback IDs and any paid document route.

### PKT-05: Principal task ledger, T-IDs, time management, and private compliance state

**Dependencies:** `PKT-01`.

**Primary owned paths:**

- `linkbots/lisa/ops/jobs/time-management/**`
- `src/state/lisa-compliance-state-*`
- new per-agent Principal-task Kysely schema/store under `src/state/`
- related Lisa tools/renderers/tests

**Steps:**

1. Replace provisional `P-*`/day-counter identity with collision-resistant immutable internal IDs and short stable `T-` display references assigned on intake.
2. Persist canonical statuses and evidence rules in Lisa's agent DB; keep execution task-registry statuses separate.
3. Add reference mappings, bounded duplicate resolution, canonical merge/alias history, and idempotent cross-channel intake.
4. Implement Google Task vs other-task separation, advisory Brain links, immutable Program references, review periods, dependency-first scheduling, protected work blocks, flexible-period decision, four-week outlook, and monthly reporting.
5. Retain the dedicated health DB; integrate only path/permission/backup ownership. Complete exact health, hydration, capacity, battery, and selfie state machines with synthetic fixtures.
6. Add privacy-negative probes covering providers, logs, telemetry, exports, fixtures, and subordinate-agent views.

**Acceptance:** one logical task remains one T-ID across channels; all status transitions/evidence rules pass; exact task state is SQLite-only; existing battery ledger and health DB are not replaced; private data leakage tests pass.

**Approval gate:** exact public T-ID display syntax if it affects external compatibility; any schema-version bump. Purely additive tolerant agent tables follow repository schema policy without a bump.

### PKT-06: Governed browser and web research runtime

**Primary owned paths:**

- `src/agents/tools/web-*.ts`
- `src/web-search/**`
- `src/web-fetch/**`
- `src/agents/sandbox/browser-*.ts`
- browser plugin/SDK seams and focused tests/docs
- Lisa VPS browser deployment assets

**Steps:**

1. Inventory existing search/read/citation/browser seams and select the leanest maintained Playwright-managed Chromium integration.
2. Add a dedicated VPS Lisa persistent profile, on-demand headless lifecycle, bounded concurrency/RAM, isolated downloads, and secure temporary visual login path.
3. Enforce private/local network denial at network boundary and retain URL/DNS/redirect/rebinding validation.
4. Separate public read, approved authenticated read, navigation, login, form submission, upload/download, purchase/terms, and external-commitment capability classes.
5. Gate risky actions with Platform claim plus approved standing rule/current approval; stop on uncertain identity, terms, bot protection, or authority.
6. Add hostile-page, redirect, download, secret, private-network, approval, lifecycle, and resource-limit tests.

**Acceptance:** browser compromise cannot reach private services; passwords/2FA never enter prompts/logs; no automatic execution/download opening; idle browser consumes no permanent process budget; ordinary public research produces current citations.

**Approval gate:** credential/account login, new standing rules, or material VPS egress changes.

### PKT-07: Workspace Docs/Sheets/Slides operations and exact Skills consumption

**Dependencies:** accepted qualified Google skill releases from LiNKskills.

**Primary owned paths:**

- `linkbots/lisa/ops/google-workspace/**`
- relevant OpenClaw Lisa tool exposure/configuration
- synthetic account/calendar/document contract tests

**Steps:**

1. Re-prove current Gmail/Calendar/Drive/Tasks wrappers and the `.env` ancestry-guard repair; do not mislabel wrapper failures as OAuth expiry.
2. Add only the safe gws operations required by qualified official Docs/Sheets/Slides skills.
3. Bind exact Lisa account, Carlos Tasks identity, work calendar, Routine, and shared personal-events scopes by opaque private references.
4. Add negative tests for inaccessible private company/personal calendars, Carlos mailbox, wrong account, and scope escalation.
5. Prove skill retrieval by exact release/digest and local execution; no copied skill bodies or browser-only replacement.

**Acceptance:** Calendar/Drive/Gmail/Tasks remain functional; Docs/Sheets/Slides supported operations match declared contracts; digest calendar scope is exact; tokens/IDs remain out of source/model-visible logs.

### PKT-08: Standard MCP v2 Brain/Skills consumer migration

**Dependencies:** accepted Brain and Skills provider lifecycle/content contracts.

**Primary owned paths:**

- managed MCP client lifecycle/tool filtering in OpenClaw
- `extensions/linkbrain/**`
- `extensions/linkskills/**`
- exact-release/MCP contract tests and migration docs

**Steps:**

1. Freeze exact provider contracts and map initialization, discovery, content retrieval, error, auth, and shutdown semantics.
2. Migrate generic managed MCP consumption to the standard lifecycle/content path.
3. Retain legacy allowlisted Skills operations only behind a named shipped compatibility contract and explicit removal plan; otherwise delete them.
4. Prove progressive discovery, exact qualified release retrieval, Brain read/write, private-data exclusion, and fail-closed disconnect/error behavior end to end.

**Acceptance:** standard MCP integration is proven against exact provider builds; Lisa-only allowlists are not the architecture; no provider-side skill execution remains selectable.

**Approval gate:** incompatible MCP/public protocol change or provider release activation.

### PKT-09: VPS backup/encryption and deployment recreation

**Dependencies:** `PKT-01`, accepted private-state contract from `PKT-05` where applicable.

**Primary owned paths:**

- new/updated `linkbots/lisa/ops/backup/**`
- Lisa deployment/systemd templates and runbooks
- restore/rollback/synthetic encryption tests and sanitized receipt schemas

**Steps:**

1. Reconcile historical runtime-only encryption wrapper, health exporter, general backup exclusions, systemd units/timers, and destination bindings without reading private contents into evidence.
2. Codify online SQLite snapshot, GSM/workload-identity key lookup, AES-256-GCM encryption, local decrypt/quick-check, ciphertext-only upload, object verification, and current-plus-previous retention.
3. Ensure company archive contains everything necessary to restore the exact pre-backup state except separated private health and credential values.
4. Implement clean-host installation, service/timer validation, bounded failure/retry policy, restore drill, rollback, and sanitized receipts.
5. Verify no Mac path/dependency and no plaintext health in ordinary backup or Drive.

**Acceptance:** a clean VPS can recreate services and restore exact functioning state; health ciphertext restore passes; plaintext and secrets are absent; backup receipts distinguish upload from restore proof.

### PKT-10: Inactive executive blueprints and business-plan workflow shell

**Dependencies:** `PKT-02`, `PKT-03`.

**Primary owned paths:**

- new inactive profile manifests under `linkbots/blueprints/**`
- generated/reviewed role summaries
- business-plan workflow contract/tests without plan content

**Steps:**

1. Encode Eric, David, Sara, and Jane role/scope/authority/capability-class requirements in inactive schema-valid manifests.
2. Add exclusion tests for Lisa identity, credentials, Workspace, private state, sessions, recipients, schedules, and jobs.
3. Add plan-drafting/review/Principal-approval receipt/version-link/Drive-publication/Brain-index contract without creating plan content.
4. Prove manifests cannot provision or activate without a separately approved launch record and exact Platform identity/grants.

**Acceptance:** four reviewable blueprints exist and remain inactive; no future actor/account is created; role text cannot grant capabilities; no fake business plan exists.

### PKT-11: Lisa integrated acceptance, deployment, and production canary

**Dependencies:** all applicable accepted OpenClaw packets and exact provider releases; `AW-01` only if the watcher is part of the approved release window, otherwise independent.

**Primary owned paths:**

- Lisa stage/VPS deployment packet, reconciliation tools, acceptance tests, and sanitized receipts
- no unrelated feature implementation

**Steps:**

1. Assemble accepted commits serially on a phase branch; resolve overlaps by owner, never prefer-incoming.
2. Run focused tests per packet, changed-path checks, build/package proof where required, and independent Terra verification at exact head/tree.
3. Stage a clean deployment and prove service, sandbox, model/tool/provider surfaces, jobs, Workspace, browser, backup/export, restore, and rollback separately.
4. Compare desired jobs with live cron. Apply no schedule change until founder approval; plan exact bounded diff and explicitly preserve deployed weekly/monthly times.
5. After deployment approval, verify 19 declarations plus Memory Dreaming, owner/executor, next jobs via real Lisa channel/session scope, cron announce/email receipts, no duplicate diagnostics, and overnight maintenance receipts.
6. Measure ordinary Telegram path and routine/normal/difficult service objectives without message bodies.
7. Run production canary, obtain Principal acceptance, retain rollback, and keep Mac Mini deletion on HOLD until separately approved.

**Acceptance:** all PRD definition-of-done evidence exists at the correct level; current deployed release/tree and exact live declarations are recorded; private data is absent from evidence; no future agent is activated; rollback is verified.

## 5. Provider-owned packets

### LP-01: Platform agent identity/grants and generic approval evidence

**Repository:** `linktrend/LiNKplatform`

**Dependencies:** none for source audit; OpenClaw contract mocks for integration.

**Steps:**

1. Resolve main/development/staging/release asymmetry and inventory current actor lifecycle, capability registry, provider-trust, AuthClaims/resourceContext/delegation, credential references, revocation, audit, and signed approvals.
2. Prove existing composition supplies actor-specific durable authorization, independent revocation, scope/action/resource/environment/expiry/delegation narrowing, fail-closed reissuance, and full audit reconstruction.
3. If proof fails, propose and obtain approval for the smallest actor-bound durable grant surface before schema work.
4. Reuse existing lifecycle vocabulary; add no business-role authority and no future-agent records.
5. Implement or extend only a privacy-bounded immutable approval-verification receipt if current signed approval foundations cannot bind exact proposal version, distinct channel class and binding, nonce/replay, expiry, supersession/revocation, and verifier result.
6. Prove Platform creates no payment, trade, deployment, Program, profile, skill, or other domain effect.

**Acceptance:** lifecycle and denial matrices pass; one actor can be revoked independently; arbitrary capabilities fail; secrets never appear; same-class/same-binding/replay/expiry/version mismatch approvals fail; migration/rollback proven if approved.

**Approval gate:** new table, schema migration/version, public provider-trust contract change, or provider release.

### AW-01: Deterministic external skill-source watcher

**Repository:** `linktrend/LiNKautowork`

**Dependencies:** accepted LP-01 claims contract and LiNKskills-owned immutable assignment/candidate contracts.

**Steps:**

1. Inventory `evidence_collection`, request/attempt/receipt/event, scheduler, identity, idempotency, and durable instance state.
2. Implement one exact-version automation package/config that consumes a Skills-owned immutable source assignment and emits a Skills-owned candidate schema.
3. Resolve exact repository/tag/commit/inventory paths; calculate per-file and collection digests, licence/provenance, retrieval time, and bounded diff deterministically.
4. Deduplicate by assignment/source/upstream identity/inventory/collection digest using existing crash-safe state where adequate.
5. Add signed/authenticated idempotent submission, bounded retry/backoff, timeout, kill switch, observability, and recovery.
6. Prove unknown sources, incomplete provenance/licence, digest/signature/auth failures, and contract gaps fail closed.
7. Prove no qualification/release/activation/vendor rewrite/OpenClaw mutation and no private Lisa data.

**Acceptance:** deterministic fixtures, duplicate/recovery tests, authority/privacy negatives, and Skills contract tests pass. A Google collection canary waits for separate authorization and accepted Skills intake.

**Approval gate:** polling cadence, new operation kind, public contract change, new state schema/migration, provider release, or live canary.

## 6. Libraries closure audit

Before OpenClaw `PKT-03` acceptance, record the exact current Libraries release/contract and OpenClaw pin comparison, fail-closed exact-version/digest behavior, and negative inventory for Lisa/private/skill-owned material. If no provider defect exists, close as `explicit no-current-requirement / no provider implementation packet`. A stale OpenClaw connector is repaired in OpenClaw, not Libraries.

## 7. Cross-packet verification matrix

| Area            | Source/consumer acceptance                          | Stage/VPS acceptance                             | Production acceptance                               |
| --------------- | --------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------- |
| Jobs            | exact desired-state tests and retired-job negatives | exact SQLite declaration diff and next-run proof | real Lisa next-jobs query and delivery receipts     |
| Providers       | exact SHA/tree/pin, schema, deny tests              | attached tools/claims and bounded E2E            | sanitized live canary only after approval           |
| Private state   | synthetic schema/state/privacy tests                | permission, encrypted export, restore drill      | no plaintext/private evidence; Principal acceptance |
| Models          | reproducible evaluation and route/fallback tests    | exact model catalogue and transient override     | body-free latency/quality canary                    |
| Browser         | hostile-input/network/approval tests                | isolated Chromium lifecycle and egress proof     | approved public/authenticated scenario only         |
| Workspace       | wrapper/account/scope contract tests                | real secret-safe service smokes                  | approved Lisa account/calendar/document canary      |
| Future profiles | inactive/clone exclusion tests                      | no stage activation required                     | no production activation                            |

## 8. Global acceptance and rollback

Each packet requires exact pushed commit/tree, scoped diff, focused tests, independent Terra verification, manifest evidence, and a checkout-bound receipt. Heavy/Full verification uses durable liveness controls. Code/test failure has no automatic retry; repair creates a new identity. Infrastructure receives at most two attempts per exact candidate, then HOLD unless a named exception is approved.

Rollback is repository-local and exact:

- revert the accepted packet/phase commit;
- restore prior exact provider/OpenClaw pin and configuration;
- restore the previous systemd/service/browser/profile artifact where applicable;
- read back protection/config/service/data integrity;
- never roll back by resurrecting stale branches, old jobs, plaintext health, Mac dependencies, or provider-side skill execution.

## 9. Execution readiness

### 9.1 OpenClaw-fork progressive validation amendment

The fork uses the digest-bound policy `openclaw-fork-progressive-validation-v1` (`sha256:445953e776fa6594bc96f047794616164ec75b213a07c0e9300630db1ec24a17`). A trusted exact baseline receipt is required before packet work, but a repository-wide Full Suite is not a prerequisite for starting packets. Each packet runs focused checks for its owned paths and declared contracts. For a governed Phase, the exact normalized protected-base-to-Phase diff is the relevant fork-customization scope. Static provenance may describe the repository inventory, but must never exclude an individual file already proven changed by that Phase identity. Untouched upstream means files outside that exact diff; Fast and Full must not enumerate, scan, test, or audit them. Each Phase runs Fast plus change-scoped integration/contract checks across that exact diff. A customization-scoped Full Suite, with rollback/recovery proof, is required for the final OpenClaw release candidate before staging or promotion. Any changed-path or cross-contract failure blocks progress; changed customization code is never waived. Central IDE provider changes retain their own provider Full requirement. This exception is fork-only and never authorizes upstream mutation.

The package is ready to be committed and pushed as a governed documentation checkpoint. It is not dispatch-ready at this checkpoint: the companion explicitly disables execution until a separate approval snapshot and all packet prerequisites are present. The remaining consequential decisions are deliberately sequenced inside evidence-producing packets: exact Lisa runtime model releases, whether Platform needs schema changes, whether Autowork needs new state/operation contracts, polling cadence, and live credentials/grants/deployments. None requires Carlos to supply ordinary design details before execution starts; each requires a specific evidence-backed approval before its corresponding mutation or activation.
