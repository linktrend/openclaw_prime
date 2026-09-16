# Cursor Grok 4.5 High — OpenClaw PACI IV Correction Wave 3

Continue draft PR #38 from exact clean HEAD `2a1cab16be606444145b27074cd998dd63ed46e5`. Use Cursor Grok 4.5 High and spawn only Grok 4.5 High subagents, respecting every scoped `AGENTS.md`. Run coordination preflight first and preserve the separate clean Lisa operations worktree at `fb9fe4b68b85fd866670ce748ba1c060cab6a323`.

Preserve the corrected exact metadata validation, hardened auth fetch, SecretRef schemas, fake UUID/scope enforcement, public SDK privilege removal, OAuth behavior, native coexistence, default-disabled plugins, and all passing tests.

## Lane A — production host facade injection

- Wire the host-owned machine-token runtime into actual Linkbrain and Linkskills plugin entrypoints.
- The host must construct an identity/binding/domain-scoped `MachineTokenPluginFacade` from registered plugin identity and inject it through the supported runtime/API boundary.
- Plugins must not construct their own grants or privileged facade.
- Add lifecycle teardown/unregister/invalidation on plugin disable, reload, removal, Gateway shutdown, and binding replacement without cross-plugin cache clearing.
- Prove configured production Brain and Skills machine-token paths acquire independently and no longer fail with “facade is not configured.”

## Lane B — hardened MCP resource transport

- Replace or wrap raw SDK SSE/Streamable HTTP fetches so all plugin MCP traffic uses OpenClaw’s guarded HTTPS/DNS/private-link-local/redirect/deadline/body policy.
- Preserve protocol compatibility and session behavior while preventing DNS rebinding, private/link-local resolution, redirect credential replay, unbounded bodies, and stalled requests.
- Implement exactly one bounded 401/403 token reissue/reconnect, then fail closed. Never persist a static bearer.
- Add adversarial tests using DNS/private targets, redirects, oversized errors, stalls, 401, 403, and repeated authorization failure.

## Lane C — remove public test bypasses

- Remove `fetchFn`, `now`, and any other auth-network/test-only injection from the public `MachineTokenPluginFacade.acquire` contract.
- Keep test clocks/fetch injection only in host-internal modules and test helpers unavailable through public plugin SDK exports.
- Update SDK surface/boundary tests and verify a plugin cannot bypass hardened auth networking through its injected facade.

## Lane D — invalid explicit binding must fail closed

- Distinguish an absent per-server `machineToken` block from a present-but-invalid block.
- A present invalid block must stop with a safe configuration error; it must never silently fall back to a plugin-level endpoint/key binding.
- Add Brain and Skills tests for malformed SecretRef, issuer, client ID, audience/scope, partial binding, and conflicting server/plugin bindings.

## Lane E — evidence and Platform gate

- Remove all trailing whitespace and make `git diff --check origin/development...HEAD` pass.
- Platform `83501b11…` failed independent verification. Do not permanently repin to it. Retain the current frozen contract until Platform Codex certifies a corrected descendant.
- After a later certified repin, run packed-Platform interoperability and request domain-owner fixture countersigns only if fixture bytes or governed semantics changed.
- Record the Lisa worktree tip accurately and do not touch it.

Run focused trusted local tests for host injection/lifecycle, guarded MCP transport, SDK boundaries/surface, Brain/Skills config and transport, PACI fake, native coexistence, Phase-13 coverage, formatting, and whitespace. Hosted CI/Bugbot remain deferred.

No Lisa live mutation, live Platform contact, Phases 7-12, sibling edits, credentials, paid resources, PR readiness, merge, promotion, Codex classifications, or self-certification.

Finish with a clean pushed branch and provisional Phase-13 Wave-3 handoff for OpenClaw Codex Phase-14 re-verification. Return exact HEAD, implementation commit, changed files, focused test totals, SDK surface result, host-injection proof, guarded-MCP proof, Platform repin state, fixture/countersign state, Lisa worktree tip, and handoff paths. Stop there.
