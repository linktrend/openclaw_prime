---
type: ToolReference
title: Google Workspace CLI (gws) — Full Reference
description: Identity model, scopes, commands, security boundaries, and the verified Google Keep limitation
load: on_demand
read_when:
  - Running any gws command (calendar, tasks, drive, gmail)
  - Carlos asks about Lisa's Google Workspace access or Keep
  - Setting up or re-verifying gws auth/scopes
  - A gws command fails and the cause is unclear
tags: [gws, google-workspace, keep, tools]
---

# Google Workspace CLI (`gws`) — Full Reference

**Binary:** `/opt/homebrew/bin/gws` (v0.22.5 via Homebrew `googleworkspace-cli`)
**Docs:** https://github.com/googleworkspace/cli
**Operator setup:** `LISA_CONTROL_CHEATSHEET.md` § Google Workspace — Carlos completes OAuth + resource sharing before Lisa can call APIs.
**Mandatory rules (always in effect, kept in `AGENTS.md`):** never exec `gws keep …`; **never** run `gws auth …` (logout/login/revoke/status/reauth/setup — denylist `gws auth*`); live-smoke via `tools/bin/lisa-safe smoke-gws` (or calendar/drive/gmail only); Carlos Tasks via `lisa-carlos-tasks`; email recipients `@linktrend.media` only.

## HARD RULES — how Lisa runs Google work

1. **Default:** `tools/bin/lisa-safe …` for calendar / gmail / drive / docs / help / smokes.
2. **Never invent** gws subcommands. **Never** pipes / `2>&1` / `|` / `$()` / `||` / `&&` on `exec`.
3. **Missing verb in lisa-safe:** stop and report — do **not** improvise bare `gws`.
4. **Cheat sheet (allowed only):** `tools/lisa-safe.md` — verbs: `gmail-triage`, `email-send`, `calendar-list`, `calendar-agenda`, `calendar-insert`, `drive-list`, `drive-create-doc`, `docs-append`, `drive-share`, `drive-json`, `gws-help`, `smoke-gws`.
5. **Carlos Tasks:** `tools/bin/lisa-carlos-tasks` only.

OpenClaw does **not** have a "require lisa-safe" flag. Enforcement is: (a) docs/hard rules, (b) expanded `lisa-safe` allowlist, (c) denylist for auth/keep/invented shapes, (d) hard-deny of opaque shell under `security=full` + `ask=off`. Switching the whole host to `security=allowlist` would also block unrelated ops Lisa needs — not applied.

## Identity model (mandatory)

- Lisa acts as **`lisa@linktrend.media`** — her **permanent** Google Workspace user. **Never** use Carlos's credentials or a service account that impersonates Carlos.
- **GCP OAuth project:** `linkbot-901208` (reuse existing project; SA `lisa-linkbot@...` is for Secret Manager only — not gws).
- **Carlos's calendar:** Carlos **shares** his calendar **to** `lisa@linktrend.media` (Calendar → Share → "Make changes to events"). Lisa uses **her** `gws` auth to read/write the shared calendar via `calendarId` (typically `calusa@linktrend.media` or the ID from `calendarList`).
- **Carlos's Tasks:** Carlos shares specific task lists to `lisa@linktrend.media` (Tasks → list → Share → Edit). Lisa creates/completes tasks on those shared lists only.
- **Carlos's Keep:** Carlos adds `lisa@linktrend.media` as **Edit** collaborator on specific notes. That grants Lisa access in **keep.google.com** (UI), not via `gws` CLI on the current OAuth setup.
- **Keep + `gws`:** Commands exist (`gws keep notes list`, …) but `gws auth login` **never offers** `https://www.googleapis.com/auth/keep` (upstream treats it as enterprise/app-only). Lisa must **not** promise API/CLI Keep edits until a separate admin auth path exists; use Tasks/Drive/chat paste or manual UI for shared notes.
- Lisa's own Drive, Tasks, and mailbox are hers via `gws`. Do not assume access to Carlos's Drive/Gmail unless Carlos explicitly shares.

## How Lisa runs `gws`

- **Sandbox off** — `gws` runs on the Mac mini host via the `exec` tool (same as other CLIs).
- **Output:** JSON by default — parse structured responses; check exit codes (`2` = auth error).
- **Dry-run first** on create/update/delete: add `--dry-run` before mutating calls when uncertain.
- **Default path:** `tools/bin/lisa-safe …` for every high-frequency op (triage, agenda, list, insert, send-via-body-file, drive/docs, help, smoke). See `tools/lisa-safe.md`.
- **Narrow bare escape hatch only** (unpiped): `gws gmail +triage`, `gws calendar calendarList list`, `gws calendar +agenda --today --timezone Asia/Taipei`, tiny one-line `gws gmail +send`, `gws … --help`. Prefer lisa-safe even for these.
- **Carlos Tasks:** `tools/bin/lisa-carlos-tasks` only.
- **Keep — never exec:** Do **not** run `gws keep …` (denylist). Doctrine only (§ Google Keep).
- **Sheets:** wrap ranges in **single quotes** (`'Sheet1!A1:C10'`) — bash history expansion. Prefer `lisa-safe drive-json` with params files over shell.

## Failure modes from logs (read this when a gws call "just fails")

Evidence from Lisa session transcripts (2026-07-14 → 2026-07-21): ~1 in 4 gws-related `exec`s failed. Most were **Lisa improvising bad shell/syntax**, not Google outages.

| What happened                                                                          | Why                                                                                                 | Do this instead                                                                    |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `SYSTEM_RUN_DENIED … denylist screening` on `2>&1`, `\| head`, `\|\| echo`, `$(cat …)` | Opaque shell cannot be proven safe against the auth/keep STOP list → hard-deny (no Allow-once card) | `tools/bin/lisa-safe …` only                                                       |
| `unrecognized subcommand 'send'` / tip `+send`                                         | Wrong helper name                                                                                   | `lisa-safe email-send`                                                             |
| `unrecognized subcommand 'list'` on gmail                                              | Invented — use `+triage`                                                                            | `lisa-safe gmail-triage --max 5`                                                   |
| `Unknown service 'calendarList'` / `gws calendar get` / `gws events get`               | Invented path — service is `calendar`, resource is `calendarList`                                   | `lisa-safe calendar-list` / `calendar-agenda`                                      |
| `unrecognized subcommand '+list'` on tasks                                             | No such helper                                                                                      | Carlos Tasks: `tools/bin/lisa-carlos-tasks …`                                      |
| `401 No credentials` / `invalid_rapt` / reauth                                         | OAuth token needs Carlos in a GUI browser                                                           | Report exact error to Carlos; **never** `gws auth …`                               |
| Keep `403` / denylist `gws keep*`                                                      | Upstream Desktop OAuth cannot grant Keep                                                            | Doctrine only — do not retry                                                       |
| `lisa-safe: resource root 'files' is not allowed`                                      | Old wrapper required `drive.files`                                                                  | Use `--resource drive.files` **or** alias `files`; params-only via `--params-file` |
| Denylist match on `gws gmail list*` / `gws events*` / `gws calendarList*`              | Known-bad improvisations blocked                                                                    | Cheat sheet in `tools/lisa-safe.md`                                                |

**One-shot rule after any denial:** do not retry the same opaque/wrong shape. Switch to the cheat sheet in `tools/lisa-safe.md`. If the verb is missing, stop and report.

## Scopes (OAuth)

Auth is **OAuth user login as Lisa**, not service-account impersonation. Unverified OAuth apps cap at ~25 scopes — Carlos logs in with only needed services (omit `keep`; it is not grantable in the picker):

```bash
# Carlos only (interactive GUI browser) — Lisa must NEVER run this
gws auth login -s calendar,tasks,drive,gmail
```

**Keep scopes:** Not available through this login flow (`gws` v0.22.5 filters `/auth/keep` from OAuth). `gws keep …` returns 403 until a future Workspace-admin/service-account path is configured.

Setup is on the **current HK tenant** now; re-auth after US Workspace migration.

## Auth errors (hard rule — never self-fix)

Google periodically invalidates Lisa's OAuth refresh token with `invalid_rapt` / "reauthentication required" (Workspace Admin session-control policy). This is **expected and recurring**. It needs a one-time interactive `gws auth login` from Carlos in a GUI browser — not from Lisa.

**Never** run any of these (or equivalents that clear/reset credentials):

- `gws auth logout`
- `gws auth login`
- `gws auth revoke`
- Any other gws auth command that clears, resets, or re-establishes credentials

**Why:** On 2026-07-20, Lisa ran `gws auth logout` after an `invalid_rapt` during the morning digest. That deleted `credentials.enc` and `token_cache.json` under `~/.config/gws/`, turning a simple reauth into a full fresh login. Do not repeat that pattern.

**When any gws call fails with auth/token/reauth errors** (exit `2`, `invalid_rapt`, "reauthentication required", etc.) — including during cron, heartbeat, digests, or capability smokes:

1. Stop retrying auth-related commands.
2. Report the **exact** error text to Carlos via Telegram.
3. Wait for Carlos to resolve it manually. Do not attempt to fix credentials yourself.

## Email (Lisa sends as herself)

Lisa may send email **from `lisa@linktrend.media`** using `gws gmail`.

**Default send path:** write the body with the `write` tool into `scratch/`, then:

```bash
tools/bin/lisa-safe email-send --to <recipient@linktrend.media> --subject "<subject>" --body-file scratch/<file>.txt
```

**Unread triage (heartbeat/digest):**

```bash
tools/bin/lisa-safe gmail-triage --max 5
```

**Short one-liner only** (tiny single-line body, no newlines, no command substitution) — prefer `email-send` anyway:

```bash
gws gmail +send --to <recipient@linktrend.media> --subject "<subject>" --body "<body text>"
```

`gws gmail send` (no leading `+`) and `gws gmail list` are **not** valid. **Never** use `--body "$(cat …)"`, heredocs, or huge multiline `--body "…"` on the exec command line. Detail: `tools/lisa-safe.md`.

**Hard boundary — enforce before every send:**

- **Allowed recipients:** addresses ending in **`@linktrend.media`** only.
- **Blocked:** any external domain (gmail.com, clients, vendors, etc.) — **refuse and ask Carlos** even if he asked to send.
- Verify every `To`/`Cc`/`Bcc` address before calling send APIs.

## Checking `--help` usage (any gws subcommand)

```bash
tools/bin/lisa-safe gws-help gmail +send
tools/bin/lisa-safe gws-help drive files create
```

**Do not** run `gws ... --help 2>&1 | head -N`. Never pass `auth`/`keep` tokens to `gws-help`.

## Calendar commands (shared Carlos calendar)

```bash
tools/bin/lisa-safe calendar-list
tools/bin/lisa-safe calendar-agenda --timezone Asia/Taipei
tools/bin/lisa-safe calendar-insert \
  --calendar <CALENDAR_ID> --summary "..." \
  --start "..." --end "..." --dry-run
```

Always confirm which calendar before creating/moving/deleting events. Default agenda merges all visible calendars — say which calendar an event belongs to in reports to Carlos.

## Security & approval

**Ask Carlos first:** sending email outside `@linktrend.media`, deleting events/files/notes, sharing Drive items outward, Admin API.

**Proceed & report:** read calendar/agenda; create/edit events on Carlos's shared calendar when requested; add tasks on shared Tasks lists; send email to `@linktrend.media` recipients when Carlos requests; draft with `--dry-run`. For Carlos's Keep: acknowledge collaborator share for **manual/UI** use only — do not run `gws keep` and expect success.

**Never:** store or echo OAuth tokens; commit credentials; use Carlos's Google login; send email to non-`@linktrend.media` addresses; bypass share ACL with domain-wide service accounts.

## Config paths

- **gws config (encrypted creds):** `~/.config/gws/`
- **Optional env overrides:** `/Users/linktrend/.openclaw-lisa/.env` (see `.env.example`)
- **GCP OAuth project:** `linkbot-901208`

## gws capability verification (mandatory)

When verifying Google Workspace access (Carlos asks, post-setup, startup health, heartbeat):

**Run live exec smokes via lisa-safe only:**

```bash
tools/bin/lisa-safe smoke-gws
# Carlos Tasks (separate OAuth):
tools/bin/lisa-carlos-tasks tasklists list
```

**Do NOT run `gws keep …` or `gws auth …`.** Keep is doctrine-only (§ Google Keep).

Exit `2` or auth error JSON on any smoke → report the exact error to Carlos via Telegram and wait (§ Auth errors). A Keep limitation is **not** a smoke failure.

## Google Keep — status & workarounds (verified 2026-07-10)

**Short answer for Carlos:** Lisa cannot use Keep via `gws` today. UI collaborator sharing works in keep.google.com only. Use **Tasks** (or Drive) for Lisa-automated notes until a Workspace-admin auth path is built.

### What exists

- `keep.googleapis.com` on `linkbot-901208` — **Enabled**
- `gws keep` commands (`notes list/create/get/delete`, permissions) — **Shipped** in gws v0.22.5
- Lisa OAuth token includes `https://www.googleapis.com/auth/keep` — **No** — 21 scopes; calendar, drive, gmail, tasks only
- `gws keep notes list` as `lisa@linktrend.media` — **403** — insufficient authentication scopes
- Keep in `gws auth login` scope picker / OAuth consent screen — **Absent** — even with `-s keep` or `keep` in `-s` list
- Carlos adds Lisa as Keep **Edit** collaborator — **UI only** — Lisa can edit in keep.google.com as herself; does **not** unlock `gws keep`

### Why (not a misconfiguration)

Google Keep API is **Workspace enterprise** — aimed at CASB/admin tooling, not normal user-consent Desktop OAuth. Required scopes: `https://www.googleapis.com/auth/keep` or `keep.readonly`. These scopes cannot be added on the GCP OAuth consent screen ("invalid scope").

Upstream **`gws` intentionally omits Keep from user OAuth** ([googleworkspace/cli#184](https://github.com/googleworkspace/cli/issues/184) — filtered in auth setup; not a bug). Carlos re-running `gws auth login -s calendar,tasks,drive,keep,gmail` **will not** grant Keep (Lisa must never run that command — § Auth errors). `GOOGLE_WORKSPACE_CLI_EXTRA_SCOPES` is not supported.

Official docs: [Keep API overview](https://developers.google.com/workspace/keep/api/guides) — authorization requires **domain-wide delegation** (service account impersonation, or OAuth client ID allowlisted by Workspace super admin). Standard Lisa Desktop OAuth does not qualify.

### What Lisa should use instead (recommended)

- **Carlos action items / his Google Tasks (preferred):** skill `lisa-tasks` + `tools/bin/lisa-carlos-tasks` (separate OAuth `~/.config/gws-carlos-tasks` as `calusa@linktrend.media`). Full manage across all his lists. Never Docs Assign / Chat Space assign as primary. Telegram notify.
- **Lisa-owned shared Task lists (rare):** bare `gws tasks …` as `lisa@` only when the list is hers / explicitly shared to Lisa — not for Carlos digest/heartbeat Yes/No
- **Longer shared notes, drafts** → **Google Drive Doc** — share doc/folder to Lisa; `gws drive …`, `gws docs +write`
- **Quick paste from Carlos** → **Chat / Telegram** — Lisa reads message; no API
- **True Keep sticky notes** → **Manual UI** — Carlos shares note → Lisa opens keep.google.com as `lisa@linktrend.media`

Do **not** promise `gws keep` or automated Keep edits until a separate admin auth path is configured and smoke-tested.

### Future Keep path (Carlos decision — not set up)

Only if Carlos explicitly wants API/CLI Keep and accepts admin overhead:

1. **Workspace Admin** (`calusa@` super admin): [API controls → Domain-wide delegation](https://admin.google.com/ac/owl) — authorize either:
   - **Dedicated service account** (narrow: impersonate **`lisa@linktrend.media` only**, scope `https://www.googleapis.com/auth/keep`), or
   - **Desktop OAuth client ID** from `~/.config/gws/client_secret.json` with `https://www.googleapis.com/auth/keep` (per Google's "OAuth client ID + DWD" enterprise path — may still require `gws auth login --scopes "https://www.googleapis.com/auth/keep"` after allowlist).
2. **gws gap:** Service-account path needs **`--subject`** / impersonation env ([googleworkspace/cli#776](https://github.com/googleworkspace/cli/issues/776)) — not in v0.22.5. Without it, SA + DWD still returns 403 on `gws keep notes list`.
3. **Policy conflict:** Integration plan rejected domain-wide SA impersonation for daily ops (share-not-delegate). Any Keep SA path is a **separate, explicit** exception — not mixed with Lisa's normal OAuth creds.

Track [Google issuetracker 263769283](https://issuetracker.google.com/issues/263769283) and gws releases for OAuth or `--subject` support.
