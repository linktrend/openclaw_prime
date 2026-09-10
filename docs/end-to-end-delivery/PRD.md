# Product requirements: five executive agents on LiNKserver 01

Status: **PLAN — no execution authority**

## 1. Outcome

Deliver five continuously available, separately identifiable executive agents
on LiNKserver 01:

| Agent | Durable role | Role boundary |
| --- | --- | --- |
| Lisa | CEO and executive-operations orchestrator | Coordinates and reports to the founder; never self-approves or silently absorbs another executive's authority. |
| Eric | CTO | Development, technical operations, and repository review; no code or deployment mutation without the applicable Program authority. |
| David | CPO | Product direction, research, and go-to-market planning; no publication or external commitment without authority. |
| Sara | COO/CFO | Business operations, profile administration, and finance review; no payment, posting, or financial commitment without authority. |
| Jane | Chief Trading Officer | Market research, strategy, and risk review; no live order, broker, payment, or risk mutation without separate approval. |

All five receive the same technical foundation but retain separate personality,
identity, role, responsibilities, workspace, memory, state, credentials,
conversation history, channel bindings, jobs, schedules, and revocation boundary.
Technical parity does not flatten their roles or expose one agent's private state
to another.

## 2. Required common capability

Each agent must have:

1. one immutable admitted OpenClaw image;
2. `openai/gpt-5.6-sol` with Low reasoning as primary;
3. `openrouter/openai/gpt-5.6-luna` with High reasoning as the sole sequential
   fallback after a qualifying primary failure, never load balancing;
4. installed and enabled `openai`, `codex`, `acpx`, `linkbrain`, `linkskills`,
   `openrouter`, `telegram`, and `buzz` plugins;
5. the official `googlechat` plugin installed but disabled until its per-agent
   credential, webhook, access-control, and acceptance gates pass;
6. coding tools, sandbox, subagent, research, and communication capability
   constrained by role and Program authority;
7. a unique Platform actor, runtime binding, credential lineage, Brain client,
   Skills client, model-provider credential references, and independent
   revocation;
8. Brain company-memory access and agent-private-memory isolation;
9. Skills discover, exact-release retrieve, digest verify, local execute, and
   report behavior with no provider-side execution authority;
10. Buzz private-room and shared leadership-room participation through the
    existing externally managed Buzz identities.

## 3. Identity and data requirements

- Lisa's current profile is the baseline to preserve, not a cloning source for
  private data.
- Eric, David, Sara, and Jane use their protected role manifests plus their own
  live workspaces as the only complete profile sources.
- No clone, overlay, repair, backup, or restore may transfer another agent's
  memory, SQLite rows, sessions, recipients, schedules, jobs, credentials,
  cookies, downloads, workspace, channel identity, or private content.
- Technical convergence is overlay-only. The allowed common fields remain the
  primary/fallback model, default reasoning, model parameters/runtime id, and
  required-plugin enablement declared by
  `linkbots/parity/profile-preservation.contract.json`.
- A structural baseline and a verified full backup of every runtime root must
  exist before any live write. Protected-field mismatch triggers immediate
  rollback of the affected agent.
- Platform-signed identity and active binding state are authoritative. A model
  response, role prompt, Brain record, skill release, Buzz profile, or request
  payload cannot create identity or permission.

## 4. Provider and Program boundaries

| Owner | Owns | Does not own |
| --- | --- | --- |
| OpenClaw Prime | Profiles, sessions, channels, model routing, consumer adapters, tools, local execution, rollout and rollback | Platform identity, Brain knowledge policy, Skills qualification, Program permission |
| LiNKplatform | Actors, runtime bindings, authentication, claims, capability primitives, credential lifecycle and audit | Agent profile content, Program permission, Brain/Skills business logic |
| LiNKbrain | Company knowledge, findings, checkpoints, team memory, private-actor-memory contract, handoffs | Technical grants, OpenClaw runtime, Program execution authority |
| LiNKskills | Qualified immutable procedures, selectability, exact releases, provenance and evaluation evidence | Permanent execution, runtime credentials, agent identity |
| LiNKautowork | Accepted deterministic automations, invocations and receipts | Inventing Program workflows or granting an executive authority |
| LiNKlibraries | Static reusable software/assets at accepted exact releases | Agent runtime state or a reason to activate draft/nonselectable Master Website Template assets |
| Program/domain owner | Runs, issues, approvals and domain effects | Silent delegation through a profile or provider |

The accepted Brain and Skills packages prove Lisa-first consumer paths. They do
not reduce this five-agent requirement: Lisa is the first canary, followed by
Eric, David, Sara, and Jane only after each provider publishes or confirms
generic five-actor-compatible bindings and distinct credential references.

Autowork integration is limited to exact accepted automations explicitly
assigned by a Program. LiNKlibraries is not a launch dependency; current Master
Website Template and Starter Foundation candidates remain nonselectable and
must not be smuggled into an agent as a skill.

## 5. Communications requirements

### Buzz

- Reuse the five existing OpenClaw-managed Buzz keypairs and room memberships;
  do not create Buzz-native duplicate agents.
- Preserve existing messages, rooms, memberships, and Mac/iOS history.
- Each agent must reply in its private room, respond when directly mentioned in
  `LiNKbots-leadership`, and send one bounded proactive message.
- Bot-originated shared-room traffic must not fan out into an agent loop.
- The official Buzz plugin is the transport. The Buzz Agents screen may describe
  externally managed agents but must not start, stop, or rewrite Server01 agents.
- Missing photos/descriptions are completed against the existing identities
  after the founder supplies or accepts canonical assets and copy. They are not
  grounds to rebuild the integration.
- The empty external-agent Channels display and the iOS community-label mismatch
  are upstream Buzz product defects/cosmetic gaps. Track them separately; do not
  maintain a permanent OpenClaw fork to mask them.

### Telegram and Google Chat

- Preserve each existing Telegram identity/binding and prove inbound, reply,
  proactive, restart, and cross-agent-denial behavior without exposing message
  bodies in evidence.
- Google Chat remains last in the sequence, as previously directed. Enable five
  distinct app/service-account bindings only after the core fleet is accepted.
- Expose only the authenticated `/googlechat` webhook path publicly. Dashboard,
  agent ports, Brain, Skills, and Buzz administrative surfaces remain private.
- A missing per-agent service account, audience, app visibility, sender policy,
  or HTTPS route leaves that agent's Google Chat disabled; it does not block the
  already-accepted Buzz/Telegram fleet.

## 6. Operational requirements

- Maintain the existing ports and isolated runtime roots in
  `linkbots/parity/parity.contract.json`.
- Keep containers non-root (`1000:1000`), read-only at the image filesystem,
  `no-new-privileges`, all capabilities dropped, bounded CPU/memory/PIDs, and
  restart policy `unless-stopped` unless a reviewed replacement is stronger.
- Use one exact image digest for all five. Tags alone are not evidence.
- Back up live SQLite with OpenClaw's supported online backup path; never copy a
  live `.sqlite`, WAL, SHM, or journal file as the backup.
- Verify every backup and perform an isolated restore before runtime mutation.
  Activation of a restored tree is always offline and explicit.
- Roll out serially: Lisa canary, then Eric, David, Sara, Jane. Stop on any
  identity, protected-profile, fallback, provider, channel, health, or isolation
  failure.
- Restart one agent at a time and prove the other four are unaffected. Complete
  one planned host reboot/recovery test after all five pass.
- Record only redacted structural evidence, exact hashes, identifiers, counts,
  timestamps, and pass/fail outcomes. Never commit secrets, tokens, private
  messages, private memory, email, health data, or credential values.

## 7. Release and acceptance definition

Completion requires all of the following at one current identity:

- exact source commit/tree protected through the governed development → staging
  → main path;
- independently reviewed immutable image digest built from that protected tree;
- five healthy isolated services using that digest;
- unique Platform/Brain/Skills/model/channel bindings with cross-agent denial;
- Sol Low primary and a real or safe injected qualifying-failure Luna High
  fallback proof for every agent;
- role, personality, and responsibility checks for all five;
- Brain, Skills, Buzz, Telegram, and—after its own gate—Google Chat acceptance;
- verified backup, isolated restore, per-agent restart, and host reboot receipts;
- founder live acceptance of representative conversations and exact role
  behavior;
- rollback rehearsed and documented; and
- no required packet, secret reference, migration, review, or runtime claim left
  in HOLD.

Healthy containers, source tests, provider health, or historical message tests
alone do not satisfy this definition.

## 8. Explicit exclusions

This delivery does not authorize live trading, payments, finance postings,
legal commitments, external publication, outreach, purchases, new standing
orders, new business workflows, or self-approval. It does not activate draft
Libraries releases, copy Lisa's private data, redesign Buzz, replace Platform,
or merge directly to a protected branch.

