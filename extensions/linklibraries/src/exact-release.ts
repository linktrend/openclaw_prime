import { createHash } from "node:crypto";
import { LIBRARIES_CATALOGUE_SHA256 } from "./revision2.js";

export const FROZEN_CANDIDATE_SHA = "0efa68b19686e976ecee93c6a962e81d2a0265f5";
export const FROZEN_TREE_SHA = "c42d20b3119ca4bfdd24d4c6b06d6bc7a7f50d4a";

const GIT_SHA = /^[0-9a-f]{40}$/;
const SHA256 = /^sha256:[0-9a-f]{64}$/;

export type InventoryDigest = `sha256:${string}`;

export type CandidateDependency = Readonly<{
  name: string;
  version: string;
  resolved: boolean;
  provenanceRef: string;
}>;

export type Candidate = Readonly<{
  gitSha: string;
  treeSha: string;
  asset: Readonly<{
    releaseSourceCommitSha: string;
    releaseSourceRepositoryTreeSha1: string;
    artifactTreeSha1: string;
    payloadSha256: string;
  }>;
  catalogue: Readonly<{
    inventoryDigest: string;
    current: boolean;
    authorized: boolean;
  }>;
  manifest: Readonly<{
    inventoryDigest: string;
    current: boolean;
    authorized: boolean;
    lifecycle: Readonly<{
      admitted: boolean;
      selectable: boolean;
      state: "admitted" | "selectable" | "withdrawn" | "stale";
    }>;
    supportedConsumerProfiles: readonly string[];
  }>;
  consumerProfile: Readonly<{
    id: string;
    compatible: boolean;
  }>;
  dependencies: Readonly<{
    complete: boolean;
    closureDigest: string;
    entries: readonly CandidateDependency[];
  }>;
  provenance: Readonly<{
    complete: boolean;
    ref: string;
  }>;
  receipt: Readonly<{
    complete: boolean;
    ref: string;
  }>;
}>;

export type ReleaseEvidence = Readonly<{
  candidate: Readonly<{ gitSha: string; treeSha: string }>;
  catalogue: Readonly<{
    inventoryDigest: InventoryDigest;
    current: true;
    authorized: true;
  }>;
  shortlistedManifest: Readonly<{
    inventoryDigest: InventoryDigest;
    lifecycle: Readonly<{ admitted: true; selectable: true; state: "selectable" }>;
    consumerProfile: string;
    dependencyClosureDigest: InventoryDigest;
  }>;
  selectedAsset: Readonly<{
    releaseSourceCommitSha: string;
    releaseSourceRepositoryTreeSha1: string;
    artifactTreeSha1: string;
    payloadSha256: InventoryDigest;
    provenanceRef: string;
    receiptRef: string;
  }>;
}>;

export type ExactReleaseResult =
  | Readonly<{ ok: true; evidence: ReleaseEvidence }>
  | Readonly<{ ok: false; errors: readonly string[] }>;

export type AuthenticatedLibraryAssetEvidence = Readonly<{
  providerCandidate: Readonly<{
    commit: typeof FROZEN_CANDIDATE_SHA;
    tree: typeof FROZEN_TREE_SHA;
  }>;
  catalogueSha256: typeof LIBRARIES_CATALOGUE_SHA256;
  inventoryDigest: InventoryDigest;
  releaseSourceCommitSha: string;
  releaseSourceRepositoryTreeSha1: string;
  artifactTreeSha1: string;
  payloadSha256: InventoryDigest;
  eligibilityDigest: InventoryDigest;
  verified: true;
}>;

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isDigest(value: unknown): value is InventoryDigest {
  return typeof value === "string" && SHA256.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalString(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalString).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .toSorted()
      .map((key) => `${JSON.stringify(key)}:${canonicalString(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function candidateDependencyClosureDigest(
  entries: readonly CandidateDependency[],
): InventoryDigest {
  const snapshot = snapshotPlainData(entries);
  if (!Array.isArray(snapshot)) {
    throw new Error("invalid dependency closure entries");
  }
  return `sha256:${createHash("sha256").update(canonicalString(snapshot)).digest("hex")}`;
}

/** Binds every provider-supplied fact used to admit and select a portable release. */
export function candidateEligibilityDigest(candidate: Candidate): InventoryDigest {
  const snapshot = snapshotPlainData(candidate);
  if (!isRecord(snapshot)) {
    throw new Error("invalid release eligibility evidence");
  }
  return `sha256:${createHash("sha256")
    .update(
      canonicalString({
        catalogue: snapshot.catalogue,
        manifest: snapshot.manifest,
        consumerProfile: snapshot.consumerProfile,
        dependencies: snapshot.dependencies,
        provenance: snapshot.provenance,
        receipt: snapshot.receipt,
      }),
    )
    .digest("hex")}`;
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

const FORBIDDEN_KEYS = new Set(["prompt", "reasoning", "transcript", "secret", "raw_tool"]);

function validateKeys(
  value: Record<string, unknown>,
  path: string,
  allowed: readonly string[],
  errors: string[],
): boolean {
  const allowedKeys = new Set(allowed);
  let valid = true;
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEYS.has(key)) {
      errors.push(`${path}.${key} is forbidden`);
      valid = false;
    } else if (!allowedKeys.has(key)) {
      errors.push(`${path}.${key} is not allowed`);
      valid = false;
    }
  }
  for (const key of allowed) {
    if (!Object.hasOwn(value, key)) {
      errors.push(`${path}.${key} is missing`);
      valid = false;
    }
  }
  return valid;
}

/**
 * Validate externally supplied release evidence only. This function does not
 * admit, select, materialize, or mutate any library asset.
 */
export function validateExactRelease(
  candidate: unknown,
  authenticatedEvidence: AuthenticatedLibraryAssetEvidence,
): ExactReleaseResult {
  const errors: string[] = [];

  let sealed: unknown;
  try {
    sealed = snapshotPlainData(candidate);
  } catch {
    return { ok: false, errors: ["candidate is not immutable plain data"] };
  }

  if (!isRecord(sealed)) {
    return { ok: false, errors: ["candidate is missing"] };
  }
  validateKeys(
    sealed,
    "candidate",
    [
      "gitSha",
      "treeSha",
      "asset",
      "catalogue",
      "manifest",
      "consumerProfile",
      "dependencies",
      "provenance",
      "receipt",
    ],
    errors,
  );
  const input = sealed;
  const asset = isRecord(input.asset) ? input.asset : undefined;
  const catalogue = isRecord(input.catalogue) ? input.catalogue : undefined;
  const manifest = isRecord(input.manifest) ? input.manifest : undefined;
  const profile = isRecord(input.consumerProfile) ? input.consumerProfile : undefined;
  const dependencies = isRecord(input.dependencies) ? input.dependencies : undefined;
  const provenance = isRecord(input.provenance) ? input.provenance : undefined;
  const receipt = isRecord(input.receipt) ? input.receipt : undefined;
  let trustedEvidence: unknown;
  try {
    trustedEvidence = snapshotPlainData(authenticatedEvidence);
  } catch {
    trustedEvidence = undefined;
  }
  if (!isRecord(trustedEvidence)) {
    errors.push("authenticated asset evidence is missing");
  } else {
    validateKeys(
      trustedEvidence,
      "authenticatedEvidence",
      [
        "providerCandidate",
        "catalogueSha256",
        "inventoryDigest",
        "releaseSourceCommitSha",
        "releaseSourceRepositoryTreeSha1",
        "artifactTreeSha1",
        "payloadSha256",
        "eligibilityDigest",
        "verified",
      ],
      errors,
    );
    const trustedCandidate = isRecord(trustedEvidence.providerCandidate)
      ? trustedEvidence.providerCandidate
      : undefined;
    if (
      !trustedCandidate ||
      !validateKeys(
        trustedCandidate,
        "authenticatedEvidence.providerCandidate",
        ["commit", "tree"],
        errors,
      ) ||
      trustedCandidate.commit !== FROZEN_CANDIDATE_SHA ||
      trustedCandidate.tree !== FROZEN_TREE_SHA ||
      trustedEvidence.catalogueSha256 !== LIBRARIES_CATALOGUE_SHA256 ||
      !isDigest(trustedEvidence.eligibilityDigest) ||
      trustedEvidence.verified !== true
    ) {
      errors.push("authenticated asset evidence is invalid");
    }
  }
  if (!isNonEmpty(input.gitSha) || !GIT_SHA.test(input.gitSha)) {
    errors.push("gitSha must be an exact 40-hex SHA");
  }
  if (!isNonEmpty(input.treeSha) || !GIT_SHA.test(input.treeSha)) {
    errors.push("treeSha must be an exact 40-hex tree SHA");
  }
  if (input.gitSha !== FROZEN_CANDIDATE_SHA) {
    errors.push("gitSha is not the frozen candidate");
  }
  if (input.treeSha !== FROZEN_TREE_SHA) {
    errors.push("treeSha is not the frozen candidate tree");
  }

  if (!asset) {
    errors.push("asset identity evidence is incomplete");
  } else {
    validateKeys(
      asset,
      "asset",
      [
        "releaseSourceCommitSha",
        "releaseSourceRepositoryTreeSha1",
        "artifactTreeSha1",
        "payloadSha256",
      ],
      errors,
    );
  }
  if (
    !asset ||
    !isNonEmpty(asset.releaseSourceCommitSha) ||
    !GIT_SHA.test(asset.releaseSourceCommitSha)
  ) {
    errors.push("asset release source commit must be an exact 40-hex SHA");
  }
  if (
    !asset ||
    !isNonEmpty(asset.releaseSourceRepositoryTreeSha1) ||
    !GIT_SHA.test(asset.releaseSourceRepositoryTreeSha1)
  ) {
    errors.push("asset release source tree must be an exact 40-hex SHA");
  }
  if (!asset || !isNonEmpty(asset.artifactTreeSha1) || !GIT_SHA.test(asset.artifactTreeSha1)) {
    errors.push("asset artifact tree must be an exact 40-hex SHA");
  }
  if (!asset || !isDigest(asset.payloadSha256)) {
    errors.push("asset payload digest is invalid");
  }
  if (
    trustedEvidence &&
    isRecord(trustedEvidence) &&
    asset &&
    (trustedEvidence.releaseSourceCommitSha !== asset.releaseSourceCommitSha ||
      trustedEvidence.releaseSourceRepositoryTreeSha1 !== asset.releaseSourceRepositoryTreeSha1 ||
      trustedEvidence.artifactTreeSha1 !== asset.artifactTreeSha1 ||
      trustedEvidence.payloadSha256 !== asset.payloadSha256)
  ) {
    errors.push("selected asset does not match authenticated provider evidence");
  }

  if (!catalogue) {
    errors.push("catalogue evidence is incomplete");
  } else {
    validateKeys(catalogue, "catalogue", ["inventoryDigest", "current", "authorized"], errors);
  }
  if (catalogue && !isDigest(catalogue.inventoryDigest)) {
    errors.push("catalogue inventory digest is invalid");
  }
  if (
    trustedEvidence &&
    isRecord(trustedEvidence) &&
    catalogue &&
    trustedEvidence.inventoryDigest !== catalogue.inventoryDigest
  ) {
    errors.push("catalogue inventory does not match authenticated provider evidence");
  }
  if (catalogue && catalogue.current !== true) {
    errors.push("catalogue is stale");
  }
  if (catalogue && catalogue.authorized !== true) {
    errors.push("catalogue is unauthorized");
  }
  if (!manifest) {
    errors.push("manifest evidence is incomplete");
  } else {
    validateKeys(
      manifest,
      "manifest",
      ["inventoryDigest", "current", "authorized", "lifecycle", "supportedConsumerProfiles"],
      errors,
    );
  }
  if (manifest && !isDigest(manifest.inventoryDigest)) {
    errors.push("manifest inventory digest is invalid");
  }
  if (
    catalogue &&
    manifest &&
    isDigest(catalogue.inventoryDigest) &&
    isDigest(manifest.inventoryDigest) &&
    manifest.inventoryDigest !== catalogue.inventoryDigest
  ) {
    errors.push("manifest inventory digest does not match catalogue");
  }
  if (manifest && manifest.current !== true) {
    errors.push("manifest is stale");
  }
  if (manifest && manifest.authorized !== true) {
    errors.push("manifest is unauthorized");
  }
  const lifecycle = manifest && isRecord(manifest.lifecycle) ? manifest.lifecycle : undefined;
  if (!lifecycle) {
    errors.push("manifest lifecycle is missing");
  } else {
    validateKeys(lifecycle, "manifest.lifecycle", ["admitted", "selectable", "state"], errors);
    if (lifecycle.admitted !== true) {
      errors.push("manifest is not admitted");
    }
  }
  if (!lifecycle || lifecycle.selectable !== true || lifecycle.state !== "selectable") {
    errors.push("manifest is not selectable");
  }

  if (!profile) {
    errors.push("consumer profile evidence is incomplete");
  } else {
    validateKeys(profile, "consumerProfile", ["id", "compatible"], errors);
  }
  if (!profile || !isNonEmpty(profile.id)) {
    errors.push("consumer profile is missing");
  }
  if (!profile || profile.compatible !== true) {
    errors.push("consumer profile is incompatible");
  }
  if (
    !manifest ||
    !Array.isArray(manifest.supportedConsumerProfiles) ||
    !manifest.supportedConsumerProfiles.every(isNonEmpty) ||
    !profile ||
    !isNonEmpty(profile.id) ||
    !manifest.supportedConsumerProfiles.includes(profile.id)
  ) {
    errors.push("consumer profile is not supported by the manifest");
  }

  if (!dependencies) {
    errors.push("dependencies evidence is incomplete");
  } else {
    validateKeys(dependencies, "dependencies", ["complete", "closureDigest", "entries"], errors);
  }
  if (!dependencies || dependencies.complete !== true) {
    errors.push("dependency closure is incomplete");
  }
  if (dependencies && !isDigest(dependencies.closureDigest)) {
    errors.push("dependency closure digest is invalid");
  }
  if (!dependencies || !Array.isArray(dependencies.entries)) {
    errors.push("dependency closure is empty");
  }
  for (const dependency of dependencies && Array.isArray(dependencies.entries)
    ? dependencies.entries
    : []) {
    if (!isRecord(dependency)) {
      errors.push("dependency entry is incomplete");
      continue;
    }
    validateKeys(
      dependency,
      "dependencies.entries[]",
      ["name", "version", "resolved", "provenanceRef"],
      errors,
    );
    if (!isNonEmpty(dependency.name) || !isNonEmpty(dependency.version)) {
      errors.push("dependency entry is incomplete");
    }
    const dependencyName = isNonEmpty(dependency.name) ? dependency.name : "<unknown>";
    if (dependency.resolved !== true) {
      errors.push(`dependency ${dependencyName} is unresolved`);
    }
    if (!isNonEmpty(dependency.provenanceRef)) {
      errors.push(`dependency ${dependencyName} lacks provenance`);
    }
  }
  if (
    dependencies &&
    Array.isArray(dependencies.entries) &&
    dependencies.entries.every(
      (dependency): dependency is CandidateDependency =>
        isRecord(dependency) &&
        isNonEmpty(dependency.name) &&
        isNonEmpty(dependency.version) &&
        dependency.resolved === true &&
        isNonEmpty(dependency.provenanceRef),
    ) &&
    dependencies.closureDigest !== candidateDependencyClosureDigest(dependencies.entries)
  ) {
    errors.push("dependency closure digest does not match entries");
  }

  if (!provenance) {
    errors.push("provenance evidence is incomplete");
  } else {
    validateKeys(provenance, "provenance", ["complete", "ref"], errors);
  }
  if (!provenance || provenance.complete !== true || !isNonEmpty(provenance.ref)) {
    errors.push("provenance receipt reference is incomplete");
  }
  if (!receipt) {
    errors.push("receipt evidence is incomplete");
  } else {
    validateKeys(receipt, "receipt", ["complete", "ref"], errors);
  }
  if (!receipt || receipt.complete !== true || !isNonEmpty(receipt.ref)) {
    errors.push("admission receipt reference is incomplete");
  }

  if (
    trustedEvidence &&
    isRecord(trustedEvidence) &&
    trustedEvidence.eligibilityDigest !== candidateEligibilityDigest(input as unknown as Candidate)
  ) {
    errors.push("release eligibility does not match authenticated provider evidence");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    evidence: {
      candidate: { gitSha: input.gitSha as string, treeSha: input.treeSha as string },
      catalogue: {
        inventoryDigest: catalogue!.inventoryDigest as InventoryDigest,
        current: true,
        authorized: true,
      },
      shortlistedManifest: {
        inventoryDigest: manifest!.inventoryDigest as InventoryDigest,
        lifecycle: { admitted: true, selectable: true, state: "selectable" },
        consumerProfile: profile!.id as string,
        dependencyClosureDigest: dependencies!.closureDigest as InventoryDigest,
      },
      selectedAsset: {
        releaseSourceCommitSha: asset!.releaseSourceCommitSha as string,
        releaseSourceRepositoryTreeSha1: asset!.releaseSourceRepositoryTreeSha1 as string,
        artifactTreeSha1: asset!.artifactTreeSha1 as string,
        payloadSha256: asset!.payloadSha256 as InventoryDigest,
        provenanceRef: provenance!.ref as string,
        receiptRef: receipt!.ref as string,
      },
    },
  };
}
