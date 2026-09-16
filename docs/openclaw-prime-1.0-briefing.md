# OpenClaw Prime 1.0 — AI-agent briefing

Updated: 2026-09-16, Asia/Taipei.

This is the operator briefing for **OpenClaw Prime 1.0** on the LiNKtrend fork
`linktrend/openclaw_prime`. It does not replace Git history, live runtime
evidence, or LiNKbrain canonical knowledge. It contains **no secrets**.

Start here. Then read [`AGENTS.md`](../AGENTS.md),
[`docs/agent-coordination.md`](agent-coordination.md), and the active
operational runbooks linked below.

## Purpose

OpenClaw Prime is LiNKtrend's private OpenClaw Gateway fleet: five isolated
agents (Lisa, David, Eric, Sara, Jane) that talk to Carlos and the studio
through existing channels, use OpenClaw tools and plugins, and consume
LiNKbrain and LiNKskills through governed native bridges. It is not the public
OpenClaw product and must not be described as a deployment of generic `v1.0.0`.

## Architecture

- **Product:** OpenClaw Gateway (TypeScript/Node) plus bundled plugins.
- **Fork overlay:** `linkbots/` definition bundles, `extensions/linkbrain` and
  `extensions/linkskills`, Server01 parity contracts, LiNKtrend GitOps under
  `scripts/gitops/`.
- **Runtime isolation:** one process/container, state root, workspace, auth
  database, and SecretRefs per agent. Never share `agentDir`.
- **Control plane:** Gateway + Control UI/CLI. Channels are transport only.
- **Institutional memory:** LiNKbrain (knowledge + team memory). Skills:
  LiNKskills. Identity/database for external Brain/Skills auth: LiNKplatform
  (may change tokens without changing this OpenClaw artifact).

```text
Principal (Carlos)
    │
    ├─ Lisa (CEO) ── isolated Gateway ── Brain / Skills / channels
    ├─ David
    ├─ Eric
    ├─ Sara
    └─ Jane
         │
         └─ one immutable OpenClaw image (when Server01 parity is admitted)
            + per-agent config, workspace, auth, env
```

## Technology stack

| Layer | Pin / contract |
| ----- | -------------- |
| Runtime | Node `>=22.22.3 <23 \|\| >=24.15.0 <25 \|\| >=25.9.0` (CI `NODE_VERSION=24.x`; 24 recommended) |
| Package manager | `package.json` `packageManager` `pnpm@12.1.0` (hash-locked) |
| Lockfile | `pnpm-lock.yaml` frozen install |
| App version on this line | `2026.9.2` (`package.json`) |
| Codex plugin | `@openai/codex` `0.153.4` |
| Storage | SQLite state DBs; no new JSON sidecars for runtime state |
| Secrets | Google Secret Manager names only; values never in Git |

A cached cloud Node (for example 22.14.0) is **not** this identity's toolchain.

## Build history (compressed)

1. Public OpenClaw upstream, forked as OpenClaw Prime.
2. Lisa VPS / PACI / Brain+Skills consumer work (2026-07 through 2026-08).
3. Five-agent Server01 parity source (2026-09), Lisa title CEO.
4. Fork-scoped validation Phase 315 merged to `development`
   (`f9c09dc53c8942b45b817e88fef49fe46bbc9d38`).
5. This 1.0 cleanup: classify unique refs, document production-evidence gaps,
   port Codex auth-refresh fallback classification, archive superseded plans.

The Git tag `v1.0.0` is **LiNKaios 2026-06-02**
(`2ea69e44b1b4d181a7f7f39b9133c5c857a098e7`) and **must not** be reused. The
intended Prime tag is `openclaw-prime-v1.0.0` on the **accepted production
commit** after independent review and governed promotion — not from this
implementer session.

## Five agent identities

Personalities, prompts, memories, and live config live on Server01 (and Lisa's
reviewed Git bundle). Git must not overwrite mutable live state.

| Agent | Role (source) | Topology (parity contract) |
| ----- | ------------- | -------------------------- |
| **Lisa** | Chief Executive Officer; orchestrator; Cursor/ACP for coding; Google Workspace via wrappers | Separate compose `compose.server01.lisa.yml`, container `linktrend-openclaw-lisa`, port `18791`, runtime `/srv/linktrend/runtime/openclaw/lisa` |
| **David** | Leadership-cell agent; bundle under `linkbots/david/` | Fleet compose, port `18793` |
| **Eric** | Leadership-cell agent | Fleet compose, port `18792` |
| **Sara** | Leadership-cell agent | Fleet compose, port `18794` |
| **Jane** | Leadership-cell agent | Fleet compose, port `18795` |

Interactions: each agent has its own Gateway. They do not share auth DBs.
Routing to humans is per-agent channel bindings. Inter-agent communication, if
any, is a live-config fact — not invented here.

**Parity overlay (source-only, not a claim of live config):** primary
`openai/gpt-5.6-sol` (low thinking); sole ordered fallback
`openrouter/openai/gpt-5.6-luna` (high thinking). Lisa's Git `AGENTS.md` still
documents a richer native-OAuth routing table. **Do not rewrite live Lisa
routing to force a match.** Apply overlays only in an authorized production
run after a redacted structural baseline.

## Repositories and integrations

| System | Role |
| ------ | ---- |
| `linktrend/openclaw_prime` | This Gateway fork |
| LiNKbrain | Canonical knowledge + team memory via `extensions/linkbrain` |
| LiNKskills | Skill execution via `extensions/linkskills` |
| LiNKplatform | Identity/database; may refresh Brain/Skills auth without changing OpenClaw bytes |
| LiNKdeveloper / IDE Development | Studio GitOps consumed by Lisa supervision |
| Public `openclaw/openclaw` | Upstream product; do not push this fork upstream |

## Brain / Skills / Platform relationships

- OpenClaw plugins hold **endpoints and SecretRef names**.
- Platform owns **user/service identity and token issuance** for those
  services. A Platform fix can restore Brain/Skills access with **zero**
  OpenClaw source change.
- OpenClaw-owned defects (example: Codex app-server refresh not classified for
  model fallback) stay in this repo. Do not paper over them with re-auth.

## Server01 deployment architecture

Source-only evidence: [`linkbots/parity/README.md`](../linkbots/parity/README.md)
and `parity.contract.json`.

- Lisa compose is separate from the four-agent fleet compose.
- One immutable image for all five when a digest is admitted.
- `OPENCLAW_PARITY_IMAGE` must be a digest, never a mutable tag.
- Google Chat stays disabled until per-agent SecretRefs pass.

**This cloud worker has no Server01 access.** Live image digest, labels,
deployment receipt, deployment time, health, and rollback identity are
**missing production-owner evidence**. See
[`docs/archive/openclaw-prime-1.0/classification.md`](archive/openclaw-prime-1.0/classification.md).

## Config and secret boundaries

- Git: non-secret bundles, contracts, docs, source.
- GSM: credential values (`LINKTREND_*` names).
- Host: per-agent `openclaw.json`, SQLite, workspaces, OAuth stores.
- Never commit tokens, phone numbers, transcripts, or memory bodies.

## Normal operations

Coordination: [`docs/agent-coordination.md`](agent-coordination.md).
Git: work on `issue/<n>-<slug>`; Ship = commit+push; Phase Packager opens the
draft PR; delivery controller merges to `development`. Implementers do not
open PRs, merge, or promote.

Lisa ops: [`linkbots/lisa/docs/LISA-BACKUP-DEPLOYMENT-RUNBOOK.md`](../linkbots/lisa/docs/LISA-BACKUP-DEPLOYMENT-RUNBOOK.md),
[`linkbots/lisa/docs/LISA-VPS-RECONCILIATION-RUNBOOK.md`](../linkbots/lisa/docs/LISA-VPS-RECONCILIATION-RUNBOOK.md),
[`linkbots/lisa/docs/LISA-JOBS-SOURCE-OPERATIONS.md`](../linkbots/lisa/docs/LISA-JOBS-SOURCE-OPERATIONS.md).

## Health / readiness / observability

Prepare (do not run live from this worker):

1. All five containers/services start.
2. Gateway health and readiness for each port.
3. Identity/personality/role/config readback (redacted).
4. Channel routing smoke per binding.
5. Brain and Skills reachability.
6. Auth refresh + configured fallback (Codex refresh miss → Luna).
7. Restart persistence (state/workspace/auth still agent-local).
8. No credential leakage in logs.
9. Rollback: prior digest + that agent's backup only.

## Backup / recovery / rollback

Per-agent backups; never restore one agent's auth/workspace into another.
Pin image back to the previous digest. Lisa encrypted private-health backup:
PKT-09 source docs (`LISA-PKT-09-SOURCE-ACCEPTANCE.md`, backup runbook).

## Update / release process

1. Issue branch → evidence → `completion_gate.py review-ready`.
2. Phase Packager draft PR into `development`.
3. Independent review + delivery controller merge.
4. Promote `development` → `staging` → `main` via controller `promote/*` PRs
   only (Principal for `main`).
5. Tag **`openclaw-prime-v1.0.0`** on the exact accepted **production** commit
   (the Server01-admitted SHA, which may be `main` after promotion — not a
   generic `v1.0.0`).
6. Deploy only by immutable image digest in a **separate** production-authorized
   run. Documentation and tagging must not deploy.

## Troubleshooting

| Symptom | First question |
| ------- | -------------- |
| Brain/Skills 401 after Platform change | Platform token/config, not OpenClaw bytes? |
| Primary Sol/Codex fails, no Luna | Refresh classified? This line maps Codex `auth refresh request failed: code=` to `auth_permanent` failover. |
| Agent “is” another agent | Shared `agentDir` or restored backup — stop, restore that agent only. |
| Wrong Node in CI/cloud | Engines + `pnpm-lock.yaml`; do not use 22.14.x. |

## Security / governance

- Repair Doctrine: max 3 ordinary repairs; no prefer-incoming.
- No self-review, self-merge, or implementer promotion.
- Secret scan before review-ready.
- Active Lisa Google Workspace session owns wrappers — do not absorb that work.

## Exact 1.0 identity (this checkpoint vs production)

| Ref | Commit | Tree |
| --- | ------ | ---- |
| Admitted starting `development` / issue/150032 base | `f9c09dc53c8942b45b817e88fef49fe46bbc9d38` | `72ea598d5cb8b2156c8816a303ab1723f18d333e` |
| `origin/staging` | `4413312a6bc2d4eeb4100c7c4bdb92fca2587f32` | `243027a77caba32a9365e0dbd7cd448596fb660b` |
| `origin/main` | `758dd4a608c3f9fd6e48a459d805c9b37735aa75` | `243027a77caba32a9365e0dbd7cd448596fb660b` (same tree as staging) |
| Legacy tag `v1.0.0` | `2ea69e44b1b4d181a7f7f39b9133c5c857a098e7` | `89f20354f4acaf3f327bbc97f3d6126315b17a0c` |
| Server01 live image digest / receipt / time / rollback | **unknown in this worker** | **unknown** |

`main`/`staging` trail `development` by the Phase 315 merge and this 1.0
checkpoint. They are **not** interchangeable with Server01 until a
production-owner receipt names a digest and commit.

## Active docs map

- This briefing
- [`docs/agent-briefing.md`](agent-briefing.md) — session start pointer
- [`docs/agent-coordination.md`](agent-coordination.md)
- [`docs/archive/openclaw-prime-1.0/classification.md`](archive/openclaw-prime-1.0/classification.md)
- [`linkbots/README.md`](../linkbots/README.md)
- [`linkbots/parity/README.md`](../linkbots/parity/README.md)
- [`linkbots/lisa/README.md`](../linkbots/lisa/README.md)
- Lisa backup / VPS reconciliation / jobs runbooks
- Public OpenClaw product docs remain at https://docs.openclaw.ai
