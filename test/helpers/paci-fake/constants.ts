/**
 * TEST ONLY — Platform PACI Phase-1 constants mirrored for the OpenClaw fake.
 *
 * Frozen envelope authority (platform.auth-token-envelope/0.1.0):
 * - Original freeze HEAD: 0455846487d0b8c583859060ba8b4be70e7f0b48
 * - Certified Platform candidate (OCP-W20): 421a35e97bc302be0f5e1f196d0a5e8d132f6fd8
 *   (byte-identical schema + fixtures to the freeze; provenance-only descendant)
 * - ADR 0013 Accepted
 * - @linktrend/platform-contracts@0.3.0
 * - schema SHA-256 7173b9f9bca59ce8a0e3e3dc2b78b680dd07fdd2451215e3ecd97ff3dd463eed
 *
 * Failed IV HEADs (do not permanently repin):
 * - Wave 2: 39c46680f058d86484fcb24c25c3463deb9488ae
 * - Wave 3: 83501b11b78b0c5f46a5c5ef23f48de9f1317468
 * - Wave 4: ca027417 (failed independent verification — retain freeze bytes above)
 * - Wave 5 Platform: fbdede7c25a933b4e500c796032995aaabc20660
 * - Wave 5 OpenClaw tip / Wave 6 Platform note: 96a96f04ede8df3cec5b67e9bb1e021335e12f5b
 * - Wave 6 Platform: a155cbe941710d452c93077a9b8ce11ace665231
 * - Wave 7 Platform: 94ff0956a5d313a1c538c8e1f81cf641dc381bac
 * - Wave 8 Platform: d807ad3ca2537853d35ec6c738254b54dcc15d66
 *
 * Keep in lockstep with LiNKplatform/packages/paci/src/constants.ts.
 */

/** Nested AuthClaims claim key (envelope §4). */
export const AUTH_CLAIMS_CLAIM_KEY = "https://linktrend.dev/claims/auth" as const;

/** Exact AuthClaims contract version string. */
export const PLATFORM_AUTH_CLAIMS_CONTRACT_VERSION = "platform.auth-claims/1.1.0" as const;

/** Required JWT header `typ` (RFC 8725 explicit typing). */
export const PACI_JWT_TYP = "paci+jwt" as const;

/** Production/signing algorithm — ES256 only. */
export const PACI_ALG = "ES256" as const;

/** Access-token lifetime (seconds) — Platform ACCESS_TOKEN_TTL_SECONDS. */
export const PACI_FAKE_ACCESS_TOKEN_EXPIRES_IN_SECONDS = 15 * 60;

/** Client assertion max lifetime (seconds). */
export const CLIENT_ASSERTION_MAX_TTL_SECONDS = 5 * 60;

/** OAuth client assertion type for private_key_jwt. */
export const CLIENT_ASSERTION_TYPE =
  "urn:ietf:params:oauth:client-assertion-type:jwt-bearer" as const;

/** Forbidden JOSE header params for key selection. */
export const FORBIDDEN_HEADER_KEY_PARAMS = ["jwk", "jku", "x5u"] as const;

/** Forbidden algorithms (fail-closed). */
export const FORBIDDEN_ALGS = new Set([
  "none",
  "HS256",
  "HS384",
  "HS512",
  "RS256",
  "RS384",
  "RS512",
  "PS256",
  "PS384",
  "PS512",
  "ES384",
  "ES512",
  "EdDSA",
]);

/** Default scopes published in RFC 8414 metadata (Platform buildAuthorizationServerMetadata). */
export const DEFAULT_SCOPES_SUPPORTED = ["lbrain", "lskills", "linkplatform"] as const;
