# Phase 1 — Contract consumption record

**Session:** `cursor-cloud-feature-openclawdevelopmentplan01-correction-wave2b-20260728-0952`
**Branch:** `issue/ocp-openclawdevelopmentplan01`
**Recorded:** 2026-07-28 09:52 Asia/Taipei (correction wave 2b)
**Wave 19 AuthClaims provenance correction:** 2026-07-29 Asia/Taipei
**Agent:** Cursor Cloud Agent (Grok 4.5 High), Feature role
**Authority:** Principal mission — consume hashed Platform/Brain/Skills contracts; do not edit upstream

## 1. OpenClaw plan pin

| Field   | Value                                                                           |
| ------- | ------------------------------------------------------------------------------- |
| Plan    | `docs/archive/openclaw-prime-1.0/plans/OPENCLAW-PRIME-LISA-LINKBRAIN-LINKSKILLS-DETAILED-IMPLEMENTATION-PLAN.md` |
| SHA-256 | `17203ee586a3fb2b1281bcddd8b17ae350075ebce537689f3c4bfcbbd14914f7`              |
| Check   | HASH_OK (re-verified 2026-07-28 09:52 Asia/Taipei)                              |

## 2. LiNKplatform pin

**Wave 7 repin (2026-07-28):** authoritative AuthClaims is now `1.1.0` / package `0.2.2`. Historical `1.0.0` rows retained in `contracts/platform/auth-claims-1.0.0/` for audit.

| Field                                  | Value                                                              |
| -------------------------------------- | ------------------------------------------------------------------ |
| Source HEAD                            | `6861a376aae5fa4e12c1b68a808d7b04e7bbfb5b`                         |
| Source branch                          | `issue/LP-01-linkplatformdevelopmentplan01`                        |
| `PLATFORM_CONTRACTS_SEMVER`            | `0.2.2`                                                            |
| Package                                | `@linktrend/platform-contracts@0.2.2`                              |
| **Auth contract**                      | `platform.auth-claims/1.1.0`                                       |
| Schema file SHA-256                    | `c2e8bc68b3feb9a3dacc497f5a5d497b466c400804fb4f9e41734c10772ddfa1` |
| Auth contentHash                       | `fb518834be897c32574df5f7235704fdb0de708bd3da1b48fc448246e3eca567` |
| Claims TS SHA-256                      | `cc382008d1e0a15112ad03d2ad83cbdf55ec24b67807a6af595999b84d943ca8` |
| Golden canonicalize vector (meta only) | file `834f5695…ebae` — **not** a substitute for auth-claims        |
| `contract-meta.ts` SHA-256             | `164caff2e0e79320a38bc6fde3b6fcca30207a2cfada918a422a7397c5f04e9c` |
| Pin artifact                           | `contracts/platform/PIN.json`                                      |
| Sanitized schema copy                  | `contracts/platform/auth-claims-1.1.0/`                            |
| Supersedes                             | `platform.auth-claims/1.0.0` (historical copy retained)            |

Sanitized: metadata + hashes + schema JSON only. No `node_modules` copy.

**Wave 8 AuthClaims 1.1.0 fixture refresh:** Brain/Skills consumer fixture bytes **changed**. Aggregates Brain `4493f714…4811b` (75 JSON) / Skills `20316371…e19a` (71 JSON). Fixture-owner gate was RE-OPENED pending fresh countersigns.

**AuthClaims 1.1 countersign closeout (2026-07-30):** Brain + Skills **`OWNER_COUNTERSIGNED`** at inspected tip `005c9454f1bd3f7427936704131ffe5faa95ef0f`. AuthClaims **1.1** fixture-owner gate **CLOSED** (domain-owner fixture approval only — **not** Codex certification). See `FIXTURE-OWNER-SIGNOFF.md`.

## 3. LiNKbrain pin

| Field                                       | Value                                                              |
| ------------------------------------------- | ------------------------------------------------------------------ |
| Source HEAD                                 | `a3cff6e0f04ac968c32beacb7bdb1b81a4d77d3f`                         |
| Source branch                               | `issue/13-developmentplan01`                                       |
| `BRAIN_CONTRACT_VERSION`                    | `1.0.0` (from `packages/contracts/src/schemas.ts`)                 |
| Package                                     | `@linktrend/lbrain-contracts@0.1.0`                                |
| `packages/contracts/src/schemas.ts` SHA-256 | `61468e4cf93d087df23dad1c26fbc91b258378757024debcde0cb6e97d50e0bb` |
| Frozen MCP tools                            | **17** names in `packages/mcp-server/src/frozen-tools.ts`          |
| `frozen-tools.ts` SHA-256                   | `1e265b20dca34f4be73908a38bf2102c514ce594574faf27a41a9567a663be26` |
| Pin artifact                                | `contracts/brain/PIN.json`                                         |

### Tool-name freeze (non-negotiable for OpenClaw)

OpenClaw consumes **frozen plan §9.1** tool names (17). Corrected Brain HEAD
`a3cff6e…` implements the same surface via `FROZEN_MCP_TOOL_NAMES`. OpenClaw
**will not** alias. See `BRAIN-TOOL-NAME-DECISION-PACKET.md`.

## 4. LiNKskills pin

| Field                                                        | Value                                                                                                                        |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Source HEAD                                                  | `f16103f23a716d0edeb08a1e82e38608ebd563ea`                                                                                   |
| Source branch                                                | `issue/21-linkskillsdevelopmentplan01`                                                                                       |
| `CONTRACT_VERSION` / API label                               | `skills.api.v0.1`                                                                                                            |
| Schema const                                                 | `schema_version: "0.1"`                                                                                                      |
| Schemas dir                                                  | `packages/contracts/schemas/*.json` (13 files, includes historical vendored auth-claims 1.0)                                 |
| Schemas package aggregate SHA-256                            | `828ac00d3be0e9b2040aacec3ca788176d8bb160c11d13994055d047503981d2`                                                           |
| Platform auth-claims (**authoritative consumer**)            | `platform.auth-claims/1.1.0` / `@linktrend/platform-contracts@0.2.2` — schema `c2e8bc68…dfa1` / contentHash `fb518834…a567`  |
| Platform auth-claims (**historical upstream vendored only**) | schema `b0397cdf…50fb` / contentHash `6bf49618…b251` (`platform.auth-claims/1.0.0`) — not current fixtures                   |
| Certification                                                | Immutable-release / executor-receipt path per Skills correction handoff; prior suite-authored observed_output path withdrawn |
| Pin artifact                                                 | `contracts/skills/PIN.json`                                                                                                  |

### Per-schema SHA-256 (Skills upstream package inventory)

Includes the historical vendored AuthClaims **1.0.0** schema file from Skills packages. OpenClaw consumer identity/auth fixtures use AuthClaims **1.1.0** via the approved consumer override in `contracts/skills/PIN.json`.

| File                               | SHA-256                                                                                               |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `dependency-types-v0.1.json`       | `d69d986443845f8783090bbb20ab96b6c8259ca2b853476f61db02ac36cfd33d`                                    |
| `error-envelope-v0.1.json`         | `2aaf94e6027402e9bb6b2cb2afca5778f960c057e931074ebcca8191d2ceab15`                                    |
| `eval-suite-v0.1.json`             | `0bcbbe2c32609866e5d68d8fea3a46167ca71f01290819a4f76fd81dcaa185df`                                    |
| `execution-profile-v0.1.json`      | `5e81f462a2a5868d7d7e75a39e72b65af084333e6a801996ddf56cd8e836da61`                                    |
| `feedback-v0.1.json`               | `516b194279a55789f8d9ea21f3eecf903d6b1d1039da90e354d5914f4da27daa`                                    |
| `mcp-api-envelope-v0.1.json`       | `ad278955dcf9f63282a6027b862924f4e1063b468f8961ae7a73703cd4700f05`                                    |
| `platform-auth-claims.v1.0.0.json` | `b0397cdf34e76ab0986c6d223ecb6c3c66d619ea59557f78cd45c0c015ff50fb` (**historical** upstream vendored) |
| `release-record-v0.1.json`         | `b2c076708388896fe519b350888bd0ca5351bfde881d193023bd877456a35478`                                    |
| `run-event-v0.1.json`              | `a5cdf8e9079ed807ed9251965532ac9f463467319af70766addae47718ae98b1`                                    |
| `runtime-profile-v0.1.json`        | `834671a1d04a0dd043b5dc3ee07639ea3c17b7d1e4f6f56153f8461a763dc96d`                                    |
| `skill-fragment-v0.1.json`         | `5c0c2c373ebdf2668ac439f132116d7ba895966d3290d922c094f2dff771a967`                                    |
| `skill-pack-v0.1.json`             | `85a29f85edd93c19327bfbc64c642615de449fb434a91e466202e520b0db1506`                                    |
| `tool-descriptor-v0.1.json`        | `c827803d995a561fb2dc31e0ce00a2f9adcb8e8f4e8fca56f15710354a87e1fd`                                    |

Schemas package aggregate method: SHA-256 of newline-joined sorted lines
`{file_sha256}  {basename}` plus trailing newline.

## 5. OpenClaw fixture package aggregates

Method: SHA-256 of newline-joined sorted lines `{json_file_sha256}  {relative_path}`
plus trailing newline, over all `*.json` under the fixture root (paths relative to
that root, sorted).

| Package                          | JSON count | Aggregate SHA-256                                                  | AuthClaims | Owner status              |
| -------------------------------- | ---------- | ------------------------------------------------------------------ | ---------- | ------------------------- |
| `extensions/linkbrain/fixtures`  | 75         | `4493f71432ef56f9fc272ff4c208b8901242c2bd83e138f53d6f0259b4f4811b` | **1.1.0**  | **`OWNER_COUNTERSIGNED`** |
| `extensions/linkskills/fixtures` | 71         | `203163711b5db17b8a07d3956e41596384cbd08f0c110bd9f21abfc5c7e5e19a` | **1.1.0**  | **`OWNER_COUNTERSIGNED`** |

Prior denied Brain aggregate (superseded): `d539debc7b9d7347c109e7d462fc27a48c28322f0d3d5b85d57f602e843d45fb`

Owner countersignature process: `FIXTURE-OWNER-SIGNOFF.md`.
Wave-8 request packet: `COUNTERSIGN-REQUEST-WAVE8-AUTHCLAIMS-1.1.md` (**SATISFIED**).

**Current status:** Brain + Skills AuthClaims **1.1.0** fixtures are **`OWNER_COUNTERSIGNED`** at tip `005c9454f1bd3f7427936704131ffe5faa95ef0f` (Brain handoff `cfa8e931…`; Skills handoff `2fb6f8d5…`). AuthClaims **1.1** fixture-owner gate is **CLOSED**. This is domain-owner fixture approval only — **not** Codex certification.

**Historical only:** AuthClaims **1.0.0** Brain + Skills `OWNER_COUNTERSIGNED` at OpenClaw tip `429a7818e2f79be27329c1848531ffe9ba0f7367` (aggregates `275c1fb7…9a1d` / `8586d89a…ec96`). Those countersigns are superseded for the positive AuthClaims path.

Phase 1 overall still blocked on Platform auth-path. Phases 7–12 unstarted. Provisional pending final Codex Phase 14 closeout. Not merge / Lisa mutation / deployment / canary / production authority. Brain residual notes (`itemId`/`id`, `authority=draft`) recorded in `FIXTURE-OWNER-SIGNOFF.md` without fixture-byte changes.

## 6. Consumption rules

1. Consume only pinned HEADs + hashes above (or newer owner-signed supersession).
2. Do not edit LiNKplatform / LiNKbrain / LiNKskills from this OpenClaw session.
3. Do not change OpenClaw tool names away from frozen §9.1.
4. Fixture drafts remain non-authoritative for domain conformance until owners countersign the **current** AuthClaims **1.1.0** aggregates. (AuthClaims **1.1** Brain + Skills are now **`OWNER_COUNTERSIGNED`** — see `FIXTURE-OWNER-SIGNOFF.md`; still not Codex certification.)
5. Fake/fixture proof never claims stage or production readiness.
6. Auth identity fixtures use camelCase `platform.auth-claims/1.1.0` — not golden-meta-as-auth; AuthClaims `1.0.0` appears only as explicit rejection/backward-compat evidence.

## 7. Exact next actions

1. OpenClaw Codex performs final Phase-14 closeout verification of the pushed tip.
2. Platform auth-path remains the open Phase 1 blocker; Phases 7–12 remain unstarted.
3. OpenClaw continues fake-tier work without claiming Phase 1 complete, merge, Lisa live enablement, deployment, canary, or production readiness.
