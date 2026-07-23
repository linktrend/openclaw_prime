# Lisa — Operator Cheat Sheet

**Carlos · Mac mini · `@lisaprime_bot`**

---

## Talk to Lisa

**Telegram (mobile):** `@lisaprime_bot`

**Web UI (full controls):** http://localhost:18790
**Same machine on LAN:** http://10.239.1.142:18790

**Terminal chat:** `openclaw --profile lisa chat`

---

## Start / stop / check

```bash
zsh ~/.openclaw-lisa/start-lisa.sh      # start
zsh ~/.openclaw-lisa/stop-lisa.sh       # stop
zsh ~/.openclaw-lisa/status-lisa.sh     # health + sessions
```

**If start fails (sandbox):**

```bash
cd /Users/linktrend/Projects/openclaw_prime && ./scripts/sandbox-setup.sh
```

**Logs:** `/Users/linktrend/.openclaw-lisa/gateway.log`
**Live tail:** `openclaw --profile lisa logs --follow`

---

## Web UI — three dropdowns

**MODEL** — which brain. Leave on `qwen` unless you need something else (see below).

**REASONING** — leave on **Medium**. Use **Off** or **Low** for quick answers. Use **High** only for hard problems.

**SPEED** — leave on **Standard**. **Fast** costs more.

Changing these only affects **that chat session**.

---

## Which model to pick

**`qwen`** — default. Everyday use, including images/vision.

**`deepseek`** — secondary fallback / heartbeat model.

**`glm` / `kimi`** — manual selection only when you explicitly want them.

**`sonnet`** — only when you explicitly want the premium model.

**`q9`** — local Qwen 9B on the Mac mini; also used by local-coder.

**`nemotron`** — eval experiments only.

---

## Commands you send in chat

Send as a **standalone message** (Lisa confirms the change):

```
/model                    → show current model
/model qwen               → back to default
/model deepseek           → secondary fallback
/model kimi               → manual Kimi
/model glm                → manual GLM

/think:medium             → normal reasoning (default)
/think:off                → fast, minimal thinking
/think:high               → deep thinking

/fast off                 → standard speed (default)
/fast on                  → priority (costs more)

/new                      → fresh conversation
/stop                     → cancel current reply
/status                   → usage + runtime info
/help                     → command list
```

**Aliases:** `qwen` · `deepseek` · `glm` · `kimi` · `sonnet` · `nemotron` · `q9`

---

## Cursor via Lisa (any channel)

**Default:** ask Lisa to use Cursor — she **must** spawn ACP Cursor (`sessions_spawn` runtime acp) and report back. Works from Telegram, Web UI (including dashboard tabs), and iPhone.

**Optional direct mode** — talk to Cursor in-thread (bypasses Lisa orchestration):

```
/acp doctor                        → check Cursor wiring (should say healthy)
/acp spawn cursor --bind here      → start Cursor in this chat
/acp unbind                        → stop routing to Cursor
```

After bind, normal messages in that thread go to Cursor until you unbind or send `/new`.

If Lisa reports a spawn error instead of delegating, paste the error — she should **not** silently fall back to a subagent labeled Cursor.

If spawn still fails, send `/new` once (clears an old session), then try again.

---

## How to ask Lisa

**Short answer (default):** just ask. Or say `quick`, `short answer`, `just tell me`.

**Full strategic breakdown:** say `plan this`, `strategic`, `mode B`, `recommend`, `tradeoffs`, or `Lisa, plan this`.

**Stay strategic:** `stay strategic`
**Back to short answers:** happens automatically after one strategic reply unless you ask again.

---

## When Lisa must ask you first

- Posting publicly, deleting data, money, formal legal filings
- Email to **non-`@linktrend.media`** addresses (she can send within `@linktrend.media` when you ask)
- Anything destructive or leaving the machine
- When she's unsure — she should ask, not guess

---

## Quick fixes

**No reply** → `status-lisa.sh`, then stop + start.

**Wrong model** → `/model qwen` or pick in Web UI.

**Too slow / too much thinking** → `/think:off` or `/think:medium`.

**Messy conversation** → `/new`.

**Photo won't analyze** → retry on `qwen` with the image attached.

**Telegram dead** → `openclaw --profile lisa channels status --probe`.

**Config broke** → `openclaw --profile lisa config validate` (avoid blind `doctor --fix`).

---

## Google Workspace (`gws`) — setup NOW (HK tenant)

Lisa uses the **`gws`** CLI as **`lisa@linktrend.media`** (permanent identity). She does **not** log in as you. You **share** calendar, Tasks, and Keep **to** her account.

**Already done on Mac mini:** `gws` v0.22.5 at `/opt/homebrew/bin/gws`.

### Decision: **Path A chosen** (2026-07-10)

Use **`info@linktrend.media`** as **GCP project Owner** on **`linkbot-901208`** for API enable + OAuth client admin. Workspace sharing stays **`calusa@linktrend.media`**. Lisa **`gws`** OAuth is always **`lisa@linktrend.media`** (never Carlos creds or `lisa-linkbot` SA).

**Path B (not in use):** Grant `calusa@linktrend.media` **Project Editor** on `linkbot-901208` and run gcloud as `calusa@` — fallback only if `info@` is unavailable.

### Automation status (2026-07-10 — Path A end-to-end agent run, Carlos authorized)

**Console:** Project **LiNKaios** (ID **`linkbot-901208`**, #71619887675). **`info@linktrend.media`** — **Owner**, active gcloud account (token OK).

| Item                                                          | Status                                                                                                                                                                |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gcloud auth login info@linktrend.media`                      | **Done** — reused valid creds; no re-login required                                                                                                                   |
| APIs: Calendar, Tasks, Drive, Gmail, Keep (+ Sheets, Pub/Sub) | **Enabled** (`gcloud services enable` + verified `gcloud services list`)                                                                                              |
| `gws auth setup --project linkbot-901208`                     | **Partial** — API step OK; step 5 **validationError** (upstream gws removed programmatic Desktop client create; Console only)                                         |
| OAuth consent brand                                           | **Exists** — `Lisa - LiNKbot`, support `info@linktrend.media` (IAP brands API)                                                                                        |
| `~/.config/gws/client_secret.json`                            | **Done** — Desktop `installed` client at `~/.config/gws/client_secret.json` (`gws auth status` → `client_config_exists: true`)                                        |
| OAuth test user `lisa@linktrend.media`                        | **Done** (consent test user; verified Lisa OAuth 2026-07-10)                                                                                                          |
| `gws auth login` (Lisa)                                       | **Done** — `auth_method: oauth2`, `lisa@linktrend.media`, encrypted creds at `~/.config/gws/credentials.enc`                                                          |
| Smoke tests (§6)                                              | **Partial** — calendar, tasks, gmail OK; Keep **FAIL** (expected) — `gws` user OAuth cannot grant Keep scope; use UI collaborator share or non-gws workaround         |
| Browser automation                                            | Chrome opened to [Credentials](https://console.cloud.google.com/apis/credentials?project=linkbot-901208); **stopped at `info@` password** (no stored Console session) |

**Lisa OAuth:** Complete (2026-07-10). **IAM fix applied (2026-07-10):** `roles/serviceusage.serviceUsageConsumer` for `user:lisa@linktrend.media` on `linkbot-901208`. **Still open:** Carlos sharing §3–5. **Keep via `gws`:** blocked by OAuth design (not a failed re-login).

### Path A — numbered steps (`info@linktrend.media`)

1. Run the **Terminal block** below (`gcloud auth login` opens browser once).
2. [Credentials](https://console.cloud.google.com/apis/credentials?project=linkbot-901208) — **OAuth client ID** → **Desktop app** → download JSON → `~/.config/gws/client_secret.json`.
3. [OAuth consent](https://console.cloud.google.com/apis/credentials/consent?project=linkbot-901208) — **Test users** → **`lisa@linktrend.media`** (app name e.g. **Lisa gws (linkbot-901208)**).
4. Reply **`info done`** — then §2 Lisa OAuth and §3–5 sharing.

**Carlos — copy-paste Terminal block (Path A):**

```bash
gcloud auth login info@linktrend.media
gcloud config set account info@linktrend.media
gcloud config set project linkbot-901208
gcloud services enable calendar-json.googleapis.com tasks.googleapis.com drive.googleapis.com gmail.googleapis.com keep.googleapis.com
gcloud services list --enabled --project=linkbot-901208 --filter="config.name:(calendar-json OR tasks OR drive OR gmail OR keep)" --format="table(config.name)"
ls -la ~/.config/gws/client_secret.json 2>/dev/null || echo "NEXT: Console Desktop OAuth → ~/.config/gws/client_secret.json"
```

**Then in browser (signed in as `info@linktrend.media`):** [Credentials](https://console.cloud.google.com/apis/credentials?project=linkbot-901208) + [OAuth consent](https://console.cloud.google.com/apis/credentials/consent?project=linkbot-901208) (test user **`lisa@linktrend.media`**).

**Desktop OAuth client:** Cannot be created via gcloud/`gws auth setup` alone — Console Desktop client required (or `GOOGLE_WORKSPACE_CLI_CLIENT_ID` / `GOOGLE_WORKSPACE_CLI_CLIENT_SECRET`).

**Lisa OAuth (Terminal-first, as `lisa@linktrend.media`):**

```bash
gws auth login -s calendar,tasks,drive,gmail
gws auth status   # must show oauth2 + stored credentials
```

**Carlos — sharing (your account, not Lisa):** Complete sections **3–5** below (calendar, Tasks, Keep).

**Decisions locked:** GCP project `linkbot-901208` · gmail enabled · `@linktrend.media` send-only · read/write on shared Carlos resources · auth on HK tenant now (re-auth after US migration).

### 1. OAuth consent — add Lisa as test user

**Programmatic attempt (2026-07-10, `info@linktrend.media`):** Brand **Lisa - LiNKbot** is visible via `gcloud alpha iap oauth-brands list` and `GET https://iap.googleapis.com/v1/projects/71619887675/brands/71619887675`, but the response has **no `testUsers` field**. `PATCH` with `updateMask=testUsers` returns **404**. IAP OAuth Admin APIs are **deprecated** and do not manage OAuth consent screen test users. **No working public API or `gcloud` command** was found — use Console steps below.

**Desktop OAuth client:** Already installed at `~/.config/gws/client_secret.json` (Carlos download → copy). Verify: `gws auth status` shows `client_config_exists: true`.

#### Console — click-by-click (`info@linktrend.media`)

1. Open **Chrome** (or Safari).
2. In the address bar, paste and go: [OAuth consent screen for linkbot-901208](https://console.cloud.google.com/apis/credentials/consent?project=linkbot-901208).
3. If Google shows **Sign in**, sign in as **`info@linktrend.media`** (project Owner). Complete password and 2FA if prompted.
4. If the top bar shows a **different project**, click the project picker (next to “Google Cloud”) → search **`linkbot-901208`** or **`LiNKaios`** → click that project to select it.
5. Wait for the page to load. You should see **Google Auth Platform** with left nav, or classic **APIs & Services → OAuth consent screen**.
6. **New Google Auth Platform UI:** In the left sidebar, click **Audience** (or **OAuth consent screen**). Confirm **User type** is **External** (Testing / In production with test users is fine while app is unverified).
7. Scroll to the **Test users** section (under Audience / OAuth consent screen).
8. Click **+ Add users** (or **ADD USERS** / **Add users**).
9. In the email field, type exactly: **`lisa@linktrend.media`** (no spaces). Do not add `calusa@` here unless you also want Carlos to pass the consent gate as a test user.
10. Click **Save** on the dialog. If the page shows a bottom **Save** or **Save and continue**, click it so changes persist.
11. Confirm **`lisa@linktrend.media`** appears in the **Test users** list.
12. Optional check: open [Credentials](https://console.cloud.google.com/apis/credentials?project=linkbot-901208) and confirm a **Desktop** OAuth 2.0 Client ID exists (matches client in `~/.config/gws/client_secret.json`).

Reply **`info done`** after step 11 so Lisa can run §2.

Enable APIs if `gws` returns `accessNotConfigured`: Calendar, Gmail, Drive, Tasks, Keep (follow enable links in error output).

### GCP IAM — `403` / Service Usage Consumer (tasks, gmail)

If `gws tasks` or `gws gmail` returns **403** with **Service Usage Consumer** (or `serviceusage.services.use`), the **Lisa Google user** (`lisa@linktrend.media`) needs permission to **use** enabled APIs on project **`linkbot-901208`**. Enabling APIs as `info@` is not enough.

**Preferred fix (Terminal as `info@linktrend.media`, project `linkbot-901208`):**

```bash
gcloud config set account info@linktrend.media
gcloud config set project linkbot-901208
gcloud projects add-iam-policy-binding linkbot-901208 \
  --member="user:lisa@linktrend.media" \
  --role="roles/serviceusage.serviceUsageConsumer"
```

Wait **~30 seconds** for IAM propagation, then re-run §6 smokes for tasks/gmail.

**Console fallback (if gcloud unavailable):** [IAM](https://console.cloud.google.com/iam-admin/iam?project=linkbot-901208) → **Grant access** → principal **`lisa@linktrend.media`** → role **Service Usage Consumer** → Save.

Do **not** grant broad **Editor** unless minimal role still fails after propagation.

### 2. Log in as Lisa (Terminal-first — one-time)

**Status: Done (2026-07-10)** for calendar/tasks/drive/gmail OAuth. Re-run if tokens expire. Keep is **not** obtainable via `gws auth login` on this setup.

On the Mac mini, start in **Terminal** (not the browser first):

```bash
gws auth login -s calendar,tasks,drive,gmail
```

What happens: `gws` prints a sign-in URL and usually opens the browser for you. Sign in as **`lisa@linktrend.media`**, review the **scope picker** (limited to calendar, tasks, drive, gmail — **not** the full `recommended` preset; **Keep is not offered** in picker/consent), click **Allow**, then return to Terminal until the command finishes.

If consent shows "unverified app" → **Advanced** → **Continue**.

**Verify auth (credentials must exist, method not `none`):**

```bash
gws auth status
```

Expect `auth_method: oauth2`, `encrypted_credentials_exists: true`, `user: lisa@linktrend.media`. Optional API check after GCP IAM fix: `gws calendar calendarList list --params '{"maxResults": 5}'`.

**Keep / `gws` limitation (verified 2026-07-10, Carlos re-login):** The CLI **does** ship `gws keep` (notes list/create/…), and `keep.googleapis.com` is **enabled** on `linkbot-901208`. Lisa’s OAuth token still has **no** Keep scope (`gws auth status` → 21 scopes; no `https://www.googleapis.com/auth/keep`). `gws keep notes list` → **403 insufficient authentication scopes**.

**Why Keep is missing from the browser:** `gws auth login -s …,keep,…` does **not** surface Keep in the scope picker or Google consent screen. Upstream `gws` v0.22.5 classifies `https://www.googleapis.com/auth/keep` as **app-only** (enterprise Keep API; not grantable via the normal Desktop user OAuth picker). Re-running login with `keep` in `-s` cannot fix this — Carlos’s screenshots (46 scopes, no Keep; consent shows Gmail/Drive/Calendar/Tasks only) match that behavior.

**What works today:** Calendar, Tasks, Drive, Gmail via Lisa OAuth. **Carlos → Lisa sharing** (§3–5) still matters for calendar/tasks; for **Keep**, collaborator share lets Lisa edit notes in **keep.google.com as Lisa**, not via `gws`.

**Lisa automation for Keep:** Not available on the current OAuth path. Do not ask Carlos to “toggle Keep in the picker” — **Keep will not appear**; that is expected.

#### Keep — what works today vs not

| Approach                                   | Works?      | Notes                                                                          |
| ------------------------------------------ | ----------- | ------------------------------------------------------------------------------ |
| `gws keep notes list` as Lisa              | **No**      | 403 — token has no Keep scope                                                  |
| Re-login with `keep` in `-s`               | **No**      | gws v0.22.5 excludes Keep from user OAuth; Google consent has no Keep checkbox |
| Enable API in GCP                          | **Done**    | `keep.googleapis.com` enabled — not the blocker                                |
| Share Keep note → Lisa (Edit collaborator) | **UI only** | Lisa edits at keep.google.com as herself — **not** via Lisa/`gws` automation   |
| **Google Tasks** shared to Lisa            | **Yes**     | Best automation substitute — `gws tasks …`                                     |
| **Drive Doc** shared to Lisa               | **Yes**     | Longer notes — `gws drive` / `gws docs +write`                                 |
| Paste note in Telegram/chat                | **Yes**     | Lisa reads and acts                                                            |

**Recommended for Carlos/Lisa now:** Create a shared Tasks list (e.g. “Lisa ops”) or a shared Drive doc for anything Lisa must read/write programmatically. Keep sticky notes stay human/UI unless you pursue the admin path below.

#### Keep — future path (optional, Carlos super-admin action)

Only if you explicitly want API/CLI Keep:

1. [admin.google.com](https://admin.google.com) → **Security → API controls → Domain-wide delegation → Add new**
2. Client ID: either a **new dedicated service account** (Keep-only, impersonate `lisa@linktrend.media`) **or** the **Desktop OAuth client ID** from `~/.config/gws/client_secret.json`
3. OAuth scopes: `https://www.googleapis.com/auth/keep` (or `keep.readonly`)
4. **Blockers today:** `gws` v0.22.5 has no `--subject` for SA impersonation ([#776](https://github.com/googleworkspace/cli/issues/776)); OAuth-client DWD path is untested on this Mac mini. Treat as a future spike, not “one more re-login.”

Refs: [Keep API overview](https://developers.google.com/workspace/keep/api/guides) · [gws Keep scope discussion](https://github.com/googleworkspace/cli/issues/184)

### 3. Share your calendar with Lisa

Google Calendar (logged in as **you**, `calusa@linktrend.media`) → Settings → your primary calendar → **Share with specific people** → add `lisa@linktrend.media` → **Make changes to events**.

### 4. Share Tasks with Lisa

Google Tasks (tasks.google.com, logged in as **you**):

1. Open the task list Lisa should manage (or create one, e.g. "Lisa ops").
2. Click the list name → **Share** (or ⋮ → Share list).
3. Add `lisa@linktrend.media` → permission **Edit**.

Repeat for each list she should touch.

### 5. Share Keep notes with Lisa (UI only — not `gws`)

Google Keep (keep.google.com, logged in as **you**):

1. Open the note (or create one for Lisa collaboration).
2. **Collaborator** icon → add `lisa@linktrend.media` → **Edit** access.

Repeat per note she should edit in the **Keep web/app UI**. This does **not** enable `gws keep` — Lisa cannot automate those notes from the Mac mini until a Workspace-admin Keep auth path exists (see §2 Keep tables). For automation, prefer §4 Tasks or a shared Drive doc.

### 6. Smoke tests (after steps 1–5)

```bash
# Calendar — should include your shared calendar
gws calendar +agenda --today --timezone Asia/Taipei

# Tasks — should list shared task lists
gws tasks tasklists list

# Keep — requires Keep OAuth scope (not available via gws user login today); expect 403
# gws keep notes list

# Gmail — Lisa's mailbox (send test only to @linktrend.media)
gws gmail users messages list --params '{"userId": "me", "maxResults": 3}'
```

Tell Lisa when setup is done. She will refuse to email anyone outside `@linktrend.media` until you lift that boundary.

### Optional: headless creds later

```bash
cp /Users/linktrend/.openclaw-lisa/.env.example /Users/linktrend/.openclaw-lisa/.env
# gws auth export → set GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE in .env
```

Restart Lisa after `.env` changes: `stop-lisa.sh` then `start-lisa.sh`.

**Full integration plan:** `Openclaw Lisa Prime/audit/05-gws-integration-plan.md`

---

## Paths (if you need them)

**Edit Lisa's personality:** `Openclaw Lisa Prime/Personality files/`
**Live workspace:** `/Users/linktrend/.openclaw-lisa/workspace`
**Live config:** `/Users/linktrend/.openclaw-lisa/openclaw.json`
**Secrets:** `/Users/linktrend/.openclaw-lisa/.env` — never copy elsewhere
**gws config:** `~/.config/gws/` (OAuth tokens — not in repo)
