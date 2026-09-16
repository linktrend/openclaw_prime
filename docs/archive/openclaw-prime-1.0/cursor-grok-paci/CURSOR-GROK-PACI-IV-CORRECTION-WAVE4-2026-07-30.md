# Cursor Grok 4.5 High — OpenClaw PACI IV Correction Wave 4

Continue draft PR #38 from exact clean HEAD `a1cf51358ba4ec255053dd04e1fd78105ee16992`. Use Cursor Grok 4.5 High and only Grok 4.5 High subagents, following all scoped `AGENTS.md` files. Preserve the separate Lisa operations worktree at `fb9fe4b68b85fd866670ce748ba1c060cab6a323`.

Preserve the verified host injection/lifecycle, guarded transport, public test-bypass removal, invalid-binding fail-close, strict metadata, SecretRef configuration, OAuth/native behavior, fake PACI, and passing tests. Correct only the two remaining blockers.

## Lane A — immutable host-owned binding scope

- A plugin must not provide credential material merely accompanied by an allowed `bindingId`.
- The host must own an immutable normalized registry mapping each granted binding ID to its issuer, token endpoint/discovery authority, client ID, audience, scopes/services, key SecretRef/fingerprint, environment, and plugin/domain ownership.
- Prefer a public facade acquire shape that accepts only the granted binding ID plus cancellation/refresh controls; the host resolves all credential material internally. If compatibility requires a binding object, compare every normalized field/fingerprint to the registered record and reject any difference.
- Prevent cross-plugin/domain reuse, issuer/client/audience/scope substitution, key swapping, and binding replacement races.
- Registration/reload/removal must atomically update the registry and invalidate only the affected binding cache.
- Add adversarial tests reusing an allowed ID with different issuer, client, audience, scope, endpoint, key reference/fingerprint, plugin ID, and domain.

## Lane B — bounded MCP response bodies

- Add a cumulative response-byte limit to guarded MCP HTTP/SSE/Streamable HTTP reads, with safe abort/cleanup when exceeded.
- Apply the limit to Brain and Skills production transports. Bound ordinary response bodies and streaming frames/events without permitting an unlimited single response to exhaust memory.
- Keep existing SSRF, redirect, deadline, cross-origin credential, and 401/403 reissue behavior.
- Add adversarial oversized normal response and oversized/never-ending SSE/Streamable response tests, including cleanup and no token leakage.

## Platform gate and proof

- Platform `ca027417…` failed independent verification. Do not repin to it. Retain the frozen pin until Platform Codex certifies a corrected descendant.
- Re-run focused host-registry/facade, guarded MCP, SDK surface/boundary, Brain/Skills, fake/coexistence, and whitespace checks. Build required SDK artifacts before running the export check so missing `dist` cannot mask the result.
- Fixtures/countersigns remain unchanged unless governed bytes or semantics change.

No Lisa mutation, live Platform, Phases 7-12, sibling edits, credentials, paid resources, CI/Bugbot polling, PR readiness, merge, promotion, Codex classifications, or self-certification.

Return exact clean HEAD, implementation commit, changed files, test totals, SDK export/surface proof, immutable-binding adversarial proof, body-limit proof, Platform repin state, fixture state, Lisa worktree tip, and provisional Phase-13 handoff for OpenClaw Codex re-verification. Stop there.
