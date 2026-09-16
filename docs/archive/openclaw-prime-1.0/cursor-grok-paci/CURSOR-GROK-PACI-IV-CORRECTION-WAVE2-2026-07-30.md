# Cursor Grok 4.5 High — OpenClaw PACI Independent-Verification Correction Wave 2

Continue draft PR #38 from exact clean HEAD `4126b7f590b4104a479d17795082e140c4f26ce1`. Use Cursor Grok 4.5 High. Spawn only Grok 4.5 High subagents and parallelize the bounded lanes below, respecting scoped `AGENTS.md` ownership. One primary agent must integrate the lanes, resolve conflicts, run proof, maintain the OpenClaw session/handoff records, and return one clean tip.

Before editing, re-run the repository coordination preflight and confirm no overlap with `.worktrees/lisa-ops01`. Do not edit, switch, rebase, merge, or absorb that Lisa operations branch. Preserve OAuth behavior, fixture-owner boundaries, Brain/Skills separation, native OpenClaw coexistence, default-disabled plugins, and all passing capture/outbox/filter work.

## Mandatory corrections

### Lane A — exact metadata and PACI contract validation

- Enforce the frozen authorization-server metadata exactly: configured issuer equality with no trailing slash; required HTTPS endpoints; omitted `authorization_endpoint` rather than null; required JWKS/introspection/token endpoints; exact Phase-1 grant/auth/signing arrays; `response_types_supported: []`; required introspection auth methods; correct element types; reject extra unsupported grant/auth/algorithm values.
- Add all nine adversarial cases identified by Codex plus malformed array elements, wrong origin, redirects, and duplicate/conflicting metadata.

### Lane B — hardened token and resource networking

- Separate machine-token discovery/mint/introspection fetch from general MCP resource fetch. An injected general MCP fetch must never bypass the hardened auth network boundary.
- Token/auth requests: HTTPS, SSRF guard, zero redirects, fixed deadline, bounded headers/body, no cross-origin body replay, safe errors, and no secret/body logging.
- Bound non-2xx response reads; do not call unbounded `arrayBuffer()` before enforcing the size cap.
- Brain/Skills HTTP and MCP resource transports must use the supported OpenClaw guarded network path and perform exactly one bounded reissue/retry on 401 or 403, then fail closed.

### Lane C — host-owned Plugin SDK authority

- Move machine-token facade construction, grant selection, raw resolution, per-binding invalidation, and global cache controls to host-internal ownership.
- Plugins must receive only a host-injected, already identity/binding/domain-scoped facade. They must not choose arbitrary plugin IDs/grants or call global clear/invalidation.
- Remove unscoped/global helpers from the public Plugin SDK surface while retaining the minimum consumer facade types/functions.
- Update surface/boundary tests to prove external/bundled plugin code cannot import or construct privileged controls.

### Lane D — SecretRef-only plugin configuration and transports

- Brain and Skills plugin schemas must accept only supported SecretRef objects for client assertion keys; reject literal strings, PEM/JWK-looking values, environment projections, CLI literals, and incomplete bindings.
- Require HTTPS outside explicit local-test loopback. Do not broadly allow private networks for production PACI/MCP/HTTP endpoints.
- Apply guarded transport and one 401/403 reissue consistently to HTTP and MCP paths, without static bearer persistence.

### Lane E — Platform-parity fake and synchronization gate

- Update the fake to reject non-UUID assertion `jti`, enforce single-use assertions, reject any requested scope not granted to the client/credential, and mirror the corrected introspection caller/resource rules.
- Add direct counterprobes for `jti=not-a-uuid`, requested `admin` with only `linkbrain`, cross-domain introspection, rotation/revocation, and token/resource-client separation.
- Platform HEAD `39c46680f058d86484fcb24c25c3463deb9488ae` failed independent verification. Do not certify or permanently repin to it. Complete the generic fixes now, then repin exact Platform head/package/tarball/schema/fixtures only after Platform Codex certifies a corrected descendant.
- Re-run Brain and Skills fixture-owner countersigns only if fixture bytes or governed contract semantics change. Never self-countersign.

## Proof required

Use trusted local focused proofs appropriate to repository policy: machine-token discovery/network/cache, MCP transport, plugin SDK boundaries/surface, Brain and Skills transport/config, fake PACI, native coexistence, and the Phase-13 coverage validator. Run formatting/whitespace and relevant lightweight static checks. Hosted CI and Bugbot are Principal-deferred; do not poll or rerun them.

Record the current Lisa operations worktree tip accurately in the handoff. Do not describe an older tip as current.

## Hard boundaries

- No Lisa live profile/runtime/config mutation.
- No Platform/Brain/Skills repository edits or live contact.
- No Phases 7-12, deployment, credentials/keys, paid resources, PR readiness change, merge, or branch promotion.
- No self-certification and no Codex classifications in Grok artifacts.

Finish with a clean pushed PR branch and provisional Phase-13 correction handoff for OpenClaw Codex Phase-14 re-verification. Return the exact clean HEAD, implementation commit, changed files, focused test counts, public SDK surface result, Platform repin state, fixture/countersign state, preserved Lisa worktree tip, unresolved gates, and handoff paths. Stop there.
