import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const AES_GCM_ALGORITHM = "aes-256-gcm";
const GCM_NONCE_BYTES = 12;
const GCM_TAG_BYTES = 16;
const BACKUP_FORMAT_VERSION = 1 as const;

export type BackupArtifactKind = "source" | "database" | "procedure" | "receipt";

export type SourceArchiveEntry = Readonly<{
  path: string;
  kind: BackupArtifactKind;
  bytes: Uint8Array;
}>;

export type SourceArchive = Readonly<{
  formatVersion: 1;
  bytes: Uint8Array;
  sha256: string;
  entries: readonly Readonly<{
    path: string;
    kind: BackupArtifactKind;
    bytes: number;
    sha256: string;
  }>[];
}>;

export type KeyReference = Readonly<{
  provider: "google-secret-manager";
  secretName: string;
  version: string;
  workloadIdentityAudience: string;
}>;

export type EncryptedPrivateSnapshot = Readonly<{
  formatVersion: 1;
  algorithm: "aes-256-gcm";
  keyReference: KeyReference;
  nonce: Uint8Array;
  ciphertext: Uint8Array;
  authTag: Uint8Array;
  plaintextSha256: string;
  objectSha256: string;
  objectBytes: number;
}>;

export type RestoreVerification = Readonly<{
  status: "verified";
  plaintextSha256: string;
  quickCheck: "passed";
  network: "disabled";
  channelDelivery: "disabled";
}>;

export type UploadVerification = Readonly<{
  status: "verified";
  destinationBindingId: string;
  objectSha256: string;
  objectBytes: number;
}>;

export type BackupDestinationBindings = Readonly<{
  companyArchiveBindingId: string;
  privateSnapshotBindingId: string;
}>;

export type BackupRetention = "retain_previous" | "promote_current";

export const MAX_UPLOAD_ATTEMPTS = 2 as const;

export type BackupReceipt = Readonly<{
  formatVersion: 1;
  profile: "lisa";
  sourceArchive: Readonly<{
    sha256: string;
    bytes: number;
    entries: readonly SourceArchive["entries"][number][];
    excluded: readonly ["private-health", "credentials"];
  }>;
  privateSnapshot: Readonly<{
    objectSha256: string;
    objectBytes: number;
    plaintextSha256: string;
    keyReference: Readonly<{
      provider: "google-secret-manager";
      secretName: string;
      version: string;
      workloadIdentityAudience: string;
    }>;
  }>;
  upload: UploadVerification;
  restore: RestoreVerification;
  retention: BackupRetention;
  capturedAtMs: number;
  receiptSha256: string;
}>;

export type KeyResolver = (reference: KeyReference) => Promise<Uint8Array>;

/**
 * The production adapter must use SQLite's online backup API. Keeping the
 * snapshotter injected makes this contract testable without opening a live
 * profile or copying mutable state into Git evidence.
 */
export type OnlineDatabaseSnapshotter = (input: { databasePath: string }) => Promise<Uint8Array>;

export async function captureOnlineDatabaseSnapshot(input: {
  databasePath: string;
  snapshotter: OnlineDatabaseSnapshotter;
  quickCheck?: (snapshot: Uint8Array) => boolean;
}): Promise<
  Readonly<{ databasePath: string; bytes: Uint8Array; sha256: string; quickCheck: "passed" }>
> {
  if (
    !input.databasePath ||
    input.databasePath.includes("\\") ||
    input.databasePath.includes("\0")
  ) {
    fail("invalid_database_path");
  }
  const bytes = asBytes(
    await input.snapshotter({ databasePath: input.databasePath }),
    "invalid_database_snapshot",
  );
  if (bytes.byteLength === 0 || (input.quickCheck && !input.quickCheck(bytes))) {
    fail("database_quick_check_failed");
  }
  return Object.freeze({
    databasePath: input.databasePath,
    bytes: new Uint8Array(bytes),
    sha256: sha256(bytes),
    quickCheck: "passed",
  });
}

export type PrivateSnapshotUploader = (input: {
  destinationBindingId: string;
  objectBytes: Uint8Array;
  objectSha256: string;
  metadata: Readonly<{
    formatVersion: 1;
    algorithm: "aes-256-gcm";
    plaintextSha256: string;
  }>;
}) => Promise<Readonly<{ objectSha256: string; objectBytes: number }>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function fail(code: string): never {
  throw new Error(`lisa_backup_${code}`);
}

function asBytes(value: Uint8Array, code: string): Uint8Array {
  if (!(value instanceof Uint8Array)) {
    fail(code);
  }
  return value;
}

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function sortedCopy<T>(values: readonly T[], compare: (left: T, right: T) => number): T[] {
  const sorted: T[] = [];
  for (const value of values) {
    const index = sorted.findIndex((existing) => compare(value, existing) < 0);
    if (index === -1) {
      sorted.push(value);
    } else {
      sorted.splice(index, 0, value);
    }
  }
  return sorted;
}

function assertHash(value: string, code: string): void {
  if (!/^[a-f0-9]{64}$/u.test(value)) {
    fail(code);
  }
}

function canonicalJson(value: unknown): string {
  if (value instanceof Uint8Array) {
    return JSON.stringify({ $bytes: Buffer.from(value).toString("base64") });
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${sortedCopy(
      Object.keys(value).filter((key) => value[key] !== undefined),
      (left, right) => left.localeCompare(right),
    )
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? fail("non_serializable_value");
}

function safeRelativePath(value: string): string {
  if (
    !value ||
    value.startsWith("/") ||
    value.includes("\\") ||
    value.split("/").some((part) => part === ".." || part === "")
  ) {
    fail("unsafe_source_path");
  }
  return value;
}

function assertCompanyArchivePath(value: string): void {
  if (/(?:private[-_]?health|health\.sqlite|credentials?|secrets?|\.env)/iu.test(value)) {
    fail("private_or_credential_artifact");
  }
}

/** Opaque binding IDs only. Drive paths, URLs, and host-local destinations never enter source. */
export function createOpaqueDestinationBindingId(value: string): string {
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{1,127}$/u.test(value) ||
    /(?:https?:|\/\/|\.google\.)/iu.test(value)
  ) {
    fail("invalid_destination_binding");
  }
  return value;
}

export function assertBackupDestinationBindings(
  input: BackupDestinationBindings,
): BackupDestinationBindings {
  const companyArchiveBindingId = createOpaqueDestinationBindingId(input.companyArchiveBindingId);
  const privateSnapshotBindingId = createOpaqueDestinationBindingId(input.privateSnapshotBindingId);
  if (companyArchiveBindingId === privateSnapshotBindingId) {
    fail("destination_bindings_not_distinct");
  }
  return Object.freeze({ companyArchiveBindingId, privateSnapshotBindingId });
}

function assertRestorableCompanyArchive(archive: SourceArchive): void {
  const kinds = new Set(archive.entries.map((entry) => entry.kind));
  if (!kinds.has("source") || !kinds.has("procedure")) {
    fail("incomplete_company_archive");
  }
}

function assertKeyReference(reference: KeyReference): KeyReference {
  if (
    reference.provider !== "google-secret-manager" ||
    !/^[A-Za-z0-9._:/-]{1,256}$/u.test(reference.secretName) ||
    !/^[A-Za-z0-9._:-]{1,64}$/u.test(reference.version) ||
    !reference.workloadIdentityAudience.startsWith("https://") ||
    Object.hasOwn(reference, "secretValue")
  ) {
    fail("invalid_key_reference");
  }
  return Object.freeze({ ...reference });
}

function assertAesKey(key: Uint8Array): Uint8Array {
  asBytes(key, "invalid_key");
  if (key.byteLength !== 32) {
    fail("invalid_key_length");
  }
  return key;
}

/** Build a stable source archive. Private health and credential paths never enter it. */
export function createSourceArchive(entries: readonly SourceArchiveEntry[]): SourceArchive {
  const normalized = sortedCopy(
    entries.map((entry) => {
      const path = safeRelativePath(entry.path);
      assertCompanyArchivePath(path);
      if (!["source", "database", "procedure", "receipt"].includes(entry.kind)) {
        fail("invalid_artifact_kind");
      }
      const bytes = asBytes(entry.bytes, "invalid_artifact_bytes");
      return {
        path,
        kind: entry.kind,
        bytes: new Uint8Array(bytes),
        bytesCount: bytes.byteLength,
        sha256: sha256(bytes),
      };
    }),
    (left, right) => left.path.localeCompare(right.path),
  );
  if (new Set(normalized.map((entry) => entry.path)).size !== normalized.length) {
    fail("duplicate_artifact_path");
  }
  const payload = normalized.map(({ path, kind, bytes }) => ({ path, kind, bytes }));
  const archiveBytes = new TextEncoder().encode(canonicalJson(payload));
  const inventory = normalized.map(({ path, kind, bytesCount, sha256: digest }) => ({
    path,
    kind,
    bytes: bytesCount,
    sha256: digest,
  }));
  return Object.freeze({
    formatVersion: BACKUP_FORMAT_VERSION,
    bytes: archiveBytes,
    sha256: sha256(archiveBytes),
    entries: Object.freeze(inventory),
  });
}

export async function encryptPrivateSnapshot(input: {
  plaintext: Uint8Array;
  keyReference: KeyReference;
  resolveKey: KeyResolver;
  nonce?: Uint8Array;
}): Promise<EncryptedPrivateSnapshot> {
  const plaintext = asBytes(input.plaintext, "invalid_snapshot");
  const keyReference = assertKeyReference(input.keyReference);
  const key = assertAesKey(await input.resolveKey(keyReference));
  const nonce =
    input.nonce === undefined
      ? randomBytes(GCM_NONCE_BYTES)
      : asBytes(input.nonce, "invalid_nonce");
  if (nonce.byteLength !== GCM_NONCE_BYTES) {
    fail("invalid_nonce_length");
  }
  const cipher = createCipheriv(AES_GCM_ALGORITHM, key, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const objectBytes = Buffer.concat([Buffer.from(nonce), ciphertext, authTag]);
  return Object.freeze({
    formatVersion: BACKUP_FORMAT_VERSION,
    algorithm: AES_GCM_ALGORITHM,
    keyReference,
    nonce: new Uint8Array(nonce),
    ciphertext: new Uint8Array(ciphertext),
    authTag: new Uint8Array(authTag),
    plaintextSha256: sha256(plaintext),
    objectSha256: sha256(objectBytes),
    objectBytes: objectBytes.byteLength,
  });
}

export function encryptedSnapshotBytes(snapshot: EncryptedPrivateSnapshot): Uint8Array {
  if (
    snapshot.formatVersion !== BACKUP_FORMAT_VERSION ||
    snapshot.algorithm !== AES_GCM_ALGORITHM
  ) {
    fail("unsupported_snapshot_format");
  }
  if (
    snapshot.nonce.byteLength !== GCM_NONCE_BYTES ||
    snapshot.authTag.byteLength !== GCM_TAG_BYTES
  ) {
    fail("invalid_snapshot_parts");
  }
  const expectedBytes =
    snapshot.nonce.byteLength + snapshot.ciphertext.byteLength + snapshot.authTag.byteLength;
  if (snapshot.objectBytes !== expectedBytes) {
    fail("invalid_snapshot_size");
  }
  const bytes = new Uint8Array(snapshot.objectBytes);
  bytes.set(snapshot.nonce, 0);
  bytes.set(snapshot.ciphertext, snapshot.nonce.byteLength);
  bytes.set(snapshot.authTag, snapshot.nonce.byteLength + snapshot.ciphertext.byteLength);
  if (sha256(bytes) !== snapshot.objectSha256) {
    fail("snapshot_hash_mismatch");
  }
  return bytes;
}

export async function verifyDisposablePrivateRestore(input: {
  snapshot: EncryptedPrivateSnapshot;
  resolveKey: KeyResolver;
  quickCheck: (plaintext: Uint8Array) => boolean;
  makeTemporaryDirectory: () => Promise<string>;
  removeTemporaryDirectory: (directory: string) => Promise<void>;
}): Promise<RestoreVerification> {
  const restoreDirectory = await input.makeTemporaryDirectory();
  try {
    if (
      !restoreDirectory.startsWith("/") ||
      restoreDirectory.includes("\\") ||
      restoreDirectory.includes("\0") ||
      /(?:\/Users\/|\/Applications\/)/u.test(restoreDirectory)
    ) {
      fail("invalid_restore_directory");
    }
    const restored = await decryptAndVerifyPrivateSnapshot({
      snapshot: input.snapshot,
      resolveKey: input.resolveKey,
      quickCheck: input.quickCheck,
    });
    return restored.verification;
  } finally {
    await input.removeTemporaryDirectory(restoreDirectory);
  }
}

export async function decryptAndVerifyPrivateSnapshot(input: {
  snapshot: EncryptedPrivateSnapshot;
  resolveKey: KeyResolver;
  quickCheck: (plaintext: Uint8Array) => boolean;
}): Promise<Readonly<{ plaintext: Uint8Array; verification: RestoreVerification }>> {
  const snapshot = input.snapshot;
  encryptedSnapshotBytes(snapshot);
  const key = assertAesKey(await input.resolveKey(assertKeyReference(snapshot.keyReference)));
  try {
    const decipher = createDecipheriv(AES_GCM_ALGORITHM, key, snapshot.nonce);
    decipher.setAuthTag(snapshot.authTag);
    const plaintext = Buffer.concat([decipher.update(snapshot.ciphertext), decipher.final()]);
    const actualHash = sha256(plaintext);
    if (actualHash !== snapshot.plaintextSha256 || !input.quickCheck(new Uint8Array(plaintext))) {
      fail("restore_quick_check_failed");
    }
    return Object.freeze({
      plaintext: new Uint8Array(plaintext),
      verification: Object.freeze({
        status: "verified",
        plaintextSha256: actualHash,
        quickCheck: "passed",
        network: "disabled",
        channelDelivery: "disabled",
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("lisa_backup_")) {
      throw error;
    }
    fail("restore_authentication_failed");
  }
}

export async function uploadEncryptedSnapshot(input: {
  snapshot: EncryptedPrivateSnapshot;
  destinationBindingId: string;
  uploader: PrivateSnapshotUploader;
}): Promise<UploadVerification> {
  const destinationBindingId = createOpaqueDestinationBindingId(input.destinationBindingId);
  const objectBytes = encryptedSnapshotBytes(input.snapshot);
  const uploaded = await input.uploader({
    destinationBindingId,
    objectBytes,
    objectSha256: input.snapshot.objectSha256,
    metadata: {
      formatVersion: BACKUP_FORMAT_VERSION,
      algorithm: AES_GCM_ALGORITHM,
      plaintextSha256: input.snapshot.plaintextSha256,
    },
  });
  if (
    uploaded.objectBytes !== objectBytes.byteLength ||
    uploaded.objectSha256 !== input.snapshot.objectSha256
  ) {
    fail("uploaded_object_verification_failed");
  }
  return Object.freeze({
    status: "verified",
    destinationBindingId,
    objectSha256: uploaded.objectSha256,
    objectBytes: uploaded.objectBytes,
  });
}

export function chooseRetention(input: {
  upload: "verified" | "failed";
  restore: "verified" | "failed";
}): BackupRetention {
  return input.upload === "verified" && input.restore === "verified"
    ? "promote_current"
    : "retain_previous";
}

export function applyRetention<T>(input: {
  current: T | undefined;
  previous: T | undefined;
  candidate: T;
  upload: "verified" | "failed";
  restore: "verified" | "failed";
}): Readonly<{ current: T | undefined; previous: T | undefined; retention: BackupRetention }> {
  const retention = chooseRetention(input);
  if (retention === "retain_previous") {
    return Object.freeze({ current: input.current, previous: input.previous, retention });
  }
  return Object.freeze({ current: input.candidate, previous: input.current, retention });
}

export function planUploadRetry(
  attempt: number,
): Readonly<{ retry: boolean; nextAttempt: number | null }> {
  if (!Number.isSafeInteger(attempt) || attempt < 1) {
    fail("invalid_upload_attempt");
  }
  return attempt < MAX_UPLOAD_ATTEMPTS
    ? Object.freeze({ retry: true, nextAttempt: attempt + 1 })
    : Object.freeze({ retry: false, nextAttempt: null });
}

function assertSanitizedReceipt(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertSanitizedReceipt);
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (
      /(?:payload|secretValue|password|credentialValue|privateContent|messageBody)/iu.test(key) ||
      (typeof child === "string" &&
        /(?:BEGIN (?:RSA|EC|OPENSSH) PRIVATE KEY|password=|token=)/iu.test(child))
    ) {
      fail("unsanitized_receipt");
    }
    assertSanitizedReceipt(child);
  }
}

/** Produce only metadata; no private bytes, key bytes, or provider responses are persisted. */
export function buildBackupReceipt(input: {
  sourceArchive: SourceArchive;
  snapshot: EncryptedPrivateSnapshot;
  upload: UploadVerification;
  restore: RestoreVerification;
  capturedAtMs: number;
}): BackupReceipt {
  if (!Number.isSafeInteger(input.capturedAtMs) || input.capturedAtMs < 0) {
    fail("invalid_capture_time");
  }
  assertRestorableCompanyArchive(input.sourceArchive);
  const base = {
    formatVersion: BACKUP_FORMAT_VERSION,
    profile: "lisa" as const,
    sourceArchive: {
      sha256: input.sourceArchive.sha256,
      bytes: input.sourceArchive.bytes.byteLength,
      entries: input.sourceArchive.entries,
      excluded: ["private-health", "credentials"] as const,
    },
    privateSnapshot: {
      objectSha256: input.snapshot.objectSha256,
      objectBytes: input.snapshot.objectBytes,
      plaintextSha256: input.snapshot.plaintextSha256,
      keyReference: input.snapshot.keyReference,
    },
    upload: input.upload,
    restore: input.restore,
    retention: chooseRetention({ upload: input.upload.status, restore: input.restore.status }),
    capturedAtMs: input.capturedAtMs,
  };
  assertSanitizedReceipt(base);
  const receiptSha256 = sha256(new TextEncoder().encode(canonicalJson(base)));
  return Object.freeze({ ...base, receiptSha256 });
}

export function verifyUploadedObject(input: {
  expectedSha256: string;
  expectedBytes: number;
  actualSha256: string;
  actualBytes: number;
}): true {
  assertHash(input.expectedSha256, "invalid_expected_hash");
  if (input.expectedBytes !== input.actualBytes || input.expectedSha256 !== input.actualSha256) {
    fail("object_verification_failed");
  }
  return true;
}

export function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && timingSafeEqual(left, right);
}
