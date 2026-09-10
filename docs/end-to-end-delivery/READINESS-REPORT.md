# Readiness report

Observed: 2026-09-10, Asia/Taipei. Status: **READY FOR FOUNDER APPROVAL;
EXECUTION HOLD**.

## Verified current facts

- Protected planning start: `development`
  `7aee52d52695ab50bfa13dd275a68d28a5cbbe6b`, tree
  `243027a77caba32a9365e0dbd7cd448596fb660b`.
- Five-agent parity source candidate `a303f0a3082862022866fb4a4c86422e94915e8e`
  is an ancestor of the current protected branch; its historical
  `protectedIntegrated=false` field is stale evidence, not current truth.
- Server01 has five healthy containers using one exact image digest
  `sha256:b8788516972af4210b35ebefd871f926173173e6bfaccb05ae568d5f37e4737d`.
- Lisa, Eric, David, Sara, and Jane listen only on loopback ports 18791–18795,
  use separate writable runtime roots, workspaces, and SQLite state, and run as
  `1000:1000` with read-only root filesystems and `unless-stopped` restart.
- All five configs select Sol Low, Luna High as the sole fallback, and enable
  OpenAI/OpenRouter/Codex/ACPX/Brain/Skills/Telegram/Buzz. Google Chat is disabled.
- The official Buzz plugin is `2026.9.2` in all five. Buzz, Buzz database,
  Redis, MinIO, internal proxy, Brain, Brain MCP, and Skills containers are
  healthy. Local HTTP health returned 200 for agent, Brain, Skills, and core Buzz
  endpoints; the pairing endpoint is a distinct protocol surface and returned
  400 to a generic `/health` probe.
- Server01 has approximately 31 GiB free on `/`, 147 GiB free on `/srv`, 243 GiB
  available memory, and unused swap at observation time.
- The established Cursor dispatcher artifact hashes match their qualified
  values; a fresh same-day stored account receipt contains the required account,
  model parameters, and repository; all 23 offline dispatcher/lane tests pass.
- Direct Codex source confirms auth refresh is a server request whose JSON-RPC
  failure is surfaced as a code/message I/O error. OpenClaw's current deployed
  path failed to classify that result for fallback.

## Evidence by layer

| Layer | State | Evidence and limit |
| --- | --- | --- |
| Five-agent parity source | DONE | Present in current protected tree. |
| Live process/topology | DONE | Five healthy isolated containers at the observed digest. Health is not functional acceptance. |
| Sol Low configuration | DONE | Structural config readback on all five. |
| Sol Low real Lisa request | HOLD | Failed before inference at auth refresh. |
| Luna High configuration | DONE | Structural config readback on all five. |
| Luna High automatic fallback | HOLD | Current image did not reach fallback after the real Lisa refresh failure. |
| Fallback source repair | READY | Issue-312 candidate `566d6f...` / tree `65a7a1...`, recorded independent review PASS. |
| Fallback protected integration | HOLD | Protected `development` unchanged; cited PR #237 is unrelated historical work. |
| Platform source handoff | READY | Protected migration/registration source receipts exist in prior coordination evidence. |
| Platform production registration | HOLD | Active Deployment Recovery task owns backup, restore, migration, `svc_platform`, and JIT credential work. |
| Brain/Skills services | READY | Live health observed; exact five-actor consumer credentials/acceptance absent. |
| Lisa Brain/Skills | HOLD | Prior/live structural evidence exists; complete current functional acceptance blocked by Lisa auth. |
| Other four Brain/Skills | HOLD | Distinct Platform/client/SecretRef activation and functional acceptance absent. |
| Buzz core | READY | Existing plugin, services, identities, and prior message evidence; current preservation/maintenance receipt still needed. |
| Buzz persistence/profile completion | HOLD | Prior connection-attribution uncertainty and missing canonical portrait/description decisions. |
| Google Chat | HOLD | Installed but intentionally disabled for all five; five app/credential/webhook gates absent. |
| Role/personality refinement | HOLD | Technical role manifests exist; founder-deferred detailed refinement remains OCP-09. |
| Backup/restore/reboot acceptance | HOLD | Current five-root, isolated-restore, new-image rollback, and cold-reboot receipts absent. |

## Launch blockers

1. Founder has not posted `APPROVE` in this task.
2. The current task owner is not in the suspended Cursor queue's resume scope;
   OCP-00 must add only the narrow owner/repository grant after approval.
3. The reviewed fallback repair is not protected-integrated or deployed, and its
   inherited Phase PR identity is incorrect.
4. Lisa requires supported interactive OpenAI reauthentication; this is a
   separate account/device security action requiring explicit founder presence
   and approval. Reauthentication alone does not replace fallback proof.
5. The active Platform recovery task must finish and release the Server01/
   Platform mutation boundary with accepted backup, restore, migration,
   credential, issuer/JWKS, actor-registration, and rollback receipts.
6. Four distinct Platform/Brain/Skills activation packages and five-actor
   provider-scope acceptance do not yet exist.
7. Generic coding-delegation parity remains a source HOLD.
8. Buzz persistence maintenance requires an accepted quiescent window; remaining
   profile assets/copy require just-in-time founder input.
9. Google Chat remains intentionally deferred until core fleet acceptance.

None of these requires changing the planning architecture. They are ordered
execution gates, with account login, portraits/copy, and Google Chat app
administration intentionally requested just in time.

## Planning validation gaps

- `pnpm docs:list` could not execute because the locally configured pinned pnpm
  binary returned `ENOEXEC`. The underlying `node scripts/docs-list.js` completed
  successfully. Planning-only scope did not authorize dependency/toolchain repair.
- A live Cursor API refresh was not initiated by this task because the dispatcher
  reads macOS Keychain and repository rules require explicit founder approval for
  that security action. A same-day stored receipt was inspected instead.
- No production request, credential, migration, image build, deployment, channel
  write, Buzz database query, or private-content read occurred in planning.

## Readiness conclusion

The package is complete enough to approve as one route. Execution starts at
OCP-00 and can continue without another architectural decision. Human actions
are requested only at their actual just-in-time gates: account/device login,
canonical portraits/descriptions or policy refinements, public Google Chat app
administration, protected/main promotion, and final live acceptance.
