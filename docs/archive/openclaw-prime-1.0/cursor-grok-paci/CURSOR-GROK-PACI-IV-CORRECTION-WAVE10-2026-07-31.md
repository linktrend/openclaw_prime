# Cursor Grok 4.5 High — OpenClaw PACI IV Correction Wave 10

Continue draft PR #38 from exact clean, origin-synced HEAD `e25af324d7edf4599715e87fb140fd5b2feee30f` on `issue/ocp-openclawdevelopmentplan01`.

Use **Cursor Grok 4.5 High** and only Grok 4.5 High subagents. Follow root/scoped `AGENTS.md`. Preserve the Lisa operations worktree unchanged and return its exact tip.

This is a bounded cold-start rollback and final lifecycle-proof packet. Preserve verified Wave 9 cache rematerialization, same-active health recovery, prior-registry early/mid/late hook rollback, combined activation, lock-before-cache, facade ownership, body ceiling, SDK surface, Platform pin, fixtures, and passing tests.

## Independent Codex blocker

Wave 9 failed at `e25af324d7edf4599715e87fb140fd5b2feee30f` because a cold-start hook initialization failure leaves a half-installed runtime:

- With no prior registry, injected early `initializeGlobalHookRunner` failure makes `loadOpenClawPlugins` throw.
- The candidate registry nevertheless remains globally active with LiNKbrain marked loaded.
- Hook registry, combined identity, and live machine-token facade are absent.
- Cold-start rollback clears only combined identity and does not restore a genuine empty/no-active registry/surface state.

Remaining proof gaps: actual Brain/Skills service start/stop after cached rematerialization and asynchronous setup cancellation.

## Lane A — explicit empty runtime snapshot

- Define a canonical empty/no-active runtime snapshot covering every globally tracked surface: plugin registry, combined identity, machine-token ownership, hook runner/registry, services, tools/providers/channels/commands, caches, lifecycle handles, and any loader-published surface.
- Capture the complete prior snapshot before the first live mutation. On cold start, the prior snapshot is the canonical empty snapshot—not `undefined` plus ad hoc cleanup.
- Make activation rollback restore that exact snapshot for early, mid, and late failures, synchronous throws, rejected promises, and cancellation.
- After a failed cold start, every public/global accessor must report no active registry/surfaces/facades/hooks/services and no candidate/staged resources. A subsequent clean load must behave exactly like the first load.
- Prefer staging all fallible hook/service initialization before the final non-throwing snapshot swap. If unavoidable, one rollback owner must cover every mutated surface.

## Lane B — exhaustive cold-start failure matrix

Using real `loadOpenClawPlugins` paths with no prior registry, inject failures/cancellation:

1. before candidate construction;
2. during plugin import/register;
3. after candidate registry construction;
4. immediately before live commit;
5. inside hook-runner initialization at early/mid/late points;
6. during service start if fallible;
7. after registry mutation but before facade/hook publication;
8. immediately after final commit cancellation boundary.

For every precommit/failing case assert exact empty snapshot, zero live/staged generations, zero hooks/services, no tools/channels/providers/commands, cleared caches where owned, and successful clean retry. For postcommit cancellation assert the new complete snapshot remains authoritative rather than being partially rolled back.

## Lane C — real consumer lifecycle after rematerialization

- Execute actual LiNKbrain and LiNKskills service/transport start, authenticated acquisition path, stop, and deactivate after A→B→cached-A rematerialization and same-active repair.
- Prove their runtime closures reference the freshly registered facade generation; actual stop removes it exactly once; host-global ownership has no orphan; unaffected domain remains live.
- Include plugin removed/disabled/binding removal after rematerialization and stale/late stop-hook calls.

## Lane D — asynchronous setup/channel cancellation

- Exercise actual setup/channel loaders with an asynchronously blocked operation and real cancellation/abort, plus rejection and success.
- Prove non-full modes create no production machine-token facade and leave no staged/live generation, hook, service, registry, or cache leak.
- Race setup/channel cancellation with a full runtime load and prove activation ownership/lock behavior is deterministic.

## Validation

Run cold-start failure matrix, real rematerialized Brain/Skills lifecycle, async setup/channel cancellation, full loader/registry/facade/host tests, retained MCP ceiling, fake/coexistence, strict Plugin SDK build/export and surface checks, applicable boundaries/types/changed checks, `git diff --check origin/development...HEAD`, clean status, and origin sync. No hosted CI/Bugbot.

Record exact commands, failures/fixes/reruns, counts, all empty-snapshot surfaces, successful retry proof, service closure generations, cleanup counts, SDK metrics, and proof routing.

## Platform and hard boundaries

- Platform Wave 9 `0520612d40451915054f25bd640414a49aa72881` failed independent verification. Retain the frozen Platform pin; do not repin.
- Do not modify governed fixtures/countersigns or the Lisa operations worktree.
- No Lisa mutation, live Platform, Phases 7–12, sibling edits, credentials, deploy/canary, paid resources, CI/Bugbot, PR readiness, merge, promotion, countersign, Codex classifications, or self-certification.

Commit and push the existing branch. Return exact clean origin-synced HEAD, implementation commit, changed files, canonical-empty rollback proof, cold-start failure matrix, real Brain/Skills rematerialized lifecycle proof, async setup cancellation proof, totals, SDK proof, frozen pin, fixture state, Lisa tip, and provisional Phase-13 Wave 10 handoff for OpenClaw Codex verification. Stop there.
