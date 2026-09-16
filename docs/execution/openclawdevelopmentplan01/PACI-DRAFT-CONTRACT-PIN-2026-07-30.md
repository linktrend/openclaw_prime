# Contract-delta packet — PACI frozen pin for OpenClaw local/fake baseline

**Recorded:** 2026-07-30 Asia/Taipei
**OpenClaw branch:** `issue/ocp-openclawdevelopmentplan01`
**OpenClaw start HEAD (correction wave):** `3e449b74d8a2fdfb157949656f394228dab32857`
**Authority:** Principal correction prompt `docs/archive/openclaw-prime-1.0/cursor-grok-paci/CURSOR-GROK-PACI-INDEPENDENT-VERIFICATION-CORRECTION-2026-07-30.md` — frozen Platform supersedes prior draft pin

## Platform snapshot (frozen)

| Artifact          | Exact value                                                        |
| ----------------- | ------------------------------------------------------------------ |
| Platform HEAD     | `0455846487d0b8c583859060ba8b4be70e7f0b48`                         |
| ADR 0013          | **Accepted** — authclaims cryptographic token issuance             |
| Envelope          | `platform.auth-token-envelope/0.1.0`                               |
| Contracts package | `@linktrend/platform-contracts@0.3.0`                              |
| Schema SHA-256    | `7173b9f9bca59ce8a0e3e3dc2b78b680dd07fdd2451215e3ecd97ff3dd463eed` |

## Supersedes

Prior OpenClaw draft pin at Platform `2c270987842eeb7580dcc80b96fdf5b7c311218e` / envelope semantic `0.1.3-draft` is **superseded**. If Platform publishes a compatible correction descendant during work, re-pin that exact HEAD.

## Principal decision file vs this prompt

| Decision | Committed Platform file | This Principal OpenClaw prompt                                                                 |
| -------- | ----------------------- | ---------------------------------------------------------------------------------------------- |
| D12      | `forbidden` (LOCKED)    | Unlocks Platform local/fake on Platform side — OpenClaw does **not** operate Platform issuance |
| D14      | `not yet` (LOCKED)      | **yes** for OpenClaw-owned machine-token seam local/fake implementation                        |

OpenClaw proceeds under the Principal execution/correction prompts for **OpenClaw-owned** work only. This packet does **not** edit LiNKplatform and does **not** claim live Platform enablement.

## Local/fake baseline use

OpenClaw fake PACI issuer + client tests pin the frozen hashes above as the **local/fake behavioral baseline**. Fixture/owner countersign refresh follows the approved contract process when fixture JSON changes.

## Protocol behaviors implemented against (frozen)

- RFC 8414 discovery at `issuer + "/.well-known/oauth-authorization-server"` (issuer: no trailing `/`, no path)
- `grant_types_supported: ["client_credentials"]`
- Client auth: `private_key_jwt` + ES256; assertion `aud` = token_endpoint; assertion `jti` single-use/replay-rejected
- Access token: Bearer + frozen 900-second `expires_in`; Phase-1 **no** refresh_token; early reissue when remaining TTL < 20%
- Access-token `jti` multi-use while valid
- Independent domain bindings (Brain ≠ Skills)
- SecretRef-only private-key custody at the trusted machine-token provider boundary

## Explicit non-claims

- Not live Lisa / live Platform mutation
- Not Codex certification
- Not merge / PR readiness / hosted CI green
