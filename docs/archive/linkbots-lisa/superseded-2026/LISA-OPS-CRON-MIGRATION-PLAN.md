# Lisa Ship/Pull — later live cron migration plan

**Do not apply this plan in the repository-only task.** No changes to `~/.openclaw-lisa`, LaunchAgents, or live cron.

**Candidate-only / non-live default (fail-closed):** Cron mutation, profile sync, and credential use against live Lisa are opt-in. Defaults in `linkbots/lisa/ops/ship-pull-contract.ts` (`LISA_OPS_LIVE_ACTION_DEFAULTS`) keep `cronMutationAllowed` / `liveLisaTargetingAllowed` / `credentialsLanguageSeparatelyApproved` false. Live action requires explicit live targeting **and** separately approved credentials language in docs/contracts.

## Hard deploy gate (ordered — all required)

This Lisa ops packet **must not** be deployed before:

1. **`sessions_wait` core path** is present and proven (`LISA-OPS-CORE-PREREQUISITE.md` — registry persist + deadline; no `sessions_yield` / polling).
2. **PR #38** (or successor) lands into the agreed integration branch.
3. Combined bounded tests green (including `lisa-ops.test.ts` allowlist / fail-closed coverage).
4. Separately approved credentials language is recorded in docs/contracts.
5. Carlos explicitly opts in to live Lisa targeting + one controlled live rollout.

There is **no** option to deploy personality/cron updates and invent Clear outcomes without `sessions_wait` allowlists and validated child outcomes.

## Jobs to update (in place — keep IDs) — only after the gate above

| Job            | Action | Message / allowlist changes                                                                                                                                                            |
| -------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lisa-ship-05` | Update | Point at new `agents/ship-pull-clock.md` Ship 05; checkpoint-only wording; `toolsAllow` = spawn + **`sessions_wait`** + apply_patch/read/write/edit/exec; **exclude** `sessions_yield` |
| `lisa-pull-07` | Update | Same for Pull 07 + frozen-tip skip                                                                                                                                                     |
| `lisa-ship-16` | Update | Same as Ship 05                                                                                                                                                                        |
| `lisa-pull-18` | Update | Same as Pull 07                                                                                                                                                                        |

Digest / heartbeat jobs stay non-spawning (omit `sessions_spawn` / `sessions_wait`).

## Jobs to retain unchanged (until separate opt-in)

| Job                                           | Notes                                                                                               |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `lisa-morning-digest`                         | Retain; after personality deploy, digest picks up Staging 10:00 / Review Packager / Approve wording |
| `lisa-heartbeat-45`                           | Retain; same                                                                                        |
| `battery-selfie-1745` / `battery-selfie-2145` | Retain                                                                                              |
| `battery-monitor-alert-35`                    | Retain (event-driven)                                                                               |

## Jobs / messages to remove

| Item                                                                                    | When                                                  |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Any residual `lisa-ship-a` / `lisa-pull-a` / `lisa-ship-06` / `lisa-pull-08` duplicates | After verifying canonical four jobs                   |
| Cron message text that says “open or update a PR” or “request Bugbot”                   | On update of the four Ship/Pull jobs                  |
| Cron guidance that requires `sessions_yield` after ACP                                  | On update; replace with `sessions_wait` Wait contract |

## Deploy order (later, with Carlos approval — after hard gate)

1. Confirm `sessions_wait` is live and proven; Ship/Pull allowlists include it and exclude yield.
2. Confirm integration head; combined tests green.
3. Confirm separately approved credentials language + explicit live targeting opt-in.
4. Merge/deploy personality files to Lisa workspace (mirror) — **not** from candidate-only packets without gate.
5. `cron edit` each of the four Ship/Pull jobs’ messages + tool allowlists.
6. Verify with `cron list --json` (no Telegram force-run unless Carlos wants it).
7. Confirm first Clear/Issues includes status CAS + email + final payload.

## Personality deploy paths (mirror)

- `agents/ship-pull-clock.md`, `pipeline-status.md`, `morning-digest.md`, `repair-dispatcher.md`, `offline-recovery.md`
- `HEARTBEAT.md`, `AGENTS.md`, `tools/cursor-acp.md`
- `Personality files/templates/*` → workspace `templates/` (canonical message bodies)
- `memory/pipeline-status.md` (template only — do not clobber live undated status without migrate)
- `linkbots/lisa/ops/render-template.ts` + `templates.ts` → workspace `ops/` (Lisa-executable renderer)
- **Do not deploy** `*.test.ts` or other test files

Live render (cwd = `/Users/linktrend/.openclaw-lisa/workspace`):

```bash
node --experimental-strip-types ops/render-template.ts <kind> <json-path>
```

See `Personality files/PERSONALITY_WORKFLOW.md` Safe Deploy Workflow for full copy commands.
