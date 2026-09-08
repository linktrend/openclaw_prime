/** Pure, fail-closed validation for provider-supplied Skills releases. */

import { createHash } from "node:crypto";

export const SKILLS_COMMIT = "6269cb173a7c9e0170b29f35c539343c29eab795" as const;
export const SKILLS_TREE = "6c36e6c98f90e55d957fba781327b1b0ef90860a" as const;
export const SKILLS_MCP_PROTOCOL_VERSION = "2026-07-28" as const;
export const SKILLS_CONTRACT_VERSION = "skills.api.v0.2" as const;
export const SKILLS_RELEASE_CONTRACT_VERSION = "skills-release/0.2" as const;

export type ExactReleaseLifecycle = "qualified";
export type ExactReleaseState = "available";
export type ExactReleaseStage = "index" | "description" | "fragments" | "exact_release";

export type ReleaseAttestation = Readonly<{
  issuer: string;
  digest: string;
  evaluated_at: string;
  valid_until: string;
}>;

export type ExactRelease = Readonly<{
  release_id: string;
  version: string;
  providerCandidate: Readonly<{
    commit: typeof SKILLS_COMMIT;
    tree: typeof SKILLS_TREE;
  }>;
  manifest_digest: string;
  package_digest: string;
  lifecycle: ExactReleaseLifecycle;
  state: ExactReleaseState;
  compatible_profiles: readonly string[];
  attestation: ReleaseAttestation;
  issued_at: string;
  expires_at: string;
}>;

export type ExactReleaseValidationOptions = {
  profile: string;
  expectedSkillId: string;
  expectedVersion: string;
  expectedOrganization: string;
  expectedAudience: string;
  expectedCapability: string;
  authenticatedProviderEvidence: AuthenticatedSkillsReleaseEvidence;
  now?: Date | string;
  maxAgeMs?: number;
};

export type AuthenticatedSkillsReleaseEvidence = Readonly<{
  providerCandidate: Readonly<{ commit: typeof SKILLS_COMMIT; tree: typeof SKILLS_TREE }>;
  contractVersion: typeof SKILLS_RELEASE_CONTRACT_VERSION;
  releaseId: string;
  version: string;
  manifestDigest: string;
  packageDigest: string;
  eligibilityDigest: string;
  attestationVerified: true;
  algorithm: "ES256";
  keyId: string;
  organization: string;
  audience: string;
  capability: string;
}>;

export type ExactReleaseTelemetry = {
  outcome: "accepted" | "rejected";
  release_id?: string;
  version?: string;
  reason?: ExactReleaseRejectionCode;
};

export type ExactReleaseRejectionCode =
  | "invalid_shape"
  | "latest_alias"
  | "invalid_digest"
  | "invalid_lifecycle"
  | "invalid_state"
  | "incompatible_profile"
  | "missing_attestation"
  | "stale_timestamp"
  | "invalid_timestamp"
  | "invalid_provider_candidate"
  | "invalid_provider_evidence"
  | "invalid_immutability";

export type ExactReleaseValidation =
  | { ok: true; release: ExactRelease; telemetry: ExactReleaseTelemetry }
  | { ok: false; code: ExactReleaseRejectionCode; telemetry: ExactReleaseTelemetry };

export type ProgressiveReleaseState = {
  stage: ExactReleaseStage;
  release_id?: string;
  version?: string;
  manifest_digest?: string;
  package_digest?: string;
};

const DIGEST = /^sha256:[0-9a-f]{64}$/;
const NON_EMPTY = /^[^\s]+$/;
const MOVING_RELEASE_ALIAS = /^(latest|current|stable|newest)$/iu;
const STAGES: readonly ExactReleaseStage[] = ["index", "description", "fragments", "exact_release"];
const isDigest = (value: unknown): value is string =>
  typeof value === "string" && DIGEST.test(value);
const RELEASE_KEYS = new Set([
  "release_id",
  "version",
  "providerCandidate",
  "manifest_digest",
  "package_digest",
  "lifecycle",
  "state",
  "compatible_profiles",
  "attestation",
  "issued_at",
  "expires_at",
]);
const ATTESTATION_KEYS = new Set(["issuer", "digest", "evaluated_at", "valid_until"]);
const PROVIDER_CANDIDATE_KEYS = new Set(["commit", "tree"]);
const PROVIDER_EVIDENCE_KEYS = new Set([
  "providerCandidate",
  "contractVersion",
  "releaseId",
  "version",
  "manifestDigest",
  "packageDigest",
  "eligibilityDigest",
  "attestationVerified",
  "algorithm",
  "keyId",
  "organization",
  "audience",
  "capability",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function snapshotPlainData(value: unknown, seen = new WeakSet<object>()): unknown {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value !== "object" || seen.has(value)) {
    throw new Error("invalid_plain_data");
  }
  seen.add(value);
  try {
    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw new Error("invalid_plain_data");
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) {
        throw new Error("invalid_plain_data");
      }
      const length = descriptors.length?.value;
      if (!Number.isSafeInteger(length) || length < 0) {
        throw new Error("invalid_plain_data");
      }
      const snapshot: unknown[] = [];
      for (let index = 0; index < length; index += 1) {
        const descriptor = descriptors[String(index)];
        if (!descriptor || !("value" in descriptor)) {
          throw new Error("invalid_plain_data");
        }
        snapshot.push(snapshotPlainData(descriptor.value, seen));
      }
      if (Object.keys(descriptors).some((key) => key !== "length" && !/^\d+$/u.test(key))) {
        throw new Error("invalid_plain_data");
      }
      return snapshot;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error("invalid_plain_data");
    }
    const snapshot = Object.create(null) as Record<string, unknown>;
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (!("value" in descriptor)) {
        throw new Error("invalid_plain_data");
      }
      snapshot[key] = snapshotPlainData(descriptor.value, seen);
    }
    return snapshot;
  } finally {
    seen.delete(value);
  }
}

function isString(value: unknown): value is string {
  return (
    typeof value === "string" && value.length > 0 && value.length <= 256 && NON_EMPTY.test(value)
  );
}

function parseTime(value: unknown): number | undefined {
  if (!isString(value)) {
    return undefined;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/u.exec(value);
  if (!match) {
    return undefined;
  }
  const time = Date.parse(value);
  if (!Number.isFinite(time)) {
    return undefined;
  }
  const date = new Date(time);
  return date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() + 1 === Number(match[2]) &&
    date.getUTCDate() === Number(match[3]) &&
    date.getUTCHours() === Number(match[4]) &&
    date.getUTCMinutes() === Number(match[5]) &&
    date.getUTCSeconds() === Number(match[6])
    ? time
    : undefined;
}

function hasOnlyKeys(record: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(record).every((key) => allowed.has(key));
}

function hasExactKeys(record: Record<string, unknown>, expected: Set<string>): boolean {
  return Object.keys(record).length === expected.size && hasOnlyKeys(record, expected);
}

function canonical(value: unknown): unknown {
  return Array.isArray(value)
    ? value.map(canonical)
    : isRecord(value)
      ? Object.fromEntries(
          Object.entries(value)
            .toSorted(([left], [right]) => left.localeCompare(right))
            .map(([key, child]) => [key, canonical(child)]),
        )
      : value;
}

/** Matches LiNKskills' immutable package digest claim construction. */
function expectedPackageDigest(release: { release_id: string; manifest_digest: string }): string {
  return `sha256:${createHash("sha256")
    .update(
      JSON.stringify(
        canonical({
          release_id: release.release_id,
          files_digest: release.manifest_digest,
          contract_version: SKILLS_RELEASE_CONTRACT_VERSION,
        }),
      ),
    )
    .digest("hex")}`;
}

/** Binds every provider-supplied fact used to decide whether an exact release is eligible now. */
function expectedEligibilityDigest(release: ExactRelease): string {
  return `sha256:${createHash("sha256")
    .update(
      JSON.stringify(
        canonical({
          release_id: release.release_id,
          version: release.version,
          provider_candidate: release.providerCandidate,
          manifest_digest: release.manifest_digest,
          package_digest: release.package_digest,
          lifecycle: release.lifecycle,
          state: release.state,
          compatible_profiles: release.compatible_profiles,
          attestation: release.attestation,
          issued_at: release.issued_at,
          expires_at: release.expires_at,
        }),
      ),
    )
    .digest("hex")}`;
}

function reject(
  code: ExactReleaseRejectionCode,
  release?: Partial<ExactRelease>,
): ExactReleaseValidation {
  return {
    ok: false,
    code,
    telemetry: {
      outcome: "rejected",
      ...(isString(release?.release_id) ? { release_id: release.release_id } : {}),
      ...(isString(release?.version) ? { version: release.version } : {}),
      reason: code,
    },
  };
}

/** Validates an exact provider release without selecting, fetching, or executing anything. */
export function validateExactRelease(
  value: unknown,
  options: ExactReleaseValidationOptions,
): ExactReleaseValidation {
  let snapshot: unknown;
  try {
    snapshot = snapshotPlainData(value);
  } catch {
    return reject("invalid_shape");
  }
  let optionDescriptors: PropertyDescriptorMap;
  try {
    optionDescriptors = Object.getOwnPropertyDescriptors(options);
  } catch {
    return reject("invalid_provider_evidence");
  }
  const ownOption = (key: keyof ExactReleaseValidationOptions): unknown => {
    const descriptor = optionDescriptors[key];
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  };
  const profile = ownOption("profile");
  const expectedSkillId = ownOption("expectedSkillId");
  const expectedVersion = ownOption("expectedVersion");
  const expectedOrganization = ownOption("expectedOrganization");
  const expectedAudience = ownOption("expectedAudience");
  const expectedCapability = ownOption("expectedCapability");
  if (
    !isRecord(snapshot) ||
    !isString(profile) ||
    !isString(expectedSkillId) ||
    !isString(expectedVersion) ||
    !isString(expectedOrganization) ||
    !isString(expectedAudience) ||
    !isString(expectedCapability)
  ) {
    return reject("invalid_provider_evidence");
  }
  const release = snapshot as Partial<ExactRelease>;
  if (!hasOnlyKeys(snapshot, RELEASE_KEYS)) {
    return reject("invalid_shape", release);
  }
  if (!isString(release.release_id) || !isString(release.version)) {
    return reject("invalid_shape", release);
  }
  if (
    /^(latest|current|stable|newest)$/i.test(release.release_id) ||
    /^(latest|current|stable|newest)$/i.test(release.version)
  ) {
    return reject("latest_alias", release);
  }
  if (
    release.release_id !== `${expectedSkillId}@${expectedVersion}` ||
    release.version !== expectedVersion
  ) {
    return reject("invalid_immutability", release);
  }
  if (
    !isRecord(release.providerCandidate) ||
    !hasOnlyKeys(release.providerCandidate, PROVIDER_CANDIDATE_KEYS) ||
    release.providerCandidate.commit !== SKILLS_COMMIT ||
    release.providerCandidate.tree !== SKILLS_TREE
  ) {
    return reject("invalid_provider_candidate", release);
  }
  if (!isDigest(release.manifest_digest) || !isDigest(release.package_digest)) {
    return reject("invalid_digest", release);
  }
  if (release.manifest_digest === release.package_digest) {
    return reject("invalid_immutability", release);
  }
  const releaseId = release.release_id as string;
  const version = release.version as string;
  const manifestDigest = release.manifest_digest as string;
  const releaseIdSeparator = releaseId.lastIndexOf("@");
  if (releaseIdSeparator < 1 || releaseId.slice(releaseIdSeparator + 1) !== version) {
    return reject("invalid_immutability", release);
  }
  if (
    release.package_digest !==
    expectedPackageDigest({
      release_id: releaseId,
      manifest_digest: manifestDigest,
    })
  ) {
    return reject("invalid_digest", release);
  }
  let providerEvidence: unknown;
  try {
    providerEvidence = snapshotPlainData(ownOption("authenticatedProviderEvidence"));
  } catch {
    return reject("invalid_provider_evidence", release);
  }
  if (
    !isRecord(providerEvidence) ||
    !hasExactKeys(providerEvidence, PROVIDER_EVIDENCE_KEYS) ||
    !isRecord(providerEvidence.providerCandidate) ||
    !hasExactKeys(providerEvidence.providerCandidate, PROVIDER_CANDIDATE_KEYS) ||
    providerEvidence.providerCandidate.commit !== SKILLS_COMMIT ||
    providerEvidence.providerCandidate.tree !== SKILLS_TREE ||
    providerEvidence.contractVersion !== SKILLS_RELEASE_CONTRACT_VERSION ||
    providerEvidence.releaseId !== release.release_id ||
    providerEvidence.version !== release.version ||
    providerEvidence.manifestDigest !== release.manifest_digest ||
    providerEvidence.packageDigest !== release.package_digest ||
    !isDigest(providerEvidence.eligibilityDigest) ||
    providerEvidence.attestationVerified !== true ||
    providerEvidence.algorithm !== "ES256" ||
    !isString(providerEvidence.keyId) ||
    providerEvidence.organization !== expectedOrganization ||
    providerEvidence.audience !== expectedAudience ||
    providerEvidence.capability !== expectedCapability
  ) {
    return reject("invalid_provider_evidence", release);
  }
  if (release.lifecycle !== "qualified") {
    return reject("invalid_lifecycle", release);
  }
  if (release.state !== "available") {
    return reject("invalid_state", release);
  }
  if (!Array.isArray(release.compatible_profiles) || !release.compatible_profiles.every(isString)) {
    return reject("incompatible_profile", release);
  }
  if (!release.compatible_profiles.includes(profile)) {
    return reject("incompatible_profile", release);
  }
  if (!isRecord(release.attestation) || !hasOnlyKeys(release.attestation, ATTESTATION_KEYS)) {
    return reject("missing_attestation", release);
  }
  const attestation = release.attestation as Partial<ReleaseAttestation>;
  if (
    attestation.issuer !== "librarian" ||
    attestation.digest !== release.manifest_digest ||
    !isDigest(attestation.digest)
  ) {
    return reject("missing_attestation", release);
  }
  const configuredNow = ownOption("now");
  let now: number | undefined;
  try {
    now =
      configuredNow === undefined
        ? Date.now()
        : configuredNow instanceof Date
          ? Date.prototype.getTime.call(configuredNow)
          : parseTime(configuredNow);
  } catch {
    now = undefined;
  }
  const issuedAt = parseTime(release.issued_at);
  const expiresAt = parseTime(release.expires_at);
  const evaluatedAt = parseTime(attestation.evaluated_at);
  const attestationValidUntil = parseTime(attestation.valid_until);
  if (
    now === undefined ||
    !Number.isFinite(now) ||
    issuedAt === undefined ||
    expiresAt === undefined ||
    evaluatedAt === undefined ||
    attestationValidUntil === undefined
  ) {
    return reject("invalid_timestamp", release);
  }
  const configuredMaxAge = ownOption("maxAgeMs");
  const maxAge = configuredMaxAge ?? 24 * 60 * 60 * 1000;
  if (typeof maxAge !== "number" || !Number.isFinite(maxAge) || maxAge < 0) {
    return reject("invalid_timestamp", release);
  }
  if (
    issuedAt > now ||
    expiresAt <= now ||
    evaluatedAt > now ||
    attestationValidUntil <= now ||
    now - issuedAt > maxAge ||
    now - evaluatedAt > maxAge
  ) {
    return reject("stale_timestamp", release);
  }
  if (providerEvidence.eligibilityDigest !== expectedEligibilityDigest(release as ExactRelease)) {
    return reject("invalid_provider_evidence", release);
  }
  const exact: ExactRelease = {
    release_id: release.release_id,
    version: release.version,
    providerCandidate: Object.freeze({ commit: SKILLS_COMMIT, tree: SKILLS_TREE }),
    manifest_digest: release.manifest_digest as string,
    package_digest: release.package_digest as string,
    lifecycle: "qualified",
    state: "available",
    compatible_profiles: Object.freeze([...release.compatible_profiles]),
    attestation: Object.freeze({
      issuer: attestation.issuer,
      digest: attestation.digest as string,
      evaluated_at: attestation.evaluated_at as string,
      valid_until: attestation.valid_until as string,
    }),
    issued_at: release.issued_at as string,
    expires_at: release.expires_at as string,
  };
  return {
    ok: true,
    release: Object.freeze(exact),
    telemetry: { outcome: "accepted", release_id: exact.release_id, version: exact.version },
  };
}

/** Allows only index -> description -> fragments -> exact release, bound to one release identity. */
export function validateProgressiveReleaseTransition(
  previous: ProgressiveReleaseState | undefined,
  next: ProgressiveReleaseState,
): boolean {
  let sealedPrevious: ProgressiveReleaseState | undefined;
  let sealedNext: ProgressiveReleaseState;
  try {
    sealedPrevious = snapshotPlainData(previous) as ProgressiveReleaseState | undefined;
    sealedNext = snapshotPlainData(next) as ProgressiveReleaseState;
  } catch {
    return false;
  }
  const allowedByStage: Record<ExactReleaseStage, readonly string[]> = {
    index: ["stage", "release_id", "version"],
    description: ["stage", "release_id", "version"],
    fragments: ["stage", "release_id", "version", "manifest_digest"],
    exact_release: ["stage", "release_id", "version", "manifest_digest", "package_digest"],
  };
  const validState = (state: ProgressiveReleaseState): boolean => {
    if (
      !isRecord(state) ||
      typeof state.stage !== "string" ||
      !STAGES.includes(state.stage as ExactReleaseStage)
    ) {
      return false;
    }
    const stage = state.stage as ExactReleaseStage;
    if (Object.keys(state).some((key) => !allowedByStage[stage].includes(key))) {
      return false;
    }
    if (
      !isString(state.release_id) ||
      !isString(state.version) ||
      MOVING_RELEASE_ALIAS.test(state.release_id) ||
      MOVING_RELEASE_ALIAS.test(state.version) ||
      state.release_id.lastIndexOf("@") < 1 ||
      state.release_id.slice(state.release_id.lastIndexOf("@") + 1) !== state.version
    ) {
      return false;
    }
    if (stage === "fragments" || stage === "exact_release") {
      if (!isDigest(state.manifest_digest)) {
        return false;
      }
    }
    if (stage === "exact_release" && !isDigest(state.package_digest)) {
      return false;
    }
    return true;
  };
  if (!validState(sealedNext)) {
    return false;
  }
  if (sealedPrevious && !validState(sealedPrevious)) {
    return false;
  }
  if (!sealedPrevious && sealedNext.stage !== "index") {
    return false;
  }
  if (
    sealedPrevious &&
    STAGES.indexOf(sealedNext.stage) !== STAGES.indexOf(sealedPrevious.stage) + 1
  ) {
    return false;
  }
  if (sealedPrevious) {
    for (const key of ["release_id", "version", "manifest_digest", "package_digest"] as const) {
      if (sealedPrevious[key] !== undefined && sealedNext[key] !== sealedPrevious[key]) {
        return false;
      }
    }
  }
  return true;
}

export function exactReleaseTelemetry(value: ExactReleaseValidation): ExactReleaseTelemetry {
  return value.telemetry;
}
