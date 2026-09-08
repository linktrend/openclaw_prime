import { describe, expect, it, vi } from "vitest";
import { createBrainFake } from "./fake/runtime.mjs";
import { parseLinkbrainConfig } from "./src/config.js";
import { redactBrainEnvelope } from "./src/envelopes.js";
import { LINKBRAIN_NAMESPACES, LINKBRAIN_NAMESPACE_LIST } from "./src/namespaces.js";
import {
  createBrainFakeTransport,
  createLinkbrainRuntime,
  type LinkbrainLeaseRunner,
} from "./src/runtime.js";
import { openLinkbrainStores } from "./src/stores.js";
import { createMemoryKeyedStore } from "./src/test-support/memory-store.js";

function createTestStores(maxEntries = 100) {
  const opened: string[] = [];
  const stores = openLinkbrainStores({
    maxEntries,
    openKeyedStore: (options) => {
      opened.push(options.namespace);
      expect(options.overflowPolicy).toBe("reject-new");
      return createMemoryKeyedStore({
        maxEntries: options.maxEntries,
        overflowPolicy: "reject-new",
      });
    },
  });
  return { stores, opened };
}

const sampleBatch = {
  batchId: "batch_test_runtime",
  sessionId: "session_test_lisa",
  idempotencyKey: "cap:session_test_lisa:1:2",
  capturedAt: "2026-07-27T10:00:02.000Z",
  events: [
    {
      eventId: "event_test_runtime_1",
      sequence: 1,
      occurredAt: "2026-07-27T10:00:01.000Z",
      role: "principal" as const,
      eventType: "message" as const,
      content: "Hello Lisa test.",
      classification: "private" as const,
    },
    {
      eventId: "event_test_runtime_2",
      sequence: 2,
      occurredAt: "2026-07-27T10:00:02.000Z",
      role: "assistant" as const,
      eventType: "message" as const,
      content: "Acknowledged.",
      classification: "private" as const,
    },
  ],
};

describe("linkbrain outbox runtime", () => {
  it("opens only plan namespaces with reject-new", () => {
    const { opened, stores } = createTestStores();
    expect(opened.toSorted()).toEqual([...LINKBRAIN_NAMESPACE_LIST].toSorted());
    expect(stores.openedNamespaces).toEqual(LINKBRAIN_NAMESPACE_LIST);
    expect(Object.values(LINKBRAIN_NAMESPACES)).toEqual(
      expect.arrayContaining(["outbox", "deadletter", "cursor", "health", "capture-buffer"]),
    );
  });

  it("redacts prohibited fields from capture envelopes", () => {
    const envelope = redactBrainEnvelope({
      kind: "capture_batch",
      toolName: "brain_capture_batch",
      idempotencyKey: "cap:redact:001",
      redactionPolicyVersion: "brain.redaction.v0",
      createdAtMs: 1,
      body: {
        ...sampleBatch,
        reasoning: "secret chain",
        apiKey: "should-not-survive",
      },
    });
    expect(envelope.body).not.toHaveProperty("reasoning");
    expect(envelope.body).not.toHaveProperty("apiKey");
    expect(envelope.body).toMatchObject({
      batchId: "batch_test_runtime",
      events: expect.any(Array),
    });
  });

  it("drains ordered outbox writes against Brain fake with idempotent replay", async () => {
    const fake = createBrainFake();
    const { stores } = createTestStores();
    const config = parseLinkbrainConfig({
      captureEnqueue: true,
      captureDrain: true,
    });
    const runtime = createLinkbrainRuntime({
      config,
      stores,
      transport: createBrainFakeTransport(fake),
      now: (() => {
        let t = 1_000;
        return () => {
          t += 1;
          return t;
        };
      })(),
    });
    await runtime.open();

    const first = await runtime.enqueueWrite({
      kind: "capture_batch",
      toolName: "brain_capture_batch",
      idempotencyKey: "cap:order:001",
      body: sampleBatch,
    });
    const second = await runtime.enqueueWrite({
      kind: "capture_batch",
      toolName: "brain_capture_batch",
      idempotencyKey: "cap:order:002",
      body: {
        ...sampleBatch,
        batchId: "batch_test_runtime_2",
        idempotencyKey: "cap:session_test_lisa:3:4",
        events: [
          {
            eventId: "event_test_runtime_3",
            sequence: 3,
            occurredAt: "2026-07-27T10:00:03.000Z",
            role: "principal" as const,
            eventType: "message" as const,
            content: "Follow-up.",
            classification: "private" as const,
          },
          {
            eventId: "event_test_runtime_4",
            sequence: 4,
            occurredAt: "2026-07-27T10:00:04.000Z",
            role: "assistant" as const,
            eventType: "message" as const,
            content: "Noted.",
            classification: "private" as const,
          },
        ],
      },
    });
    expect(first.key < second.key).toBe(true);

    const drain = await runtime.drainOnce();
    expect(drain.drained).toBe(2);
    expect((await runtime.diagnostics()).outboxCount).toBe(0);

    // Re-enqueue same idempotency key after ack; fake replays safely.
    await runtime.enqueueWrite({
      kind: "capture_batch",
      toolName: "brain_capture_batch",
      idempotencyKey: "cap:order:001",
      body: sampleBatch,
    });
    const replayDrain = await runtime.drainOnce();
    expect(replayDrain.drained).toBe(1);
    expect(fake.getIdempotencySize()).toBeGreaterThan(0);
  });

  it("rejects new outbox entries at capacity", async () => {
    const { stores } = createTestStores(1);
    const runtime = createLinkbrainRuntime({
      config: parseLinkbrainConfig({
        captureEnqueue: true,
        captureDrain: true,
        outboxMaxEntries: 1,
      }),
      stores,
      transport: {
        async write() {
          return { ok: true };
        },
      },
    });
    await runtime.open();
    await runtime.enqueueWrite({
      kind: "capture_batch",
      toolName: "brain_capture_batch",
      idempotencyKey: "cap:overflow:1",
      body: sampleBatch,
    });
    await expect(
      runtime.enqueueWrite({
        kind: "capture_batch",
        toolName: "brain_capture_batch",
        idempotencyKey: "cap:overflow:2",
        body: sampleBatch,
      }),
    ).rejects.toThrow(/overflow \(reject-new\)/);
    expect((await runtime.diagnostics()).outboxCount).toBe(1);
    expect((await runtime.diagnostics()).capacity.outboxRemaining).toBe(0);
  });

  it("dead-letters terminal Brain failures", async () => {
    const fake = createBrainFake();
    fake.setForceFailure("validation_error");
    const { stores } = createTestStores();
    const runtime = createLinkbrainRuntime({
      config: parseLinkbrainConfig({ captureEnqueue: true, captureDrain: true }),
      stores,
      transport: createBrainFakeTransport(fake),
    });
    await runtime.open();
    await runtime.enqueueWrite({
      kind: "capture_batch",
      toolName: "brain_capture_batch",
      idempotencyKey: "cap:dead:001",
      body: sampleBatch,
    });
    const drain = await runtime.drainOnce();
    expect(drain.deadLettered).toBe(1);
    const diagnostics = await runtime.diagnostics();
    expect(diagnostics.outboxCount).toBe(0);
    expect(diagnostics.deadLetterCount).toBe(1);
    const dead = await stores.deadletter.entries();
    expect(dead[0]?.value).toMatchObject({
      terminalCode: "validation_error",
      redactedMeta: { batchId: "batch_test_runtime" },
    });
    expect(dead[0]?.value).not.toHaveProperty("envelope");
  });

  it("recovers pending outbox after restart and serializes lease drain", async () => {
    const fake = createBrainFake();
    const { stores } = createTestStores();
    const config = parseLinkbrainConfig({ captureEnqueue: true, captureDrain: true });
    const leaseCalls: string[] = [];
    let leaseHeld = false;
    const withLease: LinkbrainLeaseRunner = async (_options, run) => {
      if (leaseHeld) {
        throw new Error("lease contention");
      }
      leaseHeld = true;
      leaseCalls.push("acquire");
      try {
        return await run({
          signal: new AbortController().signal,
          assertOwned: () => {
            if (!leaseHeld) {
              throw new Error("lease lost");
            }
          },
        });
      } finally {
        leaseHeld = false;
        leaseCalls.push("release");
      }
    };

    const first = createLinkbrainRuntime({
      config,
      stores,
      transport: createBrainFakeTransport(fake),
      withLease,
    });
    await first.open();
    await first.enqueueWrite({
      kind: "capture_batch",
      toolName: "brain_capture_batch",
      idempotencyKey: "cap:restart:001",
      body: sampleBatch,
    });
    await first.shutdown();

    // New runtime instance over the same durable stores (restart recovery).
    const second = createLinkbrainRuntime({
      config,
      stores,
      transport: createBrainFakeTransport(fake),
      withLease,
    });
    await second.open();
    expect((await second.diagnostics()).outboxCount).toBe(1);
    const drain = await second.drainOnce();
    expect(drain.drained).toBe(1);
    expect(leaseCalls).toEqual(["acquire", "release"]);
    expect((await second.diagnostics()).outboxCount).toBe(0);
  });

  it("exposes capacity and oldest-age diagnostics without payloads", async () => {
    const { stores } = createTestStores();
    let nowMs = 5_000;
    const runtime = createLinkbrainRuntime({
      config: parseLinkbrainConfig({
        captureEnqueue: true,
        captureDrain: false,
        outboxMaxEntries: 10,
      }),
      stores,
      transport: {
        async write() {
          return { ok: true };
        },
      },
      now: () => nowMs,
    });
    await runtime.open();
    await runtime.enqueueWrite({
      kind: "capture_batch",
      toolName: "brain_capture_batch",
      idempotencyKey: "cap:diag:001",
      body: sampleBatch,
    });
    nowMs = 8_000;
    const diagnostics = await runtime.diagnostics();
    expect(diagnostics.outboxCount).toBe(1);
    expect(diagnostics.oldestOutboxAgeMs).toBe(3_000);
    expect(diagnostics.oldestOutboxKey).toMatch(/^brain:capture_batch:/);
    expect(JSON.stringify(diagnostics)).not.toContain("Hello Lisa");
    expect(JSON.stringify(diagnostics)).not.toContain("apiKey");
  });

  it("plugin-disabled / flag-disabled baseline has no remote side effects", async () => {
    const write = vi.fn(async () => ({ ok: true }));
    const runtime = createLinkbrainRuntime({
      config: parseLinkbrainConfig({}),
      stores: createTestStores().stores,
      transport: { write },
    });
    await runtime.open();
    await expect(
      runtime.enqueueWrite({
        kind: "capture_batch",
        toolName: "brain_capture_batch",
        idempotencyKey: "cap:disabled:001",
        body: sampleBatch,
      }),
    ).rejects.toThrow(/captureEnqueue is disabled/);
    const drain = await runtime.drainOnce();
    expect(drain).toEqual({ drained: 0, retried: 0, deadLettered: 0, skipped: 0 });
    expect(write).not.toHaveBeenCalled();
  });
});
