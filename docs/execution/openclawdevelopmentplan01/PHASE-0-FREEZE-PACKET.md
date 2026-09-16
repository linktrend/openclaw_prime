# Phase 0 — Approval, Snapshot, and Ownership Freeze

**Session:** `cursor-local-mac-mini-lisa-openclawdevelopmentplan01-20260727-1648`
**Branch:** `issue/ocp-openclawdevelopmentplan01`
**Recorded:** 2026-07-27 18:44 Asia/Taipei
**OpenClaw execution agent:** Cursor Local Agent (Grok 4.5 High)
**Authority:** Principal authorization in `docs/archive/openclaw-prime-1.0/cursor-grok-paci/CURSOR-GROK-EXECUTION-PROMPT.md` for OpenClaw-owned Phases 0–13

**Archive provenance (2026-09-16):** The Principal `docs/CURSOR-GROK-*` prompts and the frozen OpenClaw plan were moved into `docs/archive/openclaw-prime-1.0/` (cursor-grok-paci/ and plans/). This packet now cites those archive locations. The freeze-time plan SHA-256 `17203ee586a3fb2b1281bcddd8b17ae350075ebce537689f3c4bfcbbd14914f7` remains the historical pin; the archived plan file currently hashes `4a608af4b7236e100a8466642a5988ec51222384d17bc3461391a0e2f8ef50ea` (inventory `plan_sha256`). This packet is not production-deploy evidence.

## 1. Approved plan reference

| Field            | Value                                                                           |
| ---------------- | ------------------------------------------------------------------------------- |
| Plan             | `docs/archive/openclaw-prime-1.0/plans/OPENCLAW-PRIME-LISA-LINKBRAIN-LINKSKILLS-DETAILED-IMPLEMENTATION-PLAN.md` |
| Plan SHA-256     | `17203ee586a3fb2b1281bcddd8b17ae350075ebce537689f3c4bfcbbd14914f7`              |
| Hash check       | HASH_OK at freeze time 2026-07-27; archive copy hash differs, see provenance |
| Execution prompt | `docs/archive/openclaw-prime-1.0/cursor-grok-paci/CURSOR-GROK-EXECUTION-PROMPT.md`                                          |
| Scope            | openclaw_prime / Lisa only; no upstream repo edits; skip Codex Phases 14–15     |

## 2. Frozen hashes (plans and repository HEADs)

| Source                           | Path / ref                                                                         | SHA-256 or commit                                                  | Status                 |
| -------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------- |
| OpenClaw plan                    | `docs/archive/openclaw-prime-1.0/plans/OPENCLAW-PRIME-LISA-LINKBRAIN-LINKSKILLS-DETAILED-IMPLEMENTATION-PLAN.md`    | freeze-time `17203ee5…`; archive file `4a608af4…` | archived / provenance rewritten |
| LiNKplatform plan                | `LiNKplatform/docs/LINKPLATFORM-SHARED-FOUNDATION-DETAILED-IMPLEMENTATION-PLAN.md` | `fbcf36235c4caaa6abf7ee93afedeedf105a96f6614a3a3ff5ccb8d78e33c6b9` | frozen / match plan §2 |
| LiNKbrain plan                   | `LiNKbrain/docs/LINKBRAIN-PHASE-1-DETAILED-IMPLEMENTATION-PLAN.md`                 | `051caa80191639c06b2dee6fa4800e736ada30772a55ad84e12e5fa6a4e63458` | frozen / match plan §2 |
| LiNKskills plan                  | `LiNKskills/docs/LINKSKILLS-INTERNAL-LAUNCH-DETAILED-DEVELOPMENT-PLAN.md`          | `31a6cc70bb778ce1dff236819e4bf600b0495dbb06c95bac55bcb2b0b2f5fe88` | frozen / match plan §2 |
| openclaw_prime HEAD              | `issue/ocp-openclawdevelopmentplan01`                                              | (branch tip; recheck at each wave)                                 | implementation base    |
| LiNKbrain HEAD (consume-only)    | `issue/13-developmentplan01`                                                       | `a3cff6e0f04ac968c32beacb7bdb1b81a4d77d3f`                         | correction wave 2b pin |
| LiNKskills HEAD (consume-only)   | `issue/21-linkskillsdevelopmentplan01`                                             | `f16103f23a716d0edeb08a1e82e38608ebd563ea`                         | correction wave 2b pin |
| LiNKplatform HEAD (consume-only) | `issue/LP-01-linkplatformdevelopmentplan01`                                        | `e845ac17dffac52a501603ad2fafd1b53fef195d`                         | correction wave 2b pin |

Planning-time OpenClaw HEAD cited in plan §2 (`ec90aa8cd119`) is historical. Implementation uses current branch HEAD above and rechecks public SDK/MCP/hooks/state at implementation time.

## 3. Contract / fixture ownership (version freeze)

| Domain                                        | Versioned contract owner    | Fixture package (OpenClaw consumer)                                                                 | Owner approval status                                        |
| --------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Brain Gateway tools / capture / coordination  | LiNKbrain                   | `extensions/linkbrain/fixtures/**` (sanitized, derived from frozen Brain + OpenClaw plans)          | **pending** Brain owner sign-off of fixture package          |
| Skills Gateway tools / telemetry / validation | LiNKskills                  | `extensions/linkskills/fixtures/**` (sanitized, derived from frozen Skills + OpenClaw plans)        | **pending** Skills owner sign-off of fixture package         |
| Platform actor / auth / credentials           | LiNKplatform                | consume Platform docs + OpenClaw auth matrix stub under `docs/execution/openclawdevelopmentplan01/` | **pending** Platform auth-path approval; stage/prod inactive |
| Fake MCP servers                              | OpenClaw (local proof only) | `test/helpers/link-domain-fakes/**`                                                                 | OpenClaw-owned; **not** live environment proof               |

**Hard rule:** fake or fixture evidence never proves stage/production readiness, real credential lifecycle, migration state, backup/restore, audit, or Librarian operation.

## 4. Ownership matrix (OpenClaw surfaces)

| Surface                                            | Owner                                          | Notes                                                           |
| -------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------- |
| `extensions/linkbrain/**`                          | OpenClaw Lisa feature agent (this session)     | Private bundled plugin; default-disabled                        |
| `extensions/linkskills/**`                         | OpenClaw Lisa feature agent (this session)     | Private bundled plugin; default-disabled; no conversation hooks |
| Managed MCP `mcp.servers.linkbrain` / `linkskills` | OpenClaw config/operator; Platform credentials | Two independent entries                                         |
| Public plugin SDK / hooks / keyed-store            | OpenClaw core maintainers (CODEOWNERS)         | Consume only; propose generic SDK change if insufficient        |
| SecretRef / auth-profiles                          | OpenClaw secops + Platform issuer              | No literals; no `service_role`                                  |
| Lisa profile / LaunchAgent                         | OpenClaw Lisa owner after gates                | No mutation until contract/identity/credential/prod gates pass  |
| Brain / Skills / Platform upstream repos           | Respective owners                              | **Do not edit**                                                 |
| Phase 14 OpenClaw Codex verification               | OpenClaw Codex verifier                        | Out of scope for Grok                                           |
| Phase 15 reconciliation                            | LiNKbrain Codex + Principal                    | Out of scope for Grok                                           |

## 5. Boundary freeze (non-negotiable)

- Two plugins, two MCP entries, two credential families, separate scopes/state/outboxes/health/flags/rollout/rollback.
- Brain-only conversation-bearing hooks when capture/coordination enabled; Skills never registers prompt/message/content-bearing hooks.
- Lisa is one canonical Platform actor; local sessions/runs/subagents are subordinate unless Platform says otherwise.
- Native OpenClaw/Lisa behavior preserved under Brain/Skills degradation.
- Brain may launch first; Skills Lisa work waits for recorded Cursor + Codex readiness and certified profiles.
- Platform projects inactive/unverified → no live Platform mutation until Platform readiness evidence exists.

## 6. Active work / overlap inventory

| Item                                                                  | Status                         | Action                                              |
| --------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------- |
| This session / branch                                                 | active                         | sole OpenClaw implementation owner for this package |
| Worktree `openclaw_prime-development-final-20260727` on `development` | active sibling                 | do not switch/share; leave alone                    |
| `stash@{0}: On main: wip-auth-unrelated`                              | preserve                       | never apply/drop                                    |
| Live Lisa profile `~/.openclaw-lisa` / LaunchAgent `ai.openclaw.lisa` | running                        | inspect sanitized only; no mutation until gates     |
| Cursor orchestrator session `…20260723-1539`                          | historical/active coordination | do not edit dashboard (Orchestrator-only)           |
| Prior digest/cron fix (PR #34 merged)                                 | complete                       | unrelated; do not reopen                            |

**Ownership collision:** none on `extensions/linkbrain/**`, `extensions/linkskills/**`, or this issue branch.

## 7. CODEOWNERS / maintainer inventory (relevant)

| Area                              | CODEOWNERS / maintainer signal                                                                                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/CODEOWNERS` itself       | `@steipete`                                                                                                                                                                  |
| Secrets / auth / gateway security | `@openclaw/openclaw-secops`                                                                                                                                                  |
| New plugins                       | add `.github/labeler.yml` `extensions: linkbrain` / `linkskills`; private bundled → keep in core dist (do **not** add to official-external catalog or root package excludes) |
| Lisa profile                      | OpenClaw Lisa owner; not a public CODEOWNERS path                                                                                                                            |
| Upstream Brain/Skills/Platform    | outside this repo                                                                                                                                                            |

## 8. Recorded external gates (blocked until owner evidence)

| Gate                                                         | Current state                | Authority to clear                                    |
| ------------------------------------------------------------ | ---------------------------- | ----------------------------------------------------- |
| Platform stage/prod readiness                                | inactive / unverified        | LiNKplatform owner                                    |
| Production credentials                                       | not issued                   | Platform + Principal                                  |
| Brain retention duration                                     | planning recommendation only | Principal                                             |
| Skills Cursor/Codex readiness + certified profiles           | not recorded for Lisa        | Skills + Cursor/Codex owners                          |
| Live Lisa profile mutation                                   | blocked                      | OpenClaw owner after gates + Principal where required |
| Domain fixture/contract sign-off                             | pending                      | Brain / Skills owners                                 |
| Auth consumption path (OAuth profile vs SecretRef injection) | pending Platform decision    | Platform + OpenClaw                                   |

## 9. Initial risk register

| ID  | Risk                                                                   | Mitigation                                                                                                       |
| --- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| R1  | Upstream versioned JSON contracts missing under Brain `docs/contracts` | Derive sanitized OpenClaw fixtures from frozen plans; mark pending owner approval; stop if owner delta conflicts |
| R2  | Public keyed-store lease/outbox semantics insufficient                 | Prototype in Phase 1; stop for generic SDK proposal if crash-safe ordered drain impossible                       |
| R3  | Accidental live Platform or Lisa mutation                              | Fake-only until gates; decision packets at hard stops                                                            |
| R4  | Cross-domain privacy leak (Skills seeing conversation)                 | Separate plugins/MCP/KV; Skills hook prohibition tests                                                           |
| R5  | Claiming fake proof as live                                            | Distinct evidence tiers in every report                                                                          |
| R6  | Concurrent worktree/stash loss                                         | Preserve stash and development worktree; one branch per task                                                     |
| R7  | Subagent model drift                                                   | All new Task subagents must use `cursor-grok-4.5-high`                                                           |

## 10. Phase 0 exit status

| Criterion                                                                | Status                                                                                                                                           |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Principal approval recorded (execution prompt)                           | **met**                                                                                                                                          |
| Plan hash verified                                                       | **met**                                                                                                                                          |
| Upstream plan hashes match §2                                            | **met**                                                                                                                                          |
| Implementation branch + session                                          | **met**                                                                                                                                          |
| Owner matrix + boundary freeze                                           | **met**                                                                                                                                          |
| Overlap inventory clean for this package                                 | **met**                                                                                                                                          |
| Every domain contract has version **and owner-approved fixture package** | **partial** — versions frozen from plans; fixture packages created in Phase 1 as OpenClaw-derived sanitized drafts pending Brain/Skills sign-off |
| No product implementation before freeze packet                           | **met** (this packet precedes plugin behavior)                                                                                                   |

**Exit decision:** Phase 0 freeze packet complete enough to start Phase 1 (fixtures/fakes only). Live gates remain blocked. Domain fixture owner approval is an open Phase 1 exit-gate item, not a license to claim live Brain/Skills conformance.

## 11. Exact next action

1. Commit Phase 0 packet + session update.
2. Phase 1: sanitized fixtures, isolated Brain/Skills fake servers, auth/compatibility matrix stub, outbox prototype findings.
3. Continue every safe fake/local path; emit decision packets at Platform/auth/retention hard gates.
