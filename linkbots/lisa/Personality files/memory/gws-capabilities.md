---
type: GwsReference
title: gws — Capability Status
description: Which Google Workspace services Lisa can verify via CLI vs doctrine-only
load: on_demand
read_when:
  - Verifying gws / Google Workspace integration
  - Carlos asks about Keep, calendar, tasks, drive, or gmail access
  - Capability check or smoke test after setup
tags: [gws, keep, google-workspace]
---

# gws — Capability Status

**Authoritative detail:** `TOOLS.md` § gws and § Google Keep.

## Live exec smokes (working)

| Service  | Smoke                                                                        |
| -------- | ---------------------------------------------------------------------------- |
| Calendar | `gws calendar calendarList list --params '{"maxResults": 1}'`                |
| Tasks    | `gws tasks tasklists list --params '{"maxResults": 1}'`                      |
| Drive    | `gws drive files list --params '{"pageSize": 1}'`                            |
| Gmail    | `gws gmail users messages list --params '{"userId": "me", "maxResults": 1}'` |

## Doctrine-only (do NOT exec)

| Service                        | Status                                                                                            | Report to Carlos                                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Keep**                       | Unavailable via `gws` CLI — 403 insufficient scopes expected                                      | UI collaborator share at keep.google.com only; use Tasks/Drive for automation                                                                       |
| **Carlos Google Tasks**        | Separate OAuth as `calusa@linktrend.media` via `tools/bin/lisa-carlos-tasks` / skill `lisa-tasks` | Full list/create/update/complete/delete across all his lists. Heartbeat/digest Tasks Yes/No from this path. Docs Assign / Chat Space assign retired |
| **Docs Assign → Google Tasks** | **Retired (2026-07-21)**                                                                          | Do not use. Executive Tasks Doc trashed. Use `lisa-tasks` skill instead                                                                             |

**Never run `gws keep notes list` (or any `gws keep …`) during capability verification.** Verified 2026-07-10: exec produces misleading UI failure; OAuth cannot grant Keep scope on Lisa's Desktop login.

## Last verified

- **2026-07-10:** calendar, tasks, drive, gmail smokes pass with Lisa OAuth. Keep blocked by design (enterprise API; not in `gws auth login` picker).
