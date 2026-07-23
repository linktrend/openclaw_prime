---
type: ToolReference
title: lisa-safe — Safe exec wrappers
description: Narrowly scoped helpers that keep Lisa's Google/email/Drive ops analyzable for exec approvals
load: on_demand
read_when:
  - Any Google Workspace work (calendar, gmail, drive, docs)
  - Sending email with a non-trivial body
  - Creating/sharing Drive Docs
  - Looking up gws --help
  - Any exec approval about pipes, redirects, or command substitution
  - After SYSTEM_RUN_DENIED or unrecognized gws subcommand
tags: [exec, approvals, gws, email, drive, calendar]
---

# `tools/bin/lisa-safe` — Safe exec wrappers

**Binary:** `/Users/linktrend/.openclaw-lisa/workspace/tools/bin/lisa-safe` (also `tools/bin/lisa-safe` from workspace cwd)

## HARD RULES (non-negotiable)

1. **Default for Google work:** use `tools/bin/lisa-safe …` — not improvised bare `gws`.
2. **Never invent gws subcommands.** Never pipes / `2>&1` / `|` / `$()` / `||` / `&&` / heredocs on `exec`.
3. **If `lisa-safe` has no verb for what you need:** stop and report to Carlos — **do not improvise** a raw `gws` shape.
4. **Carlos Google Tasks:** `tools/bin/lisa-carlos-tasks` / skill `lisa-tasks` only — never `lisa-safe drive-json`, never Docs Assign, never bare `gws tasks` for Carlos's lists.
5. **Auth / Keep:** never. Denylist blocks `gws auth*` and `gws keep*`. Report `invalid_rapt` / no-credentials to Carlos.

Lisa's host runs with `security=full` + `ask=off`, but a denylist STOP list is always active. Opaque shell (`|`, `2>&1`, `||`, `$(…)`, heredocs) is **hard-denied** — it will **not** open an Allow-once card for Carlos.

## Allowed commands only (cheat sheet)

```bash
# Email triage (heartbeat/digest)
tools/bin/lisa-safe gmail-triage --max 5

# Email send (@linktrend.media only). Body must be a workspace file.
tools/bin/lisa-safe email-send \
  --to calusa@linktrend.media \
  --subject "Subject" \
  --body-file scratch/email_body.txt

# Help (no pipes) — never auth/keep tokens
tools/bin/lisa-safe gws-help drive files create
tools/bin/lisa-safe gws-help gmail +send

# Calendar
tools/bin/lisa-safe calendar-list --max-results 10
tools/bin/lisa-safe calendar-agenda --timezone Asia/Taipei
tools/bin/lisa-safe calendar-agenda --tomorrow --timezone Asia/Taipei
tools/bin/lisa-safe calendar-insert \
  --calendar calusa@linktrend.media \
  --summary "Title" \
  --start "2026-07-22T10:00:00+08:00" \
  --end "2026-07-22T10:30:00+08:00" \
  --dry-run

# Drive / Docs
tools/bin/lisa-safe drive-list --page-size 10
tools/bin/lisa-safe drive-create-doc --name "Ops Notes"
tools/bin/lisa-safe drive-share --file-id FILE_ID --email calusa@linktrend.media --role writer
tools/bin/lisa-safe docs-append --document DOC_ID --text-file scratch/doc_chunk.txt

# Generic JSON / params (drive/docs/gmail/calendar/tasks only; auth/keep blocked)
tools/bin/lisa-safe drive-json \
  --resource drive.files \
  --method create \
  --json-file scratch/create_doc.json

# Readonly capability smoke (calendar + drive + gmail triage)
tools/bin/lisa-safe smoke-gws
```

**Verbs (complete list):** `email-send` · `gmail-triage` · `gws-help` · `calendar-list` · `calendar-agenda` · `calendar-insert` · `drive-list` · `drive-create-doc` · `docs-append` · `drive-share` · `drive-json` · `smoke-gws`

## Need → command (do this / never that)

| Need                   | Do this                                                           | Never do this                                                    |
| ---------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| Read/list files        | native `read` / `list` / `glob`                                   | `cat … 2>&1`, `ls … 2>&1 \|\| echo`                              |
| Session state          | `sessions_*` / `sessions.list`                                    | shell `ls`/`find` on session dirs with pipes                     |
| Unread email           | `lisa-safe gmail-triage --max 5`                                  | `gws gmail list`, `+list`, `… 2>&1 \| head`                      |
| gws help               | `lisa-safe gws-help gmail +send`                                  | `gws … --help 2>&1 \| head -N`                                   |
| Calendar list / agenda | `lisa-safe calendar-list` / `calendar-agenda`                     | `gws calendarList …`, `gws calendar get`, `gws events …`         |
| Create calendar event  | `lisa-safe calendar-insert …` (prefer `--dry-run` first)          | multiline `+insert` with `\` / `2>&1`                            |
| Send email (any body)  | `write` body → `lisa-safe email-send --body-file …`               | `gws gmail send` (no `+`), `--body "$(cat …)"`                   |
| Create Google Doc      | `lisa-safe drive-create-doc --name "…"`                           | inline `--json '{…}' 2>&1`                                       |
| Share Drive file       | `lisa-safe drive-share --file-id ID --email user@linktrend.media` | `permissions create --json '…' 2>&1`                             |
| Append to Doc          | `write` → `lisa-safe docs-append --document ID --text-file …`     | giant `--text` on command line                                   |
| Structured gws JSON    | `scratch/` JSON → `lisa-safe drive-json …`                        | embedding large JSON on the command line                         |
| Carlos Tasks           | `tools/bin/lisa-carlos-tasks …`                                   | `gws tasks +list`, Lisa-primary `gws tasks` for digest/heartbeat |
| Missing verb           | **Stop and report**                                               | inventing a new `gws` path                                       |

## Narrow bare-gws escape hatch (optional only)

If `lisa-safe` is somehow unavailable, these **unpiped** bare forms are still allowlisted — but prefer `lisa-safe` always:

- `gws gmail +triage --max 5`
- `gws calendar calendarList list`
- `gws calendar +agenda --today --timezone Asia/Taipei`
- `gws gmail +send …` (tiny one-line body only)
- `gws … --help` (no pipe)

Anything else bare/`gws` improvised is wrong. Auth/Keep/invented helpers are denylisted.

## Still approval-gated / blocked

- Denylist matches (`gws auth*`, `gws keep*`, invented `gmail list` / `calendarList` / `events` top-level / `tasks +list`) require explicit approval even with Ask=off (askFallback deny → hard fail without UI).
- External email domains are refused by `lisa-safe`.
- Broad `bash`/`sh -c`, arbitrary redirects, and arbitrary mutating `gws` are **not** allowlisted.

## Related

- `tools/gws.md` — full gws doctrine + failure modes
- `TOOLS.md` § Safe exec architecture
- `~/.openclaw-lisa/exec-approvals.json` — allowlist + denylist
