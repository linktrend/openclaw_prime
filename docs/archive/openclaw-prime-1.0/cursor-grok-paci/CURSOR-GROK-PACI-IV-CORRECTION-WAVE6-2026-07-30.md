# Cursor Grok 4.5 High — OpenClaw PACI IV Correction Wave 6

Continue draft PR #38 from exact clean, origin-synced HEAD `fb0e9a6b3d3eed47d13a951290233dd05c44db87` on `issue/ocp-openclawdevelopmentplan01`.

Use **Cursor Grok 4.5 High** throughout and spawn only Grok 4.5 High subagents. Follow root and scoped `AGENTS.md` files. Preserve the separate Lisa operations worktree unchanged and return its exact tip.

This is one bounded production-lifecycle correction. Preserve the independently verified generation-handle primitives, ID-only acquisition, immutable host binding registry, generation-scoped cleanup, second-plugin isolation, cache invalidation, 16 MiB non-bypassable MCP ceiling, OAuth/native behavior, guarded transport, Platform pin, fixtures, countersigns, and passing tests.

## Independent Codex blocker

Wave 5 failed at `fb0e9a6b3d3eed47d13a951290233dd05c44db87` because the generation primitive is committed at the wrong lifecycle boundary:

- `loadRuntimePluginCandidate` publishes each plugin's machine-token candidate immediately after that plugin registers.
- The replacement plugin registry is activated only after the complete candidate loop and final load-error gate.
- A v2 facade can therefore retire v1 while the old registry is still active. If a later plugin then fails under production `throwOnLoadError: true`, outer rollback destroys v2 but cannot restore retired v1, leaving the active old registry without a usable facade.
- Existing tests manually call `createApi` and `commitPluginGlobalSideEffects`; they do not execute the real complete loader transaction.
- The setup/channel loader also calls `createApi` but never commits or abandons the candidate on all exits, allowing leaked candidate generations.

## Required design — one loader-owned atomic publication boundary

- Treat machine-token generations as staged resources owned by the complete plugin-registry load transaction, not by an individual plugin candidate.
- `loadRuntimePluginCandidate` may build/validate a staged facade and return its generation handle, but must not publish it or retire the live predecessor.
- Collect every staged generation across the whole candidate loop.
- On any parse/import/register/validation/final-error/cancellation failure before registry activation, abandon only the staged candidates. The prior registry and every prior live generation must remain fully usable.
- Publish/swap the new generations only at the same no-fail or rollback-safe commit boundary that activates the complete replacement registry.
- Preserve prior generation handles until new registry activation and facade publication are both known successful. Then retire/invalidate only the superseded prior generations.
- Ensure a stale cleanup, late callback, or failed candidate cannot unregister the newly published generation.
- If the registry activation operation itself can fail after partial publication, refactor it into a prevalidated immutable snapshot swap or implement complete rollback restoring both the prior registry and prior generation handles. Do not leave split ownership.
- Avoid broad plugin-ID cleanup in transactional paths. Cleanup must use exact loader transaction/generation handles.

## Setup/channel and non-runtime loader paths

- Audit every `createApi` caller, including `loader-channel-runtime.ts`, setup, discovery, doctor, and test loaders.
- Control-plane/setup paths that do not need live machine-token acquisition should not create or publish a production machine-token facade.
- If a path legitimately needs a temporary facade, give it explicit scoped ownership and guarantee exact abandon/unregister in `finally` across every success, error, early return, cancellation, and exception.
- Add leak assertions proving candidate/live generation counts return to the prior baseline after all setup/channel exits.

## Required production-path tests

Use the real loader entry points (`loadOpenClawPlugins` / actual runtime candidate loop and registry activation), not a manually sequenced surrogate. Add tests for:

1. successful multi-plugin replacement: old registry remains usable until atomic commit, new registry/facades become usable together, old facades then fail;
2. later-plugin failure with `throwOnLoadError: true`: all staged candidates are removed, old registry and old facade remain usable;
3. earlier-plugin failure and cancellation;
4. activation failure injection, if activation is fallible;
5. stale/late old-generation cleanup after a newer registry commits;
6. concurrent reload attempts or explicit serialization/rejection proving one owner;
7. unaffected second plugin/domain and independent bindings;
8. stop/deactivate/unload idempotency after replacement;
9. setup/channel successful, early-return, and exception paths with zero leaked generations.

Assert registry identity, generation identity, acquire/mint usability, cache invalidation, and exact candidate/live counts at every relevant boundary.

## Platform, fixtures, and coordination

- Platform Wave 5 head `96a96f04ede8df3cec5b67e9bb1e021335e12f5b` failed independent verification. Do not repin to it or any uncertified descendant.
- Retain the currently frozen Platform head/schema/package pin.
- Do not modify governed Brain/Skills fixture bytes or semantics; do not request owner countersigns.
- Do not touch, switch, merge, or rebase the Lisa operations worktree.

## Validation

Without hosted CI/Bugbot or live services, run:

- the real full-loader transaction tests above;
- machine-token registry/facade/cache and setup/channel lifecycle tests;
- retained MCP body-ceiling ordinary/SSE/Streamable tests;
- Brain/Skills/fake/coexistence focused suites;
- strict Plugin SDK build/export and surface checks;
- applicable boundary/type/changed checks using repository-approved routing;
- `git diff --check origin/development...HEAD`, clean status, and origin synchronization.

Record exact commands, failures/fixes/reruns, focused totals, SDK counts, and proof routing. Grok evidence remains provisional.

## Hard boundaries

No Lisa mutation, live Platform contact, Phases 7–12, sibling edits, credentials, deploy/canary, paid resources, CI/Bugbot polling, PR readiness, merge, promotion, owner countersign, Codex classifications, or self-certification.

Commit cohesive changes and push the existing branch. Return the exact clean origin-synced HEAD, implementation commit, changed files, real-loader success/rollback/leak proof, test totals, SDK proof, frozen Platform pin, unchanged fixture status, Lisa worktree tip, and a provisional Phase-13 Wave 6 handoff for independent OpenClaw Codex Phase-14 re-verification. Stop there.
