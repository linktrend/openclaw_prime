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
   |                  +-------------------+
   |                                      |
   +--> OCP-03 five protected profiles ---+--> OCP-04 image/deploy/backup package
                                                  |
                     Platform recovery ----------+--> OCP-05 five actor bindings
                     Brain/Skills releases -------+--> OCP-06 five consumers
                     Existing Buzz state ---------+--> OCP-07 Buzz completion
                                                            |
                            OCP-04/05/06/07 -----------------+--> OCP-08 serial fleet canary
                                                                      |
                                                                      +--> OCP-09 role functions
                                                                      +--> OCP-10 Google Chat
                                                                                |
                                                  OCP-09/10 --------------------+--> OCP-11 recovery/reboot
                                                                                         |
                                                                                         +--> OCP-12 founder acceptance
```

OCP-01 and OCP-02 are repository-exclusive. After OCP-02, OCP-03 and OCP-04
may use the two hosted slots concurrently only if fresh diff/path inspection
confirms the literal scopes remain disjoint. All Server01 writes are exclusive
and serial. Provider preparation may proceed read-only in parallel, but shared
database, secrets, runtime, Buzz storage, and channel operations never overlap.

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
   and `linktrend/openclaw_prime` repository visibility. Query Keychain only
   with the founder's separate explicit security approval.
5. Pin accepted current Brain, Skills, Platform, Autowork, and Libraries
   commits/trees/contracts and classify source/provider/live evidence separately.
6. Create only dependency-ready issues, branches, worktrees, packet records,
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
Server01 image until OCP-04 admits a replacement.

## OCP-02 — Common coding-delegation parity

**Owner:** OpenClaw runtime. **Execution:** one exclusive Cursor implementation
packet, then a separate reviewer.

**Dependencies:** OCP-01 protected integration.

**Allowed source:** `src/agents/`, `src/plugin-sdk/`,
`linkbots/lisa/ops/model-routing-contract.ts`,
`linkbots/lisa/ops/model-routing.contract.json`, focused tests. This broad
owner surface makes the packet repository-exclusive; it receives no lane id.

**Steps:**

1. Characterize current agent/subagent/ACP tool inheritance and Lisa's existing
   development-orchestrator policy from source and live-safe fakes.
2. Implement one supported, agent-agnostic technical field or runtime seam for
   coding delegation; do not duplicate provider policy in each personality.
3. Preserve Lisa's `development-orchestrator` first-hop rule while parameterizing
   the agent identity and role. Prevent the executive's main session from
   directly writing code unless a current explicit exception exists.
4. Resolve Cursor model ids from its live advertised runtime at execution; do
   not preserve stale `grok-4.5`/Fast prose or equate the planning dispatcher
   with an agent's ACP runtime.
5. Add cross-agent positive delegation and negative direct-edit, identity,
   secret, scope, nested-worker, and fallback tests.

**Acceptance:** all five can request bounded technical work through the same
supported route; role/tool policy remains distinct; no personality-only rule is
the sole enforcement; unavailable delegation fails visibly and does not cause a
self-write.

**Rollback:** disable the new common route, restore the previous admitted image,
and retain Lisa's prior behavioral rule until a replacement is proven.

## OCP-03 — Preserve and complete five profile contracts

**Owner:** executive-profile source. **Execution:** Cursor lane `PROFILE`.

**Dependencies:** OCP-00; may run while OCP-04 runs, not while another worker
owns the same paths.

**Allowed paths:** `linkbots/blueprints/`, `linkbots/lisa/ops/lisa-profile-manifest.json`,
`linkbots/lisa/Personality files/`, and focused profile fixtures/tests.

**Steps:**

1. Snapshot hashes/metadata of every live identity, soul, agent, tools,
   workspace, config, SQLite, jobs, schedules, channel bindings, and credential
   reference without committing private contents.
2. Reconcile protected manifests with live profiles and the roles in the PRD.
3. Move common technical guidance into shared source where OCP-02 provides it;
   keep each executive's personality, mission, authority, and escalation rules
   explicit and different.
4. Replace pending/inactive source markers only when exact Platform and runtime
   receipts exist; never infer activation from a healthy container.
5. Add preservation and cross-agent contamination tests.

**Acceptance:** five role manifests and sanitized projections match the approved
roles; protected live-field hashes remain unchanged unless a reviewed profile
change is specifically accepted; cloning and overlays cannot copy private data.

**Rollback:** restore the affected runtime root from its verified backup and
revert only this packet's source commit.

## OCP-04 — Reproducible image, deployment, backup, and rollback package

**Owner:** OpenClaw deployment source. **Execution:** Cursor lane `DEPLOY`.

**Dependencies:** OCP-00; final image build waits for OCP-01 through OCP-03
protected source.

**Allowed paths:** `linkbots/parity/`, a new
`docs/runbooks/openclaw-prime-server01/` directory, and focused deployment tests.

**Steps:**

1. Reconcile protected parity compose with the deployed compose, wrapper, patch,
   image, mounts, ports, resources, and health behavior by hash and semantic diff.
2. Replace runtime-only helper overrides with source-owned, versioned behavior
   when their contracts remain required; do not embed secrets or Buzz private
   keys in the image.
3. Codify an idempotent preflight, overlay dry run, five-root online backup,
   verification, isolated restore, one-agent apply, health/readback, and rollback.
4. Build with pinned Node 24-compatible tooling and exact external plugin
   versions; prove required plugin/runtime dependencies exist in the image.
5. Generate an SBOM/secret scan, exact image digest, source SHA/tree labels, and
   admission receipt. Test restore and rollback before live use.

**Acceptance:** a clean host can reproduce one image and two compose projects;
all validation/guard tests pass; backup and isolated restore are verified; every
write has a bounded rollback; no live mutation occurs in this packet.

**Rollback:** discard the candidate image and package; the current digest and
runtime trees remain untouched.

## OCP-05 — Five distinct Platform identities and SecretRefs

**Owner:** Platform runtime/deployment owner with OpenClaw consumer owner.
**Execution:** Server01-exclusive, local operations; no Cursor implementation
worker unless a source defect is found.

**Dependencies:** OCP-04 backup/rollback ready; active Platform recovery produces
accepted production migration, issuer/JWKS, `svc_platform`, backup/restore,
registration, and revocation receipts.

**Steps:** register or verify five actors and runtime bindings; provision distinct
`private_key_jwt` client/credential/key references; produce eight distinct
Brain/Skills SecretRefs for the four non-Lisa agents plus verified Lisa refs;
materialize reference-only overlays; validate audience/scope/resource/action and
independent revocation. No shared-secret fallback is allowed.

**Acceptance:** five active identities and five independently revocable binding
sets exist; no raw credential enters source, prompt, log, or evidence; wrong
actor/audience/resource and cross-agent requests fail closed.

**Rollback:** disable newly activated bindings, revoke only their new credentials,
restore prior reference-only configs, and preserve Platform audit rows.

## OCP-06 — Five Brain and Skills consumer bindings

**Owner:** OpenClaw consumer owner; Brain/Skills own their services and contracts.
**Execution:** Server01-exclusive after provider readiness.

**Dependencies:** OCP-05 plus accepted live provider receipts. Lisa first; the
other four require provider confirmation or amendment for five-actor production
scope rather than extrapolation from Lisa-only acceptance.

**Steps:** bind each agent's separate clients and audiences; prove Brain compact
discovery, company knowledge, findings/checkpoints/handoff, and actor-private
memory boundaries; prove Skills catalogue, exact selectable release, digest,
local execution, and telemetry; preserve fail-closed stale/revoked/tampered/
unavailable behavior; keep local/private OpenClaw memory local.

**Acceptance:** positive and negative matrices pass for each agent; no private
memory crosses agents; no Brain/Skills result grants technical or Program
authority; provider health and consumer canary receipts are distinct.

**Rollback:** disable only the affected consumer binding and restore its previous
config; do not roll back provider data or another agent.

## OCP-07 — Reconcile and finish Buzz without rebuilding it

**Owner:** Buzz/OpenClaw channel owner. **Execution:** Server01/Buzz-exclusive
maintenance window.

**Dependencies:** OCP-04 backup readiness and a quiescent-window attestation that
resolves the prior active-connection uncertainty.

**Steps:** inventory existing five public bot identities, memberships, private
rooms, shared leadership room, profile records, channel policy, and message
counts without exporting content; verify `@openclaw/buzz@2026.9.2`; preserve
existing keys/history; publish approved existing-name descriptions/portraits;
test private replies, shared mentions, proactive sends, reconnect/dedupe, Mac/iOS
history, and no-loop behavior; file separate upstream Buzz issues for client-only
defects when still reproducible.

**Acceptance:** five existing identities pass the full matrix with zero duplicate
agent creation or lost history; bot-originated shared traffic causes no fanout;
external-agent UI limitations are truthfully labeled and do not imply a runtime
failure.

**Rollback:** restore Buzz database/object-store backup and per-agent channel
configs; revoke only newly introduced profile/media changes if necessary.

## OCP-08 — Serial immutable-image fleet canary

**Owner:** Server01 deployment owner. **Execution:** local, one exclusive runtime
lease, one agent at a time.

**Dependencies:** OCP-02 through OCP-07 accepted and one protected source/image
identity.

**Steps:** preflight capacity/ports/health/backup; deploy Lisa; run identity,
Sol, qualifying-fallback, provider, channel, memory, isolation, and restart
checks; observe; then repeat Eric, David, Sara, and Jane serially. Re-read image,
config, mounts, health, and protected hashes after every agent. Stop on first
failure.

**Acceptance:** all five use the same admitted digest, keep distinct writable
roots and identities, and pass their complete path without harming previously
accepted agents.

**Rollback:** restore only the current canary to its prior image/config/root;
if a shared-image defect appears, roll all five back serially after preserving
evidence.

## OCP-09 — Role-specific business functions and approved automations

**Owner:** each Program/domain owner plus OpenClaw profile owner.

**Dependencies:** OCP-08; exact accepted Autowork package/instance/binding/
invocation/receipt interfaces for any automation used.

**Steps:** refine and test representative functions: Lisa executive coordination
and founder reporting; Eric technical review/delegation; David product and
go-to-market planning; Sara operations/finance review; Jane market research,
paper strategy, and risk review. Bind only already-approved Skills and Autowork
automations. Require just-in-time founder input for missing personality copy,
portraits, or business-policy choices. Do not invent or activate Program work.

**Acceptance:** founder-approved scenarios demonstrate role quality, correct
tools, truthful limitations, and denial of out-of-role or consequential actions.

**Rollback:** remove the exact new role/tool/automation binding; retain the
technical fleet and prior profile backup.

## OCP-10 — Five-agent Google Chat activation

**Owner:** Google Workspace/Chat administrator plus OpenClaw channel owner.

**Dependencies:** OCP-08; founder's earlier defer-until-core direction is
satisfied; five app/service-account/audience/visibility packages and one reviewed
public-webhook design exist.

**Steps:** create or verify five distinct private Chat apps; store credentials as
per-agent SecretRefs; expose only the authenticated webhook path; enable one
agent at a time; test DM, space mention/thread reply, sender allowlist/pairing,
wrong audience/token, replay/rate limit, restart, and cross-agent denial.

**Acceptance:** five independently identifiable Chat apps pass; all other public
paths fail closed; dashboard and private service ports remain unexposed.

**Rollback:** disable the affected plugin/app, remove only its webhook route,
revoke its service-account key, and restore its previous config.

## OCP-11 — Fleet recovery, reboot, and production ledger

**Owner:** Server01 operations owner.

**Dependencies:** OCP-09 and OCP-10.

**Steps:** create and verify a fresh five-root backup; restore each root in
isolation; exercise one-agent rollback; reboot Server01 in an approved window;
verify startup order, all health endpoints, exact digests/config hashes, provider
and channel reconnection, queues, jobs, disk/memory headroom, and no cross-agent
state change. Record RPO/RTO and remaining cosmetic upstream defects.

**Acceptance:** cold recovery and rollback receipts pass; no secret/private body
is recorded; operational owners accept monitoring and incident/runbook coverage.

**Rollback:** use the verified pre-reboot image/config/root set and documented
offline activation; isolate any failed channel/provider rather than widening
access.

## OCP-12 — Founder live acceptance and closeout

**Owner:** founder for acceptance; coordinator for evidence reconciliation.

**Dependencies:** every prior packet accepted at current identities.

**Steps:** run one representative live conversation per agent plus shared Buzz
leadership, Telegram, Google Chat, Brain/Skills, qualifying fallback, and denial
cases; compare source/provider/consumer/live/canary/production receipts; obtain
explicit founder acceptance; complete handoff, session/dashboard updates, and
archive only truly finished records.

**Acceptance:** founder accepts the five roles and observable behavior; the final
ledger contains no false DONE and names every optional upstream cosmetic item.

**Rollback:** acceptance failure reopens only the responsible packet and keeps
the last accepted fleet available; it never authorizes a broad rebuild.

