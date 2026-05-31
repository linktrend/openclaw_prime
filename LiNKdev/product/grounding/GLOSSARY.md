# Glossary — LiNKbot-core

Short terms for this execution-target repo. Platform-wide vocabulary: LiNKtrend-System `docs/terminology.md`.

| Term | Meaning |
|------|---------|
| **OpenClaw** | Upstream engine product name; CLI/package path `openclaw` |
| **LiNKbot-core** | LiNKtrend fork of OpenClaw — this repository |
| **LiNKbot** | Runtime plane: role-bound AI employees (System owns roles/comms; engine owns execution) |
| **Principal** | Sole human authority; approves protected actions and promotion to staging/main |
| **Project** | Tenant live work instance in LiNKaios (legacy code may still say `missionId`) |
| **Phase** | Stage group inside a LiNKaios module |
| **Issue** | Atomic governed task with input/output contracts |
| **Assignee** | LiNKbot, **Automation** (LiNKautowork), or Human on an issue |
| **Run** | One pass through project modules (maps to Plane Cycle when synced) |
| **Capability** | Governed integration to external software (LinkSkills lease) |
| **Gateway** | OpenClaw control plane — WebSocket RPC, HTTP ingress, channel routing |
| **linktrendGovernance** | Optional agent-run payload for bootstrap, mission, and tool allow-list |
| **bot-runtime** | System orchestrator that calls this repo's governed ingress |
| **Execution target** | This repo runs the engine; program tracking lives in LiNKtrend-System |
| **Extension / plugin** | Bundled channel or provider package under `extensions/` |
| **Upstream** | `openclaw/openclaw` — sync only, never push |
