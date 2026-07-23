# Lisa — Pass 1 Audit Report

**Auditor:** Senior agent architect (Opus-class review)
**Date:** 2026-07-10
**Scope:** Personality files + model routing polish before Phase B. No Cursor/ACP, no LiNKdeveloper, no VPS.
**Status:** Report + proposed minimal diffs. Nothing applied. Composer applies after Carlos reviews.

---

## A. Executive summary

Lisa's foundation is solid and genuinely lean — the progressive-disclosure layout works, the persona is coherent, and the Phase A model stack is sensible for a 16 GB Mac mini. The audit found **no structural rewrite is needed**. What it found are small consistency cracks that will cause confusion later if left alone.

The most important issue is a **thinking-level contradiction**: the config starts every session at `medium` thinking, but the routing docs tell Lisa that her default (Mode A) uses `off`/`low`. These are talking about two different things (one is an operator setting, the other is answer format), but the files blur them, and Lisa cannot actually change her own thinking level mid-turn. This should be clarified in words, not by changing the config value you chose.

The second issue is a **version mismatch** (`IDENTITY.md` says v1.0, `VERSION.md` says v1.1). Third, the **orchestrator-first intent is not written anywhere in Lisa's persona** — today SOUL tells her to "execute directly," which is right for ops but silent on the fact that Cursor will do the actual coding. A single line fixes that without pre-building Phase B.

Everything else is either fine as-is or a **TBD that only you can answer** (project autonomous-permissions, Venture Launch keywords, deadline pressure). Those are collected as multiple-choice questions in Section F rather than guessed.

Model routing is kept almost entirely. One small accuracy note: on Kimi, "medium–high thinking" is effectively just on/off, so the wording is slightly misleading but harmless.

Net: apply ~5 small diffs, answer up to 8 questions, and Lisa is measurably cleaner and correctly framed as an orchestrator — with no added system-prompt bloat.

---

## B. Contradictions found

**B1. Thinking default vs Mode A default — `openclaw.json` ↔ `AGENTS.md` ↔ `TOOLS.md`**

- `openclaw.json`: `agents.defaults.thinkingDefault: "medium"` and `agents.list[main].thinkingDefault: "medium"` — every session starts at medium.
- `AGENTS.md` (Work Mode Routing): _"Default: Mode A (Straight) … Use thinking `off` or `low`."_
- `TOOLS.md` (Reasoning by work mode): _"Mode A (straight/quick): thinking `off` or `low`."_
- Conflict: the default interaction mode (Mode A) is documented as off/low, but the runtime default is medium. Also, an LLM does not set its own thinking level per turn — that is controlled by config/session/`/think` directive. The instruction "use thinking off/low" is therefore partly inert.
- This is a **wording** problem, not a config bug. Recommended fix decouples "Mode A/B = answer format" from "thinking level = operator-controlled setting." See E2/E3.

**B2. Version drift — `IDENTITY.md` ↔ `VERSION.md`**

- `IDENTITY.md`: _"**v1.0** (2026-07-09) — progressive disclosure layout."_
- `VERSION.md`: _"Version: 1.1 … v1.1: Phase A model stack."_
- Fix: bump IDENTITY to v1.1. See E1.

**B3. Two ranking systems — `USER.md` ↔ `user/projects.md` (minor)**

- `USER.md` § Priority Values lists 5 _category_ priorities (revenue, legal, infra, automation, research).
- `user/projects.md` lists 7 _named-project_ ranks.
- They align in spirit (revenue→Trading, legal→Legal) and `AGENTS.md` already names `user/projects.md` authoritative for studio work. Low risk. Optional one-line clarifier only; not forcing a diff.

No other hard contradictions found. SOUL/USER/AGENTS/TOOLS are otherwise internally consistent.

---

## C. Gaps for initial intent

**C1. Orchestrator-first role is absent from the persona.**
`SOUL.md` § I says _"Execute actions directly when tools/permissions exist."_ Correct for ops, but nothing states that for **software development Lisa orchestrates Cursor rather than writing the code herself**. Add one line to IDENTITY (and optionally a one-liner in AGENTS) so the posture is explicit without building Phase B. See E4.

**C2. Legal silo is well-covered — one small reinforcement worth it.**
`AGENTS.md` and `SOUL.md` handle silos and privilege well. The only gap: nothing ties the **legal model routing (`kimi`)** to the **silo rule** in one place, so a future edit could drift them apart. Optional: a single cross-reference line in TOOLS routing. Low priority; included as optional in E3 note.

**C3. Daily-ops behavior is adequate.** No gap. Schedule, review periods, quiet hours, urgency ladder are all present and consistent across `USER.md`, `user/schedule.md`, `agents/detail.md`.

**C4. Model behavior gap: no explicit "cost restraint" cue.** The definition pack lists budget discipline as a constraint, but no personality file tells Lisa to prefer the cheap default and avoid premium models unless asked. `TOOLS.md` implies it (sonnet = on request only) but does not state a general cost-awareness principle. Optional single bullet in AGENTS Red Lines or TOOLS. See E5 (optional).

**C5. `user/projects.md` autonomous permissions are all TBD.** This blocks Lisa from acting autonomously per project. Cannot be invented — see Section F MCQs.

---

## D. Model routing assessment

Overall: **keep the Phase A stack.** It fits the hardware, cost posture, and orchestrator intent. Specifics:

- **`deepseek` (primary, everyday):** Keep. Cheap, fast, text-only is fine with vision fallback.
- **`kimi` (legal/long docs):** Keep. Good long-context choice. Caveat: on Moonshot, thinking is effectively binary (on/off), so "medium–high" wording is misleading — reword to "thinking on." See E3.
- **`glm` (hard non-legal + rare Lisa coding):** Keep. Reasonable middle tier.
- **`sonnet` (premium, on request):** Keep as explicit-request-only. Correct cost posture.
- **`vision` = `gemini-3-flash-preview` (imageModel):** Keep for now. Minor note: it is a _preview_ model; Google's GA path is `gemini-3.5-flash` (more expensive). No action needed while cost-sensitive; revisit if preview is deprecated.
- **`q4` / `coder` / `q9-auto` (local):** Keep. Sensible day/overnight split for 16 GB.
- **`nemotron` (eval only):** Keep out of daily menu until eval data exists. Correct.
- **Fallback chain deepseek → q4 → q9-auto → glm:** Keep. Local-first with a cloud safety net is right.

**Thinking defaults:** The value `medium` is a fine operator default. The problem is only documentation (B1). Recommend: keep `medium` in config; fix the docs to say Mode A/B is answer _format_, and thinking level is operator-controlled. Do **not** lower the config to `low` — an LLM can't reliably self-escalate to medium for Mode B mid-turn, so a medium floor is safer for the strategic work Lisa does.

**Speed:** `fastMode: false` (standard) — keep.

No model additions or removals recommended in Pass 1.

---

## E. Proposed minimal diffs

### E1. `Personality files/IDENTITY.md` — fix version drift (B2)

**Why:** IDENTITY says v1.0 but the current version is v1.1.

Before:

```
**v1.0** (2026-07-09) — progressive disclosure layout. Full version notes: `VERSION.md`.
```

After:

```
**v1.1** (2026-07-09) — progressive disclosure layout + Phase A model stack. Full version notes: `VERSION.md`.
```

---

### E2. `Personality files/AGENTS.md` — decouple thinking level from Mode A/B (B1)

**Why:** Removes the off/low-vs-medium contradiction and stops instructing Lisa to set a thinking level she cannot control per turn.

Before:

```
**Default:** Mode A (Straight) — every turn unless triggered. Use thinking `off` or `low`.

**Mode B triggers (switch immediately; use thinking `medium`):**
```

After:

```
**Default:** Mode A (Straight) — every turn unless triggered.

**Mode B triggers (switch immediately):**
```

Then, immediately after the `**Mode B structure:**` line (end of Work Mode Routing subsection), add:

```
**Thinking level vs Mode:** Mode A/B controls *response structure*, not your reasoning/thinking level. Thinking level is set by Carlos — config default is `medium`, or he sends a `/think` directive. Do not assume you can change your own thinking level mid-turn; adapt structure and length, not reasoning depth.
```

---

### E3. `Personality files/TOOLS.md` — correct reasoning wording + Kimi thinking note (B1, D)

**Why:** Aligns TOOLS with E2 and fixes the misleading "medium–high on Kimi."

Before:

```
### Reasoning by work mode

- **Mode A** (straight/quick): thinking `off` or `low`
- **Mode B** (strategic): thinking `medium` (session default)
- **Hard / legal:** thinking `medium`–`high` on the appropriate model
```

After:

```
### Reasoning (operator-controlled)

- **Session default:** thinking `medium` (set in config; applies to all sessions until Carlos changes it).
- **Mode A vs Mode B** changes answer *structure*, not thinking level (see `AGENTS.md`).
- **When Carlos adjusts** via `/think`: `off`/`low` for quick factual turns, `medium` for normal work, `high` for hard analysis.
- **Kimi note:** Moonshot thinking is on/off only — treat legal work as thinking *on*, not a graded level.
```

Also in the routing rules list, update line 2:

Before:

```
2. **Legal case** (keywords, project rank #2, long docs) → switch to `kimi`, thinking medium–high
```

After:

```
2. **Legal case** (keywords, project rank #2, long docs) → switch to `kimi`, thinking on; enforce legal silo (`AGENTS.md` § Security & Data Boundaries)
```

---

### E4. `Personality files/IDENTITY.md` — add orchestrator-first line (C1)

**Why:** Makes explicit that Cursor does development and Lisa orchestrates — the core initial intent — without pre-building Phase B.

In the `## Operational Role` section, after the **Standard of Care** line, add:

```
**Primary Operating Mode:** Orchestrator first. For software development, coordinate and verify the work of coding agents (e.g. Cursor) rather than writing all code yourself. Execute directly for ops, drafts, research, and small fixes; delegate and supervise for building software.
```

---

### E5. (Optional) `Personality files/AGENTS.md` — cost-awareness Red Line (C4)

**Why:** One bullet gives Lisa an explicit restraint cue matching the budget constraint. Skip if you consider `TOOLS.md` sufficient.

In `## Red Lines`, add one bullet:

```
- Prefer the default model; use premium cloud models (e.g. `sonnet`) only when Carlos asks. Flag likely-expensive actions before running them.
```

---

### E6. (Optional, low priority) `Personality files/user/projects.md` — structure for pending fields (C5)

**Why:** No content invented — just makes the TBDs answerable. Only apply after Carlos answers Section F. Structural note, not a value change: keep the existing `Autonomous actions allowed: TBD` lines and fill them from the MCQ answers.

No diff provided until answers exist (per hard rule 6).

---

## F. Open questions for Carlos (MCQs)

**Q1. Thinking default — confirm the fix.**

- (a) Keep config at `medium`; clarify docs that Mode A/B = format only (recommended).
- (b) Lower default to `low`; you accept manually raising it for hard work.
- (c) Something else.

**Q2. Orchestrator line placement.**

- (a) IDENTITY only (recommended, leanest).
- (b) IDENTITY + a one-liner in SOUL § I.
- (c) Leave persona unchanged for now.

**Q3. Autonomous actions — AI Trading Engine (Rank 1).** What may Lisa do without asking?

- (a) Read/analyze/draft only; never place trades or move capital.
- (b) The above + run backtests/simulations autonomously.
- (c) Other (specify).

**Q4. Autonomous actions — Legal Case (Rank 2).**

- (a) Read/summarize/draft internally only; never send or file anything.
- (b) The above + organize evidence and build timelines autonomously.
- (c) Other (specify).

**Q5. Autonomous actions — build projects (SaaS, Website, Venture Launch).**

- (a) Draft, prototype, and test in workspace freely; no deploys/publishes without approval.
- (b) The above + open PRs on Lisa-owned repos only.
- (c) Other (specify).

**Q6. Venture Launch keywords (currently TBD).**

- (a) I'll provide a list now.
- (b) Use placeholder "venture launch, go-to-market, launch plan" until I refine.
- (c) Leave TBD; Lisa asks when a task seems to match.

**Q7. Deadline pressure fields (all TBD).**

- (a) I'll set per-project now.
- (b) Default all to "none unless I flag it."
- (c) Leave TBD.

**Q8. Cost-awareness Red Line (E5).**

- (a) Add it (recommended).
- (b) Skip; TOOLS.md coverage is enough.

---

## G. Explicitly not recommended

- **Rewriting SOUL.md or merging IDENTITY into SOUL.** They serve different jobs (slim card vs canonical persona); merging bloats the injected prompt. Rejected.
- **Lowering the config thinking default to `low`.** An LLM can't reliably self-escalate to medium for Mode B mid-turn; a medium floor better fits Lisa's strategic/legal work. Rejected in favor of doc clarification.
- **Adding Phase B / Cursor orchestration rules to the persona now.** Out of scope; gate names and skills don't exist yet. Only the single orchestrator-posture line (E4) is added. Rejected for anything more.
- **Swapping `vision` to GA `gemini-3.5-flash` now.** More expensive; preview works. Rejected while cost-sensitive; revisit if deprecated.
- **Removing `nemotron` from the catalog.** It's correctly quarantined to evals; keeping it costs nothing. Rejected.
- **Converting every table in the repo to lists wholesale.** TOOLS.md tables were left mostly intact except where wording changed; a full delisting is churn without benefit for a Lisa-facing reference. Rejected (only touched what E3 changes).
- **Adding heartbeat tasks now.** Heartbeat is intentionally disabled; `agents/detail.md` already documents the future path. Rejected.

---

_End of Pass 1 audit. **Applied 2026-07-10** by Composer — personality v1.2 deployed to live workspace._

**Carlos answers:** Q1a, Q2a, Q3b, Q4b, Q5b, Q6b, Q7c, Q8a.
