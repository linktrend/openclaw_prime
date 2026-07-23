---
type: LiNKdeveloperAlignment
title: LiNKdeveloper — Study and Alignment Mission
description: Carlos's study prompt for deep LiNKdeveloper alignment; re-read before first supervised session
load: on_demand
read_when:
  - First LiNKdeveloper supervision session
  - After a long gap since last LiNKdeveloper work
  - Carlos asks Lisa to re-align on the development system
tags: [linkdeveloper, alignment, study]
sections:
  - heading: "## Your assignment"
    summary: This is a study/alignment mission, not a build mission — what success looks like
  - heading: "## Naming dictionary — memorize this first"
    summary: Live system names, retired names, and things to never invent or conflate (fuller version now also in memory/linkdeveloper.md)
  - heading: "## Read order — complete all of this"
    summary: The four-tier reading list in the IDE Development repo (Operations Manual first)
  - heading: "## What you must understand"
    summary: Comprehension questions A1-E22 covering system identity, Stage 1 mechanics, the two blueprints, future role, anti-confusion checks
  - heading: "## Deliverable — reply in this exact structure"
    summary: The 7-part reply format Carlos expects after the study pass
  - heading: "## Behavioral rules for this mission and all future LiNKdeveloper work"
    summary: Canonical-doc-wins, no layer/tier language, no tables unless asked, archive is read-only, Carlos approves spec/PRD
  - heading: "## Paths quick reference"
    summary: Every filesystem path referenced in this study mission, in one place
---

# Study mission: Learn LiNKdeveloper and prepare for your future role

## Your assignment

Carlos needs you to **read, internalize, and prove understanding** of **LiNKdeveloper** — the venture development system for LiNKtrend. This is a **study and alignment mission**, not a build mission.

Do not start development work, wire infrastructure, or change repos unless Carlos explicitly asks after you finish this briefing.

**Success means:** you can explain LiNKdeveloper accurately, use the correct names every time, know what exists today versus what is planned, and know what **you** (OpenClaw) will do in Stages 2 and 3 — without confusing retired systems or duplicate names.

---

## Naming dictionary — memorize this first

These names have burned us before. Get them exactly right.

### The live system (use this for all Stage 1 work today)

**LiNKdeveloper** — the **product name** for the venture development system.

**IDE Development** — the **local folder and git repo** that _is_ LiNKdeveloper Stage 1. Path: `/Users/linktrend/Projects/IDE Development`. GitHub: `linktrend/IDE-Development`.

**LiNKdeveloper workspace** — the **Cursor workspace file** that groups the system repo with active product repos: `~/Projects/Workspaces/LiNKdeveloper.code-workspace`.

**Rule:** LiNKdeveloper **is** IDE Development. Same system. The folder name and product name differ in spelling only — not in meaning. Never treat them as two products.

### Retired — do not use as live systems

**LiNKdev** — archived on GitHub and disk. Abandoned portable factory experiment.

**LiNKdeveloper** (old repo at `/Projects/LiNKdeveloper`) — archived; **Stage 2 runtime reference only**. Future autonomous orchestrator design; **not** the active daily system.

**Embedded `LiNKdev/` folders** in product repos (LiNKsites, etc.) — legacy remnants. Not active factory surfaces; do not bootstrap from them.

**Rule:** If you see `LiNKdev`, old `Projects/LiNKdeveloper`, or `linkdev-*` commands — that is **history**, not doctrine. The only archive reference doc is `docs/ARCHIVE-INDEX.md` inside IDE Development.

### Do not invent or conflate

- **IDE Developer** — not a real name; wrong
- **IDE Development system** vs **LiNKdeveloper** — same thing; pick one voice per sentence, usually "LiNKdeveloper (IDE Development)"
- **Application Factory** — the **development workflow** inside LiNKdeveloper (`Intent → … → Complete`)
- **Factory operations blueprint** — **separate** planning doc for Website/Automation/Content **production lines** — not the same as Application Factory daily dev
- **LiNKoffice** — strategy/docs workspace (`Documents/LiNKtrend`) — not LiNKdeveloper
- **LiNKsites** — a **product repo** in the workspace — not the system repo

---

## Read order — complete all of this

Read in sequence. Take notes. Do not skip the Operations Manual.

### Tier 1 — Canonical (required)

1. `/Users/linktrend/Projects/IDE Development/docs/LINKDEVELOPER-OPERATIONS-MANUAL.md` — **Primary source.** Read entire document. This is your operator bible.

2. `/Users/linktrend/Projects/IDE Development/docs/LINKDEVELOPER-STAGE1.md` — Stage 1 declaration — what is complete now.

3. `/Users/linktrend/Projects/IDE Development/docs/ARCHIVE-INDEX.md` — Retired systems only — learn what **not** to touch.

### Tier 2 — Routing and skills (required)

4. `/Users/linktrend/Projects/IDE Development/docs/HYBRID-SKILLS-REGISTRY.md`

5. `/Users/linktrend/Projects/IDE Development/core/skills/intelligent-routing/SKILL.md`

6. `/Users/linktrend/Projects/IDE Development/.cursor/rules/00-bootstrap.mdc` — Mandatory agent read order for every task.

### Tier 3 — Boundaries (required)

7. `/Users/linktrend/Projects/IDE Development/docs/FACTORY-OPERATIONS-BLUEPRINT.md` — **Planning only.** Understand it is not live infrastructure.

8. `/Users/linktrend/Projects/IDE Development/README.md`

### Tier 4 — Stage 2 reference (read-only, concepts only)

9. `/Users/linktrend/Projects/Archive/LiNKdeveloper-Stage2-Runtime-20260710/ARCHIVED.md` — Then skim design docs in that archive **only if** you need orchestrator vocabulary — do not treat as runnable code.

---

## What you must understand

After reading, you should be able to answer all of the following without guessing.

### A. System identity

1. What is LiNKdeveloper in one sentence?
2. What is the relationship between "LiNKdeveloper", "IDE Development", and `linktrend/IDE-Development`?
3. What are the three installed sources that form **one** operating system (core, gstack, mattpocock)?
4. Where does doctrine live (`core/` vs `.cursor/`)?

### B. How work starts today (Stage 1)

5. What are the **three triggers only**? (There is no fourth trigger for app vs factory.)
6. When is something an **application** vs a **factory product**?
7. What is the lifecycle spine?
8. Which gates does **Carlos** hold in Stage 1?
9. What do agents handle between gates?
10. What is the proof → review → integration rule?

### C. Two blueprints (do not conflate)

11. What is the **Application Factory** for?
12. What is the **Factory operations blueprint** for?
13. What factory infrastructure is **explicitly not built** in Stage 1?

### D. Your future role (Stages 2 and 3)

14. What changes between Stage 1, 2, and 3? (Hint: executor, not gate structure.)
15. In Stage 2, what do OpenClaw **executive agents** do vs **executors**?
16. What is your intended relationship to **Telegram** in Stage 2?
17. Which Carlos gates stay human until explicitly migrated?
18. In Stage 2, how should you use the archived old `LiNKdeveloper` repo?
19. What does Stage 3 add beyond Stage 2?

### E. Anti-confusion checks

20. Name three things you must **never** do with LiNKdev or the archived Stage 2 repo.
21. What is wrong with restoring `/Projects/LiNKdeveloper` as a live folder?
22. What is wrong with treating Factory operations blueprint as live Supabase/ledger infrastructure today?

---

## Deliverable — reply in this exact structure

When you finish reading, reply to Carlos with:

### 1. Bottom line (3 sentences max)

What LiNKdeveloper is today and what you will become in Stage 2.

### 2. Naming cheat sheet (your words)

A short list: correct names, wrong names, and one-line disambiguation for each retired name.

### 3. Stage map

- **Stage 1 (now):** who executes what
- **Stage 2 (next):** your executive role, Carlos gates, Telegram
- **Stage 3 (future):** policy-only human involvement

### 4. Operating model summary

- Three triggers
- Human gates (Stage 1)
- Application vs factory routing
- One system / three sources (core + gstack + mattpocock)

### 5. Comprehension answers

Answer questions A1–E22 above. If any answer is uncertain, mark **Unverified** and say what you would read next.

### 6. Persistence

Propose **one** durable memory update for your personality files (e.g. `user/projects.md` entry, or a new `memory/linkdeveloper.md`) — draft the text only; do not write files until Carlos approves.

### 7. Open questions for Carlos

Max 3 questions — only if genuinely blocked. Prefer stated assumptions over blocking.

---

## Behavioral rules for this mission and all future LiNKdeveloper work

1. **Canonical doc wins.** If memory, chat, or old docs disagree with `LINKDEVELOPER-OPERATIONS-MANUAL.md`, the manual wins.

2. **No layer/tier operator language.** Say "IDE Development core", "gstack", "mattpocock skills" — not Layer 1/2/3 when speaking to Carlos.

3. **No markdown tables** in summaries you send Carlos unless he asks.

4. **Do not conflate blueprints.** Application Factory development ≠ factory operations production lines.

5. **Archive is read-only reference.** Never install, wire, or extend archived repos.

6. **Stage 1 is live; Stage 2 is preparation.** Do not claim OpenClaw orchestration is already running unless Carlos says it is.

7. **Carlos approves spec/PRD** before substantial development — always, until a written migration says otherwise.

8. When routing development work, point executors at the **LiNKdeveloper workspace** and bootstrap read order — not at LiNKoffice unless the task is strategy/docs only.

---

## Paths quick reference

- System repo: `/Users/linktrend/Projects/IDE Development`
- Operations Manual: `.../docs/LINKDEVELOPER-OPERATIONS-MANUAL.md`
- Workspace: `~/Projects/Workspaces/LiNKdeveloper.code-workspace`
- gstack (vendored): `IDE Development/core/runtime/skills/gstack/`
- mattpocock (vendored): `IDE Development/core/runtime/skills/mattpocock/`
- LiNKdev archive: `/Users/linktrend/Projects/Archive/LiNKdev-legacy-20260710/`
- Stage 2 archive: `/Users/linktrend/Projects/Archive/LiNKdeveloper-Stage2-Runtime-20260710/`

Begin with Tier 1 document 1. Report when the deliverable is complete.

---

_Archived from Carlos's briefing, 2026-07-10. Hybrid persistence implemented in `user/projects.md`, `memory/linkdeveloper.md`, and `AGENTS.md`._
