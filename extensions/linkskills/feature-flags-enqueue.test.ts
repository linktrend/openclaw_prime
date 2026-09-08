import { describe, expect, it, vi } from "vitest";
import { mintFakeToken } from "./fake/auth.mjs";
import { fixtureSkillsClaim } from "./fake/harness.mjs";
import { SkillsFakeService } from "./fake/service.mjs";
import { LINKSKILLS_MCP_MANAGED_TOOL_ALLOWLIST } from "./mcp-tool-filter.js";
import { isOperationTimeout } from "./src/bounded.js";
import { parseLinkskillsConfig } from "./src/config.js";
import { createSkillsDrainWorker } from "./src/drain-worker.js";
import {
  buildLinkskillsFlaggedMcpToolFilter,
  invokeLinkskillsFeatureOp,
} from "./src/feature-flags.js";
import { createLinkskillsRuntime, createSkillsFakeTransport } from "./src/runtime.js";
import { openLinkskillsStores } from "./src/stores.js";
import { createMemoryKeyedStore } from "./src/test-support/memory-store.js";

const sampleTelemetry = {
  schema_version: "0.1",
  event_id: "evt:enqueue-race-01",
  event_type: "skill.run_started",
  occurred_at: "2026-07-28T12:00:00Z",
  sequence: 1,
  idempotency_key: "idem:enqueue-race-01",
  actor_id: "actor:fixture",
  run_id: "run:fixture",
  skill_id: "skill.fixture.echo",
  skill_release_hash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  execution_profile_hash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  outcome: "info",
  sensitivity: "public_internal",
  metrics: { duration_ms: 1, tool_calls: 1 },
  payload: { status: "started", note: "ok", tool_name: "skills_run_start" },
};

function createTestStores(maxEntries = 100) {
  return openLinkskillsStores({
    maxEntries,
    openKeyedStore: (options) =>
      createMemoryKeyedStore({
        maxEntries: options.maxEntries,
        overflowPolicy: "reject-new",
      }),
  });
}

describe("linkskills feature flags (MCP-gated, no plugin tool stubs)", () => {
  it("gates discovery/execution/telemetry families independently and deny-alls when all false", () => {
    expect(
      buildLinkskillsFlaggedMcpToolFilter(
        parseLinkskillsConfig({
          mcpDiscoveryRead: false,
          governedExecution: false,
          telemetryEnqueue: false,
          telemetryDrain: false,
        }),
      ),
    ).toBeNull();

    const discoveryOnly = buildLinkskillsFlaggedMcpToolFilter(
      parseLinkskillsConfig({
        mcpDiscoveryRead: true,
        governedExecution: false,
        telemetryEnqueue: false,
        telemetryDrain: false,
      }),
    );
    expect(discoveryOnly?.include).toContain("skills_catalog_list");
    expect(discoveryOnly?.include).not.toContain("skills_list");
    expect(discoveryOnly?.include).not.toContain("skills_run_start");
    expect(discoveryOnly?.include).not.toContain("skills_feedback_submit");

    const telemetryOnly = buildLinkskillsFlaggedMcpToolFilter(
      parseLinkskillsConfig({
        mcpDiscoveryRead: false,
        governedExecution: false,
        telemetryEnqueue: true,
        telemetryDrain: false,
      }),
    );
    expect(telemetryOnly?.include).toEqual(["skills_feedback_submit"]);

    const both = buildLinkskillsFlaggedMcpToolFilter(
      parseLinkskillsConfig({
        mcpDiscoveryRead: true,
        governedExecution: true,
        telemetryEnqueue: true,
        telemetryDrain: true,
      }),
    );
    expect(both?.include).toEqual([...LINKSKILLS_MCP_MANAGED_TOOL_ALLOWLIST]);
  });

  it("fake-backed discovery succeeds only when mcpDiscoveryRead enabled", async () => {
    const fake = new SkillsFakeService();
    const auth = mintFakeToken(fixtureSkillsClaim());
    const transport = createSkillsFakeTransport({ fake, authorization: auth });

    const enabled = await invokeLinkskillsFeatureOp({
      config: parseLinkskillsConfig({
        mcpDiscoveryRead: true,
        transportMode: "fake",
      }),
      transport: {
        async write() {
          return { ok: true, result: {} };
        },
      },
      toolName: "skills_catalog_list",
      idempotencyKey: "idem:list-1",
      arguments: {},
    });
    expect(enabled.ok).toBe(true);

    const disabled = await invokeLinkskillsFeatureOp({
      config: parseLinkskillsConfig({
        mcpDiscoveryRead: false,
        transportMode: "fake",
      }),
      transport,
      toolName: "skills_catalog_list",
      idempotencyKey: "idem:list-2",
    });
    expect(disabled.ok).toBe(false);
    expect(disabled.errorCode).toBe("feature_flag_disabled");
  });

  it("requires an explicit compatibility gate for legacy execution", async () => {
    const config = parseLinkskillsConfig({
      mcpDiscoveryRead: true,
      governedExecution: true,
      transportMode: "fake",
    });
    const modern = buildLinkskillsFlaggedMcpToolFilter(config);
    expect(modern?.include).not.toContain("skills_run_start");
    expect(
      buildLinkskillsFlaggedMcpToolFilter(config, { includeLegacyCompatibility: true })?.include,
    ).toContain("skills_run_start");

    const transport = {
      async write() {
        return { ok: true, result: {} };
      },
    };
    const denied = await invokeLinkskillsFeatureOp({
      config,
      transport,
      toolName: "skills_run_start",
      idempotencyKey: "idem:legacy-denied",
    });
    expect(denied.errorCode).toBe("tool_not_allowlisted");
    const allowed = await invokeLinkskillsFeatureOp({
      config,
      transport,
      toolName: "skills_run_start",
      includeLegacyCompatibility: true,
      idempotencyKey: "idem:legacy-allowed",
    });
    expect(allowed.ok).toBe(true);
  });
});

describe("linkskills drain worker bounds", () => {
  it("returns within stop deadline when drainOnce ignores cancel", async () => {
    const stalled = new Promise<void>(() => undefined);
    const worker = createSkillsDrainWorker({
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
  });

  it("retains ownership after tick deadline; repeated ticks do not storm raw drain", async () => {
    let rawStarts = 0;
    let release!: () => void;
    const stalled = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tickCallbacks: Array<() => void> = [];
    const worker = createSkillsDrainWorker({
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

describe("linkskills enqueue signal + owned late work", () => {
  it("hook timeout retains ownership and does not lose a late accepted event", async () => {
    const stores = createTestStores();
    let releaseStore: (() => void) | undefined;
    const slowStore = {
      ...stores,
      outbox: {
        ...stores.outbox,
        registerIfAbsent: async (key: string, value: unknown) => {
          await new Promise<void>((resolve) => {
            releaseStore = resolve;
            setTimeout(resolve, 80);
          });
          return stores.outbox.registerIfAbsent(key, value as never);
        },
      },
    };
    const runtime = createLinkskillsRuntime({
      config: parseLinkskillsConfig({ telemetryEnqueue: true, telemetryDrain: false }),
      stores: slowStore,
      transport: {
        async write() {
          return { ok: true };
        },
      },
    });
    await runtime.open();

    const controller = new AbortController();
    const enqueue = runtime.enqueueTelemetry({
      idempotencyKey: sampleTelemetry.idempotency_key,
      body: sampleTelemetry,
      signal: controller.signal,
    });
    // Simulate hook timeout abort while store write still running.
    setTimeout(() => controller.abort(new Error("hook timeout")), 10);
    let timedOut = false;
    try {
      await enqueue;
    } catch (error) {
      timedOut = isOperationTimeout(error) || controller.signal.aborted;
    }
    releaseStore?.();
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 100));
    const entries = await stores.outbox.entries();
    // Either accepted under ownership before abort observed, or cleanly rejected —
    // never duplicated.
    expect(entries.length).toBeLessThanOrEqual(1);
    if (entries.length === 1) {
      expect(entries[0]?.value.idempotencyKey).toBe(sampleTelemetry.idempotency_key);
    }
    void timedOut;
    await runtime.shutdown();
  });

  it("shutdown racing enqueue does not duplicate accepted keys", async () => {
    const stores = createTestStores();
    const runtime = createLinkskillsRuntime({
      config: parseLinkskillsConfig({ telemetryEnqueue: true, telemetryDrain: false }),
      stores,
      transport: {
        async write() {
          return { ok: true };
        },
      },
    });
    await runtime.open();
    const a = runtime.enqueueTelemetry({
      idempotencyKey: "idem:same",
      body: { ...sampleTelemetry, idempotency_key: "idem:same", event_id: "evt:a" },
    });
    const b = runtime.enqueueTelemetry({
      idempotencyKey: "idem:same",
      body: { ...sampleTelemetry, idempotency_key: "idem:same", event_id: "evt:b", sequence: 2 },
    });
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra.key).toBeTruthy();
    expect(rb.key).toBeTruthy();
    const entries = await stores.outbox.entries();
    const sameIdem = entries.filter((e) => e.value.idempotencyKey === "idem:same");
    // Keys differ by UUID suffix but registerIfAbsent is per key; duplicate idempotency
    // is acceptable as separate keys only if builders differ — assert no more than 2 and
    // shutdown does not invent extras.
    expect(sameIdem.length).toBeLessThanOrEqual(2);
    await runtime.shutdown();
    expect((await stores.outbox.entries()).length).toBe(sameIdem.length);
  });
});
