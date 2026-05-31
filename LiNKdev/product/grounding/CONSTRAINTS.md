# Product constraints — LiNKbot-core

Stack, boundaries, and non-goals for **this execution-target repository**.

## In scope (this repo)

- OpenClaw gateway, CLI, core TS, bundled extensions, apps
- LiNKtrend governance ingress — `linktrendGovernance`, `/v1/linktrend/agent-run`, lifecycle events
- Upstream sync into **`development`** (never push to `openclaw/openclaw`)
- Engine-owned channel/provider plugins and runtime adapters
- OpenClaw build/test gates (`pnpm check:changed`, `pnpm test`, etc.)

## Out of scope (belongs elsewhere)

| Concern | Owner |
|---------|-------|
| LiNKdev program, issues, Planner | **LiNKtrend-System** (`linktrend-system` program) |
| LiNKaios UI, kernel, project orchestration | **LiNKtrend-System** (`LiNKaios/`) |
| Role packs, comms profiles, fleet surfaces | **LiNKtrend-System** (`LiNKbot/`) |
| Capability leases, skills, kill switches | **LinkSkills** (System repo) |
| Memory, audit union, event ledger | **LiNKbrain** (System repo) |
| Deterministic workflows | **LiNKautowork** (System SDK + external repo) |
| Suite business workflows (LinkSites loop, etc.) | **LiNKtrend-System** `suites/` + external LiNKsites |

## Fork and upstream

- Repository: **`linktrend/LiNKbot-core`** — fork of **`openclaw/openclaw`**
- **Never** open PRs to upstream OpenClaw
- Upstream absorption via LiNKtrend sync workflows targeting **`development`**
- LiNKtrend-specific behavior stays in narrow hooks — do not absorb platform policy into core engine paths

## Active integration branch

Governance integration work lives on **`feat/linktrend-governance-integration`** until merged to **`development`**.

- Branch tip (2026-05): adds governed ingress, HTTP agent-run, hooks + schema ([docs/linktrend-governance.md](../../../docs/linktrend-governance.md))
- **Not yet merged:** fast-forward blocked by CI workflow conflicts (`codeql.yml`, `macos-release.yml` deleted on `development`, modified on feature branch)
- Continue feature work on that branch; merge via PR with explicit conflict resolution — do not assume it is on `development` until merge commit lands

## Security and cost

- Channel/provider credentials under `~/.openclaw/credentials/` — never commit
- LiNKtrend run bearer: `OPENCLAW_LINKTREND_RUN_BEARER` / gateway config — use GSM in deployed environments
- Prefer `pnpm check:changed` over full sweeps for scoped work; avoid unnecessary premium model usage in agent sessions

## Terminology (May 2026)

Use **Project** (not Mission), **Phase** (not Workflow for LiNKaios stage groups), **Automation** (not n8n workflow in user-facing copy), **Capability** (not Connector in LiNKaios UI).

Issues link here only when `read_first` requires boundary context.
