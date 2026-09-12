# VPS Lisa Google Workspace source contract

This directory is the source-only Linux portability package for Lisa's two
Google identities. It contains no OAuth material, account identifiers, live
profile data, service configuration, or live receipts. Account and Calendar
inputs are opaque binding references; private runtime configuration resolves
those references to actual Google resources outside this repository.

## Upstream CLI pin

The package pins `googleworkspace/cli` `v0.22.5` at release commit
`705fb0ecac6f4249679958f6325b809b63fdde17`. The approved GNU/Linux binaries
and official SHA-256 values are recorded in
[`gws-linux-pin.json`](gws-linux-pin.json). The installer downloads the archive
and checksum separately, compares the published checksum to the pin, computes
the local digest, and requires GitHub artifact-attestation verification by
default.

The maintained project recommends prebuilt GitHub release binaries and states
that `npm` is an alternative. This package uses the prebuilt binary so the
VPS install has an immutable release and digest rather than a moving package
resolution. The installer never uses a pipe-to-shell command.

Official evidence:

- [CLI installation and authentication README](https://github.com/googleworkspace/cli/blob/705fb0ecac6f4249679958f6325b809b63fdde17/README.md)
- [v0.22.5 release and assets](https://github.com/googleworkspace/cli/releases/tag/v0.22.5)
- [v0.22.5 command source](https://github.com/googleworkspace/cli/tree/705fb0ecac6f4249679958f6325b809b63fdde17/crates/google-workspace-cli/src)

Run the installer only as a later human-controlled VPS operation:

```text
GWS_INSTALL_DIR=/usr/local/bin ./gws-linux-install.sh x86_64-unknown-linux-gnu
```

The operator must retain the sanitized output, archive SHA-256, release
commit, and attestation result. `GWS_REQUIRE_ATTESTATION=0` is an exception
that requires a separate written reason and independent provenance evidence.

## Configuration and identity boundary

The wrappers require an absolute, private root supplied by the service
configuration:

```text
LISA_GOOGLE_WORKSPACE_CONFIG_ROOT=/var/lib/openclaw/lisa/.openclaw-lisa/google-workspace
LISA_GOOGLE_WORKSPACE_WORK_DIR=/var/lib/openclaw/lisa/.openclaw-lisa/workspace
# Keep these two directories outside the OpenClaw profile tree. The profile
# contains .env files, and gws refuses to run below a dotenv ancestor.
LISA_GOOGLE_WORKSPACE_EXEC_CWD=/var/lib/openclaw/lisa/gws-exec
LISA_GOOGLE_WORKSPACE_HOME_DIR=/var/lib/openclaw/lisa/gws-home
LISA_GWS_NODE_BIN=/usr/bin/node
```

They derive these Linux paths:

```text
<root>/lisa          -> Lisa Workspace identity
<root>/carlos-tasks  -> separate Carlos Tasks identity
```

Both identity directories, the root, and the work directory must be mode `0700`,
owned by the Lisa service account. The controlled execution directory and HOME
must be separate service-account-owned, non-symlink directories at mode `0555`.
The wrappers execute `gws` from that controlled cwd with `env -i`, a fixed
`HOME`, selected `GOOGLE_WORKSPACE_CLI_CONFIG_DIR`, and
`GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND=file`. They reject inherited token, ADC,
client, project, keyring, and configuration variables and reject `.env` files
in the controlled cwd ancestry. Optional operational variables are limited to
the documented `LISA_GWS_HTTPS_PROXY`, `LISA_GWS_NO_PROXY`, and
`LISA_GWS_CA_FILE` inputs.

The host-adapter/profile policy must invoke only the two absolute wrapper paths
with this fixed environment map; it must not expose `env`, arbitrary environment
prefixes, or caller-controlled root/binary/Node overrides. The trusted runtime
PATH is exactly `/usr/local/bin:/usr/bin:/bin`: the installer target is
`/usr/local/bin/gws`, while preflight utilities resolve from system paths. A
later live gate must verify `/usr/local/bin` ownership and non-writability for
the Lisa service account before enabling the adapter.

Steady state uses upstream `credentials.enc` plus `.encryption_key` inside each
selected identity directory; both files must be private regular files. The
upstream `token_cache.json` and `sa_token_cache.json` names are managed through
its `EncryptedTokenStorage`; when present, they must be private regular files
and are not assumed plaintext by filename. A fresh authorized-user login does
not require either cache. Plaintext `credentials.json` and an explicit
credentials-file override are rejected at execution time.

The two entrypoints are deliberately finite:

- `tools/bin/lisa-safe`: Gmail triage/search/message read and internal-only send,
  Calendar list/agenda/event list/get/patch/delete/insert, Drive list/content
  read/document create/internal share, Docs content read/append, Sheets values
  read/append/create, Slides presentation read/create, and a read-only smoke.
  Calendar mutation requires an explicit opaque calendar binding reference and
  event ID; recurring-
  series changes must target the recurring master event ID.
- `tools/bin/lisa-carlos-tasks`: only the approved Tasks list/insert/patch/
  delete operations under the separate `carlos-tasks` configuration directory.

Calendar operations accept only opaque `opaque_*` binding references. The
source binding receipt names Lisa's account, work calendar, Routine calendar,
and shared personal-events calendar without recording their private resource
IDs. Routine is available for explicit operations but excluded from executive
digests; the exact digest-included allowlist is bound by its committed SHA-256
receipt.

There is no generic shell passthrough, `auth` command, Keep command, arbitrary
service selector, external recipient, external Drive share, raw JSON method
surface, Sheets batch update, or Slides batch update. Sheets ranges and values
are bounded; Sheets and Slides creation accept only a validated title. Mutating
wrapper calls accept `--dry-run`, but a dry run is not proof of a live write.

The Workspace skill release and gws interface catalogue binding are recorded in
[`receipts/qualified-skills.receipt.json`](receipts/qualified-skills.receipt.json).
OpenClaw records the provider release/tree, gws catalogue digest, and per-skill
digests, then invokes only the finite wrapper verbs; it does not copy or execute
reusable skill bodies from this repository. Consumption is inert: wrappers
compare a private runtime receipt to the committed source contract through
`qualification-receipt.mjs` and otherwise stay fail-closed. The receipt currently
has `qualification-required` / `unavailable` status because an exact qualified
release and provider receipt are not present; the execution gate cannot
activate a guessed skill release or a flags-only copy. Qualification remains a
separate human-controlled gate. This packet does not scan or audit LiNKskills.

Every wrapper route is blocked unless that runtime receipt is an exact
qualified release receipt that passes `qualification-receipt.mjs`; an
unavailable, source-only, or guessed qualification never invokes `gws`.
The runtime receipt is private metadata at the configured Workspace root
(`qualified-skills.receipt.json`); wrappers compare its provider and catalogue
digests to the committed source receipt and require every required skill ID.

`drive-read` is intentionally distinct from Google-native `docs-read`: it reads
binary Drive media only when the caller supplies a simple `--output-file` name.
The wrapper maps that name to a new file under `<work-root>/downloads`, rejects
traversal, symlinks, and any existing destination, passes the absolute path to
upstream `gws --output`, and runs with `umask 077`. The controlled cwd is never
used for downloads.

`receipts/identity-scope.receipt.json` records exact requested OAuth scope URLs,
not dynamic service groups. A later human-controlled sanitized auth-status
receipt must verify the actual granted scopes and keep account identifiers out
of source evidence.

The wrappers use the maintained v0.22.5 helper names and flags. In particular,
Docs append is `gws docs +write --document ... --text ...`; v0.22.5 does not
provide the older-looking `--json-file` flag. Request bodies are built in the
wrapper and passed as one argument.

## Human-controlled authentication gate

This source package does not run OAuth. A human owner must complete the
following later, outside this worktree and without placing values in Git,
logs, prompts, or receipts:

1. Create the root and both identity directories as the Lisa service account,
   with the modes above.
2. Install the pinned binary and independently verify its SHA-256 and release
   attestation.
3. From the controlled Linux execution directory and controlled HOME, run the
   upstream `gws auth login --scopes <comma-separated exact capability scope
URLs from the receipt>` for Lisa Workspace. Under the file keyring backend,
   this human-controlled browser flow writes `credentials.enc` directly. Do not
   use a nonexistent credential-import command and do not use exported plaintext
   credentials for steady-state execution.
4. Repeat the same human-controlled encrypted login for the separate Carlos
   Tasks identity under `<root>/carlos-tasks`; never reuse or overwrite
   `<root>/lisa`.
5. `gws auth login` may read `client_secret.json` as its OAuth client input.
   Keep it private only for that human login, then securely quarantine/remove it
   immediately after successful encrypted-login and recovery proof. The wrapper
   rejects it in steady state. If browser callback mechanics prevent this VPS
   flow, the authorization state is HOLD pending a separately approved method;
   do not substitute a plaintext export.
6. Record only account-independent metadata in a sanitized receipt. The
   identity/scope contract is represented by
   [`receipts/identity-scope.receipt.json`](receipts/identity-scope.receipt.json).

The exact scope grant, account ownership, shared Calendar/Drive resources, and
Tasks list access require human confirmation. The source receipt intentionally
does not claim that OAuth or any Google call has passed.

## Source-only validation

The canonical focused test is offline and replaces `gws` with a synthetic
executable; it
does not read credentials, open OAuth, contact Google, or mutate a VPS:

```text
node scripts/run-vitest.mjs linkbots/lisa/ops/google-workspace/google-workspace.test.ts
```

When repository dependencies are unavailable, the equivalent dependency-free
source fallback is `node --test` on the same file. Also run `bash -n` over both
wrappers and the installer. A passing source test
proves argument routing, identity separation, private-path checks, internal
recipient rejection, and prohibited-command rejection only. It does not prove
Google access, account ownership, live writes, restart survival, or cleanup.

The checked-in real-CLI receipt records source-only acceptance of all finite
helper/raw command help paths on the checksum-verified Linux binary. The
disposable container used a trusted CA bundle for public Discovery-schema
retrieval while TLS verification remained enabled; it mounted no credentials or
identity configuration. This remains distinct from later live Google tests.

## Live acceptance remains separate

WP-04 owns combined integration, promotion, deployment, and live verification.
The remaining live proof must use dedicated test resources and sanitized
receipts:

- Gmail read/search and one approved internal test send;
- Calendar list/read and one dedicated test event;
- Drive/Docs read plus one dedicated create/update artifact;
- Sheets values read plus one bounded append and Slides metadata read plus one
  bounded presentation create;
- separate Carlos Tasks list and approved write proof;
- returned identifiers, account ownership, idempotency, cleanup, and restart
  survival; and
- negative probes for external recipients/shares, auth mutation, unsupported
  services, generic requests, and secret reads.
