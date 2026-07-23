---
type: LiNKdeveloperReference
title: LiNKdeveloper — System Reference
description: Naming dictionary, triggers, gates, stages, monitoring workflow, anti-confusion rules
load: on_demand
read_when:
  - Carlos mentions LiNKdeveloper, IDE Development, or Link development
  - Carlos says "LiNKdeveloper is running"
  - Supervising Cursor agents on venture development work
  - Resolving naming confusion between LiNKdeveloper and retired systems
tags: [linkdeveloper, cursor, gates, supervision]
sections:
  - heading: "## Naming dictionary"
    summary: Correct vs retired names; what never to conflate (Application Factory, Factory operations blueprint, LiNKoffice, LiNKsites)
  - heading: "## One system, three sources"
    summary: IDE Development core + gstack + mattpocock skills — how the three sources relate
  - heading: "## Three triggers only"
    summary: New idea / PRD in hand / existing software — the only three ways work starts
  - heading: "## Lifecycle spine"
    summary: Intent to Complete pipeline; proof/review/integration rule
  - heading: "## Gates"
    summary: Which gates Carlos holds in Stage 1, what agents handle, and how the executor role changes across Stage 1/2/3
  - heading: "## Monitoring and approval workflow"
    summary: What Lisa can/cannot see, activation phrase, the check sequence, when to contact Carlos, stalled-agent recovery for both IDE-GUI and ACP stalls
  - heading: "## Anti-confusion rules"
    summary: Six hard rules — never restore archived repos, never conflate blueprints, etc.
---

# LiNKdeveloper — System Reference

**Canonical operator doc:** `/Users/linktrend/Projects/IDE Development/docs/LINKDEVELOPER-OPERATIONS-MANUAL.md` — if memory, chat, or old docs disagree with the manual, the manual wins.

**Full alignment study prompt:** `memory/linkdeveloper-alignment.md` — re-read before first supervised session or after a long gap.

---

## Naming dictionary

### Live system (use for all Stage 1 work today)

**LiNKdeveloper** — product name for the venture development system. Say this name when talking to Carlos.

**IDE Development** — local folder and git repo that _is_ LiNKdeveloper Stage 1. Path: `/Users/linktrend/Projects/IDE Development`. GitHub: `linktrend/IDE-Development`. Same system as LiNKdeveloper — folder name and product name differ in spelling only, not in meaning. Never treat them as two products.

**LiNKdeveloper workspace** — Cursor workspace file grouping the system repo with active product repos: `~/Projects/Workspaces/LiNKdeveloper.code-workspace`.

### Retired — do not use as live systems

**LiNKdev** — archived experiment. History only.

**LiNKdeveloper** (old repo at `/Projects/LiNKdeveloper`) — archived Stage 2 runtime reference only. Read-only concepts; not the active daily system.

**Embedded `LiNKdev/` folders** in product repos — legacy remnants. Do not bootstrap from them.

If you see `LiNKdev`, old `Projects/LiNKdeveloper`, or `linkdev-*` commands — that is history, not doctrine. Archive index: `docs/ARCHIVE-INDEX.md` inside IDE Development.

### Do not invent or conflate

- **IDE Developer** — not a real name
- **Application Factory** — development workflow inside LiNKdeveloper (`Intent → … → Complete`)
- **Factory operations blueprint** — separate planning doc for Website/Automation/Content production lines — not the same as Application Factory daily dev
- **LiNKoffice** — strategy/docs workspace (`Documents/LiNKtrend`) — not LiNKdeveloper
- **LiNKsites** — a product repo in the workspace — not the system repo

---

## One system, three sources

1. **IDE Development core** — canonical knowledge in `core/`; `.cursor/` is the Cursor runtime surface (mostly symlinks into `core/`)
2. **gstack** — macro orchestration, vendored at `IDE Development/core/runtime/skills/gstack/`
3. **mattpocock/skills** — micro execution, vendored at `IDE Development/core/runtime/skills/mattpocock/`

Agents route across all three via the hybrid registry. Say "IDE Development core", "gstack", "mattpocock skills" — not Layer 1/2/3 when speaking to Carlos.

---

## Three triggers only

Every session starts with exactly one trigger. Application vs factory is a routing decision inside each trigger, not a fourth trigger.

**Trigger 1 — New idea:** Interview → spec/PRD → Carlos approves → route and develop (application from LiNKapps starter kit, or factory product per Factory Operations blueprint).

**Trigger 2 — PRD in hand:** Clarify gaps → Carlos approves → route and develop.

**Trigger 3 — Existing software:** Assess → plan (Carlos approves if unclear/high-impact) → develop.

---

## Lifecycle spine

```
Intent → Program → Module → Phase → Issue → Proof → Review → Integration → Complete
```

Readiness is computed from artifacts and state, not assumed. Every issue passes proof → review → integration. Review inspects proof, not confidence.

---

## Gates

### Carlos holds (Stage 1 human gates)

1. **Spec/PRD approval** — primary gate; nothing substantial starts without it
2. **Program gate** — formal program scope
3. **Module gate** — module decomposition before end-to-end execution
4. **Launch/release gate** — ship or go live

### Agents handle (with Carlos oversight available)

Issue implementation, proof collection, independent review, integration recording.

### Stage evolution

Gate structure stays the same across stages. What changes is the executor between gates: Carlos in Stage 1, OpenClaw executives in Stages 2 and 3. Policy gates (spec/PRD, release) stay human until a written migration says otherwise.

**Stage 1 (now):** Semi-manual. Carlos holds primary human gates. Cursor agents do detailed work and stop at approval points.

**Stage 2 (next):** OpenClaw executive agents replace Carlos as primary executor between gates. Carlos retains policy gates. Telegram is the executive notification surface.

**Stage 3 (future):** Full lifecycle autonomy. Human involvement reduces to strategic policy decisions only.

---

## Monitoring and approval workflow

### What monitoring is (and is not)

LiNKdeveloper supervision is **artifact- and ACP-session-driven**, not live IDE chat visibility. Readiness is computed from filesystem state (proof, review, integration records) and session metadata — not from watching Carlos type in Cursor.

**Lisa CAN:**

- **List ACP Cursor sessions** she or OpenClaw spawned (`sessions.list` / ACP manager — monitorable `runtime: "acp"` sessions only)
- **Read agent transcripts on disk** — past agent-driven chats saved as `.jsonl` under `~/.cursor/projects/<workspace-slug>/agent-transcripts/` (tail recent files for stall/blocker signals)
- **Poll proof and gate artifacts** in active LiNKdeveloper product repos — proof files, review records, integration logs, `git status` / recent commits in workspace repos
- **Read the Operations Manual and system repo** for expected lifecycle stage vs what artifacts exist

**Lisa CANNOT:**

- See **live Cursor IDE Composer chat** Carlos started manually in the GUI
- Stream or mirror GUI typing in real time
- Observe Cursor IDE sessions that were never spawned via ACP and left no transcript on disk

**Best visibility:** Carlos delegates complex dev through Lisa (`sessions_spawn` with `runtime: "acp"`, `agentId: "cursor"`). Those sessions are listable, transcript-backed, and align with supervision rules. Manual GUI Cursor work is Carlos's hands-on lane — Lisa learns about it via artifacts, transcripts (if written), or Carlos telling her.

### Activation and check sequence

**Activation:** Carlos says **"LiNKdeveloper is running"** (or equivalent) — enter monitoring mode.

**When activated (or when Carlos asks for a status check), Lisa runs this sequence:**

1. **ACP sessions** — list active Cursor ACP sessions; note running, idle, blocked, or completed states
2. **Gate/proof artifacts** — scan active product repos in the LiNKdeveloper workspace for new or changed proof, review, or integration files; compare against expected lifecycle stage
3. **Recent transcripts** — read the latest `.jsonl` agent transcripts for LiNKdeveloper workspace projects (if present) for stall, gate, or input-needed signals
4. **Report on Telegram** — summarize findings: which repo/session, what state, what gate or blocker
5. **Ask before acting** — wait for Carlos's explicit approval before any Cursor interaction (ACP spawn, continue, gate response, send input)

**Repeat checks:** On Carlos's request, at Review Period times (`USER.md` § Schedule), or via heartbeat **only if** Carlos has enabled heartbeat in `openclaw.json` **and** approved LiNKdeveloper polling in `HEARTBEAT.md`. Heartbeat is currently **disabled** (`every: 0m`) — do not assume automatic 30-minute polling.

**If action is required with Cursor:**

1. Contact Carlos on Telegram (`@lisaprime_bot` DM)
2. Explain what you observed — which agent/repo, what state, what gate or prompt, which artifact or transcript line supports it
3. Wait for Carlos's explicit approval
4. Only then interact with Cursor (ACP spawn, continue, gate response, send input)

**Forbidden while monitoring mode is active:** Silent Cursor interaction, assuming gate approval, inventing the first mission, substituting internal subagent work for Cursor, or claiming visibility into live GUI chat you do not have.

### Stalled agent recovery

Use when Carlos reports a stuck Cursor agent, or monitoring/transcripts show no progress.

**IDE GUI stall (manual Composer):**

- Lisa **cannot** type into IDE Composer or drive the GUI.
- Read **agent transcripts on disk**: `~/.cursor/projects/<workspace-slug>/agent-transcripts/*.jsonl` (tail recent files for the LiNKdeveloper workspace slug).
- **Alert Carlos on Telegram** with repo/session context, last transcript signals, and what input or gate is likely needed.
- Recovery is Carlos in the IDE, or Carlos approves Lisa spawning a **new** ACP session — not Lisa typing in Composer.

**ACP stall (OpenClaw-spawned Cursor):**

- Inspect sessions with the Lisa profile CLI (verified OpenClaw 2026.6.11):
  - `openclaw --profile lisa sessions list` — list stored sessions (alias: `openclaw --profile lisa sessions`)
  - `openclaw --profile lisa sessions list --json` — machine-readable
  - `openclaw --profile lisa sessions tail --session-key <key>` — tail trajectory (add `--follow` to watch)
- Session store default: `~/.openclaw-lisa/agents/main/sessions/sessions.json`
- After **Carlos's explicit approval**, inject continuation via **ACP resume/spawn** (`sessions_spawn` / `runtime: "acp"`, `agentId: "cursor"`) — never via GUI Composer.

**Multi-repo:**

- Scan **all workspace folders** in `~/Projects/Workspaces/LiNKdeveloper.code-workspace` for gate/proof artifacts (proof, review, integration records) — a stall in one repo may be waiting on artifacts or gates in another.

**Deactivation:** Carlos says LiNKdeveloper is stopped, finished, or pauses monitoring — return to normal supervision rules in `AGENTS.md`.

**First supervised mission:** TBD. Carlos will brief. Do not invent or start work until briefed.

---

## Anti-confusion rules

1. Never install, wire, or extend archived repos (LiNKdev, old Stage 2 runtime) as live dependencies
2. Never restore `/Projects/LiNKdeveloper` as a live folder
3. Factory operations blueprint is planning only — no live Supabase/ledger/n8n infrastructure exists yet
4. Do not conflate Application Factory development with factory operations production lines
5. Stage 1 is live; Stage 2 orchestration is preparation — do not claim OpenClaw factory orchestration is running unless Carlos says so
6. Route development executors at the LiNKdeveloper workspace and bootstrap read order — not at LiNKoffice unless the task is strategy/docs only

---

_Maintained by Carlos and Lisa. Update when LiNKdeveloper stages or Carlos delegation rules change._
