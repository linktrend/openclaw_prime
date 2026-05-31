# LiNKdev wire session — LiNKbot-core

- **Repo:** linktrend/LiNKbot-core
- **Branch:** development
- **Wire agent:** Cursor (Step A)
- **Session date:** 2026-05-31

## Principal launch (only these lines)

See `LiNKdev/factory/install/PRINCIPAL-LAUNCH.md`.

| Step | Status |
|------|--------|
| A — `EXECUTE-WIRE-LINKDEV.md` | **complete** |
| B — `EXECUTE-LINKDEV-UI-AUTOMATIONS.md` | **pending_codex_ui** |
| C — `EXECUTE-WIRE-LINKDEV-POST-UI.md` | **blocked** until B complete |
| 8 — Go (Planner) | **blocked** — canonical program runs on LiNKtrend-System only |

## UI automations (Step B)

- **Status:** pending_codex_ui
- **Principal launches Codex with:** `Execute the EXECUTE-LINKDEV-UI-AUTOMATIONS.md prompt in LiNKdev/factory/install/`

## Step C block

Step C (`EXECUTE-WIRE-LINKDEV-POST-UI.md`) requires core automations verified in `wire-automation-setup.md` (when present). Do not launch Step C until Step B is **complete**.

## Checklist (CHECKLIST.md)

### §0 Prerequisites — complete

- [x] Branches: `development`, `staging`, `main` present locally and on `origin`
- [x] GitHub remote: `origin` → `https://github.com/linktrend/LiNKbot-core`; `gh repo view linktrend/LiNKbot-core` resolves (default branch `main`)
- [x] Note: bare `gh repo view` (no `--repo`) resolved `openclaw/openclaw` in this environment — use `GITHUB_REPOSITORY=linktrend/LiNKbot-core` or `--repo linktrend/LiNKbot-core` for label install
- [x] Cursor/Codex accounts: assumed enabled for deployed instance (not verifiable from CLI)
- [x] Principal policy: **Go**, **Continue**, `staging`/`main` promotion are Principal-only per SPEC

### §1 Copy pack — complete

- [x] `LiNKdev/` at repository root
- [x] `.cursor/rules/00-linkdev-bootstrap.mdc` present (identical to `LiNKdev/factory/install/portable-cursor/.cursor/rules/00-linkdev-bootstrap.mdc`)
- [x] `LiNKdev/README.md` and `LiNKdev/factory/SPEC.md` present
- [x] Host product rules retained: `.cursor/rules/01-git-branching.mdc`, `12-linkbot-linktrend.mdc` (no removal of host `01`–`08` pattern)

### §2 GitHub labels — complete

- [x] `GITHUB_REPOSITORY=linktrend/LiNKbot-core LiNKdev/factory/scripts/install-labels.sh` exited 0 (15 definitions)
- [x] All contract labels from `LiNKdev/factory/contracts/labels.md` present via `gh label list --repo linktrend/LiNKbot-core`

### §3 GitHub Actions guard — complete

- [x] `.github/workflows/linkdev-guard.yml` present on `development` (`git show development:.github/workflows/linkdev-guard.yml`)
- [x] Enabled when workflow file is on `development` (no Principal toggle required)

### §4 Cursor automations — pending_codex_ui

- [ ] LiNKdev-orchestrator — merge to `development`
- [ ] LiNKdev-reviewer — `linkdev:review-ready`
- [ ] LiNKdev-integrator — `linkdev:merge-ready`
- [ ] LiNKdev-executor-cursor — `linkdev:ready` + `runtime:cursor`

### §5 Codex automations — pending_codex_ui

- [ ] LiNKdev-executor-codex — `linkdev:ready` + `runtime:codex`

### §6 Skills — complete

- [x] `LiNKdev/skills/SKILLS_CATALOG.md` present
- [x] Bootstrap rule points to `LiNKdev/skills/` (not flat `.cursor/skills/` bodies)
- [x] Host retains upstream `AGENTS.md` at repo root (OpenClaw); LiNKdev entry remains `.cursor/rules/00-linkdev-bootstrap.mdc`

### §7 Product program — complete

- [x] `LiNKdev/product/programs/linkbot-core/PROGRAM.md` exists (status: **execution-target** — canonical program is `linktrend-system` on LiNKtrend-System)
- [x] Planner / issue-group automations deferred until Principal **Go** on canonical program host

### §8 Go — not executed (Principal only)

- [ ] Principal says **Go** (on LiNKtrend-System program per PROGRAM.md)

### §9 Proof of wire — skipped this session

- [ ] Deferred to `EXECUTE-WIRE-LINKDEV-POST-UI.md` after Step B

## Agent log

### Commands run (Step A)

```bash
cd /Users/linktrend/Projects/LiNKbot-core
git branch -a
# * development, main, staging; remotes/origin/development, origin/main, origin/staging

git remote -v
# origin → linktrend/LiNKbot-core; upstream → openclaw/openclaw

gh repo view linktrend/LiNKbot-core --json name,url,defaultBranchRef
# {"name":"LiNKbot-core","url":"https://github.com/linktrend/LiNKbot-core","defaultBranchRef":{"name":"main"}}

gh repo view
# (without --repo) returned openclaw/openclaw — environment default; not used for wire

LiNKdev/factory/scripts/install-labels.sh
# First attempt: HTTP 404 openclaw/openclaw/labels

GITHUB_REPOSITORY=linktrend/LiNKbot-core LiNKdev/factory/scripts/install-labels.sh
# OK: labels ensured on linktrend/LiNKbot-core (15 definitions)

gh label list --repo linktrend/LiNKbot-core --limit 200 | grep -E 'linkdev:|runtime:|tier:'
# linkdev:planned|in-progress|ready|review-ready|blocked|merge-ready|done|program-active|principal-stop|promote-staging|promote-main
# runtime:cursor|codex; tier:standard|critical

git show development:.github/workflows/linkdev-guard.yml | head -5
# name: LiNKdev guard

diff -q .cursor/rules/00-linkdev-bootstrap.mdc LiNKdev/factory/install/portable-cursor/.cursor/rules/00-linkdev-bootstrap.mdc
# (no output — identical)

LiNKdev/factory/scripts/verify.sh
# exit 0 — see summary below
```

### verify.sh summary (Step A proof)

```
== LiNKdev verify (tier=standard scope=LiNKdev) ==
state json ok
VERIFY OK: no obvious secret assignments in LiNKdev
VERIFY OK: scripts present
VERIFY OK: contracts json valid
== verify passed ==
== LiNKdev gates tier=A scope=LiNKdev program=— report=— ==
== verify passed ==
GATE OK:   verify_subset
GATE OK:   secrets_scan
GATE SKIP: proof_block_present (no --report)
GATE SKIP: allowed_files_respected (no --report)
GATE SKIP: working_tree_clean (no --report)
== gates summary tier=A passed=2 skipped=3 failed=0 ==
VERIFY OK: tier A gates passed
```

**verify.sh exit code:** 0
