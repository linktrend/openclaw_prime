# Current Repository Status

## Status Metadata

- Last updated: 2026-07-23 12:45 Asia/Taipei
- Agent: Codex Desktop Agent
- Session ID: codex-desktop-agent-20260723-1110
- Branch: `docs/initial-agent-handoff-20260723`
- Commit: ed4b348d889e1a31da8ec90d13c3508127fd71a6
- Scope: Completed the two-stage multi-platform agent documentation system: collision-resistant repository-local coordination now and a documented LiNKbrain integration boundary for later. Documentation only; no application, runtime, credential, or deployment changes. No commit/PR authorized.
- Handoff: `docs/handoffs/2026-07-23-1243-codex-desktop-agent-coordination.md`
- Session note: Earlier registration temporarily used label `Cursor Desktop Local Mac Mini Agent` / ID `cursor-desktop-local-mac-mini-20260723-1105`. Carlos corrected the agent type to `Cursor Local Agent`; session ID normalized to `cursor-local-20260723-1105` for the same 11:05 start.

## Current Stable State

As of 2026-07-23 12:45 Asia/Taipei, checkout is on `docs/initial-agent-handoff-20260723` at `ed4b348d889`. Documentation remains uncommitted. Six pre-existing application modifications and untracked `linkbots/` remain preserved. Cursor session `cursor-local-20260723-1105` is still recorded active/waiting. Codex session `codex-desktop-agent-20260723-1110` completed the authorized documentation-system implementation and moved its record to `docs/agent-sessions/completed/`. This session did not re-verify Lisa runtime health.

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
