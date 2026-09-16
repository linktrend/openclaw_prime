# Docs archive — LiNKtrend / OpenClaw Prime

This tree holds **clearly superseded** LiNKtrend-specific materials moved out of active workshop/docs paths during pre-launch hygiene.

**OpenClaw Prime 1.0:** [`openclaw-prime-1.0/classification.md`](openclaw-prime-1.0/classification.md)
and the live briefing [`../openclaw-prime-1.0-briefing.md`](../openclaw-prime-1.0-briefing.md).
Handoffs and freeze packets under `docs/execution/openclawdevelopmentplan01/`
were **not** bulk-moved (append-only / frozen provenance). Paths named in those
historical files may now live under `openclaw-prime-1.0/`.

The `coordination/` subdirectory contains the superseded pre-VPS briefing. It
is historical only; use `docs/openclaw-prime-1.0-briefing.md` and
`docs/current-status.md` for current operations.

## Rules

- Archive only private-fork / Lisa workshop material that is superseded.
- Do **not** reorganize upstream public OpenClaw docs here.
- Do **not** move coordination records (`docs/agent-sessions/**`, `docs/handoffs/**`), freeze packets under `docs/execution/openclawdevelopmentplan01/**`, or release evidence under `docs/evidence/**` without a coordinated provenance rewrite.
- Principal `docs/CURSOR-GROK-*` prompts and the frozen OpenClaw implementation plan were moved (2026-09-16) to `docs/archive/openclaw-prime-1.0/cursor-grok-paci/` and `docs/archive/openclaw-prime-1.0/plans/`. Freeze packets and the §13.3 ledger now cite those archive paths. Do not restore duplicate live copies under `docs/CURSOR-GROK-*`.
- Workshop backups under `workshop-backups/` are historical config snapshots, not live runtime.

## 2026-08-02 release-hygiene intake

| Archived path                                                   | Former path                                                          | Reason                                                                                                                                |
| --------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `linkbots-lisa/PHASE1-LINKBRAIN-LINKSKILLS.md`                  | `linkbots/lisa/docs/PHASE1-LINKBRAIN-LINKSKILLS.md`                  | Early "No wiring yet" design; superseded by frozen plan + `extensions/linkbrain` / `extensions/linkskills` + OCP-W10/W20/W30 evidence |
| `linkbots-lisa/LINKBRAIN-AGENT-COORDINATION-HANDOVER-PROMPT.md` | `linkbots/lisa/docs/LINKBRAIN-AGENT-COORDINATION-HANDOVER-PROMPT.md` | One-shot Stage-2 LiNKbrain kickoff; Stage-2 consumer wiring is not live; Stage-1 remains `docs/agent-coordination.md`                 |
| `linkbots-lisa/heartbeat-digest-preview.md`                     | `linkbots/lisa/heartbeat-digest-preview.md`                          | Draft preview mock; live formats live in workshop personality files                                                                   |
| `linkbots-lisa/workshop-backups/openclaw.json.bak-*`            | `linkbots/lisa/Personality files/openclaw.json.bak-*`                | Temporary tracked workshop config snapshots; retained for rollback/diff history, not active SOT                                       |

Session: `cursor-local-mac-mini-release-hygiene-20260802-1313`
