# OpenClaw Prime 1.0 — unique-ref classification

Recorded: 2026-09-16 by session
`cursor-cloud-cloud-cloud-agent-feature-20260916-2010`.

Nothing listed here was deleted. Retirement of remote branches, worktrees, or
tags is **proposed only** for the orchestrator after independent review.

## Production identity (GitHub + repo only)

Direct Server01 inspect was unavailable (cloud worker, no host credentials).

| Fact | Value | Provenance |
| ---- | ----- | ---------- |
| Repository | `linktrend/openclaw_prime` | `git remote` |
| GitHub environments | none listed | `GET /repos/.../environments` empty |
| GHCR/org packages | not readable (404/400) | `gh api` packages |
| Deployments API | empty | `GET /repos/.../deployments` |
| `origin/main` | `758dd4a608c3f9fd6e48a459d805c9b37735aa75` tree `243027a77caba32a9365e0dbd7cd448596fb660b` | `git ls-remote` + `rev-parse` |
| `origin/staging` | `4413312a6bc2d4eeb4100c7c4bdb92fca2587f32` **same tree as main** | same |
| `origin/development` at session start | `f9c09dc53c8942b45b817e88fef49fe46bbc9d38` tree `72ea598d5cb8b2156c8816a303ab1723f18d333e` | same |
| Last main promotion | PR #311 `chore(promote): staging to main (4413312a6bc2)` merged 2026-09-09 | `gh pr list --base main` |
| Artifact/image digest | **missing** | production-owner |
| Deployment receipt / time / rollback identity | **missing** | production-owner |

**Required production-owner packet (do not invent):** container inspect
(digest + labels), compose/service definition hashes, redacted config
structure, retained release directory names, health/readiness timestamps,
rollback digest. No Git checkout on Server01 is required.

## Unique refs (remote heads at inspect)

Classification keys: **R** required for 1.0 integration, **I** already in
`development` at start, **S** superseded/obsolete, **A** archive/docs-only,
**P** preserve separately (legitimate unfinished), **U** unsafe/unresolved,
**C** canonical protected (`main`/`staging`/`development`).

| Ref | Tip SHA | Class | Notes |
| --- | ------- | ----- | ----- |
| `development` | `f9c09dc53c8…` | C | Integration branch; start identity |
| `staging` | `4413312a6bc2…` | C | Same tree as `main`; behind development |
| `main` | `758dd4a608c3…` | C | Promoted 2026-09-09 |
| `issue/150032-complete-openclaw-prime-1-0-cleanup-and-consolid` | this work | R | Governed 1.0 cleanup owner |
| `issue/312-repair-codex-auth-refresh-fallback-classificatio` | `566d6f2140fd…` | R→I* | Source defect; **ported onto 150032** (not ancestor of start `development`) |
| `phase/312-codex-auth-fallback-20260910` | `cbe60365a8b1…` | S | Draft Phase PR #314; Fast Checks SUCCESS, Full Suite FAILURE; do not merge from implementer |
| `issue/313-plan-openclawprime-five-agent-server01-deploymen` | (open issue) | P | Plan/deploy ownership; no live mutate from 150032 |
| `issue/302-agent-parity` / `dev/minicodex/WP-0-agent-parity-20260908` / `phase/WP-0-agent-parity-20260908` / `phase/agent-parity-20260908` | `a303f0a30828…` | P/S | Parity source; pieces already on development via later merges — preserve until orchestrator confirms |
| `feature/buzz/openclaw-upgrade-compat-20260907` / `issue/299-buzz-openclaw-upgrade-20260907` | `8f396c1eb767…` | P | Upgrade line; not deleted |
| `feature/buzz/openclaw-upgrade-20260907-1011` | `af2e25c672cc…` | S | Sibling upgrade branch |
| `issue/142825-fix-docker-acpx-…` / `phase/142825-acpx-…` | `2c9c32a563e0…` | P | ACPX docker runtime |
| `issue/315-restore-repository-ci-declarations` | `b2641bbaa706…` | S | Landed via phase/315 |
| `phase/315-fork-scoped-validation-20260911` | `27393c2680bc…` | I | Merged to development as PR #316 |
| `issue/289` … `issue/364` packet/repair chain | various | P/S | Lisa PKT and OCP-315 repair series; classify per-issue before deletion |
| `cursor/ocp-*` cloud workers | various | P | Cloud implementer branches; do not absorb |
| `promote/main/*` `promote/staging/*` | various | S | Temporary promotion heads; controller-owned |
| `fix/lisa-google-workspace-calendar-20260819` | not on origin list at inspect | P | **Active session** owns Lisa GWS wrappers — do not delete/rewrite |
| tag `v1.0.0` | `2ea69e44b1b4…` | U (reuse) | Historical LiNKaios tag; **never retarget** |
| proposed `openclaw-prime-v1.0.0` | not created | R (after accept) | Orchestrator tags accepted production commit only |

\*Issue 312 is required behavior; the commits are **incorporated on 150032**,
still **not** on `origin/development` until packager/controller merge.

## Files / worktrees / unmerged

- This VM worktrees: `/workspace` on issue/150032 only. No extra worktrees.
- Stashes: none.
- Active session overlap: Lisa GWS repair (`linkbots/lisa/ops/google-workspace/**`) — **untouched**.
- User shared conflicted checkout: **not used**.

## Lisa OAuth-refresh / fallback

**Verdict:** OpenClaw **source defect** on start SHA, not a Platform-only
config issue. Codex app-server emits
`auth refresh request failed: code={n}` (and timeout/canceled variants) from
`codex-rs/app-server/src/external_auth.rs` (timeout 10s Codex-owned; OpenClaw
maps its own 9s deadline). On `f9c09dc` those strings did **not** classify for
model fallback (`classifyFailoverReason` → `null`; incomplete_turn not
fallback-safe). Configured Sol → Luna therefore did not run.

Platform identity work can still break Brain/Skills independently; this defect
is Codex-plugin + core failover classification.

Fix ported from issue/312 onto this branch: typed
`auth_permanent`/`timeout` for mapped copy; generic `-32603` without the
phrase stays ineligible. Fail-first tests then pass after restore.

## Proposed governed sequence (orchestrator)

1. Independent review of **this issue-branch tip** (not self-review).
2. Phase Packager draft PR → development (not implementer).
3. Delivery controller merge when named gates + Review Gate pass.
4. Promote development → staging → main via controller; Principal for main.
5. Production-owner Server01 inspect; admit digest + commit.
6. Tag `openclaw-prime-v1.0.0` on that **accepted production** commit.
7. Only then retire leftover `issue/*` / `phase/*` / `cursor/*` /
   `promote/*` / `feature/*` / `dev/*` after classification **P** items are
   preserved or merged. Do not delete 312 until 150032 is integrated.
8. Leave `v1.0.0` immutable.

## Canonical branches after consolidation

`development`, `staging`, `main` only — **after** the sequence above, not by
this worker deleting remotes.
