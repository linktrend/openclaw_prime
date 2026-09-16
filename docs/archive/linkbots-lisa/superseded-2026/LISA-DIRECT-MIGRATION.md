# Lisa direct migration runbook

This packet operates on the one existing Lisa profile. It never creates a
second profile, identity, cron store, workspace, or config generator.

## Scope

- Source profile: `$HOME/.openclaw-lisa`
- Profile identity: `lisa`
- Repository executable: the exact reviewed OpenClaw checkout selected by the operator
- Protected data: the whole profile tree, including workspace, personality,
  memory, knowledge, sessions, SQLite stores, cron state, channels, and auth
  relationships
- Transfer archives: do not create one unless an already-approved local
  encryption command is supplied by the operator

The snapshot command creates a local rollback directory, not a transfer
archive. It uses Node's `sqlite.backup()` API for every non-empty SQLite
database. Empty `*.lock.sqlite` files are recorded as disposable runtime lock
artifacts and copied only as zero-byte files; they contain no database pages.

## Protected rollback backup

Run before changing the live service, wrapper, profile permissions, or
repository executable. Keep the printed path private and local.

```bash
PROFILE="$HOME/.openclaw-lisa"
BACKUP_ROOT="$(mktemp -d "$HOME/.openclaw-lisa-direct-rollback.XXXXXX")"
chmod 700 "$BACKUP_ROOT"

# Write only IDs, enabled flags, and agent IDs. Never save cron payloads.
python3 - "$BACKUP_ROOT/cron.json" <<'PY'
import json, subprocess, sys
result = subprocess.run(
    ["node", "/path/to/openclaw.mjs", "--profile", "lisa", "cron", "list", "--json"],
    check=True, capture_output=True, text=True,
)
data = json.loads(result.stdout)
jobs = data.get("jobs", data if isinstance(data, list) else [])
with open(sys.argv[1], "w", encoding="utf-8") as handle:
    json.dump({"jobs": [
        {"id": job["id"], "enabled": job.get("enabled") is True,
         "agentId": job.get("agentId")}
        for job in jobs
    ]}, handle)
PY

node linkbots/lisa/ops/lisa-direct-migration.mjs snapshot \
  --source "$PROFILE" \
  --backup-root "$BACKUP_ROOT" \
  --cron-json "$BACKUP_ROOT/cron.json" \
  --allow-external-symlink-prefix /Applications/ChatGPT.app/Contents/Resources \
  --allow-external-symlink-prefix /path/to/openclaw_prime
node linkbots/lisa/ops/lisa-direct-migration.mjs verify \
  --backup-root "$BACKUP_ROOT"
```

External symlinks must be explicitly allowlisted for the destination host.
Candidate/stage profile targets and unapproved escapes fail closed. The
manifest contains relative paths, hashes, sizes, modes, timestamps, and
redacted cron identity metadata, never file contents.

## Direct Mac readiness sequence

1. Record the current live PID, listener, loopback health, profile root,
   profile/agent IDs, channel presence, memory/index paths, SQLite checks, and
   the redacted cron ID list.
2. Build the exact committed worktree. Do not copy the repository into the
   profile and do not alter the profile identity.
3. Confirm the rollback backup verifies before changing the service wrapper.
4. Change only the profile-local service wrapper's executable path to the
   reviewed worktree. Preserve all profile config and data.
5. Tighten only owner-readability metadata on service/config/state/credential
   paths; the service owner must remain able to read every path.
6. Do not configure Brain, Skills, or PACI unless a separately owned Cloud Run
   task has supplied a verified reachable URL and contract. A local stage
   listener or an unverified URL is not sufficient.
7. Restart only `ai.openclaw.lisa` during the controlled window. Do not run
   cron jobs, send channel messages, or start another profile.
8. Verify health, service PID, config validation, channel configuration
   presence, OAuth/provider route metadata without values, MiniMax route
   presence, SQLite `quick_check`, memory/index presence, and exact cron
   count/ID equality.
9. On any failed check, stop the live service, restore the prior wrapper and
   exact profile from the protected backup during the approved rollback
   window, verify the old health path, and leave the backup intact.

Expected downtime is the wrapper restart interval, normally under two minutes;
the Principal's final conversation/channel test is outside this packet.

## Lisa-only VPS layout

The VPS uses the existing `lisa` profile and the same gateway port. It does not
create a second config, agent, workspace, or cron identity:

```text
/opt/openclaw_prime/                         reviewed checkout
/etc/openclaw/lisa/openclaw.json             relocated config path
/etc/openclaw/lisa/service.env               host-only environment references
/var/lib/openclaw/lisa/state                 relocated state root
/var/log/openclaw/lisa                       journald-adjacent log path
/var/backups/openclaw/lisa                   protected rollback backups
```

Install `ops/lisa-vps.service` as
`/etc/systemd/system/openclaw-lisa.service`, copy the reviewed
`lisa-vps.service.env.example` to the host contract, and replace only the
host-path placeholders. The service must remain `User=openclaw-lisa`,
`OPENCLAW_PROFILE=lisa`, loopback-bound, and on port `18790`. Do not install a
generic instance unit that can create another profile.

## Restore and VPS relocation

Restore is fail-closed unless the target basename is `.openclaw-lisa`; it
rejects candidate/stage roots and refuses an existing target unless the
operator supplies `--allow-existing-target --apply` during an approved
rollback window.

```bash
node linkbots/lisa/ops/lisa-direct-migration.mjs restore \
  --backup-root "$BACKUP_ROOT" \
  --target-root /srv/openclaw/.openclaw-lisa
node linkbots/lisa/ops/lisa-direct-migration.mjs relocate \
  --backup-root "$BACKUP_ROOT" \
  --from-root "$HOME/.openclaw-lisa" \
  --to-root /srv/openclaw/.openclaw-lisa \
  --output /tmp/lisa-relocation-plan.json
```

Relocation is a plan until the operator reviews host mappings. Only host roots,
the executable path, the service wrapper/unit, filesystem owner/group, and
gateway bind/port may change. Workspace, personality, memory, knowledge,
sessions, SQLite state/indexes, cron schedules/payloads/IDs, channels, model
routes, and agent/profile IDs are immutable surfaces. Internal symlinks are
mapped to the new profile root; external host symlinks require an explicit
destination-host mapping.

Before cutover, capture a second redacted cron list and run:

```bash
node linkbots/lisa/ops/lisa-direct-migration.mjs compare-cron \
  --before "$BACKUP_ROOT/cron.json" \
  --after /tmp/lisa-cron-after.json
```

Run the service cutover under one host lock so the old and new gateways cannot
execute the same cron rows concurrently:

```bash
# The one supervisor that owns both services must acquire this lock, stop the
# Mac Lisa, and leave it stopped before starting the VPS service.
sudo flock -n /run/lock/openclaw-lisa-cutover.lock -c '
  systemctl is-active --quiet openclaw-lisa.service &&
    { echo "stop: another Lisa service is still active" >&2; exit 78; }
  systemctl stop openclaw-lisa.service 2>/dev/null || true
  systemctl start openclaw-lisa.service
'
```

The actual Mac stop and VPS start commands must be supplied by the operator's
host supervisor; do not delete, disable, or edit Lisa's cron rows. The lock is
the cutover guard, and the old service must be quiescent before the VPS starts.
Rollback is the inverse: acquire the same lock, stop the VPS service, restore
the verified snapshot to the same `.openclaw-lisa` root, restore the prior
service wrapper, and start the intact Mac Lisa. Keep the snapshot until the
Principal accepts the VPS test.
