# Lisa — Current State & Initial Intent (Pass 1 Definition)

> Superseded routing note (2026-07-22): active routing now uses Qwen 3.6+ primary (`openrouter/qwen/qwen3.6-plus`), DeepSeek V4 Pro fallback (`openrouter/deepseek/deepseek-v4-pro`), and local Qwen 9B (`ollama/qwen3.5:9b`). Legal/hard-strategy special routing and Gemini imageModel routing were removed from active config/docs.

**Prepared by:** Composer (Cursor)
**Date:** 2026-07-10
**Purpose:** Brief a senior model for a **Pass 1 audit** — personality files + model routing polish **before** Phase B (Cursor orchestration).
**Pass 2** (after IDE Development system is finished) will repeat with gate/skill context.

---

## 1. Who Lisa is

Lisa is Carlos Salas’s **OpenClaw agent** on a **Mac mini M1 (16 GB RAM)**, profile `lisa`. She is the **strategic operations and execution lead** for LiNKtrend Venture Studio — not a casual chatbot.

**Surfaces:** Telegram (`@lisaprime_bot`), Web UI (port 18790), iPhone (device-pair).

**Runtime (live):**

- State: `/Users/linktrend/.openclaw-lisa/`
- Workspace: `/Users/linktrend/.openclaw-lisa/workspace`
- Config: `/Users/linktrend/.openclaw-lisa/openclaw.json`
- Engine: `/Users/linktrend/Projects/openclaw_prime`
- Personality edit source: `/Users/linktrend/Documents/LiNKwork/Openclaw Lisa Prime/Personality files/`

**Personality version:** 1.1 (2026-07-09). Architecture: **progressive disclosure** — lean injected bootstrap files; detail in `user/`, `agents/`, `soul/` folders (read on demand only).

---

## 2. Initial intent (next 2–4 weeks)

Lisa’s **first real job** is to multiply Carlos’s output as an **orchestrator**, not as the primary developer.

### Primary use (soon — Phase B, not in this pass)

1. Carlos starts a repo and clones the **IDE Development** system (~80% done) — rules/skills for Cursor agents.
2. **Cursor agents** do the coding, following that system. They stop at **gates** (human review, testing, or stateless “continue” needed).
3. **Lisa replaces Carlos at the gates:** verify Cursor output, steer, approve per dev-system rules, say **continue**, escalate to Carlos only when rules mark human-required.

Lisa does **not** replace Cursor for development. Cursor codes; Lisa orchestrates.

### Current use (now — Pass 1 scope)

- **Daily ops:** Telegram/Web chat, scheduling, project routing, drafts, research, status.
- **Legal case (rank #2):** long documents, strategy drafts, evidence mapping — model `kimi`, strict silos.
- **Light execution:** file work in workspace, sandboxed tools, internal research.
- **Training camp** on Mac mini before VPS migration.

### Explicit non-goals (do not optimize for these in Pass 1)

- Lisa as end-to-end autonomous software factory (that’s future **LiNKdeveloper**).
- Full Cursor/ACP integration (Phase B — skills not defined yet).
- VPS migration, second Lisa clone, secret vault overhaul.
- Expanding the model menu without RAM/cost justification.
- Bloated personality files or removing progressive disclosure.

---

## 3. Operator (Carlos)

- **Non-technical.** Plain English in all operator-facing text.
- **Communication:** Mode A default (short, direct). Mode B on request (BLUF structure).
- **Review periods (Taipei):** 08:30, 10:45, 14:45 — preferred for non-urgent updates.
- **Budget:** Flexible short-term to launch; avoid runaway cloud spend (no $2k/month surprises).
- **Gate approval (future Phase B):** Lisa approves all gates herself using dev-system rules; escalates only when rules say so.

---

## 4. Personality file map

### Injected every session (keep lean — target ~60k total bootstrap budget)

| File           | Role                                                   |
| -------------- | ------------------------------------------------------ |
| `IDENTITY.md`  | Slim identity card                                     |
| `SOUL.md`      | Canonical persona I–VII                                |
| `USER.md`      | Carlos preferences index                               |
| `AGENTS.md`    | Workspace rules, Mode A/B, routing, silos              |
| `TOOLS.md`     | Environment + **model stack** (authoritative for Lisa) |
| `HEARTBEAT.md` | Empty/disabled                                         |

### On demand only (never injected at startup)

| File               | Role                                                   |
| ------------------ | ------------------------------------------------------ |
| `user/schedule.md` | Clock, stress, Mac mini windows                        |
| `user/projects.md` | Project ranks, keywords, silos, autonomous permissions |
| `user/context.md`  | Background, working style                              |
| `agents/detail.md` | Group chat, heartbeat, formatting                      |
| `soul/detail.md`   | Persona archive                                        |

### Operator-only (do not deploy to Lisa workspace)

| File                            | Role                                |
| ------------------------------- | ----------------------------------- |
| `PERSONALITY_WORKFLOW.md`       | How Carlos edits personality safely |
| `../LISA_CONTROL_CHEATSHEET.md` | Carlos operator commands            |

### Config (not injected but Lisa must not guess)

| File            | Role                                        |
| --------------- | ------------------------------------------- |
| `openclaw.json` | Models, thinking default, channels, sandbox |

---

## 5. Model stack (Phase A — live)

**Defaults:** thinking `medium`, speed standard (`fastMode: false`).

**Primary:** `openrouter/deepseek/deepseek-v4-flash` (`deepseek`) — everyday chat.

**Cloud menu:**

- `glm` — hard non-legal + rare Lisa-direct coding
- `kimi` — legal / long documents
- `sonnet` — premium, Carlos explicit request only
- `vision` — Gemini 3 Flash; `imageModel` for attachments

**Local menu:**

- `q4` — daytime background / fallback
- `coder` — overnight coding
- `heartbeat` — when heartbeat enabled

**Auto-only (not daily manual pick):**

- `q9-auto` — overnight non-coding + fallback
- `nemotron` — eval experiments only

**Fallback chain:** deepseek → q4 → q9-auto → glm

**Routing rules (Lisa must follow — in TOOLS.md + AGENTS.md):**

- Legal → kimi, thinking medium–high
- Hard non-legal → glm
- Mode A → thinking off/low on deepseek
- Mode B → thinking medium
- Images → vision via imageModel; text stays deepseek
- Overnight: code → coder; else → q9-auto

---

## 6. Project priority (authoritative: `user/projects.md`)

1. AI Trading Engine
2. Legal Case (kimi, legal-privileged silo)
3. Venture Launch (keywords TBD)
4. SaaS Component Kit
5. Website Factory
6. Venture Operations
7. General AI/Dev (lowest)

Many fields still **TBD** (deadlines, autonomous permissions, Venture Launch keywords).

---

## 7. Known gaps & contradictions (flag for auditor)

These are **starting hypotheses** — verify and expand:

1. **Version drift:** `IDENTITY.md` says v1.0; `VERSION.md` says v1.1.
2. **Thinking default vs Mode A:** Config default thinking is `medium`, but Mode A (default interaction style) says off/low. Is session default wrong, or should AGENTS/TOOLS clarify “config medium = Mode B baseline; Lisa drops to off/low for Mode A turns”?
3. **TOOLS.md uses tables;** operator cheat sheet avoids tables — consistency preference for Carlos-facing docs is lists.
4. **`user/projects.md`:** many TBD fields — auditor should propose **questions for Carlos** (MCQs), not invent permissions.
5. **Phase B orchestrator role** not yet in personality — only add **minimal forward pointer** if needed; no fake gate names.
6. **SOUL “execute directly”** vs **initial intent “orchestrate Cursor”** — ensure no implied Lisa-writes-all-code posture.
7. **Heartbeat disabled** — HEARTBEAT.md empty; OK for now.
8. **Nemotron eval** — experiment track agreed; do not promote to daily menu without eval results.

---

## 8. Hard constraints (auditor must respect)

- **RAM:** ~8 GB daytime for Carlos + Cursor; 4B background; 9B overnight only.
- **OpenClaw 2026.6.11** schema — validate config changes; `fastModeDefault` only on `agents.list[]`, not `agents.defaults`.
- **Progressive disclosure:** do not merge detail files into bootstrap.
- **Minimal diffs:** propose smallest change that fixes a real gap.
- **No secrets** in personality repo.
- **Deploy path:** edits go to `Personality files/` → copy to live workspace → restart or `/new`.

---

## 9. What Pass 1 audit should deliver

1. **Contradiction report** — cross-file conflicts (personality + config + model routing).
2. **Gap report** — missing rules for initial intent (orchestrator mindset, legal silo, ops).
3. **Proposed minimal diffs** — file-by-file, with before/after or unified diff blocks for Carlos/Composer to apply.
4. **Open questions for Carlos** — max 5–8 MCQs for TBD fields (projects, autonomous permissions).
5. **Model routing review** — is allocation right for intent? Any alias/menu change with justification?
6. **Explicitly out of scope:** Cursor ACP skills, IDE Development gate definitions, LiNKdeveloper, VPS.

---

## 10. Files the auditor must read

Read all of these before writing the report:

```
Openclaw Lisa Prime/Personality files/IDENTITY.md
Openclaw Lisa Prime/Personality files/SOUL.md
Openclaw Lisa Prime/Personality files/USER.md
Openclaw Lisa Prime/Personality files/AGENTS.md
Openclaw Lisa Prime/Personality files/TOOLS.md
Openclaw Lisa Prime/Personality files/HEARTBEAT.md
Openclaw Lisa Prime/Personality files/VERSION.md
Openclaw Lisa Prime/Personality files/user/projects.md
Openclaw Lisa Prime/Personality files/user/schedule.md
Openclaw Lisa Prime/Personality files/user/context.md
Openclaw Lisa Prime/Personality files/openclaw.json
Openclaw Lisa Prime/audit/01-definition-current-state-and-intent.md  (this file)
```

Optional context: `LISA_CONTROL_CHEATSHEET.md`, `agents/detail.md`, `soul/detail.md`.

---

## 11. Success criteria

Pass 1 succeeds if Carlos and Composer can apply a **small, coherent patch set** that makes Lisa:

- Clearly an **orchestrator-first** agent (without Phase B implementation).
- **Legally careful** on rank-2 work (kimi, silos, escalation).
- **Cost- and RAM-aware** in model behavior.
- **Consistent** across IDENTITY/SOUL/USER/AGENTS/TOOLS/config.
- **Lean** in injected token budget.
