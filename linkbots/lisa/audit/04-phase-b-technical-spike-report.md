# Phase B technical spike — Lisa ↔ Cursor orchestration

**Date:** 2026-07-10
**Host:** Carlos Mac mini (M1, 16GB), user `linktrend`
**OpenClaw profile:** `openclaw --profile lisa`
**State dir:** `/Users/linktrend/.openclaw-lisa/`
**Gateway:** port **18790** (bind LAN)
**Spike scope:** hello-world plumbing only (no IDE Development gates, no personality changes)

---

## Executive summary

**Verdict: PARTIAL**

The Mac mini has the right pieces on disk (Cursor IDE, `cursor-agent` CLI with `acp` and headless `--print`, Lisa gateway healthy on 18790, OpenClaw `acp` CLI bridge reaches the gateway). The spike **did not** complete an end-to-end “Reply with exactly: spike-ok” run because **Cursor Agent is not authenticated** on this machine. OpenClaw **ACP harness orchestration** (`sessions_spawn` with `runtime: "acp"`, `agentId: "cursor"`) is **not configured**: there is no `acp` block in Lisa config, the **@openclaw/acpx** plugin is not installed, and the Homebrew `openclaw` package **excludes** the bundled `acpx` extension (it is an official external plugin). Lisa’s workspace has **no** local `acp-router` skill copy; that skill ships with the ACPX plugin in the engine repo.

Until Carlos completes Cursor login (or sets a non-secret API key workflow) and installs/enables ACPX plus `acp` config, Lisa cannot reliably spawn or resume Cursor sessions through OpenClaw—only manual CLI after auth.

---

## What was found installed

**Cursor IDE**

- Application: `/Applications/Cursor.app`
- Editor CLI (not on default PATH): `/Applications/Cursor.app/Contents/Resources/app/bin/cursor` (Cursor 3.10.20)

**Cursor Agent CLI (`cursor-agent`)**

- Symlink: `/Users/linktrend/.local/bin/cursor-agent` → version **2026.01.28-fd13201**
- **Not** on the default non-interactive PATH used by this spike shell (`which cursor-agent` failed). `~/.local/bin` is not referenced in `~/.zshrc` / `~/.zprofile` (empty grep).
- Subcommands confirmed: `--print` (headless), `--resume` / `--continue`, `create-chat`, **`acp`** (ACP server mode).

**OpenClaw (Lisa profile)**

- CLI: OpenClaw **2026.6.11** at `/opt/homebrew/bin/openclaw`
- Config: `~/.openclaw-lisa/openclaw.json` — **valid**; **no** top-level `acp` section
- Plugins enabled in config: only `device-pair` (custom public URL for gateway)
- `@openclaw/acpx`: **not** installed globally (`npm list -g @openclaw/acpx` empty)
- Stock install: `dist/extensions/` has **no** `acpx` folder (package.json explicitly excludes `dist/extensions/acpx/**`; ACPX is catalogued as `@openclaw/acpx`)

**Engine repo (reference only, not modified)**

- `/Users/linktrend/Projects/openclaw_prime` contains `extensions/acpx/` and `skills/acp-router/SKILL.md`
- Cursor harness mapping documented there: `agentId: "cursor"` → acpx default `cursor-agent acp`

**Lisa gateway**

- `openclaw --profile lisa gateway health`: **OK** (~10ms), probe `ws://127.0.0.1:18790`, Telegram configured
- Process listening: `node` on `*:18790`
- LaunchAgent service **not** installed for profile `lisa` (gateway still reachable; likely manual/process-managed)

**Spike workspace**

- Temp dir: `/tmp/lisa-cursor-spike-aZAeE5` (README + `git init`)

---

## Commands that worked (copy-paste ready)

Use full paths where PATH is incomplete.

```bash
# Lisa gateway health
openclaw --profile lisa gateway health

# OpenClaw ACP bridge help
openclaw --profile lisa acp --help
openclaw --profile lisa acp client --help

# Cursor Agent help and version (full path)
/Users/linktrend/.local/bin/cursor-agent --help
/Users/linktrend/.local/bin/cursor-agent --version

# Cursor Agent ACP server subcommand exists
/Users/linktrend/.local/bin/cursor-agent acp --help

# Editor CLI (full path)
"/Applications/Cursor.app/Contents/Resources/app/bin/cursor" --help

# ACP bridge connects to Lisa gateway (exits when idle; saw "[acp] ready")
timeout 8 openclaw --profile lisa acp --url ws://127.0.0.1:18790 --verbose

# Create empty chat IDs without running a model turn (no auth error)
/Users/linktrend/.local/bin/cursor-agent create-chat

# Engine doc search (from any shell)
openclaw docs search acp agents
```

---

## Commands that failed and why

```bash
cursor-agent --help
cursor --help
```

**Why:** Neither `cursor-agent` nor `cursor` on default PATH in non-login automation shells. Fix: add `~/.local/bin` and/or Cursor app `bin` to PATH, or always use full paths in Lisa/exec wrappers.

```bash
/Users/linktrend/.local/bin/cursor-agent status
```

**Why:** Reports **Not logged in** (login flow attempted to start).

```bash
cd /tmp/lisa-cursor-spike-aZAeE5
/Users/linktrend/.local/bin/cursor-agent -p --output-format text --workspace "$PWD" --approve-mcps "Reply with exactly: spike-ok"
```

**Why:** Exit **1** — `Authentication required. Please run 'agent login' first, or set CURSOR_API_KEY environment variable.`
No model output; spike-ok not observed.

```bash
CHAT=$(/Users/linktrend/.local/bin/cursor-agent create-chat)
/Users/linktrend/.local/bin/cursor-agent --resume "$CHAT" -p "Reply exactly: continue-ok"
```

**Why:** Same authentication error on `-p` turns (chat ID creation succeeded).

```bash
/Users/linktrend/.local/bin/cursor-agent --continue -p "say continue-ok"
```

**Why:** `No previous chats found.` (and would still require auth for `-p`).

```bash
acpx --help
```

**Why:** `acpx` not in PATH; not installed as a standalone CLI on this host.

```bash
openclaw --profile lisa config get acp.enabled
```

**Why:** Config path not found — **ACP not configured** on Lisa profile.

**OpenClaw ACP runtime path (Lisa → sessions_spawn → Cursor):** Not exercised. Preconditions missing: `acp.enabled`, `@openclaw/acpx` plugin, `allowedAgents` including `cursor`, and authenticated `cursor-agent`.

---

## Recommended path for Phase B

**Near term (unblock spike-ok): CLI-first**

1. Carlos runs interactive auth once on the Mac mini:
   ```bash
   /Users/linktrend/.local/bin/cursor-agent login
   /Users/linktrend/.local/bin/cursor-agent status
   ```
2. Put `~/.local/bin` on PATH for Lisa/gateway exec environment (LaunchAgent, cron, or OpenClaw exec env)—document in Lisa TOOLS, do not commit secrets.
3. Re-run headless hello-world:
   ```bash
   SPIKE=/tmp/lisa-cursor-spike-manual
   mkdir -p "$SPIKE" && cd "$SPIKE" && git init -q
   /Users/linktrend/.local/bin/cursor-agent -p --output-format text --workspace "$SPIKE" --approve-mcps "Reply with exactly: spike-ok"
   ```
4. For “continue”, use `--continue` or `--resume <chatId>` after a successful `-p` session; `create-chat` + `--resume` is viable once auth works.

**Medium term (Lisa orchestration): ACP + ACPX, not CLI-only**

- Install and enable official **@openclaw/acpx** plugin per [ACP agents setup](https://docs.openclaw.ai/tools/acp-agents-setup).
- Add Lisa `openclaw.json` **acp** block (enable, `backend: "acpx"`, `allowedAgents` including `cursor`, concurrency limits)—**only after** Carlos approves config change; spike did **not** modify `openclaw.json`.
- Rely on **acp-router** skill from ACPX for `sessions_spawn` with `runtime: "acp"`, `agentId: "cursor"`, `thread: true`.
- Optional **direct acpx** “telephone game” path requires plugin-local pinned `acpx` binary (skill installs on demand when ACPX plugin is present).

**Both:** Long-term Lisa should use **ACP/ACPX** for session lifecycle; **cursor-agent -p** remains useful for smoke tests and fallback when gateway ACP is down.

---

## Blockers needing Carlos action

1. **Cursor Agent login** (or approved API key stored outside git—never log or commit the value).
2. **PATH** for OpenClaw/Lisa exec: `~/.local/bin` (and optionally Cursor app `bin`).
3. **Install @openclaw/acpx** and enable ACP in Lisa config (`acp.enabled`, allowed agents, gateway restart).
4. **Optional:** Install Lisa gateway as LaunchAgent (`openclaw --profile lisa gateway install`) for reboot persistence—gateway worked during spike without it.
5. **Subscription / account:** Confirm Cursor plan supports Agent CLI on this account after login (`cursor-agent about`, `models`).

---

## Security notes

- Use **trusted workspaces only** for Cursor Agent (`--workspace`); spike used throwaway `/tmp/lisa-cursor-spike-*`.
- Headless `--print` can use **write and bash** tools; treat prompts and cwd as production-adjacent risk. Prefer sandbox flags and narrow tasks for Lisa-driven runs.
- Do **not** store `CURSOR_API_KEY` or gateway tokens in the LiNKtrend repo or personality files; use OS keychain or OpenClaw secret refs per upstream docs.
- Lisa gateway binds **LAN** (`0.0.0.0:18790`); ensure firewall/Tailscale policy matches intent (device-pair plugin already exposes `ws://Macmini.local:18790`).
- ACP harness runs are **separate sessions** from Lisa’s main model; apply same approval/exec policy as other OpenClaw tools.

---

## Artifacts

- Spike temp dir: `/tmp/lisa-cursor-spike-aZAeE5`
- Config backup present (not applied): `~/.openclaw-lisa/openclaw.json.bak.pre-cursor-20260708`
- **No changes** made to `openclaw.json`, Lisa personality files, or IDE Development repo during this spike.

---

## Parent handoff

**Verdict:** PARTIAL

**Report path:** `/Users/linktrend/Documents/LiNKwork/Openclaw Lisa Prime/audit/04-phase-b-technical-spike-report.md`

**Top next steps for Composer/Carlos:** (1) Run `cursor-agent login` and fix PATH so `~/.local/bin` is visible to Lisa/gateway exec. (2) Re-run the headless `-p` hello-world until output is exactly `spike-ok`. (3) Install and enable `@openclaw/acpx`, add Lisa `acp` config, restart gateway, then retest OpenClaw `sessions_spawn` with `runtime: "acp"` and `agentId: "cursor"`.

---

## Rerun (2026-07-10, post `cursor-agent login` claim)

See full rerun details: **`04-phase-b-technical-spike-report-rerun.md`**

| Check                             | Result                                          |
| --------------------------------- | ----------------------------------------------- |
| PATH `~/.local/bin` in `~/.zshrc` | Yes                                             |
| `cursor-agent whoami` / `status`  | **Not logged in** (login shell + `PATH` export) |
| Headless `spike-ok`               | **FAIL** (auth required)                        |
| Lisa `acp` in `openclaw.json`     | **Missing** (repo + `~/.openclaw-lisa`)         |
| `@openclaw/acpx`                  | **Not installed**                               |
| OpenClaw `acp` bridge             | **OK** (`[acp] ready` on ws://127.0.0.1:18790)  |

**Rerun verdict:** PARTIAL (unchanged — auth still blocks spike-ok)
