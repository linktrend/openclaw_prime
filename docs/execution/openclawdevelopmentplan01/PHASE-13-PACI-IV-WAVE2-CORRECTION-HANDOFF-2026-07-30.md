# Phase-13 provisional handoff — PACI IV correction Wave 2

| Field             | Value                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Document class    | Grok-owned Phase-13 coverage / correction handoff for OpenClaw Codex Phase-14 re-verification                                             |
| Recorded          | 2026-07-30 Asia/Taipei                                                                                                                    |
| Agent             | Cursor Local Agent / Grok 4.5 High (primary integrator; **not** Codex verifier)                                                           |
| Branch            | `issue/ocp-openclawdevelopmentplan01`                                                                                                     |
| PR                | [#38](https://github.com/linktrend/openclaw_prime/pull/38) (draft — do not merge / do not change readiness)                               |
| Correction prompt | `docs/archive/openclaw-prime-1.0/cursor-grok-paci/CURSOR-GROK-PACI-IV-CORRECTION-WAVE2-2026-07-30.md`                                                                                 |
| Status            | Wave 2 OpenClaw-owned corrections landed. **Not** Codex-certified. **No** self-certification. **No** Codex classifications assigned here. |

## Exact heads

| Field                         | Value                                      |
| ----------------------------- | ------------------------------------------ |
| Start HEAD (exact)            | `4126b7f590b4104a479d17795082e140c4f26ce1` |
| Clean pushed tip              | `ce2df824bf09e6b362d3597fd097ae39c03e12bd` |
| Primary implementation commit | `ce2df824bf09e6b362d3597fd097ae39c03e12bd` |

## Lisa operations worktree (preserved)

| Field                     | Value                                      |
| ------------------------- | ------------------------------------------ |
| Path                      | `.worktrees/lisa-ops01`                    |
| Branch                    | `issue/ocp-lisa-ops01`                     |
| Current tip               | `fb9fe4b68b85fd866670ce748ba1c060cab6a323` |
| Mutations by this session | **none**                                   |

## Lane outcomes (OpenClaw)

| Lane             | Outcome                                                                                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — metadata     | Exact Phase-1 AS metadata validation (issuer equality, omit authorization_endpoint, required JWKS/token/introspect, exact arrays, empty response_types, adversarial suite)       |
| B — network      | Auth mint/discovery hardened path separated from MCP resource fetch; zero redirects; bounded error bodies; one 401/403 reissue                                                   |
| C — Plugin SDK   | Privileged facade/construction/global clear moved to `src/agents/machine-token-host.ts`; public SDK slimmed; surface/boundary gates green                                        |
| D — Brain/Skills | SecretRef-only clientAssertionKeyRef; HTTPS outside local-test loopback; guarded transport + one 401/403 reissue; host-injected facade preferred (fail-closed without injection) |
| E — fake PACI    | UUID jti, single-use assertions, least-privilege scopes, introspect ACL counterprobes; frozen pin retained                                                                       |

## Platform repin state

| Field                                                   | Value                                                                                                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Failed IV HEAD (do not certify)                         | `39c46680f058d86484fcb24c25c3463deb9488ae`                                                                                                  |
| Current frozen OpenClaw pin                             | Platform HEAD `0455846487d0b8c583859060ba8b4be70e7f0b48`; schema SHA-256 `7173b9f9bca59ce8a0e3e3dc2b78b680dd07fdd2451215e3ecd97ff3dd463eed` |
| Platform Wave 2 local tip (observed, **not** certified) | LiNKplatform continues past failed HEAD; handoff states **Not Codex-certified**                                                             |
| Permanent OpenClaw repin                                | **BLOCKED** — awaiting Platform Codex-certified corrected descendant (package/tarball/schema/fixtures)                                      |

## Fixture / countersign state

| Field                                                                  | Value                                                                       |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| AuthClaims / envelope fixture JSON bytes changed by this OpenClaw wave | **No**                                                                      |
| Fixture-owner countersign refresh                                      | **Not required** (no fixture/governed-contract semantic change in OpenClaw) |
| Self-countersign                                                       | **Forbidden / not done**                                                    |

## Public Plugin SDK surface (focused)

| Metric                          | Result            |
| ------------------------------- | ----------------- |
| Public entrypoints              | 141               |
| Public exports                  | 4729              |
| Public callable exports         | 2882              |
| `plugin-sdk:surface:check`      | PASS              |
| `build:plugin-sdk:strict-smoke` | PASS (integrator) |

Privileged names (`createMachineTokenPluginFacade`, `*ForHost` clears/resolves) are **forbidden** on the public SDK surface and live only on `src/agents/machine-token-host.ts`.

## Focused proof (trusted local)

| Area                                                                                      | Result                                                                                     |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| machine-token discovery/network/fetch/host/core + MCP machine-token + Plugin SDK boundary | **68** PASS (17+6+45 across 3 vitest shards)                                               |
| paci-fake + linkbrain/linkskills transport/manifest                                       | **64** PASS (16+48 across 2 vitest shards)                                                 |
| Combined focused                                                                          | **132** PASS                                                                               |
| Lane B residual fixed before tip                                                          | discovery non-2xx uses `discardMachineTokenErrorResponseBody` (no unbounded `arrayBuffer`) |
| `plugin-sdk:surface:check`                                                                | PASS (141 entrypoints / 4729 exports / 2882 callable)                                      |
| `git diff --check`                                                                        | Clean                                                                                      |
| Hosted CI / Bugbot                                                                        | **Not polled** (Principal-deferred)                                                        |

## Explicit non-claims

- Not Codex Phase-14 certification / classification
- Not merge / PR readiness / promotion
- Not live Lisa mutation / enablement
- Not live Platform contact / stage-prod enablement
- Not Phases 7–12
- Not permanent Platform repin

## Unresolved gates

1. Platform Codex certification of a corrected descendant → then OpenClaw permanent repin (exact head/package/tarball/schema/fixtures)
2. Host runtime injection of `MachineTokenPluginFacade` into Brain/Skills production plugin API (plugins fail closed without injected facade)
3. OpenClaw Codex Phase-14 re-verification of this tip

## Exact next action

Independent OpenClaw Codex Phase-14 re-verification of the clean pushed tip. Do not merge. Do not enable Lisa live. Do not permanently repin Platform until certified.
