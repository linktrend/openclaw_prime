# LiNKbot-core MVO role (repo boundary)

LiNKbot spans **two repositories**. Agents must not confuse program ownership with runtime ownership.

## Two surfaces

| Surface | Location | Owns |
|---------|----------|------|
| **This checkout (LiNKbot-core)** | `LiNKbot-core` | OpenClaw engine, gateway, channels/extensions, governed ingress hooks |
| **System plane** | `LiNKtrend-System/LiNKbot/` | Role packs, communication profiles, mission payloads, fleet/session surfaces, LiNKaios contract wiring |

## This repo (OpenClaw / LiNKbot runtime)

**LiNKbot-core** is the LiNKtrend-managed fork of OpenClaw:

- Gateway control plane, channel plugins, provider plugins, CLI (`openclaw`)
- Governed worker hooks for bot-runtime — bootstrap gate, mission/instruction injection, approved tool surface, lifecycle events ([docs/linktrend-governance.md](../../../docs/linktrend-governance.md))
- Native channel implementations stay in the engine; temporary gateway gaps may live under System `LiNKbot/communications/temporary-gateways/` until verified

Runtime code follows repo-root **`AGENTS.md`** (OpenClaw conventions). LiNKdev program rules apply only for factory/issue execution — not for upstream engine layout.

## System LiNKbot/ (roles, comms, orchestration)

**LiNKtrend-System** hosts what LiNKaios binds to bots:

- Role definitions and suite role packs (`LiNKbot/roles/`)
- Communication profiles and mission-aware channel routing
- Integration with LinkSkills leases, LiNKbrain audit, LiNKguard cleanup
- bot-runtime orchestration that calls this repo's gateway ingress

Do **not** move canonical memory, skills, secrets, deterministic workflows, or final audit into the engine fork.

## LiNKdev program ownership

| Question | Answer |
|----------|--------|
| Where is the canonical program? | `linktrend-system` in **LiNKtrend-System** only |
| Where do issues live? | `LiNKdev/product/programs/linktrend-system/issues/` |
| What is this repo's PROGRAM.md? | Execution-target pointer — **no Planner here** |

## MVO proof (every side-effecting step)

Even in dev/shadow modes, governed steps must produce:

- LinkSkills capability lease/run (when side-effecting)
- LiNKautowork workflow run (deterministic steps)
- LiNKbrain event/audit write
- LiNKaios trace/status visibility
- LiNKguard session cleanup on bot runs

See LiNKtrend-System `LiNKdev/product/grounding/CONTRACTS_MVO.md` for platform-wide stubs and capability tables.
