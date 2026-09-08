/**
 * Brain capture-batch wire contract: shape, role map, deterministic replay,
 * invalid/empty input, shutdown/restart drain, and MCP isError regression.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import { describe, expect, it, vi } from "vitest";
import {
  assertBrainWireCaptureBatch,
  brainCaptureRequestHashMaterial,
  buildBrainWireCaptureBatch,
  mapCaptureEventType,
  mapCaptureRoleToBrain,
  stripActorOverrideFields,
  type CaptureBufferEvent,
} from "./src/capture-batch-adapter.js";
import { createLinkbrainCapture } from "./src/capture.js";
import { parseLinkbrainConfig } from "./src/config.js";
import { contentHash } from "./src/opaque.js";
import { createLinkbrainRuntime } from "./src/runtime.js";
import { openLinkbrainStores } from "./src/stores.js";
import { createMemoryKeyedStore } from "./src/test-support/memory-store.js";
import { resolveLinkbrainTransport } from "./src/transport.js";

type AjvValidator = (data: unknown) => boolean;
type AjvLike = { compile(schema: unknown): AjvValidator };
const AjvConstructor = Ajv as unknown as new (options: Record<string, unknown>) => AjvLike;

/** Frozen live MCP inputSchema for brain_capture_batch (additionalProperties:false). */
const FROZEN_BRAIN_CAPTURE_BATCH_MCP_SCHEMA = {
  type: "object",
  properties: {
    actor_id: {},
    actorId: {},
    platformActorId: {},
    actorBindingId: {},
    batch: {
      type: "object",
      additionalProperties: {},
    },
  },
  additionalProperties: false,
} as const;

const fixturesRoot = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function readJson<T>(rel: string): T {
  return JSON.parse(readFileSync(join(fixturesRoot, rel), "utf8")) as T;
}

function createTestStores(maxEntries = 200) {
  return openLinkbrainStores({
    maxEntries,
    openKeyedStore: (options) =>
      createMemoryKeyedStore({
        maxEntries: options.maxEntries,
        overflowPolicy: "reject-new",
      }),
  });
}

const fixedEvents: CaptureBufferEvent[] = [
  {
    sequence: 1,
    role: "user",
    text: "Hello Lisa test.",
    acceptedAtMs: 1_783_000_000_001,
  },
  {
    sequence: 2,
    role: "assistant",
    text: "Acknowledged.",
    acceptedAtMs: 1_783_000_000_002,
  },
];

describe("linkbrain brain capture contract adapter", () => {
  it("mirrors frozen Brain capture contract fixture without cross-repo dependency", () => {
    const contract = readJson<{
      BRAIN_CONTRACT_VERSION: string;
      captureBatchInput: { required: string[]; forbiddenActorOverrides: string[] };
      conversationEvent: { role: string[]; eventType: string[] };
      roleMappingFromOpenClawCapture: Record<string, string>;
    }>("contracts/brain-capture-batch.contract.json");
    expect(contract.BRAIN_CONTRACT_VERSION).toBe("1.0.0");
    expect(contract.captureBatchInput.required).toEqual(
      expect.arrayContaining(["batchId", "sessionId", "idempotencyKey", "capturedAt", "events"]),
    );
    expect(contract.conversationEvent.role).toEqual([
      "actor",
      "principal",
      "assistant",
      "tool",
      "system",
    ]);
    expect(contract.roleMappingFromOpenClawCapture.user).toBe("principal");
    expect(contract.roleMappingFromOpenClawCapture.human).toBe("principal");

    const request = readJson<{
      arguments: { batch: unknown; idempotencyKey?: string };
    }>("tools/private/brain_capture_batch.request.json");
    const batch = assertBrainWireCaptureBatch(request.arguments.batch);
    expect(batch.sessionId).toBe("session_test_lisa");
    expect(batch.events[0]?.role).toBe("principal");
    expect(batch).not.toHaveProperty("streamId");
    expect(batch).not.toHaveProperty("contentHash");
    expect(batch).not.toHaveProperty("actorId");
    for (const key of contract.captureBatchInput.forbiddenActorOverrides) {
      expect(batch).not.toHaveProperty(key);
    }
  });

  it("builds exact Brain wire shape and maps roles safely", () => {
    expect(mapCaptureRoleToBrain("user")).toBe("principal");
    expect(mapCaptureRoleToBrain("human")).toBe("principal");
    expect(mapCaptureRoleToBrain("tool_summary")).toBe("tool");
    expect(mapCaptureEventType("tool_summary")).toBe("tool_result");

    const batch = buildBrainWireCaptureBatch({
      sessionId: "session_contract_test",
      events: [
        ...fixedEvents,
        {
          sequence: 3,
          role: "tool_summary",
          text: "tool done",
          acceptedAtMs: 1_783_000_000_003,
        },
        {
          sequence: 4,
          role: "system",
          text: "status",
          acceptedAtMs: 1_783_000_000_004,
        },
      ],
    });
    expect(assertBrainWireCaptureBatch(batch)).toEqual(batch);
    expect(batch.events.map((e) => e.role)).toEqual(["principal", "assistant", "tool", "system"]);
    expect(batch.events.map((e) => e.eventType)).toEqual([
      "message",
      "message",
      "tool_result",
      "message",
    ]);
    expect(batch).not.toHaveProperty("streamId");
    expect(batch).not.toHaveProperty("fromSequence");
    expect(batch).not.toHaveProperty("actorBindingId");
  });

  it("deterministic replay yields identical request-hash material for same idempotency key", () => {
    const first = buildBrainWireCaptureBatch({
      sessionId: "session_replay",
      events: fixedEvents,
    });
    const second = buildBrainWireCaptureBatch({
      sessionId: "session_replay",
      events: fixedEvents,
    });
    expect(first.idempotencyKey).toBe(second.idempotencyKey);
    expect(first).toEqual(second);
    expect(contentHash(brainCaptureRequestHashMaterial(first))).toBe(
      contentHash(brainCaptureRequestHashMaterial(second)),
    );
  });

  it("rejects empty events and unsupported roles; strips actor overrides", () => {
    expect(() => buildBrainWireCaptureBatch({ sessionId: "session_empty", events: [] })).toThrow(
      /non-empty events/,
    );
    expect(() => mapCaptureRoleToBrain("narrator")).toThrow(/unsupported capture role/);
    expect(() =>
      assertBrainWireCaptureBatch({
        batchId: "batch_x",
        sessionId: "session_x",
        idempotencyKey: "cap:session_x:1:1",
        capturedAt: "2026-07-27T10:00:00.000Z",
        actorId: "spoof",
        events: [
          {
            eventId: "event_x",
            sequence: 1,
            occurredAt: "2026-07-27T10:00:00.000Z",
            role: "principal",
            eventType: "message",
            content: "x",
            classification: "private",
          },
        ],
      }),
    ).toThrow(/actor override/);
    const stripped = stripActorOverrideFields({
      batchId: "b",
      actorId: "nope",
      actorBindingId: "nope",
      sessionId: "s",
    });
    expect(stripped).not.toHaveProperty("actorId");
    expect(stripped).not.toHaveProperty("actorBindingId");
  });

  it("shutdown/restart drain emits Brain wire batch and preserves sequence order", async () => {
    const stores = createTestStores();
    const config = parseLinkbrainConfig({
      captureEnqueue: true,
      captureDrain: true,
      batchMaxEvents: 8,
    });
    let tick = 90_000;
    const now = () => {
      tick += 1;
      return tick;
    };
    const firstRuntime = createLinkbrainRuntime({
      config,
      stores,
      transport: {
        async write() {
          return { ok: true, result: { accepted: true } };
        },
      },
      now,
    });
    await firstRuntime.open();
    vi.spyOn(firstRuntime, "enqueueWrite").mockRejectedValue(
      new Error("linkbrain: forced enqueue failure"),
    );
    const firstCapture = createLinkbrainCapture({
      config,
      stores,
      runtime: firstRuntime,
      now,
      operationTimeoutMs: 1_500,
    });
    await firstCapture.enqueue({
      streamKey: "agent:lisa:contract-restart",
      role: "user",
      text: "one",
      fingerprint: "fp-1",
    });
    await firstCapture.enqueue({
      streamKey: "agent:lisa:contract-restart",
      role: "assistant",
      text: "two",
      fingerprint: "fp-2",
    });
    await firstRuntime.shutdown();

    const drainedArgs: Array<Record<string, unknown>> = [];
    const secondRuntime = createLinkbrainRuntime({
      config,
      stores,
      transport: {
        async write(params) {
          drainedArgs.push(params.arguments);
          return { ok: true, result: { accepted: true } };
        },
      },
      now,
    });
    await secondRuntime.open();
    const secondCapture = createLinkbrainCapture({
      config,
      stores,
      runtime: secondRuntime,
      now,
      operationTimeoutMs: 1_500,
    });
    const flushed = await secondCapture.flush("agent:lisa:contract-restart", "gateway_stop");
    expect(flushed.batches).toBe(1);
    const drain = await secondRuntime.drainOnce();
    expect(drain.drained).toBe(1);
    expect(drainedArgs).toHaveLength(1);
    const args = drainedArgs[0]!;
    expect(args).not.toHaveProperty("idempotencyKey");
    const batch = assertBrainWireCaptureBatch(args.batch);
    expect(batch.idempotencyKey).toEqual(expect.any(String));
    expect(batch.events.map((e) => e.sequence)).toEqual([1, 2]);
    expect(batch.events.map((e) => e.role)).toEqual(["principal", "assistant"]);
    expect(batch.events[0]?.content).toBe("one");
    expect(batch).not.toHaveProperty("actorId");
    expect(batch).not.toHaveProperty("streamId");
  });

  it("MCP transport maps tool isError to terminal mcp_tool_error (canary regression)", async () => {
    const legacyShape = {
      batchId: "batch_legacy",
      streamId: "stream_legacy",
      fromSequence: 1,
      toSequence: 1,
      contentHash: "sha256:deadbeef",
      events: [{ sequence: 1, role: "user", text: "legacy" }],
    };
    const wireBatch = buildBrainWireCaptureBatch({
      sessionId: "session_mcp_iserror",
      events: fixedEvents.slice(0, 1),
    });

    const callTool = vi.fn(async (_name: string, args: Record<string, unknown>) => {
      const batch = args.batch as Record<string, unknown> | undefined;
      if (batch && "streamId" in batch) {
        return { isError: true, content: [{ type: "text", text: "validation_error" }] };
      }
      return {
        isError: false,
        structuredContent: { accepted: true, batchId: wireBatch.batchId },
      };
    });

    const config = parseLinkbrainConfig({
      transportMode: "mcp",
      environment: "test",
      mcpServerName: "linkbrain",
    });
    const transport = resolveLinkbrainTransport({
      api: {
        config: {
          mcp: {
            servers: {
              linkbrain: {
                command: "false",
                args: [],
              },
            },
          },
        } as never,
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
        },
      },
      config,
      createMcpSession: async () => ({
        callTool,
        close: async () => undefined,
      }),
    });

    const legacyResult = await transport.write({
      toolName: "brain_capture_batch",
      idempotencyKey: "cap:legacy:1:1",
      arguments: { batch: legacyShape },
    });
    expect(legacyResult).toMatchObject({
      ok: false,
      terminal: true,
      errorCode: "mcp_tool_error",
    });

    const okResult = await transport.write({
      toolName: "brain_capture_batch",
      idempotencyKey: wireBatch.idempotencyKey,
      arguments: { batch: wireBatch },
    });
    expect(okResult).toMatchObject({ ok: true });
    expect(callTool).toHaveBeenCalledTimes(2);
    expect(callTool.mock.calls[0]?.[1]).not.toHaveProperty("idempotencyKey");
    expect(callTool.mock.calls[1]?.[1]).not.toHaveProperty("idempotencyKey");
  });

  it("does not forward actorKey as actor override on flushed wire batch", async () => {
    const stores = createTestStores();
    const config = parseLinkbrainConfig({
      captureEnqueue: true,
      captureDrain: true,
      batchMaxEvents: 1,
    });
    const writes: Array<Record<string, unknown>> = [];
    const runtime = createLinkbrainRuntime({
      config,
      stores,
      transport: {
        async write(params) {
          writes.push(params.arguments);
          return { ok: true, result: { accepted: true } };
        },
      },
      now: (() => {
        let t = 70_000;
        return () => {
          t += 1;
          return t;
        };
      })(),
    });
    await runtime.open();
    const capture = createLinkbrainCapture({
      config,
      stores,
      runtime,
      operationTimeoutMs: 1_500,
    });
    await capture.enqueue({
      streamKey: "agent:lisa:no-actor-override",
      actorKey: "untrusted-sender",
      role: "human",
      text: "principal please",
      fingerprint: "fp-actor",
    });
    await runtime.drainOnce();
    expect(writes).toHaveLength(1);
    expect(writes[0]).not.toHaveProperty("idempotencyKey");
    const batch = assertBrainWireCaptureBatch(writes[0]!.batch);
    expect(batch.events[0]?.role).toBe("principal");
    expect(JSON.stringify(writes[0])).not.toMatch(
      /actorId|actorBindingId|actor_id|platformActorId/,
    );
  });

  it("MCP drain args match frozen brain_capture_batch schema (no top-level idempotencyKey)", async () => {
    // Frozen from live stage evidence ocp-mac-stage-write-canaries-mcp-calls.json
    // (linkbrain.brain_capture_batch.inputSchema) + final.json note that
    // idempotencyKey belongs at batch.idempotencyKey only.
    const wireBatch = buildBrainWireCaptureBatch({
      sessionId: "session_mcp_schema_args",
      events: fixedEvents,
    });
    const callTool = vi.fn(async (_name: string, _args: Record<string, unknown>) => ({
      isError: false,
      structuredContent: { accepted: true },
    }));

    const config = parseLinkbrainConfig({
      transportMode: "mcp",
      environment: "test",
      mcpServerName: "linkbrain",
      captureEnqueue: true,
      captureDrain: true,
    });
    const transport = resolveLinkbrainTransport({
      api: {
        config: {
          mcp: {
            servers: {
              linkbrain: {
                command: "false",
                args: [],
              },
            },
          },
        } as never,
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
        },
      },
      config,
      createMcpSession: async () => ({
        callTool,
        close: async () => undefined,
      }),
    });

    const stores = createTestStores();
    const runtime = createLinkbrainRuntime({
      config,
      stores,
      transport,
      now: (() => {
        let t = 90_000;
        return () => {
          t += 1;
          return t;
        };
      })(),
    });
    await runtime.open();
    await runtime.enqueueWrite({
      kind: "capture_batch",
      toolName: "brain_capture_batch",
      idempotencyKey: wireBatch.idempotencyKey,
      body: wireBatch,
    });
    const drain = await runtime.drainOnce();
    expect(drain.drained).toBe(1);
    expect(callTool).toHaveBeenCalledTimes(1);

    const emittedArgs = callTool.mock.calls[0]![1] as Record<string, unknown>;
    expect(Object.keys(emittedArgs).toSorted()).toEqual(["batch"]);
    expect(emittedArgs).not.toHaveProperty("idempotencyKey");
    const batch = assertBrainWireCaptureBatch(emittedArgs.batch);
    expect(batch.idempotencyKey).toBe(wireBatch.idempotencyKey);

    const ajv = new AjvConstructor({ allErrors: true, strict: false });
    const validate = ajv.compile(FROZEN_BRAIN_CAPTURE_BATCH_MCP_SCHEMA);
    expect(validate(structuredClone(emittedArgs))).toBe(true);
    expect(
      validate(
        structuredClone({
          idempotencyKey: wireBatch.idempotencyKey,
          batch: wireBatch,
        }),
      ),
    ).toBe(false);
  });
});
