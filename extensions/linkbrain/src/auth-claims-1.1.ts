/**
 * Consumer-side AuthClaims shape check aligned to platform.auth-claims/1.1.0.
 *
 * Mirrors Platform `assertAuthClaimsShape` rules from the pinned freeze
 * (schema SHA c2e8bc68… / contentHash fb518834…). Does not import Platform
 * packages; OpenClaw owns only the consumer conformance copy.
 */
export const PLATFORM_AUTH_CLAIMS_CONTRACT_VERSION = "platform.auth-claims/1.1.0" as const;
export const PLATFORM_AUTH_CLAIMS_PREVIOUS_CONTRACT_VERSION = "platform.auth-claims/1.0.0" as const;

const ACTOR_KINDS = new Set(["human", "persona", "service", "adapter", "program_executor"]);

const CLAIM_KEYS = new Set([
  "claimContractVersion",
  "actorId",
  "actorKind",
  "runtimeBindingId",
  "credentialId",
  "orgId",
  "internal",
  "serviceScopes",
  "permittedOperations",
  "issuedAt",
  "expiresAt",
  "issuer",
  "audience",
  "programRestrictions",
  "repositoryRestrictions",
  "correlationId",
]);

const REQUIRED_CLAIM_KEYS = [
  "claimContractVersion",
  "actorId",
  "actorKind",
  "runtimeBindingId",
  "credentialId",
  "orgId",
  "internal",
  "serviceScopes",
  "permittedOperations",
  "issuedAt",
  "expiresAt",
  "issuer",
  "audience",
  "correlationId",
] as const;

const FORBIDDEN_COMPETING_KEYS = new Set([
  "claims",
  "payload",
  "secret",
  "token",
  "actor_id",
  "org_id",
  "credential_id",
  "runtime_binding_id",
]);

export class AuthClaimsShapeError extends Error {
  readonly code = "auth_claims_shape_invalid" as const;

  constructor(message: string) {
    super(message);
    this.name = "AuthClaimsShapeError";
  }
}

function isIsoDateTime(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/.test(value)) {
    return false;
  }
  return Number.isFinite(Date.parse(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isStringArray(value: unknown, minItems: number): value is string[] {
  if (!Array.isArray(value) || value.length < minItems) {
    return false;
  }
  return value.every((entry) => isNonEmptyString(entry));
}

/**
 * Structural validation against platform.auth-claims/1.1.0.
 * Throws {@link AuthClaimsShapeError} on failure.
 */
export function assertAuthClaimsShape11(value: unknown): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new AuthClaimsShapeError("AuthClaims must be a non-null object");
  }
  const record = value as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (FORBIDDEN_COMPETING_KEYS.has(key)) {
      throw new AuthClaimsShapeError(`Forbidden competing AuthClaims field: ${key}`);
    }
    if (!CLAIM_KEYS.has(key)) {
      throw new AuthClaimsShapeError(`AuthClaims has unknown property: ${key}`);
    }
  }
  for (const key of REQUIRED_CLAIM_KEYS) {
    if (!(key in record)) {
      throw new AuthClaimsShapeError(`Missing required AuthClaims field: ${key}`);
    }
  }
  if (record.claimContractVersion !== PLATFORM_AUTH_CLAIMS_CONTRACT_VERSION) {
    throw new AuthClaimsShapeError(
      `claimContractVersion must be ${PLATFORM_AUTH_CLAIMS_CONTRACT_VERSION}`,
    );
  }
  if (!isNonEmptyString(record.actorId)) {
    throw new AuthClaimsShapeError("actorId must be a non-empty string");
  }
  if (typeof record.actorKind !== "string" || !ACTOR_KINDS.has(record.actorKind)) {
    throw new AuthClaimsShapeError(
      "actorKind must be one of human|persona|service|adapter|program_executor",
    );
  }
  if (!isNonEmptyString(record.runtimeBindingId)) {
    throw new AuthClaimsShapeError("runtimeBindingId must be a non-empty string");
  }
  if (!isNonEmptyString(record.credentialId)) {
    throw new AuthClaimsShapeError("credentialId must be a non-empty string");
  }
  if (!(record.orgId === null || isNonEmptyString(record.orgId))) {
    throw new AuthClaimsShapeError("orgId must be a non-empty string or null");
  }
  if (record.orgId === null && record.actorKind !== "service") {
    throw new AuthClaimsShapeError("orgId may be null only when actorKind is service");
  }
  if (typeof record.internal !== "boolean") {
    throw new AuthClaimsShapeError("internal must be a boolean");
  }
  if (!isStringArray(record.serviceScopes, 1)) {
    throw new AuthClaimsShapeError("serviceScopes must be a non-empty string array");
  }
  if (!isStringArray(record.permittedOperations, 0)) {
    throw new AuthClaimsShapeError("permittedOperations must be a string array");
  }
  if (!isNonEmptyString(record.issuedAt) || !isIsoDateTime(record.issuedAt)) {
    throw new AuthClaimsShapeError("issuedAt must be an ISO-8601 date-time string");
  }
  if (!isNonEmptyString(record.expiresAt) || !isIsoDateTime(record.expiresAt)) {
    throw new AuthClaimsShapeError("expiresAt must be an ISO-8601 date-time string");
  }
  if (!isNonEmptyString(record.issuer)) {
    throw new AuthClaimsShapeError("issuer must be a non-empty string");
  }
  if (!isStringArray(record.audience, 1)) {
    throw new AuthClaimsShapeError("audience must be a non-empty string array");
  }
  if (!isNonEmptyString(record.correlationId)) {
    throw new AuthClaimsShapeError("correlationId must be a non-empty string");
  }
}

export function isAuthClaimsShape11(value: unknown): boolean {
  try {
    assertAuthClaimsShape11(value);
    return true;
  } catch {
    return false;
  }
}
