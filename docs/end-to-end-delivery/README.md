# OpenClaw Prime five-agent Server01 delivery package

Status: **PLAN — awaiting founder `APPROVE` in the OpenClawPrime Deployment task**

Date: 2026-09-10 (Asia/Taipei)

Issue: [linktrend/openclaw_prime#313](https://github.com/linktrend/openclaw_prime/issues/313)

Planning baseline: commit `7aee52d52695ab50bfa13dd275a68d28a5cbbe6b`, tree `243027a77caba32a9365e0dbd7cd448596fb660b`, protected `development`.

This package is the single execution plan for completing Lisa, Eric, David,
Sara, and Jane on LiNKserver 01. It reconciles the former **5 Agents
Configuration** and **Complete Buzz agent setup** tasks without replaying their
workers, duplicating Buzz identities, or treating historical receipts as current
production proof.

## Package map

- [Product requirements](./PRD.md)
- [Target architecture](./ARCHITECTURE.md)
- [Atomic work packets and dependency graph](./WORK-PACKETS.md)
- [Execution route, lane plan, and governance](./EXECUTION-ROUTE.md)
- [Open-source and installed-capability inventory](./OSS-INVENTORY.md)
- [Current readiness and blockers](./READINESS-REPORT.md)
- [Machine-readable lane plan](./LANE-PLAN.json)
- [Schema-valid execution manifest](./EXECUTION-MANIFEST.json)

## Approval boundary

The package authorizes no implementation, worker dispatch, provider mutation,
credential access, migration, image build, deployment, channel activation,
profile rewrite, or protected promotion. Only the exact word `APPROVE` from the
founder in the OpenClawPrime Deployment task releases Gate 0. Approval in a
historical task, an accepted provider plan, a passing review, or this committed
plan is not execution authority.

After approval, the coordinator must refresh all protected refs, live runtime
identity, queue ownership, active session records, Cursor account/model/repo
readback, and upstream provider receipts before admitting any packet. Drift
invalidates the affected identity and evidence; it does not permit a best-effort
substitution.
