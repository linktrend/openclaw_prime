/**
 * Phase 6 — Performance baseline measurements (fake / integration-local).
 *
 * Measures hook/enqueue latency, record size, drain throughput, queue growth,
 * and restart time. Budgets are asserted here and documented in
 * docs/execution/openclawdevelopmentplan01/PHASE-6-PERF-BASELINE.md.
 */
import { describe, expect, it } from "vitest";
import { parseLinkbrainConfig } from "../../../extensions/linkbrain/src/config.js";
import {
  createBrainFakeTransport,
  createLinkbrainRuntime,
} from "../../../extensions/linkbrain/src/runtime.js";
import { openLinkbrainStores } from "../../../extensions/linkbrain/src/stores.js";
import { createMemoryKeyedStore as createBrainMemoryStore } from "../../../extensions/linkbrain/src/test-support/memory-store.js";
import { SkillsFakeService } from "../../../extensions/linkskills/fake/service.mjs";
import { parseLinkskillsConfig } from "../../../extensions/linkskills/src/config.js";
import {
  createLinkskillsRuntime,
  createSkillsFakeTransport,
} from "../../../extensions/linkskills/src/runtime.js";
import { openLinkskillsStores } from "../../../extensions/linkskills/src/stores.js";
import { createMemoryKeyedStore as createSkillsMemoryStore } from "../../../extensions/linkskills/src/test-support/memory-store.js";
import { createBrainFake } from "./brain-fake.js";
import { fixtureSkillsClaim, mintFakeToken } from "./skills-fake.js";

/** Evidence tier: measurements are local fake-tier only. */
export const PHASE6_PERF_EVIDENCE_TIER = "fake/integration-local" as const;

/**
 * Initial budgets derived from first local fake-tier measurements (2026-07-28).
 * Values are ceilings with headroom; not production SLOs.
 */
export const PHASE6_PERF_BUDGETS = Object.freeze({
  /** Single enqueue (capture or telemetry) p95-ish ceiling. */
  enqueueLatencyMs: 50,
  /** Single transport write via hook-proxy path ceiling (enqueue + one drain item). */
  hookLatencyMs: 100,
  /** Max serialized outbox record size for sample envelopes. */
  maxRecordBytes: 8_192,
  /** Minimum drain throughput for a 20-item batch. */
  minDrainThroughputPerSec: 50,
  /** Max outbox growth steps before reject-new at capacity=10. */
  maxQueueGrowthBeforeReject: 10,
  /** Shutdown + reopen + drain of one pending item. */
  restartRecoverMs: 500,
});

const sampleBrainBatch = {
  batchId: "batch_phase6_perf",
  sessionId: "session_phase6_lisa",
  idempotencyKey: "cap:session_phase6_lisa:1:2",
  capturedAt: "2026-07-27T11:00:02.000Z",
  events: [
    {
      eventId: "event_phase6_perf_1",
      sequence: 1,
      occurredAt: "2026-07-27T11:00:01.000Z",
      role: "principal" as const,
      eventType: "message" as const,
      content: "Perf sample conversation.",
      classification: "private" as const,
    },
    {
      eventId: "event_phase6_perf_2",
      sequence: 2,
      occurredAt: "2026-07-27T11:00:02.000Z",
      role: "assistant" as const,
      eventType: "message" as const,
      content: "Perf ack.",
      classification: "private" as const,
    },
  ],
};

const sampleSkillsTelemetry = {
  schema_version: "0.1",
  event_id: "evt:phase6-perf-01",
  event_type: "skill.run_started",
  occurred_at: "2026-07-27T11:00:00Z",
  sequence: 1,
  idempotency_key: "idem:phase6-perf-run-01",
  correlation_id: "corr:phase6-opaque-perf-01",
  actor_id: "actor:fixture-lisa-01",
  runtime_profile_id: "runtime:fixture-openclaw-01",
  session_id: "session:fixture-opaque-01",
  run_id: "run:fixture-skills-01",
  skill_id: "skill.fixture.echo",
  skill_release_hash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  execution_profile_hash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  outcome: "info",
  sensitivity: "public_internal",
  metrics: { duration_ms: 0, tool_calls: 0 },
  payload: { status: "started", note: "structured only" },
};

function createStores(maxEntries = 100) {
  return {
    brain: openLinkbrainStores({
      maxEntries,
      openKeyedStore: (options) =>
        createBrainMemoryStore({
          maxEntries: options.maxEntries,
          overflowPolicy: "reject-new",
        }),
    }),
    skills: openLinkskillsStores({
      maxEntries,
      openKeyedStore: (options) =>
        createSkillsMemoryStore({
          maxEntries: options.maxEntries,
          overflowPolicy: "reject-new",
        }),
    }),
  };
}

function seedSkillsRun(fake: SkillsFakeService, auth: string) {
  const started = fake.dispatch(
    "skills_run_start",
    {
      params: {
        skill_id: "skill.fixture.echo",
        release_hash: sampleSkillsTelemetry.skill_release_hash,
        execution_profile_hash: sampleSkillsTelemetry.execution_profile_hash,
        session_id: sampleSkillsTelemetry.session_id,
      },
      idempotency_key: "idem:seed-perf",
      request_id: "req:seed-perf",
      authorization: auth,
    },
    { authorization: auth },
  );
  const data = started.data as Record<string, unknown>;
  const actualRunId = String(data.run_id);
  if (actualRunId !== "run:fixture-skills-01") {
    const run = fake.runs.get(actualRunId);
    if (run) {
      fake.runs.delete(actualRunId);
      fake.runs.set("run:fixture-skills-01", { ...run, run_id: "run:fixture-skills-01" });
    }
  }
}

function hrMs(start: bigint, end: bigint): number {
  return Number(end - start) / 1e6;
}

describe(`Phase 6 perf baseline (${PHASE6_PERF_EVIDENCE_TIER})`, () => {
  it("13. measures enqueue/hook latency, record size, drain throughput, queue growth, restart time", async () => {
    const brainFake = await createBrainFake();
    const skillsFake = new SkillsFakeService();
    const auth = mintFakeToken(fixtureSkillsClaim());
    seedSkillsRun(skillsFake, auth);
    const { brain, skills } = createStores(100);

    const brainRuntime = createLinkbrainRuntime({
      config: parseLinkbrainConfig({ captureEnqueue: true, captureDrain: true }),
      stores: brain,
      transport: createBrainFakeTransport(brainFake),
    });
    const skillsRuntime = createLinkskillsRuntime({
      config: parseLinkskillsConfig({ telemetryEnqueue: true, telemetryDrain: true }),
      stores: skills,
      transport: createSkillsFakeTransport({ fake: skillsFake, authorization: auth }),
    });
    await Promise.all([brainRuntime.open(), skillsRuntime.open()]);

    // --- Enqueue latency ---
    const enqueueStart = process.hrtime.bigint();
    await brainRuntime.enqueueWrite({
      kind: "capture_batch",
      toolName: "brain_capture_batch",
      idempotencyKey: "cap:phase6:perf:enqueue",
      body: sampleBrainBatch,
    });
    await skillsRuntime.enqueueTelemetry({
      idempotencyKey: "idem:phase6:perf:enqueue",
      body: sampleSkillsTelemetry,
    });
    const enqueueMs = hrMs(enqueueStart, process.hrtime.bigint());
    expect(enqueueMs).toBeLessThan(PHASE6_PERF_BUDGETS.enqueueLatencyMs);

    // --- Record size ---
    const brainEntries = await brain.outbox.entries();
    const skillsEntries = await skills.outbox.entries();
    const brainRecordBytes = Buffer.byteLength(
      JSON.stringify(brainEntries[0]?.value ?? {}),
      "utf8",
    );
    const skillsRecordBytes = Buffer.byteLength(
      JSON.stringify(skillsEntries[0]?.value ?? {}),
      "utf8",
    );
    expect(brainRecordBytes).toBeGreaterThan(0);
    expect(skillsRecordBytes).toBeGreaterThan(0);
    expect(brainRecordBytes).toBeLessThanOrEqual(PHASE6_PERF_BUDGETS.maxRecordBytes);
    expect(skillsRecordBytes).toBeLessThanOrEqual(PHASE6_PERF_BUDGETS.maxRecordBytes);

    // --- Hook latency proxy: enqueue already done; drain one each ---
    const hookStart = process.hrtime.bigint();
    const [brainDrainOne, skillsDrainOne] = await Promise.all([
      brainRuntime.drainOnce(),
      skillsRuntime.drainOnce(),
    ]);
    const hookMs = hrMs(hookStart, process.hrtime.bigint());
    expect(brainDrainOne.drained).toBe(1);
    expect(skillsDrainOne.drained).toBe(1);
    expect(hookMs).toBeLessThan(PHASE6_PERF_BUDGETS.hookLatencyMs);

    // --- Drain throughput (20 items each domain) ---
    const batch = 20;
    for (let i = 0; i < batch; i += 1) {
      await brainRuntime.enqueueWrite({
        kind: "capture_batch",
        toolName: "brain_capture_batch",
        idempotencyKey: `cap:phase6:perf:batch:${i}`,
        body: {
          ...sampleBrainBatch,
          batchId: `batch_phase6_perf_${i}`,
          idempotencyKey: `cap:session_phase6_lisa:${i * 2 + 1}:${i * 2 + 2}`,
          events: [
            {
              ...sampleBrainBatch.events[0]!,
              eventId: `event_phase6_perf_${i}_1`,
              sequence: i * 2 + 1,
            },
            {
              ...sampleBrainBatch.events[1]!,
              eventId: `event_phase6_perf_${i}_2`,
              sequence: i * 2 + 2,
            },
          ],
        },
      });
      await skillsRuntime.enqueueTelemetry({
        idempotencyKey: `idem:phase6:perf:batch:${i}`,
        body: {
          ...sampleSkillsTelemetry,
          event_id: `evt:phase6-perf-${i}`,
          sequence: i + 1,
          idempotency_key: `idem:phase6:perf:batch:${i}`,
        },
      });
    }
    const drainStart = process.hrtime.bigint();
    const [brainBatchDrain, skillsBatchDrain] = await Promise.all([
      brainRuntime.drainOnce(),
      skillsRuntime.drainOnce(),
    ]);
    const drainMs = hrMs(drainStart, process.hrtime.bigint());
    expect(brainBatchDrain.drained).toBe(batch);
    expect(skillsBatchDrain.drained).toBe(batch);
    const totalDrained = brainBatchDrain.drained + skillsBatchDrain.drained;
    const throughput = totalDrained / (drainMs / 1000);
    expect(throughput).toBeGreaterThanOrEqual(PHASE6_PERF_BUDGETS.minDrainThroughputPerSec);

    // --- Queue growth until reject-new ---
    const capped = createStores(10);
    const brainCap = createLinkbrainRuntime({
      config: parseLinkbrainConfig({
        captureEnqueue: true,
        captureDrain: false,
        outboxMaxEntries: 10,
      }),
      stores: capped.brain,
      transport: {
        async write() {
          return { ok: true };
        },
      },
    });
    await brainCap.open();
    let accepted = 0;
    for (let i = 0; i < 20; i += 1) {
      try {
        await brainCap.enqueueWrite({
          kind: "capture_batch",
          toolName: "brain_capture_batch",
          idempotencyKey: `cap:phase6:perf:growth:${i}`,
          body: sampleBrainBatch,
        });
        accepted += 1;
      } catch (error) {
        expect(String(error)).toMatch(/overflow \(reject-new\)/);
        break;
      }
    }
    expect(accepted).toBe(PHASE6_PERF_BUDGETS.maxQueueGrowthBeforeReject);
    expect((await brainCap.diagnostics()).capacity.outboxRemaining).toBe(0);

    // --- Restart time: pending → shutdown → reopen → drain ---
    const restartStores = createStores(100);
    const brainConfig = parseLinkbrainConfig({ captureEnqueue: true, captureDrain: true });
    const skillsConfig = parseLinkskillsConfig({ telemetryEnqueue: true, telemetryDrain: true });
    const brainA = createLinkbrainRuntime({
      config: brainConfig,
      stores: restartStores.brain,
      transport: createBrainFakeTransport(brainFake),
    });
    const skillsA = createLinkskillsRuntime({
      config: skillsConfig,
      stores: restartStores.skills,
      transport: createSkillsFakeTransport({ fake: skillsFake, authorization: auth }),
    });
    await Promise.all([brainA.open(), skillsA.open()]);
    await Promise.all([
      brainA.enqueueWrite({
        kind: "capture_batch",
        toolName: "brain_capture_batch",
        idempotencyKey: "cap:phase6:perf:restart",
        body: sampleBrainBatch,
      }),
      skillsA.enqueueTelemetry({
        idempotencyKey: "idem:phase6:perf:restart",
        body: {
          ...sampleSkillsTelemetry,
          event_id: "evt:phase6-perf-restart",
          idempotency_key: "idem:phase6:perf:restart",
        },
      }),
    ]);

    const restartStart = process.hrtime.bigint();
    await Promise.all([brainA.shutdown(), skillsA.shutdown()]);
    const brainB = createLinkbrainRuntime({
      config: brainConfig,
      stores: restartStores.brain,
      transport: createBrainFakeTransport(brainFake),
    });
    const skillsB = createLinkskillsRuntime({
      config: skillsConfig,
      stores: restartStores.skills,
      transport: createSkillsFakeTransport({ fake: skillsFake, authorization: auth }),
    });
    await Promise.all([brainB.open(), skillsB.open()]);
    const [brainRestartDrain, skillsRestartDrain] = await Promise.all([
      brainB.drainOnce(),
      skillsB.drainOnce(),
    ]);
    const restartMs = hrMs(restartStart, process.hrtime.bigint());
    expect(brainRestartDrain.drained).toBe(1);
    expect(skillsRestartDrain.drained).toBe(1);
    expect(restartMs).toBeLessThan(PHASE6_PERF_BUDGETS.restartRecoverMs);

    // Surface measurements for status/baseline docs (deterministic labels only).
    expect({
      evidenceTier: PHASE6_PERF_EVIDENCE_TIER,
      enqueueMs,
      hookMs,
      brainRecordBytes,
      skillsRecordBytes,
      drainMs,
      throughputPerSec: throughput,
      queueAcceptedBeforeReject: accepted,
      restartMs,
      budgets: PHASE6_PERF_BUDGETS,
    }).toMatchObject({
      evidenceTier: "fake/integration-local",
      budgets: PHASE6_PERF_BUDGETS,
    });
  });
});
