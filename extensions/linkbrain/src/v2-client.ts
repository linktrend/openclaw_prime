import {
  assertAuthenticatedProviderEvidence,
  assertBrainV2Negotiation,
  assertBrainV2OperationAuthorized,
  assertBrainV2PageSnapshot,
  assertBrainV2PlatformIdentity,
  assertBrainV2SafePayload,
  assertFreshRevocationDecision,
  assertObjectKeys,
  boundedRef,
  objectRecord,
  ownDataString,
  SENSITIVE_VALUE,
  snapshotBrainV2PlatformIdentity,
  snapshotSafeValue,
} from "./v2-assert.js";
import {
  LINKBRAIN_V2_CONTRACT_VERSION,
  LINKBRAIN_V2_MCP_PROTOCOL,
  type BrainV2AuthenticatedProviderEvidence,
  type BrainV2Disclosure,
  type BrainV2FailureStatus,
  type BrainV2IdentityExpectation,
  type BrainV2Negotiation,
  type BrainV2Operation,
  type BrainV2Page,
  type BrainV2PlatformIdentity,
  type BrainV2PlatformRevocationDecision,
  type BrainV2SafeResult,
  type BrainV2Transport,
} from "./v2-pins.js";

export type BrainV2PrivateCapture = Readonly<{
  namespace: "private";
  captureRef: string;
  idempotencyKey: string;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type BrainV2PrivateCheckpoint = Readonly<{
  namespace: "private";
  checkpointRef: string;
  idempotencyKey: string;
  metadata: Readonly<Record<string, unknown>>;
}>;

export function preparePrivateCapture(input: {
  namespace: "private";
  captureRef: string;
  idempotencyKey: string;
  metadata: Readonly<Record<string, unknown>>;
}): BrainV2PrivateCapture {
  const snapshot = snapshotSafeValue(
    input,
    0,
    "capture",
    { nodes: 0, stringTotal: 0, seen: new WeakSet() },
    false,
  ) as Record<string, unknown>;
  assertObjectKeys(snapshot, ["namespace", "captureRef", "idempotencyKey", "metadata"]);
  if (
    snapshot.namespace !== "private" ||
    !boundedRef(snapshot.captureRef) ||
    !boundedRef(snapshot.idempotencyKey) ||
    SENSITIVE_VALUE.test(snapshot.captureRef) ||
    SENSITIVE_VALUE.test(snapshot.idempotencyKey)
  ) {
    throw new Error("brain_v2_capture_reference_invalid");
  }
  const metadata = assertBrainV2SafePayload(snapshot.metadata);
  if (!objectRecord(metadata)) {
    throw new Error("brain_v2_capture_metadata_invalid");
  }
  return {
    namespace: "private",
    captureRef: snapshot.captureRef,
    idempotencyKey: snapshot.idempotencyKey,
    metadata,
  };
}

export function preparePrivateCheckpoint(input: {
  namespace: "private";
  checkpointRef: string;
  idempotencyKey: string;
  metadata: Readonly<Record<string, unknown>>;
}): BrainV2PrivateCheckpoint {
  const snapshot = snapshotSafeValue(
    input,
    0,
    "checkpoint",
    { nodes: 0, stringTotal: 0, seen: new WeakSet() },
    false,
  ) as Record<string, unknown>;
  assertObjectKeys(snapshot, ["namespace", "checkpointRef", "idempotencyKey", "metadata"]);
  if (
    snapshot.namespace !== "private" ||
    !boundedRef(snapshot.checkpointRef) ||
    !boundedRef(snapshot.idempotencyKey) ||
    SENSITIVE_VALUE.test(snapshot.checkpointRef) ||
    SENSITIVE_VALUE.test(snapshot.idempotencyKey)
  ) {
    throw new Error("brain_v2_checkpoint_reference_invalid");
  }
  const metadata = assertBrainV2SafePayload(snapshot.metadata);
  if (!objectRecord(metadata)) {
    throw new Error("brain_v2_checkpoint_metadata_invalid");
  }
  return {
    namespace: "private",
    checkpointRef: snapshot.checkpointRef,
    idempotencyKey: snapshot.idempotencyKey,
    metadata,
  };
}

function assertCursor(value: unknown): asserts value is string | undefined {
  if (value !== undefined && (typeof value !== "string" || !/^v2:\d+$/.test(value))) {
    throw new Error("brain_v2_cursor_invalid");
  }
}

function assertIdempotencyKey(value: unknown): asserts value is string {
  if (!boundedRef(value)) {
    throw new Error("brain_v2_idempotency_key_invalid");
  }
}

function assertCursorSnapshot(cursor: unknown, snapshotId: unknown): void {
  assertCursor(cursor);
  if (cursor !== undefined && !boundedRef(snapshotId)) {
    throw new Error("brain_v2_snapshot_required_for_cursor");
  }
  if (snapshotId !== undefined && !boundedRef(snapshotId)) {
    throw new Error("brain_v2_snapshot_invalid");
  }
}

function assertLoadReferences(reference: unknown, snapshotId: unknown): void {
  if (!boundedRef(reference) || !boundedRef(snapshotId)) {
    throw new Error("brain_v2_load_reference_invalid");
  }
}

export function createBrainV2Client(input: {
  identity: BrainV2PlatformIdentity;
  identityExpectation: Omit<BrainV2IdentityExpectation, "now">;
  authenticatedProviderEvidence: BrainV2AuthenticatedProviderEvidence;
  resolveRevocationDecision: () =>
    | BrainV2PlatformRevocationDecision
    | Promise<BrainV2PlatformRevocationDecision>;
  transport: BrainV2Transport;
  clock?: () => Date | string;
}): {
  negotiate(): Promise<BrainV2SafeResult<BrainV2Negotiation>>;
  discovery(): Promise<BrainV2SafeResult<BrainV2Page<unknown>>>;
  search(
    query: string,
    cursor?: string,
    snapshotId?: string,
  ): Promise<BrainV2SafeResult<BrainV2Page<unknown>>>;
  browse(cursor?: string, snapshotId?: string): Promise<BrainV2SafeResult<BrainV2Page<unknown>>>;
  load(reference: string, snapshotId: string): Promise<BrainV2SafeResult<BrainV2Page<unknown>>>;
  submitFinding(
    metadata: Readonly<Record<string, unknown>>,
    idempotencyKey: string,
  ): Promise<BrainV2SafeResult<BrainV2Page<unknown>>>;
  readInbox(cursor?: string, snapshotId?: string): Promise<BrainV2SafeResult<BrainV2Page<unknown>>>;
  sendMessage(
    metadata: Readonly<Record<string, unknown>>,
    idempotencyKey: string,
  ): Promise<BrainV2SafeResult<BrainV2Page<unknown>>>;
  writeCheckpoint(
    checkpoint: BrainV2PrivateCheckpoint,
  ): Promise<BrainV2SafeResult<BrainV2Page<unknown>>>;
  reportConflict(
    metadata: Readonly<Record<string, unknown>>,
    idempotencyKey: string,
  ): Promise<BrainV2SafeResult<BrainV2Page<unknown>>>;
} {
  let negotiated = false;
  const currentIdentityExpectation = (): BrainV2IdentityExpectation => ({
    ...input.identityExpectation,
    now: input.clock?.() ?? new Date(),
  });
  let trustedIdentity: BrainV2PlatformIdentity | undefined;
  let identityConstructionError: unknown;
  let providerEvidenceError: unknown;
  let transportRequest: BrainV2Transport["request"] | undefined;
  let transportConstructionError: unknown;
  let revocationResolver:
    | (() => BrainV2PlatformRevocationDecision | Promise<BrainV2PlatformRevocationDecision>)
    | undefined;
  try {
    const identitySnapshot = snapshotBrainV2PlatformIdentity(input.identity);
    assertBrainV2PlatformIdentity(identitySnapshot, currentIdentityExpectation());
    trustedIdentity = identitySnapshot;
  } catch (error) {
    identityConstructionError = error;
  }
  try {
    // This evidence is supplied by the authenticated transport owner, not by the Brain response.
    const descriptor = Object.getOwnPropertyDescriptor(input, "authenticatedProviderEvidence");
    if (!descriptor || !("value" in descriptor)) {
      throw new Error("brain_v2_provider_evidence_invalid");
    }
    assertAuthenticatedProviderEvidence(descriptor.value);
  } catch (error) {
    providerEvidenceError = error;
  }
  try {
    const descriptor = Object.getOwnPropertyDescriptor(input, "resolveRevocationDecision");
    if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "function") {
      throw new Error("brain_v2_revocation_resolver_invalid");
    }
    revocationResolver = descriptor.value as typeof revocationResolver;
  } catch (error) {
    identityConstructionError ??= error;
  }
  try {
    const transportDescriptor = Object.getOwnPropertyDescriptor(input, "transport");
    if (
      !transportDescriptor ||
      !("value" in transportDescriptor) ||
      !objectRecord(transportDescriptor.value)
    ) {
      throw new Error("brain_v2_transport_invalid");
    }
    const transport = transportDescriptor.value;
    const requestDescriptor = Object.getOwnPropertyDescriptor(transport, "request");
    if (
      !requestDescriptor ||
      !("value" in requestDescriptor) ||
      typeof requestDescriptor.value !== "function"
    ) {
      throw new Error("brain_v2_transport_invalid");
    }
    transportRequest = requestDescriptor.value.bind(transport) as BrainV2Transport["request"];
  } catch (error) {
    transportConstructionError = error;
  }
  const requireTrustedIdentity = async (): Promise<BrainV2PlatformIdentity> => {
    const identity = trustedIdentity;
    const resolver = revocationResolver;
    if (!identity || !resolver) {
      if (identityConstructionError instanceof Error) {
        throw identityConstructionError;
      }
      throw new Error("brain_v2_identity_snapshot_invalid");
    }
    const expectation = currentIdentityExpectation();
    assertBrainV2PlatformIdentity(identity, expectation);
    const decision = await resolver();
    const completionExpectation = currentIdentityExpectation();
    assertBrainV2PlatformIdentity(identity, completionExpectation);
    assertFreshRevocationDecision(decision, identity, completionExpectation.now ?? new Date());
    return identity;
  };
  const safeFailure = (error: unknown): BrainV2SafeResult<never> => {
    const providerStatus = ownDataString(error, "status");
    const providerReason = ownDataString(error, "reason");
    if (providerStatus !== undefined && providerReason !== undefined) {
      const status = providerStatus as BrainV2FailureStatus;
      if (
        [
          "degraded",
          "offline",
          "unauthorized",
          "forbidden",
          "stale",
          "contract_incompatible",
          "disabled",
          "unknown",
        ].includes(status)
      ) {
        return { ok: false, status, reason: `brain_v2_${status}` };
      }
    }
    const reason = ownDataString(error, "message") ?? "offline";
    const status: BrainV2FailureStatus = /unauthorized|identity|scope|capability|revoked/.test(
      reason,
    )
      ? "unauthorized"
      : /incompatible|negotiation|protocol/.test(reason)
        ? "contract_incompatible"
        : reason.startsWith("brain_v2_")
          ? "contract_incompatible"
          : "offline";
    return { ok: false, status, reason: `brain_v2_${status}` };
  };
  const call = async (
    operation: BrainV2Operation,
    params: Record<string, unknown>,
    disclosure: BrainV2Disclosure,
    snapshotId?: string,
    cursor?: string,
  ): Promise<BrainV2SafeResult<BrainV2Page<unknown>>> => {
    try {
      const identity = await requireTrustedIdentity();
      if (!negotiated) {
        return {
          ok: false,
          status: "contract_incompatible",
          reason: "brain_v2_negotiation_required",
        };
      }
      assertBrainV2OperationAuthorized(identity, operation);
      const safeParams = assertBrainV2SafePayload(params);
      const request = transportRequest;
      if (!request) {
        if (transportConstructionError instanceof Error) {
          throw transportConstructionError;
        }
        throw new Error("brain_v2_transport_invalid");
      }
      const response = await request({
        protocolVersion: LINKBRAIN_V2_MCP_PROTOCOL,
        method: "tools/call",
        actorBindingRef: identity.runtimeBindingRef,
        organizationRef: identity.organizationRef,
        contractVersion: LINKBRAIN_V2_CONTRACT_VERSION,
        params: { operation, disclosure, ...safeParams },
      });
      const safeResponse = assertBrainV2SafePayload(response);
      assertBrainV2PageSnapshot(safeResponse, operation, snapshotId, cursor);
      return { ok: true, data: safeResponse };
    } catch (error) {
      return safeFailure(error);
    }
  };
  const mutation = async (
    operation: BrainV2Operation,
    metadata: Readonly<Record<string, unknown>>,
    idempotencyKey: string,
  ): Promise<BrainV2SafeResult<BrainV2Page<unknown>>> => {
    try {
      assertIdempotencyKey(idempotencyKey);
      return await call(operation, { metadata, idempotencyKey }, "metadata");
    } catch (error) {
      return safeFailure(error);
    }
  };
  return {
    async negotiate() {
      try {
        if (providerEvidenceError) {
          if (providerEvidenceError instanceof Error) {
            throw providerEvidenceError;
          }
          throw new Error("brain_v2_provider_evidence_invalid");
        }
        const identity = await requireTrustedIdentity();
        const request = transportRequest;
        if (!request) {
          if (transportConstructionError instanceof Error) {
            throw transportConstructionError;
          }
          throw new Error("brain_v2_transport_invalid");
        }
        const response = await request({
          protocolVersion: LINKBRAIN_V2_MCP_PROTOCOL,
          method: "discover",
          actorBindingRef: identity.runtimeBindingRef,
          organizationRef: identity.organizationRef,
          contractVersion: LINKBRAIN_V2_CONTRACT_VERSION,
        });
        const safeResponse = assertBrainV2SafePayload(response);
        assertBrainV2Negotiation(safeResponse);
        negotiated = true;
        return { ok: true, data: safeResponse };
      } catch (error) {
        negotiated = false;
        return safeFailure(error);
      }
    },
    discovery: () => call("v2.discovery", {}, "guide"),
    search: async (query, cursor, snapshotId) => {
      try {
        assertCursorSnapshot(cursor, snapshotId);
        return await call(
          "v2.knowledge.search",
          {
            query,
            ...(cursor === undefined ? {} : { cursor }),
            ...(snapshotId === undefined ? {} : { snapshotId }),
          },
          "index",
          snapshotId,
          cursor,
        );
      } catch (error) {
        return safeFailure(error);
      }
    },
    browse: async (cursor, snapshotId) => {
      try {
        assertCursorSnapshot(cursor, snapshotId);
        return await call(
          "v2.knowledge.browse",
          {
            ...(cursor === undefined ? {} : { cursor }),
            ...(snapshotId === undefined ? {} : { snapshotId }),
          },
          "index",
          snapshotId,
          cursor,
        );
      } catch (error) {
        return safeFailure(error);
      }
    },
    load: async (reference, snapshotId) => {
      try {
        assertLoadReferences(reference, snapshotId);
        return await call("v2.knowledge.load", { reference, snapshotId }, "record", snapshotId);
      } catch (error) {
        return safeFailure(error);
      }
    },
    submitFinding: (metadata, idempotencyKey) =>
      mutation("v2.finding.submit", metadata, idempotencyKey),
    readInbox: async (cursor, snapshotId) => {
      try {
        assertCursorSnapshot(cursor, snapshotId);
        return await call(
          "v2.inbox.read",
          {
            ...(cursor === undefined ? {} : { cursor }),
            ...(snapshotId === undefined ? {} : { snapshotId }),
          },
          "metadata",
          snapshotId,
          cursor,
        );
      } catch (error) {
        return safeFailure(error);
      }
    },
    sendMessage: (metadata, idempotencyKey) =>
      mutation("v2.message.send", metadata, idempotencyKey),
    writeCheckpoint: async (checkpoint) => {
      try {
        const normalized = preparePrivateCheckpoint(checkpoint);
        return await call("v2.checkpoint.write", normalized, "metadata");
      } catch (error) {
        return safeFailure(error);
      }
    },
    reportConflict: (metadata, idempotencyKey) =>
      mutation("v2.conflict.report", metadata, idempotencyKey),
  };
}
