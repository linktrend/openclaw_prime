# Execution route and governance

Status: **PLAN — no execution authority**

## Gate 0

No step below begins until the founder posts exact `APPROVE` in the
OpenClawPrime Deployment task. The approval is bound to the committed tree and
SHA-256 of this package; any material plan edit requires renewed approval.

One accepted task `APPROVE` covers every routine action documented by this
package, including the established Keychain-backed Cursor readiness check,
ordinary credential provisioning, enumerated migrations, independent execution
reviews, governed protected promotion, image build, and Server01 deployment.
Do not ask for those permissions again. Pause only for an actual interactive
login/consent prompt, an enforced tool permission, a materially changed scope,
or a destructive/unplanned action not described here.

The first coordinator action is the OCP-00 refresh and the narrow queue owner
grant. The global `SUSPENDED` marker remains. No former task owner, prior
approval, or prepared packet is silently reused.

## Established Cursor route

Use the already-qualified dispatcher at
`/Users/linktrend/Documents/Codex/2026-09-09/files-pasted-by-the-user-i/outputs/cursor-cloud/cursor_cloud.py`,
not Cursor Desktop, the SDK, a saved environment, or another integration. At
planning time:

| Artifact/fact | Verified value |
| --- | --- |
| Dispatcher SHA-256 | `9c5b5486842e695e47f32896728ec15568237f304ea86115cde50997e419c260` |
| README SHA-256 | `16474821f05b766ffd397f37178790cc0ccfd77b0554dd89cd975b0b81a12ed6` |
| Lane verification SHA-256 | `0a8dfbcd5f8d31157b454204e7a9fa57458c0c53f0f59558cf5f9f51718289ba` |
| Committed lane-plan SHA-256 | `8ed6786cfb57840a9da6423d59471fa4946f65dad6a4fdceb08b614c96deb810` |
| Account receipt observed | 2026-09-10 15:38 Asia/Taipei; `cursor-001@linktrend.one`, key name `Codex-001` |
| Required selector | `grok-4.6`, `effort=medium`, `fast=false` |
| Repository visibility | `https://github.com/linktrend/openclaw_prime` present in receipt |
| Offline dispatcher tests | 23 passed on 2026-09-10; no API call or dispatch |

The receipt is evidence, not a permanent credential guarantee. OCP-00 refreshes
it immediately before the first paid dispatch. The single accepted task
`APPROVE` already authorizes that routine Keychain-backed check; do not request a
second authorization. Honor any enforced tool prompt and never print, commit, or
send credential values to a worker.

### Validate, submit, and retrieve

Set `DISPATCHER_PATH` to the absolute path above and `PACKET_PATH` to the
coordinator-written packet. These are the only supported operational calls:

```text
python3 "$DISPATCHER_PATH" check
python3 "$DISPATCHER_PATH" validate "$PACKET_PATH"
python3 "$DISPATCHER_PATH" submit "$PACKET_PATH"
python3 "$DISPATCHER_PATH" watch <stable-packet-id> --seconds 45
python3 "$DISPATCHER_PATH" poll <stable-packet-id>
```

`check` must confirm account, key name, model/effort/Fast policy, capacity, and
repository before `submit`. `validate` is offline. `submit` is called once per
stable packet id; uncertain responses are reconciled with the same id. `watch`
is bounded and `poll` retrieves the terminal result. The coordinator verifies
the returned branch HEAD/tree and actual diff before accepting any result.

### Frozen worker toolchain

Each cloud packet selects Node 24 and verifies the repository's full
`packageManager` field before install. The required package-manager identity is
`pnpm@12.1.0` with the hash already pinned in `package.json`; do not substitute
npm, Bun, or another pnpm version. Run:

```text
node --version
node -p 'require("./package.json").packageManager'
pnpm --version
pnpm install --frozen-lockfile
```

If the pnpm wrapper reports the known placeholder `ENOEXEC`, do not repair the
global installation or change the lockfile. Create a task-local prefix and
reinstall the exact pinned version with build scripts enabled, then use only its
binary for this worker:

```text
TASK_PNPM_ROOT="$(mktemp -d)"
TASK_PNPM_SPEC="$(node -p 'require("./package.json").packageManager.split("+")[0]')"
npm install -g --prefix "$TASK_PNPM_ROOT" "$TASK_PNPM_SPEC" --allow-scripts="$TASK_PNPM_SPEC"
"$TASK_PNPM_ROOT/bin/pnpm" --version
"$TASK_PNPM_ROOT/bin/pnpm" install --frozen-lockfile
```

Expected version is exactly `12.1.0`. One failed install may be retried once;
otherwise the packet stops with the first actionable error.

Every later packet includes:

```json
{
  "packet_id": "stable-logical-id",
  "owner": "current-deployment-task-id",
  "repository": "linktrend/openclaw_prime",
  "ref": "issue/<number>-<slug>",
  "commit": "40-character-starting-commit",
  "tree": "40-character-starting-tree",
  "prompt": "complete bounded work instructions",
  "allowed_paths": ["literal/file-or-owned-directory/"],
  "acceptance_commands": [["command", "arg"]],
  "role": "implementation",
  "admitted": true,
  "admission_evidence": "immutable approval and ownership receipt"
}
```

Parallel implementation packets additionally carry different `lane_id` values
and the exact same `lane_plan_sha256`, equal to the SHA-256 of the committed
`LANE-PLAN.json`. Packets without both fields are repository-exclusive.

## Maximum safe concurrency

Use at most **two hosted workers** and **one local control-plane operation** at
once, subject to the stricter current global/provider limit. This is the maximum
safe package ceiling because only two genuinely disjoint source lanes exist and
review capacity must remain available. The execution-time protocol may admit
fewer workers: its adaptive limit is the minimum supported by fresh authenticated
account capacity, spend-ceiling evidence, and safety constraints.

| Wave | Concurrent work | Why safe |
| --- | --- | --- |
| 0 | OCP-00 only | Ownership, authority, and identities must be singular. |
| 1 | OCP-01 only | Existing reviewed candidate requires repository-exclusive integration, not another writer. |
| 2a | OCP-02 only | Broad `src/agents/` and SDK ownership is shared and cannot be a lane. |
| 2b | OCP-03 `PROFILE` + OCP-04 `DEPLOY` | Both consume the committed sanitized OCP-00 input. Literal `linkbots/blueprints`/Lisa-profile paths do not overlap `linkbots/parity`/new runbooks. OCP-04 is source/dry-run only; OCP-05 waits for both. |
| 3 | OCP-05 image assembly/integration only | One protected candidate, image build, and controller are exclusive. |
| 4 | Provider preparation may be read-only in parallel; OCP-06/07/08 writes serial | Platform DB, SecretRefs, Buzz persistence, and Server01 runtime share operational blast radius. |
| 5 | OCP-09 through OCP-12 serial | Core canary, role, recovery, and founder core acceptance depend on prior live state. |
| 6 | OCP-13, then OCP-14 | Google Chat is last and cannot block the accepted core fleet. |

If either lane needs `package.json`, a lockfile, generated output, migrations,
root `src/`, root `docs/`, root `scripts/`, or the other lane's subtree, stop it,
invalidate the parallel admission, and reissue it as repository-exclusive.

## Worker roles

- **Implementation:** Cursor Grok 4.6 Medium, Fast false, one issue branch,
  literal allowed paths, no PR, no nested workers.
- **Independent review:** a separate fresh Cursor worker at the exact candidate
  commit/tree, read-only, with whole decision-surface and direct dependency
  evidence. This OpenClawPrime Deployment task owns and records routine execution
  reviews; the Deployment Advisor reviews this plan only. A review is not
  accepted from the implementer.
- **Integration:** local governed Phase Packager/controller only after exact
  review PASS and accepted receipts. No direct PR creation or merge.
- **Runtime/deployment:** local Server01 owner with exclusive lease and verified
  backup/rollback. Cursor does not receive production credentials.

Use Luna High only for a bounded planning/reasoning fallback when the established
Cursor route is unavailable or the packet is not source implementation. Never
substitute a different Cursor model, enable Fast, or use a generic default.

## Git and release flow

1. Issue branch starts from current protected `development` or the exact accepted
   dependency tree.
2. Implementer commits through `scripts/committer` and pushes only its issue
   branch.
3. Completion evidence binds repository, 40-character commit, 40-character tree,
   scoped diff, commands/results, route receipt, and unresolved HOLDs.
4. Fresh independent review returns PASS/FAIL for the exact identity.
5. A single Phase package integrates accepted issue commits deterministically.
6. Protected promotion proceeds `development` → `staging` → `main` through
   receipts and controllers under the accepted task `APPROVE`; no second routine
   approval is requested.
7. Immutable image build binds the protected commit/tree. Image admission,
   Server01 deploy, per-agent canary, and production acceptance remain separate.

Candidate identity changes invalidate prior tests/review/receipts. A green child
commit cannot inherit a parent's acceptance without exact diff and evidence.

## Retry and escalation

- Ordinary source defect: diagnose, one bounded targeted repair, fresh candidate
  identity, rerun affected proof. Maximum three source-repair cycles.
- Infrastructure/provider failure: retry unchanged identity at most twice after
  diagnosis. Do not convert it into a code change or model substitution.
- Failed review: repair only its evidence-backed findings, then obtain a fresh
  full exact-head review.
- Routine credential, reviewed migration, public-endpoint, protected-promotion,
  image, and deployment actions already described here continue under the single
  accepted task `APPROVE` and their technical receipts. Stop only for actual
  interactive login/consent, enforced tool permission, materially changed scope,
  spend beyond the accepted ceiling, destructive/unplanned migration, SQLite
  schema-version bump, or unresolved owner/security conflict.
- Repeated unresolved authority or identity: HOLD; never continue on assumptions.

## Evidence ledger

For every packet, record four independent statuses where applicable:

1. source integrated;
2. provider live/selectable;
3. consumer configured;
4. Server01 deployed/canary/production accepted.

Allowed final labels are `DONE`, `READY`, and `HOLD`, each with exact evidence
and next owner. Never upgrade READY or healthy infrastructure to DONE.
