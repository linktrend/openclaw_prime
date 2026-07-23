# Prompt Cache Verification — Topic 1, Closed Out (2026-07-15)

**Status: Done.** This finishes Topic 1 of the 2026-07-14 optimization research (`audit/` research report, delivered in chat, not saved as a file). Verified live on Lisa's Mac mini, not inferred from documentation alone.

## What was done

1. Enabled OpenClaw's built-in `diagnostics.cacheTrace` (config knob, not a code change) — writes a JSONL trace of cache state/results per turn to `~/.openclaw-lisa/logs/cache-trace.jsonl`.
2. Restarted Lisa, ran a series of controlled test messages via `openclaw --profile lisa agent --session-key ...` directly on the Mac mini (not through Telegram/Web UI, to keep the test isolated and reproducible).
3. Read the real trace output — not estimates — for cache hits/misses and system-prompt digests.
4. Found and diagnosed an unexpected result (see below), traced it to its exact cause with a second, targeted test.
5. Disabled `cacheTrace` again, deleted the raw trace file (it logs full system-prompt and message content in plaintext — fine for a short verification pass, not something to leave running indefinitely), and restarted Lisa clean.
6. Synced the config toggle to the repo copy at each step; live and repo `openclaw.json` are in sync (both end with `cacheTrace.enabled: false` — verification is off, no ongoing footprint).

## Result 1 — Caching is real and working, within a session

Two messages in the same session (`agent:main:cache-test-a`):

- Turn 1 (fresh session): `cacheRead: 0` — expected, nothing to reuse yet.
- Turn 2 (same session, immediately after): `cacheRead: 23,552` tokens — a real, large cache hit. The `systemPromptDigest` was byte-for-byte identical between the two turns, confirming the stable prefix (personality files + tool schemas) did not drift between turns.

**Conclusion:** for the normal case — Carlos continuing a conversation with Lisa — prompt caching on DeepSeek via OpenRouter is working as documented, automatically, with no configuration needed.

## Result 2 — Cross-session caching is real but partial, and now explained

A brand-new, different session (`agent:main:cache-test-b`), first message ever in that session, immediately after the test above: `cacheRead: 1,280` tokens out of ~16,400 total prompt tokens (~8%) — a real but much smaller hit than the same-session case.

This was unexpected enough to dig into. Two more isolated test sessions (`digest-diag-x`, `digest-diag-y`) with full prompt-content tracing showed the two sessions' system prompts were **54,424 characters each, differing in exactly one line**:

```
Runtime: agent=main | session=agent:main:digest-diag-x | sessionId=... | host=LiNKtrend-Mini | ...
```

vs.

```
Runtime: agent=main | session=agent:main:digest-diag-y | sessionId=... | host=LiNKtrend-Mini | ...
```

**Root cause:** OpenClaw's own engine (not Lisa's personality files) inserts a one-line `Runtime:` metadata string — including the session key — into the system prompt, and it sits **before** OpenClaw's own cache-boundary marker (the `<!-- OPENCLAW_CACHE_BOUNDARY -->` mechanism confirmed in the earlier research pass). Because it's before the boundary, it's part of the "stable" prefix that gets hashed for caching — and because it contains the session key, it's actually never stable across sessions. Everything in the prompt _before_ that line still matches and gets cached; everything from that line onward does not, until it's re-established as a new cache entry for that specific session.

This directly answers several of the original research questions with evidence instead of guesswork:

- **Does AGENTS.md/HEARTBEAT.md/etc. placement matter?** No drift observed from Lisa's own personality files — they were identical, verified via digest, across both test pairs.
- **Do timestamps invalidate the cache?** No literal date/time string was found in the stable prefix. The actual culprit is different: a session-identity line, not a clock.
- **Is this something to fix in Lisa's personality files or config?** No — it's baked into OpenClaw's own prompt-assembly engine, not something `TOOLS.md`, `AGENTS.md`, or `openclaw.json` control. Not something to patch from the Lisa side.

## Practical takeaway (recorded as a one-line note in `TOOLS.md`)

Because of the `Runtime:` line, **caching is strong within a continued conversation and weaker across brand-new sessions.** The practical, cost-free lever available to Carlos is: prefer continuing an existing session/thread over starting a fresh one (`/new`) when the topic is a direct continuation — which is already the natural way Carlos uses Lisa day to day, so no change in habit is actually required. This is now a documented fact, not folklore.

## Result 3 — Bonus finding: tool count

The cache trace incidentally revealed Lisa has **27 tools** registered per turn (`read`, `edit`, `write`, `apply_patch`, `exec`, `process`, `cron`, `image_generate`, `music_generate`, `video_generate`, goal tools, `skill_workshop`, session tools, `web_search`, `web_fetch`, `image`, `memory_search`, `memory_get`, and others). This is very likely the majority of the "~7,900 tokens of non-personality-file overhead" flagged as unexplained in the previous token-review session. Not investigated further here — flagged for a future pass if Carlos wants to look at trimming unused tools, since that's a different kind of change (tool/plugin configuration) than personality files.

## Final state (verified)

- `diagnostics.cacheTrace.enabled`: `false` in both live (`~/.openclaw-lisa/openclaw.json`) and repo (`Personality files/openclaw.json`) — confirmed byte-identical via `diff`.
- No trace files left on disk (`cache-trace.jsonl` deleted after the redacted summary above was extracted).
- Lisa restarted and smoke-tested clean after every config change; final smoke test (`caching-verified-ok`) passed.
- No personality file content, model routing, or sandbox settings were changed as part of this — this was a measurement pass, plus one factual documentation note.

## Recommendation status: Topic 1 — closed

No further action needed unless Carlos wants to revisit heartbeat/`contextPruning` tuning later (deliberately not touched here — heartbeat has an ongoing cost implication Carlos previously deferred, and the data above doesn't show a problem urgent enough to override that standing decision on its own).
