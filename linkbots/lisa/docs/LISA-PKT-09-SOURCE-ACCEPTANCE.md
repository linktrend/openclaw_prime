# PKT-09 source acceptance and pre-VPS rehearsal

This document records the repository-owned PKT-09 source package. It is not a
VPS deployment receipt and contains no private state, credential value, backup
payload, or live-provider result.

## Bound source

- Repository: `linktrend/openclaw_prime`
- Protected base: `origin/development`
- Base commit: `8aba2013cffade07ce55f199bca1c5a6a24b46e4`
- Base tree: `e6f99b43529b1c34ba3b1090fa9ce19fb065a897`
- Packet/Issue: `PKT-09` / `ISS-09` / GitHub `#292`
- Owned paths: `linkbots/lisa/ops/backup`, `linkbots/lisa/ops/deployment`, and `linkbots/lisa/docs`
- PKT-01 dependency: backup remains in `excludedCronFamilies` and is systemd-scheduled at `05:30` Asia/Taipei. This packet does not mutate PKT-01 job files or `src/state`.

## Repository-owned proof

The source package provides deterministic company-archive enumeration with
private-health and credential exclusions, online SQLite snapshot/quick-check
hooks, AES-256-GCM encryption using only a runtime Secret Manager reference,
ciphertext hash/size verification, disposable decrypt verification, retention
of the previous verified object, Linux systemd service/timer/restore templates,
clean-host path and unit hardening validation, and an injected rollback
sequence.

The offline composition rehearsal is:

```sh
node --experimental-strip-types --test linkbots/lisa/ops/deployment/pre-vps-rehearsal.test.mjs
```

It uses synthetic source and private-health bytes, injected key/upload
adapters, a network-disabled restore verification contract, and an in-memory
rollback executor. It does not open a Lisa profile, access a VPS, call Google,
upload an object, install systemd units, start a service, or send a channel
message. The exact result is recorded in
`linkbots/lisa/ops/receipts/pkt-09-source-acceptance.receipt.json`.

## External holds

The following cannot be proven by this source-only checkpoint and remain
explicit holds:

- clean-host installation and service/timer readback on the target Linux host;
- live encrypted backup upload and object verification;
- disposable restore against the real protected backup;
- live rollback verification;
- VPS deployment, production canary, and Principal acceptance.

The required operator sequence and inverse rollback are documented in
`LISA-BACKUP-DEPLOYMENT-RUNBOOK.md` and `LISA-DIRECT-MIGRATION.md`. No schedule,
service, VPS, production, upstream, provider, credential, or private-state
mutation occurred for this source package.

## Repository-owned proof

The source package provides deterministic company-archive enumeration with
private-health and credential exclusions, a restorable source-plus-procedure
inventory, distinct opaque company/private destination bindings, online SQLite
snapshot/quick-check hooks, AES-256-GCM encryption using only a runtime Secret
Manager reference, ciphertext hash/size verification, disposable decrypt
verification with injected directory cleanup, retention of the previous
verified object, Linux systemd service/timer/restore templates that must match
the committed unit files, clean-host path and unit hardening validation, and an
injected rollback sequence.

Root Vitest projects do not include `linkbots/`. Focused proof uses local
configs:

```sh
node scripts/run-vitest.mjs --config linkbots/lisa/ops/backup/vitest.config.ts linkbots/lisa/ops/backup
node scripts/run-vitest.mjs --config linkbots/lisa/ops/deployment/vitest.config.ts linkbots/lisa/ops/deployment
git diff --check
```

The offline composition rehearsal is:

```sh
node --experimental-strip-types --test linkbots/lisa/ops/deployment/pre-vps-rehearsal.test.mjs
```

It uses synthetic source and private-health bytes, injected key/upload
adapters, a network-disabled restore verification contract, and an in-memory
rollback executor. It does not open a Lisa profile, access a VPS, call Google,
upload an object, install systemd units, start a service, or send a channel
message. The exact result is recorded in
`linkbots/lisa/ops/receipts/pkt-09-source-acceptance.receipt.json`.

## External holds

The following cannot be proven by this source-only checkpoint and remain
explicit holds:

- clean-host installation and service/timer readback on the target Linux host;
- live encrypted backup upload and object verification;
- disposable restore against the real protected backup;
- live rollback verification;
- VPS deployment, production canary, and Principal acceptance.

The required operator sequence and inverse rollback are documented in
`LISA-BACKUP-DEPLOYMENT-RUNBOOK.md` and `LISA-DIRECT-MIGRATION.md`. No schedule,
service, VPS, production, upstream, provider, credential, or private-state
mutation occurred for this source package.
