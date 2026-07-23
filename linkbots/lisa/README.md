# Openclaw Lisa Prime

Working folder for Lisa — the OpenClaw agent running on the Mac mini training camp before VPS migration.

This folder lives inside the **`LiNKwork`** repo (`github.com/linktrend/LiNKwork`), which is the ongoing home for improving, managing, and developing Lisa. It replaces the earlier working folder that used to live under `Documents/LiNKtrend/`.

## Folder layout

- `LISA_CONTROL_CHEATSHEET.md` — **Operator cheat sheet** — commands, model menu, Web UI, Google Workspace (`gws`), Cursor/ACP, troubleshooting
- `audit/` — Pass 1 audit (personality + model review) and the Phase B / gws integration reports
- `Personality files/` — Lisa's personality, operating rules, memory, and a config snapshot (`openclaw.json`)

## Live Lisa (source of truth on this Mac)

- State root: `/Users/linktrend/.openclaw-lisa`
- Personality (live): `/Users/linktrend/.openclaw-lisa/workspace`
- Config: `/Users/linktrend/.openclaw-lisa/openclaw.json`
- Secrets: `/Users/linktrend/.openclaw-lisa/.env` (never copied here)
- OpenClaw engine repo: `/Users/linktrend/Projects/openclaw_prime` (fork of upstream OpenClaw; GitHub `linktrend/openclaw_prime`). This is the code that runs Lisa today and will later run a second, differently named clone agent once Lisa's setup is proven out.

**Rule:** when this repo and the live Mac mini disagree, the live filesystem/config/logs win. Treat everything here as the edit-and-review copy, not the runtime.

## Lisa Prime personality workflow

1. Edit files in `Personality files/` until satisfied.
2. When ready to apply, copy personality files into `/Users/linktrend/.openclaw-lisa/workspace/` and `openclaw.json` into `/Users/linktrend/.openclaw-lisa/openclaw.json`.
3. Restart Lisa or start a new session for a clean pass.

See `Personality files/PERSONALITY_WORKFLOW.md` for the safe edit workflow.

## Key preferences (preserve)

- Standard OpenClaw setup where possible; minimal unnecessary divergence
- Local-first, cost-aware model mix (OpenRouter + Ollama)
- No destructive actions in Documents, Projects, or external drives without explicit permission
- Incremental changes; inspect before changing live state
- Carlos is non-technical — plain English, no markdown tables in operator-facing text unless asked

## Current runtime snapshot (as of 2026-07-14)

- **Personality version:** v1.2 (Pass 1 audit applied)
- **Primary model:** `openrouter/deepseek/deepseek-v4-flash` (alias: `deepseek`)
- **Legal / long-document model:** `openrouter/moonshotai/kimi-k2` (alias: `kimi`)
- **Hard / general model:** `openrouter/z-ai/glm-5.2` (alias: `glm`)
- **Premium override (on request only):** `openrouter/anthropic/claude-sonnet-4-6` (alias: `sonnet`)
- **Vision:** `openrouter/google/gemini-3-flash-preview` (alias: `vision`)
- **Experiment only:** `openrouter/nvidia/nemotron-3-super-120b-a12b:free` (alias: `nemotron`) — evaluated against DeepSeek, verdict `KEEP_EVAL` (not promoted)
- **Local models:** `ollama/qwen3.5:4b` (`q4`, daytime background), `ollama/qwen3.5:9b` (`q9-auto`, overnight/fallback), `ollama/qwen2.5-coder:7b` (`coder`), `ollama/gemma4:e2b` (`heartbeat`, currently disabled)
- **Thinking default:** medium · **Speed:** standard (never "fast")
- **Sandbox:** Docker sandbox image exists (`openclaw-sandbox:bookworm-slim`) but `sandbox.mode` is currently **`off`** — this was a deliberate tradeoff to let Lisa spawn Cursor (ACP) from any surface (Web UI, Telegram, iPhone). See "Cursor orchestration" below for why, and revisit before any multi-user or VPS move.
- **Cursor orchestration (ACP):** working — Lisa can spawn a real Cursor agent via `@openclaw/acpx`, watch it work, and report back honestly (personality rules explicitly forbid silently falling back to her own writes/subagents and calling it "Cursor")
- **Google Workspace (`gws`):** Lisa has her own account, `lisa@linktrend.media`, via OAuth (not impersonating Carlos). Working: Calendar, Tasks, Drive, Gmail (send restricted to `@linktrend.media` recipients only). **Not working: Google Keep** — Google/`gws` v0.22.5 does not expose the Keep OAuth scope in the normal user login flow; this is a documented, verified limitation, not a bug to keep re-chasing. Use Tasks or Drive for anything Lisa should manage programmatically.
- **Surfaces:** Web UI, Telegram (`@lisaprime_bot`), iPhone app — all paired and working
- **Gateway port:** 18790 (LAN)

**Operator guide:** [`LISA_CONTROL_CHEATSHEET.md`](LISA_CONTROL_CHEATSHEET.md)

## Useful commands

```bash
zsh /Users/linktrend/.openclaw-lisa/start-lisa.sh
zsh /Users/linktrend/.openclaw-lisa/stop-lisa.sh
zsh /Users/linktrend/.openclaw-lisa/status-lisa.sh
openclaw --profile lisa gateway probe
openclaw --profile lisa channels status --probe
openclaw --profile lisa nodes status --json
openclaw --profile lisa security audit
```

## LiNKdeveloper (Cursor development supervision)

Lisa is meant to eventually supervise Cursor development work inside **LiNKdeveloper** (the product name for the `IDE Development` repo/system — same system, different names). Today:

- Lisa can spawn a Cursor ACP session and check its work, but **cannot see or control a Cursor IDE Composer session Carlos starts manually** — that is a real capability gap, not a misunderstanding.
- Current rule: Lisa acts on Carlos's behalf with Cursor, but **asks on Telegram first**, then acts. More autonomy will be granted over time.
- Long-term direction being brainstormed: pulling LiNKdeveloper out of the Cursor IDE into a standalone control plane (possibly VPS-hosted) that Lisa talks to via API/state, with Cursor Cloud (or headless `cursor-agent`) as interchangeable "executors." Not built yet — brainstorm stage only.
- Naming dictionary, gates, and stage map live in `Personality files/memory/linkdeveloper.md` and `linkdeveloper-alignment.md`.

## Still open / known gaps

- VPS migration design (deferred until local Lisa is stable)
- Stronger secret management (Vaultwarden/GSM — deferred)
- Two-agent clone model (future — second agent, different name, same `openclaw_prime` engine)
- Formal weekly upstream merge checklist for `openclaw_prime`
- `sandbox.mode: off` is a security tradeoff made to unblock Cursor ACP from every surface — worth revisiting once LiNKdeveloper supervision is real and/or before multi-user or VPS use
- LiNKdeveloper visibility/control gaps (see above) — engineering milestones are sketched in prior chat history, not yet built
- One stale reference: `Personality files/memory/linkdeveloper.md` points "LiNKoffice" (strategy/docs workspace) at `Documents/LiNKtrend`, which no longer exists on disk — needs a correct path once confirmed with Carlos

## Personality files — provenance

- `USER.md`, `IDENTITY.md` — recovered from the original VPS Lisa (Feb 2026 cloud bot)
- `SOUL.md` — merged from the vault soul spec + operating reference notes
- `AGENTS.md`, `TOOLS.md`, `HEARTBEAT.md` — built/iterated for the Mac mini Lisa
- `openclaw.json` — snapshot of the current Mac mini runtime config (sandbox, models, channels, ACP)
- `PERSONALITY_WORKFLOW.md` — edit workflow guide
- `memory/` — durable notes Lisa reads on demand: LiNKdeveloper naming/gates, gws capability limits, Nemotron eval logs, LiNKdeveloper/human alignment doc

No secrets are stored in this folder or anywhere in this repo.
