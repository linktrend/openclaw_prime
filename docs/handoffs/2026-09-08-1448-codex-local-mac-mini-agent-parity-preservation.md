# Agent Session Handoff

## Session Metadata

| Field            | Value                                                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent identity   | Codex Desktop Agent                                                                                                                           |
| Session ID       | `codex-local-mac-mini-desktop-workspace-feature-20260908-1431`                                                                                |
| Orchestrator key | `codex-desktop-macos-local-feature`                                                                                                           |
| Objective        | Finish source-only profile-preservation and consolidated-delivery safeguards for the existing five-agent parity candidate.                    |
| Scope            | `linkbots/parity/**`, source/profile evidence, read-only Server 01 structural evidence, narrow validators/tests, session and handoff records. |
| Started          | 2026-09-08 14:31 Asia/Taipei                                                                                                                  |
| Ended            | 2026-09-08 14:48 Asia/Taipei                                                                                                                  |
| Starting branch  | `dev/minicodex/WP-0-agent-parity-20260908`                                                                                                    |
| Ending branch    | `dev/minicodex/WP-0-agent-parity-20260908`                                                                                                    |
| Starting commit  | `8f396c1eb7677d4dbece731eb2eb738d4f6a5891`                                                                                                    |
| Ending commit    | `8f396c1eb7677d4dbece731eb2eb738d4f6a5891`                                                                                                    |
| Starting status  | Large inherited dirty candidate; no reset, clean, stash, rebase, checkout, or discard.                                                        |
| Ending status    | Same inherited dirty candidate plus this session's uncommitted parity safeguards and records.                                                 |

## Summary

Implemented a source-only, overlay-only preservation contract for Lisa, David,
Eric, Sara, and Jane. The candidate now has a machine-checked technical overlay
allowlist, protected-field comparison, structural-baseline validation, complete
runtime-root backup sequencing, rollback behavior, and four guard tests. The
existing one-command parity validator now checks the preservation contract,
exact model semantics, required plugin activation, separate identity domains,
Google Chat fail-closed state, topology, Compose rendering, and credential-shaped
literals.

No deployment function was invoked against Server 01. No live content was
printed or copied into the repository.

## Files Inspected

- Root and scoped `AGENTS.md` files governing repository, docs, scripts, agents,
  plugins, SDK, extensions, Lisa personality files, and tests.
- `docs/agent-briefing.md`, `docs/agent-coordination.md`,
  `docs/current-status.md`, active session records, the prior parity handoff,
  and the handoff/session templates.
- Protected profile manifests and history for all five agents.
- Live Server 01 structural metadata through the configured read-only SSH route:
  container names, loopback ports, runtime-root mounts, config/state paths,
  configured agent IDs, top-level and agent key sets, plugin/channel IDs,
  model/reasoning fields, and safe presence flags.
- Sibling Codex source for named profiles, model/reasoning inheritance, role
  behavior, and spawned-agent overrides.

## Files Created

- `linkbots/parity/profile-preservation.contract.json`
- `linkbots/parity/overlay.mjs`
- `linkbots/parity/deployment-guard.test.mjs`
- `docs/handoffs/2026-09-08-1448-codex-local-mac-mini-agent-parity-preservation.md`

## Files Modified

- `linkbots/parity/README.md`
- `linkbots/parity/openclaw.common.patch.json5`
- `linkbots/parity/parity.contract.json`
- `linkbots/parity/agent-bindings.template.json5`
- `linkbots/parity/validate.mjs`
- This session record, finalized separately in `docs/agent-sessions/completed/`.

## Files Deleted

None.

## Commands Run

- Read-only Git status/branch/remote/worktree/stash inspection in the task
  worktree.
- Read-only protected-manifest blob verification against `origin/development`.
- Read-only SSH/Tailscale/Docker inspection of Server 01. The first tested
  `linkserver-03` route was a read-only route to the wrong host; the configured
  `linkserver-01` route was then used for the requested inspection.
- `node scripts/run-vitest.mjs src/config/merge-patch.test.ts src/config/merge-patch.proto-pollution.test.ts src/agents/models-config.merge.test.ts src/agents/model-fallback.test.ts src/agents/model-fallback.terminal-boundary.test.ts src/agents/model-fallback-candidates.test.ts`
- `node linkbots/parity/validate.mjs`
- `node --test linkbots/parity/deployment-guard.test.mjs`
- Docker Compose `config --format json` rendering for both Lisa and fleet files
  with an all-zero test digest; no service start.
- JSON, JSON5, and rendered Compose JSON parse checks.
- `node --check` for the three new/changed JavaScript modules.
- `git diff --check` and a parity-artifact trailing-whitespace check.
- Redacted credential-pattern scan over structured parity artifacts.
- Read-only final status inspection of this worktree and the shared checkout
  `/Users/linktrend/Projects/openclaw_prime`.

## Decisions

- Complete source-profile finding: Lisa has a protected source bundle and live
  private runtime. David, Eric, Sara, and Jane have protected manifests,
  role summaries, and limited source metadata, but no complete protected source
  profile content. Their complete deployed profile content remains in the
  already-existing live workspaces. This result is recorded structurally; no
  private profile content was copied or printed.
- The five manifest blob identities were verified as supplied:
  David `2d2e2103cdce77fb34941a8476f118dfb138276c`, Eric
  `e60157af6570a5b4d4e5fc7dc08818e9371a3d60`, Sara
  `24fc50d3abb18a98c474fdd098f8f902f4dff1ed`, Jane
  `cae605a5552cc83f2ad5a9be2cfab761c5c33f4a`, and Lisa
  `9fa43b47b541a9e07a6ea8ddc86b36ce656e000b`.
- The technical operation is overlay-only. The allowlist permits only the
  exact primary/fallback model fields, per-model thinking fields, the Codex
  runtime marker, and required-plugin `enabled` leaves. All other config fields
  remain protected by projection and post-write comparison.
- The model contract is exact: OpenAI `openai/gpt-5.6-sol` primary at Low;
  sole ordered `openrouter/openai/gpt-5.6-luna` fallback at High; fallback is
  only for a qualifying provider/model failure; routine load balancing is
  disabled; generic reasoning is Low so it cannot silently make Luna Medium.
- Google Chat is explicitly disabled in the overlay and remains disabled until
  each agent's SecretRef, Workspace, API, admin, event endpoint, and plugin
  gates are independently verified.
- Lisa's coding-specific routing remains a named HOLD. Direct source and live
  evidence did not establish a supported generic cross-agent field, so no new
  configuration option was invented.
- The existing topology is preserved: Lisa remains separate on 18791; Eric,
  David, Sara, and Jane remain separate fleet services on 18792-18795 with
  independent runtime roots, workspaces, state databases, and revocation
  references.
- No separate orchestration wrapper was added because the existing one-command
  `linkbots/parity/validate.mjs` is now the narrow preflight and invokes the
  overlay/contract checks directly.

Direct Codex source evidence checked:

- `codex-rs/core/src/agent/role.rs:1-7,31-36,175-207` preserves caller model,
  provider, service tier, and reasoning when the role layer does not override
  them.
- `codex-rs/core/src/config/mod.rs:459-462,617-641,868-872,948-961,1887-1894,2416-2445,3241-3247`
  defines model/provider/reasoning fields, named-profile selection, and legacy
  profile rejection.
- `codex-rs/app-server-protocol/src/protocol/v2/turn.rs:117-142` defines
  named permissions, model, reasoning, and personality as distinct turn
  controls.
- `codex-rs/core/src/tools/handlers/multi_agents_v2/spawn.rs:61-90` passes
  requested model/reasoning overrides separately from role application.

These decisions are implementation judgment within the explicit packet; no
additional live authority was inferred.

## Tests and Verification

- Focused model/config validation: PASS, 3 Vitest shards, 246 tests total:
  2 model-fallback-candidate tests, 23 merge-patch/prototype-pollution tests,
  and 221 agent-core model/fallback/terminal-boundary tests.
- Preservation/deployment guard tests: PASS, 4/4.
- Parity validator: PASS, exactly 5 agents and 9 required plugins, with Lisa
  and fleet topology preserved.
- Compose rendering: PASS for Lisa and fleet artifacts; both rendered with a
  test all-zero digest and no services were started.
- Serialization: PASS, 2 JSON files, 2 JSON5 files, and 2 rendered Compose
  JSON documents.
- JavaScript syntax: PASS for `overlay.mjs`, `validate.mjs`, and
  `deployment-guard.test.mjs`.
- Diff/whitespace: PASS for tracked `git diff --check` and parity artifact
  whitespace scan.
- Redacted secret scan: PASS over structured parity artifacts; no credential
  values detected. An initial overly broad scan returned a false positive on
  the validator's own literal regex names; that scan was not counted as a
  pass, and the corrected data-artifact scan passed.
- No targeted TypeScript check was rerun because this pass changed only parity
  JSON/JSON5/YAML/Markdown and JavaScript support/guard files; the prior
  handoff records the affected TypeScript-focused checks as passing.
- The prior handoff records targeted Oxlint exit 137 from resource exhaustion;
  it was not rerun and is not a pass.
- The full OpenClaw repository suite was not run, as required.

## Problems and Blockers

- The live deployed route remains Luna primary/Medium with OpenRouter Luna
  fallback/Medium; this is current live evidence, not parity proof. No live
  parity or deployment readiness claim is made.
- The supplied historical `openclaw-fleet.compose.yml` was absent during
  source inspection. The candidate retains the verified separate fleet
  topology in `compose.server01.fleet.yml`; this remains source evidence, not
  production proof.
- Lisa coding-specific routing cannot be encoded safely without a supported
  generic technical field; HOLD remains explicit.
- Google Chat gates remain unverified and fail-closed.
- Independent review, the one consolidated checkpoint, the one Phase PR, and
  development-to-staging-to-main bootstrap remain governed next steps. No
  checkpoint, review, PR, merge, or promotion was created here.

## Uncommitted Changes

This session's changes are the parity safeguard files listed above, the new
handoff, and this session record. The worktree also contains a large
pre-existing dirty candidate from prior workers, including tracked core/plugin
changes, untracked extensions and tests, and prior records/handoffs. Those
changes were not reset, cleaned, stashed, rebased, overwritten, or attributed
to this session.

Production runtime LOC delta attributable to this session: **0**. The three
new guard/contract/test files are 360 current lines total (67 contract, 215
overlay/deployment support, 78 tests). Existing untracked parity artifact
content was present before this session, so its net historical delta is not
claimed here. The inherited tracked candidate diff was observed separately and
was not included in this session's LOC accounting.

## Risks and Unknowns

- Complete non-Lisa profile contents are private live inputs and are not
  represented in protected source. Any later deployment must capture the
  required redacted structural baseline and recoverable full-root backups on
  Server 01 before mutation.
- The guard is source-only and test-covered; it has not been exercised against
  live files, services, credentials, providers, Platform, Google Cloud, or
  Workspace.
- Provider credentials, SecretRefs, authorization databases, recipients,
  jobs, schedules, conversations, and private content were intentionally not
  read or reproduced.

## Remaining Work

- Obtain the exact Lisa coding-routing evidence and a supported generic field,
  or keep the named HOLD.
- Complete independent read-only review of the consolidated candidate.
- Create exactly one governed checkpoint and one Phase PR only after review and
  the applicable authorization gates.
- If explicitly authorized later, run one development-to-staging-to-main
  bootstrap sequence with immutable image identity, per-agent SecretRefs,
  canary/serial proof, and ephemeral Server 01 receipts.

## Exact Next Action

Independent review of the final source diff against the exact base, including
the preservation contract, overlay allowlist, guard tests, manifest evidence,
and protected Codex source references. Do not deploy until the explicit HOLDs
and protected-release gates are resolved.

## Questions for Carlos

None for this source-only pass. Any live mutation, credential use, cloud
mutation, checkpoint, push, PR, merge, or promotion requires a separate
explicit authorization.

## Questions for the Orchestrator or Next Agent

- Please refresh `docs/current-status.md` from this completed session record;
  this feature agent did not edit the shared dashboard.
- Preserve the single-checkpoint, single-review, single-Phase-PR sequence.
- Keep the Lisa coding-routing and Google Chat HOLDs explicit until their exact
  evidence exists.

## Confidence

96% confidence in the source-only preservation safeguards and narrow validation
results. The missing 4% is specifically the absent complete protected source
for David/Eric/Sara/Jane, unresolved Lisa coding-routing evidence, unverified
Google Chat gates, absent independent review/checkpoint/Phase PR, and absent
production canary/deployment proof. These gaps prevent any claim of live parity
or deployment readiness.

## Amendments

None.
