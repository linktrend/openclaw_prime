# Agent Session Handoff

## Session Metadata

| Field            | Value                                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| Agent identity   | Codex Desktop Agent / local macOS                                                                                |
| Session ID       | codex-local-acpx-packaging-20260909-1242                                                                         |
| Orchestrator key | openclaw-prime-acpx-packaging                                                                                    |
| Objective        | Repair Docker selected-plugin retention for ACPX runtime dependencies and add an image-level regression.         |
| Scope            | Dockerfile assembly, shared plugin dependency-link helper, selected-plugin Docker E2E lane, coordination records |
| Started          | 2026-09-09 12:42 +0800                                                                                           |
| Ended            | 2026-09-09 12:45 +0800                                                                                           |
| Starting branch  | issue/142825-fix-docker-acpx-selected-plugin-runtime-dependen                                                    |
| Ending branch    | issue/142825-fix-docker-acpx-selected-plugin-runtime-dependen                                                    |
| Starting commit  | 0b5733a13126ded39a6f9a4ed71894a8672e827e                                                                         |
| Ending commit    | Checkpoint identity recorded in the final result after commit creation.                                          |
| Starting status  | clean governed issue worktree                                                                                    |
| Ending status    | pushed checkpoint; Docker image admission pending                                                                |

## Summary

Root cause: pnpm isolated workspace installs retain external plugin runtime dependencies under the plugin importer. Docker-selected plugins compile into the unified distribution, but the Docker assembly path pruned before lifecycle cleanup and never staged those importer-owned packages under `dist/extensions/<id>`. ACPX therefore reached the image with manifest metadata but its dependency status could report missing `@agentclientprotocol/claude-agent-acp`, `@agentclientprotocol/codex-acp`, `acpx`, and `smol-toml`.

Canonical repair: extract the existing per-package dependency-link implementation into a plain Node helper shared by source metadata packaging and Docker pruning. Docker now runs package cleanup first, links every retained root-package-excluded plugin under its packaged root, and fails the image build if a required declared dependency remains unreachable.

## Files Inspected

- `AGENTS.md`, `docs/agent-briefing.md`, `docs/agent-coordination.md`, `docs/current-status.md`, scoped `AGENTS.md` files, session/handoff templates, and recent Server01 parity handoff.
- `Dockerfile`; `scripts/lib/docker-plugin-selection.mjs`; `scripts/lib/bundled-plugin-build-entries.mjs`; `scripts/prune-docker-plugin-dist.mjs`; `scripts/postinstall-bundled-plugins.mjs`; `scripts/copy-bundled-plugin-metadata.mts`.
- `extensions/acpx/package.json`, `extensions/acpx/openclaw.plugin.json`, `extensions/acpx/src/manifest.test.ts`, ACPX entrypoint, plugin list/status/dependency/inspect sources.
- Existing selected-plugin Docker shell/scenario/assertions and `scripts/lib/docker-e2e-scenarios.mts` catalog; no catalog change was required.
- Sibling Codex source: `../codex/package.json:1-38`, `../codex/codex-cli/package.json:1-21`, `../codex/codex-rs/exec/src/cli.rs:9-75`, `../codex/codex-rs/exec/src/main.rs:1-39`, `../codex/codex-rs/core/src/exec.rs:58-115,140-199`. No ACPX package or ACP adapter manifest exists in that sibling repository; its relevant contract is the Codex CLI execution surface and JSON/ephemeral options.
- Exact pre-fix protected ref: `origin/main` at `d03cca3f9c1ea60f7ecc5d75e55ad1b4cd0b4ee5`, tree `5dbc3ccafc1d1aa0591831ec9fcff0af9d345b2c`.

## Files Created

- `scripts/lib/bundled-plugin-dependency-links.mjs`
- `docs/handoffs/2026-09-09-1245-codex-local-acpx-packaging.md`
- `docs/agent-sessions/completed/codex-local-acpx-packaging-20260909-1242.md` (moved from active at closeout)

## Files Modified

- `Dockerfile`
- `scripts/copy-bundled-plugin-metadata.mts`
- `scripts/prune-docker-plugin-dist.mjs`
- `scripts/e2e/docker-selected-plugins.sh`
- `scripts/e2e/lib/docker-selected-plugins/scenario.sh`
- `scripts/e2e/lib/docker-selected-plugins/assertions.mjs`

## Files Deleted

- None.

## Commands Run

- `python3 scripts/gitops/create_issue_branch.py "Fix Docker ACPX selected-plugin runtime dependencies" --prefer-worktree`
- `node .../pnpm/bin/pnpm.mjs install --frozen-lockfile`
- Targeted `node_modules/.bin/oxfmt --write` on changed formatter-supported files.
- `node --check` on changed JavaScript modules; `bash -n` on changed shell scripts.
- `node scripts/run-vitest.mjs src/plugins/prune-docker-plugin-dist.test.ts src/plugins/copy-bundled-plugin-metadata.test.ts extensions/acpx/src/manifest.test.ts test/scripts/docker-e2e-source-roots.test.ts`
- Earlier focused validation: Docker helper tests 274 passed, 2 skipped; `node scripts/check-changed.mjs --dry-run -- <explicit changed paths>`.
- `git diff --check` and fresh status/diff inspection.
- `docker version` and image lane availability probe; Docker daemon unavailable at the local socket.

## Decisions

- Reused the existing dependency-link algorithm already used by isolated source-checkout packaging; no ACPX-specific core exception or ad hoc node_modules copy was introduced. This is implementation judgment grounded in the current manifest/workspace owner and the historical packaging repair.
- Extended the existing `docker-selected-plugins` lane rather than adding a new catalog entry. The image regression now selects ACPX, runs `openclaw plugins list --json`, runs runtime inspect, resolves all four declared dependencies from the canonical `/app/node_modules` tree, and keeps sibling selected-plugin assertions.
- Did not alter Server01, protected branches, services, credentials, deployment files, or GitHub PR/ruleset state.

## Tests and Verification

- Passed: ACPX manifest tests 3/3.
- Passed: prune and metadata tests 22/22.
- Passed: Docker E2E source-root tests 8/8.
- Passed earlier: Docker build-helper tests 274 passed, 2 skipped.
- Passed: JavaScript/shell syntax checks, targeted formatting, `git diff --check`, and changed-path dry-run planning.
- Not run: real image build/run regression against exact pre-fix source or repaired source because Docker could not connect to `unix:///Users/linktrend/.docker/run/docker.sock`. No mock was substituted.
- Not run: full repository suite, broad scan, live providers, credentials, or Server01.

## Problems and Blockers

- Required image-level pre-fix failure and post-fix success remain pending Docker capacity. The exact pre-fix source was verified by remote readback, but no image claim is made without the real build/run lane.
- Server01 image admission remains HOLD and must be performed by the orchestrator after independent Luna High review and governed promotion evidence.

## Uncommitted Changes

- None expected after the checkpoint push. The dirty shared development checkout and unrelated worktrees were preserved and are not part of this handoff.

## Risks and Unknowns

- The final image assertion has not been observed locally; the lane is intentionally deterministic and will fail if any dependency resolves outside `/app/node_modules` or ACPX status is not loaded.
- The final commit SHA/tree are self-referential to this handoff and are recorded in the final result and remote readback rather than embedded in this commit’s own content.

## Remaining Work

- Run the existing selected-plugin Docker lane with ACPX against the exact pre-fix protected source and this checkpoint.
- Have the orchestrator obtain the separate GPT-5.6 Luna High independent review, then perform the single governed development-to-staging-to-main promotion sequence if all gates pass.
- Keep rejected digest `sha256:cb9fa3b5889b5aa15a16aceb7fa2189bfc914cd9451117f7a0d4e283d53e3968` undeployed.

## Exact Next Action

Orchestrator: run the real image lane, capture sanitized pre-fix missing-dependency/ACPX-load failure and post-fix package/load success, then decide image admission under the governed promotion gates.

## Questions for Carlos

- None; Docker capacity and the separate Luna High review are orchestrator-controlled gates.

## Questions for the Orchestrator or Next Agent

- Please preserve source-only HOLD status until both image proofs and the independent review are current.

## Confidence

98% in the source-level owner-boundary repair and focused checks; image behavior is unverified locally solely because the Docker daemon is unavailable.

## Amendments
