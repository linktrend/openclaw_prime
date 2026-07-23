# Tool Access Trimmed to CEO/Delegator Role (2026-07-15)

**Status: Done, verified, deployed.**

## Why

A prior session's cache-trace diagnostic (see `audit/06-prompt-cache-verification.md`) incidentally revealed Lisa registers 27 tools per turn under OpenClaw's default `tools.profile: "coding"` — a generic profile, not tuned to what Lisa actually is. Carlos described Lisa's real role: a CEO-style delegator/orchestrator who thinks, decides, delegates, and oversees — not a hands-on coder or media producer.

## What Carlos decided

- **Denied outright:** `music_generate`, `video_generate`, `image_generate` — no venture-studio use case for Lisa personally generating media.
- **Denied outright:** `edit`, `apply_patch` — "any coding Lisa should delegate to Cursor and oversee Cursor." These were the most code-shaped tools left in her kit.
- **Denied outright:** `skill_workshop` — Carlos arms Lisa with skills deliberately. If she's missing one, she should say so and ask, not author her own.
- **Kept, including borderline "Unsure" items resolved by discussion:** everything else — project/goal tracking (`get_goal`/`create_goal`/`update_goal`/`update_plan`), delegation/oversight (`sessions_*`, `subagents`, `session_status`), research (`web_search`/`web_fetch`), continuity (`memory_search`/`memory_get`), her own notes/drafts (`read`/`write`), orchestration execution (`exec`/`process`), scheduling (`cron`), and visual review (`image`).

## What was implemented

1. `openclaw --profile lisa config set tools.deny '["music_generate","video_generate","image_generate","edit","apply_patch","skill_workshop"]'` — applied at the top-level `tools` config (same scope as `tools.profile`), not per-agent, since Lisa is the only agent.
2. Restarted Lisa, re-ran the cache-trace tool-count check: **27 → 21 tools**, and the tool-names list confirmed exactly the 6 denied tools are gone and nothing else was affected.
3. Found and fixed a **behavior gap the tool-deny alone didn't close**: with `edit`/`apply_patch` gone, `TOOLS.md`/`AGENTS.md` still described "Lisa-direct coding (rare)" as a routing option — stale and now actively wrong. Updated both to state coding always delegates to Cursor.
4. Found and fixed a **second, more important behavior gap**: asked Lisa directly "if you don't have a skill, what do you do?" — she answered from OpenClaw's _default_ skill-acquisition doctrine (try ClawHub install, then author one via `skill-creator`), which denying the `skill_workshop` tool did not override, since skill authoring can happen via `write` (not denied) following a default skill's instructions rather than through the `skill_workshop` tool specifically. Added an explicit Red Line to `AGENTS.md`: Lisa must never author or install her own skills; if one's missing, report the gap and ask Carlos. Re-tested — she now gives the correct answer.

## Verification (live, not assumed)

- `openclaw --profile lisa config get tools` shows the exact denylist.
- Live tool-count check via cache trace: 21 tools, exact expected names, before cleanup of the diagnostic file.
- Behavioral test 1: asked Lisa directly if she can edit code — she correctly said no and named the 2026-07-15 decision, offering to route to Cursor instead.
- Behavioral test 2: asked Lisa what she does when missing a skill — before the `AGENTS.md` fix, she described self-service acquisition (ClawHub/skill-creator); after the fix, she correctly describes stopping and asking Carlos.
- Config synced and byte-identical between live (`~/.openclaw-lisa/`) and repo (`Personality files/`) at every step; Lisa restarted clean after each change.

## Not done

- Did not touch the "Unsure" items Carlos resolved as keep (`get_goal`/`create_goal`/`update_goal`/`update_plan` stay; they map directly to the PM/oversight parts of the CEO description).
- Did not deny `code_execution`, `x_search`, or `bundle-mcp` — these were already absent from Lisa's actual 27/21-tool list (not currently active, likely missing required plugin/API config), so there was nothing to deny.
