# Cursor Grok 4.5 High — OpenClaw PACI IV Correction Wave 5

Continue draft PR #38 from exact clean pushed HEAD `ab76abe0bbf8c9f01b17c29e5c8c7786c937fe70` on `issue/ocp-openclawdevelopmentplan01`.

Use **Cursor Grok 4.5 High** for the complete packet and only Grok 4.5 High subagents. Follow the root and every scoped `AGENTS.md`. Register one primary integration session, then parallelize the two non-overlapping lanes below. Preserve the separate Lisa operations worktree unchanged and report its exact current tip in the final handoff.

This is a bounded Wave 5 correction. Preserve the independently verified ID-only acquisition API, immutable host-resolved binding records, SecretRef handling, substitution denials, OAuth/native behavior, guarded SSRF/redirect/deadline/reissue behavior, Brain/Skills 16 MiB response cap, fake PACI, fixtures, countersigns, and passing tests. Correct only the remaining registry-generation and SDK response-ceiling defects.

## Independent Codex findings that must be corrected

Wave 4 failed independent verification at `ab76abe0bbf8c9f01b17c29e5c8c7786c937fe70` for these reasons:

1. Machine-token facade generation replacement is not atomic. Candidate generations are added to a process-global set keyed only by plugin ID. Failed plugin registration calls plugin-wide cleanup and can unregister the still-live prior facade. Successful replacement can leave both old and new generations usable. The existing reload test manually unregisters the old facade first and therefore does not exercise production replacement or rollback.
2. Public `buildPluginMcpHttpFetch` accepts any positive `maxResponseBytes`; a plugin can set an arbitrarily large value and bypass the nominal 16 MiB host policy. Brain and Skills use the safe default, but the generic Plugin SDK surface is not safely bounded.

## Parallel lanes

- **Lane A:** atomic generation ownership/replacement in machine-token facade registry, loader integration, and production-path reload/race tests.
- **Lane B:** non-bypassable MCP response ceiling in the public SDK plus adversarial tests and documentation/types.

Subagents must declare non-overlapping files before editing. One primary Grok 4.5 High agent integrates, validates, records exact evidence, commits, pushes, and closes the session.

## Lane A — atomic facade-generation replacement

- Introduce an explicit generation/ownership handle for every candidate machine-token facade registration. Cleanup must target that exact candidate generation, never every facade sharing a plugin ID.
- Integrate replacement with the real plugin registration/reload lifecycle as a two-phase operation:
  1. build and validate the candidate registry/facade without changing the live generation;
  2. perform plugin registration against the candidate;
  3. on success, atomically publish the candidate and retire/invalidate the prior generation;
  4. on failure/cancellation, destroy only the candidate and leave the prior live generation fully usable.
- At no externally observable point may both generations successfully mint/acquire for the same plugin-owned binding, and at no point may a failed replacement remove the old live generation.
- Make stop/deactivate/unload idempotent and generation-scoped. A late cleanup from an old generation must not remove a newer replacement.
- Preserve binding-level cache invalidation, plugin/domain ownership, immutable normalized registry records, SecretRef resolution, and cross-plugin denial.
- Avoid adding another broad mutable process-global registry. Follow the plugin boundary rule that mutable global state is compatibility scaffolding; prefer lifecycle-owned immutable snapshots/handles.
- Replace the manual-unregister reload proof with production-path loader/registration tests covering:
  - successful replacement;
  - registration failure and rollback;
  - cancellation during replacement;
  - concurrent/stale cleanup after a newer generation commits;
  - plugin stop/deactivate;
  - unaffected second plugin/domain;
  - old binding/cache invalid after successful swap;
  - old binding/facade still valid after failed swap.

## Lane B — non-bypassable public MCP body ceiling

- Make the 16 MiB host ceiling an enforced maximum for every public Plugin SDK `buildPluginMcpHttpFetch` path, not merely a default.
- A caller-provided `maxResponseBytes` may only reduce the effective bound. Reject or clamp values above the host maximum in one canonical place; document and test the exact behavior.
- Validate finite safe integers and reject zero, negative, fractional, `NaN`, infinity, overflow, and unsafe values according to the public contract.
- Apply the effective bound consistently to Content-Length early rejection, ordinary bodies, SSE, and Streamable HTTP cumulative reads. Preserve abort/cancel/reader cleanup and redacted errors.
- Do not add a plugin-controlled bypass, private oversized variant, environment override, or Brain/Skills special case.
- Add public-SDK tests proving an enormous requested limit cannot exceed 16 MiB, a smaller limit is honored, and cumulative chunk overflow aborts before the oversized chunk is delivered or enqueued.

## Platform pin, fixtures, and coordination

- Platform Wave 4 head `fbdede7c25a933b4e500c796032995aaabc20660` failed independent verification. Do **not** repin to it or any other uncertified Platform descendant.
- Retain the current frozen Platform PACI pin until LiNKplatform Codex certifies an exact descendant and the Principal supplies the coordinated repin packet.
- Do not change Brain/Skills governed fixture bytes or semantics. Owner countersign refresh is unnecessary unless those bytes or semantics actually change.
- Do not touch, merge, rebase, or switch the Lisa operations branch/worktree.

## Required validation

Run trusted local focused checks and the repository-approved remote/fallback route in accordance with `AGENTS.md`; do not poll hosted CI or Bugbot:

- production loader/registration/reload facade tests, not a manually sequenced surrogate;
- machine-token host/registry/facade and cache-invalidation tests;
- public MCP HTTP fetch ordinary/SSE/Streamable limit tests;
- Brain/Skills/fake/coexistence focused suites;
- strict Plugin SDK build/export and surface checks;
- applicable boundary/type/changed checks;
- `git diff --check origin/development...HEAD` and final clean/synced status.

Record all commands, failures, fixes, reruns, exact test totals, SDK entrypoint/export/callable counts, source-trust and proof routing, and any unavailable Testbox/Crabbox fallback. Do not claim Codex verification from Grok evidence.

## Hard boundaries

No Lisa mutation, live Platform contact, Phases 7–12, sibling-repository edits, credentials, deployment, paid resources, CI/Bugbot polling, PR readiness, merge, promotion, owner countersign request, Codex classifications, or self-certification.

Commit cohesive changes and push the existing issue branch. Return the exact clean pushed HEAD, implementation commit, changed files, atomic replacement proof, public ceiling proof, focused totals, SDK proof, retained Platform pin, unchanged fixture status, Lisa worktree tip, and a provisional Phase-13 Wave 5 handoff for independent OpenClaw Codex Phase-14 re-verification. Stop there.
