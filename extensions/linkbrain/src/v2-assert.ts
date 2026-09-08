import {
  BRAIN_V2_DISCLOSURE_LEVELS,
  BRAIN_V2_EXECUTE_OPERATIONS,
  LINKBRAIN_V2_ARTIFACT_DIGESTS,
  LINKBRAIN_V2_COMMIT,
  LINKBRAIN_V2_CONTRACT_VERSION,
  LINKBRAIN_V2_MCP_PROTOCOL,
  LINKBRAIN_V2_PIN_CONTRACT_VERSION,
  LINKBRAIN_V2_TREE,
  PLATFORM_AUTH_CLAIMS_CONTRACT_VERSION,
  PLATFORM_AUTH_CLAIMS_SCHEMA_VERSION,
  PLATFORM_COMMIT,
  PLATFORM_TREE,
  type BrainV2Disclosure,
  type BrainV2IdentityExpectation,
  type BrainV2Negotiation,
  type BrainV2Operation,
  type BrainV2Page,
  type BrainV2PlatformIdentity,
} from "./v2-pins.js";

const REF = /^[A-Za-z0-9][A-Za-z0-9._~:/@-]{0,255}$/;
const ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/u;
export const SENSITIVE_VALUE =
  /(?:\bbearer\s+\S+|\b(?:api[ _-]?key|access[ _-]?token|refresh[ _-]?token|client[ _-]?secret|password|private[ _-]?key|token|secret|authorization)\s*[:=]\s*\S+|\bsk-[A-Za-z0-9_-]{16,}\b|\bghp_[A-Za-z0-9]{20,}\b|-----BEGIN\s+[A-Z ]*PRIVATE KEY-----|\b(?:system prompt|developer prompt|chat transcript|raw transcript|raw tool output|chain of thought|internal reasoning|private memory|case vault)\b)/iu;
const REVOCATION_MAX_AGE_MS = 5 * 60 * 1000;
const FORBIDDEN_FIELDS = new Set([
  "body",
  "binary",
  "bytes",
  "caseVault",
  "caseVaultContent",
  "content",
  "contentHash",
  "digest",
  "evidence",
  "file",
  "filePath",
  "fullContent",
  "hash",
  "matterReference",
  "payload",
  "prompt",
  "rawCapture",
  "rawToolOutput",
  "reasoning",
  "recording",
  "secret",
  "secrets",
  "sha256",
  "transcript",
  "workProduct",
]);
const FORBIDDEN_IDENTITY_FIELDS = new Set([
  "actorId",
  "audience",
  "capability",
  "capabilities",
  "credentialId",
  "credentialReference",
  "issuer",
  "organizationRef",
  "runtimeBindingRef",
  "scope",
  "serviceScopes",
]);
const FORBIDDEN_SECRET_KEYS = new Set([
  "accesskey",
  "apikey",
  "authorization",
  "bearer",
  "clientsecret",
  "password",
  "privatekey",
  "secret",
  "token",
]);
const canonicalKey = (key: string): string => key.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
const FORBIDDEN_FIELDS_CANONICAL = new Set([...FORBIDDEN_FIELDS].map(canonicalKey));
const FORBIDDEN_IDENTITY_FIELDS_CANONICAL = new Set(
  [...FORBIDDEN_IDENTITY_FIELDS].map(canonicalKey),
);
const FORBIDDEN_SECRET_KEYS_CANONICAL = new Set([
  ...[...FORBIDDEN_SECRET_KEYS].map(canonicalKey),
  "accesstoken",
  "refreshtoken",
  "credential",
  "credentialvalue",
]);
const MAX_SAFE_NODES = 1_000;
const MAX_SAFE_DEPTH = 16;
const MAX_SAFE_KEYS = 100;
const MAX_SAFE_KEY_LENGTH = 80;
const MAX_SAFE_STRING_TOTAL = 32_768;

export const objectRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
export const ownDataString = (value: unknown, key: string): string | undefined => {
  if (!objectRecord(value)) {
    return undefined;
  }
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && "value" in descriptor && typeof descriptor.value === "string"
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
};

export const boundedRef = (value: unknown): value is string =>
  typeof value === "string" && REF.test(value);

export const assertObjectKeys = (value: Record<string, unknown>, allowed: readonly string[]) => {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) {
      throw new Error(`brain_v2_unknown_field:${key}`);
    }
  }
};

type SafeSnapshotState = {
  nodes: number;
  stringTotal: number;
  readonly seen: WeakSet<object>;
};

const assertSafeKey = (key: string): void => {
  const policyKey = canonicalKey(key);
  if (key.length > MAX_SAFE_KEY_LENGTH || FORBIDDEN_FIELDS_CANONICAL.has(policyKey)) {
    throw new Error(`brain_v2_private_payload:${key}`);
  }
  if (FORBIDDEN_IDENTITY_FIELDS_CANONICAL.has(policyKey)) {
    throw new Error(`brain_v2_identity_override:${key}`);
  }
  if ([...FORBIDDEN_SECRET_KEYS_CANONICAL].some((secretKey) => policyKey.includes(secretKey))) {
    throw new Error(`brain_v2_secret_field:${key}`);
  }
};

export const snapshotSafeValue = (
  value: unknown,
  depth: number,
  path: string,
  state: SafeSnapshotState,
  enforcePayloadFieldPolicy: boolean,
): unknown => {
  state.nodes += 1;
  if (state.nodes > MAX_SAFE_NODES) {
    throw new Error("brain_v2_payload_too_large");
  }
  if (value === null || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    state.stringTotal += value.length;
    if (value.length > 512 || state.stringTotal > MAX_SAFE_STRING_TOTAL) {
      throw new Error(`brain_v2_unbounded_string:${path}`);
    }
    if (enforcePayloadFieldPolicy && SENSITIVE_VALUE.test(value)) {
      throw new Error(`brain_v2_sensitive_string:${path}`);
    }
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "object") {
    throw new Error(`brain_v2_non_json_value:${path}`);
  }
  if (state.seen.has(value)) {
    throw new Error(`brain_v2_cyclic_payload:${path}`);
  }
  state.seen.add(value);

  const descriptors = Object.getOwnPropertyDescriptors(value);
  const symbolKeys = Object.getOwnPropertySymbols(descriptors);
  if (symbolKeys.length > 0) {
    throw new Error(`brain_v2_non_json_value:${path}`);
  }
  for (const descriptor of Object.values(descriptors)) {
    if (descriptor.get !== undefined || descriptor.set !== undefined) {
      throw new Error(`brain_v2_accessor_payload:${path}`);
    }
  }

  if (Array.isArray(value)) {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Array.prototype || depth >= MAX_SAFE_DEPTH) {
      throw new Error(`brain_v2_payload_depth_or_array:${path}`);
    }
    const lengthHolder = Object.getOwnPropertyDescriptor(descriptors, "length");
    const lengthDescriptor = lengthHolder?.value as PropertyDescriptor | undefined;
    const length = lengthDescriptor?.value;
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_SAFE_KEYS) {
      throw new Error(`brain_v2_payload_depth_or_array:${path}`);
    }
    const snapshot = Array.from({ length });
    for (let index = 0; index < length; index += 1) {
      const key = String(index);
      const holder = Object.getOwnPropertyDescriptor(descriptors, key);
      const descriptor = holder?.value as PropertyDescriptor | undefined;
      if (
        !descriptor ||
        !("value" in descriptor) ||
        !descriptor.enumerable ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined
      ) {
        throw new Error(`brain_v2_sparse_or_accessor_array:${path}[${key}]`);
      }
      Object.defineProperty(snapshot, key, {
        configurable: false,
        enumerable: true,
        writable: false,
        value: snapshotSafeValue(
          descriptor.value,
          depth + 1,
          `${path}[${key}]`,
          state,
          enforcePayloadFieldPolicy,
        ),
      });
    }
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (key === "length") {
        continue;
      }
      if (!descriptor.enumerable || !/^(?:0|[1-9]\d*)$/.test(key) || Number(key) >= length) {
        throw new Error(`brain_v2_non_json_value:${path}.${key}`);
      }
    }
    return Object.freeze(snapshot);
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`brain_v2_non_plain_object:${path}`);
  }
  const entries = Object.entries(descriptors);
  if (entries.length > MAX_SAFE_KEYS || depth >= MAX_SAFE_DEPTH) {
    throw new Error(`brain_v2_payload_depth_or_object:${path}`);
  }
  const snapshot = Object.create(null) as Record<string, unknown>;
  for (const [key, descriptor] of entries) {
    if (!descriptor.enumerable) {
      throw new Error(`brain_v2_non_json_value:${path}.${key}`);
    }
    if (enforcePayloadFieldPolicy) {
      assertSafeKey(key);
    }
    snapshot[key] = snapshotSafeValue(
      descriptor.value,
      depth + 1,
      `${path}.${key}`,
      state,
      enforcePayloadFieldPolicy,
    );
  }
  return Object.freeze(snapshot);
};

function assertIso(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string") {
    throw new Error(`brain_v2_invalid_timestamp:${field}`);
  }
  const match = ISO.exec(value);
  const parsed = Date.parse(value);
  if (!match || !Number.isFinite(parsed)) {
    throw new Error(`brain_v2_invalid_timestamp:${field}`);
  }
  const date = new Date(parsed);
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() + 1 !== Number(match[2]) ||
    date.getUTCDate() !== Number(match[3]) ||
    date.getUTCHours() !== Number(match[4]) ||
    date.getUTCMinutes() !== Number(match[5]) ||
    date.getUTCSeconds() !== Number(match[6])
  ) {
    throw new Error(`brain_v2_invalid_timestamp:${field}`);
  }
}

const assertDenseAuthorizationArray = (
  value: unknown,
  requiredValue: unknown,
  field: "serviceScopes" | "capabilities" | "permittedOperations",
): void => {
  if (!Array.isArray(value) || !boundedRef(requiredValue)) {
    throw new Error("brain_v2_scope_or_capability_missing");
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  const length = lengthDescriptor?.value;
  if (!Number.isSafeInteger(length) || length < 1 || length > MAX_SAFE_KEYS) {
    throw new Error("brain_v2_scope_or_capability_missing");
  }
  let requiredValueFound = false;
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (
      !descriptor ||
      !("value" in descriptor) ||
      !descriptor.enumerable ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined ||
      !boundedRef(descriptor.value)
    ) {
      throw new Error(`brain_v2_authorization_array_not_dense:${field}`);
    }
    if (descriptor.value === requiredValue) {
      requiredValueFound = true;
    }
  }
  if (!requiredValueFound) {
    throw new Error("brain_v2_scope_or_capability_missing");
  }
};

export const assertBrainV2OperationAuthorized = (
  identity: BrainV2PlatformIdentity,
  operation: BrainV2Operation,
): void => {
  const required = BRAIN_V2_EXECUTE_OPERATIONS.has(operation) ? "execute" : "read";
  assertDenseAuthorizationArray(identity.permittedOperations, required, "permittedOperations");
};

export function assertBrainV2PlatformIdentity(
  input: unknown,
  expected: BrainV2IdentityExpectation,
): asserts input is BrainV2PlatformIdentity {
  if (!objectRecord(input)) {
    throw new Error("brain_v2_identity_not_object");
  }
  const identityDescriptors = Object.getOwnPropertyDescriptors(input);
  assertObjectKeys(identityDescriptors, [
    "providerCandidate",
    "claimContractVersion",
    "schemaVersion",
    "actorId",
    "organizationRef",
    "runtimeBindingRef",
    "credentialReference",
    "issuer",
    "audience",
    "serviceScopes",
    "capabilities",
    "permittedOperations",
    "issuedAt",
    "expiresAt",
    "revocationStatus",
  ]);
  const identityValue = (field: string): unknown => {
    const descriptorHolder = Object.getOwnPropertyDescriptor(identityDescriptors, field);
    const descriptor = descriptorHolder?.value as PropertyDescriptor | undefined;
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      throw new Error(`brain_v2_identity_field_not_own_data:${field}`);
    }
    return descriptor.value;
  };
  const candidate = identityValue("providerCandidate");
  const candidateDescriptors = objectRecord(candidate)
    ? Object.getOwnPropertyDescriptors(candidate)
    : undefined;
  const candidateDescriptor = (field: "commit" | "tree"): PropertyDescriptor | undefined => {
    const holder = candidateDescriptors
      ? Object.getOwnPropertyDescriptor(candidateDescriptors, field)
      : undefined;
    return holder?.value as PropertyDescriptor | undefined;
  };
  const commitDescriptor = candidateDescriptor("commit");
  const treeDescriptor = candidateDescriptor("tree");
  if (
    !candidateDescriptors ||
    Object.keys(candidateDescriptors).length !== 2 ||
    commitDescriptor?.value !== PLATFORM_COMMIT ||
    treeDescriptor?.value !== PLATFORM_TREE ||
    commitDescriptor.get !== undefined ||
    commitDescriptor.set !== undefined ||
    treeDescriptor.get !== undefined ||
    treeDescriptor.set !== undefined
  ) {
    throw new Error("brain_v2_platform_candidate_mismatch");
  }
  if (
    identityValue("claimContractVersion") !== PLATFORM_AUTH_CLAIMS_CONTRACT_VERSION ||
    identityValue("schemaVersion") !== PLATFORM_AUTH_CLAIMS_SCHEMA_VERSION
  ) {
    throw new Error("brain_v2_platform_contract_mismatch");
  }
  for (const [field, expectedValue] of [
    ["actorId", expected.actorId],
    ["organizationRef", expected.organizationRef],
    ["runtimeBindingRef", expected.runtimeBindingRef],
    ["issuer", expected.issuer],
    ["audience", expected.audience],
  ] as const) {
    const value = identityValue(field);
    if (!boundedRef(value) || value !== expectedValue) {
      throw new Error(`brain_v2_identity_mismatch:${field}`);
    }
  }
  const credentialReference = identityValue("credentialReference");
  if (!boundedRef(credentialReference)) {
    throw new Error("brain_v2_credential_reference_invalid");
  }
  const serviceScopes = identityValue("serviceScopes");
  const capabilities = identityValue("capabilities");
  const permittedOperations = identityValue("permittedOperations");
  assertDenseAuthorizationArray(serviceScopes, expected.requiredScope, "serviceScopes");
  assertDenseAuthorizationArray(capabilities, expected.requiredCapability, "capabilities");
  assertDenseAuthorizationArray(permittedOperations, "read", "permittedOperations");
  const issuedAt = identityValue("issuedAt");
  const expiresAt = identityValue("expiresAt");
  assertIso(issuedAt, "issuedAt");
  assertIso(expiresAt, "expiresAt");
  const now =
    expected.now === undefined
      ? Date.now()
      : expected.now instanceof Date
        ? expected.now.getTime()
        : new Date(expected.now).getTime();
  if (!Number.isFinite(now) || Date.parse(expiresAt) <= now || Date.parse(issuedAt) > now) {
    throw new Error("brain_v2_identity_expired_or_not_yet_valid");
  }
  if (identityValue("revocationStatus") !== "active") {
    throw new Error("brain_v2_identity_revoked");
  }
}

export function assertBrainV2Negotiation(input: unknown): asserts input is BrainV2Negotiation {
  let snapshot: unknown;
  try {
    snapshot = snapshotSafeValue(
      input,
      0,
      "negotiation",
      { nodes: 0, stringTotal: 0, seen: new WeakSet() },
      false,
    );
  } catch {
    throw new Error("brain_v2_negotiation_not_object");
  }
  if (!objectRecord(snapshot)) {
    throw new Error("brain_v2_negotiation_not_object");
  }
  assertObjectKeys(snapshot, [
    "protocolVersion",
    "sessionless",
    "contractVersion",
    "authority",
    "executionAuthority",
    "sdkSupportsModernProtocol",
  ]);
  if (
    snapshot.protocolVersion !== LINKBRAIN_V2_MCP_PROTOCOL ||
    snapshot.sessionless !== true ||
    snapshot.contractVersion !== LINKBRAIN_V2_CONTRACT_VERSION ||
    snapshot.authority !== "advisory" ||
    snapshot.executionAuthority !== "none" ||
    snapshot.sdkSupportsModernProtocol !== true
  ) {
    throw new Error("brain_v2_negotiation_incompatible");
  }
}

export function assertBrainV2SafePayload<T>(input: T): T {
  return snapshotSafeValue(
    input,
    0,
    "value",
    {
      nodes: 0,
      stringTotal: 0,
      seen: new WeakSet(),
    },
    true,
  ) as T;
}

export const snapshotBrainV2PlatformIdentity = (input: unknown): BrainV2PlatformIdentity => {
  try {
    return snapshotSafeValue(
      input,
      0,
      "identity",
      { nodes: 0, stringTotal: 0, seen: new WeakSet() },
      false,
    ) as BrainV2PlatformIdentity;
  } catch {
    throw new Error("brain_v2_identity_snapshot_invalid");
  }
};

export const assertAuthenticatedProviderEvidence = (input: unknown): void => {
  const snapshot = snapshotSafeValue(
    input,
    0,
    "providerEvidence",
    { nodes: 0, stringTotal: 0, seen: new WeakSet() },
    false,
  );
  if (!objectRecord(snapshot)) {
    throw new Error("brain_v2_provider_evidence_invalid");
  }
  assertObjectKeys(snapshot, ["providerCandidate", "contractVersion", "artifactDigests"]);
  if (!objectRecord(snapshot.providerCandidate) || !objectRecord(snapshot.artifactDigests)) {
    throw new Error("brain_v2_provider_evidence_invalid");
  }
  const artifactDigests = snapshot.artifactDigests;
  assertObjectKeys(snapshot.providerCandidate, ["commit", "tree"]);
  assertObjectKeys(artifactDigests, Object.keys(LINKBRAIN_V2_ARTIFACT_DIGESTS));
  if (
    snapshot.providerCandidate.commit !== LINKBRAIN_V2_COMMIT ||
    snapshot.providerCandidate.tree !== LINKBRAIN_V2_TREE ||
    snapshot.contractVersion !== LINKBRAIN_V2_PIN_CONTRACT_VERSION ||
    Object.entries(LINKBRAIN_V2_ARTIFACT_DIGESTS).some(
      ([key, digest]) => artifactDigests[key] !== digest,
    )
  ) {
    throw new Error("brain_v2_provider_evidence_mismatch");
  }
};

export const assertFreshRevocationDecision = (
  input: unknown,
  identity: BrainV2PlatformIdentity,
  now: Date | string,
): void => {
  const snapshot = snapshotSafeValue(
    input,
    0,
    "revocationDecision",
    { nodes: 0, stringTotal: 0, seen: new WeakSet() },
    false,
  );
  if (!objectRecord(snapshot)) {
    throw new Error("brain_v2_revocation_decision_invalid");
  }
  assertObjectKeys(snapshot, [
    "status",
    "observedAt",
    "actorId",
    "organizationRef",
    "runtimeBindingRef",
    "credentialReference",
  ]);
  assertIso(snapshot.observedAt, "revocation_observed_at");
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const observedAt = Date.parse(snapshot.observedAt);
  const issuedAt = Date.parse(identity.issuedAt);
  if (
    snapshot.status !== "active" ||
    !Number.isFinite(nowMs) ||
    observedAt < issuedAt ||
    observedAt > nowMs ||
    nowMs - observedAt > REVOCATION_MAX_AGE_MS ||
    snapshot.actorId !== identity.actorId ||
    snapshot.organizationRef !== identity.organizationRef ||
    snapshot.runtimeBindingRef !== identity.runtimeBindingRef ||
    snapshot.credentialReference !== identity.credentialReference
  ) {
    throw new Error("brain_v2_identity_revoked_or_stale");
  }
};

const DISCLOSURE_ORDER: Record<BrainV2Disclosure, number> = {
  guide: 0,
  index: 1,
  metadata: 2,
  record: 3,
  evidence: 4,
};
const OPERATION_DISCLOSURE: Readonly<Record<string, BrainV2Disclosure>> = {
  "v2.discovery": "guide",
  "v2.capability.status": "metadata",
  "v2.projection.ingest": "metadata",
  "v2.projection.list": "index",
  "v2.projection.get": "record",
  "v2.projection.evidence": "evidence",
  "v2.task.get": "record",
  "v2.task.list": "index",
  "v2.inbox.read": "metadata",
  "v2.message.send": "metadata",
  "v2.checkpoint.write": "metadata",
  "v2.handoff.create": "metadata",
  "v2.handoff.accept": "metadata",
  "v2.conflict.report": "metadata",
  "v2.event.poll": "metadata",
  "v2.event.ack": "metadata",
  "v2.finding.submit": "metadata",
  "v2.knowledge.search": "index",
  "v2.knowledge.browse": "index",
  "v2.knowledge.load": "record",
};

export function assertBrainV2Page(
  input: unknown,
  operation: BrainV2Operation,
  expectedSnapshotId?: string,
  expectedCursor?: string,
): asserts input is BrainV2Page<unknown> {
  const snapshot = assertBrainV2SafePayload(input);
  assertBrainV2PageSnapshot(snapshot, operation, expectedSnapshotId, expectedCursor);
}

export function assertBrainV2PageSnapshot(
  input: unknown,
  operation: BrainV2Operation,
  expectedSnapshotId?: string,
  expectedCursor?: string,
): asserts input is BrainV2Page<unknown> {
  if (!objectRecord(input)) {
    throw new Error("brain_v2_response_not_object");
  }
  assertObjectKeys(input, ["snapshotId", "disclosure", "pagination", "data"]);
  if (!Object.hasOwn(input, "data")) {
    throw new Error("brain_v2_response_data_missing");
  }
  if (!boundedRef(input.snapshotId)) {
    throw new Error("brain_v2_snapshot_invalid");
  }
  if (expectedSnapshotId !== undefined && input.snapshotId !== expectedSnapshotId) {
    throw new Error("brain_v2_snapshot_mismatch");
  }
  const disclosure = input.disclosure;
  const required = OPERATION_DISCLOSURE[operation];
  if (
    !BRAIN_V2_DISCLOSURE_LEVELS.includes(disclosure as BrainV2Disclosure) ||
    required === undefined ||
    DISCLOSURE_ORDER[disclosure as BrainV2Disclosure] > DISCLOSURE_ORDER[required]
  ) {
    throw new Error("brain_v2_disclosure_exceeds_operation_limit");
  }
  const pagination = input.pagination;
  if (!objectRecord(pagination)) {
    throw new Error("brain_v2_pagination_invalid");
  }
  assertObjectKeys(pagination, ["limit", "cursor", "nextCursor"]);
  if (
    typeof pagination.limit !== "number" ||
    !Number.isSafeInteger(pagination.limit) ||
    pagination.limit < 1 ||
    pagination.limit > 100
  ) {
    throw new Error("brain_v2_pagination_limit_invalid");
  }
  for (const key of ["cursor", "nextCursor"] as const) {
    if (
      pagination[key] !== undefined &&
      (typeof pagination[key] !== "string" || !/^v2:\d+$/.test(pagination[key]))
    ) {
      throw new Error(`brain_v2_pagination_${key}_invalid`);
    }
  }
  if (
    (expectedCursor === undefined && pagination.cursor !== undefined) ||
    (expectedCursor !== undefined && pagination.cursor !== expectedCursor)
  ) {
    throw new Error("brain_v2_pagination_cursor_mismatch");
  }
  const currentOffset = expectedCursor === undefined ? 0n : BigInt(expectedCursor.slice(3));
  if (
    typeof pagination.nextCursor === "string" &&
    BigInt(pagination.nextCursor.slice(3)) <= currentOffset
  ) {
    throw new Error("brain_v2_pagination_nextCursor_not_advanced");
  }
}
