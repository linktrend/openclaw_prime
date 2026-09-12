# Lisa backup and deployment recreation runbook

This is the PKT-09 source contract for Lisa's backup and restore path. It is a
deployment input and synthetic proof surface; it does not install units, call
Google Secret Manager, upload to Drive, start Lisa, or change a VPS.

## Ownership and privacy boundary

- General source backup is systemd-owned by `linktrend-lisa-backup.timer`; it
  is not an OpenClaw cron job.
- The company archive contains only reproducible source/procedure/receipt and
  non-private database artifacts. The ordinary archive excludes private-health
  state and credentials.
- The dedicated private-health snapshot is encrypted before leaving the host
  with AES-256-GCM. The key is obtained at runtime through a Google Secret
  Manager reference and workload-identity audience; no key value is stored in
  Git or receipts.
- The destination is an opaque binding ID. A Drive path, token, private
  content, and plaintext health value are never accepted by the source
  contract.

## Source proof

`ops/backup/backup.ts` provides the deterministic source archive, online
snapshot encryption, ciphertext-object hash/size verification, disposable
decrypt and quick-check verification, retention decision, and sanitized
receipt. Key and upload operations are injected adapters, so focused tests use
only a throwaway key and in-memory ciphertext.

The receipt separates upload proof from restore proof. A failed upload or
failed restore returns `retain_previous`; only when both are verified may the
candidate be promoted to `current`. The previous verified object remains
available for rollback. Company-archive and private-snapshot destinations are
distinct opaque binding IDs; a Drive path is never a destination. Disposable
restore verification uses an injected temporary directory, disables network
and channel delivery, returns only the sanitized verification, and always
removes that directory.

## Clean-host recreation packet

The deployment templates are:

- `ops/deployment/linktrend-lisa-backup.service`
- `ops/deployment/linktrend-lisa-backup.timer`
- `ops/deployment/linktrend-lisa-private-health-restore.service`

`ops/deployment/deployment.ts` renders and validates the same three units from
Linux host paths, and requires the committed unit files to match that render. The backup service runs as `openclaw-lisa`, uses a host-only
`EnvironmentFile` for references, writes only the backup/receipt roots, and
has `ProtectSystem=strict`, `ProtectHome=true`, `NoNewPrivileges=true`, and a
private umask. The restore verification service denies network access and
writes only a sanitized receipt.

An approved host operator may install the reviewed units, reload systemd,
enable the timer, and run one disposable restore drill. The operator must
verify the receipt before treating the candidate as current. No host action is
part of this source packet.

## Restore and rollback

1. Resolve the key reference through the approved workload-identity adapter.
2. Read the ciphertext object and verify its exact byte count and SHA-256.
3. Decrypt into a disposable restore directory with network and channel
   delivery disabled; run SQLite `quick_check` and any other bounded checks.
4. Write only the sanitized restore receipt. Keep the previous verified object
   until upload and restore checks both pass.
5. If any check fails, stop the backup timer, restore the previous reviewed
   units, preserve the verified backup, and start only the previous backup
   service after an approved rollback window.

The rollback sequence is represented by the injected executor in
`executeSourceRollback`; it performs no host mutation by itself.

## Validation

```sh
node scripts/run-vitest.mjs --config linkbots/lisa/ops/backup/vitest.config.ts linkbots/lisa/ops/backup
node scripts/run-vitest.mjs --config linkbots/lisa/ops/deployment/vitest.config.ts linkbots/lisa/ops/deployment
git diff --check
```

Root Vitest projects do not include `linkbots/`. The local configs above keep the same `run-vitest.mjs` wrapper without changing repository Vitest lanes.

These checks prove source behavior only. They do not prove VPS, stage,
production, Google Workspace, Secret Manager, or Drive operation.
