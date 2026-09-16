import { describe, expect, it } from "vitest";
import {
  AUTOWORK_COMMIT,
  AUTOWORK_CONTRACT_VERSION,
  AUTOWORK_PROTOCOL_VERSION,
  AUTOWORK_TREE,
  autoworkReceiptDigest,
  requestFingerprint,
  sameIdempotencyContent,
  validateCallback as validateCallbackRaw,
  validateReceipt as validateReceiptRaw,
  validateRequestAt,
  validateRequest,
} from "./src/contract.js";

const uuid = "11111111-1111-4111-8111-111111111111";
const ref = (name: string) => ({
  ref: `evidence://${name}`,
  digest: `sha256:${"a".repeat(64)}`,
  observedAt: "2026-08-13T00:00:00.000Z",
});
const request = {
  providerCandidate: { commit: AUTOWORK_COMMIT, tree: AUTOWORK_TREE },
  contractVersion: AUTOWORK_CONTRACT_VERSION,
  protocolVersion: AUTOWORK_PROTOCOL_VERSION,
  requestId: uuid,
  platform: {
    orgId: uuid,
    actorId: "actor-1",
    audience: "autowork",
    capability: "status_collection",
    credentialId: "credential-1",
    bindingId: "binding-1",
    issuedAt: "2026-08-12T00:00:00.000Z",
    expiresAt: "2026-08-14T00:00:00.000Z",
    revocationRef: "evidence://revocation/active",
  },
  automation: {
    automationId: "status-check",
    version: "1.0.0",
    definitionDigest: `sha256:${"b".repeat(64)}`,
    configurationRef: ref("config"),
  },
  operationKind: "status_collection",
  inputRef: ref("input"),
  artifactRefs: [],
  resultDestinationRef: "evidence://results/one",
  correlationRefs: [ref("correlation")],
  idempotencyKey: "idem:autowork:0001",
  expiresAt: "2026-08-14T00:00:00.000Z",
} as const;
const receipt = {
  providerCandidate: { commit: AUTOWORK_COMMIT, tree: AUTOWORK_TREE },
  contractVersion: AUTOWORK_CONTRACT_VERSION,
  requestId: uuid,
  receiptId: "22222222-2222-4222-8222-222222222222",
  state: "accepted",
  acceptedAt: "2026-08-13T00:00:00.000Z",
  updatedAt: "2026-08-13T00:00:00.000Z",
  attemptCount: 0,
  requestFingerprint: requestFingerprint(request),
  automation: request.automation,
  resultRefs: [],
  evidenceRefs: [],
  uncertainOutcome: false,
} as const;

const authenticatedReceiptEvidence = (
  value: unknown,
):
  | {
      providerCandidate: { commit: typeof AUTOWORK_COMMIT; tree: typeof AUTOWORK_TREE };
      contractVersion: typeof AUTOWORK_CONTRACT_VERSION;
      requestId: string;
      receiptId: string;
      receiptDigest: string;
      verified: true;
    }
  | undefined => {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) {
    return undefined;
  }
  const requestId = Object.getOwnPropertyDescriptor(value, "requestId");
  const receiptId = Object.getOwnPropertyDescriptor(value, "receiptId");
  if (!requestId || !("value" in requestId) || !receiptId || !("value" in receiptId)) {
    return undefined;
  }
  const requestIdValue = requestId.value;
  const receiptIdValue = receiptId.value;
  if (typeof requestIdValue !== "string" || typeof receiptIdValue !== "string") {
    return undefined;
  }
  try {
    return {
      providerCandidate: { commit: AUTOWORK_COMMIT, tree: AUTOWORK_TREE },
      contractVersion: AUTOWORK_CONTRACT_VERSION,
      requestId: requestIdValue,
      receiptId: receiptIdValue,
      receiptDigest: autoworkReceiptDigest(value),
      verified: true as const,
    };
  } catch {
    return undefined;
  }
};
const validateReceipt = (
  value: unknown,
  candidateRequest?: Parameters<typeof validateReceiptRaw>[1],
  now?: Date,
) => validateReceiptRaw(value, candidateRequest, now, authenticatedReceiptEvidence(value));
const validateCallback = (
  value: unknown,
  candidateRequest: Parameters<typeof validateCallbackRaw>[1],
  expected?: Parameters<typeof validateCallbackRaw>[2],
) => {
  const receiptDescriptor =
    (typeof value === "object" || typeof value === "function") && value !== null
      ? Object.getOwnPropertyDescriptor(value, "receipt")
      : undefined;
  const candidateReceipt =
    receiptDescriptor && "value" in receiptDescriptor ? receiptDescriptor.value : undefined;
  return validateCallbackRaw(
    value,
    candidateRequest,
    expected,
    authenticatedReceiptEvidence(candidateReceipt),
  );
};

describe("LinkAutowork final provider contract", () => {
  it("accepts exact request, immutable receipt and correlated callback", () => {
    expect(validateRequest(request)).toBe(true);
    expect(validateReceipt(receipt, request)).toBe(true);
    expect(
      validateCallback(
        {
          requestId: uuid,
          receiptId: receipt.receiptId,
          orgId: uuid,
          callbackBindingRef: "evidence://callback/binding",
          sourceTimestamp: receipt.updatedAt,
          receipt,
        },
        request,
        {
          callbackBindingRef: "evidence://callback/binding",
          now: new Date("2026-08-13T12:00:00.000Z"),
          acceptedState: {
            latestSourceTimestamp: null,
            acceptedReceiptIds: [],
            latestReceiptState: null,
            latestAttemptCount: null,
          },
        },
      ),
    ).toBe(true);
    expect(sameIdempotencyContent(request, structuredClone(request))).toBe(true);
  });

  it("requires independently authenticated receipt identity and digest evidence", () => {
    const evidence = authenticatedReceiptEvidence(receipt);
    const callback = {
      requestId: uuid,
      receiptId: receipt.receiptId,
      orgId: uuid,
      callbackBindingRef: "evidence://callback/binding",
      sourceTimestamp: receipt.updatedAt,
      receipt,
    };
    const expected = {
      callbackBindingRef: "evidence://callback/binding",
      now: new Date("2026-08-13T12:00:00.000Z"),
      acceptedState: {
        latestSourceTimestamp: null,
        acceptedReceiptIds: [],
        latestReceiptState: null,
        latestAttemptCount: null,
      },
    } as const;
    expect(evidence).toBeDefined();
    expect(validateReceiptRaw(receipt, request, undefined, evidence)).toBe(true);
    expect(validateReceiptRaw(receipt, request)).toBe(false);
    expect(validateCallbackRaw(callback, request, expected)).toBe(false);
    expect(validateCallbackRaw(callback, request, expected, evidence)).toBe(true);
    expect(validateReceiptRaw({ ...receipt, state: "queued" }, request, undefined, evidence)).toBe(
      false,
    );
    expect(
      validateReceiptRaw(receipt, request, undefined, {
        ...evidence!,
        verified: false,
      } as never),
    ).toBe(false);
  });

  it("rejects unsafe receipt and persisted retry counters", () => {
    const unsafeAttemptCount = Number.MAX_SAFE_INTEGER + 1;
    expect(validateReceipt({ ...receipt, attemptCount: unsafeAttemptCount }, request)).toBe(false);
    expect(
      validateCallback(
        {
          requestId: uuid,
          receiptId: receipt.receiptId,
          orgId: uuid,
          callbackBindingRef: "evidence://callback/binding",
          sourceTimestamp: receipt.updatedAt,
          receipt,
        },
        request,
        {
          callbackBindingRef: "evidence://callback/binding",
          now: new Date("2026-08-13T12:00:00.000Z"),
          acceptedState: {
            latestSourceTimestamp: receipt.updatedAt,
            acceptedReceiptIds: ["33333333-3333-4333-8333-333333333333"],
            latestReceiptState: receipt.state,
            latestAttemptCount: unsafeAttemptCount,
          },
        },
      ),
    ).toBe(false);
  });
  it("fails closed for counterfeit Date-like clocks", () => {
    const counterfeit = Object.create(Date.prototype) as Date;
    const decision = {
      status: "active" as const,
      observedAt: "2026-08-13T11:59:00.000Z",
      credentialId: request.platform.credentialId,
      bindingId: request.platform.bindingId,
      orgId: request.platform.orgId,
      actorId: request.platform.actorId,
      audience: request.platform.audience,
      capability: request.platform.capability,
      revocationRef: request.platform.revocationRef,
      authorizedOperation: request.operationKind,
    };
    const callback = {
      requestId: uuid,
      receiptId: receipt.receiptId,
      orgId: uuid,
      callbackBindingRef: "evidence://callback/binding",
      sourceTimestamp: receipt.updatedAt,
      receipt,
    };
    const callbackExpected = {
      callbackBindingRef: "evidence://callback/binding",
      now: counterfeit,
      acceptedState: {
        latestSourceTimestamp: null,
        acceptedReceiptIds: [],
        latestReceiptState: null,
        latestAttemptCount: null,
      },
    } as const;
    expect(() => validateRequestAt(request, counterfeit, decision)).not.toThrow();
    expect(validateRequestAt(request, counterfeit, decision)).toBe(false);
    expect(() => validateReceipt(receipt, request, counterfeit)).not.toThrow();
    expect(validateReceipt(receipt, request, counterfeit)).toBe(false);
    expect(() => validateCallback(callback, request, callbackExpected)).not.toThrow();
    expect(validateCallback(callback, request, callbackExpected)).toBe(false);
  });
  it("requires an independent current Platform revocation decision", () => {
    const now = new Date("2026-08-13T12:00:00.000Z");
    expect(validateRequestAt(request, now)).toBe(false);
    expect(
      validateRequestAt(request, now, {
        status: "active",
        observedAt: "2026-08-13T11:59:00.000Z",
        credentialId: request.platform.credentialId,
        bindingId: request.platform.bindingId,
        orgId: request.platform.orgId,
        actorId: request.platform.actorId,
        audience: request.platform.audience,
        capability: request.platform.capability,
        revocationRef: request.platform.revocationRef,
        authorizedOperation: request.operationKind,
      }),
    ).toBe(true);
    expect(
      validateRequestAt(request, now, {
        status: "revoked",
        observedAt: "2026-08-13T11:59:00.000Z",
        credentialId: request.platform.credentialId,
        bindingId: request.platform.bindingId,
        orgId: request.platform.orgId,
        actorId: request.platform.actorId,
        audience: request.platform.audience,
        capability: request.platform.capability,
        revocationRef: request.platform.revocationRef,
        authorizedOperation: request.operationKind,
      }),
    ).toBe(false);
    expect(
      validateRequestAt(
        { ...request, platform: { ...request.platform, issuedAt: "2026-08-14T00:00:00.000Z" } },
        now,
        {
          status: "active",
          observedAt: "2026-08-13T11:59:00.000Z",
          credentialId: request.platform.credentialId,
          bindingId: request.platform.bindingId,
          orgId: request.platform.orgId,
          actorId: request.platform.actorId,
          audience: request.platform.audience,
          capability: request.platform.capability,
          revocationRef: request.platform.revocationRef,
          authorizedOperation: request.operationKind,
        },
      ),
    ).toBe(false);
    const wrongAudienceRequest = {
      ...request,
      platform: { ...request.platform, audience: "other-service" },
    };
    expect(validateRequest(wrongAudienceRequest)).toBe(false);
    expect(
      validateRequestAt(wrongAudienceRequest, now, {
        status: "active",
        observedAt: "2026-08-13T11:59:00.000Z",
        credentialId: request.platform.credentialId,
        bindingId: request.platform.bindingId,
        orgId: request.platform.orgId,
        actorId: request.platform.actorId,
        audience: "other-service",
        capability: request.platform.capability,
        revocationRef: request.platform.revocationRef,
        authorizedOperation: request.operationKind,
      }),
    ).toBe(false);
    const newlyIssuedRequest = {
      ...request,
      platform: { ...request.platform, issuedAt: "2026-08-13T11:58:00.000Z" },
    };
    expect(
      validateRequestAt(newlyIssuedRequest, now, {
        status: "active",
        observedAt: "2026-08-13T11:57:00.000Z",
        credentialId: request.platform.credentialId,
        bindingId: request.platform.bindingId,
        orgId: request.platform.orgId,
        actorId: request.platform.actorId,
        audience: request.platform.audience,
        capability: request.platform.capability,
        revocationRef: request.platform.revocationRef,
        authorizedOperation: request.operationKind,
      }),
    ).toBe(false);
    const subMillisecondFutureRequest = {
      ...request,
      platform: { ...request.platform, issuedAt: "2026-08-13T12:00:00.0009Z" },
    };
    expect(
      validateRequestAt(subMillisecondFutureRequest, now, {
        status: "active",
        observedAt: "2026-08-13T12:00:00.0009Z",
        credentialId: request.platform.credentialId,
        bindingId: request.platform.bindingId,
        orgId: request.platform.orgId,
        actorId: request.platform.actorId,
        audience: request.platform.audience,
        capability: request.platform.capability,
        revocationRef: request.platform.revocationRef,
        authorizedOperation: request.operationKind,
      }),
    ).toBe(false);
  });
  it("rejects cancellation markers on the ordinary execution path", () => {
    const now = new Date("2026-08-13T12:00:00.000Z");
    const decision = {
      status: "active" as const,
      observedAt: "2026-08-13T11:59:00.000Z",
      credentialId: request.platform.credentialId,
      bindingId: request.platform.bindingId,
      orgId: request.platform.orgId,
      actorId: request.platform.actorId,
      audience: request.platform.audience,
      capability: request.platform.capability,
      revocationRef: request.platform.revocationRef,
      authorizedOperation: request.operationKind,
    };
    expect(
      validateRequestAt(
        { ...request, cancellationRequestedAt: "2026-08-13T11:59:00.000Z" },
        now,
        decision,
      ),
    ).toBe(false);
    expect(
      validateRequestAt(
        { ...request, cancellationRequestedAt: "2026-08-13T12:01:00.000Z" },
        now,
        decision,
      ),
    ).toBe(false);
  });
  it("rejects non-canonical and invalid-calendar validity timestamps", () => {
    for (const issuedAt of [
      "2026-08-13",
      "2026-02-30T00:00:00.000Z",
      "2026-08-13T00:00:00+00:00",
    ]) {
      expect(validateRequest({ ...request, platform: { ...request.platform, issuedAt } })).toBe(
        false,
      );
    }
    expect(
      validateRequestAt(request, new Date("2026-08-13T12:00:00.000Z"), {
        status: "active",
        observedAt: "2026-08-13",
        credentialId: request.platform.credentialId,
        bindingId: request.platform.bindingId,
        orgId: request.platform.orgId,
        actorId: request.platform.actorId,
        audience: request.platform.audience,
        capability: request.platform.capability,
        revocationRef: request.platform.revocationRef,
        authorizedOperation: request.operationKind,
      }),
    ).toBe(false);
  });
  it("requires receipt acceptance within the request validity window", () => {
    const issueBoundary = {
      ...receipt,
      acceptedAt: request.platform.issuedAt,
      updatedAt: request.platform.issuedAt,
    };
    expect(validateReceipt(issueBoundary, request, new Date(request.platform.issuedAt))).toBe(true);

    const requestExpiry = "2026-08-14T00:00:00.000Z";
    const requestBoundary = {
      ...request,
      expiresAt: requestExpiry,
      platform: { ...request.platform, expiresAt: "2026-08-15T00:00:00.000Z" },
    };
    expect(
      validateReceipt(
        {
          ...receipt,
          acceptedAt: requestExpiry,
          updatedAt: requestExpiry,
          requestFingerprint: requestFingerprint(requestBoundary),
        },
        requestBoundary,
        new Date(requestExpiry),
      ),
    ).toBe(false);
    expect(
      validateReceipt(
        { ...receipt, acceptedAt: "2026-08-11T23:59:59.000Z" },
        request,
        new Date("2026-08-13T12:00:00.000Z"),
      ),
    ).toBe(false);
    expect(
      validateReceipt(
        {
          ...receipt,
          acceptedAt: "2026-08-14T00:00:01.000Z",
          updatedAt: "2026-08-14T00:00:01.000Z",
          requestFingerprint: requestFingerprint(requestBoundary),
        },
        requestBoundary,
        new Date("2026-08-14T00:00:01.000Z"),
      ),
    ).toBe(false);
    expect(
      validateReceipt(
        {
          ...receipt,
          acceptedAt: "2026-08-14T00:00:01.000Z",
          updatedAt: "2026-08-14T00:00:01.000Z",
          requestFingerprint: requestFingerprint({
            ...request,
            expiresAt: "2026-08-15T00:00:00.000Z",
          }),
        },
        { ...request, expiresAt: "2026-08-15T00:00:00.000Z" },
        new Date("2026-08-14T00:00:01.000Z"),
      ),
    ).toBe(false);
    expect(validateReceipt({ ...receipt, acceptedAt: "not-a-time" }, request)).toBe(false);
    expect(validateReceipt({ ...receipt, updatedAt: "not-a-time" }, request)).toBe(false);
    expect(validateReceipt(receipt, request, new Date(Number.NaN))).toBe(false);
  });
  it("matches automation objects by canonical content", () => {
    const reorderedAutomation = {
      configurationRef: request.automation.configurationRef,
      definitionDigest: request.automation.definitionDigest,
      version: request.automation.version,
      automationId: request.automation.automationId,
    };
    expect(validateReceipt({ ...receipt, automation: reorderedAutomation }, request)).toBe(true);
  });
  it.each([
    [
      "wrong provider commit",
      { platform: { ...request.platform, credentialId: AUTOWORK_COMMIT } },
      true,
    ],
    ["malformed result reference", { resultDestinationRef: "not-a-ref" }, false],
    ["wrong protocol", { protocolVersion: "2025-03-26" }, false],
    ["changed idempotency content", { inputRef: ref("different") }, true],
    ["missing correlation", { correlationRefs: [] }, false],
    ["expired request", { expiresAt: "2026-08-12T00:00:00.000Z" }, true],
  ] as const)("fails closed for %s", (_name, changes, valid) => {
    const candidate = { ...request, ...changes };
    expect(validateRequest(candidate)).toBe(valid);
    if (_name === "changed idempotency content") {
      expect(sameIdempotencyContent(request, candidate)).toBe(false);
    }
  });
  it("rejects callback replay or receipt fingerprint mismatch", () => {
    expect(
      validateReceipt({ ...receipt, requestFingerprint: `sha256:${"c".repeat(64)}` }, request),
    ).toBe(false);
    expect(
      validateCallback(
        {
          requestId: uuid,
          receiptId: receipt.receiptId,
          orgId: "33333333-3333-4333-8333-333333333333",
          callbackBindingRef: "evidence://callback/binding",
          sourceTimestamp: receipt.updatedAt,
          receipt,
        },
        request,
        {
          callbackBindingRef: "evidence://callback/binding",
          now: new Date("2026-08-13T12:00:00.000Z"),
          acceptedState: {
            latestSourceTimestamp: null,
            acceptedReceiptIds: [],
            latestReceiptState: null,
            latestAttemptCount: null,
          },
        },
      ),
    ).toBe(false);
  });

  it("rejects malformed primitive fields without coercing or throwing", () => {
    const malformed = { toString: null };
    for (const candidate of [
      { ...request, requestId: malformed },
      { ...request, automation: { ...request.automation, definitionDigest: malformed } },
      { ...request, platform: { ...request.platform, orgId: malformed } },
      { ...request, platform: { ...request.platform, revocationRef: malformed } },
    ]) {
      expect(() => validateRequest(candidate)).not.toThrow();
      expect(validateRequest(candidate)).toBe(false);
    }
    expect(() => validateReceipt({ ...receipt, receiptId: malformed }, request)).not.toThrow();
    expect(validateReceipt({ ...receipt, receiptId: malformed }, request)).toBe(false);
    expect(() => validateReceipt(receipt, {} as never)).not.toThrow();
    expect(validateReceipt(receipt, {} as never)).toBe(false);
    const callback = {
      requestId: uuid,
      receiptId: receipt.receiptId,
      orgId: uuid,
      callbackBindingRef: "evidence://callback/binding",
      sourceTimestamp: receipt.updatedAt,
      receipt,
    };
    const expected = {
      callbackBindingRef: "evidence://callback/binding",
      now: new Date("2026-08-13T12:00:00.000Z"),
      acceptedState: {
        latestSourceTimestamp: null,
        acceptedReceiptIds: [],
        latestReceiptState: null,
        latestAttemptCount: null,
      },
    };
    expect(() => validateCallback(callback, {} as never, expected)).not.toThrow();
    expect(validateCallback(callback, {} as never, expected)).toBe(false);
  });

  it("rejects inherited and accessor-backed requests without invoking getters", () => {
    let getterCalls = 0;
    const accessorRequest = { ...request } as Record<string, unknown>;
    Object.defineProperty(accessorRequest, "operationKind", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return getterCalls === 1 ? "status_collection" : "external_assistance";
      },
    });
    expect(validateRequest(accessorRequest)).toBe(false);
    expect(() => requestFingerprint(accessorRequest)).toThrow("invalid Autowork request");
    expect(getterCalls).toBe(0);
    expect(validateRequest(Object.create(request))).toBe(false);

    const nestedAccessor = { ...request, platform: { ...request.platform } } as Record<string, any>;
    Object.defineProperty(nestedAccessor.platform, "bindingId", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return request.platform.bindingId;
      },
    });
    expect(validateRequest(nestedAccessor)).toBe(false);
    expect(getterCalls).toBe(0);
  });

  it("requires explicit accepted callback state and rejects replay or stale chronology", () => {
    const callback = {
      requestId: uuid,
      receiptId: receipt.receiptId,
      orgId: uuid,
      callbackBindingRef: "evidence://callback/binding",
      sourceTimestamp: receipt.updatedAt,
      receipt,
    };
    expect(validateCallback(callback, request)).toBe(false);
    expect(
      validateCallback(callback, request, {
        callbackBindingRef: "evidence://callback/binding",
        now: new Date("2026-08-13T12:00:00.000Z"),
        acceptedState: {
          latestSourceTimestamp: receipt.updatedAt,
          acceptedReceiptIds: [receipt.receiptId],
          latestReceiptState: receipt.state,
          latestAttemptCount: receipt.attemptCount,
        },
      }),
    ).toBe(false);
    expect(
      validateCallback(callback, request, {
        callbackBindingRef: "evidence://callback/binding",
        now: new Date("2026-08-13T12:00:00.000Z"),
        acceptedState: {
          latestSourceTimestamp: receipt.updatedAt,
          acceptedReceiptIds: [],
          latestReceiptState: "running",
          latestAttemptCount: receipt.attemptCount,
        },
      }),
    ).toBe(false);
    expect(
      validateCallback(
        {
          ...callback,
          sourceTimestamp: "2026-08-12T23:59:59.000Z",
        },
        request,
        {
          callbackBindingRef: "evidence://callback/binding",
          now: new Date("2026-08-13T12:00:00.000Z"),
          acceptedState: {
            latestSourceTimestamp: null,
            acceptedReceiptIds: [],
            latestReceiptState: null,
            latestAttemptCount: null,
          },
        },
      ),
    ).toBe(false);
  });

  it("rejects malformed persisted receipt IDs without coercing or throwing", () => {
    const callback = {
      requestId: uuid,
      receiptId: receipt.receiptId,
      orgId: uuid,
      callbackBindingRef: "evidence://callback/binding",
      sourceTimestamp: receipt.updatedAt,
      receipt,
    };
    const expected = {
      callbackBindingRef: "evidence://callback/binding",
      now: new Date("2026-08-13T12:00:00.000Z"),
      acceptedState: {
        latestSourceTimestamp: null,
        acceptedReceiptIds: [{}],
        latestReceiptState: null,
        latestAttemptCount: null,
      },
    };
    expect(() => validateCallback(callback, request, expected as never)).not.toThrow();
    expect(validateCallback(callback, request, expected as never)).toBe(false);
  });

  it("requires coherent callback history and preserves sub-millisecond chronology", () => {
    const preciseReceipt = {
      ...receipt,
      receiptId: "88888888-8888-4888-8888-888888888888",
      acceptedAt: "2026-08-13T00:00:00.0000Z",
      updatedAt: "2026-08-13T00:00:00.0002Z",
      state: "running" as const,
    };
    const callback = {
      requestId: request.requestId,
      receiptId: preciseReceipt.receiptId,
      orgId: request.platform.orgId,
      callbackBindingRef: "evidence://callback/binding",
      sourceTimestamp: preciseReceipt.updatedAt,
      receipt: preciseReceipt,
    };
    const expected = {
      callbackBindingRef: "evidence://callback/binding",
      now: new Date("2026-08-13T12:00:00.000Z"),
      acceptedState: {
        latestSourceTimestamp: "2026-08-13T00:00:00.0001Z",
        acceptedReceiptIds: [receipt.receiptId],
        latestReceiptState: "queued" as const,
        latestAttemptCount: receipt.attemptCount,
      },
    };
    expect(validateCallback(callback, request, expected)).toBe(true);
    expect(
      validateCallback({ ...callback, sourceTimestamp: "2026-08-13T00:00:00.0009Z" }, request, {
        ...expected,
        acceptedState: {
          latestSourceTimestamp: null,
          acceptedReceiptIds: [],
          latestReceiptState: null,
          latestAttemptCount: null,
        },
      }),
    ).toBe(false);
    expect(
      validateCallback(callback, request, {
        ...expected,
        acceptedState: {
          latestSourceTimestamp: null,
          acceptedReceiptIds: [receipt.receiptId],
          latestReceiptState: null,
          latestAttemptCount: null,
        },
      }),
    ).toBe(false);
  });

  it("rejects callback state regression after a terminal receipt", () => {
    const regressedReceipt = {
      ...receipt,
      receiptId: "88888888-8888-4888-8888-888888888888",
      state: "running" as const,
      updatedAt: "2026-08-13T00:00:02.000Z",
    };
    const callback = {
      requestId: request.requestId,
      receiptId: regressedReceipt.receiptId,
      orgId: request.platform.orgId,
      callbackBindingRef: "evidence://callback/binding",
      sourceTimestamp: regressedReceipt.updatedAt,
      receipt: regressedReceipt,
    };
    expect(
      validateCallback(callback, request, {
        callbackBindingRef: "evidence://callback/binding",
        now: new Date("2026-08-13T12:00:00.000Z"),
        acceptedState: {
          latestSourceTimestamp: receipt.updatedAt,
          acceptedReceiptIds: [receipt.receiptId],
          latestReceiptState: "queued",
          latestAttemptCount: receipt.attemptCount,
        },
      }),
    ).toBe(true);
    expect(
      validateCallback(callback, request, {
        callbackBindingRef: "evidence://callback/binding",
        now: new Date("2026-08-13T12:00:00.000Z"),
        acceptedState: {
          latestSourceTimestamp: receipt.updatedAt,
          acceptedReceiptIds: [receipt.receiptId],
          latestReceiptState: "succeeded",
          latestAttemptCount: receipt.attemptCount,
        },
      }),
    ).toBe(false);
  });
});
