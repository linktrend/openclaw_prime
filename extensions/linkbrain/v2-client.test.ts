import { describe, expect, it } from "vitest";
import {
  assertBrainV2PlatformIdentity,
  createBrainV2Client as createBrainV2ClientRaw,
} from "./src/v2.js";
import type {
  BrainV2AuthenticatedProviderEvidence,
  BrainV2PlatformIdentity,
  BrainV2PlatformRevocationDecision,
  BrainV2TransportRequest,
} from "./src/v2.js";
import {
  NOW,
  activeRevocationDecision,
  authenticatedProviderEvidence,
  createBrainV2Client,
  expected,
  identity,
  identityExpectation,
  negotiation,
  page,
} from "./v2-test-fixtures.js";

type BrainV2ClientInput = Parameters<typeof createBrainV2ClientRaw>[0];

describe("LiNKbrain v2 client boundary", () => {
  it("requires negotiation before calls and never sends the credential reference", async () => {
    const requests: BrainV2TransportRequest[] = [];
    const transport = {
      async request(request: BrainV2TransportRequest) {
        requests.push(request);
        return request.method === "discover" ? negotiation : page("index");
      },
    };
    let now = NOW;
    const client = createBrainV2Client({
      identity: identity(),
      identityExpectation,
      transport,
      clock: () => now,
    });
    expect(await client.search("knowledge")).toMatchObject({
      ok: false,
      status: "contract_incompatible",
    });
    expect(await client.negotiate()).toMatchObject({ ok: true });
    expect(requests[0]?.contractVersion).toBe("brain.v2/2.0.0");
    expect(await client.search("knowledge")).toMatchObject({
      ok: true,
      data: { disclosure: "index" },
    });
    expect(await client.search("knowledge", "bad-cursor")).toMatchObject({
      ok: false,
      status: "contract_incompatible",
    });
    expect(await client.load("knowledge:1", "snapshot:brain-1")).toMatchObject({ ok: true });
    expect(requests[2]?.params).toMatchObject({ snapshotId: "snapshot:brain-1" });
    expect(await client.load("not a reference", "snapshot:brain-1")).toMatchObject({
      ok: false,
      status: "contract_incompatible",
    });
    expect(await client.load("knowledge:1", "not a snapshot")).toMatchObject({
      ok: false,
      status: "contract_incompatible",
    });
    expect(requests).toHaveLength(3);
    expect(await client.search("knowledge", "v2:25", "snapshot:other")).toMatchObject({
      ok: false,
      status: "contract_incompatible",
    });
    expect(await client.sendMessage({}, "")).toMatchObject({
      ok: false,
      status: "contract_incompatible",
    });
    expect(requests[1]).not.toHaveProperty("credentialReference");
    expect(requests[1]).not.toHaveProperty("credentialValue");
    expect(requests[1]?.contractVersion).toBe("brain.v2/2.0.0");
    now = "2026-08-14T13:00:00.000Z";
    expect(await client.search("knowledge")).toMatchObject({ ok: false, status: "unauthorized" });
    expect(requests).toHaveLength(4);
  });

  it("requires Platform execute authorization for Brain mutations", async () => {
    const requests: BrainV2TransportRequest[] = [];
    const client = createBrainV2Client({
      identity: { ...identity(), permittedOperations: ["read"] },
      identityExpectation,
      transport: {
        request: async (request) => {
          requests.push(request);
          return request.method === "discover" ? negotiation : page("index");
        },
      },
      clock: () => NOW,
    });

    await expect(client.negotiate()).resolves.toMatchObject({ ok: true });
    await expect(client.search("knowledge")).resolves.toMatchObject({ ok: true });
    await expect(
      client.sendMessage({ title: "bounded" }, "idem:brain:write:1"),
    ).resolves.toMatchObject({ ok: false, status: "unauthorized" });
    expect(requests).toHaveLength(2);
  });

  it("binds negotiation to authenticated provider evidence and fresh Platform revocation", async () => {
    const requests: BrainV2TransportRequest[] = [];
    let decision = activeRevocationDecision();
    const client = createBrainV2Client({
      identity: identity(),
      identityExpectation,
      authenticatedProviderEvidence: {
        ...authenticatedProviderEvidence,
        providerCandidate: { ...authenticatedProviderEvidence.providerCandidate, tree: "wrong" },
      } as unknown as BrainV2AuthenticatedProviderEvidence,
      resolveRevocationDecision: () => decision,
      transport: {
        request: async (request) => {
          requests.push(request);
          return request.method === "discover" ? negotiation : page("index");
        },
      },
      clock: () => NOW,
    });
    await expect(client.negotiate()).resolves.toMatchObject({
      ok: false,
      status: "contract_incompatible",
    });
    expect(requests).toHaveLength(0);

    const validClient = createBrainV2Client({
      identity: identity(),
      identityExpectation,
      resolveRevocationDecision: () => decision,
      transport: {
        request: async (request) => {
          requests.push(request);
          return request.method === "discover" ? negotiation : page("index");
        },
      },
      clock: () => NOW,
    });
    await expect(validClient.negotiate()).resolves.toMatchObject({ ok: true });
    decision = { ...decision, status: "revoked" };
    await expect(validClient.search("knowledge")).resolves.toMatchObject({
      ok: false,
      status: "unauthorized",
    });
    expect(requests).toHaveLength(1);

    decision = { ...activeRevocationDecision(), observedAt: "2026-08-14T11:54:59.000Z" };
    await expect(validClient.discovery()).resolves.toMatchObject({
      ok: false,
      status: "unauthorized",
    });
    expect(requests).toHaveLength(1);

    const newlyIssuedIdentity = { ...identity(), issuedAt: "2026-08-14T11:58:00.000Z" };
    const preIssueDecisionClient = createBrainV2Client({
      identity: newlyIssuedIdentity,
      identityExpectation,
      resolveRevocationDecision: () => ({
        ...activeRevocationDecision(),
        observedAt: "2026-08-14T11:57:00.000Z",
      }),
      transport: {
        request: async (request) => {
          requests.push(request);
          return negotiation;
        },
      },
      clock: () => NOW,
    });
    await expect(preIssueDecisionClient.negotiate()).resolves.toMatchObject({
      ok: false,
      status: "unauthorized",
    });
    expect(requests).toHaveLength(1);

    const malformedDecisionClient = createBrainV2Client({
      identity: identity(),
      identityExpectation,
      resolveRevocationDecision: () => ({
        ...activeRevocationDecision(),
        observedAt: "2026-02-30T00:00:00.000Z",
      }),
      transport: {
        request: async (request) => {
          requests.push(request);
          return negotiation;
        },
      },
      clock: () => NOW,
    });
    await expect(malformedDecisionClient.negotiate()).resolves.toMatchObject({
      ok: false,
      status: "contract_incompatible",
    });
    expect(requests).toHaveLength(1);
  });

  it("rechecks identity and revocation freshness after asynchronous resolution", async () => {
    let clock = NOW;
    const requests: BrainV2TransportRequest[] = [];
    const client = createBrainV2Client({
      identity: identity(),
      identityExpectation,
      resolveRevocationDecision: async () => {
        clock = "2026-08-14T13:00:00.000Z";
        return activeRevocationDecision();
      },
      transport: {
        request: async (request) => {
          requests.push(request);
          return negotiation;
        },
      },
      clock: () => clock,
    });
    await expect(client.negotiate()).resolves.toMatchObject({
      ok: false,
      status: "unauthorized",
    });
    expect(requests).toHaveLength(0);
  });

  it("keeps negotiation bound to the construction-time transport request", async () => {
    const requests: BrainV2TransportRequest[] = [];
    const replacementRequests: BrainV2TransportRequest[] = [];
    const transport = {
      request: async (request: BrainV2TransportRequest) => {
        requests.push(request);
        return request.method === "discover" ? negotiation : page("index");
      },
    };
    const client = createBrainV2Client({
      identity: identity(),
      identityExpectation,
      transport,
      clock: () => NOW,
    });
    await expect(client.negotiate()).resolves.toMatchObject({ ok: true });
    transport.request = async (request: BrainV2TransportRequest) => {
      replacementRequests.push(request);
      return page("index");
    };
    await expect(client.search("knowledge")).resolves.toMatchObject({ ok: true });
    expect(requests).toHaveLength(2);
    expect(replacementRequests).toHaveLength(0);
  });

  it("rejects accessor-backed provider evidence and revocation facts without invoking getters", async () => {
    let getterCalls = 0;
    const requests: BrainV2TransportRequest[] = [];
    const transport = {
      request: async (request: BrainV2TransportRequest) => {
        requests.push(request);
        return negotiation;
      },
    };
    const evidenceInput = {
      identity: identity(),
      identityExpectation,
      resolveRevocationDecision: activeRevocationDecision,
      transport,
      clock: () => NOW,
    } as unknown as BrainV2ClientInput;
    Object.defineProperty(evidenceInput, "authenticatedProviderEvidence", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return authenticatedProviderEvidence;
      },
    });
    const evidenceClient = createBrainV2ClientRaw(evidenceInput);
    await expect(evidenceClient.negotiate()).resolves.toMatchObject({
      ok: false,
      status: "contract_incompatible",
    });
    expect(getterCalls).toBe(0);

    const resolverInput = {
      identity: identity(),
      identityExpectation,
      authenticatedProviderEvidence,
      transport,
      clock: () => NOW,
    } as unknown as BrainV2ClientInput;
    Object.defineProperty(resolverInput, "resolveRevocationDecision", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return activeRevocationDecision;
      },
    });
    const resolverClient = createBrainV2ClientRaw(resolverInput);
    await expect(resolverClient.negotiate()).resolves.toMatchObject({
      ok: false,
      status: "contract_incompatible",
    });
    expect(getterCalls).toBe(0);

    const accessorDecision = { ...activeRevocationDecision() } as Record<string, unknown>;
    Object.defineProperty(accessorDecision, "status", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "active";
      },
    });
    const decisionClient = createBrainV2Client({
      identity: identity(),
      identityExpectation,
      resolveRevocationDecision: () => accessorDecision as BrainV2PlatformRevocationDecision,
      transport,
      clock: () => NOW,
    });
    await expect(decisionClient.negotiate()).resolves.toMatchObject({
      ok: false,
      status: "contract_incompatible",
    });
    expect(getterCalls).toBe(0);
    expect(requests).toHaveLength(0);
  });

  it("uses independent trusted expectations and revalidates checkpoint writes at runtime", async () => {
    const requests: BrainV2TransportRequest[] = [];
    const transport = {
      async request(request: BrainV2TransportRequest) {
        requests.push(request);
        return request.method === "discover" ? negotiation : page("metadata");
      },
    };
    const client = createBrainV2Client({
      identity: identity(),
      identityExpectation: { ...identityExpectation, actorId: "actor:intended" },
      transport,
      clock: () => NOW,
    });
    expect(await client.negotiate()).toMatchObject({ ok: false, status: "unauthorized" });
    const validClient = createBrainV2Client({
      identity: identity(),
      identityExpectation,
      transport,
      clock: () => NOW,
    });
    expect(await validClient.negotiate()).toMatchObject({ ok: true });
    expect(
      await validClient.writeCheckpoint({
        namespace: "public",
        checkpointRef: "checkpoint:bad",
        idempotencyKey: "idem:bad",
        metadata: {},
      } as never),
    ).toMatchObject({ ok: false });
    expect(
      await validClient.writeCheckpoint({
        namespace: "private",
        checkpointRef: "checkpoint:array",
        idempotencyKey: "idem:array",
        metadata: { tags: ["safe", "bounded"] },
      }),
    ).toMatchObject({ ok: true });
    expect(requests).toHaveLength(2);
  });

  it("rejects accessor-backed Platform bindings without invoking their getters", async () => {
    for (const field of ["runtimeBindingRef", "organizationRef"] as const) {
      let reads = 0;
      const accessorIdentity = identity() as unknown as Record<string, unknown>;
      Object.defineProperty(accessorIdentity, field, {
        enumerable: true,
        get() {
          reads += 1;
          return reads === 1 ? identity()[field] : `${identity()[field]}:changed`;
        },
      });
      expect(() => assertBrainV2PlatformIdentity(accessorIdentity, expected)).toThrow(
        `brain_v2_identity_field_not_own_data:${field}`,
      );
      expect(reads).toBe(0);
      const requests: BrainV2TransportRequest[] = [];
      const client = createBrainV2Client({
        identity: accessorIdentity as BrainV2PlatformIdentity,
        identityExpectation,
        transport: {
          request: async (request) => {
            requests.push(request);
            return negotiation;
          },
        },
        clock: () => NOW,
      });

      await expect(client.negotiate()).resolves.toMatchObject({
        ok: false,
        status: "unauthorized",
      });
      expect(reads).toBe(0);
      expect(requests).toHaveLength(0);
    }
  });

  it("rejects inherited Platform bindings from a polluted prototype", async () => {
    let reads = 0;
    const pollutedProto = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(pollutedProto, "runtimeBindingRef", {
      configurable: true,
      enumerable: true,
      get() {
        reads += 1;
        return reads === 1 ? "binding:ocp-brain" : "binding:changed";
      },
    });
    const base = { ...identity() } as Record<string, unknown>;
    delete base.runtimeBindingRef;
    const sourceIdentity = Object.assign(Object.create(pollutedProto), base) as Record<
      string,
      unknown
    >;
    const requests: BrainV2TransportRequest[] = [];
    const client = createBrainV2Client({
      identity: sourceIdentity as BrainV2PlatformIdentity,
      identityExpectation,
      transport: {
        request: async (request) => {
          requests.push(request);
          return negotiation;
        },
      },
      clock: () => NOW,
    });

    await expect(client.negotiate()).resolves.toMatchObject({
      ok: false,
      status: "unauthorized",
    });
    expect(reads).toBe(0);
    expect(requests).toHaveLength(0);
  });

  it("uses only the construction-time Platform identity snapshot for transport", async () => {
    const sourceIdentity = identity() as unknown as Record<string, unknown>;
    const requests: BrainV2TransportRequest[] = [];
    const client = createBrainV2Client({
      identity: sourceIdentity as BrainV2PlatformIdentity,
      identityExpectation,
      transport: {
        request: async (request) => {
          requests.push(request);
          return negotiation;
        },
      },
      clock: () => NOW,
    });

    sourceIdentity.runtimeBindingRef = "binding:changed-after-construction";
    sourceIdentity.organizationRef = "org:changed-after-construction";

    await expect(client.negotiate()).resolves.toMatchObject({ ok: true });
    expect(requests[0]).toMatchObject({
      actorBindingRef: "binding:ocp-brain",
      organizationRef: "org:linktrend",
    });
  });

  it("rejects sparse authorization arrays populated through inherited index getters", async () => {
    let reads = 0;
    const pollutedArrayProto = Object.create(Array.prototype) as unknown[];
    Object.defineProperty(pollutedArrayProto, "0", {
      configurable: true,
      enumerable: true,
      get() {
        reads += 1;
        return "brain.v2";
      },
    });
    const sparseScopes = Object.create(pollutedArrayProto) as string[];
    Object.defineProperty(sparseScopes, "length", {
      value: 1,
      writable: true,
      configurable: true,
      enumerable: false,
    });
    const sourceIdentity = { ...identity(), serviceScopes: sparseScopes };
    const requests: BrainV2TransportRequest[] = [];
    const client = createBrainV2Client({
      identity: sourceIdentity,
      identityExpectation,
      transport: {
        request: async (request) => {
          requests.push(request);
          return negotiation;
        },
      },
      clock: () => NOW,
    });
    expect(reads).toBe(0);

    await expect(client.negotiate()).resolves.toMatchObject({
      ok: false,
      status: "unauthorized",
    });
    expect(reads).toBe(0);
    expect(requests).toHaveLength(0);
  });

  it("rejects accessor-backed authorization elements without invoking getters", async () => {
    for (const field of ["serviceScopes", "capabilities", "permittedOperations"] as const) {
      const values =
        field === "serviceScopes"
          ? ["brain.v2"]
          : field === "capabilities"
            ? ["brain.knowledge"]
            : ["read", "execute"];
      let reads = 0;
      Object.defineProperty(values, "0", {
        configurable: true,
        enumerable: true,
        get() {
          reads += 1;
          return reads === 1 ? identity()[field][0] : "changed";
        },
      });
      const requests: BrainV2TransportRequest[] = [];
      const client = createBrainV2Client({
        identity: { ...identity(), [field]: values },
        identityExpectation,
        transport: {
          request: async (request) => {
            requests.push(request);
            return negotiation;
          },
        },
        clock: () => NOW,
      });

      await expect(client.negotiate()).resolves.toMatchObject({
        ok: false,
        status: "unauthorized",
      });
      expect(reads).toBe(0);
      expect(requests).toHaveLength(0);
    }
  });

  it("uses construction-time authorization arrays after source mutation", async () => {
    const sourceScopes = [...identity().serviceScopes];
    const sourceCapabilities = [...identity().capabilities];
    const sourceOperations = [...identity().permittedOperations];
    const sourceIdentity = {
      ...identity(),
      serviceScopes: sourceScopes,
      capabilities: sourceCapabilities,
      permittedOperations: sourceOperations,
    };
    const requests: BrainV2TransportRequest[] = [];
    const client = createBrainV2Client({
      identity: sourceIdentity,
      identityExpectation,
      transport: {
        request: async (request) => {
          requests.push(request);
          return negotiation;
        },
      },
      clock: () => NOW,
    });

    sourceScopes[0] = "changed";
    sourceCapabilities[0] = "changed";
    sourceOperations[0] = "execute";

    await expect(client.negotiate()).resolves.toMatchObject({ ok: true });
    expect(requests).toHaveLength(1);
  });

  it("returns safe unavailable results without a silent downgrade", async () => {
    const client = createBrainV2Client({
      identity: identity(),
      identityExpectation,
      transport: {
        request: async () => {
          throw new Error("offline");
        },
      },
      clock: () => NOW,
    });
    expect(await client.negotiate()).toMatchObject({ ok: false, status: "offline" });
    expect(await client.discovery()).toMatchObject({ ok: false, status: "contract_incompatible" });
  });

  it("sanitizes transport failure reasons", async () => {
    const client = createBrainV2Client({
      identity: identity(),
      identityExpectation,
      transport: {
        request: async () => {
          throw Object.assign(new Error("transport offline"), {
            status: "offline",
            reason: "Bearer secret-value",
          });
        },
      },
      clock: () => NOW,
    });

    await expect(client.negotiate()).resolves.toEqual({
      ok: false,
      status: "offline",
      reason: "brain_v2_offline",
    });
  });

  it("never reports a failed transport operation as available", async () => {
    const client = createBrainV2Client({
      identity: identity(),
      identityExpectation,
      transport: {
        request: async () => {
          throw Object.assign(new Error("malformed"), {
            status: "available",
            reason: "malformed",
          });
        },
      },
      clock: () => NOW,
    });
    await expect(client.negotiate()).resolves.toEqual({
      ok: false,
      status: "offline",
      reason: "brain_v2_offline",
    });
  });

  it("contains accessor-backed transport failures without invoking getters", async () => {
    let getterCalls = 0;
    const failure = new Error("accessor-backed transport failure");
    Object.defineProperty(failure, "status", {
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error("must not run");
      },
    });
    const client = createBrainV2Client({
      identity: identity(),
      identityExpectation,
      transport: {
        request: async () => {
          throw failure;
        },
      },
      clock: () => NOW,
    });
    await expect(client.negotiate()).resolves.toEqual({
      ok: false,
      status: "offline",
      reason: "brain_v2_offline",
    });
    expect(getterCalls).toBe(0);
  });

  it("rejects accessor-backed provider pages before any getter can change values", async () => {
    let reads = 0;
    const providerPage = page("index") as Record<string, unknown>;
    Object.defineProperty(providerPage, "data", {
      enumerable: true,
      get() {
        reads += 1;
        return reads === 1 ? { reference: "knowledge:1", title: "safe" } : { token: "secret" };
      },
    });
    const client = createBrainV2Client({
      identity: identity(),
      identityExpectation,
      transport: {
        request: async (request) => (request.method === "discover" ? negotiation : providerPage),
      },
      clock: () => NOW,
    });

    await expect(client.negotiate()).resolves.toMatchObject({ ok: true });
    await expect(client.search("knowledge")).resolves.toMatchObject({
      ok: false,
      status: "contract_incompatible",
    });
    expect(reads).toBe(0);
  });
});
