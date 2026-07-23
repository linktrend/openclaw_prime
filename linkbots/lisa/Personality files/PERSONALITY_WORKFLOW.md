# Lisa Personality Workflow

**Current version:** 1.3 (2026-07-14) — see `VERSION.md`

## File Responsibilities

| File                    | Injected? | Owns                                                                          |
| ----------------------- | --------- | ----------------------------------------------------------------------------- |
| **IDENTITY.md**         | Yes       | Name, vibe, emoji, file map                                                   |
| **SOUL.md**             | Yes       | Persona Sections I–VII                                                        |
| **soul/detail.md**      | On demand | Persona reference archive                                                     |
| **USER.md**             | Yes       | Carlos preferences index                                                      |
| **user/schedule.md**    | On demand | Full schedule & comm protocol                                                 |
| **user/projects.md**    | On demand | Project registry & silos                                                      |
| **user/context.md**     | On demand | Background & working style                                                    |
| **AGENTS.md**           | Yes       | Core ops + Carlos service protocol + progressive-disclosure index             |
| **agents/detail.md**    | On demand | Group chat, heartbeat, formatting                                             |
| **TOOLS.md**            | Yes       | Environment facts + model stack + short pointers to `tools/` detail           |
| **tools/cursor-acp.md** | On demand | Full Cursor/ACP mechanics (bind mode, honest reporting, CLI quirks)           |
| **tools/gws.md**        | On demand | Full Google Workspace CLI reference (scopes, commands, Keep investigation)    |
| **HEARTBEAT.md**        | Yes       | Periodic checklist (when enabled)                                             |
| **memory/INDEX.md**     | On demand | One-line map of everything in `memory/`                                       |
| **memory/\*.md**        | On demand | LiNKdeveloper reference/alignment, gws capability doctrine, daily logs, evals |

**Precedence:** `SOUL.md` (stakes/quality) → `USER.md` (preferences) → `AGENTS.md` (routing).

**Sub-agents and cron sessions** inject a reduced bootstrap set: `AGENTS.md`, `SOUL.md`, `USER.md`, `IDENTITY.md`, and `TOOLS.md` — not `HEARTBEAT.md`, `BOOTSTRAP.md`, or `MEMORY.md`. Critical routing must stay in injected `AGENTS.md`.

**Frontmatter:** On-demand detail files use YAML frontmatter (`type`, `load`, `read_when`). The two largest on-demand files (`memory/linkdeveloper.md`, `memory/linkdeveloper-alignment.md`) additionally carry a `sections:` list — one line per heading — so Lisa can `Grep` for a specific heading and read just that range instead of the whole file. Always-injected files do **not** have frontmatter — OpenClaw injects workspace files as-is; frontmatter on bootstrap files wastes tokens every turn for no benefit (bootstrap files always load in full regardless).

## Progressive Disclosure Layout

```
Personality files/
├── IDENTITY.md          ← slim card (injected)
├── SOUL.md              ← Sections I–VII (injected)
├── soul/
│   └── detail.md        ← persona archive (on demand)
├── USER.md              ← preferences index (injected)
├── user/
│   ├── schedule.md      ← full rhythm & comms (on demand)
│   ├── projects.md      ← project registry (on demand)
│   └── context.md       ← background & style (on demand)
├── AGENTS.md            ← core ops + Carlos protocol + index (injected)
├── agents/
│   └── detail.md        ← group chat, heartbeat (on demand)
├── TOOLS.md             ← environment facts + short pointers (injected)
├── tools/
│   ├── cursor-acp.md    ← full Cursor/ACP reference (on demand)
│   └── gws.md           ← full Google Workspace reference (on demand)
├── HEARTBEAT.md
├── memory/
│   ├── INDEX.md         ← map of memory/ (on demand)
│   ├── linkdeveloper.md            ← has sections: frontmatter
│   ├── linkdeveloper-alignment.md  ← has sections: frontmatter
│   ├── gws-capabilities.md
│   ├── evals/
│   └── YYYY-MM-DD.md    ← daily raw logs
├── openclaw.json        ← runtime config (deploy to ~/.openclaw-lisa/, not workspace)
└── PERSONALITY_WORKFLOW.md  ← operator doc (do not deploy)
```

**Rule for any new reference file (tools, skills, or memory):** decide up front whether it's bootstrap (always needed, keep it short) or on-demand (give it frontmatter with `read_when`, and add one line to `AGENTS.md`'s Progressive Disclosure list or the relevant folder's `INDEX.md`). If a file is going to grow past a few thousand characters and gets read often, add a `sections:` list to its frontmatter rather than letting it become a whole-file-or-nothing read.

## Folders

**Working copies (edit here):**

`/Users/linktrend/Documents/LiNKwork/Openclaw Lisa Prime/Personality files/`

**Runtime workspace (deploy target):**

`/Users/linktrend/.openclaw-lisa/workspace`

**Runtime config (deploy separately):**

`/Users/linktrend/.openclaw-lisa/openclaw.json`

**Do not deploy:** `PERSONALITY_WORKFLOW.md`, `openclaw.json` (goes to state dir, not workspace).

## Safe Deploy Workflow

1. Edit and review files in `Personality files/`.
2. Copy personality files to workspace (include `user/`, `agents/`, `soul/`, `tools/`, `memory/` subfolders):

```bash
cp "/Users/linktrend/Documents/LiNKwork/Openclaw Lisa Prime/Personality files/"*.md \
   "/Users/linktrend/.openclaw-lisa/workspace/"
cp -R "/Users/linktrend/Documents/LiNKwork/Openclaw Lisa Prime/Personality files/user" \
      "/Users/linktrend/Documents/LiNKwork/Openclaw Lisa Prime/Personality files/agents" \
      "/Users/linktrend/Documents/LiNKwork/Openclaw Lisa Prime/Personality files/soul" \
      "/Users/linktrend/Documents/LiNKwork/Openclaw Lisa Prime/Personality files/tools" \
      "/Users/linktrend/Documents/LiNKwork/Openclaw Lisa Prime/Personality files/memory" \
      "/Users/linktrend/.openclaw-lisa/workspace/"
```

Note: `PERSONALITY_WORKFLOW.md` is a `.md` file at the root of the source folder but must **not** be deployed — it's an operator doc, not a Lisa file. If using a blanket `*.md` copy, delete it from the workspace copy afterward, or copy files explicitly instead of with a glob.

3. Copy config when changed:

```bash
cp "/Users/linktrend/Documents/LiNKwork/Openclaw Lisa Prime/Personality files/openclaw.json" \
   "/Users/linktrend/.openclaw-lisa/openclaw.json"
```

4. Restart Lisa (`~/.openclaw-lisa/start-lisa.sh`).

5. Run `/context list` — verify injected sizes; no unexpected TRUNCATED on core files.

## After Deploy — Smoke Test

| Test                             | Expected                                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Simple factual question          | Mode A, concise                                                                                                                      |
| `plan this` or `Lisa, strategic` | Mode B four-part structure                                                                                                           |
| Irreversible decision            | Offers strategic breakdown; does not auto-switch                                                                                     |
| After Mode B                     | Reverts to Mode A                                                                                                                    |
| High-stakes ambiguous            | MCQs (≤3)                                                                                                                            |
| Low-stakes unclear               | Proceeds with stated assumptions                                                                                                     |
| Schedule question                | Reads `user/schedule.md` if needed                                                                                                   |
| Project classification           | Reads `user/projects.md`                                                                                                             |
| Cursor delegation request        | Calls `sessions_spawn` runtime `acp` agentId `cursor`; on failure, quotes error and stops (doesn't fall back to subagent/self-write) |
| gws question                     | Reads `tools/gws.md` if the `TOOLS.md` summary isn't enough; never execs `gws keep`                                                  |
| LiNKdeveloper heading lookup     | Uses `Grep` on `memory/linkdeveloper.md`'s heading text rather than reading the whole file for a narrow question                     |

## Token Budget (measured 2026-07-14, after the v1.3 progressive-disclosure pass)

Bootstrap files (always injected, every turn):

| File                | Chars                         | Notes                                                                     |
| ------------------- | ----------------------------- | ------------------------------------------------------------------------- |
| AGENTS.md           | ~13.5k                        | Core ops, Carlos protocol, progressive-disclosure index                   |
| TOOLS.md            | ~7.1k                         | Was ~17.4k before this pass — gws and Cursor/ACP detail moved to `tools/` |
| SOUL.md             | ~6.2k                         |                                                                           |
| USER.md             | ~4.1k                         |                                                                           |
| IDENTITY.md         | ~1.9k                         |                                                                           |
| HEARTBEAT.md        | ~1.2k                         |                                                                           |
| **Bootstrap total** | **~34k chars (~8.5k tokens)** | Down from ~44.5k chars (~11k tokens) before this pass                     |

Real measured floor per fresh request (from gateway logs, includes tool-schema/system overhead on top of the bootstrap files): was **~14,000 tokens** before this pass. Re-measure after deploy with `/context list` or by checking a fresh session's `estimatedPromptTokens` in `gateway.log` — expect roughly **10,500–11,500 tokens**, a reduction of about 20–25%.

On-demand files (only loaded when relevant — not part of the floor):

| File                              | Chars                                                                             |
| --------------------------------- | --------------------------------------------------------------------------------- |
| tools/gws.md                      | ~10.4k                                                                            |
| tools/cursor-acp.md               | ~2.7k                                                                             |
| user/schedule.md                  | ~5.3k                                                                             |
| user/projects.md                  | ~5.6k                                                                             |
| agents/detail.md                  | ~5.0k                                                                             |
| memory/linkdeveloper.md           | ~11.4k (now has `sections:` frontmatter — read by heading, not always whole-file) |
| memory/linkdeveloper-alignment.md | ~10.0k (now has `sections:` frontmatter)                                          |
| memory/gws-capabilities.md        | ~1.5k                                                                             |
| memory/INDEX.md                   | ~1.4k                                                                             |
| user/context.md                   | ~1.7k                                                                             |
| soul/detail.md                    | ~2.0k                                                                             |

OpenClaw caps: 20k chars/file, 60k total bootstrap. Stay under caps; use `/context list` to verify. Nothing here is close to the per-file cap; the 2026-07-14 pass was about removing duplication and cutting the always-loaded floor, not fitting under caps.

## Runtime Profile

- `openclaw --profile lisa ...`
- Workspace: `/Users/linktrend/.openclaw-lisa/workspace`
