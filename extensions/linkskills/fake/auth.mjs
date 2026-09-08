import { Buffer } from "node:buffer";
import { AUDIENCE, REQUIRED_SCOPES, REVOKED_CREDENTIAL_IDS } from "./constants.mjs";

/**
 * @param {unknown} value
 * @param {string} [fallback]
 */
function asString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export class AuthError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {{ httpStatus?: number; retryable?: boolean }} [opts]
   */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.httpStatus = opts.httpStatus ?? 401;
    this.retryable = opts.retryable ?? false;
  }
}

/**
 * @typedef {{
 *   actor_id: string;
 *   actor_kind: string;
 *   org_id: string;
 *   scopes: string[];
 *   audience: string;
 *   exp: number;
 *   credential_id: string;
 * }} SkillsActorClaims
 */

/**
 * Mint a deterministic fake bearer token for tests.
 * @param {Record<string, unknown>} claims
 */
export function mintFakeToken(claims) {
  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  return `fake.${payload}`;
}

/**
 * @param {string | undefined | null} authorization
 * @param {{ nowMs?: number; requestPayload?: unknown }} [opts]
 * @returns {SkillsActorClaims}
 */
export function verifyAuthorization(authorization, opts = {}) {
  if (!authorization || typeof authorization !== "string") {
    throw new AuthError("auth_missing", "Authorization required", { httpStatus: 401 });
  }
  let token = authorization.trim();
  if (token.toLowerCase().startsWith("bearer ")) {
    token = token.slice(7).trim();
  }
  const claims = decodeToken(token);
  const nowSec = Math.floor((opts.nowMs ?? Date.now()) / 1000);

  if (!claims.actor_id || !claims.actor_kind || !claims.org_id) {
    throw new AuthError("auth_invalid", "actor_id, actor_kind, and org_id are required");
  }
  if (typeof claims.exp !== "number") {
    throw new AuthError("auth_invalid", "exp must be an integer unix timestamp");
  }
  if (claims.exp <= nowSec) {
    throw new AuthError("auth_expired", "Claims expired");
  }
  if (claims.audience !== AUDIENCE) {
    throw new AuthError("auth_wrong_audience", `audience must be ${AUDIENCE}`);
  }
  if (REVOKED_CREDENTIAL_IDS.includes(claims.credential_id)) {
    throw new AuthError("auth_revoked", "Credential revoked");
  }
  const scopes = normalizeScopes(claims.scopes);
  if (!scopes.includes("*") && !REQUIRED_SCOPES.some((scope) => scopes.includes(scope))) {
    throw new AuthError("auth_forbidden", "Missing skills:read or skills:write scope", {
      httpStatus: 403,
    });
  }
  rejectSpoof(claims, opts.requestPayload);
  return {
    actor_id: asString(claims.actor_id),
    actor_kind: asString(claims.actor_kind),
    org_id: asString(claims.org_id),
    scopes,
    audience: asString(claims.audience),
    exp: claims.exp,
    credential_id: asString(claims.credential_id),
  };
}

/**
 * @param {string} token
 * @returns {Record<string, unknown>}
 */
function decodeToken(token) {
  if (!token.startsWith("fake.")) {
    throw new AuthError("auth_unsupported", "Unsupported token format; use fake.<base64url(json)>");
  }
  try {
    const raw = Buffer.from(token.slice("fake.".length), "base64url").toString("utf8");
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("not object");
    }
    return data;
  } catch {
    throw new AuthError("auth_malformed", "Malformed fake token");
  }
}

/**
 * @param {unknown} scopes
 * @returns {string[]}
 */
function normalizeScopes(scopes) {
  if (typeof scopes === "string") {
    return [scopes];
  }
  if (Array.isArray(scopes)) {
    return scopes.map((s) => asString(s));
  }
  throw new AuthError("auth_invalid", "scopes must be a list of strings");
}

/**
 * @param {SkillsActorClaims} claims
 * @param {unknown} requestPayload
 */
function rejectSpoof(claims, requestPayload) {
  if (!requestPayload || typeof requestPayload !== "object") {
    return;
  }
  const bags = [requestPayload];
  for (const key of ["actor", "identity", "claims", "platform_claims", "params"]) {
    const nested = /** @type {Record<string, unknown>} */ (requestPayload)[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      bags.push(nested);
    }
  }
  for (const bag of bags) {
    const record = /** @type {Record<string, unknown>} */ (bag);
    for (const key of ["actor_id", "org_id", "actor_kind", "credential_id", "platform_actor_id"]) {
      if (key in record && record[key] != null) {
        const actual = asString(record[key]);
        if (actual === "") {
          continue;
        }
        const expectedRaw =
          key === "platform_actor_id" ? claims.actor_id : /** @type {any} */ (claims)[key];
        const expected = asString(expectedRaw, claims.actor_id);
        if (actual !== expected) {
          throw new AuthError("auth_spoof_rejected", `Spoofed identity rejected: ${key} mismatch`);
        }
      }
    }
  }
}
