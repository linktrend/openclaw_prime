# Cursor Grok 4.5 High — OpenClaw PACI IV Correction Wave 9

Continue draft PR #38 from exact clean, origin-synced HEAD `23e06bb94e4acfbb467e2174ef558fa6e869b963` on `issue/ocp-openclawdevelopmentplan01`.

Use **Cursor Grok 4.5 High** and only Grok 4.5 High subagents. Follow root/scoped `AGENTS.md`. Preserve the separate Lisa operations worktree unchanged and report its exact tip.

Preserve verified Wave 8 work: lock-before-cache lookup, canonical combined activation entry point, immutable descriptor blueprints, A→B→cached-A host reconstruction, precommit and mid-activation restoration, removals, MCP ceiling, SDK surface, Platform pin, fixtures, and passing tests.

## Independent Codex blockers

Wave 8 failed at `23e06bb94e4acfbb467e2174ef558fa6e869b963` because:

1. Cached activation reconstructs a host-global facade but reuses cached plugin instances whose Brain/Skills runtime closures captured the old `api.machineTokenFacade`. The test confirms the captured facade remains retired and then proves only a host accessor that production consumers do not call. Stop cleanup also targets the stale handle and can leak the reconstructed facade.
2. Same-active cache hits compare registry/key/fingerprint identity but do not verify actual live facade ownership. If the active facade was unregistered, the cache hit returns the registry without reconstructing credential access.
3. A throw inside actual global hook-runner initialization can leave the replacement registry installed because rollback state is marked only after initialization returns. Existing injection tests occur at a later boundary.
4. Actual setup/channel exception and cancellation coverage remains incomplete.

## Lane A — plugin instances and facades share one lifetime

- Never reactivate a cached plugin runtime instance whose closures captured a retired lifecycle facade.
- Cache only immutable discovery/manifest/module/activation blueprints that are safe to instantiate again, not activated plugin objects, services, stop hooks, or captured API facades.
- When switching back to cached A, instantiate/register fresh A plugin runtimes with a newly staged A API/facade, then atomically activate the complete registry/services/hooks/facade snapshot. Brain/Skills transports and stop hooks must reference that exact new generation.
- If a generic dynamic facade proxy is chosen instead, prove it is lifecycle-scoped, cannot cross plugin/domain/binding ownership, resolves only the active snapshot, and cleanup cannot remove a later generation. Do not rely on a host-only accessor unused by consumers.
- After commit, actual Brain/Skills plugin operations must acquire through their captured/current production path. Stop/deactivate must remove exactly that live generation.

## Lane B — validate live ownership on same-active hits

- A same-active fast path is valid only if the complete combined snapshot is healthy: registry identity, plugin runtime instances, services/hooks, expected binding set, and every expected machine-token generation are still live and owned by that snapshot.
- If any facade was externally/stale-unregistered, missing, retired, or mismatched, do not return the cache hit. Rebuild/reactivate the complete snapshot or fail safely.
- Do not recreate only a host-global facade while leaving plugin closures stale.
- Add real-loader tests: active A, unregister actual captured A facade, request same-active A, then prove rebuilt runtime A uses a fresh facade and stop removes it without leaks.

## Lane C — hook runner and complete activation rollback

- Treat candidate hook-runner/service initialization as part of staging when feasible, using the candidate registry without mutating the live global snapshot.
- Move all fallible hook/service initialization before the final non-throwing combined commit.
- If any initialization must occur after registry mutation, mark/capture rollback authority before the call and restore the exact prior registry, services, hook runner, facade generations, caches, and active snapshot on every thrown/rejected/cancelled outcome.
- Inject failure inside the real `initializeGlobalHookRunner` implementation at early/mid/late points, not only after it returns. Prove old plugin operations and old facade remain usable and all candidate resources are cleaned.
- Post-commit cancellation must leave the new authoritative snapshot intact; precommit cancellation must leave the old one intact.

## Lane D — actual setup/channel lifecycle proof

- Exercise real setup/channel functions, not helper surrogates, with success, synchronous throw, rejected promise, early return, and cancellation.
- Assert non-full modes create no production facade. If any temporary API/facade/resource is created, release it in `finally` and prove staged/live counts return to baseline.
- Include repeated setup/channel calls and overlap with a full runtime load under the activation lock/ownership rules.

## Required real consumer assertions

For fresh A, A→B, A→B→cached A, same-active healthy A, same-active A after facade loss, removal/disable/binding removal, hook-init failures, cancellation boundaries, setup/channel errors, and stop/deactivate:

- invoke actual Brain/Skills production transport/service closure paths;
- assert captured/current facade generation and binding ownership;
- assert registry/services/hooks/facades are one snapshot;
- assert old/retired facade failure and new facade success;
- assert exact cleanup with no host-global orphan;
- assert unaffected second plugin/domain.

## Platform and coordination

- Platform Wave 8 `d807ad3ca2537853d35ec6c738254b54dcc15d66` failed independent verification. Do not repin it or another uncertified descendant.
- Retain frozen Platform pin; do not modify governed fixtures or request countersigns.
- Do not touch/switch/merge/rebase Lisa operations worktree.

## Validation

Run real loader/cache/plugin-consumer/hook/setup/channel lifecycle tests, registry/facade/host tests, retained MCP ceiling, Brain/Skills/fake/coexistence, strict Plugin SDK build/export and surface checks, applicable boundary/type/changed checks, `git diff --check origin/development...HEAD`, clean status, and origin synchronization. No hosted CI/Bugbot.

Record exact commands, failures/fixes/reruns, totals, SDK counts, captured-facade proof, cleanup counts, rollback proof, and proof routing. Grok remains provisional.

## Hard boundaries

No Lisa mutation, live Platform, Phases 7–12, sibling edits, credentials, deploy/canary, paid resources, CI/Bugbot, PR readiness, merge, promotion, countersign, Codex classifications, or self-certification.

Commit and push the existing branch. Return exact clean origin-synced HEAD, implementation commit, changed files, fresh cached-instance proof, same-active repair proof, real hook-init rollback proof, setup/channel proof, totals, SDK proof, frozen pin, fixture state, Lisa tip, and provisional Phase-13 Wave 9 handoff for OpenClaw Codex verification. Stop there.
