# Lisa jobs source operations

The ten logical job families are defined in `ops/jobs/lisa-job-catalogue.ts`. The
deployable desired state is defined separately in
`ops/jobs/lisa-job-desired-state.ts`: it contains exactly 19 stable operational
declaration keys and one separately registered Memory Dreaming dependency.
Embedded checkpoints are represented by their owning declaration, not by
duplicate timers. Family inventory still names Librarian, Memory Dreaming, and
backup so they cannot be rediscovered as missing Lisa jobs, but those three are
not OpenClaw cron declarations.

Librarian is provider-owned and Memory Dreaming is registered as a separate
OpenClaw item. General backup is systemd-owned. Neither is an OpenClaw cron
declaration. The source manifest is `ops/lisa-profile-manifest.json` and keeps
source schedules disabled until a separate apply authority is approved.

Production activation is recorded separately in the live cron store. The 19
approved operational declarations execute as `lisa-cron` but must be owned by
`main`, so Lisa can list and manage them. Each declaration carries its stable
instance identity, preparation trigger, visible deadline, privacy class,
delivery intent, opaque binding references, exact skill/schema reference,
dependencies, bounded retry policy, idempotency key, and receipt requirements.
Executive Digest uses cron-owned Telegram announce plus a separate email
receipt. Other visible recurring messages use a five-minute preparation lead;
digest preparation remains 06:45 and 16:45.

`diffLisaJobDesiredState` compares a read-only live-format export against the
source declarations. It returns missing, unexpected, and drifted keys. Live
rows that are enabled while source remains disabled are listed as
`applyAuthorizationHold` and are not treated as schedule drift. The helper has
no apply or mutation path.

## Ownership repair

Run `ops/jobs/lisa-live-job-ownership.mjs <openclaw.sqlite>` first for a read-only inspection. During a maintenance stop, add `--apply` to:

- create an exclusive database backup;
- require all 19 approved declarations to be present, enabled, and assigned to `lisa-cron`;
- set their owner to `main` and owning session to `agent:main:main`;
- delete the exact retired job names.

The command fails closed if the approved declaration set is incomplete, disabled, or assigned to another execution agent. It never changes schedules, payloads, delivery targets, run history, or job identifiers.

## Evidence boundary

- Source evidence consists of desired-state validation, catalogue validation, renderer coverage, deterministic package verification, and ownership-migration coverage.
- Production evidence additionally requires the database backup, migrated job count, removed retired-job check, service health, and a real Lisa main-agent cron listing.
- The profile bundle and immutable live-comparison receipt may be refreshed only after the exact stable files have been deployed and hash-compared with VPS Lisa.
- Provider release and opaque credential bindings remain independently governed; this repair does not grant provider authority or expose credentials.
