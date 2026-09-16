# OpenClaw PACI Independent-Verification Correction Prompt

Use **Cursor Grok 4.5 High** for the primary agent and every spawned subagent. Continue branch `issue/ocp-openclawdevelopmentplan01` from exact verified HEAD `3e449b74d8a2fdfb157949656f394228dab32857`. Preserve this Principal-supplied prompt if initially untracked and include it in the correction commit. Spawn Grok 4.5 High subagents on explicit non-overlapping paths and complete all corrections in one wave.

This is a bounded correction after independent Codex review. Do not merge, change PR #38 readiness, poll CI/Bugbot, contact live Platform, mutate live Lisa, deploy, enable plugins, start Phases 7–12, or self-certify. Do not touch `.worktrees/lisa-ops01`, branch `issue/ocp-lisa-ops01`, `linkbots/lisa/Personality files/**`, or its four uncommitted Lisa operational files. Do not edit sibling repositories.

Read all applicable `AGENTS.md`, coordination records, the PACI production prompt/handoff, actual callers/siblings/tests, and frozen Platform authority at exact Platform HEAD `0455846487d0b8c583859060ba8b4be70e7f0b48`:

- ADR 0013 Accepted;
- `platform.auth-token-envelope/0.1.0`;
- `@linktrend/platform-contracts@0.3.0`;
- schema SHA-256 `7173b9f9bca59ce8a0e3e3dc2b78b680dd07fdd2451215e3ecd97ff3dd463eed`;
- Platform consumer PACI handoff and local/fake server.

The frozen authority supersedes the OpenClaw draft pin at Platform `2c270…`. If Platform publishes a compatible correction descendant during this work, inspect and pin it exactly.

## Corrections required

1. **Cryptographically isolate cache and single-flight state**
   - Replace `bindingId`-only cache/single-flight keys with an immutable binding fingerprint that covers issuer, discovery/token endpoint identity, client ID, key reference/version, audience, service, operations/scopes, and environment without exposing secrets.
   - Config replacement, SecretRef/key rotation, scope change, endpoint change, domain change, reload, and unregister must invalidate only the exact old binding.
   - Add the independent counterprobe: two issuers/clients sharing an operator label must never reuse a token; each issuer must mint independently.

2. **Make auth selection explicit and fail closed**
   - `auth: "oauth"` must never be overridden merely because a `machineToken` block exists.
   - `auth: "machine_token"` must require one complete valid machine-token binding at schema/config-validation time and fail startup/doctor otherwise.
   - Disabled or incomplete bindings must never fall through to static/no auth, SecretRef bearer, or another domain.
   - Apply the same exact rules to managed MCP and linkbrain/linkskills plugin HTTP/MCP transports, with regression tests for every combination.

3. **Use OpenClaw's hardened network boundary**
   - Require HTTPS for non-local-test issuers/endpoints. Permit HTTP only for explicit local-test loopback.
   - Route discovery, token, JWKS/introspection-related calls through current OpenClaw SSRF/DNS/IP/TLS-safe helpers.
   - Reject link-local, loopback in production, private/reserved addresses according to existing policy, redirects, cross-origin endpoint metadata, DNS rebinding, oversized/invalid responses, and unsupported content types.
   - Add bounded connect/response deadlines, body limits, AbortSignal, 429/5xx handling, late-settlement safety, and no unhandled rejection.

4. **Never project machine tokens externally**
   - Remove machine access tokens from bearer projection to CLI/Codex config, literal headers, generated config, child-process environment, snapshots, diagnostics, or external bundles.
   - `bundle-mcp-codex` must not request or receive a literal machine token. If a target runtime cannot call the machine-token provider seam directly, mark that projection unsupported and fail closed rather than exporting the token.
   - Add negative tests scanning all external projection paths.

5. **Use the real frozen Platform fake and contract**
   - Replace the opaque UUID fake with deterministic/test-controlled ES256 `private_key_jwt`, signed `paci+jwt`, exact RFC 8414 metadata, JWKS, authenticated introspection, 900-second no-refresh lifetime, and frozen positive/negative fixtures.
   - Prefer the installable Platform fake/helper artifact once corrected; otherwise implement an exact test adapter pinned by hashes.
   - Prove wrong claims/alg/issuer/environment, JWKS rotation, authenticated introspection/privacy, assertion replay, time boundaries, 429/5xx/timeout/late settlement, 401/403 reissue, and Brain/Skills isolation.

6. **Enforce SecretRef-only private-key custody**
   - Remove literal PEM/private-key strings from core TypeScript config, Zod schemas, plugin manifests, docs, fixtures, diagnostics, and runtime paths.
   - Require canonical SecretRef/file/injected key references and resolve them only at the trusted machine-token provider boundary.
   - Ensure private keys and client assertions are never persisted or logged.

7. **Scope the public Plugin SDK correctly**
   - Plugins receive a host-injected binding-scoped acquisition/invalidation/health facade, not direct global cache controls.
   - A plugin may operate only bindings granted to its plugin identity; it cannot clear all state or invalidate another domain.
   - Add ownership, unregister/reload, diagnostics, isolation, and boundary tests plus complete public SDK documentation and exports.

8. **Validate every frozen semantic**
   - Metadata must require exact issuer, client_credentials, private_key_jwt, ES256, empty response types, no authorization endpoint, no shared-secret methods, same-origin JWKS/token/introspection, and exact endpoint rules.
   - Accept only frozen 900-second access-token lifetime; reject arbitrary positive `expires_in`.
   - Implement one bounded reissue for matching 401 and 403 on managed MCP and plugin HTTP/MCP paths; never retry endlessly or broaden permissions.

9. **Close build/evidence debt**
   - Add the public SDK docs and all package/export/entrypoint/generated metadata required by repository rules.
   - Make `node scripts/check-plugin-sdk-exports.mjs` pass from a clean built state, along with surface/boundary checks.
   - Fix all `git diff --check origin/development...HEAD` whitespace failures.
   - Correct completed subagent records still marked `handing-off`, PACI pins, Phase 13 coverage, and handoffs without assigning Codex classifications.

## Required proof

Run the real Platform frozen local interoperability matrix, focused core/config/network/cache tests, MCP OAuth regressions, managed MCP and plugin 401/403 flows, linkbrain/linkskills isolation/privacy suites, Plugin SDK exports/surface/boundary/docs checks, relevant `tsgo`/build/package checks, secret/projection scans, and `git diff --check origin/development...HEAD`. Use repository-approved local/Testbox rules without hosted CI/Bugbot. Record failures and reruns.

Commit cohesive changes, push the existing branch, keep PR #38 draft, close the implementation session, and create a dated correction handoff with exact start/code/clean heads, Platform pins/hashes, files, commands, results, residuals, Lisa-worktree preservation, and revised coverage evidence. Stop for independent OpenClaw Codex re-verification. Do not self-certify or request fixture-owner countersigns unless fixture JSON actually changes.
