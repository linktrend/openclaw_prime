# Open-source and installed-capability inventory

Status: **planning preflight; verify versions again at execution**

The existing stack already solves the deployment. No custom orchestration
service, duplicate Buzz integration, JSON state store, or paid substitute is
justified.

| Need | Existing project/capability | Planning state | Decision |
| --- | --- | --- | --- |
| Agent runtime | OpenClaw Prime `2026.9.2` | Five live isolated healthy containers | Extend current source and runtime; do not rebuild. |
| Container lifecycle | Docker `29.8.0`, Compose `v5.5.1` on Server01 | Current and healthy | Retain two compose projects and immutable digests. |
| Runtime language | Node supported ranges in `package.json`; Node 24 recommended | Image/toolchain must be re-read | Pin supported Node 24 in build receipt. |
| Package manager | `pnpm@12.1.0` pinned by package manager hash | Local configured binary currently returns `ENOEXEC` | Repair/replace only through approved toolchain setup; do not change package manager. |
| Agent state | OpenClaw SQLite/Kysely stores | Separate live SQLite per agent | Use supported online backup/restore; no JSON sidecars. |
| Continuous/snapshot backup | OpenClaw backup CLI; Litestream or `sqlite3_rsync` if later required | Current source documents supported paths; live schedule needs audit | Prefer built-in verified backups for deployment gate; no new paid service. |
| Buzz transport | Official `@openclaw/buzz@2026.9.2` | Installed in all five; Buzz services healthy | Reuse identities/rooms/history; upstream client fixes only. |
| Google Chat | Official `@openclaw/googlechat@2026.9.2` | Installed, disabled for all five | Enable last with five distinct credential/app gates. |
| Telegram | Existing OpenClaw Telegram plugin | Enabled in all five | Preserve and revalidate bindings. |
| Primary model | OpenAI provider + Codex app server | Configured Sol Low; Lisa auth refresh failed in a real turn | Govern source repair, then reauthenticate only with explicit account/device approval. |
| Fallback model | OpenRouter provider | Luna High configured; current image failed to reach it after auth refresh error | Do not add another provider; repair and prove canonical classification. |
| Coding delegation | Existing OpenClaw subagent/ACP/ACPX surfaces | Plugin enabled; generic five-agent routing field remains a source HOLD | Add one supported common seam, not personality-only duplication. |
| Company knowledge | LiNKbrain service + MCP | Server endpoints healthy; accepted provider plan is Lisa-first | Bind Lisa first, then four distinct actors after provider scope receipt. |
| Procedures | LiNKskills service | Server endpoint healthy; five initial exact releases only | Consume only selectable digest-pinned releases and execute locally. |
| Identity/control | LiNKplatform PACI/contracts | Active recovery owns live migrations/credentials | Wait for its accepted live handoff; no parallel DB mutation. |
| Automation | LiNKautowork gateway/n8n/NATS design | Source/live work is separately governed | Use only accepted explicitly assigned workflows; not a core launch dependency. |
| Reusable assets | LiNKlibraries | Accepted static-provider plan; MWT/Starter items nonselectable | No launch binding or custom substitute. |
| Private network | Existing Server01/Tailscale/reverse-proxy foundation | Agent ports currently loopback-only | Preserve; expose only authenticated Google Chat webhook when approved. |

## Rejected custom or paid additions

- No Kubernetes: five stable services on one capable host do not justify its
  operating cost or complexity.
- No second agent framework or Buzz-native agents: it would split identity,
  memory, and operations.
- No new database: SQLite remains OpenClaw state authority; Platform/Brain/Skills
  retain their existing stores.
- No new message bus for agent-to-agent conversation: Buzz and current OpenClaw
  routing cover the requirement.
- No paid monitoring/backup vendor is required for this deployment. Reassess
  only if measured recovery or retention requirements exceed current tools.
- No recommended marketplace plugin in the task context replaces an accepted
  OpenClaw/Platform/Brain/Skills/Buzz component.

## Upstream-first defects

The Buzz external-agent Channels display, externally managed agent-directory
presentation, and iOS community-label mismatch belong upstream in Buzz when
reproduced. An OpenClaw deployment workaround may be temporary and separately
reviewed, but a permanent product fork is not the architecture.

