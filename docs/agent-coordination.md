# OpenClaw Prime Agent Coordination

This is the canonical coordination protocol for every AI agent working on this private OpenClaw Prime fork. It applies across Cursor, Codex, and ChatGPT; local and cloud execution; every machine and app surface; and every Orchestrator, Lisa, or Feature role.

This document coordinates repository work. It does not replace Git history, runtime evidence, or LiNKbrain's future institutional-memory role.

## Two-Stage Model

### Stage 1: Repository-local coordination now

Until OpenClaw Prime is wired as a live LiNKbrain consumer, coordination uses:

- `docs/current-status.md` as the orchestrator-maintained summary dashboard.
- `docs/agent-sessions/active/` for one unique record per active session.
- `docs/agent-sessions/completed/` for closed session records.
- `docs/handoffs/` for append-only end-of-session evidence.

Unique session files are authoritative for session ownership. The dashboard is a summary and may lag behind an individual record.

Stage 1 is repository-local. It does not promise automatic synchronization between separate machines, cloud sandboxes, mobile apps, or clones. Git remains the source-control transport for task branches, but GitHub is not the live coordination database.

### Stage 2: LiNKbrain integration later

LiNKbrain will become the shared institutional-memory layer after OpenClaw Prime is wired as a live consumer:

- Agents read curated canonical knowledge from `lbrain.knowledge`.
- Agents append findings with provenance to `lbrain.team_memory`.
- The Librarian promotes clean findings with version history and escalates conflicts or uncertainty to Carlos.

Do not claim this integration is live until it is implemented and verified. LiNKbrain currently provides knowledge and team-memory contracts, not a live branch lock or active-session registry. Repository session records remain the active-work authority unless LiNKbrain later adds an explicit coordination capability.

## Agent Topology

Every platform-machine-surface instance has three peer roles:

1. **Orchestrator**: coordinates work for that exact instance, reviews its Lisa and Feature records, maintains the local dashboard, and resolves or escalates overlap.
2. **Lisa**: works only on Lisa-specific profile, workspace, behavior, runtime, or deployment tasks explicitly assigned by Carlos.
3. **Feature**: implements general OpenClaw Prime features that are not owned by a single profile.

Examples of separate instances include Cursor Desktop on MacBook Black over SSH, Cursor agents-window execution on Mac Mini, Codex Desktop on Mac Mini, and ChatGPT on iOS. Local and cloud agents are different execution surfaces even when launched from the same device.

There is no automatic hierarchy above these platform-machine Orchestrators. They are peers unless Carlos explicitly designates a wider authority. The Librarian curates knowledge; it is not a repository-work Orchestrator.

Each Orchestrator designates one stable local **coordination home** for its instance. This is the checkout containing the dashboard and authoritative local session records. Lisa and Feature agents may do task work in separate worktrees or clones, but they write only their unique session record into the coordination home. They must not switch its branch or modify unrelated files there.

## Required Identity

Every session record must state:

| Field             | Allowed or expected value                                                                                         |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| Agent type        | `Cursor Local Agent`, `Cursor Cloud Agent`, `Codex Desktop Agent`, or `ChatGPT Work Agent`                        |
| Platform          | `Cursor`, `Codex`, or `ChatGPT`                                                                                   |
| Machine           | Stable label such as `macbook-black`, `macbook-silver`, `mac-mini`, `ios`, or `cloud`                             |
| Surface           | Precise origin such as `desktop-ssh-workspace`, `desktop-workspace`, `agents-window`, `ios-app`, or `cloud-agent` |
| Execution         | `local` or `cloud`                                                                                                |
| Role              | `orchestrator`, `lisa`, or `feature`                                                                              |
| Orchestrator key  | Stable key for the matching platform-machine-surface Orchestrator                                                 |
| Coordination home | Repository root designated by that Orchestrator for local coordination records                                    |
| Session ID        | `<agent-type-slug>-YYYYMMDD-HHMM`, using Asia/Taipei time                                                         |

Make the slug specific enough to avoid collisions. Preferred shape:

```text
<platform>-<execution>-<machine>-<surface>-<role>-YYYYMMDD-HHMM
```

Example:

```text
codex-local-mac-mini-desktop-workspace-feature-20260723-1430
```

Legacy session IDs created before this protocol remain valid and must not be renamed silently.

## Start a Session

Before substantive work:

1. Read `AGENTS.md` and every scoped `AGENTS.md` that owns the expected files.
2. Read `docs/agent-briefing.md`, this protocol, `docs/current-status.md`, every active session record that could overlap, and recent relevant handoffs.
3. Inspect fresh Git branch, status, remotes, worktrees, stashes, and recent history.
4. Choose the exact platform, machine, surface, execution mode, role, Orchestrator key, and session ID.
5. Create only your own file at `<coordination-home>/docs/agent-sessions/active/<session-id>.md` from `docs/agent-sessions/TEMPLATE.md`.
6. Declare the objective, branch, exact ownership scope, expected files, pre-existing changes, and overlap risk.
7. Stop and coordinate if another active record owns the same branch, files, runtime, profile, service, credentials, deployment path, or functional area.

Only Orchestrators update `docs/current-status.md`. Lisa and Feature agents update their own session files and handoffs instead of editing the shared dashboard.

## Update the Orchestrator

Agents that can access the coordination home update their own session record there at material milestones, even when their task code lives in another worktree. The matching Orchestrator re-reads active records:

- Before assigning work.
- Before editing shared files.
- At material milestones.
- Before merging, pausing, or ending work.

There is no guaranteed automatic notification between independently created Codex, Cursor, or ChatGPT conversations. Native task/thread messaging may be used when available, but it does not replace the written record.

If an agent cannot write the coordination home, such as some cloud or mobile surfaces, it must return a **Coordination Relay** to its matching Orchestrator:

```text
Coordination Relay
Session ID:
Identity:
Role:
Objective:
Branch or remote task reference:
Files or systems owned:
Status:
Decisions:
Validation:
Risks or blockers:
Exact next action:
```

The Orchestrator records the relay without inventing missing facts and labels it as relayed rather than directly verified.

## Branch Ownership

- Use one branch per task, not one permanent branch per agent.
- Preferred names:
  - `feature/<feature>/<session-id>`
  - `fix/<area>/<session-id>`
  - `profile/lisa/<task>/<session-id>`
  - `profile/david/<task>/<session-id>`
  - `docs/<task>/<session-id>`
- An Orchestrator normally coordinates and reviews; it does not implement unrelated Feature or Lisa work on its coordination branch.
- Use separate worktrees or clones when simultaneous agents would otherwise share a checkout.
- Keep the coordination home's branch stable. Task worktrees may change only their own branches.
- Never switch a shared checkout's branch while another session is active there.
- Never commit, stage, merge, rebase, cherry-pick, reset, discard, or rewrite another session's work without Carlos's explicit authorization.
- A Lisa branch contains Lisa-specific work only. A Feature branch contains reusable OpenClaw Prime behavior and must not silently embed Lisa-only policy.
- Documentation records describe ownership; they do not grant permission to merge or deploy.

## During Work

Update only your session record when any of these occurs:

- Scope or owned files change.
- A material decision is made.
- Validation completes or fails.
- A blocker or overlap appears.
- Work pauses, changes hands, or approaches context loss.

Record verified facts, inferences, unknowns, and untested behavior separately. Do not include secrets, credential values, private memory, messages, emails, or unrelated personal data.

## End or Hand Off a Session

Before ending or pausing material work:

1. Re-run Git status and inspect the final diff.
2. Run the narrowest relevant validation.
3. Create `docs/handoffs/<taipei-date>-<taipei-time>-<agent-slug>-<task>.md` from `docs/handoffs/TEMPLATE.md`.
4. Update the session record with final status and the handoff path.
5. Move the session record from `active/` to `completed/` without rewriting its history.
6. Ask the matching Orchestrator to refresh `docs/current-status.md`.

Handoffs are append-only. Correct an earlier handoff only through a dated amendment that identifies the incorrect statement, corrected fact, reason, author, and evidence.

## Orchestrator Duties

Each platform-machine-surface Orchestrator must:

- Review active session records before assigning or beginning work.
- Ensure its Lisa and Feature agents use separate scopes and task branches.
- Maintain `docs/current-status.md` as a concise summary, not a duplicate of every session record.
- Mark stale or unreachable sessions as unknown, never silently completed.
- Preserve relayed versus directly verified provenance.
- Resolve local overlap or escalate it to Carlos.
- Review handoffs and validation before recommending merge, deployment, or runtime changes.
- Avoid claiming cross-machine awareness during Stage 1 unless evidence was explicitly relayed or imported.

## LiNKbrain Migration Boundary

When Carlos authorizes the Stage 2 integration, the implementation must define and verify:

- OpenClaw Prime as a real `@linktrend/lbrain-runtime` consumer.
- Program and provenance fields for every appended finding, including agent, session, role, machine/surface, and branch or run reference.
- Which repository decisions qualify as team-memory findings.
- How agents read canonical knowledge during onboarding without loading irrelevant private content.
- Failure behavior when LiNKbrain is unavailable.
- Redaction and organization scope.
- The exact boundary between durable knowledge and live work coordination.

Until that work is complete, do not write credentials, create live integrations, or represent repository session files as globally synchronized.
