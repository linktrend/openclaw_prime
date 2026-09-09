# Handoff: Server01 five-agent parity source slice

- Date: 2026-09-08 12:43 Asia/Taipei
- Agent: Codex CLI feature agent
- Branch: `dev/minicodex/WP-0-agent-parity-20260908`
- Starting/ending head: `8f396c1eb76`
- Production mutation: none

## Result

Prepared a source-only, fail-closed parity contract, common config merge patch,
five-service Server01 Compose topology, non-secret environment example, and
validator. Changed Lisa's title to Chief Executive Officer. No personality,
responsibility, memory, job, recipient, channel binding, credential, or private
state was changed.

## Files created or modified

- `linkbots/parity/README.md`
- `linkbots/parity/parity.contract.json`
- `linkbots/parity/openclaw.common.patch.json5`
- `linkbots/parity/compose.server01.yml`
- `linkbots/parity/env.example`
- `linkbots/parity/validate.mjs`
- `linkbots/lisa/Personality files/IDENTITY.md`
- this handoff and completed session record

## Validation

- `git diff --check`: PASS
- `docker compose -f linkbots/parity/compose.server01.yml config --no-interpolate`: PASS
- `node linkbots/parity/validate.mjs`: expected FAIL, only because
  `extensions/linkbrain` and `extensions/linkskills` are absent from this branch

## Candidate image/build plan

1. Integrate the exact reviewed LiNKbrain/LiNKskills plugin trees from the
   current protected fork source into the upgraded source candidate without
   overwriting the 2026.9.2 upgrade.
2. Re-run `node linkbots/parity/validate.mjs`; require PASS.
3. Build from the root Dockerfile with
   `OPENCLAW_EXTENSIONS=openai,codex,acpx,linkbrain,linkskills,telegram,buzz,googlechat`.
4. Inspect the built plugin inventory and run focused config/model/fallback,
   plugin-load, sandbox, subagent, and channel startup proof.
5. Tag by exact source SHA and deploy only by immutable image digest.

## Production deployment plan

After independent review and a separate production gate: back up each agent's
own config/state metadata; create separate Server01 state/workspace/auth/env
owners; merge the common patch independently into each existing config; retain
all existing identity-specific bindings and private files; pull the immutable
image; start one canary; verify health, effective primary/fallback reasoning,
plugin/tool exposure, and identity isolation; then roll agents one at a time.

## Rollback

Stop only the failed agent service, restore that agent's pre-deploy config, and
restart it on the prior immutable image digest. Do not replace or restore any
other agent's state. No database migration is introduced by this slice.

## Blocker and exact next action

True blocker: the upgraded task branch omits LiNKbrain and LiNKskills, so a
compliant candidate image cannot yet be built. Next: port those two plugin trees
from the reviewed protected fork identity onto this upgraded branch, resolve any
2026.9.2 contracts, and validate before image build. Server01 remains untouched.

## Confidence

98% for the source-only topology and fail-closed gate. Production readiness is
not claimed until plugin integration, image proof, credential/binding inventory,
canary, and live acceptance are complete.

## Dated amendment — 2026-09-08 14:10 Asia/Taipei

- This handoff records the first source-only worker's state. Its `compose.server01.yml` and `env.example` were subsequently removed because the compose paths, ports, and topology were not authoritative.
- The protected Brain/Skills trees and their required integration closure were reconciled by the second implementation worker. Focused plugin, machine-token, model/fallback, build/export, parity, and Compose-config validation now pass.
- Production remains unverified and untouched. The supplied fleet compose artifact is still absent; the checked-in fleet source artifact is based on the nearby leadership-cells compose evidence and is explicitly source-only, not a claim that the production fleet file was located.
