# Cursor Grok 4.5 High — OpenClaw PACI IV Correction Wave 8

Continue draft PR #38 from exact clean, origin-synced HEAD `2426067e81308992ee8b1506ed40b3d594b9ddb1` on `issue/ocp-openclawdevelopmentplan01`.

Use **Cursor Grok 4.5 High** throughout and only Grok 4.5 High subagents. Follow root/scoped `AGENTS.md`. Preserve the Lisa operations worktree unchanged and report its exact tip.

This is a bounded complete-runtime-snapshot Wave 8. Preserve verified generation primitives, removed/disabled/all-bindings removal handling on non-cache loads, later-plugin rollback, body ceiling, SDK surface, immutable binding ownership, Platform pin, fixtures, countersigns, and passing tests.

## Independent Codex blockers

Wave 7 failed at `2426067e81308992ee8b1506ed40b3d594b9ddb1` because:

1. The cached-registry branch activates a cached plugin registry outside the combined registry/facade snapshot and before acquiring the activating-load lock. Reproducer: activate A/gen1, activate B/gen2, cache-hit A; active/returned registry becomes A while live facade remains B/gen2 and A facade is retired.
2. Publication and `activatePluginRegistry` are still separate fallible steps. Current injection is precommit only and does not prove restoration if activation itself throws.
3. Real-loader coverage still lacks true overlapping/reentrant loads, cached snapshot switching, one-of-multiple-binding removal, actual setup/channel exception/cancellation, and post-commit cancellation behavior.

## One canonical activation path, including cache hits

- Acquire the same process-wide activating-load ownership before any cache lookup that can activate or return a runtime registry.
- A cache entry must represent a complete immutable activation blueprint/snapshot: registry plus exact machine-token ownership descriptors needed to construct/reconstruct the matching live generations. Never cache only one half of runtime ownership.
- If the requested cache entry is already the exact active combined snapshot, return it without mutation.
- If switching from active B to cached A, run the same staged, validated, atomic combined activation used for a new load. Reconstruct fresh A facade generations if prior A handles were retired; never reactivate A registry with B facades.
- All fresh, cached, setup-derived, and replacement paths must converge on one canonical combined-snapshot activation function. Delete/bypass alternate registry-only activation paths.

## Make final activation non-fallible or fully rollback-safe

- Perform every validation, facade construction, cache preparation, and other fallible operation before the live commit.
- Prefer one synchronous, non-throwing pointer/snapshot swap that installs registry and machine-token ownership together, followed by non-throwing retirement of the old snapshot.
- If `activatePluginRegistry` remains fallible, inject failures at every actual internal boundary and restore the exact prior registry, facade generations, caches, and active-snapshot identity. Precommit failure alone is insufficient.
- Cancellation after the atomic commit must not roll back a successfully authoritative snapshot; cancellation before commit must leave the prior snapshot untouched.
- Cache publication must occur only for a complete valid blueprint and must not expose staged live handles.

## Complete removal and concurrency semantics

- Prove one-of-multiple-binding removal: removed binding fails immediately; retained binding and unrelated plugins remain usable.
- Prove cached A→B→A switching with fresh correct generations and zero mixed state.
- Use controlled barriers to create two genuinely overlapping full loader calls, including a cache hit racing a fresh load. The second must deterministically wait, reject, or retry; it must not bypass the lock.
- Test actual nested/reentrant loader invocation rather than sequential calls sharing a cache key.
- Test cancellation before lock, while waiting, during staging, immediately before commit, and immediately after commit.
- Exercise actual setup/channel functions with thrown exception, rejected promise, cancellation, early return, and success; assert no staged/live generation leak.

## Required real-loader assertions

Use `loadOpenClawPlugins`, the real cache, real activation, and real setup/channel entry points. For every scenario assert:

- active and returned registry identity;
- active combined-snapshot identity/generation;
- exact live/staged/retired facade generations and binding IDs;
- actual acquire/mint success or failure through each binding;
- cache and credential invalidation;
- unaffected plugin/domain behavior;
- zero mixed registry/facade state at observable boundaries.

Required scenarios include fresh A, A→B, A→B→cached A, same-active cache hit, activation failure, later-plugin failure, plugin removal/disable, all-binding removal, one-binding removal, overlapping fresh loads, cache-hit/fresh race, nested load, cancellation boundaries, setup/channel exceptions, stop/deactivate, and stale cleanup.

## Platform and coordination

- Platform Wave 7 `94ff0956a5d313a1c538c8e1f81cf641dc381bac` failed independent verification. Do not repin it or another uncertified descendant.
- Retain the frozen Platform pin. Do not change governed fixtures or request countersigns.
- Do not touch/switch/merge/rebase the Lisa operations worktree.

## Validation

Run the real-loader/cache/activation suite above, generation/host/registry tests, retained MCP ceiling suites, Brain/Skills/fake/coexistence, strict Plugin SDK build/export and surface checks, applicable boundary/type/changed checks, `git diff --check origin/development...HEAD`, clean status, and origin synchronization. Follow repository proof-routing rules; no hosted CI/Bugbot.

Record exact commands, failures/fixes/reruns, test totals, SDK counts, concurrency timing/barriers, cache-switch proof, activation failure proof, and proof routing. Grok remains provisional.

## Hard boundaries

No Lisa mutation, live Platform, Phases 7–12, sibling edits, credentials, deploy/canary, paid resources, CI/Bugbot polling, PR readiness, merge, promotion, countersign, Codex classifications, or self-certification.

Commit cohesive changes and push the existing branch. Return exact clean origin-synced HEAD, implementation commit, changed files, canonical cache/fresh activation proof, actual activation rollback/non-fallibility proof, binding-removal/concurrency/cancellation/setup proof, totals, SDK proof, frozen pin, fixture state, Lisa tip, and provisional Phase-13 Wave 8 handoff for OpenClaw Codex Phase-14 re-verification. Stop there.
