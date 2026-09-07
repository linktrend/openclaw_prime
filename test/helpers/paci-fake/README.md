# TEST ONLY — PACI fake (Platform Phase-1 exact adapter)

OpenClaw test helper that mirrors LiNKplatform `@linktrend/platform-paci`
(`createMemoryPaciRuntime` / `createPaciServer`) **without** adding a permanent
production dependency on the private workspace package.

## Frozen authority (do not drift)

| Pin                                    | Value                                                                |
| -------------------------------------- | -------------------------------------------------------------------- |
| Original freeze HEAD                   | `0455846487d0b8c583859060ba8b4be70e7f0b48`                           |
| Certified Platform candidate (OCP-W20) | `421a35e97bc302be0f5e1f196d0a5e8d132f6fd8` (byte-identical envelope) |
| ADR                                    | 0013 Accepted                                                        |
| Contract                               | `platform.auth-token-envelope/0.1.0`                                 |
| Package                                | `@linktrend/platform-contracts@0.3.0`                                |
| Schema SHA-256 (file bytes)            | `7173b9f9bca59ce8a0e3e3dc2b78b680dd07fdd2451215e3ecd97ff3dd463eed`   |
| Canonical content hash                 | `9335b1855c3b3a5ec01b40c18ea85a98826192cbfba3110e07399d896e890a12`   |
| Access TTL                             | `900` seconds (`PACI_FAKE_ACCESS_TOKEN_EXPIRES_IN_SECONDS`)          |
| JWT typ                                | `paci+jwt`                                                           |
| Alg                                    | `ES256`                                                              |
| Refresh                                | none (Phase-1)                                                       |

**Repin state:** Certified Platform candidate `421a35e97bc302be0f5e1f196d0a5e8d132f6fd8`
is a provenance-only descendant of the freeze — schema + fixture SHA-256s match.
Failed IV HEADs `39c46680…` (Wave 2), `83501b11…` (Wave 3), `ca027417…` (Wave 4),
`fbdede7c…` (Wave 5), `96a96f04…` / `a155cbe9…` (Wave 6), `94ff0956…` (Wave 7),
and `d807ad3c…` (Wave 8) must not replace the freeze bytes. Candidate ≠ live PACI
issuer.

### Fixture SHA-256 pins (`packages/contracts/fixtures/auth-token-envelope/`)

| File                                  | SHA-256                                                            |
| ------------------------------------- | ------------------------------------------------------------------ |
| `accept-valid.json`                   | `0ce305bdcddf455a0cca03c24f8608af316fb47f2bef6e3b45028ddaa5f776bb` |
| `accept-token-reuse-correlation.json` | `4ce3ccfc4a0873292720ff8e0f99078ee714b9be136a833fe0d45a2f37ff70aa` |
| `metadata-discovery-valid.json`       | `5e24e2b66f0189f500de3595811dbe2536149b5eb258db84a266e7ce53ecb140` |
| `reject-cross-field-iss.json`         | `6479213a3ff075f2b861974a3ea9a6aa60b3c3ab35fc9f84b03087568da9c13e` |
| `reject-extra-payload-field.json`     | `3b217d50991d67b889d2fb0ed16e3340910f9057d6e22821a19d4f368f134b4d` |
| `reject-issuer-trailing-slash.json`   | `b20223c48f6ddc2bc1cf7040ad4aece7e683d63baaaf70925f91f7f6ee588577` |
| `reject-nbf-not-iat.json`             | `4a2c0536d401ed2baf1bd68e50393764de5bcdd0ecdfc40cba5271e36193f6e1` |

## Parity behavior

- RFC 8414 metadata matches Platform `buildAuthorizationServerMetadata`
  (omit `authorization_endpoint`; `response_types_supported: []`;
  `private_key_jwt` + ES256; scopes `lbrain`/`lskills`/`linkplatform`).
- Access tokens are signed compact JWS with `typ: paci+jwt` (not opaque UUIDs).
- Nested AuthClaims under `https://linktrend.dev/claims/auth` with
  `claimContractVersion: platform.auth-claims/1.1.0`.
- Client assertion `jti` must be an RFC 4122 UUID; non-UUID → `401 invalid_client`.
- Client assertion `jti` single-use / replay → `401 invalid_client`.
- Requested `scope` must be a subset of credential `serviceScopes`; any
  ungranted value (e.g. `admin` when client only has `lbrain`) →
  `400 invalid_scope`. Omitted scope grants the full credential set.
- Introspection requires `private_key_jwt` (missing/invalid client → `401`;
  inactive/unknown/ineligible → `200 {active:false}` with no disclosure).
- Resource-server caller eligibility is independent of the token subject:
  domain / audience / minting-client ACL; cross-domain introspection fails
  closed. Active response `client_id` is the **minting** client, never the
  introspection caller.
- Signing-key rotation with `dropPrevious` makes prior-kid tokens introspect
  inactive. Token revoke → inactive.
- Test knobs: `setMintOverrides`, `setHttpFault` (429/5xx/timeout delay),
  `rotateSigningKeys`, `registerClient`, assertion replay clear, token revoke.

## Public API (compatible)

- `createPaciFakeServer`
- `createPaciFakeEs256KeyPair`
- `PACI_FAKE_ACCESS_TOKEN_EXPIRES_IN_SECONDS` (= 900)

## Why an adapter (not `file:` import)

`@linktrend/platform-paci` is a private workspace package that depends on
`@linktrend/platform-contracts`. Installing it into OpenClaw production deps is
unsuitable; this folder is an exact test-only adapter.
