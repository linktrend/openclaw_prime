import { createHash } from "node:crypto";

export {
  LIBRARIES_COMMIT,
  LIBRARIES_TREE,
  LIBRARIES_SCHEMA_VERSION,
  LIBRARIES_SCHEMA_REVISION,
  LIBRARIES_SCHEMA_VERSION_LABEL,
  LIBRARIES_CONTRACT_VERSION,
  LIBRARIES_CATALOGUE_SHA256,
  type Digest,
  type Revision2Record,
  type Revision2Page,
  type AuthenticatedRevision2PageEvidence,
  type Revision2Validation,
  type ExactRevision2Bundle,
  type AuthenticatedRevision2CatalogueEvidence,
  type VerifiedConsumerMaterializationEvidence,
} from "./revision2-pins.js";

import {
  LIBRARIES_COMMIT,
  LIBRARIES_TREE,
  LIBRARIES_CATALOGUE_SHA256,
  type Revision2Record,
  type Revision2Page,
  type AuthenticatedRevision2PageEvidence,
  type Revision2Validation,
  type AuthenticatedRevision2CatalogueEvidence,
  type VerifiedConsumerMaterializationEvidence,
} from "./revision2-pins.js";

const SHA1 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const BUNDLE_PATH =
  /^registry\/v2\/entries\/[a-z0-9]+(?:-[a-z0-9]+)*\/versions\/(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const ARTIFACT_TYPES = new Set(["component", "starter_kit", "website_template"]);
const LIFECYCLE_VALUES = new Set([
  "draft",
  "qualified",
  "admitted",
  "selectable",
  "deprecated",
  "withdrawn",
  "quarantined",
  "rejected",
  "superseded",
]);
const SELECTABILITY_VALUES = new Set(["selectable", "conditionally_selectable", "non_selectable"]);
const COMPATIBILITY_VALUES = new Set([
  "compatible",
  "conditionally_compatible",
  "incompatible",
  "unknown",
  "not_applicable",
]);
const RECORD_KEYS = new Set([
  "schemaVersion",
  "schemaRevision",
  "recordType",
  "entryId",
  "version",
  "artifactType",
  "releaseManifestSha256",
  "releaseSource",
  "artifactTreeSha1",
  "inventorySha256",
  "lifecycle",
  "selectability",
  "compatibility",
  "bundlePath",
]);
const BUNDLE_KEYS = new Set([
  "source",
  "catalogue",
  "record",
  "manifest",
  "inventorySha256",
  "dependencyLockSha256",
  "verifiedCache",
  "consumption",
]);
const PROVIDER_SOURCE_KEYS = new Set(["commit", "tree"]);
const CATALOGUE_KEYS = new Set([
  "schemaVersion",
  "schemaRevision",
  "catalogueType",
  "catalogueSha256",
  "recordsSha256",
  "records",
]);
const MANIFEST_KEYS = new Set([
  "releaseId",
  "entryId",
  "version",
  "releaseSource",
  "artifactTreeSha1",
  "payloadSha256",
  "inventorySha256",
  "dependencyLockSha256",
]);
const CACHE_KEYS = new Set([
  "sourceEvidence",
  "releaseSource",
  "catalogueSha256",
  "catalogueRecordsSha256",
  "entryId",
  "version",
  "releaseManifestSha256",
  "inventorySha256",
  "payloadSha256",
  "artifactTreeSha1",
]);
const SOURCE_EVIDENCE_KEYS = new Set([
  "selectedRepositoryCommitSha",
  "selectedRepositoryTreeSha1",
  "immutable",
]);
const CONSUMPTION_KEYS = new Set([
  "receiptType",
  "result",
  "entryId",
  "version",
  "releaseManifestSha256",
  "releaseSourceCommitSha",
  "releaseSourceRepositoryTreeSha1",
  "artifactTreeSha1",
  "consumerMaterializedTreeSha1",
]);
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const hasExactKeys = (value: Record<string, unknown>, expected: ReadonlySet<string>): boolean =>
  Object.keys(value).length === expected.size &&
  Object.keys(value).every((key) => expected.has(key));
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
const digest = (value: unknown): value is string =>
  typeof value === "string" &&
  (value.startsWith("sha256:") ? SHA256.test(value.slice(7)) : SHA256.test(value));
const source = (value: unknown): value is Revision2Record["releaseSource"] =>
  isObject(value) &&
  Object.keys(value).length === 2 &&
  typeof value.releaseSourceCommitSha === "string" &&
  SHA1.test(value.releaseSourceCommitSha) &&
  typeof value.releaseSourceRepositoryTreeSha1 === "string" &&
  SHA1.test(value.releaseSourceRepositoryTreeSha1);

function canonical(value: unknown): unknown {
  return Array.isArray(value)
    ? value.map(canonical)
    : isObject(value)
      ? Object.fromEntries(
          Object.entries(value)
            .toSorted(([a], [b]) => a.localeCompare(b))
            .map(([key, child]) => [key, canonical(child)]),
        )
      : value;
}

const hasControlCharacters = (value: string): boolean => {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
};
const boundedText = (value: unknown, max: number): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= max &&
  !hasControlCharacters(value);

export function canonicalDigest(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex")}`;
}

const normalizedSha256 = (value: string): string =>
  value.startsWith("sha256:") ? value : `sha256:${value}`;
const canonicalRecordDigest = (value: Revision2Record): string =>
  canonicalDigest({
    ...value,
    releaseManifestSha256: normalizedSha256(value.releaseManifestSha256),
    inventorySha256: normalizedSha256(value.inventorySha256),
  });

export function pageCatalogue(
  records: readonly Revision2Record[],
  input: { commit: string; tree: string; snapshot: string; cursor?: string; limit?: number },
  authenticatedEvidence: AuthenticatedRevision2PageEvidence,
): Revision2Page {
  let trusted: unknown;
  let pageInput: unknown;
  let sealedRecords: readonly Revision2Record[];
  try {
    sealedRecords = snapshotPlainData(records) as readonly Revision2Record[];
    trusted = snapshotPlainData(authenticatedEvidence);
    pageInput = snapshotPlainData(input);
  } catch {
    throw new Error("invalid authenticated catalogue evidence");
  }
  if (
    !isObject(pageInput) ||
    Object.keys(pageInput).some(
      (key) => !["commit", "tree", "snapshot", "cursor", "limit"].includes(key),
    )
  ) {
    throw new Error("invalid page input");
  }
  const trustedSource = isObject(trusted) && isObject(trusted.source) ? trusted.source : undefined;
  if (
    !Array.isArray(sealedRecords) ||
    !isObject(trusted) ||
    Object.keys(trusted).toSorted().join(",") !==
      "catalogueSha256,recordsSha256,snapshot,source,verified" ||
    !trustedSource ||
    Object.keys(trustedSource).toSorted().join(",") !== "commit,tree" ||
    trustedSource.commit !== LIBRARIES_COMMIT ||
    trustedSource.tree !== LIBRARIES_TREE ||
    trusted.catalogueSha256 !== LIBRARIES_CATALOGUE_SHA256 ||
    !digest(trusted.recordsSha256) ||
    normalizedSha256(trusted.recordsSha256 as string) !== canonicalDigest(sealedRecords) ||
    trusted.snapshot !== pageInput.snapshot ||
    trusted.verified !== true
  ) {
    throw new Error("invalid authenticated catalogue evidence");
  }
  if (pageInput.commit !== LIBRARIES_COMMIT || pageInput.tree !== LIBRARIES_TREE) {
    throw new Error("wrong Libraries source");
  }
  const requestedLimit = pageInput.limit;
  if (
    requestedLimit !== undefined &&
    (typeof requestedLimit !== "number" ||
      !Number.isInteger(requestedLimit) ||
      requestedLimit < 1 ||
      requestedLimit > 50)
  ) {
    throw new Error("invalid page limit");
  }
  if (!boundedText(pageInput.snapshot, 512)) {
    throw new Error("invalid catalogue snapshot");
  }
  const snapshot = pageInput.snapshot;
  let offset = 0;
  if (pageInput.cursor !== undefined) {
    const prefix = `snapshot:${snapshot}:`;
    if (!boundedText(pageInput.cursor, 600) || !pageInput.cursor.startsWith(prefix)) {
      throw new Error("stale catalogue cursor");
    }
    const offsetText = pageInput.cursor.slice(prefix.length);
    if (!/^\d+$/u.test(offsetText)) {
      throw new Error("stale catalogue cursor");
    }
    offset = Number(offsetText);
    if (!Number.isSafeInteger(offset)) {
      throw new Error("stale catalogue cursor");
    }
  }
  const limit = requestedLimit ?? 25;
  const ordered = [...sealedRecords]
    .map((record) => {
      const result = validateRevision2Record(record);
      if (!result.ok) {
        throw new Error(`invalid catalogue record: ${result.reason}`);
      }
      return result.record;
    })
    .filter(
      (record) =>
        record.lifecycle === "admitted" &&
        record.selectability === "selectable" &&
        record.compatibility === "compatible",
    )
    .toSorted((a, b) => {
      const left = `${a.entryId}@${a.version}`;
      const right = `${b.entryId}@${b.version}`;
      return left < right ? -1 : left > right ? 1 : 0;
    });
  const page = ordered.slice(offset, offset + limit);
  return Object.freeze({
    snapshot,
    records: Object.freeze(page.map((record) => Object.freeze({ ...record }))),
    nextCursor: offset + limit < ordered.length ? `snapshot:${snapshot}:${offset + limit}` : null,
  });
}

export function validateRevision2Record(value: unknown): Revision2Validation {
  let sealed: unknown;
  try {
    sealed = snapshotPlainData(value);
  } catch {
    return { ok: false, reason: "invalid catalogue record schema" };
  }
  if (
    !isObject(sealed) ||
    Object.keys(sealed).some((key) => !RECORD_KEYS.has(key)) ||
    sealed.schemaVersion !== 2 ||
    sealed.schemaRevision !== 2 ||
    sealed.recordType !== "catalogue_record"
  ) {
    return { ok: false, reason: "invalid catalogue record schema" };
  }
  if (
    !boundedText(sealed.entryId, 256) ||
    !boundedText(sealed.version, 128) ||
    typeof sealed.artifactType !== "string" ||
    !ARTIFACT_TYPES.has(sealed.artifactType) ||
    !digest(sealed.releaseManifestSha256) ||
    !source(sealed.releaseSource) ||
    typeof sealed.artifactTreeSha1 !== "string" ||
    !SHA1.test(sealed.artifactTreeSha1) ||
    !digest(sealed.inventorySha256) ||
    typeof sealed.lifecycle !== "string" ||
    !LIFECYCLE_VALUES.has(sealed.lifecycle) ||
    typeof sealed.selectability !== "string" ||
    !SELECTABILITY_VALUES.has(sealed.selectability) ||
    typeof sealed.compatibility !== "string" ||
    !COMPATIBILITY_VALUES.has(sealed.compatibility) ||
    !boundedText(sealed.bundlePath, 512) ||
    !BUNDLE_PATH.test(sealed.bundlePath) ||
    sealed.bundlePath !== `registry/v2/entries/${sealed.entryId}/versions/${sealed.version}`
  ) {
    return { ok: false, reason: "catalogue record is not admitted and selectable" };
  }
  const releaseSource = {
    releaseSourceCommitSha: (sealed.releaseSource as Record<string, unknown>)
      .releaseSourceCommitSha as string,
    releaseSourceRepositoryTreeSha1: (sealed.releaseSource as Record<string, unknown>)
      .releaseSourceRepositoryTreeSha1 as string,
  } as const;
  return {
    ok: true,
    record: Object.freeze({
      ...(sealed as Revision2Record),
      releaseSource: Object.freeze(releaseSource),
    }),
  };
}

export function validateExactRevision2(
  bundle: unknown,
  authenticatedEvidence: AuthenticatedRevision2CatalogueEvidence,
  materializationEvidence: VerifiedConsumerMaterializationEvidence,
): Revision2Validation {
  let sealedBundle: unknown;
  let sealedAuthenticatedEvidence: AuthenticatedRevision2CatalogueEvidence;
  let sealedMaterializationEvidence: VerifiedConsumerMaterializationEvidence;
  try {
    sealedBundle = snapshotPlainData(bundle);
    sealedAuthenticatedEvidence = snapshotPlainData(
      authenticatedEvidence,
    ) as AuthenticatedRevision2CatalogueEvidence;
    sealedMaterializationEvidence = snapshotPlainData(
      materializationEvidence,
    ) as VerifiedConsumerMaterializationEvidence;
  } catch {
    return { ok: false, reason: "invalid exact release evidence" };
  }
  const trusted = sealedAuthenticatedEvidence as unknown as Record<string, unknown>;
  const trustedSource = isObject(trusted?.source) ? trusted.source : undefined;
  const trustedRecord = isObject(trusted?.selectedRecord) ? trusted.selectedRecord : undefined;
  const materialized = sealedMaterializationEvidence as unknown as Record<string, unknown>;
  if (
    !isObject(trusted) ||
    Object.keys(trusted).toSorted().join(",") !==
      "catalogueSha256,recordsSha256,selectedRecord,source,verified" ||
    !trustedSource ||
    Object.keys(trustedSource).toSorted().join(",") !== "commit,tree" ||
    trustedSource.commit !== LIBRARIES_COMMIT ||
    trustedSource.tree !== LIBRARIES_TREE ||
    trusted.catalogueSha256 !== LIBRARIES_CATALOGUE_SHA256 ||
    !digest(trusted.recordsSha256) ||
    trusted.verified !== true ||
    !trustedRecord ||
    Object.keys(trustedRecord).toSorted().join(",") !==
      "artifactTreeSha1,entryId,inventorySha256,releaseManifestSha256,releaseSourceCommitSha,releaseSourceRepositoryTreeSha1,version" ||
    !boundedText(trustedRecord.entryId, 256) ||
    !boundedText(trustedRecord.version, 128) ||
    !digest(trustedRecord.releaseManifestSha256) ||
    !digest(trustedRecord.inventorySha256) ||
    typeof trustedRecord.releaseSourceCommitSha !== "string" ||
    !SHA1.test(trustedRecord.releaseSourceCommitSha) ||
    typeof trustedRecord.releaseSourceRepositoryTreeSha1 !== "string" ||
    !SHA1.test(trustedRecord.releaseSourceRepositoryTreeSha1) ||
    typeof trustedRecord.artifactTreeSha1 !== "string" ||
    !SHA1.test(trustedRecord.artifactTreeSha1)
  ) {
    return { ok: false, reason: "invalid authenticated catalogue evidence" };
  }
  if (
    !isObject(materialized) ||
    Object.keys(materialized).toSorted().join(",") !==
      "artifactTreeSha1,consumerMaterializedTreeSha1,entryId,inventorySha256,payloadSha256,releaseManifestSha256,releaseSourceCommitSha,releaseSourceRepositoryTreeSha1,verified,version" ||
    materialized.verified !== true ||
    typeof materialized.consumerMaterializedTreeSha1 !== "string" ||
    !SHA1.test(materialized.consumerMaterializedTreeSha1)
  ) {
    return { ok: false, reason: "invalid materialization verification evidence" };
  }
  if (
    !isObject(sealedBundle) ||
    !hasExactKeys(sealedBundle, BUNDLE_KEYS) ||
    !isObject(sealedBundle.source) ||
    !hasExactKeys(sealedBundle.source, PROVIDER_SOURCE_KEYS) ||
    sealedBundle.source.commit !== LIBRARIES_COMMIT ||
    sealedBundle.source.tree !== LIBRARIES_TREE
  ) {
    return { ok: false, reason: "wrong source commit or tree" };
  }
  if (
    !isObject(sealedBundle.catalogue) ||
    !hasExactKeys(sealedBundle.catalogue, CATALOGUE_KEYS) ||
    sealedBundle.catalogue.schemaVersion !== 2 ||
    sealedBundle.catalogue.schemaRevision !== 2 ||
    sealedBundle.catalogue.catalogueType !== "catalogue" ||
    !digest(sealedBundle.catalogue.catalogueSha256) ||
    normalizedSha256(sealedBundle.catalogue.catalogueSha256) !== LIBRARIES_CATALOGUE_SHA256 ||
    !digest(sealedBundle.catalogue.recordsSha256) ||
    normalizedSha256(sealedBundle.catalogue.recordsSha256) !==
      normalizedSha256(trusted.recordsSha256 as string) ||
    !Array.isArray(sealedBundle.catalogue.records) ||
    canonicalDigest(sealedBundle.catalogue.records) !==
      normalizedSha256(sealedBundle.catalogue.recordsSha256)
  ) {
    return { ok: false, reason: "invalid catalogue evidence" };
  }
  const validatedCatalogueRecords: Revision2Record[] = [];
  for (const candidate of sealedBundle.catalogue.records) {
    const candidateResult = validateRevision2Record(candidate);
    if (!candidateResult.ok) {
      return { ok: false, reason: "invalid catalogue record schema" };
    }
    validatedCatalogueRecords.push(candidateResult.record);
  }
  const recordResult = validateRevision2Record(sealedBundle.record);
  if (!recordResult.ok) {
    return recordResult;
  }
  const record = recordResult.record;
  if (
    !validatedCatalogueRecords.some(
      (candidate) => canonicalRecordDigest(candidate) === canonicalRecordDigest(record),
    )
  ) {
    return { ok: false, reason: "catalogue does not contain selected record" };
  }
  if (
    trustedRecord.entryId !== record.entryId ||
    trustedRecord.version !== record.version ||
    normalizedSha256(trustedRecord.releaseManifestSha256 as string) !==
      normalizedSha256(record.releaseManifestSha256) ||
    trustedRecord.releaseSourceCommitSha !== record.releaseSource.releaseSourceCommitSha ||
    trustedRecord.releaseSourceRepositoryTreeSha1 !==
      record.releaseSource.releaseSourceRepositoryTreeSha1 ||
    trustedRecord.artifactTreeSha1 !== record.artifactTreeSha1 ||
    normalizedSha256(trustedRecord.inventorySha256 as string) !==
      normalizedSha256(record.inventorySha256)
  ) {
    return { ok: false, reason: "selected record does not match authenticated catalogue" };
  }
  if (
    record.lifecycle !== "admitted" ||
    record.selectability !== "selectable" ||
    record.compatibility !== "compatible"
  ) {
    return { ok: false, reason: "record is not admitted, selectable, and compatible" };
  }
  const manifest = sealedBundle.manifest;
  if (
    !isObject(manifest) ||
    !hasExactKeys(manifest, MANIFEST_KEYS) ||
    manifest.entryId !== record.entryId ||
    manifest.version !== record.version ||
    manifest.releaseId !== `${record.entryId}@${record.version}` ||
    !source(manifest.releaseSource) ||
    manifest.releaseSource.releaseSourceCommitSha !== record.releaseSource.releaseSourceCommitSha ||
    manifest.releaseSource.releaseSourceRepositoryTreeSha1 !==
      record.releaseSource.releaseSourceRepositoryTreeSha1 ||
    manifest.artifactTreeSha1 !== record.artifactTreeSha1 ||
    !digest(manifest.inventorySha256) ||
    normalizedSha256(manifest.inventorySha256) !== normalizedSha256(record.inventorySha256) ||
    !digest(manifest.payloadSha256) ||
    !digest(manifest.dependencyLockSha256) ||
    manifest.releaseId.length > 160 ||
    canonicalDigest(manifest) !== normalizedSha256(record.releaseManifestSha256)
  ) {
    return { ok: false, reason: "release manifest does not match catalogue" };
  }
  if (
    !digest(sealedBundle.inventorySha256) ||
    normalizedSha256(sealedBundle.inventorySha256) !== normalizedSha256(record.inventorySha256) ||
    !digest(sealedBundle.dependencyLockSha256) ||
    normalizedSha256(sealedBundle.dependencyLockSha256) !==
      normalizedSha256(manifest.dependencyLockSha256)
  ) {
    return { ok: false, reason: "inventory or dependency evidence mismatch" };
  }
  const cache = sealedBundle.verifiedCache;
  if (
    !isObject(cache) ||
    !hasExactKeys(cache, CACHE_KEYS) ||
    !isObject(cache.sourceEvidence) ||
    !hasExactKeys(cache.sourceEvidence, SOURCE_EVIDENCE_KEYS) ||
    cache.sourceEvidence.selectedRepositoryCommitSha !== LIBRARIES_COMMIT ||
    cache.sourceEvidence.selectedRepositoryTreeSha1 !== LIBRARIES_TREE ||
    cache.sourceEvidence.immutable !== true ||
    !source(cache.releaseSource) ||
    cache.releaseSource.releaseSourceCommitSha !== record.releaseSource.releaseSourceCommitSha ||
    cache.releaseSource.releaseSourceRepositoryTreeSha1 !==
      record.releaseSource.releaseSourceRepositoryTreeSha1 ||
    !digest(cache.catalogueSha256) ||
    normalizedSha256(cache.catalogueSha256) !== LIBRARIES_CATALOGUE_SHA256 ||
    !digest(cache.catalogueRecordsSha256) ||
    normalizedSha256(cache.catalogueRecordsSha256) !==
      normalizedSha256(sealedBundle.catalogue.recordsSha256) ||
    cache.entryId !== record.entryId ||
    cache.version !== record.version ||
    !digest(cache.releaseManifestSha256) ||
    normalizedSha256(cache.releaseManifestSha256) !==
      normalizedSha256(record.releaseManifestSha256) ||
    !digest(cache.inventorySha256) ||
    normalizedSha256(cache.inventorySha256) !== normalizedSha256(record.inventorySha256) ||
    !digest(cache.payloadSha256) ||
    normalizedSha256(cache.payloadSha256) !== normalizedSha256(manifest.payloadSha256) ||
    cache.artifactTreeSha1 !== record.artifactTreeSha1
  ) {
    return { ok: false, reason: "verified cache receipt mismatch" };
  }
  if (
    !isObject(sealedBundle.consumption) ||
    !hasExactKeys(sealedBundle.consumption, CONSUMPTION_KEYS) ||
    sealedBundle.consumption.receiptType !== "consumption" ||
    sealedBundle.consumption.result !== "pass" ||
    sealedBundle.consumption.entryId !== record.entryId ||
    sealedBundle.consumption.version !== record.version ||
    !digest(sealedBundle.consumption.releaseManifestSha256) ||
    normalizedSha256(sealedBundle.consumption.releaseManifestSha256) !==
      normalizedSha256(record.releaseManifestSha256) ||
    sealedBundle.consumption.releaseSourceCommitSha !==
      record.releaseSource.releaseSourceCommitSha ||
    sealedBundle.consumption.releaseSourceRepositoryTreeSha1 !==
      record.releaseSource.releaseSourceRepositoryTreeSha1 ||
    sealedBundle.consumption.artifactTreeSha1 !== record.artifactTreeSha1 ||
    typeof sealedBundle.consumption.consumerMaterializedTreeSha1 !== "string" ||
    !SHA1.test(sealedBundle.consumption.consumerMaterializedTreeSha1) ||
    materialized.entryId !== record.entryId ||
    materialized.version !== record.version ||
    !digest(materialized.releaseManifestSha256) ||
    normalizedSha256(materialized.releaseManifestSha256 as string) !==
      normalizedSha256(record.releaseManifestSha256) ||
    materialized.releaseSourceCommitSha !== record.releaseSource.releaseSourceCommitSha ||
    materialized.releaseSourceRepositoryTreeSha1 !==
      record.releaseSource.releaseSourceRepositoryTreeSha1 ||
    materialized.artifactTreeSha1 !== record.artifactTreeSha1 ||
    !digest(materialized.inventorySha256) ||
    normalizedSha256(materialized.inventorySha256 as string) !==
      normalizedSha256(record.inventorySha256) ||
    !digest(materialized.payloadSha256) ||
    normalizedSha256(materialized.payloadSha256 as string) !==
      normalizedSha256(manifest.payloadSha256) ||
    sealedBundle.consumption.consumerMaterializedTreeSha1 !==
      materialized.consumerMaterializedTreeSha1
  ) {
    return { ok: false, reason: "consumption receipt is not a pass" };
  }
  return { ok: true, record };
}
