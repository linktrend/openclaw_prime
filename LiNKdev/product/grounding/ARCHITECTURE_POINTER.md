# Architecture pointer — cross-repo issues

When factory rules or issues reference monorepo paths that **do not exist in this checkout**, use the LiNKtrend-System architecture docs instead.

## Swarm coordination override

`LiNKdev/factory/rules/03-agent-swarm-coordination.mdc` defaults to LiNKtrend-System paths for ownership maps. **For LiNKbot-core issues**, substitute:

| Factory default | Use instead |
|-----------------|-------------|
| `docs/architecture/repo-architecture-target.md` | LiNKtrend-System: `docs/architecture/repo-architecture-target.md` (read from System repo or issue `read_first`) |
| `docs/architecture/system-completion-targets.md` | LiNKtrend-System: `docs/architecture/system-completion-targets.md` |

Host grounding in issue `read_first` wins over factory defaults. This file is the stable pointer — do not edit shared factory rules for this repo alone.

## LiNKtrend-System architecture (canonical)

| Document | Purpose |
|----------|---------|
| [repo-architecture-target.md](https://github.com/linktrend/LiNKtrend-System/blob/development/docs/architecture/repo-architecture-target.md) | Folder ownership, planes, suites, external repos |
| [system-completion-targets.md](https://github.com/linktrend/LiNKtrend-System/blob/development/docs/architecture/system-completion-targets.md) | Intended completed state per plane |
| [docs/terminology.md](https://github.com/linktrend/LiNKtrend-System/blob/development/docs/terminology.md) | Approved user-facing vocabulary |
| `LiNKdev/product/grounding/PRINCIPAL_PRODUCT_DEFINITION.md` | MVO product definition |
| `LiNKdev/product/grounding/CONTRACTS_MVO.md` | Capability tables and acceptable stubs |

## Local engine docs (this repo)

| Document | Purpose |
|----------|---------|
| `AGENTS.md` (repo root) | OpenClaw runtime map, build gates, extension boundaries |
| [docs/linktrend-governance.md](../../../docs/linktrend-governance.md) | LiNKtrend governance ingress and config |
| `docs/help/testing.md` | Test lanes and perf tooling |

## Plane map (quick reference)

| Plane | System path | This repo |
|-------|-------------|-----------|
| LiNKaios | `LiNKaios/` | — |
| LiNKbot | `LiNKbot/` | **Engine runtime (here)** |
| LinkSkills | `LinkSkills/` | — |
| LiNKbrain | `LiNKbrain/` | — |
| LiNKautowork | `LiNKautowork/` + external LiNKautowork repo | — |
| LiNKguard | `LiNKguard/` | — |

Cross-repo LinkSites, LiNKautowork, and LiNKsites boundaries are defined in System `repo-architecture-target.md` — not re-derived here.
