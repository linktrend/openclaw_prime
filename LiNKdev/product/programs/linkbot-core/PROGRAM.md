---
program_id: linkbot-core
title: LiNKbot-core execution target
status: execution-target
---

# Program: linkbot-core (execution target)

This repository is **not** the canonical LiNKdev program host. Do **not** run Planner here or create a local issue tree.

## Canonical program

| Field | Value |
|-------|-------|
| **Program id** | `linktrend-system` |
| **Host repo** | [LiNKtrend-System](https://github.com/linktrend/LiNKtrend-System) |
| **Path** | `LiNKdev/product/programs/linktrend-system/` |

LiNKbot and OpenClaw integration work is tracked under **linktrend-system** modules, phases, and issues. Principal **Go** and cloud Planner run against LiNKtrend-System only.

## This repo's role

**Execution target** for the LiNKbot runtime plane:

- OpenClaw engine baseline (gateway, channels, extensions, CLI)
- LiNKtrend governance ingress — `linktrendGovernance`, HTTP `/v1/linktrend/agent-run` ([docs/linktrend-governance.md](../../../../docs/linktrend-governance.md))
- Runtime adapters, session/reasoning packaging, and channel plugin surfaces owned by the engine

**Role definitions, communication profiles, mission-aware routing, and fleet surfaces** live in **LiNKtrend-System** at `LiNKbot/` — not duplicated as platform truth here.

Product overview: [README.md](../../../../README.md) at repository root.

Grounding: [MVO_ROLE.md](../../grounding/MVO_ROLE.md) · [ARCHITECTURE_POINTER.md](../../grounding/ARCHITECTURE_POINTER.md)
