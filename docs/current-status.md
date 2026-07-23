# Current Repository Status

## Status Metadata

- Last updated: 2026-07-23 14:00 Asia/Taipei
- Agent: Cursor Local Agent (merge follow-up)
- Session ID: cursor-local-merge-followup-20260723-1400
- Branch: `main` (post-merge)
- Commit: e35f1c0659a40c6b4ccb4b39f7fc1af4bda1c74d (merge of #20); also merged #18 -> development (`f544ba7647d`), #19 -> staging (`8175f561fab`)
- Scope: Follow-up after Carlos-authorized preservation PRs. Docs/linkbots handoff content is now on `development`, `staging`, and `main`.
- Handoff: `docs/handoffs/2026-07-23-1400-cursor-local-pr-merges-complete.md`
- Prior note: Session label normalization to `Cursor Local Agent` / `cursor-local-20260723-1105` remains valid historical context.

## Current Stable State

As of 2026-07-23 14:00 Asia/Taipei, the Lisa management-period docs/linkbots preservation is merged: PR #18 -> `development`, #19 -> `staging`, #20 -> `main`. Merge commits: `f544ba7647d` (development), `8175f561fab` (staging), `e35f1c0659a` (main). Unrelated local application source modifications were not part of those PRs and may still exist in working checkouts. Lisa live runtime under `~/.openclaw-lisa` was not touched. This follow-up did not re-verify Lisa runtime health.

The coordination design now uses unique per-session records as the ownership authority. This dashboard is an Orchestrator-maintained summary. Stage 1 is repository-local and does not claim automatic cross-machine synchronization. Stage 2 reserves LiNKbrain for canonical knowledge and append-only findings after live OpenClaw Prime consumer wiring is implemented and verified.

## Most Recently Completed Work

Outgoing Cursor Local Agent session `cursor-local-20260723-1012` created the initial repository technical briefing and multi-agent handoff system (documentation-only; left uncommitted). Follow-up amendment at 10:19 Asia/Taipei corrected shallow-history diagnosis and related accuracy items.

Incoming Cursor Local Agent session `cursor-local-20260723-1105` completed mandatory onboarding, registered status, and at 11:10 Asia/Taipei switched onto `docs/initial-agent-handoff-20260723` per Carlos instruction and normalized agent label to `Cursor Local Agent`.

Codex Desktop Orchestrator session `codex-desktop-agent-20260723-1110` completed the two-stage coordination protocol at 12:45 Asia/Taipei. It added unique session records, templates, coordination-home and relay workflows, platform-machine role topology, and the future LiNKbrain boundary. See `docs/handoffs/2026-07-23-1243-codex-desktop-agent-coordination.md`.

## Active Work

| Agent              | Session ID                 | Branch                                | Scope                                           | Started                      | Status           | Overlap Risk                                                                                                                                                                                           |
| ------------------ | -------------------------- | ------------------------------------- | ----------------------------------------------- | ---------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cursor Local Agent | cursor-local-20260723-1105 | `docs/initial-agent-handoff-20260723` | Onboarding complete; awaiting Carlos assignment | 2026-07-23 11:05 Asia/Taipei | Active / waiting | Medium: shared dirty working tree with uncommitted docs, six modified app files, and untracked `linkbots/`. Will not touch pre-existing app files or live Lisa runtime without explicit authorization. |

## Incomplete or Uncommitted Work

Pre-existing before the documentation task (still present):

- Modified: `extensions/acpx/src/cursor-model.ts`
- Modified: `extensions/acpx/src/runtime.test.ts`
- Modified: `extensions/github-copilot/dynamic-models.ts`
- Modified: `src/agents/cursor-acp-model.test.ts`
- Modified: `src/agents/cursor-acp-model.ts`
- Modified: `src/infra/exec-approvals-denylist.ts`
- Untracked: `linkbots/` workshop files
- Stash: `stash@{0}: On main: wip-auth-unrelated`

Created/modified by the documentation task and still intentionally uncommitted:

- `README.md`
- `AGENTS.md`
- `docs/agent-briefing.md`
- `docs/current-status.md`
- `docs/handoffs/2026-07-23-1012-cursor-local-initial-briefing.md`

Modified by this onboarding session:

- `docs/current-status.md` (session registration and branch/label corrections)

Created/modified by Codex Orchestrator session `codex-desktop-agent-20260723-1110`:

- `AGENTS.md`
- `README.md`
- `docs/agent-briefing.md`
- `docs/agent-coordination.md`
- `docs/agent-sessions/TEMPLATE.md`
- `docs/agent-sessions/completed/codex-desktop-agent-20260723-1110.md`
- `docs/handoffs/TEMPLATE.md`
- `docs/handoffs/2026-07-23-1243-codex-desktop-agent-coordination.md`
- `docs/current-status.md`

## Known Problems and Blockers

| Problem                                                                                     | Evidence                                                                                                         | Impact                                                                                    | Owner                        | Next Action                                                                                                                |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Checkout was previously on `dev/minicodex/WP-01` after outgoing handoff claimed docs branch | Incoming verification at 11:05; corrected by `git switch docs/initial-agent-handoff-20260723` at 11:10           | Resolved for labeling; cause of earlier switch-back still unknown                         | Outgoing agent / Carlos      | Optional clarifying question to outgoing agent only.                                                                       |
| No merge base with `upstream/main` because this checkout is shallow                         | `git rev-parse --is-shallow-repository` returned `true`                                                          | Upstream diff/merge decisions are unreliable until history is deepened                    | Future repo agent            | Deepen/unshallow only with Carlos approval.                                                                                |
| Dirty application files predate documentation task                                          | Six modified TS files still present                                                                              | High risk of accidental overwrite or misattribution                                       | Owner of prior work / Carlos | Do not edit/revert without explicit instruction.                                                                           |
| Intended `linkbots/` workshop content remains untracked                                     | `?? linkbots/` still present                                                                                     | Status noise and possible loss while untracked                                            | Carlos                       | Decide whether to commit it now.                                                                                           |
| Runtime health not re-verified in this onboarding session                                   | Onboarding limited to docs/Git/path existence checks                                                             | Prior LaunchAgent/channel claims are handoff evidence, not freshly reconfirmed here       | Future runtime agent         | Investigate only under separately authorized runtime task.                                                                 |
| Shared dashboard edits caused a real collision                                              | Codex registration patch failed after Cursor updated `docs/current-status.md` between reads                      | Multiple agents cannot safely use one shared Markdown table as their primary write target | Codex Orchestrator           | Implemented unique per-session records; workers no longer edit the dashboard.                                              |
| Cross-machine coordination is not automatic in Stage 1                                      | Separate machines, cloud sandboxes, mobile apps, branches, and clones may not share uncommitted repository files | An Orchestrator may not know remote work without an explicit relay                        | Every matching Orchestrator  | Require Coordination Relay when canonical local records cannot be written; integrate LiNKbrain later for shared knowledge. |

## Pending Decisions

- Whether to commit or PR the documentation branch / uncommitted docs.
- Whether to commit the intended `linkbots/` content now or leave it untracked temporarily.
- When to deepen/unshallow upstream history.
- Whether to schedule a deeper Lisa runtime/database/task/security investigation.
- Whether the David profile should remain placeholder-only or get a planning doc.
- What substantive task Carlos assigns next to session `cursor-local-20260723-1105`.
- When Carlos wants OpenClaw Prime wired as the first live LiNKbrain Program consumer.

## Next Recommended Action

Review the completed documentation-only diff and decide whether to commit or open a PR. Keep it separate from the six pre-existing application changes and `linkbots/` unless Carlos explicitly broadens the scope.

## Recent Relevant Handoffs

- `docs/handoffs/2026-07-23-1012-cursor-local-initial-briefing.md` - initial technical briefing and handoff system.
- `docs/handoffs/2026-07-23-1243-codex-desktop-agent-coordination.md` - collision-resistant local protocol and future LiNKbrain boundary.

## Verification Notes

- Fresh Git status/branch/remotes/worktrees/stashes checked at 2026-07-23 11:05 Asia/Taipei.
- Branch switch to `docs/initial-agent-handoff-20260723` verified at 11:10 Asia/Taipei; dirty tree preserved.
- Documentation files exist and remain uncommitted.
- Six pre-existing app modifications still exist.
- `linkbots/` remains untracked.
- Two dated handoffs and the reusable handoff template now exist under `docs/handoffs/`.
- Shallow repository confirmed (`true`).
- `~/.openclaw-lisa` present; `~/.openclaw-david` absent.
- No LaunchAgent/status/channel re-probe performed in this onboarding pass.
- No secrets printed; no macOS `security`/Keychain commands run.
- No commit, PR, merge, rebase, or runtime change performed.
- `pnpm docs:list`, targeted `oxfmt --check`, path/stale-instruction checks, and `git diff --check` completed successfully for this documentation task.

## Merge Completion - 2026-07-23 14:00 Asia/Taipei

Carlos-authorized preservation PRs are merged with merge commits (repo norm):

- <https://github.com/linktrend/openclaw_prime/pull/18> -> `development` (`f544ba7647d`)
- <https://github.com/linktrend/openclaw_prime/pull/19> -> `staging` (`8175f561fab`)
- <https://github.com/linktrend/openclaw_prime/pull/20> -> `main` (`e35f1c0659a`)

CI at merge time was `UNSTABLE` with no required status checks on the protected branches. Failures observed: `auto-response` / `label` (missing GitHub App private-key secrets) and `security-fast` (pre-existing HIGH prod dependency advisories: otel jaeger propagator, axios, fast-uri). Many other CI jobs were still pending. Merges used `gh pr merge --merge` without admin bypass or force push.

## Final Cursor Local Agent PR Handoff - 2026-07-23 14:12 Asia/Taipei

Carlos explicitly requested the Lisa management period work be committed, pushed, and PR'd into `development`, `staging`, and `main` so it is not lost. Cursor Local Agent completed the preservation path with target-specific branches to avoid carrying unrelated main-only history into `development` or `staging`.

- Development PR: <https://github.com/linktrend/openclaw_prime/pull/18> (`docs/initial-agent-handoff-20260723-development` -> `development`)
- Staging PR: <https://github.com/linktrend/openclaw_prime/pull/19> (`docs/initial-agent-handoff-20260723-staging` -> `staging`)
- Main PR: <https://github.com/linktrend/openclaw_prime/pull/20> (`docs/initial-agent-handoff-20260723` -> `main`)

Preserved in git: `AGENTS.md`, `README.md`, `docs/agent-briefing.md`, `docs/agent-coordination.md`, `docs/current-status.md`, `docs/agent-sessions/`, `docs/handoffs/`, and `linkbots/` including Lisa workshop/personality/docs/config snapshots and David placeholder.

Deliberately excluded: unrelated modified application files in `extensions/acpx/src/cursor-model.ts`, `extensions/acpx/src/runtime.test.ts`, `extensions/github-copilot/dynamic-models.ts`, `src/agents/cursor-acp-model.test.ts`, `src/agents/cursor-acp-model.ts`, and `src/infra/exec-approvals-denylist.ts`; `.DS_Store` metadata files; live runtime `~/.openclaw-lisa`; and any `.env`, credential dumps, private keys, OAuth files, or raw token values.

Merge status at handoff: PRs are open for review/CI; no merges were performed in this final session.
