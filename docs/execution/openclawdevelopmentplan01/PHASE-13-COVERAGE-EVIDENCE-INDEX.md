# Phase 13 — Coverage / Evidence Index (Grok-owned)

**Document class:** Phase-13 coverage and evidence inventory for Codex Phase-14 classification
**Recorded:** 2026-07-29 Asia/Taipei (wave 18)
**Agent:** Cursor Grok 4.5 High
**PR:** [#38](https://github.com/linktrend/openclaw_prime/pull/38) (draft — do not merge)
**Authority:** Frozen plan bytes only

> Grok owns this coverage/evidence index. **No** `IAP` / `INPL` / `PART` / `OMIT` / `DIFF` / `BLOCK` / `OUT` classifications are assigned here. OpenClaw Codex owns those evidence-driven classifications.

## Frozen authority

| Field        | Value                                                                                 |
| ------------ | ------------------------------------------------------------------------------------- |
| Plan         | `docs/archive/openclaw-prime-1.0/plans/OPENCLAW-PRIME-LISA-LINKBRAIN-LINKSKILLS-DETAILED-IMPLEMENTATION-PLAN.md`       |
| Plan SHA-256 | `17203ee586a3fb2b1281bcddd8b17ae350075ebce537689f3c4bfcbbd14914f7`                    |
| Inventory    | `docs/execution/openclawdevelopmentplan01/section-13.3/inventory.json` (`version: 4`) |
| Ledger       | `docs/execution/openclawdevelopmentplan01/section-13.3/ledger.csv`                    |
| Wave packet  | `WAVE18-CORRECTION-PACKET.md`                                                         |

**Archive provenance (2026-09-16):** Principal `docs/CURSOR-GROK-*` prompts and the frozen OpenClaw plan were moved to `docs/archive/openclaw-prime-1.0/` (cursor-grok-paci/ and plans/). This index cites those archive locations. Plan SHA-256 `17203ee5…` is the freeze-time pin; the archived plan file currently hashes `4a608af4…` (inventory `plan_sha256`). This index is coverage evidence, not production-deploy evidence.

## Counts

| Metric                              |    Value |
| ----------------------------------- | -------: |
| Requirement items                   |  **764** |
| Coverage rows                       | **1336** |
| Descriptive exclusions              |   **16** |
| Structural enum definitions (§13.3) |    **7** |
| Evidence-mapped (`implemented`)     |   **12** |

### Grok completion claims (not Codex classifications)

| Claim               | Count | Meaning                                                            |
| ------------------- | ----: | ------------------------------------------------------------------ |
| `not_claimed`       |   566 | Coverage present; no Grok implementation claim                     |
| `blocked`           |   120 | Live/stage/production or named external gate (`BLOCK:`)            |
| `outside_ownership` |    66 | Verifier/Principal/upstream ownership (`OUT:`)                     |
| `implemented`       |    12 | Phase-0 freeze/prompt/pin/session evidence with `[plan-item:<id>]` |

### Restored Section 2 source-hierarchy requirements

`source_hierarchy.1` · `source_hierarchy.2` · `source_hierarchy.3` · `source_hierarchy.4` · `source_hierarchy.5` · `source_hierarchy.6`

### Phase-0 evidence artifacts (implemented claims)

- `docs/execution/openclawdevelopmentplan01/PHASE-0-FREEZE-PACKET.md`
- `docs/archive/openclaw-prime-1.0/cursor-grok-paci/CURSOR-GROK-EXECUTION-PROMPT.md`
- `docs/execution/openclawdevelopmentplan01/contracts/brain/PIN.json`
- `docs/execution/openclawdevelopmentplan01/contracts/skills/PIN.json`
- `docs/execution/openclawdevelopmentplan01/contracts/platform/PIN.json`
- `docs/agent-sessions/completed/cursor-local-mac-mini-lisa-openclawdevelopmentplan01-20260727-1648.md`

Unexecuted `phase.0.rollback` remains `not_claimed`.

## Descriptive exclusions (reviewed)

| Reason                                                          | Count |
| --------------------------------------------------------------- | ----: |
| Section 5.1 sanitized OpenClaw capability inventory observation |     8 |
| Section 5.2 sanitized Lisa baseline observation                 |     8 |

§2 source-hierarchy rows are **requirements**, not exclusions.

## Fixture aggregates (unchanged)

| Tree                             | JSON | Aggregate SHA-256                                                  |
| -------------------------------- | ---: | ------------------------------------------------------------------ |
| `extensions/linkbrain/fixtures`  |   75 | `4493f71432ef56f9fc272ff4c208b8901242c2bd83e138f53d6f0259b4f4811b` |
| `extensions/linkskills/fixtures` |   71 | `203163711b5db17b8a07d3956e41596384cbd08f0c110bd9f21abfc5c7e5e19a` |

## Phase-1 fixture gate (reconciled)

AuthClaims **1.0** countersigns are historical/superseded. AuthClaims **1.1** Brain/Skills aggregates are **`OWNER_COUNTERSIGNED`** at tip `005c9454f1bd3f7427936704131ffe5faa95ef0f` — fixture-owner gate **CLOSED** (`FIXTURE-OWNER-SIGNOFF.md`, `PHASE-1-STATUS.md`). Domain-owner fixture approval only — **not** Codex certification. Phase 1 overall remains blocked on Platform auth-path.

## Codex next step

Assign the seven Phase-14 classifications independently against this index and the machine ledger.

## Amendment — 2026-07-30 PACI independent-verification correction

- OpenClaw tip after correction packet: `da8bb4c6174fa0082f8fc14beb49cb4305c2de1c` (prior verified start `3e449b74d8a…`).
- Platform frozen pin for local/fake baseline: HEAD `0455846487d0b8c583859060ba8b4be70e7f0b48`; schema SHA-256 `7173b9f9bca59ce8a0e3e3dc2b78b680dd07fdd2451215e3ecd97ff3dd463eed`.
- Evidence surfaces added/updated: fingerprint isolation, SSRF-guarded mint, fail-closed auth selection, SecretRef-only key custody, scoped Plugin SDK facade, Platform-parity fake PACI, external projection ban, linkbrain/linkskills consumers.
- **No Codex classifications assigned here.**
