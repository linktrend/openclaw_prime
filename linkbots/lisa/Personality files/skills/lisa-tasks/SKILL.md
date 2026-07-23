---
name: lisa-tasks
description: Manage Carlos's Google Tasks (all lists) via a separate OAuth as calusa@linktrend.media. Use for listing/creating/updating/completing/deleting tasks, heartbeat/digest Tasks Yes/No from Carlos's tasks, and any Carlos action-item work. Never use Docs Assign or Chat Space assign as primary.
metadata: { "openclaw": { "emoji": "✅", "requires": { "bins": ["gws"] } } }
---

# Lisa Tasks — Carlos Google Tasks

Full Tasks management on **Carlos's** account (`calusa@linktrend.media`), not Lisa's empty `@default` list.

## Auth model (critical)

| Account                                 | Config dir                   | Wrapper / CLI                          |
| --------------------------------------- | ---------------------------- | -------------------------------------- |
| Lisa primary (`lisa@linktrend.media`)   | `~/.config/gws`              | bare `gws …` (calendar, gmail, drive…) |
| Carlos Tasks (`calusa@linktrend.media`) | `~/.config/gws-carlos-tasks` | `tools/bin/lisa-carlos-tasks …`        |

**Never** run `gws auth login` against the primary `~/.config/gws` for this skill. **Never** overwrite Lisa's primary credentials.

### One-time login (Carlos, interactive Terminal)

If the wrapper exits 2 with "no credentials":

```bash
export PATH="/opt/homebrew/opt/node@24/bin:/opt/homebrew/bin:$PATH"
export GOOGLE_WORKSPACE_CLI_CONFIG_DIR=~/.config/gws-carlos-tasks
# client_secret.json should already be present in that dir
gws auth login -s tasks
# Sign in as calusa@linktrend.media (not lisa@)
```

Lisa must **not** run `gws auth login` / `logout` / `revoke` herself (Red Line). Report to Carlos and wait.

### Auth ready check

```bash
GOOGLE_WORKSPACE_CLI_CONFIG_DIR=~/.config/gws-carlos-tasks gws auth status
```

Ready when `encrypted_credentials_exists` (or plain `credentials.json`) is true and scopes include Tasks.

## Wrapper

```bash
tools/bin/lisa-carlos-tasks <tasklists|tasks> <method> [flags]
```

Sets `GOOGLE_WORKSPACE_CLI_CONFIG_DIR` and runs `gws tasks …`. No pipes, no `2>&1`, no `| head` (denylist).

## Core operations

### List all lists

```bash
tools/bin/lisa-carlos-tasks tasklists list
```

Carlos OK'd access to **all** his lists — not limited to one list.

### List open tasks on a list

```bash
tools/bin/lisa-carlos-tasks tasks list --params '{"tasklist":"<LIST_ID>","showCompleted":false}'
```

### Create

```bash
tools/bin/lisa-carlos-tasks tasks insert --params '{"tasklist":"<LIST_ID>"}' --json '{"title":"Task title","notes":"optional"}'
```

Optional due (date only, RFC3339): `"due":"2026-07-22T00:00:00.000Z"`.

### Update

```bash
tools/bin/lisa-carlos-tasks tasks patch --params '{"tasklist":"<LIST_ID>","task":"<TASK_ID>"}' --json '{"title":"New title","notes":"..."}'
```

### Complete

```bash
tools/bin/lisa-carlos-tasks tasks patch --params '{"tasklist":"<LIST_ID>","task":"<TASK_ID>"}' --json '{"status":"completed"}'
```

### Delete

```bash
tools/bin/lisa-carlos-tasks tasks delete --params '{"tasklist":"<LIST_ID>","task":"<TASK_ID>"}'
```

## Heartbeat / morning digest — Tasks Yes/No

Source of truth = **Carlos's** tasks via this wrapper (any list with open items).

1. `tools/bin/lisa-carlos-tasks tasklists list`
2. For each list id: `tools/bin/lisa-carlos-tasks tasks list --params '{"tasklist":"<LIST_ID>","showCompleted":false}'`
3. Summary **Tasks: Yes.** if any non-completed task exists; else **No.**
4. If wrapper fails once (auth missing / API error): stop retrying tasks exec this cycle; fall back to last successful Yes/No. Summary line stays plain `Yes.` / `No.` only.

**Do not** use bare `gws tasks …` (Lisa account) for digest/heartbeat Tasks Yes/No — Lisa's lists are usually empty and misleading.

**Do not** count Docs checklists, Chat Space assign, or any Docs Assign registry.

## Primary workflow (Carlos action items)

1. Create / update / complete / delete tasks on Carlos's lists with this skill.
2. Notify Carlos on **Telegram** (primary channel for now).
3. Never use Docs Assign as Task or Chat Space assign as the primary path.

## Forbidden

- Docs → Assign as Task / Chat Space assign as primary workflow
- `tools/assign-task-to-carlos.py`, `google-tasks-assignment.md`, `lisa-tasks-browser.md` (deleted)
- Bare `gws tasks …` for Carlos task management (wrong account)
- `gws auth login|logout|revoke` from Lisa
- Opaque shell (`|`, `2>&1`, `||`, `$(…)`)

## Failure handling

| Symptom                        | Action                                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------------------------- |
| Wrapper exit 2, no credentials | Tell Carlos the exact login commands above; stop                                                   |
| `invalid_rapt` / reauth        | Report to Carlos; do not logout/login                                                              |
| Empty lists after auth         | Confirm signed in as `calusa@` not `lisa@` via `gws auth status` under the carlos-tasks config dir |
