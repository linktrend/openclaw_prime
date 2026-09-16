# OpenClaw Prime and Lisa briefing

Updated: 2026-09-16, Asia/Taipei.

**Canonical 1.0 briefing:** [`docs/openclaw-prime-1.0-briefing.md`](openclaw-prime-1.0-briefing.md)

## Current source of truth

1. Live Server01/VPS receipts (digest, health, rollback) when a production
   owner records them. This cloud 1.0 checkpoint does **not** have those
   receipts.
2. Protected Git refs: `main` / `staging` share tree
   `243027a77caba32a9365e0dbd7cd448596fb660b`; `development` at 1.0 start was
   `f9c09dc53c8942b45b817e88fef49fe46bbc9d38` /
   `72ea598d5cb8b2156c8816a303ab1723f18d333e`.
3. Lisa source bundle + comparison receipt under `linkbots/lisa/`.
4. Brain, Skills, and Platform receipts in their own repos.
5. [`docs/current-status.md`](current-status.md) (orchestrator-maintained; may lag).

Historical session records, handoffs, pre-VPS plans, and candidate branches do
not override a live release. Archived material:
[`docs/archive/README.md`](archive/README.md).

## Five agents

Lisa (CEO), David, Eric, Sara, and Jane are the deployed Prime fleet. Preserve
live personalities, prompts, tools, skills, memories, and config unless a
verified defect needs a narrow source fix. Do not redeploy merely to align
Git branches.

## Boundaries

- Do not copy mutable memory, identity, credentials, or token stores across agents.
- Never print secrets, message content, or private memory in handoffs.
- Do not mutate Server01, protected refs, or release tags from an implementer session.
- Active Lisa Google Workspace repair owns `linkbots/lisa/ops/google-workspace/**`.

## Agent workflow

Read `AGENTS.md`, the 1.0 briefing, `docs/agent-coordination.md`,
`docs/current-status.md`, and any genuinely active session records before
editing. Use `issue/<id>-<slug>`, preserve unrelated work, and record material
work in a completed session or handoff.
