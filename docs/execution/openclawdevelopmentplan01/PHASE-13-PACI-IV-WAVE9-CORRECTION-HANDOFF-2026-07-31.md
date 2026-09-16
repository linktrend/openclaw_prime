# Phase-13 provisional handoff — PACI IV correction Wave 9

**Document class:** Grok-owned Phase-13 coverage / correction handoff for OpenClaw Codex Phase-14 re-verification
**Recorded:** 2026-07-31 Asia/Taipei
**Agent:** Cursor Local Agent / Grok 4.5 High (primary integrator; **not** Codex verifier)
**Branch:** `issue/ocp-openclawdevelopmentplan01`
**PR:** [#38](https://github.com/linktrend/openclaw_prime/pull/38) (draft — do not merge / do not change readiness)
**Correction prompt:** `docs/archive/openclaw-prime-1.0/cursor-grok-paci/CURSOR-GROK-PACI-IV-CORRECTION-WAVE9-2026-07-31.md`
**Status:** Wave 9 OpenClaw-owned corrections landed. **Not** Codex-certified. **No** self-certification. **No** Codex classifications assigned here.

## Exact heads

| Field                         | Value                                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| Start HEAD (exact)            | `23e06bb94e4acfbb467e2174ef558fa6e869b963`                                                               |
| Primary implementation commit | `a8bef6519d9ae91afbcc20390dde625055b01e5b`                                                               |
| Clean pushed tip              | exact `git rev-parse origin/issue/ocp-openclawdevelopmentplan01` after this push (must match local HEAD) |

## Lisa operations worktree (preserved)

| Field                     | Value                                      |
| ------------------------- | ------------------------------------------ |
| Path                      | `.worktrees/lisa-ops01`                    |
| Branch                    | `issue/ocp-lisa-ops01`                     |
| Current tip               | `fb9fe4b68b85fd866670ce748ba1c060cab6a323` |
| Mutations by this session | **none**                                   |

## Correction outcome (OpenClaw)

| Item                                | Outcome                                                                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lane A — shared lifetime            | Activating cache hits rematerialize (fresh register/API/facade) unless already healthy same-active; no host-only reconstruct of facades onto stale plugin instances |
| Lane B — same-active live ownership | `canReuseActiveCombinedPluginRuntimeSnapshot` requires live facade + binding set health; unregister forces rematerialize                                            |
| Lane C — hook-init rollback         | `liveCommitStarted` marked before `initializeGlobalHookRunner`; early/mid/late injectors; prior registry/hooks/identity/process-globals restored                    |
| Lane D — setup/channel              | Real `loadOpenClawPlugins` setupEntry proofs: baseline counts, sync throw, activating-lock overlap                                                                  |
| Consumer path proof                 | Captured `facadeStore()` facades after rematerialize; stop/unregister clears without orphan live                                                                    |

## Platform repin state

| Field                            | Value                                                                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Failed IV HEAD (Wave 8 Platform) | `d807ad3ca2537853d35ec6c738254b54dcc15d66`                                                                                                  |
| Current frozen OpenClaw pin      | Platform HEAD `0455846487d0b8c583859060ba8b4be70e7f0b48`; schema SHA-256 `7173b9f9bca59ce8a0e3e3dc2b78b680dd07fdd2451215e3ecd97ff3dd463eed` |
| Permanent OpenClaw repin         | **BLOCKED** — awaiting Platform Codex-certified corrected descendant                                                                        |

## Fixture / countersign state

| Field                                            | Value                    |
| ------------------------------------------------ | ------------------------ |
| AuthClaims / envelope fixture JSON bytes changed | **No**                   |
| Fixture-owner countersign refresh                | **Not required**         |
| Self-countersign                                 | **Forbidden / not done** |

## Public Plugin SDK surface (focused)

| Metric                                         | Result |
| ---------------------------------------------- | ------ |
| Public entrypoints                             | 142    |
| Public exports                                 | 4733   |
| Public callable exports                        | 2885   |
| `build:plugin-sdk:strict-smoke` / export check | PASS   |
| `plugin-sdk:surface:check`                     | PASS   |

## Focused proof (trusted local)

| Area                                         | Result                              |
| -------------------------------------------- | ----------------------------------- |
| Real-loader Wave 9 suite                     | PASS — 25 tests                     |
| Host generation suite                        | PASS — 25 tests                     |
| MCP transport machine-token                  | PASS — 12 tests                     |
| `git diff --check origin/development...HEAD` | Clean                               |
| Hosted CI / Bugbot                           | **Not polled** (Principal-deferred) |

## Explicit non-claims

- Not Codex Phase-14 certification / classification
- Not merge / PR readiness / promotion
- Not live Lisa mutation / enablement
- Not live Platform contact / permanent Platform repin

## Codex re-verify tip

Exact clean origin-synced HEAD for Codex Phase-14 is whatever `git rev-parse origin/issue/ocp-openclawdevelopmentplan01` returns after this push (must match local HEAD).

## Exact next action

Stop for independent OpenClaw Codex Phase-14 re-verification of the pushed Wave 9 HEAD.
