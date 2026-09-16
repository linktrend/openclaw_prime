# Phase 7 — Decision Packet: Platform Stage Readiness Gate

**Recorded:** 2026-07-27 19:17 Asia/Taipei
**Branch:** `issue/ocp-openclawdevelopmentplan01`
**Plan:** `docs/archive/openclaw-prime-1.0/plans/OPENCLAW-PRIME-LISA-LINKBRAIN-LINKSKILLS-DETAILED-IMPLEMENTATION-PLAN.md`
**Plan SHA-256:** `17203ee586a3fb2b1281bcddd8b17ae350075ebce537689f3c4bfcbbd14914f7`
**Status:** **blocked — Platform stage inactive / unverified; no live Lisa or Platform mutation**

## Ask

Platform must prove stage is a real, recoverable environment and sign stage
readiness before any OpenClaw operator enables stage MCP, stage plugin flags,
or Lisa stage canary work (Phase 8+).

This packet does **not** authorize live Lisa wiring, plugin enablement, or
Platform contact from OpenClaw.

## Evidence that Platform is inactive / unverified (plan baseline)

| Source                   | Finding                                                                                                                                                 | Evidence tier                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Plan §2 / constraints    | Stage and production Platform projects exist but are **inactive**; schema, data, migrations, backup, restore, and service deployment are **unverified** | plan freeze                                |
| Phase 0 freeze packet    | Gate “Platform stage/prod readiness” recorded as **inactive / unverified**; authority = LiNKplatform owner                                              | `PHASE-0-FREEZE-PACKET.md` §8              |
| Phase 0 contract freeze  | Platform actor/auth/credentials: **pending** Platform auth-path approval; stage/prod inactive                                                           | `PHASE-0-FREEZE-PACKET.md` §3              |
| Phase 5 auth packet      | Claim propagation, issuer/audience/scopes, stage endpoints: **pending**; live Lisa wiring **blocked**                                                   | `PHASE-5-DECISION-PACKET-PLATFORM-AUTH.md` |
| Phases 1–6 OpenClaw work | Fake/fixture/template/integration-local only; explicitly **not** stage or production environment proof                                                  | `PHASE-*-STATUS.md`                        |
| This session             | No live Platform endpoint probe; no Lisa profile mutation; plugins remain default-disabled                                                              | operator policy                            |

**Hard rule (plan §14.4 / Phase 0):** repository fakes and local integration tests
do **not** pass the Platform migration and environment-readiness gate.

## Options

| Option                                          | Description                                                                                                                                   | When appropriate                                                    |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **A. Wait for Platform sign-off** (recommended) | Hold Phases 8–12 OpenClaw live steps until Platform owner publishes stage evidence and signs readiness; keep plugins and MCP `enabled: false` | Default; matches plan sequencing                                    |
| **B. Continue fake-only OpenClaw prep**         | Keep improving fake fixtures, runbooks, and docs; never cite as environment proof; still no Lisa/Platform mutation                            | Always allowed in parallel while waiting                            |
| **C. Principal escalate**                       | Principal directs Platform owner to prioritize stage readiness evidence, or records an approved plan deviation if sequence must change        | Only if schedule or cross-plan blockers require Principal authority |

## Recommendation

**Wait for Platform stage sign-off (Option A).** Continue Option B documentation
and fake-only readiness in parallel.

Keep:

- `plugins.entries.linkbrain.enabled` / `linkskills.enabled` default **false**
- `mcp.servers.linkbrain.enabled` / `linkskills.enabled` default **false**
- all Brain flags (`mcpRead`, `captureEnqueue`, `captureDrain`, `coordinationWrites`) **false**
- all Skills flags (`mcpDiscoveryRead`, `governedExecution`, `telemetryEnqueue`, `telemetryDrain`) **false**

Do **not** treat Phase 6 `fake/integration-local` green as stage proof.

## Exact authority requested

| Authority                                      | Owner                                                | What must be signed                                                                      |
| ---------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Stage project + service endpoints active       | LiNKplatform                                         | Named stage URLs/hosts (no secrets); health paths                                        |
| Migration ledger + schema/data state           | LiNKplatform                                         | Current migration state; recoverable                                                     |
| Brain + Skills credential lifecycle            | LiNKplatform                                         | Issue / rotate / revoke / expiry; issuer, audience, scopes; Lisa actor + runtime binding |
| Secret injection                               | LiNKplatform                                         | No process-argument exposure; env/SecretRef IDs only                                     |
| Backup + restore proof                         | LiNKplatform                                         | Sanitized success evidence                                                               |
| Audit + opaque correlation                     | LiNKplatform                                         | Proof without private payloads                                                           |
| Generic Librarian host (Brain)                 | LiNKplatform                                         | Host readiness for Brain worker                                                          |
| Health, alerting, incident owner, env rollback | LiNKplatform                                         | Named owners + rollback procedure                                                        |
| Recovery-vs-replacement decision               | LiNKplatform (+ Principal if Platform gate requires) | Recorded decision after inventory                                                        |
| OpenClaw contract/endpoint validation          | OpenClaw (after Platform evidence)                   | No-secret probes; fixture comparison — **not started** until sign-off                    |

Also unresolved from Phase 5 (must clear before live MCP auth):

- Auth consumption path: OAuth `authProfileId` vs SecretRef injection
- Domain-specific stage credential refs (names only until issued)

## OpenClaw steps that run only after sign-off

1. Receive Platform stage readiness packet (endpoints, health, credential refs, audit).
2. Validate frozen contract versions against stage (no-secret probes).
3. Compare stage behavior with frozen fixtures; record diffs.
4. Confirm independent Brain and Skills credentials and health paths.
5. Mark Phase 7 exit; hand off to Phase 8 Brain stage shadow (still gated).

Until then: **not started** for live OpenClaw validation.

## Risks

| ID    | Risk                                         | Mitigation                                                     |
| ----- | -------------------------------------------- | -------------------------------------------------------------- |
| P7-R1 | Treating fake QA as stage readiness          | Evidence tier labels; this packet blocks Phase 8+ live steps   |
| P7-R2 | Accidental Lisa/MCP enable while waiting     | Plugins/MCP stay default-disabled; runbooks label FAKE vs LIVE |
| P7-R3 | Shared credential across Brain/Skills        | Phase 5 non-negotiables; independent revoke required           |
| P7-R4 | Schedule pressure to skip Platform gate      | Option C only via Principal; no agent self-authorization       |
| P7-R5 | Stage endpoints change after OpenClaw probes | Re-validate contract versions before Phase 8 enable sequence   |

## Rollback

If any premature live contact or config change occurred (should not for this
packet):

1. Disable affected `mcp.servers.<domain>` and that domain’s plugin flags.
2. Ask Platform to disable Lisa bindings / revoke only that domain’s credential.
3. Preserve durable local outboxes and native OpenClaw.
4. Return evidence tier to fake-only; do not cite partial stage contact as readiness.

OpenClaw remains fake-tested and default-disabled until a new signed Phase 7
exit is recorded.

## Decision record

| Field                           | Value                                 |
| ------------------------------- | ------------------------------------- |
| Platform stage approver         | _(pending)_                           |
| Decision date                   | _(pending)_                           |
| Stage endpoints published       | _(pending — not contacted)_           |
| Credential lifecycle proven     | _(pending)_                           |
| Backup/restore/audit proven     | _(pending)_                           |
| Librarian host ready (Brain)    | _(pending)_                           |
| OpenClaw no-secret stage probes | **not started**                       |
| Live Lisa wiring                | **blocked**                           |
| Plugins / MCP enablement        | **blocked** (remain default-disabled) |

## Related artifacts

- Auth mechanism packet: `PHASE-5-DECISION-PACKET-PLATFORM-AUTH.md`
- MCP templates (still template-only): `mcp-templates/`
- Operator runbooks (prep; fake vs live labeled): `runbooks/`
- Downstream blocked packets: `PHASE-8-STATUS-BLOCKED.md` … `PHASE-12-STATUS-BLOCKED.md`
