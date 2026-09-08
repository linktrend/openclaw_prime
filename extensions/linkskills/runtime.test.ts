import { describe, expect, it, vi } from "vitest";
import { mintFakeToken } from "./fake/auth.mjs";
import { fixtureSkillsClaim } from "./fake/harness.mjs";
import { SkillsFakeService } from "./fake/service.mjs";
import { parseLinkskillsConfig } from "./src/config.js";
import { buildSkillsTelemetryEnvelope, findProhibitedSkillsField } from "./src/envelopes.js";
import { LINKSKILLS_NAMESPACES, LINKSKILLS_NAMESPACE_LIST } from "./src/namespaces.js";
import {
  createLinkskillsRuntime,
  createSkillsFakeTransport,
  type LinkskillsLeaseRunner,
} from "./src/runtime.js";
import { openLinkskillsStores } from "./src/stores.js";
import { createMemoryKeyedStore } from "./src/test-support/memory-store.js";

function createTestStores(maxEntries = 100) {
  const opened: string[] = [];
  const stores = openLinkskillsStores({
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

const sampleTelemetry = {
  schema_version: "0.1",
  event_id: "evt:runtime-01",
  event_type: "skill.run_started",
  occurred_at: "2026-07-27T10:00:00Z",
  sequence: 1,
  idempotency_key: "idem:run-start-runtime-01",
  correlation_id: "corr:runtime-01",
  actor_id: "actor:fixture-lisa-01",
  runtime_profile_id: "runtime:fixture-openclaw-01",
  session_id: "session:fixture-opaque-01",
  run_id: "run:fixture-skills-01",
  skill_id: "skill.fixture.echo",
  skill_release_hash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  execution_profile_hash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  outcome: "info",
  sensitivity: "public_internal",
  metrics: {
    duration_ms: 0,
    tool_calls: 0,
  },
  payload: {
    status: "started",
    note: "No conversation or content fields permitted",
  },
};

function seedRun(fake: SkillsFakeService, auth: string, runId = "run:fixture-skills-01") {
  const started = fake.dispatch(
    "skills_run_start",
    {
      params: {
        skill_id: "skill.fixture.echo",
        release_hash: sampleTelemetry.skill_release_hash,
        execution_profile_hash: sampleTelemetry.execution_profile_hash,
        session_id: sampleTelemetry.session_id,
      },
      idempotency_key: `idem:seed-${runId}`,
      request_id: `req:seed-${runId}`,
      authorization: auth,
    },
    { authorization: auth },
  );
  const data = started.data as Record<string, unknown>;
  const actualRunId = String(data.run_id);
  // Align fixture run id used by sample telemetry when the fake mints a UUID.
  if (actualRunId !== runId) {
    const run = fake.runs.get(actualRunId);
    if (run) {
      fake.runs.delete(actualRunId);
      fake.runs.set(runId, { ...run, run_id: runId });
    }
  }
  return runId;
}

describe("linkskills outbox runtime", () => {
  it("opens only plan namespaces with reject-new", () => {
    const { opened, stores } = createTestStores();
    expect(opened.toSorted()).toEqual([...LINKSKILLS_NAMESPACE_LIST].toSorted());
    expect(stores.openedNamespaces).toEqual(LINKSKILLS_NAMESPACE_LIST);
    expect(Object.values(LINKSKILLS_NAMESPACES)).toEqual(
      expect.arrayContaining(["outbox", "deadletter", "cursor", "health"]),
    );
    expect(Object.values(LINKSKILLS_NAMESPACES)).not.toContain("capture-buffer");
  });

  it("rejects prohibited conversation/content fields at enqueue", () => {
    expect(findProhibitedSkillsField({ conversation: "nope" })).toEqual({
      path: "conversation",
      key: "conversation",
    });
    expect(() =>
      buildSkillsTelemetryEnvelope({
        toolName: "skills_feedback_submit",
        idempotencyKey: "idem:bad",
        redactionPolicyVersion: "skills.telemetry.v0",
        createdAtMs: 1,
        body: {
          ...sampleTelemetry,
          prompt: "should never enqueue",
        },
      }),
    ).toThrow(/unknown field rejected: prompt/);
  });

  it("rejects nested prohibited payload fields", () => {
    expect(() =>
      buildSkillsTelemetryEnvelope({
        toolName: "skills_feedback_submit",
        idempotencyKey: "idem:nested",
        redactionPolicyVersion: "skills.telemetry.v0",
        createdAtMs: 1,
        body: {
          ...sampleTelemetry,
          payload: { message_body: "leak" },
        },
      }),
    ).toThrow(/unknown field rejected: payload.message_body/);
  });

  it("drains ordered telemetry against Skills fake with idempotent replay", async () => {
    const fake = new SkillsFakeService();
    const auth = mintFakeToken(fixtureSkillsClaim());
    seedRun(fake, auth);
    const { stores } = createTestStores();
    const config = parseLinkskillsConfig({
      telemetryEnqueue: true,
      telemetryDrain: true,
    });
    const runtime = createLinkskillsRuntime({
      config,
      stores,
      transport: createSkillsFakeTransport({ fake, authorization: auth }),
      now: (() => {
        let t = 1_000;
        return () => {
          t += 1;
          return t;
        };
      })(),
    });
    await runtime.open();

    const first = await runtime.enqueueTelemetry({
      idempotencyKey: "idem:order:001",
      body: sampleTelemetry,
    });
    const second = await runtime.enqueueTelemetry({
      idempotencyKey: "idem:order:002",
      body: {
        ...sampleTelemetry,
        event_id: "evt:runtime-02",
        sequence: 2,
        idempotency_key: "idem:order:002",
      },
    });
    expect(first.key < second.key).toBe(true);

    const drain = await runtime.drainOnce();
    expect(drain.drained).toBe(2);
    expect((await runtime.diagnostics()).outboxCount).toBe(0);

    await runtime.enqueueTelemetry({
      idempotencyKey: "idem:order:001",
      body: sampleTelemetry,
    });
    const replayDrain = await runtime.drainOnce();
    expect(replayDrain.drained).toBe(1);
    expect(fake.idempotency.size).toBeGreaterThan(0);
  });

  it("rejects new outbox entries at capacity", async () => {
    const { stores } = createTestStores(1);
    const runtime = createLinkskillsRuntime({
      config: parseLinkskillsConfig({
        telemetryEnqueue: true,
        telemetryDrain: true,
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
    await runtime.enqueueTelemetry({
      idempotencyKey: "idem:overflow:1",
      body: sampleTelemetry,
    });
    await expect(
      runtime.enqueueTelemetry({
        idempotencyKey: "idem:overflow:2",
        body: sampleTelemetry,
      }),
    ).rejects.toThrow(/overflow \(reject-new\)/);
    expect((await runtime.diagnostics()).outboxCount).toBe(1);
    expect((await runtime.diagnostics()).capacity.outboxRemaining).toBe(0);
  });

  it("dead-letters terminal Skills failures", async () => {
    const { stores } = createTestStores();
    const runtime = createLinkskillsRuntime({
      config: parseLinkskillsConfig({ telemetryEnqueue: true, telemetryDrain: true }),
      stores,
      transport: {
        async write() {
          return {
            ok: false,
            terminal: true,
            errorCode: "terminal",
            safeMessage: "terminal failure",
          };
        },
      },
    });
    await runtime.open();
    await runtime.enqueueTelemetry({
      idempotencyKey: "idem:dead:001",
      body: sampleTelemetry,
    });
    const drain = await runtime.drainOnce();
    expect(drain.deadLettered).toBe(1);
    const diagnostics = await runtime.diagnostics();
    expect(diagnostics.outboxCount).toBe(0);
    expect(diagnostics.deadLetterCount).toBe(1);
    const dead = await stores.deadletter.entries();
    expect(dead[0]?.value).toMatchObject({
      terminalCode: "terminal",
      redactedMeta: {
        eventId: "evt:runtime-01",
        runId: "run:fixture-skills-01",
        skillId: "skill.fixture.echo",
        skillReleaseHash: sampleTelemetry.skill_release_hash,
        executionProfileHash: sampleTelemetry.execution_profile_hash,
      },
    });
    expect(dead[0]?.value).not.toHaveProperty("envelope");
  });

  it("recovers pending outbox after restart and serializes lease drain", async () => {
    const fake = new SkillsFakeService();
    const auth = mintFakeToken(fixtureSkillsClaim());
    seedRun(fake, auth);
    const { stores } = createTestStores();
    const config = parseLinkskillsConfig({ telemetryEnqueue: true, telemetryDrain: true });
    const leaseCalls: string[] = [];
    let leaseHeld = false;
    const withLease: LinkskillsLeaseRunner = async (_options, run) => {
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

    const first = createLinkskillsRuntime({
      config,
      stores,
      transport: createSkillsFakeTransport({ fake, authorization: auth }),
      withLease,
    });
    await first.open();
    await first.enqueueTelemetry({
      idempotencyKey: "idem:restart:001",
      body: sampleTelemetry,
    });
    await first.shutdown();

    const second = createLinkskillsRuntime({
      config,
      stores,
      transport: createSkillsFakeTransport({ fake, authorization: auth }),
      withLease,
    });
    await second.open();
    expect((await second.diagnostics()).outboxCount).toBe(1);
    const drain = await second.drainOnce();
    expect(drain.drained).toBe(1);
    expect(leaseCalls).toEqual(["acquire", "release"]);
    expect((await second.diagnostics()).outboxCount).toBe(0);
  });

  it("exposes capacity diagnostics without payloads and isolates Skills state", async () => {
    const { stores, opened } = createTestStores();
    let nowMs = 5_000;
    const runtime = createLinkskillsRuntime({
      config: parseLinkskillsConfig({
        telemetryEnqueue: true,
        telemetryDrain: false,
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
    await runtime.enqueueTelemetry({
      idempotencyKey: "idem:diag:001",
      body: sampleTelemetry,
    });
    nowMs = 8_000;
    const diagnostics = await runtime.diagnostics();
    expect(diagnostics.outboxCount).toBe(1);
    expect(diagnostics.oldestOutboxAgeMs).toBe(3_000);
    expect(diagnostics.oldestOutboxKey).toMatch(/^skills:structured_event:/);
    expect(JSON.stringify(diagnostics)).not.toContain("conversation");
    expect(JSON.stringify(diagnostics)).not.toContain("No conversation");
    expect(opened).not.toContain("capture-buffer");
    expect(stores.openedNamespaces).toHaveLength(4);
  });

  it("plugin-disabled / flag-disabled baseline has no remote side effects", async () => {
    const write = vi.fn(async () => ({ ok: true }));
    const runtime = createLinkskillsRuntime({
      config: parseLinkskillsConfig({}),
      stores: createTestStores().stores,
      transport: { write },
    });
    await runtime.open();
    await expect(
      runtime.enqueueTelemetry({
        idempotencyKey: "idem:disabled:001",
        body: sampleTelemetry,
      }),
    ).rejects.toThrow(/telemetryEnqueue is disabled/);
    const drain = await runtime.drainOnce();
    expect(drain).toEqual({ drained: 0, retried: 0, deadLettered: 0, skipped: 0 });
    expect(write).not.toHaveBeenCalled();
  });
});
