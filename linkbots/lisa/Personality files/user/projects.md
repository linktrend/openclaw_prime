---
type: UserProjects
title: Carlos — Active Projects Registry
description: Project keywords, ranks, sensitivity, and autonomous action permissions
load: on_demand
read_when:
  - Classifying a task to a project silo
  - Enforcing cross-project data boundaries
  - Deciding what autonomous work is permitted per project
  - Resolving priority when keywords match multiple projects
tags: [user, projects, silos, priority]
---

# Active Projects Registry

**Authoritative source** for project names, ranks, and silo rules. Projects evolve — update this file when Carlos adds, removes, or reprioritizes work. Do not duplicate project lists in `USER.md`.

_Maintained by Carlos and Lisa. Lisa enforces silos and routing per `AGENTS.md` § Active Projects._

**Rank: TBD** — ask Carlos to assign a rank before project-specific work on that project.

---

## LiNKdeveloper — Rank: 0 (highest)

**Keywords:** LiNKdeveloper, IDE Development, Link development, Application Factory, Cursor supervision, gates, proof, review, integration, Stage 1, Stage 2, development system

**Deadline pressure:** High when Carlos says LiNKdeveloper is running

**Data sensitivity:** Standard — system repo and product repos in active workspace; no cross-silo leakage to Legal Case or other projects

**Paths (Mac mini):**

- System repo (IDE Development): `/Users/linktrend/Projects/IDE Development`
- Operations Manual: `/Users/linktrend/Projects/IDE Development/docs/LINKDEVELOPER-OPERATIONS-MANUAL.md`
- Cursor workspace file: `~/Projects/Workspaces/LiNKdeveloper.code-workspace`
- Hybrid skills: vendored in IDE Development (`core/runtime/skills/gstack/`, `core/runtime/skills/mattpocock/`) — not separate Projects clones

**Role:** Lisa supervises Cursor agents operating under the LiNKdeveloper system. She does not replace Cursor for coding. Cursor executes; Lisa monitors, reports, and acts at gates per Carlos's approval rules.

**Monitoring rule (active when Carlos says "LiNKdeveloper is running"):**

Lisa periodically checks Cursor state: Are agents still running? Have agents prompted for input? Has an agent reached a gate? If any action is required with Cursor, Lisa contacts Carlos on Telegram, explains what she observed, and waits for his explicit approval before interacting with Cursor (spawn, continue, approve gate, send input). No silent Cursor interaction while this monitoring mode is active.

**Human gates (Stage 1 — Carlos holds until migrated):** Spec/PRD approval (primary), Program gate, Module gate, Launch/release gate. Lisa does not approve these on Carlos's behalf unless he explicitly delegates.

**Autonomous actions allowed:** Read system repo and Operations Manual; inspect Cursor/ACP session state; report status to Carlos on Telegram. Interact with Cursor only after Carlos approves. Do not invent or start the first supervised mission — Carlos will brief when ready.

**Detail:** `memory/linkdeveloper.md` (naming, triggers, gates, stages, anti-confusion). Full alignment study: `memory/linkdeveloper-alignment.md`. Read before LiNKdeveloper work.

---

## AI Trading Engine — Rank: 1

**Keywords:** Trading, liquidity, capital preservation, quantitative model, signal execution

**Deadline pressure:** TBD

**Data sensitivity:** TBD

**Autonomous actions allowed:** Read, analyze, and draft internally; run backtests and simulations autonomously. Never place trades or move capital without Carlos's approval.

---

## Legal Case — Rank: 2

**Keywords:** Taiwan case, Singapore case, court, prosecutor, evidence, Criminal/Civil Code, litigation strategy

**Deadline pressure:** TBD

**Data sensitivity:** Legal-privileged

**Autonomous actions allowed:** Read, summarize, and draft internally; organize evidence and build timelines autonomously. Never send, file, or publish anything externally without Carlos's approval.

---

## Venture Launch — Rank: 3

**Keywords:** Venture launch, go-to-market, launch plan _(placeholder — Carlos to refine)_

**Deadline pressure:** TBD

**Data sensitivity:** TBD

**Autonomous actions allowed:** Draft, prototype, and test in workspace freely; open PRs on Lisa-owned repos only. No deploys, publishes, or pushes to Carlos's production repos without approval.

---

## SaaS Component Kit — Rank: 4

**Keywords:** App factory, MVP, SaaS, app development, Next.js, reusable library, auth modules

**Deadline pressure:** TBD

**Data sensitivity:** TBD

**Autonomous actions allowed:** Draft, prototype, and test in workspace freely; open PRs on Lisa-owned repos only. No deploys, publishes, or pushes to Carlos's production repos without approval.

---

## Website Factory — Rank: 5

**Keywords:** Multi-site deployment, website creation, Payload CMS, SEO templates

**Deadline pressure:** TBD

**Data sensitivity:** TBD

**Autonomous actions allowed:** Draft, prototype, and test in workspace freely; open PRs on Lisa-owned repos only. No deploys, publishes, or pushes to Carlos's production repos without approval.

---

## Venture Operations — Rank: 6

**Keywords:** Automation, internal SOPs, efficiency, cost-reduction

**Deadline pressure:** TBD

**Data sensitivity:** TBD

**Autonomous actions allowed:** TBD

---

## General AI/Dev — Rank: 7 (lowest)

**Keywords:** General AI queries, dev learning, exploratory research not tied to a studio project

**Deadline pressure:** Low

**Data sensitivity:** Standard

**Autonomous actions allowed:** TBD

**Note:** Yields to all named studio projects when keywords overlap.

---

_Maintained by Carlos and Lisa. No sensitive identifiers, contact details, or confidential case/project data in this file._
