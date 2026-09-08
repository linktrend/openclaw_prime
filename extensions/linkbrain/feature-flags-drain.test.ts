import { describe, expect, it, vi } from "vitest";
import { createBrainFake } from "./fake/runtime.mjs";
import { LINKBRAIN_MCP_MANAGED_TOOL_ALLOWLIST } from "./mcp-tool-filter.js";
import { parseLinkbrainConfig } from "./src/config.js";
import { createBrainDrainWorker } from "./src/drain-worker.js";
import {
  buildLinkbrainFlaggedMcpToolFilter,
  invokeLinkbrainFeatureRead,
} from "./src/feature-flags.js";
import { createBrainFakeTransport } from "./src/runtime.js";

describe("linkbrain feature flags (MCP-gated, no plugin tool stubs)", () => {
  it("gates each Brain flag family independently and deny-alls when all false", () => {
    expect(
      buildLinkbrainFlaggedMcpToolFilter(
        parseLinkbrainConfig({
          mcpRead: false,
          captureEnqueue: false,
          captureDrain: false,
          coordinationWrites: false,
        }),
      ),
    ).toBeNull();

    const readOnly = buildLinkbrainFlaggedMcpToolFilter(
      parseLinkbrainConfig({
        mcpRead: true,
        captureEnqueue: false,
        captureDrain: false,
        coordinationWrites: false,
      }),
    );
    expect(readOnly?.include).toContain("brain_browse");
    expect(readOnly?.include).toContain("v2.projection.evidence");
    expect(readOnly?.include).not.toContain("brain_capture_batch");
    expect(readOnly?.include).not.toContain("brain_task_start");
    expect(readOnly?.include).not.toContain("v2.projection.ingest");

    const captureOnly = buildLinkbrainFlaggedMcpToolFilter(
      parseLinkbrainConfig({
        mcpRead: false,
        captureEnqueue: true,
        captureDrain: false,
        coordinationWrites: false,
      }),
    );
    expect(captureOnly?.include).toEqual(["brain_capture_batch", "brain_episode_checkpoint"]);

    const allOn = buildLinkbrainFlaggedMcpToolFilter(
      parseLinkbrainConfig({
        mcpRead: true,
        captureEnqueue: true,
        captureDrain: true,
        coordinationWrites: true,
      }),
    );
    expect(allOn?.include.length).toBe(LINKBRAIN_MCP_MANAGED_TOOL_ALLOWLIST.length);
  });

  it("fake-backed read succeeds when mcpRead enabled; fails when disabled", async () => {
    const fake = createBrainFake();
    const transport = {
      async write(params: {
        toolName: string;
        idempotencyKey: string;
        arguments: Record<string, unknown>;
        signal?: AbortSignal;
      }) {
        if (params.signal?.aborted) {
          return { ok: false, errorCode: "aborted", safeMessage: "aborted" };
        }
        const outcome = fake.callTool(params.toolName, params.arguments, {
          authToken: "fake-valid-token",
          requestId: params.idempotencyKey,
        });
        return {
          ok: outcome.ok === true,
          ...(outcome.ok ? { result: outcome.result } : {}),
          ...(!outcome.ok
            ? {
                errorCode:
                  typeof outcome.error?.code === "string" ? outcome.error.code : "brain_error",
                safeMessage: "failed",
              }
            : {}),
        };
      },
    };

    const enabled = await invokeLinkbrainFeatureRead({
      config: parseLinkbrainConfig({ mcpRead: true, transportMode: "fake" }),
      transport,
      toolName: "brain_browse",
      idempotencyKey: "idem:browse-1",
      arguments: {},
    });
    expect(enabled.ok).toBe(true);

    const disabled = await invokeLinkbrainFeatureRead({
      config: parseLinkbrainConfig({ mcpRead: false, transportMode: "fake" }),
      transport,
      toolName: "brain_browse",
      idempotencyKey: "idem:browse-2",
    });
    expect(disabled.ok).toBe(false);
    expect(disabled.errorCode).toBe("feature_flag_disabled");

    // Write transport still rejects non-write tools — no naming collision path.
    const writeOnly = createBrainFakeTransport(fake);
    const writeReject = await writeOnly.write({
      toolName: "brain_browse",
      idempotencyKey: "idem:write-reject",
      arguments: {},
    });
    expect(writeReject.ok).toBe(false);
    expect(writeReject.errorCode).toBe("tool_not_allowlisted");
  });
});

describe("linkbrain drain worker bounds", () => {
  it("returns within stop deadline when drainOnce ignores cancel", async () => {
    const stalled = new Promise<void>(() => undefined);
    const worker = createBrainDrainWorker({
      intervalMs: 10,
      tickTimeoutMs: 30,
      stopTimeoutMs: 40,
      shouldDrain: () => true,
      drainOnce: async () => stalled,
    });
    worker.start();
    const started = Date.now();
    await worker.stop();
    expect(Date.now() - started).toBeLessThan(200);
    expect(worker.running).toBe(false);
  });

  it("does not launch concurrent ticks", async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const releases: Array<() => void> = [];
    const worker = createBrainDrainWorker({
      intervalMs: 5,
      tickTimeoutMs: 500,
      stopTimeoutMs: 500,
      shouldDrain: () => true,
      drainOnce: async () => {
        concurrent += 1;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise<void>((resolve) => {
          releases.push(() => {
            concurrent -= 1;
            resolve();
          });
        });
      },
      setIntervalFn: ((fn: () => void) => {
        // Fire several overlapping interval callbacks while first tick holds.
        fn();
        fn();
        fn();
        return 1 as unknown as ReturnType<typeof setInterval>;
      }) as typeof setInterval,
      clearIntervalFn: (() => undefined) as typeof clearInterval,
    });
    worker.start();
    await Promise.resolve();
    expect(maxConcurrent).toBe(1);
    for (const release of releases) {
      release();
    }
    await worker.stop();
  });

  it("retains ownership after tick deadline; repeated ticks do not storm raw drain", async () => {
    let rawStarts = 0;
    let release!: () => void;
    const stalled = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tickCallbacks: Array<() => void> = [];
    const worker = createBrainDrainWorker({
      intervalMs: 5,
      tickTimeoutMs: 25,
      stopTimeoutMs: 40,
      shouldDrain: () => true,
      drainOnce: async () => {
        rawStarts += 1;
        await stalled;
      },
      setIntervalFn: ((fn: () => void) => {
        tickCallbacks.push(fn);
        return 1 as unknown as ReturnType<typeof setInterval>;
      }) as typeof setInterval,
      clearIntervalFn: (() => undefined) as typeof clearInterval,
    });
    worker.start();
    await new Promise((r) => setTimeout(r, 40));
    expect(worker.activeTicks).toBe(1);
    expect(rawStarts).toBe(1);
    for (let i = 0; i < 12; i += 1) {
      for (const cb of tickCallbacks) {
        cb();
      }
    }
    expect(rawStarts).toBe(1);
    expect(worker.activeTicks).toBe(1);
    release();
    await new Promise((r) => setTimeout(r, 10));
    expect(worker.activeTicks).toBe(0);
    await worker.stop();
  });
});
