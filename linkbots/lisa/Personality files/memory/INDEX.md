---
type: MemoryIndex
title: Lisa Memory Folder — Index
description: One-line map of everything in memory/ so nothing has to be opened by guesswork
load: on_demand
read_when:
  - Before opening any memory/*.md file, if AGENTS.md didn't already name the exact file
  - Carlos asks "what do you remember about X"
  - After a new memory file is added, to confirm it's indexed
tags: [memory, index]
---

# Memory Folder — Index

Check this file first if you need something from `memory/` and `AGENTS.md` or root `MEMORY.md` did not already point you at the exact file. Read only the entry you need below, then open that specific file (using its own `sections:` frontmatter if it has one — see `AGENTS.md` § Progressive Disclosure). For Venture Studio / work briefings, go through `studio/INDEX.md` instead of guessing filenames.

## Files

- **`2026-07-10.md`** — Daily raw log for 2026-07-10; skim only when reconstructing that date.
- **`2026-07-21.md`** — Daily raw log for 2026-07-21; skim only when reconstructing that date.
- **`2026-07-22.md`** — Daily raw log for 2026-07-22; skim only when reconstructing that date.
- **`battery-monitor.md`** — Durable append-only Battery Monitoring reports, projections, prompts, confirmations, warnings, and 35% alert notes. Private to Telegram workflows.
- **`battery-monitor-state.json`** — Machine-readable current Battery Monitoring state, learned rates, projections, routine changes, pendingAlert35, and active alert IDs. Update only from reported/confirmed information.
- **`gws-capabilities.md`** — Short doctrine note: which Google Workspace services work via `gws` CLI (calendar, tasks, drive, gmail) vs Keep (UI-only, not CLI). For the full command/scope/security reference, use `tools/gws.md` instead.
- **`linkdeveloper.md`** — LiNKdeveloper naming dictionary, triggers, gates, stage map, monitoring/approval workflow, stalled-agent recovery, anti-confusion rules. Read before/during Cursor supervision work. Has `sections:` frontmatter.
- **`linkdeveloper-alignment.md`** — Carlos's original study-and-alignment mission prompt for LiNKdeveloper. Re-read before a first supervised session or after a long gap. Has `sections:` frontmatter.

## Folders

- **`evals/README.md`** — Protocol and context for model evaluation logs.
- **`evals/2026-07-09-phase-a-baseline-deepseek.md`** — Phase A DeepSeek baseline eval log.
- **`evals/2026-07-10-coding-deepseek.md`** — DeepSeek coding eval log.
- **`evals/2026-07-10-coding-nemotron.md`** — Nemotron coding eval log.
- **`evals/2026-07-10-daily-ops-deepseek.md`** — DeepSeek daily-ops eval log.
- **`evals/2026-07-10-daily-ops-nemotron.md`** — Nemotron daily-ops eval log.
- **`evals/2026-07-10-nemotron-eval-summary.md`** — Summary verdict for 2026-07-10 Nemotron evals.
- **`../studio/INDEX.md`** — Venture Studio / work briefing map. Use this before opening any `studio/*.md` briefing.

## Maintenance rule

When a new file is added to `memory/`, add one line here in the same turn (or flag it to Carlos if you can't). This index only stays useful if it's kept current — an out-of-date index is worse than no index, because it creates false confidence that everything is listed.
