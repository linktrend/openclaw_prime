# Phase-13 provisional handoff — PACI IV correction Wave 3

**Document class:** Grok-owned Phase-13 coverage / correction handoff for OpenClaw Codex Phase-14 re-verification
**Recorded:** 2026-07-30 Asia/Taipei
**Agent:** Cursor Local Agent / Grok 4.5 High (primary integrator; **not** Codex verifier)
**Branch:** `issue/ocp-openclawdevelopmentplan01`
**PR:** [#38](https://github.com/linktrend/openclaw_prime/pull/38) (draft — do not merge / do not change readiness)
**Correction prompt:** `docs/archive/openclaw-prime-1.0/cursor-grok-paci/CURSOR-GROK-PACI-IV-CORRECTION-WAVE3-2026-07-30.md`
**Status:** Wave 3 OpenClaw-owned corrections landed. **Not** Codex-certified. **No** self-certification. **No** Codex classifications assigned here.

## Exact heads

| Field                         | Value                                      |
| ----------------------------- | ------------------------------------------ |
| Start HEAD (exact)            | `2a1cab16be606444145b27074cd998dd63ed46e5` |
| Clean pushed tip              | `b3a7eb03c32daf63981be33b1a13ba85ac72f6bf` |
| Primary implementation commit | `b3a7eb03c32daf63981be33b1a13ba85ac72f6bf` |
| Wave 3 implementation tip     | `b3a7eb03c32daf63981be33b1a13ba85ac72f6bf` |

## Lisa operations worktree (preserved)

| Field                     | Value                                      |
| ------------------------- | ------------------------------------------ |
| Path                      | `.worktrees/lisa-ops01`                    |
| Branch                    | `issue/ocp-lisa-ops01`                     |
| Current tip               | `fb9fe4b68b85fd866670ce748ba1c060cab6a323` |
| Mutations by this session | **none**                                   |

## Lane outcomes (OpenClaw)

| Lane                                     | Outcome                                                                                                                                                                                                                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A — host facade injection                | `createApi` builds identity/binding-scoped `MachineTokenPluginFacade` when grants exist; injects `api.machineTokenFacade`; Brain/Skills pass it into transport; unregister on service.stop / gateway_stop / registry deactivate without global cache clear                                       |
| B — hardened MCP resource transport      | New `openclaw/plugin-sdk/mcp-http-fetch` (`buildPluginMcpHttpFetch`); SSE/Streamable use guarded fetch + eventSourceInit.fetch; no static bearer in requestInit for managed machine_token; one 401/403 session reissue then fail closed; adversarial SSRF/private/cross-origin-auth/stall proofs |
| C — remove public test bypasses          | Public `MachineTokenPluginFacade.acquire` accepts only `{ binding, signal?, forceRefresh? }`; fetchFn/now stay host-internal                                                                                                                                                                     |
| D — invalid explicit binding fail-closed | Present-but-invalid per-server `machineToken` returns `invalid` and never falls back to plugin binding; conflicting server/plugin bindings fail closed                                                                                                                                           |
| E — evidence / Platform gate             | Trailing whitespace cleaned for Wave2 handoff; frozen pin retained; Wave3 failed Platform HEAD documented; no permanent repin                                                                                                                                                                    |

## Platform repin state

| Field                       | Value                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Failed IV HEAD (Wave 2)     | `39c46680f058d86484fcb24c25c3463deb9488ae`                                                                                                  |
| Failed IV HEAD (Wave 3)     | `83501b11b78b0c5f46a5c5ef23f48de9f1317468`                                                                                                  |
| Current frozen OpenClaw pin | Platform HEAD `0455846487d0b8c583859060ba8b4be70e7f0b48`; schema SHA-256 `7173b9f9bca59ce8a0e3e3dc2b78b680dd07fdd2451215e3ecd97ff3dd463eed` |
| Permanent OpenClaw repin    | **BLOCKED** — awaiting Platform Codex-certified corrected descendant                                                                        |

## Fixture / countersign state

| Field                                            | Value                    |
| ------------------------------------------------ | ------------------------ |
| AuthClaims / envelope fixture JSON bytes changed | **No**                   |
| Fixture-owner countersign refresh                | **Not required**         |
| Self-countersign                                 | **Forbidden / not done** |

## Public Plugin SDK surface (focused)

| Metric                     | Result                    |
| -------------------------- | ------------------------- |
| Public entrypoints         | 142 (+1 `mcp-http-fetch`) |
| Public exports             | 4732                      |
| Public callable exports    | 2885                      |
| `plugin-sdk:surface:check` | PASS                      |

Privileged names (`createMachineTokenPluginFacade`, `*ForHost` clears/resolves) remain **forbidden** on the public SDK surface.

## Focused proof (trusted local)

| Area                                                                                | Result                                       |
| ----------------------------------------------------------------------------------- | -------------------------------------------- |
| machine-token host + Plugin SDK machine-token + mcp-http-fetch + registry injection | PASS                                         |
| linkbrain + linkskills transport (host inject, fail-closed bindings, MCP reissue)   | PASS                                         |
| paci-fake                                                                           | PASS                                         |
| `plugin-sdk:surface:check`                                                          | PASS                                         |
| `git diff --check` (working tree / after commit)                                    | Clean vs development once Wave2 WS fix lands |
| Hosted CI / Bugbot                                                                  | **Not polled** (Principal-deferred)          |

## Explicit non-claims

- Not Codex Phase-14 certification / classification
- Not merge / PR readiness / promotion
- Not live Lisa mutation / enablement
- Not live Platform contact / permanent Platform repin
- Not Phases 7–12

## Unresolved gates

1. Platform Codex certification of a corrected descendant → then OpenClaw permanent repin
2. OpenClaw Codex Phase-14 re-verification of this tip

## Exact next action

Independent OpenClaw Codex Phase-14 re-verification of the clean pushed tip. Do not merge. Do not enable Lisa live. Do not permanently repin Platform until certified.
