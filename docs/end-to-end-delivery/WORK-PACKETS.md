# Atomic work packets and dependency graph

Status: **PLAN — no execution authority**

Every packet starts from a freshly read protected commit/tree or an exact
accepted dependency commit/tree. `COMPLETE` means its own acceptance passed; it
does not imply provider-live, deployed, canary, or production acceptance.

## Ordered graph

```text
OCP-00 approval + fresh authority/baseline reconciliation
   |
   +--> OCP-01 consume reviewed fallback repair through governed promotion
   |        |
   |        +--> OCP-02 common coding-delegation parity
   |                  |
   |                  +--> OCP-03 five protected profiles -----+
   |                  |                                        |
   |                  +--> OCP-04 deployment-source package ---+--> OCP-05 final image admission
                                                    |
                       Platform recovery ----------+--> OCP-06 five actor bindings
                       Brain/Skills releases -------+--> OCP-07 five consumers
                       Existing Buzz state ---------+--> OCP-08 Buzz transport
                                                              |
                              OCP-05/06/07/08 -----------------+--> OCP-09 serial fleet canary
                                                                        |
                                                                        +--> OCP-10 role functions
                                                                                  |
                                                                                  +--> OCP-11 recovery/reboot
                                                                                           |
                                                                                           +--> OCP-12 founder core acceptance
                                                                                                      |
                                                                                                      +--> OCP-13 Google Chat
                                                                                                                |
                                                                                                                +--> OCP-14 full-channel closure
```

OCP-01 and OCP-02 are repository-exclusive. After OCP-02, OCP-03 and OCP-04
may use the two hosted slots concurrently only if fresh diff/path inspection
confirms the literal scopes remain disjoint. OCP-04 produces source and dry-run
proof only; OCP-05 waits for OCP-01 through OCP-04 before assembling the final
image. All Server01 writes are exclusive and serial. Provider preparation may
proceed read-only in parallel, but shared database, secrets, runtime, Buzz
storage, and channel operations never overlap.

## OCP-00 — Approval, ownership, and exact-baseline intake

**Owner:** deployment coordinator. **Execution:** local control-plane work; no
provider model.

**Dependencies:** founder `APPROVE` in this task.

**Steps:**

1. Refresh protected OpenClaw refs/trees, issue-312 candidate/review, open PRs,
   current live image/config hashes, active sessions/worktrees, Server01 locks,
   and Platform recovery status.
2. Reconcile and retire or transfer stale ownership records, including the old
   Lisa Google Workspace active record and former five-agent/Buzz queue owners;
   do not edit another owner's record without coordination.
3. Under the queue-control lock, add only this task owner and
   `linktrend/openclaw_prime` to `RESUME-SCOPE.json`; preserve `SUSPENDED`, all
   other grants, ceilings, and queue state. Read back exact JSON. Rollback removes
   only the added owner/repository pair under the same lock.
4. Recheck the established Cursor dispatcher, README, lane-verification hashes,
   account receipt freshness, exact `grok-4.6` + `effort=medium` + `fast=false`,
   and `linktrend/openclaw_prime` repository visibility. The task's single
   `APPROVE` authorizes this routine Keychain-backed readiness check; honor any
   enforced tool permission and never expose credential values.
5. Pin accepted current Brain, Skills, Platform, Autowork, and Libraries
   commits/trees/contracts and classify source/provider/live evidence separately.
6. Write and commit the refreshed redacted structural input at
   `docs/end-to-end-delivery/inputs/server01-structural-snapshot.json` before any
   cloud lane is dispatched. Include only image/config hashes, ports, runtime-root
   identifiers, plugin versions, existence/count facts, and health outcomes; no
   private content or credentials.
7. Create only dependency-ready issues, branches, worktrees, packet records,
   and leases. No speculative worker is admitted.

**Acceptance:** one redacted authority snapshot binds every exact identity,
owner, lock, route, provider dependency, and unresolved gate; no conflicting
writer or runtime owner exists.

**Rollback:** remove only newly created empty worktrees/branches/queue grant;
preserve issues and audit records.

## OCP-01 — Govern the issue-312 fallback repair

**Owner:** OpenClaw source integration. **Execution:** local governed integration;
no new implementation worker unless current candidate identity is invalid.

**Input candidate to revalidate:** commit
`566d6f2140fd86c5fb6fee7da6d58b3629442287`, tree
`65a7a1e7d11455ccc11e0bc7f7d14e0a5b6ef1c4`, branch
`issue/312-repair-codex-auth-refresh-fallback-classificatio`.

**Steps:**

1. Verify the remote branch, 17-path diff, base ancestry, recorded review-03
   PASS, Codex dependency behavior, and focused/full evidence at the exact tree.
2. Discard the inherited claim that PR #237 is the current Phase PR: live GitHub
   readback shows #237 is an unrelated historical merge and protected
   `development` remains at the planning baseline.
3. If the candidate remains exact, create a fresh deterministic Phase package;
   otherwise create a new issue identity and re-run only the invalidated proof.
4. Run governed review/receipt/controller gates through protected `development`,
   `staging`, and `main`; never direct-merge or self-review.

**Acceptance:** protected refs contain the exact reviewed behavior; tests prove
the JSON-RPC auth-refresh error survives Codex projection, selects Luna High,
reports `fallbackUsed=true`, and keeps abort/context/runtime-coordination failures
non-fallback. GitHub and local commit/tree readback agree.

**Rollback:** revert through the governed protected path; retain the previous
Server01 image until OCP-05 admits a replacement.

## OCP-02 — Common coding-delegation parity

**Owner:** OpenClaw runtime. **Execution:** one exclusive Cursor implementation
packet, then a separate reviewer.

**Dependencies:** OCP-01 protected integration.

**Chosen interface:** extend the existing per-agent
`agents.entries.<id>.subagents` contract with optional `codingDelegation`:

```ts
type CodingDelegationPolicy = {
  mode: "required";
  coordinatorAgentId: string;
  directMutationTools: string[];
};
```

For each executive, configure `coordinatorAgentId: "development-orchestrator"`
and `directMutationTools: ["apply_patch", "edit", "exec", "process", "write"]`, alongside existing
`delegationMode: "prefer"`, `allowAgents: ["development-orchestrator"]`, and
`requireAgentId: true`. This is a generic agent policy, not a provider id or a
Lisa-only personality rule.

**Owned source:** `src/config/types.agents.ts`,
`src/config/zod-schema.agent-runtime.ts`, `src/config/schema.labels.ts`,
`src/config/schema.help.core.ts`, a new
`src/agents/direct-coding-delegation-policy.ts`, `src/agents/agent-tools.ts`,
`src/agents/delegation-guidance.ts`, `src/agents/subagents/spawn/subagent-target-policy.ts`,
their focused tests, and the parity/profile contract fields that consume the
new policy. The packet is repository-exclusive and receives no lane id.

**Runtime semantics:**

- Input is the resolved requesting agent id, session identity, configured
  `codingDelegation`, and the already-authorized tool list.
- During parent tool assembly, snapshot the ordinary authorized tool names for
  child inheritance first, then wrap the configured direct mutation tools for
  the executive's own turn. A direct call throws `ToolAuthorizationError` with
  the configured coordinator id; it never performs the mutation.
- `sessions_spawn` remains the only launch API. Target policy must accept only
  the configured `development-orchestrator`; that orchestrator retains its own
  policy and may invoke its admitted ACP/Cursor route. The executive does not
  call Cursor directly.
- The direct wrapper is not copied into descendant tool policy. This preserves
  the existing ACP-required `apply_patch`, `edit`, `exec`, `process`, `read`, and
  `write` inheritance while blocking the parent from using the five mutating
  tools itself; read-only `read` remains available to the executive.
- Missing coordinator, disallowed target, unavailable ACP, model mismatch,
  spawn error, or expired authority returns a visible `forbidden`/`error`; no
  self-write, internal-subagent substitution, or provider fallback occurs.
- An exceptional direct fix is not inferred from prompt text. It requires a
  separately materialized, request-bound tool grant from the existing permission
  surface; if none exists, the direct call remains denied.

**Steps:**

1. Implement and document the `CodingDelegationPolicy` schema, resolver, direct
   wrapper, child-inheritance ordering, and exact target check above.
2. Configure the five executive manifests to use the same
   `development-orchestrator` first hop without copying provider policy into
   their personalities.
3. Preserve Lisa's current behavior while migrating its prose-only HOLD to the
   generic enforced contract.
4. Resolve Cursor model ids from its live advertised runtime at execution; do
   not preserve stale `grok-4.5`/Fast prose or equate the planning dispatcher
   with an agent's ACP runtime.
5. Add cross-agent positive delegation and negative direct-edit, wrong-target,
   missing-target, inherited-tool, identity, secret, nested-worker, and failure
   tests.

**Focused commands:**

```text
node scripts/run-vitest.mjs src/agents/direct-coding-delegation-policy.test.ts
node scripts/run-vitest.mjs src/agents/agent-tools.create-openclaw-coding-tools.test.ts
node scripts/run-vitest.mjs src/agents/tools/sessions-spawn-tool.test.ts
node scripts/run-vitest.mjs src/agents/subagents/spawn/subagent-target-policy.test.ts
node scripts/run-vitest.mjs src/config/config-misc.test.ts
pnpm plugin-sdk:surface:check
git diff --check
```

**Acceptance:** all five can request bounded technical work through the same
supported route; role/tool policy remains distinct; no personality-only rule is
the sole enforcement; unavailable delegation fails visibly and does not cause a
self-write.

**Rollback:** disable the new common route, restore the previous admitted image,
and retain Lisa's prior behavioral rule until a replacement is proven.

## OCP-03 — Preserve and complete five profile contracts

**Owner:** executive-profile source. **Execution:** Cursor lane `PROFILE`.

**Dependencies:** OCP-02; may run while OCP-04 runs, not while another worker
owns the same paths.

**Allowed paths:** `linkbots/blueprints/`, `linkbots/lisa/ops/lisa-profile-manifest.json`,
`linkbots/lisa/Personality files/`, and focused profile fixtures/tests.

**Steps:**

1. Consume the coordinator-produced, committed
   `docs/end-to-end-delivery/inputs/server01-structural-snapshot.json`; the cloud
   worker receives no Server01 access and performs no live readback.
2. Reconcile protected manifests with the sanitized structural input and roles
   in the PRD. Unknown or omitted private facts remain `HOLD`; they are not
   inferred.
3. Move common technical guidance into shared source where OCP-02 provides it;
   keep each executive's personality, mission, authority, and escalation rules
   explicit and different.
4. Replace pending/inactive source markers only when exact Platform and runtime
   receipts exist; never infer activation from a healthy container.
5. Add preservation and cross-agent contamination tests.

**Acceptance:** five role manifests and sanitized projections match the approved
roles; the coordinator compares the returned source against a fresh Server01
structural readback before integration; protected live-field hashes remain
unchanged unless a reviewed profile change is specifically accepted; cloning
and overlays cannot copy private data.

**Rollback:** restore the affected runtime root from its verified backup and
revert only this packet's source commit.

## OCP-04 — Deployment-source, backup, and acceptance package

**Owner:** OpenClaw deployment source. **Execution:** Cursor lane `DEPLOY`.

**Dependencies:** OCP-02 for repository-exclusive source completion. May run
concurrently with OCP-03 as lane `DEPLOY`.

**Allowed paths:** `linkbots/parity/`, a new
`docs/runbooks/openclaw-prime-server01/` directory, and focused deployment tests.

**Steps:**

1. Consume the coordinator-produced, committed
   `docs/end-to-end-delivery/inputs/server01-structural-snapshot.json`; the cloud
   worker receives no Server01 access. Reconcile protected parity compose with
   those sanitized deployed hashes, ports, mounts, resources, plugin versions,
   and health facts. Unknown live details remain `HOLD` for coordinator readback.
2. Replace runtime-only helper overrides with source-owned, versioned behavior
   when their contracts remain required; do not embed secrets or Buzz private
   keys in the image.
3. Deliver the plan-specific `linkbots/parity/server01-delivery.mjs`, its focused
   test, and `linkbots/parity/server01-delivery-receipt.schema.json`. Supported
   commands are `preflight`, `backup`, `restore-verify`, `apply`, `accept`,
   `rollback`, `host-recovery`, and `summarize`. Every command accepts exact
   `--snapshot`, `--expected-source`, `--expected-image`, and `--receipt-dir`
   inputs; mutating commands additionally require `--agent` or `--all-serial`.
   `accept` supports only the named suites `platform`, `brainskills`, `buzz`,
   `core`, `roles`, `founder-core`, and `googlechat`.
4. Make `preflight` and `summarize` read-only; make all other subcommands reject
   a missing exclusive lease, stale snapshot, wrong source/image, unsanitized
   receipt target, or cross-agent root. `backup` must use SQLite online backup;
   `restore-verify` uses a disposable offline target.
5. Document exact operator invocations in
   `docs/runbooks/openclaw-prime-server01/README.md`, including input/output
   receipt schemas, exit codes, stop conditions, and rollback.

**Acceptance:** source and dry-run tests prove one image/two-compose rendering,
preflight, receipt sanitization, backup/restore ordering, serial apply, acceptance,
host recovery, and rollback contracts. No image build or live mutation occurs in
this packet.

**Rollback:** revert only this source packet; the current image and runtime trees
remain untouched.

### Server01 command and receipt contract

The Server01 deployment owner runs these from the exact protected checkout with
an exclusive runtime lease. Replace bracketed values from the admitted OCP-05
receipt; do not improvise paths or omit identity arguments.

```text
node linkbots/parity/server01-delivery.mjs preflight --snapshot docs/end-to-end-delivery/inputs/server01-structural-snapshot.json --expected-source <40-char-sha> --expected-image <sha256-digest> --receipt-dir /srv/linktrend/runtime/openclaw/delivery-receipts/<run-id>
node linkbots/parity/server01-delivery.mjs backup --all-serial --snapshot docs/end-to-end-delivery/inputs/server01-structural-snapshot.json --expected-source <40-char-sha> --expected-image <sha256-digest> --receipt-dir /srv/linktrend/runtime/openclaw/delivery-receipts/<run-id>
node linkbots/parity/server01-delivery.mjs restore-verify --all-serial --snapshot docs/end-to-end-delivery/inputs/server01-structural-snapshot.json --expected-source <40-char-sha> --expected-image <sha256-digest> --receipt-dir /srv/linktrend/runtime/openclaw/delivery-receipts/<run-id>
node linkbots/parity/server01-delivery.mjs apply --agent <lisa|eric|david|sara|jane> --snapshot docs/end-to-end-delivery/inputs/server01-structural-snapshot.json --expected-source <40-char-sha> --expected-image <sha256-digest> --receipt-dir /srv/linktrend/runtime/openclaw/delivery-receipts/<run-id>
node linkbots/parity/server01-delivery.mjs accept --agent <lisa|eric|david|sara|jane> --suite <platform|brainskills|buzz|core|roles|founder-core|googlechat> --snapshot docs/end-to-end-delivery/inputs/server01-structural-snapshot.json --expected-source <40-char-sha> --expected-image <sha256-digest> --receipt-dir /srv/linktrend/runtime/openclaw/delivery-receipts/<run-id>
node linkbots/parity/server01-delivery.mjs rollback --agent <lisa|eric|david|sara|jane> --snapshot docs/end-to-end-delivery/inputs/server01-structural-snapshot.json --expected-source <40-char-sha> --expected-image <sha256-digest> --receipt-dir /srv/linktrend/runtime/openclaw/delivery-receipts/<run-id>
node linkbots/parity/server01-delivery.mjs host-recovery --all-serial --snapshot docs/end-to-end-delivery/inputs/server01-structural-snapshot.json --expected-source <40-char-sha> --expected-image <sha256-digest> --receipt-dir /srv/linktrend/runtime/openclaw/delivery-receipts/<run-id>
node linkbots/parity/server01-delivery.mjs summarize --include <core,recovery|core,recovery,googlechat> --snapshot docs/end-to-end-delivery/inputs/server01-structural-snapshot.json --expected-source <40-char-sha> --expected-image <sha256-digest> --receipt-dir /srv/linktrend/runtime/openclaw/delivery-receipts/<run-id>
```

Each successful command writes one schema-valid, body-free receipt containing
command, run id, source commit/tree, image digest, agent or ordered agent list,
snapshot digest, start/end timestamps, checks with pass/fail, and predecessor
receipt digests. Private values stay in the owning runtime; receipts contain
only SecretRef identifiers or redacted hashes. Nonzero exit means stop. A failed
`apply`, `accept`, or `host-recovery` names the exact rollback command and prior
backup/image/config receipt; the coordinator never advances by editing a receipt.

## OCP-05 — Final image assembly and admission

**Owner:** deployment coordinator and image/release owner. **Execution:**
repository-exclusive build and admission; no Cursor source writer.

**Dependencies:** OCP-01 through OCP-04 accepted and integrated at one exact
protected source identity.

**Steps:** refresh the sanitized Server01 input; build with the pinned Node
24-compatible environment and exact plugin versions; render both compose
projects; run the OCP-04 source suite; generate SBOM and secret-scan evidence;
bind source commit/tree labels and one exact image digest; run `preflight`,
`backup`, and disposable `restore-verify` without replacing a live service.

**Acceptance:** reproducible build, compose, dependency, SBOM, secret scan,
five-root verified backup, isolated restore, and image-admission receipts all
bind the same protected commit/tree and immutable digest.

**Rollback:** discard the unadmitted image and receipts, or retain the current
admitted digest; no live service has changed.

## OCP-06 — Five distinct Platform identities and SecretRefs

**Owner:** Platform runtime/deployment owner with OpenClaw consumer owner.
**Execution:** Server01-exclusive, local operations; no Cursor implementation
worker unless a source defect is found.

**Dependencies:** OCP-05 backup/rollback ready; active Platform recovery produces
accepted production migration, issuer/JWKS, `svc_platform`, backup/restore,
registration, and revocation receipts.

**Steps:** register or verify five actors and runtime bindings; provision distinct
`private_key_jwt` client/credential/key references; produce eight distinct
Brain/Skills SecretRefs for the four non-Lisa agents plus verified Lisa refs;
materialize reference-only overlays; validate audience/scope/resource/action and
independent revocation. No shared-secret fallback is allowed. After each actor
is bound, run the OCP-04 helper's exact `accept --agent <id> --suite platform`
template and retain its schema-valid receipt for OCP-09 rather than replaying it.

**Acceptance:** five active identities and five independently revocable binding
sets exist; no raw credential enters source, prompt, log, or evidence; wrong
actor/audience/resource and cross-agent requests fail closed.

**Rollback:** disable newly activated bindings, revoke only their new credentials,
restore prior reference-only configs, and preserve Platform audit rows.

## OCP-07 — Five Brain and Skills consumer bindings

**Owner:** OpenClaw consumer owner; Brain/Skills own their services and contracts.
**Execution:** Server01-exclusive after provider readiness.

**Dependencies:** OCP-06 plus accepted live provider receipts. Lisa first; the
other four require provider confirmation or amendment for five-actor production
scope rather than extrapolation from Lisa-only acceptance.

**Steps:** bind each agent's separate clients and audiences; prove Brain compact
discovery, company knowledge, findings/checkpoints/handoff, and actor-private
memory boundaries; prove Skills catalogue, exact selectable release, digest,
local execution, and telemetry; preserve fail-closed stale/revoked/tampered/
unavailable behavior; keep local/private OpenClaw memory local.
Run `accept --agent <id> --suite brainskills` from the OCP-04 command contract
after each binding and retain its body-free receipt for OCP-09.

**Acceptance:** positive and negative matrices pass for each agent; no private
memory crosses agents; no Brain/Skills result grants technical or Program
authority; provider health and consumer canary receipts are distinct.

**Rollback:** disable only the affected consumer binding and restore its previous
config; do not roll back provider data or another agent.

## OCP-08 — Reconcile and finish Buzz without rebuilding it

**Owner:** Buzz/OpenClaw channel owner. **Execution:** Server01/Buzz-exclusive
maintenance window.

**Dependencies:** OCP-05 backup readiness and a quiescent-window attestation that
resolves the prior active-connection uncertainty.

**Steps:** inventory existing five public bot identities, memberships, private
rooms, shared leadership room, profile records, channel policy, and message
counts without exporting content; verify `@openclaw/buzz@2026.9.2`; preserve
existing keys/history; test private replies, shared mentions, proactive sends,
reconnect/dedupe, Mac/iOS history, and no-loop behavior; file separate upstream
Buzz issues for client-only defects when still reproducible. Apply descriptions/
portraits only when the founder supplies the exact assets/copy; otherwise record
that optional presentation item separately without blocking this packet.
Run `accept --agent <id> --suite buzz` from the OCP-04 command contract for all
five existing identities and retain those receipts for OCP-09.

**Acceptance:** five existing identities pass the full matrix with zero duplicate
agent creation or lost history; bot-originated shared traffic causes no fanout;
external-agent UI limitations are truthfully labeled and do not imply a runtime
failure.

**Rollback:** restore Buzz database/object-store backup and per-agent channel
configs; revoke only newly introduced profile/media changes if necessary.

## OCP-09 — Serial immutable-image fleet canary

**Owner:** Server01 deployment owner. **Execution:** local, one exclusive runtime
lease, one agent at a time.

**Dependencies:** OCP-02 through OCP-08 accepted and one protected source/image
identity.

**Steps:** using the OCP-04 helper and OCP-05 receipts, run `preflight`; deploy
Lisa with `apply --agent lisa`; run `accept --agent lisa --suite core`; observe;
then repeat `apply` plus the core suite for Eric, David, Sara, and Jane serially.
The core suite covers identity, Sol, qualifying fallback, Platform, Brain,
Skills, Buzz, Telegram, memory isolation, exact image/config/mount readback, and
one restart. Stop on the first nonzero result. Reuse that accepted per-agent core
receipt in OCP-11/OCP-12; do not rerun unchanged checks.

**Acceptance:** all five use the same admitted digest, keep distinct writable
roots and identities, and pass their complete path without harming previously
accepted agents.

**Rollback:** restore only the current canary to its prior image/config/root;
if a shared-image defect appears, roll all five back serially after preserving
evidence.

## OCP-10 — Role-specific business functions and approved automations

**Owner:** each Program/domain owner plus OpenClaw profile owner.

**Dependencies:** OCP-09; exact accepted Autowork package/instance/binding/
invocation/receipt interfaces for any automation used.

**Steps:** refine and test representative functions: Lisa executive coordination
and founder reporting; Eric technical review/delegation; David product and
go-to-market planning; Sara operations/finance review; Jane market research,
paper strategy, and risk review. Bind only already-approved Skills and Autowork
automations. Missing personality refinement, portrait, or business-policy input
is recorded separately and does not block the representative role functions
already defined in the PRD. Do not invent or activate Program work.
Record each representative result with the OCP-04 helper's exact
`accept --agent <id> --suite roles` template and a body-free receipt.

**Acceptance:** founder-approved scenarios demonstrate role quality, correct
tools, truthful limitations, and denial of out-of-role or consequential actions.

**Rollback:** remove the exact new role/tool/automation binding; retain the
technical fleet and prior profile backup.

## OCP-11 — Fleet recovery, reboot, and production ledger

**Owner:** Server01 operations owner.

**Dependencies:** OCP-09 and OCP-10 role functions. Google Chat is not a
dependency.

**Steps:** run `backup --all-serial`, `restore-verify --all-serial`, and one
`rollback --agent lisa` rehearsal against the accepted image without discarding
the OCP-09 core receipts. Run `host-recovery --all-serial` in the documented
window, then `summarize --include core,recovery`. Recheck startup order, exact
digests/config hashes, queues/jobs, headroom, and channel/provider reconnection;
reuse unchanged OCP-09 identity/provider/channel checks rather than repeating
the full matrix. Record RPO/RTO and remaining optional/cosmetic items.

**Acceptance:** cold recovery and rollback receipts pass; no secret/private body
is recorded; operational owners accept monitoring and incident/runbook coverage.

**Rollback:** use the verified pre-reboot image/config/root set and documented
offline activation; isolate any failed channel/provider rather than widening
access.

## OCP-12 — Founder core-fleet acceptance

**Owner:** founder for acceptance; coordinator for evidence reconciliation.

**Dependencies:** OCP-11. Google Chat, portraits/descriptions, and further
personality refinement are not dependencies.

**Steps:** run one representative live role conversation per agent. Reuse current
OCP-09 core and OCP-11 recovery receipts for fallback, Platform, Brain/Skills,
Buzz, Telegram, isolation, restart, and recovery rather than replaying their
full matrices. Run only a targeted check when identity or relevant state drifted.
Compare source/provider/consumer/live/canary/production receipts and obtain
founder acceptance of the usable core fleet.
Record the founder's observable decision for each agent with the OCP-04
helper's exact `accept --agent <id> --suite founder-core` template; the receipt
stores only pass/fail, identity, timestamps, and predecessor digests, never the
conversation body.

**Acceptance:** founder accepts the five roles and usable core behavior; the
ledger truthfully records Google Chat and optional presentation/refinement items
as `HOLD` or `READY` without downgrading the accepted core fleet.

**Rollback:** acceptance failure reopens only the responsible packet and keeps
the last accepted fleet available; it never authorizes a broad rebuild.

## OCP-13 — Five-agent Google Chat activation

**Owner:** Google Workspace/Chat administrator plus OpenClaw channel owner.

**Dependencies:** OCP-12 core-fleet acceptance; five app/service-account/
audience/visibility packages and one reviewed public-webhook design exist.

**Steps:** create or verify five distinct private Chat apps; store credentials as
per-agent SecretRefs; expose only the authenticated webhook path; enable one
agent at a time; use `accept --agent <id> --suite googlechat` to test DM, space
mention/thread reply, sender allowlist/pairing, wrong audience/token,
replay/rate limit, restart, and cross-agent denial.

**Acceptance:** five independently identifiable Chat apps pass; all other public
paths fail closed; dashboard and private service ports remain unexposed. A
missing prerequisite leaves this packet `HOLD` while the OCP-12 core fleet stays
accepted.

**Rollback:** disable the affected plugin/app, remove only its webhook route,
revoke its service-account key, and restore its previous config.

## OCP-14 — Full-channel ledger closure

**Owner:** deployment coordinator; founder confirms only changed observable
Google Chat behavior when needed.

**Dependencies:** OCP-12 and OCP-13.

**Steps:** run `summarize --include core,recovery,googlechat`; bind the accepted
receipts to the current source/tree/image and five runtime identities; run a
targeted founder Google Chat walkthrough only if OCP-13 evidence does not already
cover the requested observable behavior; complete handoff/session/dashboard
updates and archive only truly finished records.

**Acceptance:** core and Google Chat ledgers are both accepted with no false
`DONE`; portraits/descriptions, further personality refinement, or upstream
cosmetic defects remain separately named and do not block technical closure.

**Rollback:** reopen only OCP-13 or the drifted source/runtime packet; retain the
accepted core fleet.
