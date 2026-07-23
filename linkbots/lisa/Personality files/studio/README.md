# LiNKtrend Venture Studio — Repo Map & Deployment Status

_Saved 2026-07-19 from Carlos's rundown. Not authoritative — repos are the source of truth._

## The Repos

| Repo                | Local Path                                  | Role                                                                                                           |
| ------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **IDE Development** | `/Users/linktrend/Projects/IDE Development` | Shared toolkit for Cursor. Rules, AI roles, skills, workflow pipeline. Installed via symlink into new repos.   |
| **LiNKdeveloper**   | `/Users/linktrend/Projects/LiNKdeveloper`   | Unattended "fire-and-forget" AI app factory. 7-stage pipeline, human needed at start + final review only.      |
| **LiNKplatform**    | `/Users/linktrend/Projects/LiNKplatform`    | Shared foundation: orgs/tenants, permissions, capability registry, Program handoff format.                     |
| **LiNKskills**      | `/Users/linktrend/Projects/LiNKskills`      | Central catalog of reusable AI-agent skills with quality tests and usage tracking.                             |
| **LiNKbrain**       | `/Users/linktrend/Projects/LiNKbrain`       | Shared long-term memory. Agents read/write; Librarian reviews and curates.                                     |
| **LiNKsites**       | `/Users/linktrend/Projects/LiNKsites`       | Small-business website factory from reusable templates. Revenue-facing product.                                |
| **LiNKautowork**    | `/Users/linktrend/Projects/LiNKautowork`    | Automation engine (self-hosted n8n fork). Security gateway, audit trail, kill-switch. Nested repo: `link-n8n`. |
| **LiNKlibraries**   | `/Users/linktrend/Projects/LiNKlibraries`   | Shared library of pre-built components/templates/assets for IDE Dev + LiNKdeveloper.                           |

## Current Status

**All engineering/coding is finished.** Every repo builds, passes tests, clean version control. No further coding needed.

## Remaining Work (Deployment Phase)

These are the gaps between "code done" and "actually live":

1. **Secrets & credentials** — Real API keys and service credentials into secret manager (email, AI models, DB). Currently placeholders.
2. **Shared database setup** — LiNKplatform production DB live; each Program's schema activated with real data.
3. **Server deployment** — LiNKautowork, LiNKdeveloper orchestrator, LiNKsites need hosting, domains, SSL.
4. **Cross-repo wiring** — End-to-end handoff tests between Programs (live, not simulated).
5. **LiNKdeveloper live test** — First genuine unattended build start-to-finish on live server.
6. **Monitoring & backups** — Basic alerting/backup once live environment exists.

**No coding needed anywhere** — all remaining work is config, deployment, and integration testing.

## Companies

| Company                | US Address                                           | Scope                                                                                                                                                             |
| ---------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **LiNKtrend LLC**      | 407 Lincoln Road Suite 8N 398, Miami Beach, FL 33139 | All repo work (except legal cases). Need to reconcile knowledge vault / LiNKdrive at `~/Library/CloudStorage/GoogleDrive-info@linktrend.media/My Drive/LiNKdrive` |
| **FourC Ventures LLC** | 407 Lincoln Road Suite 8N 398, Miami Beach, FL 33139 | Needs: bank transfer → credit card issuance → ship to Miami office → forward to Taiwan → open accounts at Interactive Brokers, Hyperliquid, Binance, Coinbase     |
