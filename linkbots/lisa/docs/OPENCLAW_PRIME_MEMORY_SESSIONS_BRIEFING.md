# Openclaw Prime Memory, Sessions, Threads, and Compaction Briefing

**Date:** 2026-07-22
**Audience:** another AI operator or agent taking over operational context
**Primary name:** Openclaw Prime. The historical profile name is `lisa`, and many runtime paths, job names, files, and tools still use `lisa`.

## 1. System Identity and Source of Truth

Openclaw Prime is Carlos's OpenClaw instance for LiNKtrend Venture Studio operations. She is configured as the `main` agent in the OpenClaw `lisa` profile.

The authoritative live runtime state is under:

- `/Users/linktrend/.openclaw-lisa/openclaw.json` - live runtime config.
- `/Users/linktrend/.openclaw-lisa/workspace/` - live workspace injected into Openclaw Prime.
- `/Users/linktrend/.openclaw-lisa/agents/main/` - main-agent runtime state, session files, plugin state, and caches.

The editable personality mirror is:

- `/Users/linktrend/Documents/LiNKwork/Openclaw Lisa Prime/Personality files/`

That mirror is the source copy Carlos edits and deploys into the live workspace, but it is not automatically authoritative when it differs from `/Users/linktrend/.openclaw-lisa/`. For example, as of this briefing the live `HEARTBEAT.md` has the current heartbeat schedule without 08:45, while the personality mirror still contains an older 08:45 entry. For operational decisions, read live state first.

The runtime profile is `openclaw --profile lisa`. The default workspace in live config is `/Users/linktrend/.openclaw-lisa/workspace`.

The main agent's visible identity in config is still `Lisa`, with the operational theme "strategic operations lead." For this briefing, call the instance Openclaw Prime.

## 2. Sessions and Threads

Openclaw Prime wakes fresh in each session. Continuity is not guaranteed by the model's chat window alone. Durable continuity comes from files and indexed memory.

Main session behavior:

- Main conversational work routes to the `main` agent.
- The global session setting is `session.dmScope: "main"`.
- Carlos's Telegram DM, including a Telegram reply to an isolated cron announcement, routes back to `agent:main:main` rather than to the isolated cron run that sent the announcement.
- Direct one-to-one chats should receive normal visible replies. Group chats have stricter silence rules.

Channel state:

- Telegram is enabled and paired by DM policy.
- Google Chat is enabled and paired by DM policy.
- UI preferences hide thinking/tool calls and do not persist commentary in chat.
- Main DM continuity is intentionally centralized so Carlos's replies do not get stranded inside short-lived cron sessions.

Subagents and delegated sessions:

- The live config defines `main`, `cursor`, and `local-coder`.
- `cursor` is an ACP runtime backed by `cursor-agent acp`, with model `grok-4.5[effort=high,fast=true]`.
- `local-coder` is an isolated local coding worker in `/Users/linktrend/.openclaw-lisa/workspace-local-coder`, using `ollama/qwen3.5:9b` by default.
- Subagents and cron sessions inject a reduced bootstrap set: `AGENTS.md`, `SOUL.md`, `USER.md`, `IDENTITY.md`, and `TOOLS.md`. They do not get `MEMORY.md` as main-session injected memory.
- `local-coder` has denied access to messaging, cron, browser/group tools, and session-spawning tools. It is meant to produce host scratch artifacts and report back, not act as Carlos's communicator.

Session files:

- Main session files live under `/Users/linktrend/.openclaw-lisa/agents/main/sessions/`.
- The current known reset/archive session is `dd61989f-f222-4bf8-826a-8caecec7b128`.
- Its reset file exists at `/Users/linktrend/.openclaw-lisa/agents/main/sessions/dd61989f-f222-4bf8-826a-8caecec7b128.jsonl.reset.2026-07-19T22-54-26.219Z`.
- Its trajectory pointer is `/Users/linktrend/.openclaw-lisa/agents/main/sessions/dd61989f-f222-4bf8-826a-8caecec7b128.trajectory-path.json`, pointing to the live runtime trajectory JSONL for that session.
- A SQLite import archive also exists at `/Users/linktrend/.openclaw-lisa/agents/main/session-sqlite-import-archive/archive-tier.dd61989f-f222-4bf8-826a-8caecec7b128.trajectory.jsonl.imported-1784521525284`.

Do not delete reset or archive files. They are operational evidence and may be needed for recovery or audit.

## 3. Chat History and Compaction

Chat history is useful but not durable enough to be treated as memory.

Compaction is OpenClaw's process for keeping a long-running session within context limits by summarizing or pruning earlier conversation content. It may preserve a summary of older turns, but it does not preserve every detail, every tool result, or every implicit assumption. It is a context-management tool, not a memory system.

What survives compaction:

- The current compacted context summary.
- Files explicitly written to the workspace.
- Session JSONL / trajectory artifacts on disk.
- Durable memory files such as `MEMORY.md`, `memory/*.md`, and `studio/*.md`.

What may not survive compaction:

- Full verbatim chat history inside the active prompt.
- Unwritten decisions, informal mental notes, and tool output that was never recorded.
- Details inside isolated subagent or cron turns unless copied into a file or recoverable from session logs.

Operator rule: if the fact matters after a restart, write it to the correct memory or briefing file. Do not rely on "the model should remember."

## 4. Progressive Disclosure Memory Pyramid

Openclaw Prime's memory is deliberately progressive. The system should start with small indexes and only open detail files when needed.

Main memory path:

1. `/Users/linktrend/.openclaw-lisa/workspace/MEMORY.md`
2. `/Users/linktrend/.openclaw-lisa/workspace/memory/INDEX.md`
3. The exact detail file named by the index

Venture Studio and work briefings path:

1. `MEMORY.md`
2. `memory/INDEX.md`
3. `studio/INDEX.md`
4. The exact `studio/*.md` briefing named by the index

Current `MEMORY.md` says:

- Start there only for high-level orientation.
- Open `memory/INDEX.md` before any `memory/*.md` file unless another injected file names the exact file.
- For Venture Studio and work briefings, go through `studio/INDEX.md`.
- Daily raw logs are `memory/YYYY-MM-DD.md`; they are not curated summaries.
- Never assume studio briefings are missing because they are not pasted into `MEMORY.md`.

Current indexed studio briefings include:

- `README.md`
- `carlos-briefing.md`
- `future-integration.md`
- `gws-migration.md`
- `legal-cases.md`
- `linkmedia-programs.md`
- `linktrading.md`

Do not open memory or studio files by guesswork. Read the index, then open the one file needed.

## 5. Daily Logs vs Curated Memory vs Studio Briefings

There are three different layers. Do not collapse them.

Daily logs:

- Location: `/Users/linktrend/.openclaw-lisa/workspace/memory/YYYY-MM-DD.md`.
- Purpose: raw daily operational notes, battery events, calendar changes, implementation breadcrumbs, temporary state, and pending items.
- Status: useful for reconstruction, not automatically authoritative as a curated summary.

Curated `MEMORY.md`:

- Location: `/Users/linktrend/.openclaw-lisa/workspace/MEMORY.md`.
- Purpose: lean startup summary and routing map.
- Scope: long-term memory for the main session only.
- Rule: do not invent contents that are not present. If something belongs there, update it explicitly.

Studio briefings:

- Location: `/Users/linktrend/.openclaw-lisa/workspace/studio/`.
- Purpose: durable domain briefings for Venture Studio/work context.
- Index: `/Users/linktrend/.openclaw-lisa/workspace/studio/INDEX.md`.
- Rule: do not rewrite or summarize briefing bodies in place unless explicitly tasked. Open only the briefing needed.

Heartbeat memory maintenance may periodically read recent daily logs and distill durable lessons into `MEMORY.md`, but daily logs themselves are not a substitute for curated memory.

## 6. Memory Search and Embeddings

Live memory search config currently uses Ollama embeddings:

- Provider: `ollama`
- Model: `nomic-embed-text`
- Default indexed source: memory files
- Main-agent extra path: `studio/`

This replaced a broken OpenAI embedding path. OpenAI embeddings were unusable due to quota/availability problems, so memory search was moved to local Ollama `nomic-embed-text`.

The important live config entries are:

- `agents.defaults.memorySearch.provider = "ollama"`
- `agents.defaults.memorySearch.model = "nomic-embed-text"`
- `agents.list[id="main"].memorySearch.extraPaths = ["studio/"]`

Why `extraPaths: ["studio/"]` matters:

- The default memory search is described as indexing `MEMORY.md` and `memory/*.md`.
- Studio briefings live outside `memory/`, under `studio/`.
- Without `studio/` as an extra path, semantic search may miss the Venture Studio briefings even though the files exist.

Lock issue note:

- During the embedding/indexing work, lock contention and stale locking problems were fixed so reindexing could proceed reliably.
- If search appears stale, do not delete briefings. Reindex memory search and check locks/cache health first.

If Openclaw Prime "can't find" a briefing, assume search/indexing may be stale before assuming the file is gone.

## 7. Dreaming

In OpenClaw's memory system, "dreaming" means an offline memory-promotion process. It reviews short-term material and promotes useful content into durable memory artifacts. It is separate from normal chat, heartbeat, and compaction.

Runtime support exists in the OpenClaw fork. The memory dreaming defaults are:

- Enabled by default: false.
- Default frequency if enabled: `0 3 * * *`.
- Managed cron name: `Memory Dreaming Promotion`.
- Managed cron tag: `[managed-by=memory-core.short-term-promotion]`.
- Default storage mode: separate, so phase blocks do not pollute daily memory files.

Dreaming phases in the runtime model:

- Light dreaming: looks at daily logs, sessions, and recall. Defaults to a 2-day lookback and cheap/low-thinking execution.
- Deep dreaming: looks at daily logs, curated memory, sessions, logs, and recall. Defaults to higher thinking, scoring thresholds, and promotion limits.
- REM dreaming: looks for patterns across memory, daily notes, and deep-dream artifacts.

Current Openclaw Prime caveat:

- The live `/Users/linktrend/.openclaw-lisa/openclaw.json` does not declare an explicit memory-core dreaming config enabling dreaming.
- Therefore, do not assume a dreaming cron is active unless you verify the live cron list or plugin state.
- If enabled later, dreaming should read files and session/recall sources, produce separate reports or promotions, and leave durable memory changes auditable.

Dreaming is not heartbeat:

- Heartbeat is a scheduled operational check and Telegram reporting cycle.
- Dreaming is memory consolidation/promotion.

Dreaming is not compaction:

- Compaction preserves enough context to continue a long chat.
- Dreaming decides what short-term material deserves durable memory.

Dreaming is not a replacement for explicit operator memory writes. If Carlos says "remember this," update memory files directly.

## 8. Heartbeat and Memory Isolation

Visible heartbeats are cron-driven, not native free-running OpenClaw heartbeats.

Live schedule:

- `lisa-heartbeat-45` runs at 00:45, 02:45, 04:45, 10:45, 12:45, 14:45, 16:45, 18:45, 20:45, and 22:45 Asia/Taipei.
- `lisa-morning-digest` runs at 06:45.
- `battery-selfie-1745` and `battery-selfie-2145` run at 17:45 and 21:45.
- `battery-monitor-alert-35` is event-driven.

Native heartbeat is disabled with `every: "0m"` because it has no reliable wall-clock `:45` anchor.

Each heartbeat cycle runs in an isolated fresh session with no conversation history. The heartbeat must use tools and files to discover state:

- `memory/battery-monitor.md`
- `memory/battery-monitor-state.json`
- session state via native session tools
- cron state
- calendar/email/tasks wrappers where allowed

The heartbeat must not infer from chat memory. It must not invent status. It must use the output format in live `HEARTBEAT.md`.

Important isolation rule: isolated cron jobs cannot use the normal cron tool to add/update/remove other jobs. For the 35% battery alert, digest may write pending state only; main session or `lisa-heartbeat-45` must reconcile/schedule with the permitted path.

## 9. Checklist: When Openclaw Prime "Can't Find" Briefings

Use this checklist before declaring anything missing.

1. Confirm you are using the live workspace, not only the personality mirror:
   - `/Users/linktrend/.openclaw-lisa/workspace/`

2. Read root memory first:
   - `/Users/linktrend/.openclaw-lisa/workspace/MEMORY.md`

3. Follow the index chain:
   - `memory/INDEX.md`
   - `studio/INDEX.md`

4. Verify the briefing file exists under:
   - `/Users/linktrend/.openclaw-lisa/workspace/studio/`
   - or the personality mirror at `/Users/linktrend/Documents/LiNKwork/Openclaw Lisa Prime/Personality files/studio/`

5. Check memory-search config:
   - provider should be `ollama`
   - model should be `nomic-embed-text`
   - main agent should include `extraPaths: ["studio/"]`

6. If semantic search misses it, do not conclude the file is absent:
   - open `studio/INDEX.md` directly
   - reindex memory search if needed
   - inspect lock/cache health if reindexing stalls

7. If a live file and personality mirror disagree:
   - use live `/Users/linktrend/.openclaw-lisa/` for current behavior
   - use the mirror to prepare deployable edits
   - do not silently overwrite one with the other

8. If the needed context is in daily logs:
   - use `memory/INDEX.md` to identify the daily file
   - treat the daily log as raw reconstruction evidence, not curated truth

## 10. Red Lines and Don'ts

Do not delete `studio/` briefings. They are durable Venture Studio context.

Do not assume a briefing is missing because it is not pasted into `MEMORY.md`. The design is progressive disclosure.

Do not invent `MEMORY.md` contents. Read it and quote or summarize only what is actually present.

Do not open random `memory/*.md` or `studio/*.md` files by guesswork. Use the indexes.

Do not treat compaction as durable memory. Write important facts to files.

Do not treat daily raw logs as curated memory. Distill them before promoting lessons to `MEMORY.md`.

Do not use stale personality mirror files as live truth when they conflict with `/Users/linktrend/.openclaw-lisa/`.

Do not delete session reset/archive artifacts, including the `dd61989f` reset/archive files.

Do not rely on isolated heartbeat or cron session memory. Those runs start fresh and must read files/tools.

Do not make Google Workspace or credential assumptions from memory. For Google tooling, follow the live `AGENTS.md`, `TOOLS.md`, and `tools/lisa-safe.md` rules.

Do not run destructive cleanup to fix search/indexing. Check config, locks, cache, and reindexing first.

Do not enable expensive models or premium routes for memory/dreaming work unless Carlos explicitly asks.

## Operator Bottom Line

Openclaw Prime's durable memory is file-first and index-led. The main session gets the lean `MEMORY.md` orientation; detail lives behind `memory/INDEX.md` and `studio/INDEX.md`. Subagents, cron, heartbeat, and compaction do not replace durable memory, so anything that must survive needs to be written into the correct file and kept indexed.
