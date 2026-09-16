# Phase-13 provisional handoff — PACI IV correction Wave 8

**Document class:** Grok-owned Phase-13 coverage / correction handoff for OpenClaw Codex Phase-14 re-verification
**Recorded:** 2026-07-31 Asia/Taipei
**Agent:** Cursor Local Agent / Grok 4.5 High (primary integrator; **not** Codex verifier)
**Branch:** `issue/ocp-openclawdevelopmentplan01`
**PR:** [#38](https://github.com/linktrend/openclaw_prime/pull/38) (draft — do not merge / do not change readiness)
**Correction prompt:** `docs/archive/openclaw-prime-1.0/cursor-grok-paci/CURSOR-GROK-PACI-IV-CORRECTION-WAVE8-2026-07-31.md`
**Status:** Wave 8 OpenClaw-owned corrections landed. **Not** Codex-certified. **No** self-certification. **No** Codex classifications assigned here.

## Exact heads

| Field                                                    | Value                                                                                                    |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Start HEAD (exact)                                       | `2426067e81308992ee8b1506ed40b3d594b9ddb1`                                                               |
| Tests-first commit (premature tip before implementation) | `66f4bf2be6daf8574dc696c0fa6bd5bbe821c9a0`                                                               |
| Primary implementation commit                            | `a80d19fc871455bb134843b4aa2ae32c1bd4a642`                                                               |
| Clean pushed tip                                         | exact `git rev-parse origin/issue/ocp-openclawdevelopmentplan01` after this push (must match local HEAD) |

## Lisa operations worktree (preserved)

| Field                     | Value                                      |
| ------------------------- | ------------------------------------------ |
| Path                      | `.worktrees/lisa-ops01`                    |
| Branch                    | `issue/ocp-lisa-ops01`                     |
| Current tip               | `fb9fe4b68b85fd866670ce748ba1c060cab6a323` |
| Mutations by this session | **none**                                   |

## Correction outcome (OpenClaw)

| Item                          | Outcome                                                                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Canonical combined activation | All activating paths (fresh, cache-hit, empty scope) call `activateCombinedPluginRuntimeSnapshot`                                   |
| Lock before cache             | Activating-load lock acquired before any cache lookup that can activate/return a runtime registry                                   |
| Cache blueprint               | `CachedPluginState.machineTokenOwnership` stores immutable `HostMachineTokenBindingRecord` descriptors — never live handles         |
| A→B→cached A                  | Reconstructs fresh A generations from blueprint; B retired; zero mixed registry/facade state                                        |
| Same-active short-circuit     | Exact active combined snapshot identity returns without mutation                                                                    |
| Mid-activation failure        | Injector phase `after-registry-before-mt` restores prior registry + identity; destroys new candidates; prior live facades unchanged |
| Precommit failure             | Phase `precommit` throws before any live swap                                                                                       |
| One-of-N binding removal      | Dropped binding fails grant/acquire; retained binding remains live; unrelated plugins untouched under scoped reconcile              |
| Overlap / nested              | Nested cache-hit during fresh load → `PluginActivatingLoadConflictError`                                                            |
| Cancel-after-commit           | N/A for sync loader (no AbortSignal); precommit failure proves prior untouched                                                      |

## Platform repin state

| Field                            | Value                                                                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Failed IV HEAD (Wave 7 Platform) | `94ff0956a5d313a1c538c8e1f81cf641dc381bac`                                                                                                  |
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

| Area                                                                 | Result                              |
| -------------------------------------------------------------------- | ----------------------------------- |
| Real-loader Wave 8 suite (`loader.machine-token-generation.test.ts`) | PASS — 17 tests                     |
| Host generation suite (`machine-token-host.test.ts`)                 | PASS — 25 tests                     |
| MCP transport machine-token                                          | PASS — 12 tests                     |
| Loader runtime-registry                                              | PASS — 3 tests                      |
| paci-fake                                                            | PASS — 16 tests                     |
| `git diff --check origin/development...HEAD`                         | Clean                               |
| Hosted CI / Bugbot                                                   | **Not polled** (Principal-deferred) |

## Explicit non-claims

- Not Codex Phase-14 certification / classification
- Not merge / PR readiness / promotion
- Not live Lisa mutation / enablement
- Not live Platform contact / permanent Platform repin
- Not Phases 7–12 / sibling edits / deploy / canary

## Exact next action

Stop for independent OpenClaw Codex Phase-14 re-verification of the pushed Wave 8 HEAD.

## Codex re-verify tip

Exact clean origin-synced HEAD for Codex Phase-14 is whatever `git rev-parse origin/issue/ocp-openclawdevelopmentplan01` returns after this push (must match local HEAD). Primary implementation remains `a80d19fc871455bb134843b4aa2ae32c1bd4a642`.
