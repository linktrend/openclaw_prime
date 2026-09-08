# Brain Contract Fixtures Manifest

OpenClaw-derived draft fixtures for Lisa ↔ LiNKbrain integration tests.

- **Status:** `PENDING_OWNER_COUNTERSIGN` after AuthClaims 1.1.0 fixture refresh (wave 8) (Brain denial corrections applied; prior denial of `d539debc…45fb` superseded)
- **Contract version:** `1.0.0` (`BRAIN_CONTRACT_VERSION`)
- **Platform claims:** `platform.auth-claims/1.1.0` (camelCase AuthClaims in `identity/` + `auth/`)
- **Error taxonomy:** Brain Gateway `BrainErrorCode` + `ErrorEnvelope` (`code`, `message`, `safeMessage`, `retryable`)
- **Source plan:** `docs/OPENCLAW-PRIME-LISA-LINKBRAIN-LINKSKILLS-DETAILED-IMPLEMENTATION-PLAN.md` §9.1 / §9.3
- **Brain HEAD pin:** `a3cff6e0f04ac968c32beacb7bdb1b81a4d77d3f` — implements full frozen 17 tools in `packages/mcp-server/src/frozen-tools.ts`
- **Denial handoff (prior tip):** `LiNKbrain/docs/handoffs/OPENCLAW-BRAIN-FIXTURE-COUNTERSIGN-2026-07-28.md` denied aggregate `d539debc…45fb` at OpenClaw tip `0b19e43…`
- **Live data:** none — all actor IDs, tokens, and payloads are sanitized placeholders
- **AuthClaims 1.1 owner-countersigned aggregate:** `4493f71432ef56f9fc272ff4c208b8901242c2bd83e138f53d6f0259b4f4811b` (75 JSON; retained as provenance for the closed Wave 8 sign-off)

## SHA-256 inventory

| File                                                      | SHA-256                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------ |
| `auth/expired.json`                                       | `47129fe89717d6c78466101f8578640a9177463cd903d612896c1fc69296ab9c` |
| `auth/revoked.json`                                       | `41350915b45c1df36032fd1989211395a6300ffdbb58c1009e995367c8b03791` |
| `auth/rotated.json`                                       | `cd98bb98fb7806c25a4f573eb5ea648e4e5e8dbb403eb1686500d2c12abb4ccf` |
| `auth/wrong-audience.json`                                | `4b9d1cbfc9e4f1e6a1a8e16605bb3206e2c9907d344c20f268fc348c6c9a65a2` |
| `auth/wrong-scope.json`                                   | `01bcf4d7a1c365b1734b5f730102d2bd2de9f7ce6a969caa31ab1bcbd61ebab2` |
| `contracts/brain-capture-batch.contract.json`             | `33432cefcb939537e87dc3a53ae92967eb4254a1e67947e6c2d2191d87913ace` |
| `capture/lifecycle-event.json`                            | `5972529e8d0a99f80d6fa14ecb2c69d6584b7c14013ea912ca4e3fff42a5c4e1` |
| `capture/prohibited-reasoning.json`                       | `cbf3fc552d65dda9c54b2a1c6c97ca9b458bde9471b2fb5ddd7ee6d3eba82672` |
| `capture/prohibited-secrets.json`                         | `ef80ff50bc4a9b0081bf00c9a83d8a145d719c7abf4d38da2c394d1733b3ff9b` |
| `capture/prohibited-unbounded-tool-output.json`           | `7484026ed4d8e12115155bcb405061164876c232bc24ce2abc971e5688569b50` |
| `capture/sample-batch.json`                               | `77e0998298c0c09d8a5d509abf239f1f5e4e5b652c6171747237ec2ec062504a` |
| `cross-domain-skills-shaped.json`                         | `965ac881040c8185e37b12e8fb15ba6b41f14fda9bbe25164159dcafe2a1997d` |
| `failures/internal_error.json`                            | `cf888e85ec12af733073534ba768c0135508acbacf288f32fcb4279b2d62a0a2` |
| `failures/rate_limited.json`                              | `cbd8f98f7ad286a4141d28fba86f07c0094392cefaeda5270cfef7f0e66b723b` |
| `failures/unauthorized.json`                              | `069155b50e7026cf1ebf127e1fac53c127607ea88efbb7b4a8c2eae5968cb0f3` |
| `failures/validation_error.json`                          | `123b372af572f5875c770f88bcd4283ccd751348fe4a32544a08d40f38de5f25` |
| `health/health-ok.json`                                   | `772458c6f22277379164218b759a5a8aba3070e5ddd28d7e53d3fe9fd996b918` |
| `health/version-incompatible.json`                        | `d20533d857460cf94a0f6b323a28d4ff331fe2ff150979f3e9dc89ef49645d22` |
| `health/version-negotiate.json`                           | `91d595823ba073ccd1d57ad34f4560def9f8f23458156de6f4b10e7b0fc503e4` |
| `identity/legacy-1.0.0-reject.json`                       | `4be4408c8e5fc16b6852233b6d062ac6191fb3e3aafd9a7a7499c83c57f5b72f` |
| `identity/negative-claim.json`                            | `300572298c02346dd1fab8a70d87b8fcd927fb34501f2fc6f3ccdce48bc7acf7` |
| `identity/negative-persona-null-org.json`                 | `7f627970d6769b2f67fe472ea8300d86c2a5f0581f51a9d12c68df08b92fdc76` |
| `identity/positive-claim.json`                            | `a3b8d73512e5110603058e64f755402e7fa34b664b7fb40476739ecb4b7e4477` |
| `identity/positive-service-null-org.json`                 | `2d6c2d9ede8e3446c285262121055ed6e368a8e158e9337f31b17e0302eae404` |
| `replay/duplicate-idempotency.json`                       | `385f64e78b261aa9c2f74e2dd104dade61c77138dfab966677fad20e0eec6dc5` |
| `tools/coordination/brain_checkpoint_write.error.json`    | `38848c44579f46bfdf5f3bf8525a055d85bf61de214b35e1cd8edf864cf85025` |
| `tools/coordination/brain_checkpoint_write.request.json`  | `7609a9c6011022f719826ecb882b826bd005731b73f26ba17a8855fe3a86f57b` |
| `tools/coordination/brain_checkpoint_write.response.json` | `b85365c18d5c9629993f37fecc02f4f2039a761126061c7fd646ba13d15708fe` |
| `tools/coordination/brain_conflict_respond.error.json`    | `5434fb3e3d72935abbb23896fa1192ffe17c1e6fd4d7bb8ee96b05d7a5ba0529` |
| `tools/coordination/brain_conflict_respond.request.json`  | `d822ca7190bb34fca3ea9382612cb0168481e2c4215a537edcf124af040c9842` |
| `tools/coordination/brain_conflict_respond.response.json` | `362eb0a4dc83e250fcae7fdbe7139fc516063fda3a3a28fef7e9fbdb334151eb` |
| `tools/coordination/brain_handoff_accept.error.json`      | `121206a56bd6fecb2e9cb8c42256a24316335288d25e378005783308d304f7d4` |
| `tools/coordination/brain_handoff_accept.request.json`    | `49f2bf958c93654a38e8044316775fd0fae3ad8df6c6b2f2ae77302b4056ccc5` |
| `tools/coordination/brain_handoff_accept.response.json`   | `6721516fb408a05522d58cf5788662845dd4603a8f8c36ea5b19ab15deed8c29` |
| `tools/coordination/brain_handoff_create.error.json`      | `3d12575a96143308e33c485f8e313e60e3458f206e3fbffb15466b201b77b1ef` |
| `tools/coordination/brain_handoff_create.request.json`    | `24c872d4d86f6288698df0b62a585c7d4d070f86cdb95858c9e1526e40c6ed7d` |
| `tools/coordination/brain_handoff_create.response.json`   | `fa2885bb3f8ac37dfbe598833c2b90291653c0bd46019834f3b2dd1829337a9d` |
| `tools/coordination/brain_inbox_read.error.json`          | `764c2677c23fb4128615214f61e7b5bc64237932256ad2810beccbf5b075c780` |
| `tools/coordination/brain_inbox_read.request.json`        | `e976c1afc96f8ec1f7f1dcf216afce0325b6d5259e091aca2e781927004c437f` |
| `tools/coordination/brain_inbox_read.response.json`       | `0097c6a79ddac1d0a5f1eb526db2911c4babf4a5e063a925b710ff9a3bc6f411` |
| `tools/coordination/brain_message_send.error.json`        | `13b1fa3f9eba7b781d935ef70c4e958518bd2cfa3a627f83749cecb742d3e6e3` |
| `tools/coordination/brain_message_send.request.json`      | `6482f29a5ba5e175b6f70900074b1b282735b7499a6517cca4f9cfe76caa935e` |
| `tools/coordination/brain_message_send.response.json`     | `9d9e97d08b78711fbc8c6fe32e428115c185f0b12564559a8078d0c61cad5bb0` |
| `tools/coordination/brain_task_close.error.json`          | `1c9c06fc7c8d1c5bd76b0b8025207db98767158d6e9056c3969250829960895d` |
| `tools/coordination/brain_task_close.request.json`        | `2fd0fb9952532810f3c698e515ab0d581336ea0beb057b29e47f4edb3897639d` |
| `tools/coordination/brain_task_close.response.json`       | `2b56cd55f500fa2764c888ba1e8c3d07c08f8fc136f47aedf6b1b23cb90c2c5d` |
| `tools/coordination/brain_task_start.error.json`          | `c3cc8c163501e7178cd1468ba62e2ce447b63a70c60abadae95c8bb124833182` |
| `tools/coordination/brain_task_start.request.json`        | `ec4c50d652ee9d764b4f58f1809dca12df40f4fdef37afa2b89c3d080ff8a4dc` |
| `tools/coordination/brain_task_start.response.json`       | `b3165e13a4908a81b11c6e01c02ce927bc3f083710b86be51753c276125219e7` |
| `tools/coordination/brain_task_update.error.json`         | `d90c1edd112fd180a4f0c1544a92bc766df22bc0333cc14c502e99f92d2a5ee4` |
| `tools/coordination/brain_task_update.request.json`       | `846cff73390c2d4207f522178368bf8ed09ecf29809a4fd779067ff373257645` |
| `tools/coordination/brain_task_update.response.json`      | `d4d8672f7ae03b1dfec5521075ae6cc29c231296715451476cf769f4a019a7fb` |
| `tools/knowledge/brain_append_finding.error.json`         | `5d350e5936ce581b08ce1d6d9bfabf152b4a085ab0e8c70e7a80883582618c0c` |
| `tools/knowledge/brain_append_finding.request.json`       | `f2bccaa8b3bdf72ef7487682d3a168de5f2e76c23cb0c94e8adb64159b3ffd86` |
| `tools/knowledge/brain_append_finding.response.json`      | `f78ab508dd6b4c529b248ba14db05ef4e45150edef570e6a5e425b58935dd69e` |
| `tools/knowledge/brain_browse.error.json`                 | `e57df8e5b02e06ca04419f0676fd3fa7eb62417d7c4ca62f987a84a9319d073c` |
| `tools/knowledge/brain_browse.request.json`               | `53da474572f52e37acf9e4b1b1e46955774692fa771da887d3704818950405dd` |
| `tools/knowledge/brain_browse.response.json`              | `51c984a4177ac3f435a416cf055230e94c31af7b98a68381eb8ee243b5a90575` |
| `tools/knowledge/brain_load.error.json`                   | `795d83635a4c52db325007f8705ab75e71bef0d0420dbbab544d1f713c3710f3` |
| `tools/knowledge/brain_load.request.json`                 | `4259470462c40ac22f86260d7136afcbfe35a3a0ef083b950d93f9219b816628` |
| `tools/knowledge/brain_load.response.json`                | `ba140cd5de4d59c280dd9cdbea0384950745d98b0195ce3ce1ad310c36dc93ad` |
| `tools/knowledge/brain_search.error.json`                 | `c2e45a6faa92439f7a82669fc4235afec1da41c30e31033dd45266be30cc7766` |
| `tools/knowledge/brain_search.request.json`               | `11be6827343532e004de11974cb952d712732d8f6a3c84f0be8f1edecebe45eb` |
| `tools/knowledge/brain_search.response.json`              | `26dab80affe578a2636fb13fc8c6adf91d9f5bc918e2d174feec30129e32eb1c` |
| `tools/private/brain_capture_batch.error.json`            | `df60f010f9789cda7b377ab0d066e93206b4e932985109ee65e548e70483f3fa` |
| `tools/private/brain_capture_batch.request.json`          | `c00f58980866a1d507aed2a338544e8223314c0571d02b54bffb86505c56abb3` |
| `tools/private/brain_capture_batch.response.json`         | `5b8e0cf414c138d0cf879e99a572bb45fca8e93c1ae5b1dfdf57f3091101b3ba` |
| `tools/private/brain_episode_checkpoint.error.json`       | `e86d18dcacb62513024e2cff20fba0bbc209672d80a5870344609f56ec8fd03c` |
| `tools/private/brain_episode_checkpoint.request.json`     | `d488eebbf71b813babd5a554b513e7b0054d5b096ca6c2e9b08189e3c0ee5bb0` |
| `tools/private/brain_episode_checkpoint.response.json`    | `233d977bc643bc6487a47f221c45b442607b2f9c341d0b3b90e2ee32ca4a9de7` |
| `tools/private/brain_private_load.error.json`             | `1bbd83b6e558d5fabe30b6a3de83734e5002ace44af57657eb29716d0ad7c351` |
| `tools/private/brain_private_load.request.json`           | `cecfe2f42af46e0989facc035d862f99abc7981b2d1306f679186d6d0850656c` |
| `tools/private/brain_private_load.response.json`          | `86de5bcdac8a7ef29940cb454b24bbc26034bf12132e4f263fc41027cef3d036` |
| `tools/private/brain_private_search.error.json`           | `aaf192e02285207ca27a771ae53d9b69d44f44f2bb6aab583234e4f0ebb3aeaf` |
| `tools/private/brain_private_search.request.json`         | `8e866cd9dc4b9c7b71a500477f60299e9b4e68e9492feec61c4aee089e1f67dc` |
| `tools/private/brain_private_search.response.json`        | `ab656a6ae0dbae0708ffa1040db05269cc0445352e4d392d442d4cceb0eb1e8c` |

## Consumption package hash

| Field                                 | Value                                                                         |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| Method                                | SHA-256 of sorted lines `{file_sha256}  {relative_path}` over all `*.json`    |
| JSON file count                       | 76                                                                            |
| **Fixture package aggregate SHA-256** | `71c5c05ecb10bac525fb6394c0eafde33dda2705ca3f9d7c552a544e18b9586a`            |
| Prior denied aggregate                | `d539debc7b9d7347c109e7d462fc27a48c28322f0d3d5b85d57f602e843d45fb`            |
| OpenClaw plan SHA-256                 | `17203ee586a3fb2b1281bcddd8b17ae350075ebce537689f3c4bfcbbd14914f7`            |
| Brain contracts HEAD pin              | `a3cff6e0f04ac968c32beacb7bdb1b81a4d77d3f`                                    |
| `BRAIN_CONTRACT_VERSION`              | `1.0.0`                                                                       |
| `schemas.ts` SHA-256                  | `61468e4cf93d087df23dad1c26fbc91b258378757024debcde0cb6e97d50e0bb`            |
| `frozen-tools.ts` SHA-256             | `1e265b20dca34f4be73908a38bf2102c514ce594574faf27a41a9567a663be26`            |
| Recorded                              | 2026-07-28 Asia/Taipei (Brain fixture correction after COUNTERSIGN_DENIED)    |
| Sign-off process                      | `docs/execution/openclawdevelopmentplan01/FIXTURE-OWNER-SIGNOFF.md`           |
| Tool-name decision                    | `docs/execution/openclawdevelopmentplan01/BRAIN-TOOL-NAME-DECISION-PACKET.md` |

Tool names in this package are **frozen plan §9.1** (17 names). Corrected Brain HEAD
`a3cff6e…` implements the same surface via `FROZEN_MCP_TOOL_NAMES`. OpenClaw allowlist
remains §9.1; OpenClaw will not alias.

## Owner sign-off

| Field                      | Value                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| Status                     | `OWNER_COUNTERSIGNED`                                                                                   |
| Aggregate SHA-256 attested | `275c1fb747cf1042516794a1fdd164b88b7450a02cef2a58440bcb221f449a1d`                                      |
| OpenClaw tip attested      | `429a7818e2f79be27329c1848531ffe9ba0f7367`                                                              |
| Owner name / session ID    | Cursor Grok 4.5 High — LiNKbrain domain owner / `issue/13-developmentplan01`                            |
| Signature                  | `d43552742b6a3e9eb942275106b103d873a889fb` (`OPENCLAW-BRAIN-FIXTURE-OWNER-COUNTERSIGNED-2026-07-28.md`) |
| Signed at (Asia/Taipei)    | 2026-07-28 12:49                                                                                        |

**Phase 1 fixture-owner gate CLOSED** for this package at tip `429a7818…`. Phase 1 overall still blocked on Platform auth-path. Not Codex Phase 14; not merge authority.

Regenerate the per-file inventory and aggregate hash after any fixture edit.
