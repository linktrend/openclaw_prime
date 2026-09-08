# LiNKskills contract fixtures (OpenClaw consumer drafts)

**Status:** `PENDING_OWNER_COUNTERSIGN` after AuthClaims 1.1.0 fixture refresh (wave 8)

These fixtures are consumer-side contract samples for OpenClaw Lisa integration tests
and the local Skills fake MCP. They are derived from:

- `docs/OPENCLAW-PRIME-LISA-LINKBRAIN-LINKSKILLS-DETAILED-IMPLEMENTATION-PLAN.md` §8–§9
- LiNKskills plan tool names (`skills_*`) and envelope shapes (`packages/contracts/schemas/*`)
- Final Skills main `6269cb173a7c9e0170b29f35c539343c29eab795` / tree `6c36e6c98f90e55d957fba781327b1b0ef90860a` (v2 immutable-release certification path)
- Exact Platform contract `platform.auth-claims/1.1.0` (camelCase AuthClaims in `identity/` + `auth/`)

## Rules

- No live identifiers, endpoints, messages, credentials, or private data.
- Fake proof never claims stage/production readiness.
- Domain owner (LiNKskills) must approve before fixtures are treated as authoritative.
- Any owner delta that conflicts with these drafts stops OpenClaw adapter work until reconciled.
- Prior suite-authored `observed_output` / `live_echo` certification path is **withdrawn**; see Skills handoff `2026-07-28-grok-certification-path-correction.md`.

## Layout

| Path          | Purpose                                                            |
| ------------- | ------------------------------------------------------------------ |
| `identity/`   | Positive and negative `platform.auth-claims/1.1.0` AuthClaims      |
| `auth/`       | Expired, revoked, wrong-audience, wrong-service AuthClaims rejects |
| `tools/<op>/` | Request / response / error for every §9.2 tool                     |
| `telemetry/`  | Structured run/validation events (no conversation fields)          |
| `failures/`   | Retryable, terminal, throttled, authentication                     |
| `health/`     | Health + version negotiation                                       |
| `replay/`     | Duplicate idempotency / replay                                     |
| `prohibited/` | Payloads that MUST be hard-rejected                                |

## Contract versions in fixtures

- `schema_version`: `0.1`
- `contract_version`: `0.1`
- API label: `skills.api.v0.2` (legacy execution fixtures below are retained as disabled compatibility evidence)
- Platform claims: `platform.auth-claims/1.1.0`

## Consumption package hash

| Field                                 | Value                                                                      |
| ------------------------------------- | -------------------------------------------------------------------------- |
| Method                                | SHA-256 of sorted lines `{file_sha256}  {relative_path}` over all `*.json` |
| JSON file count                       | 71                                                                         |
| **Fixture package aggregate SHA-256** | `203163711b5db17b8a07d3956e41596384cbd08f0c110bd9f21abfc5c7e5e19a`         |
| OpenClaw plan SHA-256                 | `17203ee586a3fb2b1281bcddd8b17ae350075ebce537689f3c4bfcbbd14914f7`         |
| Skills contracts final main pin       | `6269cb173a7c9e0170b29f35c539343c29eab795`                                 |
| `CONTRACT_VERSION`                    | `skills.api.v0.2`                                                          |
| Upstream schemas aggregate SHA-256    | `828ac00d3be0e9b2040aacec3ca788176d8bb160c11d13994055d047503981d2`         |
| Platform auth-claims schema SHA-256   | `c2e8bc68b3feb9a3dacc497f5a5d497b466c400804fb4f9e41734c10772ddfa1`         |
| Platform auth-claims contentHash      | `fb518834be897c32574df5f7235704fdb0de708bd3da1b48fc448246e3eca567`         |
| Recorded                              | 2026-07-29 Asia/Taipei (wave 8 AuthClaims 1.1.0)                           |
| Sign-off process                      | `docs/execution/openclawdevelopmentplan01/FIXTURE-OWNER-SIGNOFF.md`        |

## SHA-256 inventory

| File                                                | SHA-256                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------ |
| `auth/expired.json`                                 | `a720098a34a4b1a80f76145761d8d6e07711f2963e61936f1704f7dce875cfb7` |
| `auth/revoked.json`                                 | `e440fdc57dbda122e5231ebb720b563a0531337060838ce11b34e2770267a4d6` |
| `auth/wrong-audience.json`                          | `9001fe5ac0db3583e09dffad2623c6c897a519d17eac881fe187321ddeec22f5` |
| `auth/wrong-scope.json`                             | `b2dc8641c325471087a8cc02cfdb1c2f7847c1bfda8496c71be07a15bf9a0859` |
| `failures/authentication.json`                      | `21bc9de95031f4a2e9bbc018a43c4704b077e88edee94583b1222f6be24dee66` |
| `failures/retryable.json`                           | `c78d150a24010fae853c9600302a935f2d3d08225ba696f5c815ce9d2e665b5c` |
| `failures/terminal.json`                            | `a3a69b154bbf7a13d5fc21b52edc73ea2520fa8496ff418a8609f1a9d7c06375` |
| `failures/throttled.json`                           | `c95acdadf89edb6b9b4dffb156614760a9e2d9ca53690e475d5663821e0a02cb` |
| `health/health-ok.json`                             | `f80574ad5b35849d260bdf27c595ef773eaac52c3ad0445e3a965fba00eab781` |
| `health/version-negotiation.json`                   | `dbe130879649f1008d3f029baefce28d4937b817e687d0492680715f0c2e62af` |
| `identity/legacy-1.0.0-reject.json`                 | `e9165e4f783dedc855ea467525dc2a0ae8adb6686e01b036e2cc86fb6ab12bd6` |
| `identity/negative-claim.json`                      | `cdc77028187f4f479207338003e5ea0cdc9c83543c797f74635d667f9d62e127` |
| `identity/positive-claim.json`                      | `a1e70b1a5d8ba35cc2a7062beab15c7cfd58f48c77c82ba6c10aa10f910acb07` |
| `identity/positive-service-null-org.json`           | `bf87cd7fcc60e5f8c7b2ec8ed3946e0be3110f3811c2188752dbd8a229a7586b` |
| `prohibited/brain-findings.json`                    | `3b6c5520401218f48f3acca0ec11ea0c69e71202e867e8893137635dccdb7a7f` |
| `prohibited/conversation.json`                      | `e6dc10aca47c868dabab661ae63cf6a078c7297506d42c99f98c9fae3d84286c` |
| `prohibited/message-body.json`                      | `4a731dcee1578127fdefad4ca923e4fb68f62f3da1b9bdf86fb6b21719a6883e` |
| `prohibited/prompt.json`                            | `e1e84893ce3755de9459375c96cfc1e3ac22f8bb29c7f271ffb826e050a345bb` |
| `prohibited/raw-tool-args.json`                     | `fd3410fa9cc1b9e3287907e1f2e72b6eb6aa363cb3d8acca7db645c6403cd355` |
| `prohibited/raw-tool-results.json`                  | `438860b1876c222c76edf99662928f3b4dabe3cbc69c0b6b12a69eb39680d299` |
| `prohibited/reasoning.json`                         | `bf8914282dd559dc58db3ec347c1065a475909655b8614eb331c3dc895f70f24` |
| `replay/duplicate-idempotency.json`                 | `1a1f4a8abf996bdf871fe17d955798e3ee88ae38d97fcc8f34a375d59502c657` |
| `replay/replay-response.json`                       | `f733a61c12cb0a098e5d6894706344bc9cbc72050e17476d6a6ca0147ddbe456` |
| `telemetry/structured-event.json`                   | `fc4e0aa896f6992455d941865c523d4a8a638314029be09c0aaa0d73b6ba9fca` |
| `telemetry/validation-outcome-fail.json`            | `3ffb4781591e9650ff65afe6fbbeaea20725770d20cd853535a40978fa736f47` |
| `telemetry/validation-outcome-pass.json`            | `00731edbf339d725c2ac0a333bc481db70482d845ab9379b2ae131a6adafb31e` |
| `tools/skills_describe/error.json`                  | `49c722c0f5f9e260fd7106c0b83fd32c0663f9453557f86bf3edfa9a4344f840` |
| `tools/skills_describe/request.json`                | `bb844f59944abb399be0d7c91bcdbd3cf85cb02fbda3afa1bd0a71b908e9e48c` |
| `tools/skills_describe/response.json`               | `70a558be94c2ad20ff6334cb864be7eb70f47cb29471863dddffb16457ac92bb` |
| `tools/skills_feedback_submit/error.json`           | `02b0cc29ceca47a450c8563fdac9d7bd6e7eb53cefaa4b3f00657f15723df5d1` |
| `tools/skills_feedback_submit/request.json`         | `f84b9349065b47f6e506a1040a5f5281b944a04aa7f4edc7254f94b65c1b2008` |
| `tools/skills_feedback_submit/response.json`        | `b3c6d5fc57b47056f4268709eb8b8674badc2309b2da1c36cda0664bbdcb6aee` |
| `tools/skills_fragment_get/error.json`              | `fc5bb99a61c031aa59b1d7ba361af40832096b27d1331cd818f39d8bde7024f9` |
| `tools/skills_fragment_get/request.json`            | `3722c3031603ca66b03d611e3e0941b8a14b6eb4f792d9b02fd284d565ce48df` |
| `tools/skills_fragment_get/response.json`           | `6361d2b2ba278347dfad3c7826eb685b6786acac49645d11d2900d364c719d13` |
| `tools/skills_input_validate/error.json`            | `ff4e3106f4c0a1a03c96a22aa8f5c62396515e2338cc96d798c977e20033ef4b` |
| `tools/skills_input_validate/request.json`          | `b2ddf3e19ee1ebb80c61211f991aaf50285d1ccdd9cee268f0d511694f4fb8af` |
| `tools/skills_input_validate/response.json`         | `87113d5257acceb898fc1bf5212e92c51ef7d26ffd86f50387a1e82ab96d73d4` |
| `tools/skills_list/error.json`                      | `f6b4390f49421555c52c71d0141f8ee00808c438691da59c0d23a7983c8e1b3b` |
| `tools/skills_list/request.json`                    | `c787d1faf8805393be9e7451bc32b7f34653b928b550e5f31463cf5662a67d67` |
| `tools/skills_list/response.json`                   | `c1f4ade760243971447adb0d0bc245e5731dea65a527176c69c78e72a91bf9f9` |
| `tools/skills_output_validate/error.json`           | `fbe12297fd9401bcbdd180c02a32cb4544f2f19dd2145b8542036f3e8a4fb899` |
| `tools/skills_output_validate/request.json`         | `9b690b8d0e6d29926ae75d62860a2b1247ace50623e98c22bf8ab06e93c2e693` |
| `tools/skills_output_validate/response.json`        | `4da2edcbdf72ce924a37887cb0e0486b344770ddbf313292d392db632be5a11f` |
| `tools/skills_release_get/error.json`               | `bedcd00fb2f52ae0828d2655e5ef3ce4815a20273c5b7d29918569c933ed849b` |
| `tools/skills_release_get/request.json`             | `7eaa14cae7f2b797be6477450c48f767cb31c2163c3eb707b19b888a8e7f1295` |
| `tools/skills_release_get/response.json`            | `57ff2b1a0d6a94b3bfb640499b66d717f2d9d34bc1d1500c9b3e2480cbb7dfb8` |
| `tools/skills_run_complete/error.json`              | `2624655a619ca0fe2f079c77d9904480464a5eeeeb1431f1acb86c34ee028892` |
| `tools/skills_run_complete/request.json`            | `24fa71864c50361a7a18832e6ea646d78542524c306c0306fd1ca473afd5ce54` |
| `tools/skills_run_complete/response.json`           | `2f48aa58e7d94da54652d7b6aafb2c9576c025ca4902ba189b6161c421fb1751` |
| `tools/skills_run_fail/error.json`                  | `2624655a619ca0fe2f079c77d9904480464a5eeeeb1431f1acb86c34ee028892` |
| `tools/skills_run_fail/request.json`                | `bb36684892b227371c1dc3e1408945992f11161c39dd45073f4315267d1f3b53` |
| `tools/skills_run_fail/response.json`               | `9de8b8bc5cdb28d4ea5bdae09ae6770d80009e8d4c4c98db6c9f47b96a03aa71` |
| `tools/skills_run_start/error.json`                 | `6ad7943eca9610756d4625505ab0f40dc5417bb16362395af27245a2003e9625` |
| `tools/skills_run_start/request.json`               | `68da61327a33f40867073de7496edbeba92341ba90c12fc65d8df1407c25f5e2` |
| `tools/skills_run_start/response.json`              | `a2d3bab78b5cfc3984a6b5cc5d2295ff94829b7debcb61911fed2e2bdf1b7628` |
| `tools/skills_run_update/error.json`                | `ec8af9beebaf5defae7b4828f793dabed7904b2e30943fa079c14d793dec3824` |
| `tools/skills_run_update/request.json`              | `5ca7886c0f259ad7e510d0ce6d4a6d7f26e95be06da49773ca914ea2b33d3cc4` |
| `tools/skills_run_update/response.json`             | `b464c4f2189ff89397d72150dbf8bd9d5c1e6237fd720c402359c2b31243a681` |
| `tools/skills_search/error.json`                    | `0dc183f609c2cf9618b3863afeed7cb8fe3f0749ddeb73940c230b9f0e2cdd63` |
| `tools/skills_search/request.json`                  | `0d539f02506bb1341b37310c85b9f3cb350b9f350afafb7f84587042a2750c33` |
| `tools/skills_search/response.json`                 | `45244781c6416de194cf98937bd4470396c6c0bb814e4cb890bd88b231367b9c` |
| `tools/skills_tool_invoke/error.json`               | `d02c97afef676d642bd04c5d4dad51447c539b502e69a98a11cdb55da910ea72` |
| `tools/skills_tool_invoke/request.json`             | `a7ba6826f5ea82da5d8680f5c52cd63761b5d5a9c6869a016105553a6d7fcb4c` |
| `tools/skills_tool_invoke/response.json`            | `9b3e14f3eee1957cf05f733ff0f7b1e72a1f98b14e2e25538045dcb4d82bc1cf` |
| `tools/skills_tool_resolve/error.json`              | `e183f47194de7dad2931cbb3a768871262795c2d09f08bf0f59cf9ec3977308d` |
| `tools/skills_tool_resolve/request.json`            | `c2a338f2afa1e919e1f15b8a1dd48d68fe93b3742f56c3f311b63b5ec1b58964` |
| `tools/skills_tool_resolve/response.json`           | `314ad05ccc062452cf6296486e061f52147e883700dea8fbbdb365cc32f3eee1` |
| `tools/skills_trace_candidate_submit/error.json`    | `911c9a4212e1aff4c50cc4fa481570f926ff3c83c61ecb83f916d97aab024073` |
| `tools/skills_trace_candidate_submit/request.json`  | `5837ad3af3c2b3eb5ef0441ca3ac3e4d4ce74f879e4fa90b45b9e145ee210282` |
| `tools/skills_trace_candidate_submit/response.json` | `1090418bdd5f43e3dd4c7d2cf87987763d874cf8c3cde2e47f2708af14a54c7d` |

## Owner sign-off

| Field                      | Value                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| Status                     | `OWNER_COUNTERSIGNED` (reaffirmed at tip `429a7818…`)                                                   |
| Aggregate SHA-256 attested | `8586d89a4a160987ace45ed4392b78c8a66391940e81eed6bdc098f49404ec96`                                      |
| OpenClaw tip attested      | `429a7818e2f79be27329c1848531ffe9ba0f7367`                                                              |
| Owner name / session ID    | Cursor Grok 4.5 High — LiNKskills domain owner / `20260728-linkskills-openclaw-fixtures-reaffirm`       |
| Signature                  | `41ab5a3d31a79a662158d8fb434f76b707701b7a` (reaffirm); prior `fe9f28caec9eca571c522a5fc3c5059611397ac8` |
| Signed at (Asia/Taipei)    | 2026-07-28 12:58 (reaffirm); prior 2026-07-28 11:20                                                     |

**Phase 1 fixture-owner gate CLOSED** for this package at tip `429a7818…`. Phase 1 overall still blocked on Platform auth-path. Not Codex Phase 14; not merge authority.

Regenerate the per-file inventory and aggregate hash after any fixture edit.
