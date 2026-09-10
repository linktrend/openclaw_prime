# Target architecture

Status: **PLAN — no execution authority**

## Runtime topology

```text
Founder / approved human accounts
        |
        +-- Buzz (existing workspace, five existing bot identities)
        +-- Telegram (five preserved bindings)
        +-- Google Chat (five distinct apps; disabled until final gate)
        |
LiNKserver 01 private ingress / authenticated webhook boundary
        |
        +-- Lisa  :18791  /srv/linktrend/runtime/openclaw/lisa
        +-- Eric  :18792  /srv/linktrend/runtime/openclaw/eric
        +-- David :18793  /srv/linktrend/runtime/openclaw/david
        +-- Sara  :18794  /srv/linktrend/runtime/openclaw/sara
        +-- Jane  :18795  /srv/linktrend/runtime/openclaw/jane
              each: config + workspace + agent SQLite + auth + channels
              all: one exact immutable OpenClaw image digest
        |
        +-- LiNKplatform: signed actor/runtime/credential/capability boundary
        +-- LiNKbrain: company knowledge + actor-private memory services
        +-- LiNKskills: qualified exact-release retrieval service
        +-- LiNKautowork: assigned automation requests/receipts only
```

The current live shape already has five separate healthy containers, ports,
runtime roots, workspaces, and SQLite files. Delivery converges the missing
identity/provider/acceptance facts without replacing that shape.

## Request path

1. A channel authenticates the sender and resolves exactly one agent/session.
2. OpenClaw loads that agent's own profile, state, and prepared runtime facts.
3. Platform credential and signed claim establish actor, runtime binding,
   audience, resource, action, environment, and active credential state.
4. Brain and Skills receive separate least-privilege credentials and return
   authorization-filtered results. Neither grants execution.
5. OpenClaw applies the agent's role/tool policy and the Program's independent
   permission before any action.
6. The primary Sol Low attempt runs. Only a classified qualifying failure may
   advance to the single Luna High fallback.
7. Delivery returns through the originating channel or an explicitly authorized
   proactive destination, with body-free operational telemetry and a redacted
   receipt.

## State and trust boundaries

| Boundary | Required invariant | Failure response |
| --- | --- | --- |
| Agent state | No runtime root, workspace, SQLite, auth, channel key, queue, or memory is shared | Stop affected packet; restore its verified backup |
| Model routing | Sol Low primary; Luna High sole fallback; no load balancing or persistent per-turn drift | Do not serve the candidate; restore prior image/config |
| Platform | `private_key_jwt`; no shared-secret client auth; identity derived from signed active claims | Deny and leave agent disabled for provider-backed work |
| Brain | Company knowledge and actor-private memory remain distinct; no cross-agent private reads | Disable Brain binding for affected agent; preserve local state |
| Skills | Exact selectable release and digest; execution stays local | Fail closed; no stale/latest fallback |
| Buzz | Existing dedicated bot keys; authorized rooms; mention and loop controls | Disconnect only affected Buzz account; preserve identity and rooms |
| Google Chat | Authenticated HTTP webhook, exact audience, per-agent app identity | Keep plugin disabled for affected agent |
| Deployment | Immutable image, backup/restore, one-agent serial canary | Roll back affected service before continuing |

## Model-fallback dependency contract

OpenClaw's Codex adapter uses Codex app-server's
`account/chatgptAuthTokens/refresh` server request. At inspected Codex commit
`b2dc8b3e4be4fe3a453d50e13835f707b258f15b`, the protocol returns a normal
JSON-RPC error containing `code`, optional `data`, and `message`; the external
auth bridge turns this into `auth refresh request failed: code=... message=...`.
The current live OpenClaw image loses that source failure before canonical
fallback selection. The reviewed issue-312 candidate repairs the projection and
classification path, but it is not protected-integrated. Its identity must be
rechecked and governed before use.

Direct dependency evidence checked:

- Codex `codex-rs/app-server-protocol/src/protocol/v2/account.rs`
- Codex `codex-rs/app-server-protocol/src/rpc.rs`
- Codex `codex-rs/app-server/src/external_auth.rs`
- Codex `codex-rs/app-server/src/error_code.rs`
- Codex `codex-rs/login/src/auth/manager.rs`

## Deployment boundary

Source, provider, consumer, image, live deployment, canary, and production
acceptance are separate gates. A packet may pass one without implying the next.
Server01 mutation uses one exclusive lease shared with the active Platform
recovery owner. Database migrations, secret rotation, Buzz maintenance, agent
config writes, image replacement, and reboot must never overlap.

