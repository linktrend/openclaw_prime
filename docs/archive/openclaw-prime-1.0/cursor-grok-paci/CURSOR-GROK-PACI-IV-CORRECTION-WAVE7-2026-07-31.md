# Cursor Grok 4.5 High — OpenClaw PACI IV Correction Wave 7

Continue draft PR #38 from exact clean, origin-synced HEAD `aced47c38d3052ec84fbbe610b0c11a2310b1c10` on `issue/ocp-openclawdevelopmentplan01`.

Use **Cursor Grok 4.5 High** for the entire packet and only Grok 4.5 High subagents. Follow root and scoped `AGENTS.md` files. Preserve the separate Lisa operations worktree unchanged and return its exact tip.

This is a bounded loader-lifecycle Wave 7. Preserve verified Wave 6 later-plugin rollback, staged generation handles, immutable binding records, ID-only acquisition, MCP body ceiling, SDK surface, OAuth/native behavior, Platform pin, fixture bytes/countersigns, and passing tests.

## Independent Codex blockers

Wave 6 failed at exact HEAD `aced47c38d3052ec84fbbe610b0c11a2310b1c10` for three related production-lifecycle reasons:

1. A successful reload publishes only newly staged generations. It never retires the prior facade when a plugin is removed/disabled or when that plugin's machine-token binding is removed. Obsolete credential access can remain live.
2. New facade generations are published before `activatePluginRegistry`. If registry activation throws, rollback destroys the new generations after their predecessors were already retired and cannot restore the old facades.
3. Production-path coverage does not prove real concurrent/nested loading, cancellation, activation failure, setup/channel exceptions, or loader-driven disable/unload. The current “serialization” case is only a cache hit.

## Required architecture — one complete immutable runtime snapshot

- Build one complete candidate ownership snapshot for the replacement runtime: plugin registry plus the exact machine-token facade/binding generations that should be live after activation.
- The target snapshot must explicitly represent absence. Plugins removed, disabled, failed/omitted under accepted policy, or no longer granted a machine-token binding must not inherit an old live facade.
- Prevalidate and fully construct the candidate before touching the live snapshot.
- Commit the registry and machine-token ownership snapshot through one synchronous/no-fail atomic publication boundary, preferably one lifecycle-owned immutable pointer/snapshot rather than coordinated mutable global registries.
- If existing `activatePluginRegistry` can throw, move every fallible operation before commit. The final pointer/snapshot swap and predecessor retirement must be non-throwing. If that cannot be achieved, implement complete rollback that restores the exact old registry and every old facade/binding generation.
- Only after the new combined snapshot becomes authoritative may superseded, removed, disabled, or binding-removed generations be synchronously marked unusable and their caches invalidated.
- A stale reference to the old facade must fail acquisition immediately after successful commit. A failed/cancelled reload must leave the complete prior snapshot and its facade usability unchanged.
- Do not use broad plugin-ID cleanup as the source of truth. Reconcile exact old-vs-new snapshot ownership and generation handles.

## Removed, disabled, and binding-removed behavior

Add explicit production behavior for:

- plugin removed from the candidate registry;
- plugin configured disabled;
- plugin remains enabled but machine-token binding/grant is removed;
- one of several bindings is removed while others remain;
- plugin registration is skipped/soft-failed under the actual policy;
- domain/plugin changes ownership of a binding (must fail or require an explicit valid replacement; never inherit silently);
- stop/deactivate/unload of the active registry.

In every case prove obsolete facade/binding access fails, only intended caches are invalidated, unaffected plugins remain usable, and late cleanup cannot affect a newer generation.

## Real concurrency, cancellation, and setup paths

- Serialize actual full runtime reload transactions with an explicit lifecycle lock/lease or generation compare-and-swap. A cache hit is not concurrency proof.
- Test two genuinely overlapping `loadOpenClawPlugins` calls with controlled barriers. Define whether the second waits, rejects, or supersedes; prove deterministic ownership and no mixed snapshot.
- Test nested/reentrant load attempts and cancellation before candidate creation, during plugin registration, immediately before commit, and after another reload commits.
- Inject activation/precommit failure through the real loader and prove the old combined snapshot remains live with no candidate leaks.
- Exercise actual setup/channel early return, exception, cancellation, and success paths. Non-full modes must create no production facade; any temporary candidate must be released in `finally`.
- Assert exact staged/live/retired generation counts and registry identity after every scenario.

## Required production-path tests

Use real loader entry points and real registry activation, not manual calls to helper primitives:

1. full successful replacement;
2. later-plugin hard failure rollback;
3. activation/precommit injected failure rollback;
4. plugin removed;
5. plugin disabled;
6. all bindings removed;
7. one binding removed, one retained;
8. true simultaneous reloads;
9. nested/reentrant reload;
10. cancellation at controlled boundaries;
11. setup/channel success, early return, exception, and cancellation;
12. stop/deactivate/unload plus stale cleanup;
13. unaffected second plugin/domain.

At each step assert both registry visibility and actual facade acquisition/mint behavior, not only internal set membership.

## Platform, fixtures, and coordination

- Platform Wave 6 `a155cbe941710d452c93077a9b8ce11ace665231` failed independent verification. Do not repin it or any uncertified descendant.
- Retain the existing frozen Platform PACI pin.
- Do not modify governed Brain/Skills fixture bytes or semantics and do not request countersigns.
- Do not touch, switch, merge, or rebase the Lisa operations worktree.

## Validation

Without hosted CI/Bugbot or live services, run the real-loader suite above, registry/facade/cache lifecycle tests, retained MCP ceiling tests, Brain/Skills/fake/coexistence suites, strict Plugin SDK build/export and surface checks, applicable boundary/type/changed checks, `git diff --check origin/development...HEAD`, clean status, and origin synchronization.

Record exact commands, failures/fixes/reruns, focused totals, SDK counts, proof routing, snapshot invariants, and any unavailable remote-test fallback. Grok must not self-certify.

## Hard boundaries

No Lisa mutation, live Platform, Phases 7–12, sibling edits, credentials, deploy/canary, paid resources, CI/Bugbot polling, PR readiness, merge, promotion, countersign, Codex classifications, or self-certification.

Commit cohesive changes and push the existing issue branch. Return the exact clean origin-synced HEAD, implementation commit, changed files, combined-snapshot commit/rollback proof, removal/disable/binding-removal proof, true concurrency/cancellation/setup proof, test totals, SDK proof, frozen Platform pin, fixture state, Lisa worktree tip, and a provisional Phase-13 Wave 7 handoff for independent OpenClaw Codex Phase-14 re-verification. Stop there.
