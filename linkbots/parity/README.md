# Server01 five-agent parity

Source-only deployment inputs for Lisa, David, Eric, Sara, and Jane on
**OpenClaw Prime 1.0**. Operator briefing:
[`docs/openclaw-prime-1.0-briefing.md`](../../docs/openclaw-prime-1.0-briefing.md).
This slice does not create accounts, credentials, recipients, schedules, jobs, memories,
queues, or production state. It preserves Lisa's separate compose topology and
the existing four-agent fleet topology; it does not invent a replacement
deployment layout.

## Contract

- One immutable image for all five agents.
- Separate state, workspace, auth, environment, port, and service per agent.
- Primary: `openai/gpt-5.6-sol`, low thinking.
- Sole ordered fallback after the primary attempt fails:
  `openrouter/openai/gpt-5.6-luna`, high thinking; no routine load balancing.
  Known provider/model failures and an unclassified thrown error qualify when a
  later candidate exists; abort, context-overflow, local runtime-coordination,
  and missing-harness errors stop the chain. Candidates are tried sequentially.
- Shared plugin/model substrate; role-specific policy remains in each existing
  workspace. Lisa's coding-task policy is an explicit HOLD because no supported
  generic field exists for an equivalent cross-agent rule.
- Required plugins: OpenAI, OpenRouter, Codex, ACPX, LiNKbrain, LiNKskills,
  Telegram, Buzz, and Google Chat.

`openclaw.common.patch.json5` is an overlay for each existing private agent
config. The machine-checked allowlist in `overlay.mjs` rejects whole-config
replacement and rejects protected profile domains. Channel accounts, plugin
endpoints, SecretRefs, auth profiles, jobs, recipients, and identity-specific
bindings remain per-agent inputs. Google Chat is present in the image but stays
disabled until every agent-specific gate passes. The per-agent
`env/<agent>.env` and `agent-bindings.template.json5` templates contain
placeholders only; they are not credential inventories.

The supplied `openclaw-fleet.compose.yml` path was absent during source
inspection. `compose.server01.fleet.yml` preserves the verified nearby
leadership-cells fleet structure for Eric, David, Sara, and Jane and is kept
separate from Lisa's `compose.server01.lisa.yml`. This is source evidence, not
production proof.

## Build gate

Run:

```bash
node linkbots/parity/validate.mjs
```

The validator intentionally fails if any required plugin is absent. After the
exact source tree contains all plugins, build and record the immutable digest:

```bash
docker build \
  --build-arg OPENCLAW_EXTENSIONS=openai,openrouter,codex,acpx,linkbrain,linkskills,telegram,buzz,googlechat \
  --tag openclaw-prime-agent-parity:<exact-source-sha> .
docker image inspect openclaw-prime-agent-parity:<exact-source-sha> --format '{{index .RepoDigests 0}}'
```

Do not deploy a mutable tag. Set `OPENCLAW_PARITY_IMAGE` to the resulting digest.
The protected plugin source identity reconciled here is commit
`cbc861486c05e57d3ec512e65a7800059b8fad9c`, tree
`8e99e62ef9d934f24fe7febed279d742bd099e66`; the candidate base remains
`8f396c1eb7677d4dbece731eb2eb738d4f6a5891` / tree
`39ae372d76d22a1b693de30877d94898f0ae0ae3` and is not protected-integrated.

Parse the preserved source artifacts without starting services:

```bash
OPENCLAW_PARITY_IMAGE=local/openclaw-prime@sha256:$(printf '0%.0s' {1..64}) \
  docker compose -f linkbots/parity/compose.server01.lisa.yml --profile production config
OPENCLAW_PARITY_IMAGE=local/openclaw-prime@sha256:$(printf '0%.0s' {1..64}) \
  docker compose -f linkbots/parity/compose.server01.fleet.yml config
```

## Deployment gate

1. Capture a redacted structural baseline for every agent into an ephemeral
   Server01 receipt before any live mutation.
   The baseline must include authorization-database path/identity, revocation
   boundary identity, identity-file names/paths/existence, workspace path and
   relative entry structure, and the non-Lisa `TOOLS.md` path/existence. These
   are metadata-only facts; contents are never read or emitted.
2. Back up each complete runtime root independently and recoverably.
3. Apply the allowlisted technical overlay to each existing config without
   changing identity, role, memory, jobs, recipients, channel account IDs, or
   private state.
4. Validate each candidate, recapture and compare every protected structural
   fact after write, and stop plus restore the affected backups on any mismatch.
5. Create five separately permissioned `env/<agent>.env` files from the checked-in
   placeholders; inject only that agent's SecretRefs/credentials.
6. Validate config and plugin availability for each agent before restart.
7. Start one canary agent only in a separately authorized run, verify health,
   exact model/fallback/thinking readback, plugin list, model-visible tools,
   and channel probes. Google Chat remains gated until cloud inventory,
   Platform registration, and live credentials are independently verified.
8. Roll out serially to the remaining agents only after the canary passes.

Production mutation requires a separate explicitly authorized run.

## Rollback

Pin `OPENCLAW_PARITY_IMAGE` back to the previous immutable digest, restore only
the affected agent's backed-up config/state mounts, and restart only that
service. Do not cross-restore state, auth, workspace, memory, queues, or
credentials between agents.
Never restore one agent's auth, workspace, state, memory, or queues into another.
