# Repository and Agent Handover Briefing

## Document Metadata

| Field              | Value                                                                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Created            | 2026-07-23 10:12 Asia/Taipei                                                                                                                                            |
| Last updated       | 2026-07-23 12:36 Asia/Taipei                                                                                                                                            |
| Created by         | Cursor Local Agent `cursor-local-20260723-1012`                                                                                                                         |
| Last updated by    | Codex Desktop Agent `codex-desktop-agent-20260723-1110`                                                                                                                 |
| Repository         | /Users/linktrend/Projects/openclaw_prime                                                                                                                                |
| Branch             | docs/initial-agent-handoff-20260723                                                                                                                                     |
| Commit             | ed4b348d889e1a31da8ec90d13c3508127fd71a6                                                                                                                                |
| Task scope         | Documentation-only repository briefing plus the two-stage multi-platform coordination system                                                                            |
| Runtime inspection | Read-only. No application code, runtime config, services, credentials, deployment settings, or functional files were modified.                                          |
| Secret handling    | Secret values, tokens, private memory contents, emails/messages, and unrelated private data are intentionally omitted. Sensitive locations are named only as locations. |

## 1. Executive Summary

`openclaw_prime` is Carlos's local fork of upstream OpenClaw and currently powers Lisa's Mac mini runtime through the live profile at `~/.openclaw-lisa`. The repository is a large TypeScript/Node monorepo with companion apps, plugins, gateway runtime, docs, tests, Docker assets, and OpenClaw CLI entrypoints.

The active Lisa runtime is not the same thing as the repo workshop copy. Verified source priority for future agents is:

1. Verified runtime/current active config.
2. Repo code.
3. `docs/agent-briefing.md`.
4. `docs/agent-coordination.md`.
5. Authoritative records in `docs/agent-sessions/active/`.
6. `docs/current-status.md` summary dashboard.
7. Recent handoffs in `docs/handoffs/`.
8. `README.md`.
9. Other docs.
10. Prior chats/memory.

The current runtime is reachable on loopback port `18790`, launched by the `ai.openclaw.lisa` LaunchAgent, and the channel-status command reports Google Chat and Telegram configured/running. Health verification is intentionally scoped: the listener and HTTP endpoint respond, the LaunchAgent is active, and channel status succeeds. Fast status skipped probes and security audit, did not check memory, reported 17 task issues plus one audit warning, and emitted a failed shared-state schema-migration check because the SQLite database was locked. This is not evidence of full runtime, memory, task, or security health.

## 2. Repository Locations and Sources of Truth

| Path                                                           | Purpose                                        | Source of Truth?                     | Safe to Edit?                                   | Committed?                           | Notes                                                                                                                    |
| -------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------ | ----------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `/Users/linktrend/Projects/openclaw_prime`                     | OpenClaw fork and engine repo powering Lisa    | Yes for repo code and docs           | Yes, on task branch, with normal Git discipline | Yes, except current uncommitted work | Current task branch is `docs/initial-agent-handoff-20260723`.                                                            |
| `/Users/linktrend/.openclaw-lisa`                              | Live Lisa profile root                         | Yes for runtime state/config         | No for this task                                | No                                   | Read-only inspection only. Contains config, logs, state, credentials locations, service wrappers, workspaces.            |
| `/Users/linktrend/.openclaw-lisa/openclaw.json`                | Live Lisa OpenClaw config                      | Yes for active config                | No for this task                                | No                                   | Contains secret references and auth config; values redacted in this briefing.                                            |
| `/Users/linktrend/.openclaw-lisa/workspace`                    | Live Lisa personality/workspace                | Yes for active Lisa instructions     | No for this task                                | No                                   | Contains AGENTS, HEARTBEAT, IDENTITY, MEMORY, SOUL, TOOLS, USER, tools, studio, memory. Private contents not reproduced. |
| `/Users/linktrend/.openclaw-lisa/workspace-local-coder`        | Dedicated local-coder workspace                | Yes for local-coder runtime behavior | No for this task                                | No                                   | Uses local `ollama/qwen3.5:9b` by profile config.                                                                        |
| `/Users/linktrend/Library/LaunchAgents/ai.openclaw.lisa.plist` | macOS LaunchAgent for Lisa                     | Yes for service launch               | No for this task                                | No                                   | Verified loaded and running.                                                                                             |
| `/Users/linktrend/Library/Logs/openclaw/gateway-lisa.log`      | LaunchAgent stdout log target                  | Runtime evidence                     | No for this task                                | No                                   | Location only; contents not reproduced.                                                                                  |
| `linkbots/`                                                    | Per-bot workshop mirror                        | No, unless synced deliberately       | Yes with care                                   | Untracked at task start              | README states live runtime remains under `~/.openclaw-*`.                                                                |
| `linkbots/lisa/Personality files/openclaw.json`                | Repo snapshot of Lisa config                   | No when it differs from live         | Yes with care                                   | Untracked at task start              | Differs from live in `agents`, `gateway`, `meta`, `skills`.                                                              |
| `linkbots/david/README.md`                                     | David placeholder workshop                     | No active runtime yet                | Yes with care                                   | Untracked at task start              | Reserved for future `~/.openclaw-david`.                                                                                 |
| `docs/agent-coordination.md`                                   | Canonical multi-platform coordination protocol | Yes for agent workflow               | Yes, by authorized documentation task           | Created by follow-up task            | Defines repository-local Stage 1 and future LiNKbrain Stage 2.                                                           |
| `docs/agent-sessions/active/`                                  | Unique active session records                  | Yes for session ownership            | Each agent edits only its own record            | Created by follow-up task            | Read for overlap before work.                                                                                            |
| `docs/current-status.md`                                       | Orchestrator-maintained coordination dashboard | Summary only                         | Orchestrators only                              | Created by this task                 | May lag individual session records.                                                                                      |
| `docs/handoffs/`                                               | Append-only agent handoffs                     | Yes for recent session transfer      | Add only; amend by dated correction             | Created by this task                 | Do not rewrite history except to add corrections.                                                                        |

## 3. Git and Upstream Relationship

Verified Git state at start:

- Starting branch: `dev/minicodex/WP-01`.
- Dedicated branch created: `docs/initial-agent-handoff-20260723`.
- HEAD commit: `ed4b348d889e1a31da8ec90d13c3508127fd71a6`.
- Remotes: `origin` = `https://github.com/linktrend/openclaw_prime.git`; `upstream` = `https://github.com/openclaw/openclaw.git`.
- `origin/main`, local `main`, `dev/minicodex/WP-01`, and the docs branch all point at `ed4b348d889` before documentation edits.
- Worktree list contains only `/Users/linktrend/Projects/openclaw_prime`.
- Stash list contains `stash@{0}: On main: wip-auth-unrelated`.
- Pre-existing uncommitted application changes were present before this task and were preserved.

Upstream and fork findings:

- `origin/main...HEAD`: 0 ahead / 0 behind before this task.
- `origin/development...HEAD`: 0 left / 16 right. Those 16 commits are the fork's selective local-coder, exec-denylist, Control UI delivery, CI, and Cursor ACP changes and merge commits.
- The repository is explicitly shallow: `git rev-parse --is-shallow-repository` returned `true`, `.git/shallow` contains 422 boundary commits, and the exact `upstream/main` tip `bc76bb893379c21fd86134e5ca5521833a69daa7` is one of those boundaries. This is why `git merge-base HEAD upstream/main` has no result and triple-dot diffs fail. The configured upstream URL and fetch refspec are correct; this evidence does not indicate the wrong remote or branch, and it does not establish unrelated histories.
- `git rev-list --left-right --count upstream/main...HEAD` reported `1 441`, but that count is only the disconnected shallow object graph currently available and must not be interpreted as meaningful full-history fork divergence.
- `git merge-base HEAD origin/main` is `ed4b348d889e1a31da8ec90d13c3508127fd71a6`.
- `git merge-base HEAD origin/development` is `9fbe75bc20a8e48ad05badebad65ba495cc9769e`.
- `git merge-base HEAD upstream/main` produced no merge-base output in this checkout.

Recent fork commits visible in `origin/development..HEAD` include local/fork work on exec approvals denylist, local-coder lifecycle, Control UI delivery review, and Cursor ACP Grok model mapping. This origin-relative range is the reliable local evidence for the selective 16-commit divergence; `upstream/main..HEAD` is not reliable while history remains shallow.

## 4. Changes from Upstream OpenClaw

Facts verified from Git and files:

- The fork has local branches for exec approvals denylist backport, Cursor ACP Grok preferences, Control UI delivery review fixes, local-coder lifecycle fixes, and staging/development branches.
- The current branch is equal to `origin/main` before this documentation work.
- Upstream comparison is limited because this is a shallow clone and the current `upstream/main` tip is itself a shallow boundary. Do not use triple-dot upstream diffs or the reported 1/441 count as authoritative until history is deepened or unshallowed.
- Uncommitted pre-existing application changes affect ACP model/runtime tests and exec approvals denylist code. They are not part of this documentation task.
- `linkbots/` is intentionally part of this private fork's design as Carlos-requested per-bot workshop content and is currently untracked. `linkbots/README.md` says live runtime remains under `~/.openclaw-*`, not the workshop folder. Whether to commit the workshop content is still pending; its repository ownership is not an open architectural question.

Key architectural differences from stock upstream, inferred from fork files and runtime evidence:

- Lisa is launched from this fork's `openclaw.mjs` through `~/.openclaw-lisa/gateway-service-wrapper.sh`, not the global Homebrew/npm `openclaw` package.
- Lisa uses profile `lisa`, port `18790`, Google Chat and Telegram channels, OpenRouter, Ollama, ACPX/Cursor, device-pair, and local-coder agents.
- The fork has a dedicated local-coder pathway and exec approval denylist work relevant to Lisa's operations.

## 5. System Architecture

Verified text architecture diagram:

```text
Carlos surfaces
  |-- Telegram DM / paired channels
  |-- Google Chat
  |-- Control UI http://127.0.0.1:18790
  |-- iPhone / device-pair plugin
        |
        v
macOS LaunchAgent ai.openclaw.lisa
  program: /bin/sh ~/.openclaw-lisa/service-env/ai.openclaw.lisa-env-wrapper.sh ... gateway --port 18790
        |
        v
node /Users/linktrend/Projects/openclaw_prime/openclaw.mjs gateway
        |
        +-- Live config: ~/.openclaw-lisa/openclaw.json
        +-- Live workspace: ~/.openclaw-lisa/workspace
        +-- State DBs/logs: ~/.openclaw-lisa/state, ~/.openclaw-lisa/agents/*, logs
        +-- Channels: Telegram, Google Chat
        +-- Model providers: OpenRouter, Ollama, ACPX/Cursor
        +-- Agents:
              main        -> Lisa default chat, sandbox.mode inherited non-main
              lisa-cron   -> scheduled trusted ops, sandbox.mode off
              cursor      -> ACP Cursor agent via cursor-agent acp
              local-coder -> isolated local Qwen 9B coding worker
```

Repo architecture:

- `src/`: core gateway, agents, sessions, config, CLI, cron, security, channels, runtime code.
- `extensions/`: bundled and external-style plugin/channel/provider packages.
- `packages/`: shared packages such as gateway protocol and tool repair.
- `ui/`: Control UI.
- `apps/`: native/mobile apps.
- `docs/`: source docs, now also containing private coordination docs required by this task.
- `scripts/`: build/test/release/dev tooling.
- `test/` and `qa/`: unit, integration, e2e, and scenario tests.
- `linkbots/`: intended per-bot workshop copies and planning docs in this private fork; currently untracked and never the live runtime.

## 6. Installation and Runtime Environment

Verified package/runtime facts:

| Component             | Evidence                                                                                                                 | Notes                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node in shell         | `/opt/homebrew/bin/node`, `v26.5.0`                                                                                      | Shell Node satisfies repo engines because >=25.9.0 is allowed.                                                                                           |
| Node for Lisa scripts | `start-lisa.sh` puts `/opt/homebrew/opt/node@24/bin` first                                                               | Status reports runtime Node `24.18.0`.                                                                                                                   |
| Package manager       | `pnpm 11.2.2`; packageManager pins `pnpm@11.2.2+sha512...`                                                               | Use pnpm, do not swap package managers.                                                                                                                  |
| npm                   | `11.17.0`                                                                                                                | Global package exists but Lisa runs fork launcher.                                                                                                       |
| Bun                   | Not found in shell                                                                                                       | Repo still has Bun compatibility guidance, but not installed here.                                                                                       |
| OpenClaw global CLI   | `/opt/homebrew/bin/openclaw`, `OpenClaw 2026.7.1-2 (0790d9f)`                                                            | Global service status points to an older/non-loaded generic gateway and is not Lisa source of truth.                                                     |
| Lisa launcher         | `node /Users/linktrend/Projects/openclaw_prime/openclaw.mjs`                                                             | Verified in `status-lisa.sh`, `start-lisa.sh`, and LaunchAgent wrapper.                                                                                  |
| Docker sandbox image  | `openclaw-sandbox:bookworm-slim`, image id `sha256:356d...`, created 2026-07-14                                          | Image is present; one container from it was running during the review. Image/container presence alone does not mean every agent or session is sandboxed. |
| Ollama                | `/usr/local/bin/ollama`; models include `qwen3.5:9b`, `qwen3.5:4b`, `qwen2.5-coder:7b`, `gemma4:e2b`, `nomic-embed-text` | Local-coder uses Qwen 9B; memory embeddings use `nomic-embed-text`.                                                                                      |
| Cursor agent          | `/Users/linktrend/.local/bin/cursor-agent`, version `2026.07.09-a3815c0`                                                 | ACP Cursor configured through ACPX.                                                                                                                      |

Core repo commands verified from `package.json` and root `AGENTS.md`:

```bash
pnpm install
pnpm dev
pnpm openclaw ...
pnpm build
pnpm check
pnpm check:docs
pnpm test
pnpm test:changed
pnpm format:docs
pnpm lint:docs
pnpm docs:list
```

Docs-only validation normally needs `git diff --check` plus relevant doc sanity. Full docs checks can be expensive and may require dependencies.

## 7. Configuration Model

| Configuration File or Location                      | Scope                           | Purpose                                                          | Committed?              | Contains Secrets?                              | Restart Required?                                                           |
| --------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------- | ----------------------- | ---------------------------------------------- | --------------------------------------------------------------------------- |
| `package.json`                                      | Repo                            | Package metadata, scripts, engines, dependencies                 | Yes                     | No                                             | No for docs; yes after dependency/runtime changes                           |
| `pnpm-workspace.yaml`                               | Repo                            | Workspace packages and pnpm policy                               | Yes                     | No                                             | No                                                                          |
| `docs/AGENTS.md`                                    | Docs subtree                    | Docs authoring rules                                             | Yes                     | No                                             | No                                                                          |
| `AGENTS.md`                                         | Repo root                       | Agent rules and coordination protocol                            | Yes                     | No                                             | No                                                                          |
| `~/.openclaw-lisa/openclaw.json`                    | Live Lisa profile               | Gateway, agents, channels, models, tools, plugins, UI, auth refs | No                      | Yes or secret references                       | Usually hot reload, but restart may be required for service/plugin metadata |
| `~/.openclaw-lisa/.env`                             | Live Lisa profile               | Runtime environment secrets/settings                             | No                      | Yes                                            | Yes for LaunchAgent/runtime process env                                     |
| `~/.openclaw-lisa/service-env/ai.openclaw.lisa.env` | LaunchAgent env                 | Service environment                                              | No                      | Possibly                                       | Yes                                                                         |
| `~/.openclaw-lisa/gateway-service-wrapper.sh`       | LaunchAgent wrapper             | Forces Node 24 path and fork launcher                            | No                      | No                                             | Yes                                                                         |
| `~/Library/LaunchAgents/ai.openclaw.lisa.plist`     | macOS user service              | Launches Lisa gateway                                            | No                      | Possibly paths/env only inspected              | Yes, reload/restart service                                                 |
| `~/.config/gws/`                                    | Google Workspace OAuth for Lisa | gws credentials/config                                           | No                      | Yes                                            | Depends on command; never modify without Carlos                             |
| `~/.config/gws-carlos-tasks/`                       | Carlos Tasks OAuth              | Separate Tasks wrapper credentials/cache                         | No                      | Yes                                            | Depends on command; never modify without Carlos                             |
| `~/.cursor/` and macOS Keychain locations           | Cursor Agent/IDE auth           | Cursor CLI/IDE auth state                                        | No                      | Yes                                            | Re-login/restart may be needed; never query Keychain here                   |
| `linkbots/lisa/Personality files/openclaw.json`     | Workshop snapshot               | Review/edit copy of Lisa config                                  | Untracked at task start | Should not contain secrets; scan before commit | Only after synced live and gateway reload/restart                           |

OpenClaw docs state default config is `~/.openclaw/openclaw.json`, accepts strict schema, rejects unknown/malformed config, and recommends `openclaw doctor` / `doctor --fix` for validation and repair. Lisa uses the `lisa` profile root instead.

## 8. Lisa Profile Configuration

Verified live `~/.openclaw-lisa/openclaw.json` top-level keys: `acp`, `agents`, `channels`, `commands`, `diagnostics`, `gateway`, `meta`, `plugins`, `session`, `skills`, `tools`, `ui`, `wizard`.

Key facts, with secret values redacted:

- Gateway: local mode, loopback bind, port `18790`, auth token configured, Tailscale mode off, selected allowed origins include localhost and a Tailscale HTTPS host.
- Control UI: `dangerouslyDisableDeviceAuth: true` is present in live config. Treat as an accepted local runtime tradeoff, not a pattern for new deployments.
- Channels: Telegram enabled, Google Chat enabled. Both use pairing/group allowlist policies in config. Telegram token and Google service account values are not reproduced.
- Default agent model stack: primary `openrouter/qwen/qwen3.6-plus`, fallbacks `openrouter/deepseek/deepseek-v4-pro` and `ollama/qwen3.5:9b`.
- Memory search: provider `ollama`, model `nomic-embed-text`.
- Default sandbox: `mode: non-main`, `scope: agent`, `workspaceAccess: rw`, Docker image `openclaw-sandbox:bookworm-slim`.
- Agent list includes at least `main`, `lisa-cron`, `cursor`, and `local-coder`.
- `lisa-cron` has `sandbox.mode: off` and broader trusted tool access for scheduled ops.
- `cursor` uses ACP runtime through `cursor-agent acp` and model `grok-4.5[effort=high,fast=true]`.
- `local-coder` uses `ollama/qwen3.5:9b`, restricted tools, and `~/.openclaw-lisa/workspace-local-coder`.
- Live config and repo workshop config are not identical; differences exist in `agents`, `gateway`, `meta`, and `skills`.

Sandbox semantics: Docker is the configured backend for sessions to which `sandbox.mode: non-main` applies; Docker is not synonymous with the whole Lisa runtime. The main session runs on the host because it is the main session, while `lisa-cron` explicitly bypasses sandboxing with `mode: off`. Other non-main sessions inherit the Docker-backed default unless a narrower override applies. A running sandbox container proves active sandbox use at the check time, not which specific session owns it.

## 9. Lisa’s Operating Workflows

Verified from `linkbots/lisa/Personality files/AGENTS.md`, `TOOLS.md`, `HEARTBEAT.md`, `IDENTITY.md`, and runtime config:

- Lisa's role is strategic operations and execution lead, orchestrator first.
- For coding work when Carlos says to use Cursor, Lisa must spawn Cursor ACP with agent `cursor`, not self-write or silently substitute another agent.
- Cursor ACP model ID on this machine is `grok-4.5[effort=high,fast=true]`.
- Local-coder route is mandatory when Carlos asks for a local model/local coder or names `ollama/qwen3.5:9b`/`q9` for coding.
- Local-coder runs in an isolated workspace and must not fall back to `ollama run` shell shortcuts.
- Google Workspace operations must use `tools/bin/lisa-safe` and never improvised `gws auth` or `gws keep` commands.
- Carlos Tasks uses a separate wrapper `tools/bin/lisa-carlos-tasks` and separate OAuth config location.
- Heartbeats are cron-based wall-clock jobs, not native `heartbeat.every` loops.
- Main chat uses `session.dmScope: main`; Telegram DM and Web UI main route to the same default main session.
- Current cron declarations all use `sessionTarget: isolated`. `lisa-heartbeat-45`, `lisa-morning-digest`, and `lisa-calendar-check` target agent `lisa-cron`; the two battery-selfie jobs target `main`; `apply-patch-tripwire` has no explicit agent ID. All except the tripwire announce to an explicit Telegram target whose recipient identifier is intentionally redacted; the tripwire requests no delivery.

## 10. Memory, State, Logs, and Data

Important locations, values redacted:

- `~/.openclaw-lisa/state/`: shared runtime state.
- `~/.openclaw-lisa/state/openclaw.sqlite`: shared SQLite state store.
- `~/.openclaw-lisa/agents/*/agent/`: per-agent state and SQLite stores.
- `~/.openclaw-lisa/agents/*/sessions/`: per-agent session histories.
- `~/.openclaw-lisa/workspace/MEMORY.md`: curated memory index for main session.
- `~/.openclaw-lisa/workspace/memory/`: daily and operational memory files. Contents are private and not reproduced here.
- `~/.openclaw-lisa/workspace/studio/`: venture/work briefings. Contents are private and not reproduced here.
- `~/.openclaw-lisa/gateway.log`, `gateway.log.prevrun`, `~/Library/Logs/openclaw/gateway-lisa.log`: gateway logs.
- `~/.openclaw-lisa/tripwire/alerts.log`: direct apply/edit tripwire alerts for Lisa main session.
- `~/.openclaw-lisa/workspace/scratch/`: scratch and generated working files, may contain private drafts and emails.

Do not quote private memory, email, message, or scratch content in handoffs. Mention path/type and verification status only.

## 11. Security and External-Action Controls

Verified controls and risks:

- Never run macOS `security` commands or query Keychain without Carlos's explicit approval. This session did not run any `security` command.
- Credential locations exist under `~/.openclaw-lisa`, `~/.config/gws`, `~/.config/gws-carlos-tasks`, Cursor auth storage, and possibly LaunchAgent env files. Values must never be printed or committed.
- Lisa's live config has gateway auth token configured and channels enabled. Tokens are redacted.
- Telegram and Google Chat DM/group policies are configured as pairing/allowlist patterns.
- `lisa-cron` is trusted host ops: sandbox off, explicit cron `agentId`, no channel bindings. Treat it as a privileged local automation identity.
- Main chat stays protected by `sandbox.mode: non-main`; do not set `main.tools.exec.host: gateway` without explicit Carlos approval and a tested rollback.
- gws auth/logout/status/reauth/setup are prohibited for Lisa; Carlos handles interactive reauth.
- Google Keep via CLI is documented as not working in this setup; do not retry auth/Keep paths blindly.
- External actions such as sending email, posting public comments, editing live config, changing LaunchAgents, or modifying credentials require explicit authorization.

## 12. Testing and Verification

Verification performed in this session:

| Check                                       | Method                                                          | Result                          | Notes                                                                                                                                                                                       |
| ------------------------------------------- | --------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Git branch/status/remotes/worktrees/stashes | `git status`, `branch`, `remote`, `worktree`, `stash`           | Pass                            | Dirty pre-existing application changes preserved.                                                                                                                                           |
| Fork/upstream relationship                  | `git log`, `merge-base`, `rev-list`, diff attempts              | Partial                         | No merge-base with `upstream/main` in this checkout; document limitation.                                                                                                                   |
| Runtime service state                       | filtered `launchctl print`, `lsof`, loopback HTTP check         | Pass for process/listener scope | LaunchAgent running, pid observed, gateway listening and HTTP endpoint reachable.                                                                                                           |
| Gateway fast status                         | `~/.openclaw-lisa/status-lisa.sh`                               | Partial                         | Gateway reachable; probes/security skipped and memory not checked. It also reported 17 task issues, one audit warning, and a locked-database warning during a shared-state migration check. |
| Channel status                              | fork CLI `--profile lisa channels status`                       | Pass                            | Google Chat and Telegram configured/running; Telegram connected.                                                                                                                            |
| Cron list                                   | fork CLI `--profile lisa cron list --json`, redacted projection | Pass                            | Six declarations verified with isolated session targets, agent IDs, delivery modes, and recipient identifiers omitted.                                                                      |
| Docker sandbox                              | `docker image inspect` and filtered `docker ps`                 | Pass for presence only          | Image present and one matching container running; this does not prove universal sandboxing.                                                                                                 |
| Ollama models                               | `ollama list`                                                   | Pass                            | Qwen 9B and embedding model installed.                                                                                                                                                      |
| Cursor agent binary                         | `cursor-agent --version`                                        | Pass                            | Binary present. Authentication not rechecked here.                                                                                                                                          |
| Docs link/path sanity                       | local relative-link and path checks plus final diff review      | Pass                            | README onboarding targets and handoff paths resolve.                                                                                                                                        |

Tests not run:

- Full `pnpm check:docs`, `pnpm test`, build, deep status, security audit. This is documentation-only and the checkout has unrelated dirty app changes.

## 13. Starting, Stopping, Updating, and Recovery

Lisa start/stop/status procedures verified from live scripts:

```bash
zsh ~/.openclaw-lisa/status-lisa.sh
zsh ~/.openclaw-lisa/start-lisa.sh
zsh ~/.openclaw-lisa/stop-lisa.sh
```

Start behavior:

- Ensures Node 24 path first.
- Runs `node /Users/linktrend/Projects/openclaw_prime/openclaw.mjs --profile lisa gateway run --verbose`.
- Checks port `18790`.
- Checks Docker sandbox image `openclaw-sandbox:bookworm-slim`; if sandbox mode requires it and image is missing, startup fails.
- Writes/uses logs under `~/.openclaw-lisa/gateway.log`.

LaunchAgent behavior:

```bash
launchctl print gui/$(id -u)/ai.openclaw.lisa
```

The LaunchAgent currently runs `/bin/sh` through `service-env/ai.openclaw.lisa-env-wrapper.sh`, reads `service-env/ai.openclaw.lisa.env`, and executes `gateway-service-wrapper.sh gateway --port 18790` with working directory `~/.openclaw-lisa`.

Recovery rules:

- Do not edit LaunchAgent, env, live config, or credentials without explicit Carlos approval.
- If runtime status is needed, prefer `status-lisa.sh` and fork CLI `node /Users/linktrend/Projects/openclaw_prime/openclaw.mjs --profile lisa ...`.
- Do not rely on global `openclaw gateway status`; it checks the older generic gateway LaunchAgent on port `18789`, not Lisa's active profile.
- If config validation fails, OpenClaw docs recommend `openclaw doctor` / `doctor --fix`, but do not run repairs without approval.
- For channel tests, use status/probe commands only when Carlos authorizes and avoid sending messages unless explicitly asked.

## 14. Current Work Status

| Item                              | Status                            | Evidence                                                                                        | Next Action                                                 | Risk                                            |
| --------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------- |
| Initial briefing and handoff docs | Completed and accuracy-reviewed   | Branch `docs/initial-agent-handoff-20260723`; session `cursor-local-20260723-1012`              | Carlos may review and decide whether to commit              | Low if docs-only scope maintained               |
| Pre-existing app changes          | Unowned by this task              | Git showed modified TS files before docs branch creation                                        | Preserve and report; do not edit/revert                     | Medium overlap risk                             |
| `linkbots/` workshop              | Pre-existing untracked work       | Git showed `?? linkbots/` before docs task                                                      | Treat as Carlos/runtime workshop, do not overwrite          | Medium if future agents assume clean repo       |
| Lisa runtime                      | Running; limited health scope     | LaunchAgent/listener/HTTP/channel checks pass; fast status has locked-DB and task/audit caveats | Investigate only under a separately authorized runtime task | Medium because deeper health remains unverified |
| Upstream relationship             | Cause of no merge-base identified | Shallow repository; `upstream/main` tip is a listed shallow boundary                            | Deepen/unshallow before upstream merge work                 | Medium for future merge/rebase decisions        |

## 15. Planned David Profile

Facts:

- `linkbots/david/README.md` says David is reserved for the David profile workshop.
- It names future live runtime as `~/.openclaw-david`.
- `~/.openclaw-david` is absent as of the follow-up review.
- No David-specific config, LaunchAgent, channels, or credentials were modified.

Inference:

- David appears to be a placeholder for a future second agent/clone once Lisa's local setup is proven.
- Treat David as planned, not active, until a live profile and LaunchAgent are verified.

## 16. Multi-Agent Development and Handoff Protocol

The canonical procedure is `docs/agent-coordination.md`. Supported agent labels remain:

- `Cursor Local Agent`
- `Cursor Cloud Agent`
- `Codex Desktop Agent`
- `ChatGPT Work Agent`

Every platform-machine-surface instance has three roles: Orchestrator, Lisa, and Feature. The Orchestrator coordinates that exact instance. Lisa owns Lisa-specific work. Feature owns reusable OpenClaw Prime work. Local/cloud execution and desktop, SSH, agents-window, mobile, and cloud surfaces are distinct identities.

Stage 1 is repository-local:

1. Read the root/scoped instructions, this briefing, the coordination guide, dashboard, potentially overlapping active records, and relevant handoffs.
2. Inspect fresh Git state.
3. Create a unique session record from `docs/agent-sessions/TEMPLATE.md`; do not make every worker edit the shared dashboard.
4. Use one task branch and preferably one worktree/clone per simultaneous task.
5. Stop on ownership overlap.
6. Update only your session record at milestones; the matching Orchestrator maintains the dashboard.
7. Agents without canonical repository write access return the standardized Coordination Relay to their matching Orchestrator.
8. End with exact validation, a template-based append-only handoff, and a completed session record.

Stage 2 will use LiNKbrain for canonical knowledge and append-only team-memory findings after live consumer wiring is implemented and verified. LiNKbrain is not currently the branch lock or active-session registry, and Stage 1 does not claim automatic cross-machine synchronization.

## 17. Known Risks and Failure Modes

| Risk                                                            | Likelihood | Impact                           | Evidence                                                                                                        | Mitigation                                                                                               |
| --------------------------------------------------------------- | ---------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Upstream merge-base is unavailable because history is shallow   | High       | High for upstream merges/rebases | Repository reports shallow; `upstream/main` tip is in `.git/shallow`; triple-dot diff has no merge base         | Deepen/unshallow before merge work; document exact commands and results.                                 |
| Pre-existing dirty app changes get overwritten                  | Medium     | High                             | Git status showed six modified TS files before this task                                                        | Do not touch those files; branch per task; status/handoff must call them out.                            |
| Agents collide while editing one dashboard                      | High       | Medium to High                   | A concurrent `docs/current-status.md` edit rejected a later registration patch on 2026-07-23                    | Workers use unique session files; only Orchestrators update the dashboard.                               |
| Stage 1 is mistaken for cross-machine synchronization           | Medium     | High                             | Separate machines/cloud/mobile surfaces do not share an automatic repository-local notification channel         | State provenance; use Coordination Relay; wait for verified LiNKbrain consumer wiring for shared memory. |
| Live profile contains secrets and private data                  | High       | High                             | `.env`, service account JSON, OAuth config dirs, memory/scratch files observed                                  | Redact values; never commit live files; mention locations only.                                          |
| Agents use global OpenClaw CLI/status and inspect wrong service | Medium     | Medium                           | Global `openclaw gateway status` points at generic `ai.openclaw.gateway` on port `18789`; Lisa runs `18790`     | Use `~/.openclaw-lisa/status-lisa.sh` or fork CLI with `--profile lisa`.                                 |
| `lisa-cron` has host-level trusted ops                          | Medium     | High                             | Live config and docs show `sandbox.mode: off` for `lisa-cron`                                                   | Do not change cron/sandbox without approval; keep cron agentId explicit.                                 |
| `main.tools.exec.host` regression breaks channel replies        | Medium     | High                             | Lisa docs repeatedly warn it was rolled back after breaking channel responses                                   | Do not set it; require explicit plan, test, rollback.                                                    |
| Control UI device auth disabled in live config                  | Medium     | Medium to High                   | Live config summary showed `dangerouslyDisableDeviceAuth: true`                                                 | Treat as local accepted state; revisit before exposure/VPS/multi-user.                                   |
| Google OAuth reauth failures invite unsafe commands             | Medium     | Medium                           | Lisa docs prohibit `gws auth ...` after prior failure                                                           | Never run `gws auth`; ask Carlos for manual reauth.                                                      |
| Documentation docs conflict with public docs rules              | Low        | Low                              | `docs/AGENTS.md` says docs should be generic/no local paths; task required local handoff docs                   | Keep these as internal coordination docs and avoid adding to public docs navigation.                     |
| Runtime health overclaimed                                      | Medium     | Medium                           | Fast status skips deep/security probes, says memory not checked, and reported locked-DB plus task/audit caveats | State exact checks only; do not claim deep health/security/task health.                                  |

## 18. Rules for Incoming Agents

- Treat this briefing as a map, not a substitute for fresh verification.
- Start with Git/status/worktree/stash checks.
- Read `docs/agent-coordination.md`, `docs/current-status.md`, potentially overlapping active session records, and the latest relevant handoff before changing files.
- Use one branch per task and do not switch branches in a shared dirty checkout without checking for active work.
- Create and update only your unique session record. Only Orchestrators edit the dashboard.
- Do not modify application code, runtime config, services, credentials, deployment settings, or functional files unless the new task explicitly authorizes it.
- Never run macOS `security` commands, query Keychain, reveal passwords, or alter keychain ACL/unlock state without explicit Carlos approval.
- Never print token values, private memory, emails/messages, OAuth values, or private user data.
- For Lisa runtime, use profile `lisa` and port `18790`; do not confuse it with generic gateway port `18789`.
- Verify runtime health before claiming it.
- Create a dated handoff and completed session record for material work; ask the matching Orchestrator to refresh the dashboard.
- If confidence is below 98%, leave explicit questions for Carlos and the incoming agent.

## 19. Recommended Next Actions

Immediate:

- Review and optionally commit this documentation-only branch. Why: creates coordination baseline before more agents work in the dirty checkout. Evidence: current repo has pre-existing modified app files and untracked `linkbots/`. Dependency: Carlos approval to commit/PR. Risk if deferred: future agents may overwrite or misattribute work.
- Decide whether to commit the intended `linkbots/` workshop content in this private fork. Why: ownership is settled, but the content remains untracked. Evidence: `linkbots/README.md` defines per-bot workshop semantics and Carlos explicitly requested it here. Dependency: Carlos approval to commit. Risk if deferred: future handoffs keep seeing high untracked noise.

Near Term:

- Normalize upstream history or document fetch strategy. Why: no merge-base with `upstream/main` blocks reliable upstream diff. Evidence: `git diff upstream/main...HEAD` failed. Dependency: Git/network policy and time. Risk if deferred: bad merge/rebase decisions.
- Investigate Lisa runtime health under a separately authorized runtime task if Carlos wants more than process/channel availability. Why: fast status skipped probes/security and memory, reported 17 task issues and one audit warning, and hit a locked shared-state database during a migration check. Dependency: Carlos approval for deeper checks. Risk if deferred: those health areas remain unknown.
- Audit and reduce stale docs that still describe old sandbox/model state. Why: `linkbots/lisa/README.md` has older runtime snapshot lines that conflict with current live config. Evidence: current live config says sandbox `non-main`; older README says sandbox off. Dependency: decide whether workshop docs should be updated. Risk if deferred: agents follow stale state.

Later:

- Create a David profile plan only after Lisa baseline is stable. Why: David folder is placeholder only. Evidence: `linkbots/david/README.md`. Dependency: Carlos product decision. Risk if deferred: low.
- Consider stronger secret management and exposure review before VPS or multi-user use. Why: live profile has local secrets, auth token, Control UI device auth disabled, and active external channels. Dependency: Carlos security posture decision. Risk if deferred: higher exposure risk if topology changes.

## 20. Open Questions and Unknowns

- Should this documentation branch be committed or opened as a PR?
- Should the intended `linkbots/` workshop content now be committed to this private fork, or remain untracked temporarily?
- Is `dangerouslyDisableDeviceAuth: true` still intentionally accepted for Lisa's current network exposure?
- Should future incoming agents run `openclaw --profile lisa status --deep` / security audit, and under what conditions?
- When should this shallow checkout be deepened or unshallowed to restore reliable upstream merge-base/diff behavior?
- What is Carlos's intended David role, runtime timeline, and separation from Lisa?

## 21. Reference Appendix

Commands run or equivalent evidence collected in this session include:

```bash
git status --short --branch
git branch --show-current
git branch -vv
git remote -v
git worktree list
git stash list
git rev-parse HEAD
git log --oneline --decorate --graph --max-count=70 --all --simplify-by-decoration
git merge-base HEAD upstream/main
git merge-base HEAD origin/main
git merge-base HEAD origin/development
git rev-list --left-right --count upstream/main...HEAD
git diff --name-status upstream/main...HEAD
git diff --stat upstream/main...HEAD
git diff --name-status
git diff --stat
git ls-files --others --exclude-standard
TZ=Asia/Taipei date '+%Y-%m-%d %H:%M %Z'
git switch -c docs/initial-agent-handoff-20260723
node -v
pnpm -v
npm -v
openclaw --version
launchctl print gui/$(id -u)/ai.openclaw.lisa
ps auxww | awk '/openclaw|lisa/'
~/.openclaw-lisa/status-lisa.sh
/opt/homebrew/opt/node@24/bin/node /Users/linktrend/Projects/openclaw_prime/openclaw.mjs --profile lisa cron list
/opt/homebrew/opt/node@24/bin/node /Users/linktrend/Projects/openclaw_prime/openclaw.mjs --profile lisa channels status
docker image inspect openclaw-sandbox:bookworm-slim
ollama list
cursor-agent --version
```

Selected file evidence:

- `README.md` describes install, runtime, quick start, security defaults, and OpenClaw architecture surfaces.
- Root `AGENTS.md` describes repo hard policy, architecture, commands, validation, and now multi-agent handoff protocol.
- `docs/AGENTS.md` describes docs authoring rules; this private handoff task intentionally includes local paths and must not be added to public docs navigation.
- `package.json` defines package name/version, engines, scripts, and pnpm packageManager pin.
- `linkbots/README.md` states live runtime remains under `~/.openclaw-*`, not workshop folders.
- `linkbots/lisa/Personality files/AGENTS.md` describes Lisa startup, model routing, Cursor delegation, local-coder, heartbeat, and red lines.
- `linkbots/lisa/Personality files/TOOLS.md` describes host/runtime paths, model stack, sandbox, gws, Cursor ACP, and start/stop/status.
- `linkbots/lisa/Personality files/HEARTBEAT.md` describes wall-clock cron heartbeat workflow.
- `linkbots/lisa/Personality files/IDENTITY.md` describes Lisa identity and role.
- `linkbots/david/README.md` reserves the David workshop.
