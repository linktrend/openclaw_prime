import { parseStrictIsoTimestamp } from "./timestamps.js";

export const PLATFORM_COMMIT = "5452f90a35ed690698a9161117a9d92c69985582" as const;
export const PLATFORM_TREE = "90b51726f7a77e4620151a463a10cfc3d2007c88" as const;
export const PLATFORM_AUTH_CLAIMS_CONTRACT_VERSION = "platform.auth-claims/1.1.0" as const;
export const PLATFORM_AUTH_CLAIMS_SCHEMA_VERSION = "2026.07.28-w4" as const;
export const PLATFORM_PROVIDER_TRUST_CONTRACT_VERSION = "platform.provider-trust/1.0.0" as const;

export const PROVIDER_STATUSES = Object.freeze([
  "available",
  "degraded",
  "offline",
  "unauthorized",
  "forbidden",
  "stale",
  "contract-incompatible",
  "disabled",
] as const);

export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

export type ProviderCandidate = Readonly<{
  commit: string;
  tree: string;
}>;

export type ProviderClaim = Readonly<{
  providerCandidate: ProviderCandidate;
  actorId: string;
  bindingId: string;
  orgId: string;
  audience: string;
  capabilities: readonly string[];
  expiresAt: number;
  status: ProviderStatus;
  bindingRevoked?: boolean;
}>;

export type ExpectedProviderClaim = Readonly<{
  providerCandidate: ProviderCandidate;
  actorId: string;
  bindingId: string;
  orgId: string;
  audience: string;
  capability: string;
  now: number;
}>;

export type ProviderClaimValidation =
  | { readonly valid: true; readonly claim: ProviderClaim }
  | { readonly valid: false; readonly reason: string };

/** Verified facts accepted from Platform. OpenClaw never creates these facts. */
export type PlatformTrustFacts = Readonly<{
  providerCandidate: ProviderCandidate;
  claimContractVersion: typeof PLATFORM_AUTH_CLAIMS_CONTRACT_VERSION;
  schemaVersion: typeof PLATFORM_AUTH_CLAIMS_SCHEMA_VERSION;
  actorId: string;
  orgId: string | null;
  runtimeBindingId: string;
  credentialId: string;
  issuer: string;
  audience: string;
  serviceScopes: readonly string[];
  capabilities: readonly string[];
  issuedAt: string;
  expiresAt: string;
  revocationStatus: "active" | "revoked";
}>;

export type PlatformTrustValidation =
  | { readonly valid: true; readonly facts: PlatformTrustFacts }
  | { readonly valid: false; readonly reason: string };

const REQUIRED_FIELDS = [
  "providerCandidate",
  "actorId",
  "bindingId",
  "orgId",
  "audience",
  "capabilities",
  "expiresAt",
  "status",
] as const;

const ALLOWED_CLAIM_FIELDS = new Set<string>([...REQUIRED_FIELDS, "bindingRevoked"]);
const MAX_CLAIM_STRING_LENGTH = 256;
const MAX_CAPABILITIES = 64;
const MAX_CAPABILITY_LENGTH = 128;

const isBoundedNonEmptyString = (value: unknown, maxLength: number): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= maxLength;

export function validateProviderClaim(
  input: unknown,
  expected: ExpectedProviderClaim,
): ProviderClaimValidation {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, reason: "claim must be an object" };
  }

  const claim = input as Record<string, unknown>;
  for (const field of Object.keys(claim)) {
    if (!ALLOWED_CLAIM_FIELDS.has(field)) {
      return { valid: false, reason: `unknown field ${field}` };
    }
  }
  for (const field of REQUIRED_FIELDS) {
    if (!(field in claim)) {
      return { valid: false, reason: `missing ${field}` };
    }
  }
  if ("modelActorId" in claim) {
    return { valid: false, reason: "modelActorId is forbidden" };
  }

  const candidate = claim.providerCandidate;
  if (
    !candidate ||
    typeof candidate !== "object" ||
    Array.isArray(candidate) ||
    Object.keys(candidate).length !== 2 ||
    !Object.hasOwn(candidate, "commit") ||
    !Object.hasOwn(candidate, "tree") ||
    (candidate as Record<string, unknown>).commit !== PLATFORM_COMMIT ||
    (candidate as Record<string, unknown>).tree !== PLATFORM_TREE ||
    expected.providerCandidate.commit !== PLATFORM_COMMIT ||
    expected.providerCandidate.tree !== PLATFORM_TREE
  ) {
    return { valid: false, reason: "provider candidate mismatch" };
  }

  for (const field of ["actorId", "bindingId", "orgId", "audience"] as const) {
    if (!isBoundedNonEmptyString(claim[field], MAX_CLAIM_STRING_LENGTH)) {
      return { valid: false, reason: `${field} is invalid` };
    }
    if (claim[field] !== expected[field]) {
      return { valid: false, reason: `${field} mismatch` };
    }
  }
  if (
    !Array.isArray(claim.capabilities) ||
    claim.capabilities.length === 0 ||
    claim.capabilities.length > MAX_CAPABILITIES ||
    !claim.capabilities.every((capability) =>
      isBoundedNonEmptyString(capability, MAX_CAPABILITY_LENGTH),
    ) ||
    !claim.capabilities.includes(expected.capability)
  ) {
    return { valid: false, reason: "required capability missing" };
  }
  if (
    !Number.isFinite(expected.now) ||
    typeof claim.expiresAt !== "number" ||
    !Number.isFinite(claim.expiresAt) ||
    claim.expiresAt <= expected.now
  ) {
    return { valid: false, reason: "claim expired" };
  }
  if ("bindingRevoked" in claim && typeof claim.bindingRevoked !== "boolean") {
    return { valid: false, reason: "invalid binding revocation status" };
  }
  if (claim.bindingRevoked === true || claim.status === "unauthorized") {
    return { valid: false, reason: "binding unauthorized or revoked" };
  }
  if (claim.status !== "available") {
    return { valid: false, reason: "invalid status" };
  }

  return {
    valid: true,
    claim: {
      providerCandidate: { commit: PLATFORM_COMMIT, tree: PLATFORM_TREE },
      actorId: claim.actorId as string,
      bindingId: claim.bindingId as string,
      orgId: claim.orgId as string,
      audience: claim.audience as string,
      capabilities: [...(claim.capabilities as string[])],
      expiresAt: claim.expiresAt as number,
      status: claim.status as ProviderStatus,
      ...(claim.bindingRevoked === undefined
        ? {}
        : { bindingRevoked: claim.bindingRevoked as boolean }),
    },
  };
}

const TRUST_KEYS = new Set([
  "providerCandidate",
  "claimContractVersion",
  "schemaVersion",
  "actorId",
  "orgId",
  "runtimeBindingId",
  "credentialId",
  "issuer",
  "audience",
  "serviceScopes",
  "capabilities",
  "issuedAt",
  "expiresAt",
  "revocationStatus",
]);
const TRUST_REF = /^[A-Za-z0-9._:/@-]{1,256}$/;
const isTrustRef = (value: unknown): value is string => {
  if (typeof value !== "string") {
    return false;
  }
  const match = TRUST_REF.exec(value);
  return match?.[0] === value;
};
/** Validates Platform's already-verified trust projection without exposing credential material. */
export function validatePlatformTrustFacts(
  input: unknown,
  expected: {
    actorId: string;
    orgId: string | null;
    runtimeBindingId: string;
    issuer: string;
    audience: string;
    capability: string;
    serviceScope: string;
    revocationObservedAt: string;
    now?: Date | string;
  },
): PlatformTrustValidation {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, reason: "facts must be an object" };
  }
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((key) => !TRUST_KEYS.has(key))) {
    return { valid: false, reason: "unknown trust fact" };
  }
  for (const key of TRUST_KEYS) {
    if (!(key in value)) {
      return { valid: false, reason: `missing ${key}` };
    }
  }
  const candidate = value.providerCandidate;
  if (
    !candidate ||
    typeof candidate !== "object" ||
    Array.isArray(candidate) ||
    (candidate as Record<string, unknown>).commit !== PLATFORM_COMMIT ||
    (candidate as Record<string, unknown>).tree !== PLATFORM_TREE
  ) {
    return { valid: false, reason: "provider candidate mismatch" };
  }
  if (
    value.claimContractVersion !== PLATFORM_AUTH_CLAIMS_CONTRACT_VERSION ||
    value.schemaVersion !== PLATFORM_AUTH_CLAIMS_SCHEMA_VERSION
  ) {
    return { valid: false, reason: "claim contract version mismatch" };
  }
  for (const key of [
    "actorId",
    "runtimeBindingId",
    "credentialId",
    "issuer",
    "audience",
  ] as const) {
    if (!isTrustRef(value[key])) {
      return { valid: false, reason: `${key} is invalid` };
    }
  }
  if (
    value.actorId !== expected.actorId ||
    value.orgId !== expected.orgId ||
    value.runtimeBindingId !== expected.runtimeBindingId ||
    value.issuer !== expected.issuer ||
    value.audience !== expected.audience ||
    value.revocationStatus !== "active"
  ) {
    return { valid: false, reason: "wrong audience or revoked credential" };
  }
  if (value.orgId !== null && !isTrustRef(value.orgId)) {
    return { valid: false, reason: "orgId is invalid" };
  }
  for (const key of ["serviceScopes", "capabilities"] as const) {
    if (
      !Array.isArray(value[key]) ||
      value[key].length === 0 ||
      !value[key].every((item) => isTrustRef(item))
    ) {
      return { valid: false, reason: `${key} is invalid` };
    }
  }
  if (!(value.capabilities as string[]).includes(expected.capability)) {
    return { valid: false, reason: "required capability missing" };
  }
  if (!(value.serviceScopes as string[]).includes(expected.serviceScope)) {
    return { valid: false, reason: "required service scope missing" };
  }
  const now =
    expected.now instanceof Date
      ? expected.now.getTime()
      : parseStrictIsoTimestamp(expected.now ?? new Date().toISOString());
  const revocationObservedAt = parseStrictIsoTimestamp(expected.revocationObservedAt);
  if (
    revocationObservedAt === undefined ||
    now === undefined ||
    !Number.isFinite(revocationObservedAt) ||
    !Number.isFinite(now) ||
    revocationObservedAt > now ||
    now - revocationObservedAt > 5 * 60 * 1000
  ) {
    return { valid: false, reason: "revocation evidence is stale" };
  }
  const issuedAt = parseStrictIsoTimestamp(value.issuedAt);
  const expiresAt = parseStrictIsoTimestamp(value.expiresAt);
  if (issuedAt === undefined || expiresAt === undefined) {
    return { valid: false, reason: "invalid trust timestamps" };
  }
  if (now === undefined || issuedAt > now || expiresAt <= now) {
    return { valid: false, reason: "trust facts expired or not yet issued" };
  }
  return {
    valid: true,
    facts: Object.freeze({
      providerCandidate: Object.freeze({ commit: PLATFORM_COMMIT, tree: PLATFORM_TREE }),
      claimContractVersion: PLATFORM_AUTH_CLAIMS_CONTRACT_VERSION,
      schemaVersion: PLATFORM_AUTH_CLAIMS_SCHEMA_VERSION,
      actorId: value.actorId as string,
      orgId: value.orgId as string | null,
      runtimeBindingId: value.runtimeBindingId as string,
      credentialId: value.credentialId as string,
      issuer: value.issuer as string,
      audience: value.audience as string,
      serviceScopes: Object.freeze([...(value.serviceScopes as string[])]),
      capabilities: Object.freeze([...(value.capabilities as string[])]),
      issuedAt: value.issuedAt as string,
      expiresAt: value.expiresAt as string,
      revocationStatus: "active",
    }),
  };
}
