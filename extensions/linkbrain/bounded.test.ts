/**
 * Deterministic bounded-operation + capture timeout regressions.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createKeyedPromiseChain,
  isOperationTimeout,
  runBounded,
  runExclusiveBounded,
} from "./src/bounded.js";
import { createLinkbrainCapture } from "./src/capture.js";
import { parseLinkbrainConfig } from "./src/config.js";
import { createLinkbrainLifecycle } from "./src/lifecycle.js";
import { createLinkbrainRuntime } from "./src/runtime.js";
import { openLinkbrainStores } from "./src/stores.js";
import { createDeferred, neverResolving } from "./src/test-support/deferred.js";
import { createMemoryKeyedStore } from "./src/test-support/memory-store.js";

afterEach(() => {
  vi.useRealTimers();
});

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

describe("linkbrain bounded primitives", () => {
  it("raceDeadline returns within bound against a never-resolving promise", async () => {
    vi.useFakeTimers();
    const pending = runBounded(async () => neverResolving<string>(), {
      timeoutMs: 50,
      label: "unit-race",
    });
    const assertion = expect(pending).rejects.toSatisfy(
      (error: unknown) =>
        isOperationTimeout(error) && error instanceof Error && error.message.includes("unit-race"),
    );
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
  });

  it("runBounded aborts signal and does not leave unhandled rejection on late settle", async () => {
    vi.useFakeTimers();
    const deferred = createDeferred<string>();
    let seenSignal: AbortSignal | undefined;
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);

    try {
      const pending = runBounded(
        async (signal) => {
          seenSignal = signal;
          return await deferred.promise;
        },
        { timeoutMs: 40, label: "unit-runBounded" },
      );
      const assertion = expect(pending).rejects.toSatisfy((error: unknown) =>
        isOperationTimeout(error),
      );
      await vi.advanceTimersByTimeAsync(40);
      await assertion;
      expect(seenSignal?.aborted).toBe(true);

      deferred.reject(new Error("late failure after timeout"));
      await Promise.resolve();
      await Promise.resolve();
      expect(unhandled).toHaveLength(0);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("runExclusiveBounded times out lock wait without starting queued work", async () => {
    vi.useFakeTimers();
    const withKey = createKeyedPromiseChain();
    const gate = createDeferred();
    let secondStarted = false;

    const first = runExclusiveBounded(
      withKey,
      "stream-a",
      { timeoutMs: 5_000, label: "first" },
      async () => {
        await gate.promise;
        return "first-done";
      },
    );

    const second = runExclusiveBounded(
      withKey,
      "stream-a",
      { timeoutMs: 30, label: "second" },
      async () => {
        secondStarted = true;
        return "second-done";
      },
    );

    const secondAssert = expect(second).rejects.toSatisfy((error: unknown) =>
      isOperationTimeout(error),
    );
    await vi.advanceTimersByTimeAsync(30);
    await secondAssert;
    expect(secondStarted).toBe(false);

    gate.resolve();
    await expect(first).resolves.toBe("first-done");
    // Allow skip-after-abort path to settle; lock must not stay poisoned.
    await expect(
      runExclusiveBounded(
        withKey,
        "stream-a",
        { timeoutMs: 100, label: "third" },
        async () => "third-done",
      ),
    ).resolves.toBe("third-done");
  });

  it("runExclusiveBounded retains lock until abandoned work settles after timeout", async () => {
    vi.useFakeTimers();
    const withKey = createKeyedPromiseChain();
    const gate = createDeferred();
    let releaseCount = 0;
    const stalled: string[] = [];

    const abandoned = runExclusiveBounded(
      withKey,
      "stream-b",
      {
        timeoutMs: 25,
        label: "abandoned",
        onStalled: (info) => {
          stalled.push(info.reason);
        },
      },
      async () => {
        await gate.promise;
        releaseCount += 1;
        return "done";
      },
    );

    const abandonedAssert = expect(abandoned).rejects.toSatisfy((error: unknown) =>
      isOperationTimeout(error),
    );
    await vi.advanceTimersByTimeAsync(25);
    await abandonedAssert;
    expect(stalled).toContain("deadline_exceeded_work_retained");
    expect(releaseCount).toBe(0);

    let queuedStartedAt = 0;
    const queued = runExclusiveBounded(
      withKey,
      "stream-b",
      { timeoutMs: 5_000, label: "queued" },
      async () => {
        queuedStartedAt = releaseCount;
        return "queued-done";
      },
    );

    // Queued must not start until abandoned work settles.
    await vi.advanceTimersByTimeAsync(10);
    expect(queuedStartedAt).toBe(0);

    gate.resolve();
    await expect(queued).resolves.toBe("queued-done");
    expect(queuedStartedAt).toBe(1);
    expect(releaseCount).toBe(1);
  });

  it("different keys progress independently under exclusive bounds", async () => {
    vi.useFakeTimers();
    const withKey = createKeyedPromiseChain();
    const leftGate = createDeferred();

    const left = runExclusiveBounded(
      withKey,
      "left",
      { timeoutMs: 5_000, label: "left" },
      async () => {
        await leftGate.promise;
        return "L";
      },
    );
    const right = runExclusiveBounded(
      withKey,
      "right",
      { timeoutMs: 40, label: "right" },
      async () => "R",
    );

    await expect(right).resolves.toBe("R");
    leftGate.resolve();
    await expect(left).resolves.toBe("L");
  });
});

describe("linkbrain capture/lifecycle timeout integration", () => {
  it("enqueue returns within bound when captureBuffer save never resolves; late save stays durable", async () => {
    vi.useFakeTimers();
    const stores = createTestStores();
    const saveGate = createDeferred();
    const originalRegister = stores.captureBuffer.register.bind(stores.captureBuffer);
    stores.captureBuffer.register = async (key, value, opts) => {
      await saveGate.promise;
      return await originalRegister(key, value, opts);
    };

    const config = parseLinkbrainConfig({
      captureEnqueue: true,
      captureDrain: true,
      batchMaxEvents: 32,
    });
    const runtime = createLinkbrainRuntime({
      config,
      stores,
      transport: {
        async write() {
          return { ok: true, result: { accepted: true } };
        },
      },
    });
    await runtime.open();
    const capture = createLinkbrainCapture({
      config,
      stores,
      runtime,
      operationTimeoutMs: 40,
    });

    const pending = capture.enqueue({
      streamKey: "agent:lisa:save-stall",
      role: "user",
      text: "held",
      fingerprint: "fp-held",
    });
    // Save has not completed — timeout must not claim accepted yet.
    const pendingAssert = expect(pending).rejects.toSatisfy((error: unknown) =>
      isOperationTimeout(error),
    );
    await vi.advanceTimersByTimeAsync(40);
    await pendingAssert;

    const diag = await runtime.diagnostics();
    expect(diag.stalledCount).toBeGreaterThan(0);
    expect(diag.lastStalledStatus).toContain("capture-enqueue");

    saveGate.resolve();
    // Allow abandoned save + lock release.
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    await Promise.resolve();

    const buffer = await capture.getBuffer("agent:lisa:save-stall");
    expect(buffer?.events.map((e) => e.text)).toEqual(["held"]);

    // Retry after late settlement must not poison the lock.
    await expect(
      capture.enqueue({
        streamKey: "agent:lisa:save-stall",
        role: "user",
        text: "next",
        fingerprint: "fp-next",
      }),
    ).resolves.toEqual({ accepted: true, flushed: false });
    expect((await capture.getBuffer("agent:lisa:save-stall"))?.events).toHaveLength(2);
  });

  it("enqueue times out behind stalled same-stream lock wait without starting", async () => {
    vi.useFakeTimers();
    const stores = createTestStores();
    const config = parseLinkbrainConfig({
      captureEnqueue: true,
      captureDrain: true,
      batchMaxEvents: 32,
    });
    const runtime = createLinkbrainRuntime({
      config,
      stores,
      transport: {
        async write() {
          return { ok: true, result: { accepted: true } };
        },
      },
    });
    await runtime.open();

    const lookupGate = createDeferred();
    let lookupCalls = 0;
    const originalLookup = stores.captureBuffer.lookup.bind(stores.captureBuffer);
    stores.captureBuffer.lookup = async (key) => {
      lookupCalls += 1;
      if (lookupCalls === 1) {
        await lookupGate.promise;
      }
      return await originalLookup(key);
    };

    const capture = createLinkbrainCapture({
      config,
      stores,
      runtime,
      operationTimeoutMs: 35,
    });

    const first = capture.enqueue({
      streamKey: "agent:lisa:lock-stall",
      role: "user",
      text: "first",
      fingerprint: "fp-1",
    });
    const second = capture.enqueue({
      streamKey: "agent:lisa:lock-stall",
      role: "user",
      text: "second",
      fingerprint: "fp-2",
    });

    const firstAssert = expect(first).rejects.toSatisfy((error: unknown) =>
      isOperationTimeout(error),
    );
    const secondAssert = expect(second).rejects.toSatisfy((error: unknown) =>
      isOperationTimeout(error),
    );
    await vi.advanceTimersByTimeAsync(35);
    await Promise.all([firstAssert, secondAssert]);

    // Late settlement of the stalled lookup must not let the timed-out second mutate.
    lookupGate.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(lookupCalls).toBe(1);

    // Lock must not stay poisoned after abandoned first work settles.
    await expect(
      capture.enqueue({
        streamKey: "agent:lisa:lock-stall",
        role: "user",
        text: "third",
        fingerprint: "fp-3",
      }),
    ).resolves.toEqual({ accepted: true, flushed: false });
    expect((await capture.getBuffer("agent:lisa:lock-stall"))?.events.map((e) => e.text)).toEqual([
      "third",
    ]);
  });

  it("timeout on enqueueWrite after durable save returns accepted and never claims flushed", async () => {
    vi.useFakeTimers();
    const stores = createTestStores();
    const config = parseLinkbrainConfig({
      captureEnqueue: true,
      captureDrain: true,
      batchMaxEvents: 1,
    });
    const runtime = createLinkbrainRuntime({
      config,
      stores,
      transport: {
        async write() {
          return { ok: true, result: { accepted: true } };
        },
      },
    });
    await runtime.open();

    const enqueueGate = createDeferred<{ key: string }>();
    vi.spyOn(runtime, "enqueueWrite").mockImplementation(async () => enqueueGate.promise);

    const capture = createLinkbrainCapture({
      config,
      stores,
      runtime,
      operationTimeoutMs: 30,
    });

    const pending = capture.enqueue({
      streamKey: "agent:lisa:flush-stall",
      role: "user",
      text: "only",
      fingerprint: "fp-only",
    });
    // Let durable save complete, then hit the stalled flush enqueueWrite.
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(30);
    await expect(pending).resolves.toEqual({ accepted: true, flushed: false });

    expect((await capture.getBuffer("agent:lisa:flush-stall"))?.events).toHaveLength(1);
    expect((await runtime.diagnostics()).stalledCount).toBeGreaterThan(0);

    enqueueGate.resolve({ key: "late-key" });
    await Promise.resolve();
    await Promise.resolve();
  });

  it("timeout then retry after late settlement does not poison the stream lock", async () => {
    vi.useFakeTimers();
    const stores = createTestStores();
    const config = parseLinkbrainConfig({
      captureEnqueue: true,
      captureDrain: true,
      batchMaxEvents: 32,
    });
    const runtime = createLinkbrainRuntime({
      config,
      stores,
      transport: {
        async write() {
          return { ok: true, result: { accepted: true } };
        },
      },
    });
    await runtime.open();

    const saveGate = createDeferred();
    let saveCalls = 0;
    const originalRegister = stores.captureBuffer.register.bind(stores.captureBuffer);
    stores.captureBuffer.register = async (key, value, opts) => {
      saveCalls += 1;
      if (saveCalls === 1) {
        await saveGate.promise;
      }
      return await originalRegister(key, value, opts);
    };

    const capture = createLinkbrainCapture({
      config,
      stores,
      runtime,
      operationTimeoutMs: 25,
    });

    const first = capture.enqueue({
      streamKey: "agent:lisa:retry-after-timeout",
      role: "user",
      text: "a",
      fingerprint: "fp-a",
    });
    const firstAssert = expect(first).rejects.toSatisfy((error: unknown) =>
      isOperationTimeout(error),
    );
    await vi.advanceTimersByTimeAsync(25);
    await firstAssert;

    saveGate.resolve();
    await Promise.resolve();
    await Promise.resolve();

    await expect(
      capture.enqueue({
        streamKey: "agent:lisa:retry-after-timeout",
        role: "user",
        text: "b",
        fingerprint: "fp-b",
      }),
    ).resolves.toEqual({ accepted: true, flushed: false });
    expect((await capture.getBuffer("agent:lisa:retry-after-timeout"))?.events).toHaveLength(2);
  });

  it("different streams stay independent when one stream save stalls", async () => {
    vi.useFakeTimers();
    const stores = createTestStores();
    const config = parseLinkbrainConfig({
      captureEnqueue: true,
      captureDrain: true,
      batchMaxEvents: 32,
    });
    const runtime = createLinkbrainRuntime({
      config,
      stores,
      transport: {
        async write() {
          return { ok: true, result: { accepted: true } };
        },
      },
    });
    await runtime.open();

    const stallGate = createDeferred();
    const enteredFirstSave = createDeferred();
    let registerCalls = 0;
    const originalRegister = stores.captureBuffer.register.bind(stores.captureBuffer);
    stores.captureBuffer.register = async (key, value, opts) => {
      registerCalls += 1;
      // Stall only the first durable save (left stream); right must proceed.
      if (registerCalls === 1) {
        enteredFirstSave.resolve();
        await stallGate.promise;
      }
      return await originalRegister(key, value, opts);
    };

    const capture = createLinkbrainCapture({
      config,
      stores,
      runtime,
      operationTimeoutMs: 40,
    });

    const left = capture.enqueue({
      streamKey: "agent:lisa:left",
      role: "user",
      text: "L",
      fingerprint: "fp-L",
    });
    await enteredFirstSave.promise;
    const right = capture.enqueue({
      streamKey: "agent:lisa:right",
      role: "user",
      text: "R",
      fingerprint: "fp-R",
    });

    await expect(right).resolves.toEqual({ accepted: true, flushed: false });

    const leftAssert = expect(left).rejects.toSatisfy((error: unknown) =>
      isOperationTimeout(error),
    );
    await vi.advanceTimersByTimeAsync(40);
    await leftAssert;

    stallGate.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect((await capture.getBuffer("agent:lisa:right"))?.events).toHaveLength(1);
  });

  it("lifecycle drainBounded returns within bound when drainOnce ignores cancel", async () => {
    vi.useFakeTimers();
    const stores = createTestStores();
    const config = parseLinkbrainConfig({
      captureEnqueue: true,
      captureDrain: true,
      coordinationWrites: true,
    });
    const runtime = createLinkbrainRuntime({
      config,
      stores,
      transport: {
        async write() {
          return { ok: true, result: { accepted: true } };
        },
      },
    });
    await runtime.open();
    const capture = createLinkbrainCapture({
      config,
      stores,
      runtime,
      operationTimeoutMs: 40,
    });
    const warns: string[] = [];
    const lifecycle = createLinkbrainLifecycle({
      config,
      runtime,
      capture,
      operationTimeoutMs: 40,
      logger: {
        info: () => undefined,
        warn: (message) => {
          warns.push(message);
        },
      },
    });

    const drainGate = createDeferred<{
      drained: number;
      retried: number;
      deadLettered: number;
      skipped: number;
    }>();
    vi.spyOn(runtime, "drainOnce").mockImplementation(async (options) => {
      // Ignore abort — models an SDK/op that does not cancel promptly.
      void options?.signal;
      return await drainGate.promise;
    });

    const start = lifecycle.handleGatewayStart();
    await vi.advanceTimersByTimeAsync(40);
    await start;
    expect(warns.some((w) => w.includes("stalled") || w.includes("exceeded"))).toBe(true);
    expect((await runtime.diagnostics()).stalledCount).toBeGreaterThan(0);

    drainGate.resolve({ drained: 0, retried: 0, deadLettered: 0, skipped: 0 });
    await Promise.resolve();
  });
});
