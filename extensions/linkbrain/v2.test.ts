import { describe, expect, it } from "vitest";
import {
  BRAIN_V2_DISCLOSURE_LEVELS,
  BRAIN_V2_OPERATIONS,
  LINKBRAIN_V2_COMMIT,
  LINKBRAIN_V2_CONTRACT_VERSION,
  LINKBRAIN_V2_TREE,
  assertBrainV2Negotiation,
  assertBrainV2Page,
  assertBrainV2PlatformIdentity,
  assertBrainV2SafePayload,
  preparePrivateCapture,
  preparePrivateCheckpoint,
} from "./src/v2.js";
import {
  NOW,
  createBrainV2Client,
  expected,
  identity,
  identityExpectation,
  negotiation,
  page,
} from "./v2-test-fixtures.js";

describe("LiNKbrain v2 immutable consumer boundary", () => {
  it("pins the final provider and exposes the ordered contract surface", () => {
    expect(LINKBRAIN_V2_COMMIT).toBe("7eb19cec8ae3cf61b0369167dd3f699675546b28");
    expect(LINKBRAIN_V2_TREE).toBe("c489ed4de06790ef1daade75688b818ff62c7a4f");
    expect(BRAIN_V2_DISCLOSURE_LEVELS).toEqual([
      "guide",
      "index",
      "metadata",
      "record",
      "evidence",
    ]);
    expect(BRAIN_V2_OPERATIONS).toContain("v2.knowledge.search");
    expect(BRAIN_V2_OPERATIONS).toContain("v2.checkpoint.write");
  });

  it("accepts Date-valued identity and revocation clocks without reparsing them", async () => {
    expect(() =>
      assertBrainV2PlatformIdentity(identity(), { ...expected, now: new Date(NOW) }),
    ).not.toThrow();
    const client = createBrainV2Client({
      identity: identity(),
      identityExpectation,
      transport: {
        request: async (request) => (request.method === "discover" ? negotiation : page("index")),
      },
      clock: () => new Date(NOW),
    });
    await expect(client.negotiate()).resolves.toMatchObject({ ok: true });
    await expect(client.search("knowledge")).resolves.toMatchObject({ ok: true });
  });

  it("accepts Platform trust facts only when actor, binding, audience, scope and capability match", () => {
    expect(() => assertBrainV2PlatformIdentity(identity(), expected)).not.toThrow();
    for (const field of ["audience", "runtimeBindingRef", "issuer"] as const) {
      const candidate = { ...identity(), [field]: `${identity()[field]}:wrong` };
      expect(() => assertBrainV2PlatformIdentity(candidate, expected)).toThrow();
    }
    expect(() =>
      assertBrainV2PlatformIdentity({ ...identity(), serviceScopes: ["other"] }, expected),
    ).toThrow();
    expect(() =>
      assertBrainV2PlatformIdentity({ ...identity(), capabilities: ["other"] }, expected),
    ).toThrow();
    expect(() =>
      assertBrainV2PlatformIdentity({ ...identity(), revocationStatus: "revoked" }, expected),
    ).toThrow();
    expect(() =>
      assertBrainV2PlatformIdentity({ ...identity(), expiresAt: NOW }, expected),
    ).toThrow();
    expect(() =>
      assertBrainV2PlatformIdentity({ ...identity(), secret: "never" }, expected),
    ).toThrow();
  });

  it("rejects stale, future, malformed and incorrectly pinned Platform facts", () => {
    expect(() =>
      assertBrainV2PlatformIdentity(
        { ...identity(), issuedAt: "2026-08-14T13:00:01.000Z" },
        expected,
      ),
    ).toThrow();
    expect(() =>
      assertBrainV2PlatformIdentity({ ...identity(), expiresAt: "not-a-time" }, expected),
    ).toThrow();
    expect(() =>
      assertBrainV2PlatformIdentity(
        { ...identity(), issuedAt: "2026-02-30T00:00:00.000Z" },
        expected,
      ),
    ).toThrow();
    expect(() =>
      assertBrainV2PlatformIdentity(
        { ...identity(), issuedAt: "2026-08-14T24:00:00.000Z" },
        expected,
      ),
    ).toThrow();
    expect(() =>
      assertBrainV2PlatformIdentity(
        { ...identity(), issuedAt: "2026-08-14T12:00:00.0009Z" },
        expected,
      ),
    ).toThrow();
    expect(() =>
      assertBrainV2PlatformIdentity(
        {
          ...identity(),
          providerCandidate: { commit: "a".repeat(40), tree: identity().providerCandidate.tree },
        },
        expected,
      ),
    ).toThrow();
  });

  it("requires modern sessionless negotiation and fails closed for v1 or session IDs", () => {
    expect(LINKBRAIN_V2_CONTRACT_VERSION).toBe("brain.v2/2.0.0");
    expect(() => assertBrainV2Negotiation(negotiation)).not.toThrow();
    for (const candidate of [
      { ...negotiation, protocolVersion: "2025-06-18" },
      { ...negotiation, sessionless: false },
      { ...negotiation, contractVersion: "2.0.0" },
      { ...negotiation, contractVersion: "other.v2/2.0.0" },
      { ...negotiation, contractVersion: "1.0.0" },
      { ...negotiation, sdkSupportsModernProtocol: false },
      { ...negotiation, sessionId: "session-1" },
    ]) {
      expect(() => assertBrainV2Negotiation(candidate)).toThrow();
    }
    expect(() => assertBrainV2Negotiation(Object.create(negotiation))).toThrow();
    let getterCalls = 0;
    const accessorNegotiation = { ...negotiation } as Record<string, unknown>;
    Object.defineProperty(accessorNegotiation, "contractVersion", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return LINKBRAIN_V2_CONTRACT_VERSION;
      },
    });
    expect(() => assertBrainV2Negotiation(accessorNegotiation)).toThrow();
    expect(getterCalls).toBe(0);
  });

  it("enforces operation-specific disclosure ceilings, snapshot stability and cursors", () => {
    expect(() => assertBrainV2Page(page("index"), "v2.knowledge.search")).not.toThrow();
    expect(() => assertBrainV2Page(page("record"), "v2.knowledge.search")).toThrow();
    expect(() =>
      assertBrainV2Page(page("record"), "v2.knowledge.load", "snapshot:other"),
    ).toThrow();
    expect(() =>
      assertBrainV2Page(
        { ...page("index"), pagination: { limit: 25, cursor: "old:1" } },
        "v2.knowledge.search",
      ),
    ).toThrow();
    expect(() =>
      assertBrainV2Page(
        { ...page("index"), pagination: { limit: 25, cursor: "v2:999" } },
        "v2.knowledge.search",
      ),
    ).toThrow("brain_v2_pagination_cursor_mismatch");
    expect(() =>
      assertBrainV2Page(
        {
          ...page("index"),
          pagination: { limit: 25, cursor: "v2:25", nextCursor: "v2:25" },
        },
        "v2.knowledge.search",
        "snapshot:brain-1",
        "v2:25",
      ),
    ).toThrow("brain_v2_pagination_nextCursor_not_advanced");
    expect(() =>
      assertBrainV2Page(
        {
          ...page("index"),
          pagination: {
            limit: 25,
            cursor: "v2:9007199254740992",
            nextCursor: "v2:9007199254740993",
          },
        },
        "v2.knowledge.search",
        "snapshot:brain-1",
        "v2:9007199254740992",
      ),
    ).not.toThrow();
    expect(() =>
      assertBrainV2Page(
        {
          ...page("index"),
          pagination: {
            limit: 25,
            cursor: "v2:9007199254740993",
            nextCursor: "v2:9007199254740992",
          },
        },
        "v2.knowledge.search",
        "snapshot:brain-1",
        "v2:9007199254740993",
      ),
    ).toThrow("brain_v2_pagination_nextCursor_not_advanced");
    expect(() =>
      assertBrainV2Page(
        { ...page("index"), pagination: { limit: 25, cursor: "v2:0" } },
        "v2.knowledge.search",
        "snapshot:brain-1",
        "v2:25",
      ),
    ).toThrow("brain_v2_pagination_cursor_mismatch");
    expect(() =>
      assertBrainV2Page(
        { ...page("index"), pagination: { limit: 25, payload: { transcript: "blocked" } } },
        "v2.knowledge.search",
      ),
    ).toThrow();
    expect(() =>
      assertBrainV2Page({ ...page("index"), data: { content: "private" } }, "v2.knowledge.search"),
    ).toThrow();
    expect(() =>
      assertBrainV2Page(
        { snapshotId: "snapshot:brain-1", disclosure: "index", pagination: { limit: 25 } },
        "v2.knowledge.search",
      ),
    ).toThrow();
    expect(() => assertBrainV2SafePayload({ nested: { apiKey: "blocked" } })).toThrow();
    expect(() =>
      assertBrainV2SafePayload({ nested: { Authorization: "Bearer blocked" } }),
    ).toThrow();
    expect(() => assertBrainV2SafePayload({ Transcript: "blocked" })).toThrow();
    expect(() => assertBrainV2SafePayload({ accessToken: "blocked" })).toThrow();
    expect(() => assertBrainV2SafePayload({ toJSON: () => ({ transcript: "blocked" }) })).toThrow();
    expect(() => assertBrainV2SafePayload({ value: new Date() })).toThrow();
    expect(() =>
      assertBrainV2SafePayload({ nested: { depth: { deeper: { value: "x" } } } }),
    ).not.toThrow();
    expect(() =>
      assertBrainV2SafePayload(
        Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`k${i}`, i])),
      ),
    ).toThrow();
  });

  it("rejects reasoning, secrets, raw output, payloads and identity overrides", () => {
    for (const key of [
      "reasoning",
      "secret",
      "rawToolOutput",
      "transcript",
      "payload",
      "actorId",
      "databasePassword",
      "openaiApiKey",
      "authorizationHeader",
      "privateKeyPem",
      "awsAccessKey",
    ]) {
      expect(() => assertBrainV2SafePayload({ [key]: "blocked" })).toThrow();
    }
    expect(() =>
      assertBrainV2SafePayload({ refs: ["knowledge:1"], metadata: { title: "safe" } }),
    ).not.toThrow();
    const safeArray = assertBrainV2SafePayload({ refs: ["knowledge:1", "knowledge:2"] });
    expect(safeArray.refs.map((value) => value.toUpperCase())).toEqual([
      "KNOWLEDGE:1",
      "KNOWLEDGE:2",
    ]);
    expect([...safeArray.refs]).toEqual(["knowledge:1", "knowledge:2"]);
    expect(() => assertBrainV2SafePayload({ metadata: { actorId: "other" } })).toThrow();
    expect(() => assertBrainV2SafePayload({ metadata: { capability: "execution" } })).toThrow();
    expect(() => assertBrainV2SafePayload({ metadata: { capabilities: ["execution"] } })).toThrow();
    expect(() => assertBrainV2SafePayload({ text: "x".repeat(513) })).toThrow();
    for (const sensitive of [
      ["Bear", "er credential-value"].join(""),
      [["api", "key"].join("_"), "credential-value"].join("="),
      [["pass", "word"].join(""), ["hunter", "2"].join("")].join("="),
      [["client", "secret"].join("_"), "credential-value"].join(":"),
      [["private", "key"].join("_"), "credential-value"].join("="),
      [["to", "ken"].join(""), "credential-value"].join(":"),
      [["s", "k-proj-"].join(""), "a".repeat(24)].join(""),
      [["raw", "transcript"].join(" "), "from a private conversation"].join(" "),
      ["-----BEGIN", ["PRIVATE", "KEY-----"].join(" ")].join(" "),
    ]) {
      expect(() => assertBrainV2SafePayload({ note: sensitive })).toThrow();
    }
  });

  it("rejects accessor-backed payloads without evaluating changing getters", () => {
    let reads = 0;
    const changingPayload = {} as Record<string, unknown>;
    Object.defineProperty(changingPayload, "metadata", {
      enumerable: true,
      get() {
        reads += 1;
        return reads === 1 ? { title: "safe" } : { token: "secret" };
      },
    });

    expect(() => assertBrainV2SafePayload(changingPayload)).toThrow("brain_v2_accessor_payload");
    expect(reads).toBe(0);
  });

  it("requires explicit private namespaces and bounded idempotency references", () => {
    expect(
      preparePrivateCapture({
        namespace: "private",
        captureRef: "capture:1",
        idempotencyKey: "idem:1",
        metadata: { kind: "note" },
      }),
    ).toMatchObject({ namespace: "private" });
    expect(
      preparePrivateCheckpoint({
        namespace: "private",
        checkpointRef: "checkpoint:1",
        idempotencyKey: "idem:2",
        metadata: { state: "bounded" },
      }),
    ).toMatchObject({ namespace: "private", checkpointRef: "checkpoint:1" });
    expect(() =>
      preparePrivateCapture({
        namespace: "private",
        captureRef: "capture:1",
        idempotencyKey: "idem:1",
        metadata: { transcript: "blocked" },
      }),
    ).toThrow();
    const credentialShaped = [["gh", "p_"].join(""), "a".repeat(20)].join("");
    expect(() =>
      preparePrivateCapture({
        namespace: "private",
        captureRef: credentialShaped,
        idempotencyKey: "idem:1",
        metadata: {},
      }),
    ).toThrow();
    expect(() =>
      preparePrivateCheckpoint({
        namespace: "private",
        checkpointRef: "checkpoint:1",
        idempotencyKey: credentialShaped,
        metadata: {},
      }),
    ).toThrow();
    expect(() =>
      preparePrivateCapture({
        namespace: "private",
        captureRef: "",
        idempotencyKey: "idem:1",
        metadata: {},
      }),
    ).toThrow();
    expect(() =>
      preparePrivateCapture({
        captureRef: "capture:1",
        idempotencyKey: "idem:1",
        metadata: {},
      } as never),
    ).toThrow();
  });

  it("returns isolated validated metadata from private preparation", () => {
    const captureMetadata = { nested: { label: "capture" } };
    const checkpointMetadata = { nested: { label: "checkpoint" } };
    const capture = preparePrivateCapture({
      namespace: "private",
      captureRef: "capture:1",
      idempotencyKey: "idem:1",
      metadata: captureMetadata,
    });
    const checkpoint = preparePrivateCheckpoint({
      namespace: "private",
      checkpointRef: "checkpoint:1",
      idempotencyKey: "idem:2",
      metadata: checkpointMetadata,
    });

    captureMetadata.nested.label = "mutated";
    checkpointMetadata.nested.label = "mutated";

    expect(capture.metadata).toEqual({ nested: { label: "capture" } });
    expect(checkpoint.metadata).toEqual({ nested: { label: "checkpoint" } });
    expect(capture.metadata).not.toBe(captureMetadata);
    expect(checkpoint.metadata).not.toBe(checkpointMetadata);
  });

  it("rejects accessor-backed private wrappers without invoking getters", () => {
    let getterCalls = 0;
    const capture = {
      namespace: "private",
      idempotencyKey: "idem:1",
      metadata: { title: "safe" },
    } as Record<string, unknown>;
    Object.defineProperty(capture, "captureRef", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return getterCalls === 1 ? "capture:1" : "x".repeat(600);
      },
    });
    expect(() => preparePrivateCapture(capture as never)).toThrow();
    expect(getterCalls).toBe(0);

    const checkpoint = {
      namespace: "private",
      checkpointRef: "checkpoint:1",
      metadata: { title: "safe" },
    } as Record<string, unknown>;
    Object.defineProperty(checkpoint, "idempotencyKey", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "idem:2";
      },
    });
    expect(() => preparePrivateCheckpoint(checkpoint as never)).toThrow();
    expect(getterCalls).toBe(0);
  });
});
