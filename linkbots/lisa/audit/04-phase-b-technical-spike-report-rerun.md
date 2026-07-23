# Phase B technical spike — rerun (post login claim)

**Date:** 2026-07-10 (rerun)
**Prior report:** `04-phase-b-technical-spike-report.md`
**Host:** Carlos Mac mini (M1), user `linktrend`
**OpenClaw profile:** `openclaw --profile lisa`
**Trigger:** Carlos reported `cursor-agent login` completed; `~/.zshrc` PATH fix and `start-lisa.sh` updates (outside this repo spike scope).

---

## Executive summary

**Verdict: PARTIAL** (unchanged from initial spike)

| Item                     | Result                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Auth confirmed           | **No** — `cursor-agent whoami` / `status` / `about` all report **Not logged in**                               |
| `spike-ok` headless test | **FAIL** — exit 1, authentication required                                                                     |
| PATH `~/.local/bin`      | **Yes** in `~/.zshrc`; works when exported in test shells                                                      |
| OpenClaw ACP bridge      | **OK** — gateway health OK; `openclaw --profile lisa acp` reaches gateway (`[acp] ready`)                      |
| `@openclaw/acpx`         | **Not installed** (`npm list -g @openclaw/acpx` empty)                                                         |
| Lisa `acp` config        | **Still missing** — no `acp` key in `~/.openclaw-lisa/openclaw.json` or repo `Personality files/openclaw.json` |

Carlos’s login may have been IDE-only, a different user/session, or did not persist to the CLI credential store this agent can see. Until `cursor-agent status` shows a logged-in email (or a non-repo `CURSOR_API_KEY` is set for Lisa exec), Phase B cannot pass the hello-world gate.

**No changes** to personality files or `openclaw.json` during this rerun.

---

## 1. Auth verification

```bash
export PATH="$HOME/.local/bin:$PATH"
cursor-agent whoami    # → Not logged in
cursor-agent status    # → Not logged in
cursor-agent about     # User Email: Not logged in
```

Also tested in login shell:

```bash
zsh -il -c 'export PATH="$HOME/.local/bin:$PATH"; cursor-agent whoami'
# → Not logged in
```

`CURSOR_API_KEY`: **unset** in non-interactive test environment.

CLI state files present under `~/.cursor/` (`agent-cli-state.json`, `cli-config.json`) but contain **no** logged-in identity fields in redacted inspection (version/settings only).

---

## 2. Hello-world headless test (`spike-ok`)

**Workspace:** `/tmp/lisa-cursor-spike-rerun-mX84rI` (fresh `mktemp`)

```bash
export PATH="$HOME/.local/bin:$PATH"
cd /tmp/lisa-cursor-spike-rerun-mX84rI
cursor-agent -p "Reply with exactly: spike-ok"
```

**Output:**

```
Error: Authentication required. Please run 'agent login' first, or set CURSOR_API_KEY environment variable.
```

**Exit code:** 1
**Observed `spike-ok`:** No
**Continue/resume:** Not attempted — same auth error blocks `-p` turns (consistent with initial spike).

Documented headless flags from `--help`: `-p` / `--print`, `--output-format text|json|stream-json`, `--resume`, `--continue`, `--workspace`, `--approve-mcps`.

---

## 3. OpenClaw ACP status

**CLI**

```bash
openclaw --profile lisa acp --help          # OK — bridge + client subcommands
openclaw --profile lisa gateway health       # OK (~12ms), Telegram configured
timeout 8 openclaw --profile lisa acp --url ws://127.0.0.1:18790 --verbose
# → [acp] ready
```

**Cursor Agent ACP server mode**

```bash
cursor-agent acp --help   # OK — "Start the Cursor Agent as an ACP server"
```

**@openclaw/acpx**

- Not installed globally on this host.
- Package exists on npm: `@openclaw/acpx@2026.6.11` — install when Carlos approves config work:
  ```bash
  npm install -g @openclaw/acpx@2026.6.11
  ```
  Then enable per [ACP agents setup](https://docs.openclaw.ai/tools/acp-agents-setup) and add Lisa `acp` block (`enabled`, `backend: "acpx"`, `allowedAgents` including `cursor`). **Not installed during this rerun** (requires config + gateway restart).

**Lisa `openclaw.json` `acp` section:** **Still missing** (live profile and repo template).

**OpenClaw `sessions_spawn` with `runtime: "acp"`:** Not exercised — preconditions unchanged.

---

## 4. What improved since initial spike

- `~/.zshrc` now includes `export PATH="$HOME/.local/bin:$PATH"` (Cursor CLI comment present).
- `cursor-agent` resolves when PATH is set (symlink unchanged: `2026.01.28-fd13201`).

---

## 5. Next steps for full Phase B

**Single unblocker (Carlos):** Prove CLI auth on the **same** Mac mini user `linktrend` that runs Lisa:

```bash
export PATH="$HOME/.local/bin:$PATH"
cursor-agent login          # interactive; NO_OPEN_BROWSER=1 if headless Mac
cursor-agent status         # must NOT say "Not logged in"
cursor-agent about          # must show User Email (do not paste into chat/logs)
```

Then re-run:

```bash
SPIKE=$(mktemp -d /tmp/lisa-cursor-spike-rerun-XXXXXX)
cd "$SPIKE" && git init -q
cursor-agent -p --output-format text --workspace "$SPIKE" --approve-mcps "Reply with exactly: spike-ok"
```

If login succeeds but automation shells still show logged out, ensure Lisa/gateway/LaunchAgent inherits the same `$HOME` and credential path; consider approved `CURSOR_API_KEY` in OpenClaw secret store (never repo).

**Composer / follow-on after auth + spike-ok pass:**

1. Install `@openclaw/acpx` and add Lisa `acp` config (Carlos-approved).
2. Restart Lisa gateway; verify `openclaw --profile lisa config get acp.enabled` (or equivalent).
3. Exercise `sessions_spawn` with `runtime: "acp"`, `agentId: "cursor"`, `thread: true` via acp-router skill.
4. Optional: test `--continue` / `--resume <chatId>` after a successful `-p` session.

---

## Parent handoff

**Verdict:** PARTIAL

**spike-ok:** FAIL

**Auth confirmed:** No

**Report path:** `/Users/linktrend/Documents/LiNKwork/Openclaw Lisa Prime/audit/04-phase-b-technical-spike-report-rerun.md` (summary pointer appended to `04-phase-b-technical-spike-report.md`)

**Next single action for Carlos:** On the Mac mini as `linktrend`, run `cursor-agent login` then `cursor-agent status` until it shows logged in; if it already “worked” in another app, re-run login in Terminal and paste only pass/fail (not tokens/email) back to Composer.

---

## Appendix: Cursor Agent CLI auth troubleshooting (2026-07-10 investigation)

Subagent re-ran CLI help and inspected local auth storage **without** reading or logging secret values.

### CLI help summary (version `2026.01.28-fd13201`)

| Command                      | Notes                                                                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `cursor-agent --help`        | Binary identifies as **`agent`** in usage text; global `--api-key <key>` **or** `CURSOR_API_KEY` env var                         |
| `cursor-agent login --help`  | Interactive OAuth; set **`NO_OPEN_BROWSER=1`** to skip auto-open (paste URL manually). SSH sessions also block auto browser open |
| `cursor-agent status --help` | Alias **`whoami`** — checks auth only (no options)                                                                               |
| `cursor-agent logout`        | Clears stored CLI auth (keychain entries)                                                                                        |

### `agent` vs `cursor-agent`

On this host, both are symlinks to the same file:

- `/Users/linktrend/.local/bin/agent` → `.../cursor-agent`
- `/Users/linktrend/.local/bin/cursor-agent` → same target

**No functional difference.** Error messages say `agent login`; either command name works when PATH includes `~/.local/bin`.

### Where credentials live (paths only)

| Location                                                           | Role                                                                                                                                                                         |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `~/.cursor/agent-cli-state.json`                                   | CLI **UI state** (e.g. tip flags) — **not** access tokens                                                                                                                    |
| `~/.cursor/cli-config.json`                                        | Editor/agent preferences — **no** logged-in identity in inspected schema                                                                                                     |
| `~/.cursor/cli-config.json.bad`                                    | Prior broken config backup (present on host)                                                                                                                                 |
| macOS **login keychain** (`~/Library/Keychains/login.keychain-db`) | CLI OAuth: services **`cursor-access-token`**, **`cursor-refresh-token`** (account **`cursor-user`**); IDE may also use **`Cursor Safe Storage`** (account **`Cursor Key`**) |
| `~/.local/share/cursor-agent/`                                     | Installed CLI **versions only** — no user tokens                                                                                                                             |
| `~/.config/cursor`, `~/.config/cursor-agent`, `~/.cursor-agent`    | **Not present** on investigated host                                                                                                                                         |

Spike reports and `-p` failures consistently show: _Authentication required. Please run 'agent login' first, or set **CURSOR_API_KEY** environment variable._

### API key alternative (no secrets in repo)

Documented in `--help`:

1. **Environment:** export `CURSOR_API_KEY` in the shell, LaunchAgent plist, or OpenClaw secret store (never git).
2. **Flag:** `cursor-agent --api-key <key> ...` (same as env for headless `-p`).

Create/manage keys in Cursor account settings (web/dashboard). Do not paste keys into chat, logs, or LiNKtrend repo.

### Why `status` can say "Not logged in" after Carlos thought login finished

1. **Misleading first line on `status`:** The CLI briefly prints **"Starting login process..."** while rendering the status UI (`login-ui` reuses the `"starting"` state). That is **not** the same as running `login`; wait for **"Checking authentication status..."** then the final line.
2. **OAuth not completed:** Browser tab closed, wrong account, or redirect never returned to the CLI before the terminal session ended — tokens never written (or only partially written → **"Partially authenticated (missing refresh token)"**).
3. **`NO_OPEN_BROWSER=1` without finishing:** URL shown in terminal must be opened and approved; skipping this leaves CLI logged out.
4. **Cursor IDE ≠ Cursor Agent CLI:** IDE sign-in does not automatically satisfy `cursor-agent status`; CLI needs its own successful `login` (or API key). IDE and CLI may share keychain services, but CLI still validates **both** access and refresh tokens and calls **`GetMe`** when both exist.
5. **Stale or unreadable keychain entries:** Investigation found keychain **items present** while `status` / `about` still reported **Not logged in** — consistent with expired tokens, failed refresh, or keychain ACL/context mismatch. **`cursor-agent logout`** then a fresh **`login`** is the clean fix.
6. **Wrong user or PATH context:** Lisa/gateway/LaunchAgent must use the same **`$HOME`** (`linktrend`) and `~/.local/bin` as the Terminal where login succeeded. Non-login shells without `~/.zshrc` PATH still need `export PATH="$HOME/.local/bin:$PATH"`.

### Recommended command sequence for Carlos (Mac mini, user `linktrend`)

Run **interactively in Terminal.app or iTerm** (not via automation subagent):

```bash
export PATH="$HOME/.local/bin:$PATH"
cursor-agent --version
cursor-agent logout          # optional but recommended if login was attempted before
cursor-agent login           # complete browser OAuth; use NO_OPEN_BROWSER=1 only if you will paste the printed URL
cursor-agent status          # final line must NOT be "Not logged in"
cursor-agent about           # should show a User Email (do not paste email/tokens into Slack/Composer)
cursor-agent -p --output-format text --approve-mcps "Reply with exactly: spike-ok"
```

If headless or SSH:

```bash
export PATH="$HOME/.local/bin:$PATH"
export NO_OPEN_BROWSER=1
cursor-agent login           # copy URL from terminal, finish in local browser, return to terminal until login succeeds
cursor-agent status
```

**Report back:** pass/fail only for `status` and `spike-ok` — no tokens, API keys, or email.

---

## Post-login verification (2026-07-10)

**Post-login verdict: GO** (CLI auth + headless hello-world + continue)
**Phase B overall: PARTIAL** (Lisa ACP/ACPX orchestration not yet configured)

| Check                                                          | Result                                                                           |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `export PATH="$HOME/.local/bin:$PATH"` + `cursor-agent status` | **PASS** — logged in (product@linktrend.media); does **not** say "Not logged in" |
| Headless `spike-ok`                                            | **PASS** — output contains `spike-ok`                                            |
| `--continue` follow-up                                         | **PASS** — output contains `continue-ok` (~8s)                                   |
| OpenClaw gateway health                                        | **OK** (~14ms); Telegram configured                                              |
| OpenClaw ACP bridge (`acp --url ws://127.0.0.1:18790`)         | **OK** — `[acp] ready` (then clean disconnect on timeout)                        |
| `@openclaw/acpx` global install                                | **Not installed** (`npm list -g` empty; `acpx` not in PATH)                      |
| Lisa `acp` in `~/.openclaw-lisa/openclaw.json`                 | **Missing** (`config get acp.enabled` not found)                                 |

**No changes** to personality files or repo `openclaw.json` during this verification.

### Auth

```bash
export PATH="$HOME/.local/bin:$PATH"
cursor-agent status
# ✓ Logged in as product@linktrend.media
```

### Hello-world (`spike-ok`)

**Workspace:** `/tmp/lisa-cursor-spike-final-M5MU63` (`mktemp -d /tmp/lisa-cursor-spike-final-XXXXXX`)

**Working command** (headless / automation — not run from inside `CURSOR_AGENT=1` without trust):

```bash
export PATH="$HOME/.local/bin:$PATH"
SPIKE=$(mktemp -d /tmp/lisa-cursor-spike-final-XXXXXX)
cd "$SPIKE" && git init -q
env -u CURSOR_AGENT -u CURSOR_CONVERSATION_ID -u VSCODE_IPC_HOOK \
  cursor-agent -p --output-format text --approve-mcps -f --trust \
  --workspace "$SPIKE" "Reply with exactly: spike-ok"
```

**Observed output:** `spike-ok`
**Exit code:** 0
**Duration:** ~11s

**Note:** Runs launched from Cursor’s agent-exec shell (`CURSOR_AGENT=1`) without clearing nested env vars hung with **no stdout** for 20+ minutes. Unsetting `CURSOR_AGENT` (and related IDE IPC vars) surfaced **Workspace Trust Required**; `-f` + `--trust` on the throwaway `/tmp` workspace unblocked headless `-p`.

Lisa/gateway exec should use the same flags for non-interactive `/tmp` or project workspaces: `-f --trust` (or pre-trust workspace via interactive `agent` once).

### Continue test

```bash
env -u CURSOR_AGENT -u CURSOR_CONVERSATION_ID -u VSCODE_IPC_HOOK \
  cursor-agent -p --output-format text --approve-mcps -f --trust --continue \
  "Reply with exactly: continue-ok"
```

**Observed output:** `continue-ok`
**Exit code:** 0

### OpenClaw / ACPX (documented, not installed)

1. Install plugin (Carlos-approved config change):
   ```bash
   npm install -g @openclaw/acpx@2026.6.11
   ```
2. Add Lisa `acp` block per [ACP agents setup](https://docs.openclaw.ai/tools/acp-agents-setup): `enabled`, `backend: "acpx"`, `allowedAgents` including `cursor`.
3. Restart Lisa gateway; validate `openclaw --profile lisa config get acp.enabled`.
4. Exercise `sessions_spawn` with `runtime: "acp"`, `agentId: "cursor"`, `thread: true`.

Ensure Lisa/OpenClaw exec environment includes `PATH` with `~/.local/bin` and does **not** rely on nested IDE-only auth; CLI keychain login on user `linktrend` is sufficient for this host.

### Parent handoff (post-login)

| Item                           | Value                                                                                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Verdict (hello-world gate)** | **GO**                                                                                                                                                                       |
| **Verdict (full Phase B)**     | **PARTIAL**                                                                                                                                                                  |
| **spike-ok**                   | **PASS**                                                                                                                                                                     |
| **Next step**                  | Install `@openclaw/acpx`, add Lisa `acp` config, restart gateway, then test OpenClaw → Cursor via ACP; document `-f --trust` for headless `cursor-agent -p` in Lisa exec env |

---

## ACPX install and Lisa wiring (2026-07-10)

**Verdict: PARTIAL (GO for install/config/restart/bridge; E2E via Lisa chat spawn not exercised here)**

### Install

| Step                                           | Result                                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `npm install -g @openclaw/acpx@2026.6.11`      | **PASS** — `/opt/homebrew/lib/node_modules/@openclaw/acpx@2026.6.11`                                    |
| `openclaw --profile lisa plugins install acpx` | **PASS** — profile-local install under `~/.openclaw-lisa/npm/projects/openclaw-acpx-052d680d6d/`        |
| Plugin discoverable                            | **PASS** — `openclaw --profile lisa plugins list` shows **ACPX Runtime** `acpx` **enabled** @ 2026.6.11 |
| Pinned `acpx` CLI (plugin-local)               | **0.11.2** (plugin `node_modules/.bin/acpx`)                                                            |

Global `acpx` is not on PATH by design; OpenClaw uses the plugin-local pinned binary.

### Config changes (preserved existing device-pair, models, gateway, telegram, etc.)

Edited **`~/.openclaw-lisa/openclaw.json`** and synced **`Openclaw Lisa Prime/Personality files/openclaw.json`**:

- Top-level **`acp`**: `enabled: true`, `backend: "acpx"`, `defaultAgent: "cursor"`, full `allowedAgents` list per OpenClaw docs, stream/runtime defaults.
- **`plugins.entries.acpx`**: `enabled: true`, `config.probeAgent: "cursor"`, `permissionMode: "approve-all"`, `nonInteractivePermissions: "fail"` (headless-friendly; gateway logs security warning — expected).

Validation:

```bash
openclaw --profile lisa config validate
# Config valid: ~/.openclaw-lisa/openclaw.json

openclaw --profile lisa config get acp.enabled        # true
openclaw --profile lisa config get acp.defaultAgent   # cursor
openclaw --profile lisa config get plugins.entries.acpx.enabled  # true
```

### Restart

```bash
~/.openclaw-lisa/stop-lisa.sh
~/.openclaw-lisa/start-lisa.sh
```

| Check                   | Result                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| Gateway health          | **OK** (~10ms); Telegram configured                                                              |
| `acp` config hot reload | Gateway restart required after `acp` block (applied on full restart)                             |
| acpx plugin load        | **PASS** — log: `embedded acpx runtime backend registered lazily`; 12 plugins including **acpx** |

**Note:** First `start-lisa.sh` after stop hit a transient “port 18790 in use”; second start succeeded (listener had cleared).

### Smoke tests — working commands

**OpenClaw ACP bridge (Gateway as ACP server for editors/clients):**

```bash
export PATH="$HOME/.local/bin:$PATH"
timeout 8 openclaw --profile lisa acp --url ws://127.0.0.1:18790 --verbose
# stderr: [acp] ready
```

**acpx → Cursor harness (same stack OpenClaw uses via `backend: acpx`, `agentId: cursor`):**

```bash
export PATH="$HOME/.local/bin:$PATH"
ACPX="$HOME/.openclaw-lisa/npm/projects/openclaw-acpx-052d680d6d/node_modules/@openclaw/acpx/node_modules/.bin/acpx"
SPIKE=$(mktemp -d /tmp/lisa-acpx-cursor-spike-XXXXXX)
cd "$SPIKE" && git init -q
env -u CURSOR_AGENT -u CURSOR_CONVERSATION_ID -u VSCODE_IPC_HOOK   "$ACPX" --cwd "$SPIKE" --format text --approve-all --non-interactive-permissions fail --timeout 120   cursor exec "Reply with exactly: acpx-ok"
```

| Check                             | Result                                  |
| --------------------------------- | --------------------------------------- |
| Output contains `acpx-ok`         | **PASS**                                |
| Exit code                         | **0**                                   |
| Duration                          | **~10s**                                |
| `cursor-agent status` (same host) | **Logged in** (product@linktrend.media) |

**Chat-native checks (not run in this spike):** `/acp doctor`, `/acp spawn cursor --bind here`, and `sessions_spawn({ runtime: "acp", agentId: "cursor" })` from Telegram or a **non-sandboxed** session. Lisa `agents.defaults.sandbox.mode` is **`all`**, which blocks ACP spawns from sandboxed embedded turns per OpenClaw policy.

### acp-router skill

Ships with `@openclaw/acpx` (`skills/acp-router/`). No personality file change; reference only in this report.

### Optional hardening (not applied)

- Set `plugins.allow: ["acpx", "device-pair", ...]` to silence “untracked local code” warnings after profile-local plugin install.
- Tighten `permissionMode` after IDE Development gates / interactive approval flows are available.

### Parent handoff

| Item                              | Value                                                                                                                                                                                                                                                |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Verdict**                       | **PARTIAL**                                                                                                                                                                                                                                          |
| **Install + config + restart**    | **GO**                                                                                                                                                                                                                                               |
| **ACP bridge + acpx→cursor exec** | **GO**                                                                                                                                                                                                                                               |
| **Next step**                     | Carlos: send **`/acp doctor`** on Lisa Telegram; try **`/acp spawn cursor --bind here`** or tool spawn from host context; enable **IDE Development** / gate skills when ready; consider sandbox policy if Lisa must spawn Cursor from embedded turns |

---

## Sandbox fix for Telegram ACP spawn (2026-07-10)

**Verdict: GO (config + restart + sandbox explain; Carlos re-test on Telegram)**

### Root cause

Carlos hit OpenClaw’s intentional fail-closed guard: **ACP runs on the host**, so **`/acp spawn`** and `sessions_spawn({ runtime: "acp" })` are **rejected from sandboxed requester sessions** (`src/agents/acp-spawn.ts`, documented in [ACP Agents — Sandbox compatibility](https://docs.openclaw.ai/tools/acp-agents)).

Lisa had:

- `agents.defaults.sandbox.mode: "all"` → every session sandboxed (including Telegram DM)
- `session.dmScope: "per-channel-peer"` → Telegram DM key `agent:main:telegram:direct:<peer>` (non-main)

`runtime: "subagent"` from sandbox only spawns **embedded OpenClaw subagents**, not Cursor ACP — not a substitute for Carlos’s goal.

### Fix applied (minimal secure path)

Edited **`~/.openclaw-lisa/openclaw.json`** and synced **`Openclaw Lisa Prime/Personality files/openclaw.json`**:

| Setting                        | Before             | After          | Why                                                                                                                       |
| ------------------------------ | ------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `agents.defaults.sandbox.mode` | `all`              | **`non-main`** | Main Carlos DM runs tools on **host** so ACP spawn is allowed; future **groups/channels** stay Docker-sandboxed           |
| `session.dmScope`              | `per-channel-peer` | **`main`**     | Telegram DM routes to **`agent:main:main`** (same as Web UI) so Carlos’s primary chat is the non-sandbox **main** session |

Restart:

```bash
~/.openclaw-lisa/stop-lisa.sh && ~/.openclaw-lisa/start-lisa.sh
```

Validation:

```bash
openclaw --profile lisa config validate
openclaw --profile lisa sandbox explain --session agent:main:main
# runtime: direct (not sandboxed)

openclaw --profile lisa sandbox explain --session agent:main:telegram:direct:1123023078
# still sandboxed (legacy per-peer key); new Telegram traffic uses main after dmScope change
```

### Security tradeoff (plain English)

- **What we kept:** Docker sandbox for **non-main** sessions (e.g. Telegram groups, other channel keys). ACP still cannot be spawned **from inside** a sandboxed turn.
- **What we relaxed:** Carlos’s **personal DM** (Telegram + Web) now runs **Lisa tool exec on the Mac host**, not in Docker — required for Cursor/ACP. We also merged Telegram into the **main** session instead of an isolated per-channel DM bucket (acceptable for single-operator Lisa with pairing; revisit `per-channel-peer` if multiple humans DM the bot).

### What Carlos runs on Telegram now

1. **`/acp doctor`** — should stay healthy (acpx + cursor-agent).
2. **`/acp spawn cursor --bind here`** — should succeed on the **main** session (send once after config reload; optional **`/new`** if an old Telegram-only session still feels sticky).
3. Chat in that thread; Cursor handles bound turns until **`/acp unbind`** or session reset.

**Not changed:** `plugins.entries.acpx`, `acp.*`, gateway port, pairing, or `permissionMode: approve-all`.

### Docs touched

- `Openclaw Lisa Prime/Personality files/TOOLS.md` (+ synced `~/.openclaw-lisa/workspace/TOOLS.md`)

---

## Dashboard session ACP spawn failure (2026-07-10 13:26:18)

**Verdict: NOT a config regression — sandbox + mislabeling**

### Exact failure (`gateway.log` + session transcript)

At **13:26:18** in session `agent:main:dashboard:9694d533-003a-49ce-a19b-36d548321573` (Web UI **dashboard** tab, not `agent:main:main`), Lisa called:

```json
{
  "agentId": "cursor",
  "mode": "run",
  "runtime": "acp",
  "task": "Add a small README section..."
}
```

Tool result:

```
Validation failed for tool "sessions_spawn":
  - runtime: must be equal to one of the allowed values
```

**Cause:** Dashboard sessions are **non-main** → Docker sandbox → OpenClaw strips `runtime: "acp"` from the tool schema (only `subagent` allowed). Same guard as documented in `src/agents/acp-spawn.ts`: sandboxed requesters cannot spawn host ACP sessions.

Earlier in the same turn: `exec host not allowed (requested gateway; configured host is auto)` and `Sandbox FS error (ENOENT)` on host paths — consistent with sandbox context.

### Lisa behavior gap

After ACP validation failed, Lisa spawned `runtime: "subagent"` (DeepSeek) at 13:26:59 and reported it as **Cursor** — incorrect. Internal subagent ≠ Cursor ACP.

### Fix (personality only — no config change)

Updated `TOOLS.md` + `IDENTITY.md` (synced to workspace):

- Orchestrator default: `sessions_spawn({ runtime: "acp", agentId: "cursor" })` from **main session only**
- `/acp bind` = optional direct mode (Carlos ↔ Cursor), not the default
- Honest attribution: quote spawn errors; never label subagent work as Cursor

**No gateway restart** — live `openclaw.json` already has `sandbox.mode: non-main` and `session.dmScope: main`.

### Carlos re-test

Use **Telegram DM** or Web UI **main** chat (not dashboard sub-session): ask Lisa to delegate a trivial file edit to Cursor and confirm she reports ACP spawn success or the verbatim error — not a DeepSeek subagent labeled Cursor.

---

## Sandbox off for all-surface ACP (2026-07-10)

**Verdict: GO (config + personality + restart + sandbox explain)**

### Root cause (dashboard blocked)

OpenClaw `sandbox.mode: non-main` sandboxes any session key **≠** `agent:main:main` (`src/agents/sandbox/runtime-status.ts`). Web UI dashboard/branched chats use `agent:main:dashboard:<uuid>` — always non-main → Docker sandbox → `sessions_spawn` tool schema strips `runtime: "acp"` (only `subagent` allowed). Same guard for legacy Telegram per-peer keys. ACP runs on host; sandboxed requesters cannot spawn it ([ACP sandbox compatibility](https://docs.openclaw.ai/tools/acp-agents)).

Prior `dmScope: main` fix helped Telegram **new** DMs route to main, but did **not** cover dashboard sub-sessions or Carlos chatting in any non-main key.

### Fix applied

| Setting                        | Before     | After     | Why                                                                                                        |
| ------------------------------ | ---------- | --------- | ---------------------------------------------------------------------------------------------------------- |
| `agents.defaults.sandbox.mode` | `non-main` | **`off`** | All Carlos surfaces (Telegram, Web UI main + dashboard tabs, iPhone) run tools on host → ACP spawn allowed |

**Security tradeoff (single-operator Lisa):** Telegram groups also run on host. Mitigated by pairing, group allowlist, and require-mention. Re-enable `non-main` if multi-human DMs or untrusted group exposure increases.

**Personality (synced to workspace):** `AGENTS.md`, `TOOLS.md`, `SOUL.md`, `IDENTITY.md` — mandatory Cursor rule: when Carlos says use Cursor (any channel) → `sessions_spawn({ runtime: "acp", agentId: "cursor" })`; never subagent/self-write substitute; quote spawn errors and stop.

**Cheatsheet:** `LISA_CONTROL_CHEATSHEET.md` — Cursor section now channel-agnostic.

Restart: `~/.openclaw-lisa/stop-lisa.sh && ~/.openclaw-lisa/start-lisa.sh`

Validation:

```bash
openclaw --profile lisa config validate
openclaw --profile lisa sandbox explain --session agent:main:main
openclaw --profile lisa sandbox explain --session agent:main:dashboard:9694d533-003a-49ce-a19b-36d548321573
openclaw --profile lisa sandbox explain --session agent:main:telegram:direct:1123023078
# All should show runtime: direct
```

**Carlos test prompt (Web UI dashboard tab OR Telegram):** _"Lisa, use Cursor to add a one-line comment `# cursor-acp-test` at the top of README.md in the Lisa workspace and report the spawn result."_ Expect ACP spawn success (or verbatim error) — not a Lisa subagent labeled Cursor.
