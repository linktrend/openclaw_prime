# Lisa Audit — Pass 1 Workflow

**Status:** Pass 1 is complete and applied (personality v1.2). This doc is kept as a historical record of the workflow, in case a Pass 2 (after LiNKdeveloper/IDE Development is further along) follows the same pattern.

**Goal:** Senior model reviews personality + model routing before Phase B.

## Files

**`01-definition-current-state-and-intent.md`** — Definition pack (Composer wrote this)

**`03-pass1-audit-report.md`** — Auditor output (created by Pass 1 run)

**`05-gws-integration-plan.md`** — Google Workspace CLI (`gws`) integration for Lisa (auth model, calendar share, operator checklist)

The audit prompt was delivered in chat for copy-paste (not stored in this folder).

Pass 2 (after IDE Development is finished) will add `04-definition-pass2.md` and a Pass 2 prompt in chat.

## Steps for Carlos

1. Stay in **this chat** (same thread keeps context).
2. Switch model to **Claude Opus 4.8 · High reasoning** (recommended — see below).
3. Copy the Pass 1 prompt from the Composer chat message (not stored in repo).
4. Paste as your message. Attach `@Openclaw Lisa Prime/audit/01-definition-current-state-and-intent.md` and `@Openclaw Lisa Prime/Personality files/`.
5. Let the auditor finish. Check `03-pass1-audit-report.md` was written.
6. Switch back to **Composer** and say: _"Apply Pass 1 audit recommendations"_ (or review diffs together first).

Composer will apply patches, validate `openclaw.json`, deploy to live Lisa.

## Which model to use (Pass 1)

**Recommended: Claude Opus 4.8 — High reasoning**

Best fit for this pass: cross-file contradiction hunting, legal/ops persona nuance, careful minimal editing, resisting over-engineering.

**Opus 4.8 · High** — **Use this.** Best Pass 1 audit quality.

**Sonnet 5 · High** — Acceptable backup. Faster/cheaper; may miss subtle rule conflicts.

**GPT 5.5 Terra · Medium or High** — Better for config/engineering than persona/legal nuance. Use if Opus unavailable.

**Fable 5 · High** — Possible for long-doc/legal tone review; less proven for OpenClaw config. Third choice.

Do not use Fast or low reasoning for this audit — you want depth, not speed.

## After Pass 1

- Composer reviews diffs with Carlos before applying.
- Deploy personality v1.2 (or whatever VERSION bump audit warrants).
- Phase B starts separately with IDE Development repo.
