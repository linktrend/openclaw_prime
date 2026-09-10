---
summary: "Exact baseline CI receipt and progressive failure classification"
read_when: "Validating the OpenClaw fork's inherited CI failure before packet or Phase work"
title: "Baseline CI receipt"
---

# OpenClaw fork baseline CI receipt

The machine-readable receipt is
`docs/execution/openclaw-prime-lisa/baseline-ci-receipt.json`. LiNKtrend Fast
and Full now treat the exact normalized protected-base-to-Phase diff as the
fork-customization scope: they scan those existing changed paths, run
change-relevant tests, and do not require repository-wide upstream OpenClaw CI.
Static provenance may describe inventory, but it must not exclude a file
already proven changed by the accepted Phase identity. The historical GitHub
Actions Full run `32917935092` head `428c6bc9ba21b2358934aa0d311911791fa3fd21`
(tree `a29648096f9872a7f3d727aef79b0cb63a31ff07`) remains a recorded baseline
identity and is not rewritten to a later protected development SHA. Fast
Checks may pass a later execution base (`origin/development` at PR time) for
that exact Phase diff. Customization-scoped Full never enumerates, scans,
tests, or audits files outside that exact diff.

The classifier permits only that exact unchanged inherited failure set. A
changed contract path, stale identity or policy, omitted or new failed context,
cross-contract mismatch, or any other failed CI result remains blocking.
Changes to the classifier or its workflow are admitted only as focused
classifier checks; they do not alter the inherited-failure contract and do not
grant `protectedAdmission`. Customization-only admission never waives
inherited upstream failures. If the execution base cannot be classified as the
exact receipt-maintenance chain or as customization-only, the classifier
returns `HOLD` rather than fabricating a Full rebind.
