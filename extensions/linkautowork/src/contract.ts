import { createHash } from "node:crypto";

export {
  AUTOWORK_COMMIT,
  AUTOWORK_TREE,
  AUTOWORK_CONTRACT_VERSION,
  AUTOWORK_SCHEMA_VERSION,
  AUTOWORK_PROTOCOL_VERSION,
  AUTOWORK_AUDIENCE,
  AUTOWORK_OPERATIONS,
  AUTOWORK_STATES,
  type Operation,
  type ReceiptState,
  type OpaqueReference,
  type AutoworkRequest,
  type AutoworkReceipt,
  type AuthenticatedAutoworkReceiptEvidence,
  type AutoworkCallback,
  type AutoworkAcceptedCallbackState,
  type PlatformRevocationDecision,
} from "./contract-pins.js";

import {
  AUTOWORK_COMMIT,
  AUTOWORK_TREE,
  AUTOWORK_CONTRACT_VERSION,
  AUTOWORK_PROTOCOL_VERSION,
  AUTOWORK_AUDIENCE,
  AUTOWORK_OPERATIONS,
  AUTOWORK_STATES,
  type ReceiptState,
  type OpaqueReference,
  type AutoworkRequest,
  type AutoworkReceipt,
  type AuthenticatedAutoworkReceiptEvidence,
  type AutoworkCallback,
  type AutoworkAcceptedCallbackState,
  type PlatformRevocationDecision,
} from "./contract-pins.js";

const REVOCATION_MAX_AGE_MS = 5 * 60 * 1000;
const NON_TERMINAL_RECEIPT_STATES = ["accepted", "queued", "running"] as const;

const SHA256 = /^sha256:[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPAQUE = /^[a-z][a-z0-9+.-]*:\/\/[A-Za-z0-9._~/%:-]+$/;
const UTC_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/u;
const hasControlCharacters = (value: string): boolean => {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
};
const bounded = (value: unknown, max = 512): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= max &&
  !hasControlCharacters(value);
const matches = (value: unknown, pattern: RegExp): value is string =>
  typeof value === "string" && pattern.test(value);
const plain = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
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
const iso = (value: unknown): value is string => {
  if (!bounded(value, 64)) {
    return false;
  }
  const match = UTC_TIMESTAMP.exec(value);
  if (!match) {
    return false;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return false;
  }
  const date = new Date(parsed);
  return (
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() + 1 === Number(match[2]) &&
    date.getUTCDate() === Number(match[3]) &&
    date.getUTCHours() === Number(match[4]) &&
    date.getUTCMinutes() === Number(match[5]) &&
    date.getUTCSeconds() === Number(match[6])
  );
};
const timestampNanos = (value: string): bigint | undefined => {
  if (!iso(value)) {
    return undefined;
  }
  const match = UTC_TIMESTAMP.exec(value);
  if (!match) {
    return undefined;
  }
  const milliseconds = Date.parse(value);
  const epochSeconds = BigInt(Math.floor(milliseconds / 1000));
  const fraction = BigInt((match[7] ?? "").padEnd(9, "0"));
  return epochSeconds * 1_000_000_000n + fraction;
};
const dateMilliseconds = (value: unknown): number | undefined => {
  try {
    const milliseconds = Date.prototype.getTime.call(value);
    return Number.isFinite(milliseconds) ? milliseconds : undefined;
  } catch {
    return undefined;
  }
};
const keys = (
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
) => {
  const actual = Object.keys(value);
  return (
    required.every((key) => actual.includes(key)) &&
    actual.every((key) => required.includes(key) || optional.includes(key))
  );
};
const ref = (value: unknown): value is OpaqueReference =>
  plain(value) &&
  keys(value, ["ref", "digest", "observedAt"]) &&
  bounded(value.ref) &&
  OPAQUE.test(value.ref) &&
  typeof value.digest === "string" &&
  SHA256.test(value.digest) &&
  iso(value.observedAt);

function automation(value: unknown): value is AutoworkRequest["automation"] {
  return (
    plain(value) &&
    keys(value, ["automationId", "version", "definitionDigest", "configurationRef"]) &&
    bounded(value.automationId, 256) &&
    bounded(value.version, 64) &&
    matches(value.definitionDigest, SHA256) &&
    ref(value.configurationRef)
  );
}

function validateRequestSnapshot(value: unknown): value is AutoworkRequest {
  if (
    !plain(value) ||
    !keys(
      value,
      [
        "providerCandidate",
        "contractVersion",
        "protocolVersion",
        "requestId",
        "platform",
        "automation",
        "operationKind",
        "inputRef",
        "artifactRefs",
        "resultDestinationRef",
        "correlationRefs",
        "idempotencyKey",
        "expiresAt",
      ],
      ["brainHandoffRef", "cancellationRequestedAt"],
    )
  ) {
    return false;
  }
  const candidate = value.providerCandidate;
  if (
    !plain(candidate) ||
    Object.keys(candidate).length !== 2 ||
    candidate.commit !== AUTOWORK_COMMIT ||
    candidate.tree !== AUTOWORK_TREE
  ) {
    return false;
  }
  const platform = value.platform;
  if (
    !plain(platform) ||
    !keys(platform, [
      "orgId",
      "actorId",
      "audience",
      "capability",
      "credentialId",
      "bindingId",
      "issuedAt",
      "expiresAt",
      "revocationRef",
    ]) ||
    !matches(platform.orgId, UUID) ||
    !bounded(platform.actorId, 256) ||
    platform.audience !== AUTOWORK_AUDIENCE ||
    !bounded(platform.capability, 256) ||
    !bounded(platform.credentialId, 256) ||
    !bounded(platform.bindingId, 256) ||
    !iso(platform.issuedAt) ||
    !iso(platform.expiresAt) ||
    !matches(platform.revocationRef, OPAQUE)
  ) {
    return false;
  }
  if (
    value.contractVersion !== AUTOWORK_CONTRACT_VERSION ||
    value.protocolVersion !== AUTOWORK_PROTOCOL_VERSION ||
    !matches(value.requestId, UUID) ||
    !automation(value.automation) ||
    !(AUTOWORK_OPERATIONS as readonly unknown[]).includes(value.operationKind) ||
    !ref(value.inputRef) ||
    !Array.isArray(value.artifactRefs) ||
    !value.artifactRefs.every(ref) ||
    !bounded(value.resultDestinationRef) ||
    !OPAQUE.test(value.resultDestinationRef) ||
    !Array.isArray(value.correlationRefs) ||
    value.correlationRefs.length < 1 ||
    !value.correlationRefs.every(ref) ||
    !bounded(value.idempotencyKey, 160) ||
    !/^[A-Za-z0-9._:-]{16,160}$/.test(value.idempotencyKey) ||
    !iso(value.expiresAt)
  ) {
    return false;
  }
  if (value.brainHandoffRef !== undefined && !ref(value.brainHandoffRef)) {
    return false;
  }
  if (value.cancellationRequestedAt !== undefined && !iso(value.cancellationRequestedAt)) {
    return false;
  }
  if (value.operationKind === "external_assistance" && value.brainHandoffRef === undefined) {
    return false;
  }
  return true;
}

export function validateRequest(value: unknown): value is AutoworkRequest {
  try {
    return validateRequestSnapshot(snapshotPlainData(value));
  } catch {
    return false;
  }
}

function canonical(value: unknown): unknown {
  return Array.isArray(value)
    ? value.map(canonical)
    : plain(value)
      ? Object.fromEntries(
          Object.entries(value)
            .toSorted(([a], [b]) => a.localeCompare(b))
            .map(([key, child]) => [key, canonical(child)]),
        )
      : value;
}
const digestSnapshot = (value: unknown): string =>
  `sha256:${createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex")}`;

export function autoworkReceiptDigest(value: unknown): string {
  try {
    return digestSnapshot(snapshotPlainData(value));
  } catch {
    throw new Error("invalid Autowork receipt");
  }
}
export function requestFingerprint(value: unknown): string {
  let sealed: unknown;
  try {
    sealed = snapshotPlainData(value);
  } catch {
    throw new Error("invalid Autowork request");
  }
  if (!validateRequestSnapshot(sealed)) {
    throw new Error("invalid Autowork request");
  }
  return digestSnapshot(sealed);
}
export function sameIdempotencyContent(a: unknown, b: unknown): boolean {
  try {
    return requestFingerprint(a) === requestFingerprint(b);
  } catch {
    return false;
  }
}
export function assertIdempotency(existingFingerprint: string, incoming: unknown): void {
  if (existingFingerprint !== requestFingerprint(incoming)) {
    throw new Error("idempotency key conflicts with changed request");
  }
}
export function validateRequestAt(
  value: unknown,
  now = new Date(),
  revocationDecision?: PlatformRevocationDecision,
): value is AutoworkRequest {
  let sealed: unknown;
  let sealedRevocation: PlatformRevocationDecision | undefined;
  try {
    sealed = snapshotPlainData(value);
    sealedRevocation = snapshotPlainData(revocationDecision) as
      | PlatformRevocationDecision
      | undefined;
  } catch {
    return false;
  }
  const nowMilliseconds = dateMilliseconds(now);
  if (
    !validateRequestSnapshot(sealed) ||
    nowMilliseconds === undefined ||
    sealed.cancellationRequestedAt !== undefined ||
    sealedRevocation?.status !== "active" ||
    !iso(sealedRevocation.observedAt)
  ) {
    return false;
  }
  const nowNanos = BigInt(nowMilliseconds) * 1_000_000n;
  const observedAt = timestampNanos(sealedRevocation.observedAt);
  const issuedAt = timestampNanos(sealed.platform.issuedAt);
  const requestExpiresAt = timestampNanos(sealed.expiresAt);
  const platformExpiresAt = timestampNanos(sealed.platform.expiresAt);
  if (
    observedAt === undefined ||
    issuedAt === undefined ||
    requestExpiresAt === undefined ||
    platformExpiresAt === undefined
  ) {
    return false;
  }
  return (
    observedAt >= issuedAt &&
    observedAt <= nowNanos &&
    nowNanos - observedAt <= BigInt(REVOCATION_MAX_AGE_MS) * 1_000_000n &&
    sealedRevocation.credentialId === sealed.platform.credentialId &&
    sealedRevocation.bindingId === sealed.platform.bindingId &&
    sealedRevocation.orgId === sealed.platform.orgId &&
    sealedRevocation.actorId === sealed.platform.actorId &&
    sealedRevocation.audience === AUTOWORK_AUDIENCE &&
    sealed.platform.audience === AUTOWORK_AUDIENCE &&
    sealedRevocation.capability === sealed.platform.capability &&
    sealedRevocation.revocationRef === sealed.platform.revocationRef &&
    sealedRevocation.authorizedOperation === sealed.operationKind &&
    issuedAt <= nowNanos &&
    requestExpiresAt > nowNanos &&
    platformExpiresAt > nowNanos &&
    true
  );
}

export function validateReceipt(
  value: unknown,
  request?: AutoworkRequest,
  now = new Date(),
  authenticatedEvidence?: AuthenticatedAutoworkReceiptEvidence,
): value is AutoworkReceipt {
  let sealed: unknown;
  let sealedRequest: AutoworkRequest | undefined;
  let sealedEvidence: AuthenticatedAutoworkReceiptEvidence | undefined;
  try {
    sealed = snapshotPlainData(value);
    sealedRequest =
      request === undefined ? undefined : (snapshotPlainData(request) as AutoworkRequest);
    sealedEvidence =
      authenticatedEvidence === undefined
        ? undefined
        : (snapshotPlainData(authenticatedEvidence) as AuthenticatedAutoworkReceiptEvidence);
  } catch {
    return false;
  }
  if (sealedRequest !== undefined && !validateRequestSnapshot(sealedRequest)) {
    return false;
  }
  if (
    !plain(sealed) ||
    !keys(sealed, [
      "providerCandidate",
      "contractVersion",
      "requestId",
      "receiptId",
      "state",
      "acceptedAt",
      "updatedAt",
      "attemptCount",
      "requestFingerprint",
      "automation",
      "resultRefs",
      "evidenceRefs",
      "uncertainOutcome",
    ]) ||
    sealed.contractVersion !== AUTOWORK_CONTRACT_VERSION ||
    !plain(sealed.providerCandidate) ||
    Object.keys(sealed.providerCandidate).length !== 2 ||
    sealed.providerCandidate.commit !== AUTOWORK_COMMIT ||
    sealed.providerCandidate.tree !== AUTOWORK_TREE ||
    !matches(sealed.requestId, UUID) ||
    !matches(sealed.receiptId, UUID) ||
    !(AUTOWORK_STATES as readonly unknown[]).includes(sealed.state) ||
    !iso(sealed.acceptedAt) ||
    !iso(sealed.updatedAt) ||
    typeof sealed.attemptCount !== "number" ||
    !Number.isSafeInteger(sealed.attemptCount) ||
    sealed.attemptCount < 0 ||
    !matches(sealed.requestFingerprint, SHA256) ||
    !automation(sealed.automation) ||
    !Array.isArray(sealed.resultRefs) ||
    !sealed.resultRefs.every(ref) ||
    !Array.isArray(sealed.evidenceRefs) ||
    !sealed.evidenceRefs.every(ref) ||
    typeof sealed.uncertainOutcome !== "boolean"
  ) {
    return false;
  }
  if (
    !plain(sealedEvidence) ||
    !keys(sealedEvidence, [
      "providerCandidate",
      "contractVersion",
      "requestId",
      "receiptId",
      "receiptDigest",
      "verified",
    ]) ||
    !plain(sealedEvidence.providerCandidate) ||
    !keys(sealedEvidence.providerCandidate, ["commit", "tree"]) ||
    sealedEvidence.providerCandidate.commit !== AUTOWORK_COMMIT ||
    sealedEvidence.providerCandidate.tree !== AUTOWORK_TREE ||
    sealedEvidence.contractVersion !== AUTOWORK_CONTRACT_VERSION ||
    sealedEvidence.requestId !== sealed.requestId ||
    sealedEvidence.receiptId !== sealed.receiptId ||
    sealedEvidence.receiptDigest !== digestSnapshot(sealed) ||
    !sealedEvidence.verified
  ) {
    return false;
  }
  const acceptedAt = timestampNanos(sealed.acceptedAt);
  const updatedAt = timestampNanos(sealed.updatedAt);
  const nowMilliseconds = dateMilliseconds(now);
  if (nowMilliseconds === undefined) {
    return false;
  }
  const nowNanos = BigInt(nowMilliseconds) * 1_000_000n;
  if (
    acceptedAt === undefined ||
    updatedAt === undefined ||
    acceptedAt > updatedAt ||
    updatedAt > nowNanos
  ) {
    return false;
  }
  if (sealedRequest) {
    const issuedAt = timestampNanos(sealedRequest.platform.issuedAt);
    const requestExpiresAt = timestampNanos(sealedRequest.expiresAt);
    const platformExpiresAt = timestampNanos(sealedRequest.platform.expiresAt);
    if (
      issuedAt === undefined ||
      requestExpiresAt === undefined ||
      platformExpiresAt === undefined ||
      acceptedAt < issuedAt ||
      acceptedAt >= requestExpiresAt ||
      acceptedAt >= platformExpiresAt ||
      sealed.requestId !== sealedRequest.requestId ||
      sealed.providerCandidate.commit !== sealedRequest.providerCandidate.commit ||
      sealed.providerCandidate.tree !== sealedRequest.providerCandidate.tree ||
      sealed.requestFingerprint !== requestFingerprint(sealedRequest) ||
      JSON.stringify(canonical(sealed.automation)) !==
        JSON.stringify(canonical(sealedRequest.automation))
    ) {
      return false;
    }
  }
  return true;
}
export function validateCallback(
  value: unknown,
  request: AutoworkRequest,
  expected?: {
    callbackBindingRef: string;
    now: Date;
    acceptedState: AutoworkAcceptedCallbackState;
  },
  authenticatedEvidence?: AuthenticatedAutoworkReceiptEvidence,
): value is AutoworkCallback {
  let sealed: unknown;
  let sealedRequest: AutoworkRequest;
  let sealedEvidence: AuthenticatedAutoworkReceiptEvidence | undefined;
  let sealedExpected:
    | {
        callbackBindingRef: string;
        now: Date;
        acceptedState: AutoworkAcceptedCallbackState;
      }
    | undefined;
  try {
    sealed = snapshotPlainData(value);
    sealedRequest = snapshotPlainData(request) as AutoworkRequest;
    sealedEvidence =
      authenticatedEvidence === undefined
        ? undefined
        : (snapshotPlainData(authenticatedEvidence) as AuthenticatedAutoworkReceiptEvidence);
    if (expected) {
      sealedExpected = {
        callbackBindingRef: expected.callbackBindingRef,
        now: expected.now,
        acceptedState: snapshotPlainData(expected.acceptedState) as AutoworkAcceptedCallbackState,
      };
    }
  } catch {
    return false;
  }
  const nowMilliseconds =
    sealedExpected === undefined ? undefined : dateMilliseconds(sealedExpected.now);
  if (
    !plain(sealed) ||
    !keys(sealed, [
      "requestId",
      "receiptId",
      "orgId",
      "callbackBindingRef",
      "sourceTimestamp",
      "receipt",
    ]) ||
    !matches(sealed.requestId, UUID) ||
    !matches(sealed.receiptId, UUID) ||
    !matches(sealed.orgId, UUID) ||
    !matches(sealed.callbackBindingRef, OPAQUE) ||
    !iso(sealed.sourceTimestamp) ||
    !sealedExpected ||
    !plain(sealedExpected.acceptedState) ||
    !keys(sealedExpected.acceptedState, [
      "latestSourceTimestamp",
      "acceptedReceiptIds",
      "latestReceiptState",
      "latestAttemptCount",
    ]) ||
    (sealedExpected.acceptedState.latestSourceTimestamp !== null &&
      !iso(sealedExpected.acceptedState.latestSourceTimestamp)) ||
    !Array.isArray(sealedExpected.acceptedState.acceptedReceiptIds) ||
    !sealedExpected.acceptedState.acceptedReceiptIds.every((receiptId) =>
      matches(receiptId, UUID),
    ) ||
    (sealedExpected.acceptedState.acceptedReceiptIds.length === 0) !==
      (sealedExpected.acceptedState.latestSourceTimestamp === null) ||
    (sealedExpected.acceptedState.latestReceiptState !== null &&
      !(AUTOWORK_STATES as readonly unknown[]).includes(
        sealedExpected.acceptedState.latestReceiptState,
      )) ||
    (sealedExpected.acceptedState.latestAttemptCount !== null &&
      (!Number.isSafeInteger(sealedExpected.acceptedState.latestAttemptCount) ||
        sealedExpected.acceptedState.latestAttemptCount < 0)) ||
    (sealedExpected.acceptedState.latestReceiptState === null) !==
      (sealedExpected.acceptedState.latestAttemptCount === null) ||
    (sealedExpected.acceptedState.latestSourceTimestamp === null) !==
      (sealedExpected.acceptedState.latestReceiptState === null) ||
    nowMilliseconds === undefined ||
    sealed.callbackBindingRef !== sealedExpected.callbackBindingRef ||
    !validateReceipt(sealed.receipt, sealedRequest, sealedExpected.now, sealedEvidence)
  ) {
    return false;
  }
  const sourceTimestamp = timestampNanos(sealed.sourceTimestamp);
  const acceptedAt = timestampNanos((sealed.receipt as AutoworkReceipt).acceptedAt);
  const updatedAt = timestampNanos((sealed.receipt as AutoworkReceipt).updatedAt);
  const latestSourceTimestamp =
    sealedExpected.acceptedState.latestSourceTimestamp === null
      ? null
      : timestampNanos(sealedExpected.acceptedState.latestSourceTimestamp);
  const receipt = sealed.receipt as AutoworkReceipt;
  const latestReceiptState = sealedExpected.acceptedState.latestReceiptState;
  const latestAttemptCount = sealedExpected.acceptedState.latestAttemptCount;
  const latestStateIsTerminal =
    latestReceiptState !== null &&
    !(NON_TERMINAL_RECEIPT_STATES as readonly ReceiptState[]).includes(latestReceiptState);
  const stateRank = (state: ReceiptState): number =>
    state === "accepted" ? 0 : state === "queued" ? 1 : state === "running" ? 2 : 3;
  return (
    sourceTimestamp !== undefined &&
    acceptedAt !== undefined &&
    updatedAt !== undefined &&
    latestSourceTimestamp !== undefined &&
    sealed.requestId === receipt.requestId &&
    sealed.receiptId === receipt.receiptId &&
    sealed.orgId === sealedRequest.platform.orgId &&
    sourceTimestamp === updatedAt &&
    sourceTimestamp >= acceptedAt &&
    sourceTimestamp <= BigInt(nowMilliseconds) * 1_000_000n &&
    (latestSourceTimestamp === null || sourceTimestamp > latestSourceTimestamp) &&
    !sealedExpected.acceptedState.acceptedReceiptIds.includes(sealed.receiptId) &&
    (latestAttemptCount === null || receipt.attemptCount >= latestAttemptCount) &&
    !latestStateIsTerminal &&
    (latestReceiptState === null ||
      latestAttemptCount === null ||
      receipt.attemptCount > latestAttemptCount ||
      stateRank(receipt.state) >= stateRank(latestReceiptState))
  );
}
